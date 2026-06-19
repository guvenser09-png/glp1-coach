/**
 * healthkitService.js
 *
 * Defensive Apple HealthKit (Apple Watch) bridge for GLP-1 Coach.
 *
 * The native module '@kingstinct/react-native-healthkit' is only available in
 * iOS dev/production builds — NOT in Expo Go or on Android. Every call here is
 * wrapped so that if the module is missing, the platform is not iOS, or any API
 * throws, we resolve to a safe falsy value and the app keeps running.
 *
 * Public API (all async, never throw):
 *   isHealthAvailable()        -> Promise<boolean>
 *   requestHealthPermissions() -> Promise<boolean>   // READ active energy + heart rate
 *                                                    //   + body mass / body fat / lean mass,
 *                                                    //   WRITE (share) body mass
 *   getTodayActiveEnergy()     -> Promise<number|null>  // kcal burned today
 *   getLatestHeartRate()       -> Promise<number|null>  // most recent bpm
 *   getRestingHeartRate()      -> Promise<number|null>  // today's resting bpm
 *   getLatestWeightKg()        -> Promise<number|null>  // most recent body mass (kg)
 *   getLatestBodyFatPct()      -> Promise<number|null>  // body fat % (0–100)
 *   getLatestLeanMassKg()      -> Promise<number|null>  // lean body mass (kg)
 *   saveWeightKg(kg)           -> Promise<boolean>      // WRITE body-mass sample
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Expo Go cannot load Nitro/HealthKit native modules — requiring them throws
// "NitroModules are not supported in Expo Go" (a red-box error). Detect Expo Go
// and never touch the native module there, so the app runs in Expo Go for UI
// testing. HealthKit works in dev/EAS builds.
const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

// ── Lazy, defensive require of the native module ─────────────────────────────
let _hkModule = null;
let _hkResolved = false;

function getHK() {
  if (_hkResolved) return _hkModule;
  _hkResolved = true;
  if (Platform.OS !== 'ios' || IS_EXPO_GO) {
    _hkModule = null;
    return null;
  }
  try {
    // Dynamic require inside try/catch so a missing native module never crashes
    // (e.g. Expo Go / Android). eslint-disable so bundlers don't hard-fail.
    // eslint-disable-next-line global-require
    const mod = require('@kingstinct/react-native-healthkit');
    // v14 exposes its API as named exports on the module object (not on
    // `default`). Prefer the module itself; fall back to `default` for other
    // export shapes. Merge so we tolerate either layout.
    if (mod && (mod.requestAuthorization || mod.queryStatisticsForQuantity)) {
      _hkModule = mod;
    } else {
      _hkModule = mod?.default || mod || null;
    }
  } catch {
    _hkModule = null;
  }
  return _hkModule;
}

// Resolve a function off the module regardless of default/named export shape.
function pick(hk, ...names) {
  if (!hk) return null;
  for (const n of names) {
    if (typeof hk[n] === 'function') return hk[n].bind(hk);
  }
  return null;
}

// ── isHealthAvailable ────────────────────────────────────────────────────────
export async function isHealthAvailable() {
  if (Platform.OS !== 'ios') return false;
  const hk = getHK();
  if (!hk) return false;
  try {
    const fn = pick(hk, 'isHealthDataAvailable', 'isAvailable');
    if (fn) {
      const res = await fn();
      return !!res;
    }
    // Module loaded but no availability probe — assume available on iOS.
    return true;
  } catch {
    return false;
  }
}

// HealthKit units for the quantity types we read.
const UNIT_KCAL = 'kcal';
const UNIT_BPM = 'count/min';

// Identifier sets — tolerant of both string ids and enum-style maps.
function energyId(hk) {
  return (
    hk?.HKQuantityTypeIdentifier?.activeEnergyBurned ||
    'HKQuantityTypeIdentifierActiveEnergyBurned'
  );
}
function heartRateId(hk) {
  return (
    hk?.HKQuantityTypeIdentifier?.heartRate ||
    'HKQuantityTypeIdentifierHeartRate'
  );
}
function restingHeartRateId(hk) {
  return (
    hk?.HKQuantityTypeIdentifier?.restingHeartRate ||
    'HKQuantityTypeIdentifierRestingHeartRate'
  );
}
function bodyMassId(hk) {
  return (
    hk?.HKQuantityTypeIdentifier?.bodyMass ||
    'HKQuantityTypeIdentifierBodyMass'
  );
}
function bodyFatId(hk) {
  return (
    hk?.HKQuantityTypeIdentifier?.bodyFatPercentage ||
    'HKQuantityTypeIdentifierBodyFatPercentage'
  );
}
function leanMassId(hk) {
  return (
    hk?.HKQuantityTypeIdentifier?.leanBodyMass ||
    'HKQuantityTypeIdentifierLeanBodyMass'
  );
}

// HealthKit units for body composition.
const UNIT_KG = 'kg';
// Body-fat percentage is a unitless fraction in HealthKit (0–1) when read with
// the 'percent'/'%' unit it returns 0–100 on some libs. We normalise below.
const UNIT_PERCENT = '%';

// ── requestHealthPermissions ─────────────────────────────────────────────────
export async function requestHealthPermissions() {
  if (Platform.OS !== 'ios') return false;
  const hk = getHK();
  if (!hk) return false;
  try {
    const readTypes = [
      energyId(hk),
      heartRateId(hk),
      restingHeartRateId(hk),
      bodyMassId(hk),
      bodyFatId(hk),
      leanMassId(hk),
    ];
    // WRITE (share) access for body mass so saveWeightKg can persist samples.
    const shareTypes = [bodyMassId(hk)];
    const fn = pick(
      hk,
      'requestAuthorization',
      'requestPermissions',
      'authorize'
    );
    if (!fn) return false;
    // v14 (Nitro) expects a single options object { toShare, toRead }.
    // Older libs accept positional (read, write) or (read). Try in order.
    let res;
    try {
      res = await fn({ toShare: shareTypes, toRead: readTypes });
    } catch {
      try {
        res = await fn(readTypes, shareTypes);
      } catch {
        res = await fn(readTypes);
      }
    }
    // Some versions return void on success → treat non-false as granted.
    return res === undefined ? true : !!res;
  } catch {
    return false;
  }
}

// Pull a numeric value out of whatever sample shape the lib returns.
function sampleValue(sample) {
  if (sample == null) return null;
  const v =
    sample.quantity ??
    sample.value ??
    sample.quantitySample?.quantity ??
    null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfTodayISO() {
  return startOfToday().toISOString();
}

// ── getTodayActiveEnergy ─────────────────────────────────────────────────────
export async function getTodayActiveEnergy() {
  if (Platform.OS !== 'ios') return null;
  const hk = getHK();
  if (!hk) return null;
  try {
    const id = energyId(hk);
    const startDate = startOfToday();
    const endDate = new Date();
    const fromISO = startDate.toISOString();
    const toISO = endDate.toISOString();

    // Preferred: a statistics/sum query if the lib provides one.
    const sumFn = pick(
      hk,
      'queryStatisticsForQuantity',
      'getStatisticsForQuantity'
    );
    if (sumFn) {
      // v14 (Nitro): (id, ['cumulativeSum'], { unit, filter:{ startDate, endDate } }).
      // Older libs: (id, ['cumulativeSum'], fromISO, toISO).
      const attempts = [
        () =>
          sumFn(id, ['cumulativeSum'], {
            unit: UNIT_KCAL,
            filter: { startDate, endDate },
          }),
        () => sumFn(id, ['cumulativeSum'], fromISO, toISO),
      ];
      for (const run of attempts) {
        try {
          const stats = await run();
          const sum =
            stats?.sumQuantity?.quantity ??
            stats?.sumQuantity ??
            stats?.sum ??
            null;
          const n = Number(sum);
          if (Number.isFinite(n)) return Math.round(n);
        } catch {
          // try next shape / fall through to sample summation
        }
      }
    }

    // Fallback: fetch raw samples and sum them.
    const queryFn = pick(
      hk,
      'queryQuantitySamples',
      'getQuantitySamples',
      'querySamples'
    );
    if (queryFn) {
      let samples;
      try {
        // v14: options object with unit + date filter.
        samples = await queryFn(id, {
          unit: UNIT_KCAL,
          filter: { startDate, endDate },
        });
      } catch {
        try {
          samples = await queryFn(id, { from: fromISO, to: toISO });
        } catch {
          samples = await queryFn(id, fromISO, toISO);
        }
      }
      const arr = Array.isArray(samples) ? samples : samples?.samples || [];
      if (!arr.length) return null;
      const total = arr.reduce((s, smp) => s + (sampleValue(smp) || 0), 0);
      return Number.isFinite(total) ? Math.round(total) : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Generic "latest sample" reader for a heart-rate-type identifier.
async function latestSampleValue(hk, id, unit = UNIT_BPM) {
  const queryFn = pick(
    hk,
    'queryQuantitySamples',
    'getQuantitySamples',
    'querySamples'
  );
  const mostRecentFn = pick(
    hk,
    'getMostRecentQuantitySample',
    'queryMostRecentQuantitySample'
  );

  if (mostRecentFn) {
    // v14 requires a unit; older libs ignore the extra arg.
    for (const args of [[id, unit], [id]]) {
      try {
        const s = await mostRecentFn(...args);
        const v = sampleValue(s);
        if (v != null) return Math.round(v);
      } catch {
        // try next arg shape
      }
    }
  }

  if (queryFn) {
    const from = startOfTodayISO();
    const to = new Date().toISOString();
    let samples;
    try {
      // v14: options object with unit + limit (no date filter → latest overall).
      samples = await queryFn(id, { unit, limit: 1 });
    } catch {
      try {
        samples = await queryFn(id, { from, to, limit: 1, ascending: false });
      } catch {
        try {
          samples = await queryFn(id, from, to);
        } catch {
          samples = null;
        }
      }
    }
    const arr = Array.isArray(samples) ? samples : samples?.samples || [];
    if (!arr.length) return null;
    // Prefer the newest by endDate/startDate if present.
    const sorted = arr
      .slice()
      .sort(
        (a, b) =>
          new Date(b.endDate || b.startDate || 0).getTime() -
          new Date(a.endDate || a.startDate || 0).getTime()
      );
    const v = sampleValue(sorted[0]);
    return v != null ? Math.round(v) : null;
  }
  return null;
}

// ── getLatestHeartRate ───────────────────────────────────────────────────────
export async function getLatestHeartRate() {
  if (Platform.OS !== 'ios') return null;
  const hk = getHK();
  if (!hk) return null;
  try {
    return await latestSampleValue(hk, heartRateId(hk));
  } catch {
    return null;
  }
}

// ── getRestingHeartRate ──────────────────────────────────────────────────────
export async function getRestingHeartRate() {
  if (Platform.OS !== 'ios') return null;
  const hk = getHK();
  if (!hk) return null;
  try {
    const id = restingHeartRateId(hk);

    // Prefer today's resting value via a "mostRecent" statistic (v14).
    const statsFn = pick(
      hk,
      'queryStatisticsForQuantity',
      'getStatisticsForQuantity'
    );
    if (statsFn) {
      try {
        const stats = await statsFn(id, ['mostRecent'], {
          unit: UNIT_BPM,
          filter: { startDate: startOfToday(), endDate: new Date() },
        });
        const recent =
          stats?.mostRecentQuantity?.quantity ??
          stats?.mostRecentQuantity ??
          null;
        const n = Number(recent);
        if (Number.isFinite(n)) return Math.round(n);
      } catch {
        // fall through to sample-based lookup
      }
    }

    // Fallback: most recent resting HR sample regardless of date.
    return await latestSampleValue(hk, id, UNIT_BPM);
  } catch {
    return null;
  }
}

// Generic "latest sample" reader that returns the raw numeric value (no
// rounding), so callers can keep decimal precision for weight/body-fat.
async function latestRawValue(hk, id, unit) {
  const queryFn = pick(
    hk,
    'queryQuantitySamples',
    'getQuantitySamples',
    'querySamples'
  );
  const mostRecentFn = pick(
    hk,
    'getMostRecentQuantitySample',
    'queryMostRecentQuantitySample'
  );

  if (mostRecentFn) {
    for (const args of [[id, unit], [id]]) {
      try {
        const s = await mostRecentFn(...args);
        const v = sampleValue(s);
        if (v != null) return v;
      } catch {
        // try next arg shape
      }
    }
  }

  if (queryFn) {
    let samples;
    try {
      // v14: options object with unit + limit (no date filter → latest overall).
      samples = await queryFn(id, { unit, limit: 1 });
    } catch {
      try {
        samples = await queryFn(id, { limit: 1, ascending: false });
      } catch {
        samples = null;
      }
    }
    const arr = Array.isArray(samples) ? samples : samples?.samples || [];
    if (!arr.length) return null;
    const sorted = arr
      .slice()
      .sort(
        (a, b) =>
          new Date(b.endDate || b.startDate || 0).getTime() -
          new Date(a.endDate || a.startDate || 0).getTime()
      );
    const v = sampleValue(sorted[0]);
    return v != null ? v : null;
  }
  return null;
}

// ── getLatestWeightKg ────────────────────────────────────────────────────────
// Most recent body mass from Health, in kilograms.
export async function getLatestWeightKg() {
  if (Platform.OS !== 'ios') return null;
  const hk = getHK();
  if (!hk) return null;
  try {
    const v = await latestRawValue(hk, bodyMassId(hk), UNIT_KG);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// ── getLatestBodyFatPct ──────────────────────────────────────────────────────
// Body-fat percentage on a 0–100 scale, or null.
export async function getLatestBodyFatPct() {
  if (Platform.OS !== 'ios') return null;
  const hk = getHK();
  if (!hk) return null;
  try {
    const v = await latestRawValue(hk, bodyFatId(hk), UNIT_PERCENT);
    if (v == null) return null;
    let n = Number(v);
    if (!Number.isFinite(n)) return null;
    // HealthKit stores body fat as a fraction (0–1). Some libs return it as a
    // 0–1 fraction even when a '%' unit is requested → normalise to 0–100.
    if (n > 0 && n <= 1) n *= 100;
    return n;
  } catch {
    return null;
  }
}

// ── getLatestLeanMassKg ──────────────────────────────────────────────────────
// Most recent lean body mass from Health, in kilograms.
export async function getLatestLeanMassKg() {
  if (Platform.OS !== 'ios') return null;
  const hk = getHK();
  if (!hk) return null;
  try {
    const v = await latestRawValue(hk, leanMassId(hk), UNIT_KG);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// ── saveWeightKg ─────────────────────────────────────────────────────────────
// Writes a body-mass sample (kg) to Health. Returns true on success.
export async function saveWeightKg(kg) {
  if (Platform.OS !== 'ios') return false;
  const hk = getHK();
  if (!hk) return false;
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return false;
  try {
    const id = bodyMassId(hk);
    const saveFn = pick(
      hk,
      'saveQuantitySample',
      'saveQuantitySampleForType',
      'saveSample'
    );
    if (!saveFn) return false;
    const now = new Date();
    const nowISO = now.toISOString();
    // v14 (Nitro): (id, unit, value, { start, end }) or (id, { unit, value }).
    // Older libs accept positional or option-object shapes. Try in order.
    const attempts = [
      () => saveFn(id, UNIT_KG, n, { start: now, end: now }),
      () => saveFn(id, UNIT_KG, n, { startDate: now, endDate: now }),
      () =>
        saveFn(id, {
          unit: UNIT_KG,
          value: n,
          startDate: nowISO,
          endDate: nowISO,
        }),
      () => saveFn(id, UNIT_KG, n),
      () => saveFn(id, n, UNIT_KG),
    ];
    for (const run of attempts) {
      try {
        const res = await run();
        // void/undefined on success on some libs → treat non-false as saved.
        if (res !== false) return true;
      } catch {
        // try next shape
      }
    }
    return false;
  } catch {
    return false;
  }
}

export default {
  isHealthAvailable,
  requestHealthPermissions,
  getTodayActiveEnergy,
  getLatestHeartRate,
  getRestingHeartRate,
  getLatestWeightKg,
  getLatestBodyFatPct,
  getLatestLeanMassKg,
  saveWeightKg,
};
