// Data service — backed by Supabase (auth + Postgres, RLS-scoped to the signed-in user).
// Exported function SIGNATURES are kept identical to the previous AsyncStorage version
// so screens don't need changes; only the INTERNALS were swapped.
//
// RLS scopes every owner table to auth.uid() automatically — we do NOT filter by
// user_id on SELECT, but we MUST set user_id on INSERT/UPSERT. Every call is wrapped
// in try/catch and returns a safe value (null / [] / the input) so the UI never crashes.
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

const today = () => new Date().toISOString().split('T')[0];

// Resolve the owning user id for INSERT/UPSERT. Prefer the live session id; fall
// back to the uid the screen passed in if the session lookup fails for any reason.
async function resolveUserId(fallbackUid) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user?.id) return data.user.id;
  } catch {
    // ignore — fall through to fallback
  }
  return fallbackUid || null;
}

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------

// Map a DB profile row (snake_case) -> the camelCase shape screens expect.
function mapProfileRow(row) {
  if (!row) return null;
  return {
    name: row.name,
    email: row.email,
    gender: row.gender,
    weight: row.weight,
    height: row.height,
    goalWeight: row.goal_weight,
    proteinTarget: row.protein_target,
    proteinPerKg: row.protein_per_kg,
    proteinTargetCustom: row.protein_target_custom,
    exerciseDaysPerWeek: row.exercise_days_per_week,
  };
}

// Map the camelCase profile shape -> a DB row (snake_case) for upsert.
function mapProfileToRow(userId, data) {
  const d = data || {};
  return {
    user_id: userId,
    name: d.name,
    email: d.email,
    gender: d.gender,
    weight: d.weight,
    height: d.height,
    goal_weight: d.goalWeight,
    protein_target: d.proteinTarget,
    protein_per_kg: d.proteinPerKg,
    protein_target_custom: d.proteinTargetCustom,
    exercise_days_per_week: d.exerciseDaysPerWeek,
  };
}

export async function getUserProfile(userId) {
  if (!isSupabaseConfigured()) return null;
  try {
    // RLS already scopes this to the signed-in user; maybeSingle() tolerates "no row yet".
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .maybeSingle();
    if (error) return null;
    return mapProfileRow(data);
  } catch {
    return null;
  }
}

export async function saveUserProfile(userId, data) {
  if (!isSupabaseConfigured()) return data;
  try {
    const uid = await resolveUserId(userId);
    if (!uid) return data;
    const { error } = await supabase
      .from('profiles')
      .upsert(mapProfileToRow(uid, data), { onConflict: 'user_id' });
    if (error) return data;
    return data;
  } catch {
    return data;
  }
}

// ---------------------------------------------------------------------------
// weight_logs
// ---------------------------------------------------------------------------

export async function getWeightLogs(userId) {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .order('date', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({ date: row.date, weight: row.weight }));
  } catch {
    return [];
  }
}

export async function saveWeightLog(userId, weight) {
  if (!isSupabaseConfigured()) return null;
  try {
    const uid = await resolveUserId(userId);
    if (!uid) return null;
    // One entry per day: upsert on (user_id, date) so re-logging today updates
    // instead of creating a duplicate chart point.
    const { error } = await supabase
      .from('weight_logs')
      .upsert({ user_id: uid, weight, date: today() }, { onConflict: 'user_id,date' });
    if (error) return null;
    return { date: today(), weight };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// meal_logs
// ---------------------------------------------------------------------------

// Map a DB meal row (snake_case) -> the camelCase meal shape screens expect.
function mapMealRow(row) {
  return {
    protein: row.protein,
    calories: row.calories,
    foodType: row.food_type,
    portionSize: row.portion_size,
    imageUri: row.image_uri,
    date: row.date,
  };
}

export async function getMealLogs(userId) {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('meal_logs')
      .select('*')
      .order('date', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map(mapMealRow);
  } catch {
    return [];
  }
}

export async function saveMealAnalysis(userId, analysisData) {
  if (!isSupabaseConfigured()) return null;
  try {
    const uid = await resolveUserId(userId);
    if (!uid) return null;
    const a = analysisData || {};
    const { error } = await supabase.from('meal_logs').insert({
      user_id: uid,
      protein: a.protein,
      calories: a.calories,
      food_type: a.foodType,
      portion_size: a.portionSize,
      image_uri: a.imageUri,
      date: today(),
    });
    if (error) return null;
    return analysisData;
  } catch {
    return null;
  }
}
