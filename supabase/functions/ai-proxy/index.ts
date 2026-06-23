// ── ai-proxy: hardened server-side OpenAI proxy (audit #6) ────────────────────
//
// PURPOSE
//   The OpenAI API key NEVER ships in the app bundle. The React Native client
//   calls this Supabase Edge Function via `supabase.functions.invoke('ai-proxy')`,
//   which automatically attaches the caller's Supabase JWT. This function holds
//   the key server-side and forwards a single chat/vision completion to OpenAI.
//
// DEPLOYMENT
//   - Deploy with verify_jwt=true (the platform rejects unauthenticated callers).
//     We ALSO defensively read the Authorization header here and reject if absent.
//   - Required secret (Supabase dashboard → Edge Functions → Secrets):
//       OPENAI_API_KEY
//
// SECURITY HARDENING
//   - JWT required (header check + platform verify_jwt). User id derived from the
//     JWT `sub` claim for per-user rate limiting.
//   - Model whitelist: only 'gpt-4o-mini' (text/coach/notifications/diet) and
//     'gpt-4o' (vision/photo). Anything else → 400.
//   - Per-user rate limiting (in-memory; see RATE LIMITS below).
//   - maxTokens clamped to a server max; fetch to OpenAI guarded by a timeout.
//   - CORS: native app, no browser Origin. We never reflect arbitrary Origin
//     with '*'. OPTIONS is handled for completeness.
//   - No body/content logging (PII): only coarse metadata (user-id hash, model,
//     status, latency) is logged.
//
// RESPONSE SHAPE (matches aiClient.ts expectations)
//   - success: { content: string }
//   - failure: { error: string, message: string }  (+ appropriate HTTP status)

// ── Config / constants ────────────────────────────────────────────────────────

// Model whitelist. The default (mini) covers text estimate / coach / notifications
// / diet plans; gpt-4o is reserved for vision/photo analysis (cost control).
const ALLOWED_MODELS = new Set<string>(['gpt-4o-mini', 'gpt-4o']);
const DEFAULT_MODEL = 'gpt-4o-mini';

// Token cap: the proxy clamps any caller-requested maxTokens to this ceiling so a
// buggy/malicious client can't drive up cost with a huge completion budget.
const SERVER_MAX_TOKENS = 1024;
const DEFAULT_MAX_TOKENS = 300;

// Timeout for the upstream OpenAI request (AbortController). Keeps a hung
// upstream from holding the edge instance / the user's request open.
const OPENAI_TIMEOUT_MS = 30_000;

// ── RATE LIMITS (in-memory, fixed-window) ─────────────────────────────────────
// Per authenticated user:
//   - PER_MINUTE: max 20 requests in any rolling 60s window.
//   - PER_DAY:    max 300 requests per UTC calendar day.
// NOTE: this state lives in the edge instance's memory and is therefore per
// instance / best-effort. It resets on cold start and is not shared across
// concurrent instances. For strict, durable limits at scale, back this with
// Postgres (a `rate_limits` table + upsert) or Upstash Redis. In-memory is an
// acceptable first line of defense against a single runaway client here.
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_PER_DAY = 300;
const MINUTE_MS = 60_000;

interface UserRate {
  // rolling-minute window
  minuteWindowStart: number;
  minuteCount: number;
  // per-UTC-day window
  dayKey: string; // YYYY-MM-DD (UTC)
  dayCount: number;
}

const rateState = new Map<string, UserRate>();

function utcDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Returns true if the request is allowed; mutates the counters when allowed. */
function checkRateLimit(userId: string, now: number): { allowed: boolean; reason?: string } {
  let st = rateState.get(userId);
  const today = utcDayKey(now);

  if (!st) {
    st = { minuteWindowStart: now, minuteCount: 0, dayKey: today, dayCount: 0 };
    rateState.set(userId, st);
  }

  // Roll the minute window.
  if (now - st.minuteWindowStart >= MINUTE_MS) {
    st.minuteWindowStart = now;
    st.minuteCount = 0;
  }
  // Roll the day window.
  if (st.dayKey !== today) {
    st.dayKey = today;
    st.dayCount = 0;
  }

  if (st.dayCount >= RATE_LIMIT_PER_DAY) {
    return { allowed: false, reason: 'daily' };
  }
  if (st.minuteCount >= RATE_LIMIT_PER_MINUTE) {
    return { allowed: false, reason: 'minute' };
  }

  st.minuteCount += 1;
  st.dayCount += 1;
  return { allowed: true };
}

// Opportunistically prune stale users so the map can't grow unbounded over the
// lifetime of a warm instance.
function pruneRateState(now: number): void {
  if (rateState.size < 5000) return;
  const today = utcDayKey(now);
  for (const [k, v] of rateState) {
    const staleMinute = now - v.minuteWindowStart >= MINUTE_MS;
    if (staleMinute && v.dayKey !== today) rateState.delete(k);
  }
}

// ── CORS ──────────────────────────────────────────────────────────────────────
// Native app → requests carry no browser Origin, so there is nothing to reflect.
// We intentionally do NOT echo an arbitrary Origin and do NOT use '*' for
// credentialed responses. These headers only matter for an OPTIONS preflight.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function errorResponse(error: string, message: string, status: number): Response {
  return json({ error, message }, status);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Best-effort decode of the JWT `sub` claim (used only as a rate-limit key).
 *  We do NOT trust this for authz — verify_jwt at the platform handles that. */
function userIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const sub = payload?.sub;
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}

/** Non-reversible short hash of the user id, for safe (non-PII) logging. */
async function hashUserId(userId: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(userId);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(digest)).slice(0, 6);
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'unknown';
  }
}

function clampMaxTokens(requested: unknown): number {
  const n = typeof requested === 'number' && isFinite(requested) ? Math.floor(requested) : DEFAULT_MAX_TOKENS;
  if (n < 1) return 1;
  if (n > SERVER_MAX_TOKENS) return SERVER_MAX_TOKENS;
  return n;
}

function clampTemperature(requested: unknown): number {
  const n = typeof requested === 'number' && isFinite(requested) ? requested : 0.7;
  if (n < 0) return 0;
  if (n > 2) return 2;
  return n;
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const started = Date.now();

  // CORS preflight (native app normally won't send this, but be correct).
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Only POST is supported.', 405);
  }

  // Require a JWT (defense in depth alongside verify_jwt=true).
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) {
    return errorResponse('unauthorized', 'Missing or invalid Authorization header.', 401);
  }

  const userId = userIdFromJwt(authHeader);
  if (!userId) {
    return errorResponse('unauthorized', 'Could not derive a user identity from the token.', 401);
  }

  const now = Date.now();
  pruneRateState(now);
  const rl = checkRateLimit(userId, now);
  if (!rl.allowed) {
    const msg = rl.reason === 'daily'
      ? 'Daily AI request limit reached. Please try again tomorrow.'
      : 'Too many AI requests. Please slow down and try again shortly.';
    return errorResponse('rate_limited', msg, 429);
  }

  // Parse body.
  let body: {
    messages?: unknown;
    maxTokens?: unknown;
    temperature?: unknown;
    responseFormat?: { type?: string } | undefined;
    model?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse('bad_request', 'Request body must be valid JSON.', 400);
  }

  const { messages, responseFormat } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse('bad_request', 'A non-empty `messages` array is required.', 400);
  }

  // Model whitelist enforcement (cost + abuse control).
  const requestedModel = typeof body.model === 'string' && body.model.length > 0 ? body.model : DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(requestedModel)) {
    return errorResponse(
      'model_not_allowed',
      `Model "${requestedModel}" is not permitted. Allowed: ${Array.from(ALLOWED_MODELS).join(', ')}.`,
      400,
    );
  }

  const maxTokens = clampMaxTokens(body.maxTokens);
  const temperature = clampTemperature(body.temperature);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    // Misconfiguration — secret not set. Do not leak details.
    return errorResponse('not_configured', 'AI service is not configured.', 503);
  }

  // Build the OpenAI payload. `messages` is forwarded as-is (it already carries
  // text and/or vision image_url parts shaped by the client).
  const openaiPayload: Record<string, unknown> = {
    model: requestedModel,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (responseFormat && typeof responseFormat.type === 'string') {
    openaiPayload.response_format = { type: responseFormat.type };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let status = 500;
  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiPayload),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      status = upstream.status === 429 ? 429 : 502;
      // Do NOT forward upstream error bodies (may contain prompt echoes / details).
      const logHash = await hashUserId(userId);
      console.log(JSON.stringify({
        evt: 'ai_proxy', user: logHash, model: requestedModel,
        status: upstream.status, ms: Date.now() - started, ok: false,
      }));
      return errorResponse('upstream_error', 'The AI service returned an error. Please try again.', status);
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      const logHash = await hashUserId(userId);
      console.log(JSON.stringify({
        evt: 'ai_proxy', user: logHash, model: requestedModel,
        status: 502, ms: Date.now() - started, ok: false,
      }));
      return errorResponse('empty_completion', 'The AI service returned no content.', 502);
    }

    status = 200;
    const logHash = await hashUserId(userId);
    // Coarse metadata only — never the prompt, messages, or completion (PII).
    console.log(JSON.stringify({
      evt: 'ai_proxy', user: logHash, model: requestedModel,
      status, ms: Date.now() - started, ok: true,
    }));

    return json({ content });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    status = aborted ? 504 : 500;
    const logHash = await hashUserId(userId);
    console.log(JSON.stringify({
      evt: 'ai_proxy', user: logHash, model: requestedModel,
      status, ms: Date.now() - started, ok: false,
    }));
    return errorResponse(
      aborted ? 'timeout' : 'proxy_error',
      aborted ? 'The AI request timed out. Please try again.' : 'An unexpected error occurred. Please try again.',
      status,
    );
  } finally {
    clearTimeout(timeout);
  }
});
