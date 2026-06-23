// muscle.js — single source of truth for muscle-protection messaging.
//
// Background (audit #10): earlier code turned a protein-adequacy ratio into
// scary, precise-looking figures — "Muscle Risk 40–50%", "you lost X kg of
// muscle". Those numbers are NOT clinically valid: the app cannot measure body
// composition, so any fat-vs-muscle split or kg-of-muscle-lost claim is
// fabricated. This module replaces them with a QUALITATIVE assessment built
// only from data we actually have (protein intake vs target, optionally
// resistance-training frequency) and surfaces a clear "not a clinical
// measurement" caveat the UI must show.
//
// The underlying protein-adequacy computation mirrors the proven weighting in
// heuristics.calculateMuscleScore (protein 70% / exercise 30%) so behaviour is
// consistent across the app — we just stop translating it into invented
// percentages.

// Direction/trend buckets, qualitative only. No percentages, no kg.
//   improving  – protein intake meeting/exceeding target (muscle well supported)
//   adequate   – protein intake reasonable but with room to improve
//   at-risk    – protein intake low; muscle protection may be compromised
export const MUSCLE_TREND = {
  IMPROVING: 'improving',
  ADEQUATE: 'adequate',
  AT_RISK: 'at-risk',
};

const clamp01 = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/**
 * Compute a protein-adequacy ratio (0–1, capped).
 * Mirrors the protein side of heuristics.calculateMuscleScore.
 */
function proteinAdequacy(proteinGrams, targetGrams) {
  const g = Number(proteinGrams);
  const target = Number(targetGrams);
  if (!Number.isFinite(target) || target <= 0) return 0;
  if (!Number.isFinite(g) || g <= 0) return 0;
  return clamp01(g / target);
}

// Bilingual qualitative copy per trend. No fabricated figures anywhere.
const TREND_COPY = {
  [MUSCLE_TREND.IMPROVING]: {
    emoji: '💪',
    label: { tr: 'Kasların İyi Korunuyor', en: 'Muscle Well Protected' },
    desc: {
      tr: 'Protein alımın hedefini karşılıyor — bu, kilo verirken kas korumasını destekler.',
      en: 'Your protein intake is meeting your target — this supports muscle protection while losing weight.',
    },
    toneKey: 'success',
  },
  [MUSCLE_TREND.ADEQUATE]: {
    emoji: '✅',
    label: { tr: 'Yeterli, Geliştirilebilir', en: 'Adequate, Could Improve' },
    desc: {
      tr: 'Protein alımın fena değil; hedefe biraz daha yaklaşmak kas korumasını güçlendirir.',
      en: 'Your protein intake is reasonable; getting closer to your target would strengthen muscle protection.',
    },
    toneKey: 'primary',
  },
  [MUSCLE_TREND.AT_RISK]: {
    emoji: '⚠️',
    label: { tr: 'Protein Düşük', en: 'Protein Running Low' },
    desc: {
      tr: 'Protein alımın hedefin altında. Kas korumasına yardımcı olmak için bugün proteine öncelik ver.',
      en: 'Your protein intake is below target. Prioritize protein today to help protect muscle.',
    },
    toneKey: 'warning',
  },
};

// Bilingual "not a clinical measurement" caveat the UI should always render
// alongside any muscle-protection messaging.
export const NOT_CLINICAL = {
  tr: 'Klinik ölçüm değildir — yalnızca protein alımına dayalı genel bir eğilimdir, vücut kompozisyonu ölçmez.',
  en: 'Not a clinical measurement — this is a general trend based on protein intake only and does not measure body composition.',
};

export function notClinicalNote(language) {
  return language === 'tr' ? NOT_CLINICAL.tr : NOT_CLINICAL.en;
}

/**
 * assessMuscleProtection — qualitative muscle-protection assessment.
 *
 * Returns a direction/trend plus short bilingual copy. Deliberately contains
 * NO percentage and NO kg-of-muscle-lost figure (audit #10).
 *
 * @param {object}  params
 * @param {number}  params.proteinGrams         actual protein consumed (g)
 * @param {number}  params.targetGrams          daily protein target (g)
 * @param {number} [params.exerciseDaysPerWeek] resistance sessions/week (0–7), optional
 * @param {number} [params.adequacyRatio]       optional precomputed protein ratio
 *                                              (e.g. a 7-day average); overrides
 *                                              proteinGrams/targetGrams when given
 * @returns {{
 *   trend: 'improving'|'adequate'|'at-risk',
 *   emoji: string,
 *   toneKey: 'success'|'primary'|'warning',
 *   adequacy: number,                // 0–1, for internal/progress use only
 *   isClinical: false,               // always false — never a clinical measure
 *   label: (language:string)=>string,
 *   description: (language:string)=>string,
 *   notClinical: (language:string)=>string,
 * }}
 */
export function assessMuscleProtection({
  proteinGrams,
  targetGrams,
  exerciseDaysPerWeek,
  adequacyRatio,
} = {}) {
  const adequacy = Number.isFinite(adequacyRatio)
    ? clamp01(adequacyRatio)
    : proteinAdequacy(proteinGrams, targetGrams);

  // Resistance training nudges an otherwise-borderline result upward, mirroring
  // the exercise weighting in calculateMuscleScore — but only qualitatively.
  const exercises = Number(exerciseDaysPerWeek);
  const trainsRegularly = Number.isFinite(exercises) && exercises >= 2;

  let trend;
  if (adequacy >= 0.85) {
    trend = MUSCLE_TREND.IMPROVING;
  } else if (adequacy >= 0.6 || (adequacy >= 0.5 && trainsRegularly)) {
    trend = MUSCLE_TREND.ADEQUATE;
  } else {
    trend = MUSCLE_TREND.AT_RISK;
  }

  const copy = TREND_COPY[trend];
  return {
    trend,
    emoji: copy.emoji,
    toneKey: copy.toneKey,
    adequacy,
    isClinical: false,
    label: (language) => (language === 'tr' ? copy.label.tr : copy.label.en),
    description: (language) => (language === 'tr' ? copy.desc.tr : copy.desc.en),
    notClinical: (language) => notClinicalNote(language),
  };
}
