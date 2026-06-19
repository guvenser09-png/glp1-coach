import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage keys (namespaced per user uid, matching medicationService pattern) ──

const bodyMeasurementsKey = (uid) => `body_measurements_${uid}`;
const symptomLogsKey = (uid) => `symptom_logs_${uid}`;

const MAX_MEASUREMENTS = 60;
const MAX_SYMPTOMS = 90;

// Body measurement fields (all in cm), all optional per entry.
const MEASUREMENT_FIELDS = ['waist', 'arm', 'neck', 'chest', 'hip'];

// Allowed symptom / side-effect types.
const SYMPTOM_TYPES = ['nausea', 'fatigue', 'constipation', 'headache', 'appetite', 'other'];

// ── Helpers ──────────────────────────────────────────────────────────────────────

// Today as YYYY-MM-DD, matching the date format used by medicationService.
function todayDateString() {
  return new Date().toISOString().split('T')[0];
}

// Parse a numeric cm value; returns null for empty / non-numeric input.
function parseCm(value) {
  if (value == null || value === '') return null;
  // Accept comma decimals (e.g. '92,5') as well as dots.
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  if (normalized === '') return null;
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
}

// Clamp severity to the 1-3 range (mild/moderate/severe); default to 1.
function parseSeverity(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 1;
  return Math.min(3, Math.max(1, Math.round(n)));
}

// ── Body measurements ──────────────────────────────────────────────────────────

/**
 * Appends a body-measurement entry. Any subset of cm fields may be provided;
 * empty / non-numeric fields are ignored. Keeps the last ~60 entries.
 *
 * entry shape: { date, waist?, arm?, neck?, chest?, hip? } (cm values numeric)
 *
 * Returns the persisted entries array sorted oldest -> newest.
 */
export async function saveMeasurement(uid, { date, waist, arm, neck, chest, hip } = {}) {
  const entry = { date: date || todayDateString() };

  const incoming = { waist, arm, neck, chest, hip };
  for (const field of MEASUREMENT_FIELDS) {
    const cm = parseCm(incoming[field]);
    if (cm != null) entry[field] = cm;
  }

  const key = bodyMeasurementsKey(uid);
  const raw = await AsyncStorage.getItem(key);
  const entries = raw ? JSON.parse(raw) : [];
  entries.push(entry);

  const sorted = entries
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-MAX_MEASUREMENTS);

  await AsyncStorage.setItem(key, JSON.stringify(sorted));
  return sorted;
}

/**
 * Returns all body-measurement entries sorted oldest -> newest.
 * Each entry: { date, waist?, arm?, neck?, chest?, hip? }.
 */
export async function getMeasurements(uid) {
  const raw = await AsyncStorage.getItem(bodyMeasurementsKey(uid));
  const entries = raw ? JSON.parse(raw) : [];
  return entries
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// ── Symptoms / side effects ──────────────────────────────────────────────────────

/**
 * Logs a symptom / side-effect entry.
 *
 * entry shape:
 * {
 *   date,      // YYYY-MM-DD (defaults to today)
 *   type,      // 'nausea' | 'fatigue' | 'constipation' | 'headache' | 'appetite' | 'other'
 *   severity,  // 1 (mild) | 2 (moderate) | 3 (severe)
 * }
 *
 * Returns the persisted entries array sorted newest -> oldest.
 */
export async function logSymptom(uid, { date, type, severity } = {}) {
  const entry = {
    date: date || todayDateString(),
    type: SYMPTOM_TYPES.includes(type) ? type : 'other',
    severity: parseSeverity(severity),
    timestamp: new Date().toISOString(),
  };

  const key = symptomLogsKey(uid);
  const raw = await AsyncStorage.getItem(key);
  const entries = raw ? JSON.parse(raw) : [];
  entries.push(entry);

  // Persist oldest -> newest, capped, then return newest-first.
  const sorted = entries
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-MAX_SYMPTOMS);

  await AsyncStorage.setItem(key, JSON.stringify(sorted));
  return sorted.slice().reverse();
}

/**
 * Returns all symptom entries sorted newest -> oldest.
 * Each entry: { date, type, severity }.
 */
export async function getSymptoms(uid) {
  const raw = await AsyncStorage.getItem(symptomLogsKey(uid));
  const entries = raw ? JSON.parse(raw) : [];
  return entries
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
