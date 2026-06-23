// ── AI proxy client ───────────────────────────────────────────────────────────
// SECURITY (report A1): the OpenAI key NEVER lives in the app bundle. This client
// calls the Supabase Edge Function `ai-proxy` (via functions.invoke, which attaches
// the user's JWT automatically); the function holds the OpenAI key server-side.
// On any failure it throws an Error with `.code === 'AI_UNAVAILABLE'` so call sites
// fall back to their OFFLINE behavior (local food DB estimate / local coach reply).
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { ChatMessage } from '../types';

interface AIError extends Error {
  code?: string;
}

function aiUnavailable(message?: string): AIError {
  const err = new Error(message || 'AI proxy is not available') as AIError;
  err.code = 'AI_UNAVAILABLE';
  return err;
}

export interface CallAIChatArgs {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: string };
  /**
   * Task-based model selection (report #6, cost). Optional; when omitted the
   * cheaper `gpt-4o-mini` is used (text estimate / coach / notifications / diet).
   * Only the photo/vision path passes `gpt-4o`. The ai-proxy Edge Function
   * enforces a whitelist and rejects anything else with HTTP 400.
   */
  model?: string;
}

// Default model for all non-vision tasks. Kept here so call sites can simply
// omit `model`; the photo/vision path opts into 'gpt-4o' explicitly.
const DEFAULT_MODEL = 'gpt-4o-mini';

/** Single entry point for all AI chat/vision completions. Returns assistant text. */
export async function callAIChat({
  messages,
  maxTokens = 300,
  temperature = 0.7,
  responseFormat,
  model,
}: CallAIChatArgs): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw aiUnavailable('Supabase / AI proxy not configured.');
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw aiUnavailable('callAIChat requires a non-empty messages array.');
  }

  // Default to the cheap model when the caller omits `model` (report #6, cost).
  const resolvedModel = model || DEFAULT_MODEL;

  let lastError: unknown;
  // One initial try + one retry on transient failure (report C2).
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { messages, maxTokens, temperature, responseFormat, model: resolvedModel },
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
    lastError instanceof Error ? `AI request failed: ${lastError.message}` : 'AI request failed.'
  );
}

/** Whether the AI proxy is reachable at all (Supabase configured). */
export function isAIConfigured(): boolean {
  return isSupabaseConfigured();
}
