import Constants from 'expo-constants';

// ── Client-shippable config ───────────────────────────────────────────────────
// SECURITY (audit #2, #6, #8): the app has NO OpenAI key and NO standalone HTTP
// proxy URL. All AI calls go through the Supabase Edge Function `ai-proxy` via
// supabase.functions.invoke (see services/aiClient.ts), which attaches the user's
// JWT and holds the OpenAI key server-side. To check AI availability, use
// `isAIConfigured()` from services/aiClient — do NOT reintroduce an API-key gate.

// RevenueCat publishable key (safe to ship client-side by design; empty unless
// the paywall is re-enabled).
export const REVENUECAT_API_KEY = Constants.expoConfig?.extra?.revenuecatApiKey || '';
