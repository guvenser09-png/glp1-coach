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
    // (audit #5) defense-in-depth: filter by user_id explicitly, not RLS alone.
    const uid = await resolveUserId(userId);
    if (!uid) return null;
    // maybeSingle() tolerates "no row yet".
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) return null;
    return mapProfileRow(data);
  } catch {
    return null;
  }
}

export async function saveUserProfile(userId, data) {
  if (!isSupabaseConfigured()) return data;
  const uid = await resolveUserId(userId);
  if (!uid) return data;
  const { error } = await supabase
    .from('profiles')
    .upsert(mapProfileToRow(uid, data), { onConflict: 'user_id' });
  // (audit #7) surface write failures — never let a failed save look successful.
  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// weight_logs
// ---------------------------------------------------------------------------

export async function getWeightLogs(userId) {
  if (!isSupabaseConfigured()) return [];
  try {
    // (audit #5) defense-in-depth: filter by user_id explicitly, not RLS alone.
    const uid = await resolveUserId(userId);
    if (!uid) return [];
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({ date: row.date, weight: row.weight }));
  } catch {
    return [];
  }
}

export async function saveWeightLog(userId, weight) {
  if (!isSupabaseConfigured()) return null;
  const uid = await resolveUserId(userId);
  if (!uid) return null;
  // One entry per day: upsert on (user_id, date) so re-logging today updates
  // instead of creating a duplicate chart point.
  const { error } = await supabase
    .from('weight_logs')
    .upsert({ user_id: uid, weight, date: today() }, { onConflict: 'user_id,date' });
  // (audit #7) surface write failures
  if (error) throw new Error(error.message);
  return { date: today(), weight };
}

// ---------------------------------------------------------------------------
// meal_logs
// ---------------------------------------------------------------------------

// Map a DB meal row (snake_case) -> the camelCase meal shape screens expect.
function mapMealRow(row) {
  return {
    id: row.id,
    protein: row.protein,
    calories: row.calories,
    foodType: row.food_type,
    portionSize: row.portion_size,
    mealType: row.meal_type, // breakfast | lunch | dinner | snack (optional)
    imageUri: row.image_uri,
    date: row.date,
  };
}

export async function getMealLogs(userId) {
  if (!isSupabaseConfigured()) return [];
  try {
    // (audit #5) defense-in-depth: filter by user_id explicitly, not RLS alone.
    const uid = await resolveUserId(userId);
    if (!uid) return [];
    const { data, error } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: true })
      .order('id', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map(mapMealRow);
  } catch {
    return [];
  }
}

export async function saveMealAnalysis(userId, analysisData) {
  if (!isSupabaseConfigured()) return null;
  const uid = await resolveUserId(userId);
  if (!uid) return null;
  const a = analysisData || {};
  const { error } = await supabase.from('meal_logs').insert({
    user_id: uid,
    protein: a.protein,
    calories: a.calories,
    food_type: a.foodType,
    portion_size: a.portionSize,
    meal_type: a.mealType,
    image_uri: a.imageUri,
    date: today(),
  });
  // (audit #7) surface write failures
  if (error) throw new Error(error.message);
  return analysisData;
}

// ---------------------------------------------------------------------------
// Today's meals — single source of truth for the meal log UI.
// RLS scopes every query to the signed-in user; we filter by date = today and
// return oldest->newest so the list reads top-to-bottom chronologically.
// All calls are guarded and return safe values ([] / null) so a network hiccup
// never crashes the screen.
// ---------------------------------------------------------------------------

// getTodayMeals(uid): today's meals only, oldest->newest, mapped to camelCase.
export async function getTodayMeals(userId) {
  if (!isSupabaseConfigured()) return [];
  try {
    // (audit #5) defense-in-depth: filter by user_id explicitly, not RLS alone.
    const uid = await resolveUserId(userId);
    if (!uid) return [];
    const { data, error } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', uid)
      .eq('date', today())
      .order('id', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map(mapMealRow);
  } catch {
    return [];
  }
}

// addMeal(uid, meal): insert one meal (camelCase in) and return the created row
// (camelCase out, including the new id). Returns null on error.
export async function addMeal(userId, meal) {
  if (!isSupabaseConfigured()) return null;
  const uid = await resolveUserId(userId);
  if (!uid) return null;
  const m = meal || {};
  const { data, error } = await supabase
    .from('meal_logs')
    .insert({
      user_id: uid,
      protein: m.protein,
      calories: m.calories,
      food_type: m.foodType,
      portion_size: m.portionSize,
      meal_type: m.mealType,
      image_uri: m.imageUri,
      date: today(),
    })
    .select()
    .single();
  // (audit #7) surface write failures
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapMealRow(data);
}

// deleteMeal(uid, id): remove one meal by id. RLS ensures only the owner's row
// can be deleted. Resolves silently on error.
export async function deleteMeal(userId, id) {
  if (!isSupabaseConfigured() || id == null) return;
  // (audit #5) defense-in-depth: scope the delete to the owner explicitly.
  const uid = await resolveUserId(userId);
  if (!uid) return;
  const { error } = await supabase
    .from('meal_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);
  // (audit #7) surface write failures
  if (error) throw new Error(error.message);
}

// updateMeal(uid, id, fields): patch one meal by id. Accepts camelCase fields
// and maps to snake_case columns (only known columns are written).
export async function updateMeal(userId, id, fields) {
  if (!isSupabaseConfigured() || id == null) return;
  const f = fields || {};
  const patch = {};
  if (f.protein !== undefined) patch.protein = f.protein;
  if (f.calories !== undefined) patch.calories = f.calories;
  if (f.foodType !== undefined) patch.food_type = f.foodType;
  if (f.portionSize !== undefined) patch.portion_size = f.portionSize;
  if (f.mealType !== undefined) patch.meal_type = f.mealType;
  if (f.imageUri !== undefined) patch.image_uri = f.imageUri;
  if (Object.keys(patch).length === 0) return;
  // (audit #5) defense-in-depth: scope the update to the owner explicitly.
  const uid = await resolveUserId(userId);
  if (!uid) return;
  const { error } = await supabase
    .from('meal_logs')
    .update(patch)
    .eq('id', id)
    .eq('user_id', uid);
  // (audit #7) surface write failures
  if (error) throw new Error(error.message);
}
