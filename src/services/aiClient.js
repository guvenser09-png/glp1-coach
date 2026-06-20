// ── AI proxy client ───────────────────────────────────────────────────────────
// SECURITY (report A1): the OpenAI key NEVER lives in the app bundle. This client
// calls the Supabase Edge Function `ai-proxy` (via functions.invoke, which attaches
// the user's JWT automatically); the function holds the OpenAI key server-side and
// forwards chat/vision completions.
//
// On any failure (not configured / no server key / network / bad shape) this throws
// an Error with `.code === 'AI_UNAVAILABLE'` so every call site can fall back to its
// existing OFFLINE behavior (local food DB estimate / local coach reply).
import { supabase, isSupabaseConfigured } from './supabaseClient';

function aiUnavailable(message) {
  const err = new Error(message || 'AI proxy is not available');
  err.code = 'AI_UNAVAILABLE';
  return err;
}

/**
 * callAIChat — single entry point for all AI chat/vision completions.
 * @returns {Promise<string>} assistant content (trimmed).
 * @throws  Error with `.code === 'AI_UNAVAILABLE'` on any failure.
 */
export async function callAIChat({
  messages,
  maxTokens = 300,
  temperature = 0.7,
  responseFormat,
  model,
} = {}) {
  if (!isSupabaseConfigured()) {
    throw aiUnavailable('Supabase / AI proxy not configured.');
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw aiUnavailable('callAIChat requires a non-empty messages array.');
  }

  let lastError;
  // One initial try + one retry on transient failure (report C2).
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { messages, maxTokens, temperature, responseFormat, model },
      });
      if (error) throw new Error(error.message || 'invoke error');
      if (data?.error) throw new Error(data.message || data.error);
      const content = data?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error('AI proxy returned an unexpected response shape.');
      }
      return content.trim();
    } catch (e) {
      lastError = e;
    }
  }
  throw aiUnavailable(
    lastError ? `AI request failed: ${lastError.message}` : 'AI request failed.'
  );
}

// Whether the AI proxy is reachable at all (Supabase configured). The proxy
// itself decides if the server key exists; callers fall back on AI_UNAVAILABLE.
export function isAIConfigured() {
  return isSupabaseConfigured();
}
