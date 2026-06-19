import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage keys (namespaced per user uid, matching firestoreService pattern) ──

const profileKey = (uid) => `medication_profile_${uid}`;
const doseLogsKey = (uid) => `dose_logs_${uid}`;
const doseChangesKey = (uid) => `dose_changes_${uid}`;

const MAX_DOSE_CHANGES = 60;

// ── Dose helpers ─────────────────────────────────────────────────────────────────

// Parse a leading number from a legacy dose string like '0.5 mg' -> 0.5.
function parseDoseMg(doseStr) {
  if (typeof doseStr !== 'string') return null;
  const match = doseStr.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isNaN(n) ? null : n;
}

// Today as YYYY-MM-DD, matching the date format used by logDose.
function todayDateString() {
  return new Date().toISOString().split('T')[0];
}

// Build a display string from numeric dose + unit, e.g. 0.5 + 'mg' -> '0.5 mg'.
function formatDose(doseMg, doseUnit) {
  if (doseMg == null || Number.isNaN(Number(doseMg))) return '';
  return `${doseMg} ${doseUnit || 'mg'}`;
}

// Normalize a profile so doseMg/doseUnit and the legacy 'dose' string are in sync.
function normalizeProfileDose(profile) {
  if (!profile) return profile;
  const doseUnit = profile.doseUnit || 'mg';
  let doseMg = profile.doseMg;
  if (doseMg == null) doseMg = parseDoseMg(profile.dose);
  let dose = profile.dose;
  if (doseMg != null) dose = formatDose(doseMg, doseUnit);
  return { ...profile, doseMg: doseMg == null ? null : Number(doseMg), doseUnit, dose };
}

// ── Medication profile ─────────────────────────────────────────────────────────

/**
 * profile shape:
 * {
 *   drug,             // 'Ozempic' | 'Wegovy' | 'Mounjaro' | 'Other'
 *   dose,             // legacy display string, e.g. '0.5 mg' (kept in sync with doseMg)
 *   doseMg,           // numeric dose, e.g. 0.5 (number | null)
 *   doseUnit,         // 'mg' (default)
 *   frequency,        // 'weekly' (default)
 *   injectionWeekday, // 0-6 (0 = Sunday)
 *   startDate,        // ISO string
 *   status,           // 'currentlyUsing' | 'recentlyStopped' | 'planningToStop'
 * }
 */
export async function getMedicationProfile(uid) {
  const raw = await AsyncStorage.getItem(profileKey(uid));
  if (!raw) return null;
  // Derive doseMg from the legacy 'dose' string when missing, and keep
  // dose/doseMg/doseUnit consistent for existing screens.
  return normalizeProfileDose(JSON.parse(raw));
}

export async function saveMedicationProfile(uid, profile) {
  const merged = normalizeProfileDose({
    drug: 'Other',
    dose: '',
    doseMg: null,
    doseUnit: 'mg',
    frequency: 'weekly',
    injectionWeekday: 0,
    startDate: new Date().toISOString(),
    status: 'currentlyUsing',
    ...profile,
  });
  await AsyncStorage.setItem(profileKey(uid), JSON.stringify(merged));
  return merged;
}

// ── Dose logs ──────────────────────────────────────────────────────────────────

export async function logDose(uid, { date, dose }) {
  const key = doseLogsKey(uid);
  const raw = await AsyncStorage.getItem(key);
  const logs = raw ? JSON.parse(raw) : [];
  logs.push({
    date: date || new Date().toISOString().split('T')[0],
    dose: dose || '',
    timestamp: new Date().toISOString(),
  });
  await AsyncStorage.setItem(key, JSON.stringify(logs.slice(-90)));
  return logs;
}

export async function getDoseLogs(uid) {
  const raw = await AsyncStorage.getItem(doseLogsKey(uid));
  return raw ? JSON.parse(raw) : [];
}

// ── Titration timeline (dose changes) ────────────────────────────────────────────

/**
 * Returns the titration timeline: [{ date, doseMg }] sorted oldest -> newest.
 */
export async function getDoseChanges(uid) {
  const raw = await AsyncStorage.getItem(doseChangesKey(uid));
  const changes = raw ? JSON.parse(raw) : [];
  return changes
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * Appends a dose change to the persisted titration timeline and updates the
 * profile's doseMg/dose. Returns the updated changes array (oldest -> newest).
 */
export async function recordDoseChange(uid, { doseMg, date } = {}) {
  const numericDose = doseMg == null ? null : Number(doseMg);
  const entry = {
    date: date || todayDateString(),
    doseMg: numericDose == null || Number.isNaN(numericDose) ? null : numericDose,
  };

  const key = doseChangesKey(uid);
  const raw = await AsyncStorage.getItem(key);
  const changes = raw ? JSON.parse(raw) : [];
  changes.push(entry);

  const sorted = changes
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-MAX_DOSE_CHANGES);

  await AsyncStorage.setItem(key, JSON.stringify(sorted));

  // Keep the medication profile's numeric + legacy dose in sync.
  const existing = await getMedicationProfile(uid);
  if (existing) {
    const doseUnit = existing.doseUnit || 'mg';
    await saveMedicationProfile(uid, {
      ...existing,
      doseMg: entry.doseMg,
      doseUnit,
      dose: entry.doseMg == null ? existing.dose : formatDose(entry.doseMg, doseUnit),
    });
  }

  return sorted;
}

// ── Injection scheduling helpers ────────────────────────────────────────────────

/**
 * Returns the next injection Date based on injectionWeekday + frequency.
 * Weekly: next occurrence of injectionWeekday (today counts if it's that day).
 * Returns null if the profile has no usable injectionWeekday.
 */
export function getNextInjectionDate(profile) {
  if (!profile || profile.injectionWeekday == null) return null;

  const targetWeekday = Number(profile.injectionWeekday);
  if (Number.isNaN(targetWeekday)) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Default to weekly cadence (the only frequency currently supported).
  const cadenceDays = profile.frequency === 'biweekly' ? 14 : 7;

  let diff = (targetWeekday - today.getDay() + 7) % 7;

  // If the target day is today but cadence is longer than a week, keep today;
  // for weekly we also keep today as the next injection day.
  const next = new Date(today);
  next.setDate(today.getDate() + diff);

  // For biweekly, ensure at least the cadence interval has not been skipped
  // relative to startDate by aligning to the nearest future cadence multiple.
  if (cadenceDays === 14 && profile.startDate) {
    const start = new Date(profile.startDate);
    if (!Number.isNaN(start.getTime())) {
      while (next < today) next.setDate(next.getDate() + 7);
    }
  }

  return next;
}

/**
 * Whole-day count from today until the next injection.
 * 0 means the injection is today. Returns null if undeterminable.
 */
export function getDaysUntilNextInjection(profile) {
  const next = getNextInjectionDate(profile);
  if (!next) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;

  return Math.round((next.getTime() - today.getTime()) / msPerDay);
}
