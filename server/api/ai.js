// ── AI proxy handler (Vercel / Next.js API route compatible) ──────────────────
// SECURITY (report A1): the OpenAI secret key lives ONLY here, server-side, in
// `process.env.OPENAI_API_KEY`. The mobile app never ships the key; it POSTs
// chat requests to this endpoint, which forwards them to OpenAI and relays the
// response. Deploy this to Vercel (or any Node host) and point the app's
// `extra.aiProxyUrl` at the resulting URL (e.g. https://<app>.vercel.app/api/ai).
//
// This handler is SERVER code. It is intentionally NOT imported by the React
// Native bundle.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// Whitelist of models the app is allowed to request, so a compromised client
// can't run up the bill on an arbitrary model.
const ALLOWED_MODELS = new Set(['gpt-4o', 'gpt-4o-mini']);
const DEFAULT_MODEL = 'gpt-4o';

// Hard caps to bound cost/abuse regardless of what the client sends.
const MAX_TOKENS_CAP = 1200;
const MAX_MESSAGES = 40;
const UPSTREAM_TIMEOUT_MS = 30000;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Vercel/Next-style default export: (req, res).
module.exports = async function handler(req, res) {
  // CORS — Expo apps send from arbitrary origins / native runtime. Lock this
  // down to your app's domain(s) in production if you serve a web build.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'Server missing OPENAI_API_KEY' });
  }

  // Body may arrive parsed (Next/Vercel) or as a raw stream (bare Node).
  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      body = JSON.parse(body || (await readRawBody(req)) || '{}');
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
  }

  const { messages, max_tokens, temperature, response_format, model } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return sendJson(res, 400, { error: 'messages[] is required' });
  }
  if (messages.length > MAX_MESSAGES) {
    return sendJson(res, 400, { error: 'too many messages' });
  }

  const chosenModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  const cappedTokens = Math.min(
    Number.isFinite(max_tokens) ? max_tokens : 300,
    MAX_TOKENS_CAP
  );

  const payload = {
    model: chosenModel,
    messages,
    max_tokens: cappedTokens,
    temperature: typeof temperature === 'number' ? temperature : 0.7,
  };
  if (response_format) payload.response_format = response_format;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      // Relay status but never leak the key or full upstream error verbatim.
      return sendJson(res, upstream.status, {
        error: 'Upstream AI error',
        status: upstream.status,
      });
    }
    // Return the OpenAI response shape unchanged so the client reads
    // data.choices[0].message.content as before.
    return sendJson(res, 200, data);
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    return sendJson(res, aborted ? 504 : 502, {
      error: aborted ? 'Upstream timeout' : 'Proxy request failed',
    });
  } finally {
    clearTimeout(timer);
  }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
