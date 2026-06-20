// Health log service — body measurements + symptoms, backed by Supabase
// (RLS-scoped to the signed-in user). Exported SIGNATURES are identical to the
// previous AsyncStorage version so screens don't change. Every call is guarded
// so the UI never crashes on a network error.
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

async function resolveUserId(fallbackUid) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user?.id) return data.user.id;
  } catch {
    // ignore
  }
  return fallbackUid || null;
}

const MEASUREMENT_FIELDS = ['waist', 'arm', 'neck', 'chest', 'hip'];
const SYMPTOM_TYPES = ['nausea', 'fatigue', 'constipation', 'headache', 'appetite', 'other'];

function todayDateString() {
  return new Date().toISOString().split('T')[0];
}
function parseCm(value) {
  if (value == null || value === '') return null;
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  if (normalized === '') return null;
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
}
function parseSeverity(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 1;
  return Math.min(3, Math.max(1, Math.round(n)));
}

// ── Body measurements ──────────────────────────────────────────────────────────
export async function saveMeasurement(uid, { date, waist, arm, neck, chest, hip } = {}) {
  const row = { date: date || todayDateString() };
  const incoming = { waist, arm, neck, chest, hip };
  for (const field of MEASUREMENT_FIELDS) {
    const cm = parseCm(incoming[field]);
    if (cm != null) row[field] = cm;
  }
  if (!isSupabaseConfigured()) return await getMeasurements(uid);
  try {
    const userId = await resolveUserId(uid);
    if (userId) {
      await supabase.from('body_measurements').insert({ user_id: userId, ...row });
    }
  } catch {
    // ignore
  }
  return await getMeasurements(uid);
}

export async function getMeasurements(uid) {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('body_measurements').select('*').order('date', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => ({
      date: r.date, waist: r.waist, arm: r.arm, neck: r.neck, chest: r.chest, hip: r.hip,
    }));
  } catch {
    return [];
  }
}

// ── Symptoms / side effects ──────────────────────────────────────────────────────
export async function logSymptom(uid, { date, type, severity } = {}) {
  const entry = {
    date: date || todayDateString(),
    type: SYMPTOM_TYPES.includes(type) ? type : 'other',
    severity: parseSeverity(severity),
  };
  if (!isSupabaseConfigured()) return await getSymptoms(uid);
  try {
    const userId = await resolveUserId(uid);
    if (userId) {
      await supabase.from('symptom_logs').insert({ user_id: userId, ...entry });
    }
  } catch {
    // ignore
  }
  return await getSymptoms(uid);
}

export async function getSymptoms(uid) {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('symptom_logs').select('*').order('date', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => ({ date: r.date, type: r.type, severity: r.severity }));
  } catch {
    return [];
  }
}
