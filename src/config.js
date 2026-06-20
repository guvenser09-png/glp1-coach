import Constants from 'expo-constants';

// ── AI proxy URL ──────────────────────────────────────────────────────────────
// SECURITY (report A1): the OpenAI secret key is NO LONGER embedded in the app.
// The app talks only to OUR backend proxy (see server/), which holds the key in
// server-side env. This is the only AI-related value the client may ship.
export const aiProxyUrl =
  Constants.expoConfig?.extra?.aiProxyUrl ||
  process.env.EXPO_PUBLIC_AI_PROXY_URL ||
  '';

// ── Back-compat AI availability flag (NOT a key) ──────────────────────────────
// Several screens/services historically imported `OPENAI_API_KEY` purely as a
// truthiness gate ("is AI available? then call it"). The real secret key has
// been REMOVED from the client. We keep this named export so those import sites
// keep resolving, but it now reflects only whether the AI proxy is configured —
// it is NOT a usable credential and carries no secret. Prefer `aiProxyUrl` or
// `isAIConfigured()` (services/aiClient) in new code.
export const OPENAI_API_KEY = aiProxyUrl ? 'proxy' : '';

// RevenueCat publishable key (safe to ship client-side by design).
export const REVENUECAT_API_KEY =
  Constants.expoConfig?.extra?.revenuecatApiKey ||
  '';
