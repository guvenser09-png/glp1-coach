// ── delete-account: real server-side account + data deletion (audit #4) ──────
//
// PURPOSE
//   App Store Guideline 5.1.1(v) + KVKK/GDPR right-to-erasure. The React Native
//   client calls this via `supabase.functions.invoke('delete-account')`, which
//   attaches the caller's Supabase JWT. This function verifies that JWT, derives
//   the user id, then permanently deletes EVERY row that user owns across all
//   application tables, and finally deletes the auth user itself. After this the
//   user's health data no longer exists on the server.
//
// DEPLOYMENT
//   - Deploy with verify_jwt=true (platform rejects unauthenticated callers).
//     We ALSO defensively read + verify the Authorization header here.
//   - Required secrets (Supabase dashboard → Edge Functions → Secrets):
//       SUPABASE_URL                  (auto-provided in the Edge runtime)
//       SUPABASE_SERVICE_ROLE_KEY     (MUST be set — never shipped to the client;
//                                      grants the admin/service_role access needed
//                                      to bypass RLS and call auth.admin.deleteUser)
//
// SECURITY
//   - The JWT is verified by creating an anon-key client bound to the caller's
//     bearer token and calling auth.getUser(); only a valid token yields a user.
//   - All destructive work uses a SEPARATE service_role client. The service_role
//     key bypasses RLS, so we scope every delete explicitly to the verified
//     user id (and the social tables' domain-specific owner columns).
//   - CORS restricted: native app sends no browser Origin; we never reflect an
//     arbitrary Origin and never use '*' on a credentialed response. OPTIONS is
//     handled for preflight completeness.
//
// RESPONSE SHAPE (matches SettingsScreen expectations)
//   - success: { ok: true }
//   - failure: { ok: false, error: string, message: string }  (+ HTTP status)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS },
  });
}

function errorResponse(error: string, message: string, status: number): Response {
  return json({ ok: false, error, message }, status);
}

// Every table owned (per-user) by the deleting user, with the column that holds
// the owner id. Mirrors supabase/migrations/0001_init.sql exactly.
//   * Most tables key on `user_id`.
//   * The social tables use domain-specific owner columns:
//       social_posts -> author_id, post_reports -> reporter_id,
//       blocked_users -> blocker_id.
//   * post_likes keys on user_id (the liker).
// Ordered children-before-parents where FK cascades exist, though every FK in the
// schema is ON DELETE CASCADE so the auth.admin.deleteUser at the end would also
// clean up; we delete explicitly first for an auditable, complete wipe.
const OWNED_TABLES: Array<{ table: string; column: string }> = [
  { table: 'post_likes', column: 'user_id' },
  { table: 'post_reports', column: 'reporter_id' },
  { table: 'blocked_users', column: 'blocker_id' },
  { table: 'social_posts', column: 'author_id' },
  { table: 'symptom_logs', column: 'user_id' },
  { table: 'body_measurements', column: 'user_id' },
  { table: 'dose_changes', column: 'user_id' },
  { table: 'dose_logs', column: 'user_id' },
  { table: 'medication_profile', column: 'user_id' },
  { table: 'meal_logs', column: 'user_id' },
  { table: 'weight_logs', column: 'user_id' },
  { table: 'profiles', column: 'user_id' },
];

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Only POST is supported.', 405);
  }

  // Require a bearer token (defense in depth alongside verify_jwt=true).
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  if (!authHeader || !/^Bearer\s+\S+/i.test(authHeader)) {
    return errorResponse('unauthorized', 'Missing or invalid Authorization header.', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    // Misconfiguration — required secret not set. Do not leak details.
    return errorResponse('not_configured', 'Account deletion is not configured.', 503);
  }

  // 1) Verify the caller's JWT by binding it to a client and resolving the user.
  //    Prefer the anon key for this read-only auth check; fall back to the
  //    service role key (still scoped by the provided bearer token) if anon
  //    isn't injected into the runtime.
  const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  try {
    const { data, error } = await authClient.auth.getUser();
    if (error || !data || !data.user || !data.user.id) {
      return errorResponse('unauthorized', 'Could not verify the user from the token.', 401);
    }
    userId = data.user.id;
  } catch {
    return errorResponse('unauthorized', 'Could not verify the user from the token.', 401);
  }

  // 2) Service-role client for the actual deletion (bypasses RLS; scoped by us).
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3) Delete every owned row, table by table. Collect failures so we never
  //    delete the auth user while application data is still orphaned.
  const failures: string[] = [];
  for (const { table, column } of OWNED_TABLES) {
    try {
      const { error } = await admin.from(table).delete().eq(column, userId);
      if (error) failures.push(`${table}: ${error.message}`);
    } catch (e) {
      failures.push(`${table}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }

  if (failures.length > 0) {
    console.log(JSON.stringify({ evt: 'delete_account', ok: false, stage: 'rows', failures: failures.length }));
    return errorResponse(
      'delete_failed',
      'Could not delete all of your data. No account was removed; please try again.',
      500,
    );
  }

  // 4) Finally remove the auth user. Without this the login still exists.
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.log(JSON.stringify({ evt: 'delete_account', ok: false, stage: 'auth_user' }));
      return errorResponse(
        'delete_failed',
        'Your data was removed but the account could not be fully deleted. Please contact support.',
        500,
      );
    }
  } catch {
    return errorResponse(
      'delete_failed',
      'Your data was removed but the account could not be fully deleted. Please contact support.',
      500,
    );
  }

  console.log(JSON.stringify({ evt: 'delete_account', ok: true }));
  return json({ ok: true });
});
