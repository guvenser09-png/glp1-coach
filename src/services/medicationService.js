// Medication service — backed by Supabase (RLS-scoped to the signed-in user).
// Exported SIGNATURES are kept identical to the previous AsyncStorage version so
// screens don't change; only the persistence internals were swapped. The pure
// scheduling helpers (getNextInjectionDate / getDaysUntilNextInjection) are
// unchanged. Every call is wrapped so the UI never crashes on a network error.
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

// ── Dose helpers (pure) ────────────────────────────────────────────────────────
function parseDoseMg(doseStr) {
  if (typeof doseStr !== 'string') return null;
  const match = doseStr.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isNaN(n) ? null : n;
}
function todayDateString() {
  return new Date().toISOString().split('T')[0];
}
function formatDose(doseMg, doseUnit) {
  if (doseMg == null || Number.isNaN(Number(doseMg))) return '';
  return `${doseMg} ${doseUnit || 'mg'}`;
}
function normalizeProfileDose(profile) {
  if (!profile) return profile;
  const doseUnit = profile.doseUnit || 'mg';
  let doseMg = profile.doseMg;
  if (doseMg == null) doseMg = parseDoseMg(profile.dose);
  let dose = profile.dose;
  if (doseMg != null) dose = formatDose(doseMg, doseUnit);
  return { ...profile, doseMg: doseMg == null ? null : Number(doseMg), doseUnit, dose };
}

// DB row (snake_case) -> app profile shape (camelCase).
function mapProfileRow(row) {
  if (!row) return null;
  return normalizeProfileDose({
    drug: row.drug || 'Other',
    doseMg: row.dose_mg == null ? null : Number(row.dose_mg),
    doseUnit: row.dose_unit || 'mg',
    frequency: row.frequency || 'weekly',
    injectionWeekday: row.injection_weekday,
    status: row.status || 'currentlyUsing',
    reminderHour: row.reminder_hour,
    reminderMinute: row.reminder_minute,
    startDate: row.start_date,
  });
}

// ── Medication profile ─────────────────────────────────────────────────────────
export async function getMedicationProfile(uid) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.from('medication_profile').select('*').maybeSingle();
    if (error) return null;
    return mapProfileRow(data);
  } catch {
    return null;
  }
}

export async function saveMedicationProfile(uid, profile) {
  const merged = normalizeProfileDose({
    drug: 'Other', dose: '', doseMg: null, doseUnit: 'mg', frequency: 'weekly',
    injectionWeekday: 0, startDate: new Date().toISOString(), status: 'currentlyUsing',
    ...profile,
  });
  if (!isSupabaseConfigured()) return merged;
  try {
    const userId = await resolveUserId(uid);
    if (!userId) return merged;
    await supabase.from('medication_profile').upsert({
      user_id: userId,
      drug: merged.drug,
      dose_mg: merged.doseMg,
      dose_unit: merged.doseUnit,
      frequency: merged.frequency,
      injection_weekday: merged.injectionWeekday,
      status: merged.status,
      reminder_hour: merged.reminderHour ?? null,
      reminder_minute: merged.reminderMinute ?? null,
      start_date: merged.startDate ? String(merged.startDate).split('T')[0] : null,
    }, { onConflict: 'user_id' });
  } catch {
    // best-effort
  }
  return merged;
}

// ── Dose logs ──────────────────────────────────────────────────────────────────
export async function logDose(uid, { date, dose } = {}) {
  if (!isSupabaseConfigured()) return [];
  try {
    const userId = await resolveUserId(uid);
    if (!userId) return await getDoseLogs(uid);
    await supabase.from('dose_logs').insert({
      user_id: userId,
      dose: dose || '',
      date: date || todayDateString(),
    });
  } catch {
    // ignore
  }
  return await getDoseLogs(uid);
}

export async function getDoseLogs(uid) {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('dose_logs').select('*').order('date', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => ({ date: r.date, dose: r.dose }));
  } catch {
    return [];
  }
}

// ── Titration timeline (dose changes) ────────────────────────────────────────────
export async function getDoseChanges(uid) {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('dose_changes').select('*').order('date', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => ({ date: r.date, doseMg: r.dose_mg == null ? null : Number(r.dose_mg) }));
  } catch {
    return [];
  }
}

export async function recordDoseChange(uid, { doseMg, date } = {}) {
  const numericDose = doseMg == null ? null : Number(doseMg);
  const entry = {
    date: date || todayDateString(),
    doseMg: numericDose == null || Number.isNaN(numericDose) ? null : numericDose,
  };
  if (!isSupabaseConfigured()) return [entry];
  try {
    const userId = await resolveUserId(uid);
    if (userId) {
      await supabase.from('dose_changes').insert({ user_id: userId, dose_mg: entry.doseMg, date: entry.date });
      // Keep the profile's current dose in sync with the latest change.
      const existing = await getMedicationProfile(uid);
      if (existing) {
        await saveMedicationProfile(uid, { ...existing, doseMg: entry.doseMg });
      }
    }
  } catch {
    // ignore
  }
  return await getDoseChanges(uid);
}

// ── Injection scheduling helpers (pure — unchanged) ──────────────────────────────
export function getNextInjectionDate(profile) {
  if (!profile || profile.injectionWeekday == null) return null;
  const targetWeekday = Number(profile.injectionWeekday);
  if (Number.isNaN(targetWeekday)) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cadenceDays = profile.frequency === 'biweekly' ? 14 : 7;
  let diff = (targetWeekday - today.getDay() + 7) % 7;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  if (cadenceDays === 14 && profile.startDate) {
    const start = new Date(profile.startDate);
    if (!Number.isNaN(start.getTime())) {
      while (next < today) next.setDate(next.getDate() + 7);
    }
  }
  return next;
}

export function getDaysUntilNextInjection(profile) {
  const next = getNextInjectionDate(profile);
  if (!next) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((next.getTime() - today.getTime()) / msPerDay);
}
