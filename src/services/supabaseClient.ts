// Supabase client — the app's real backend (auth + Postgres + edge AI proxy).
// URL + publishable key come from app.config extra (safe to ship; public).
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const SUPABASE_URL: string = extra.supabaseUrl || '';
const SUPABASE_ANON_KEY: string = extra.supabaseAnonKey || '';

export const isSupabaseConfigured = (): boolean => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
