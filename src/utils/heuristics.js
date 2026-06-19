/**
 * heuristics.js
 * Pure scoring functions for GLP-1 Coach fitness and nutrition analytics.
 */

/**
 * Calculate a muscle preservation score (0–100).
 *
 * @param {number} proteinIntakeGrams        – actual protein consumed today (g)
 * @param {number} proteinTargetGrams        – daily protein target (g)
 * @param {number} exerciseDaysPerWeek       – resistance/exercise sessions per week (0–7)
 * @returns {number} score 0–100
 */
export function calculateMuscleScore(
  proteinIntakeGrams,
  proteinTargetGrams,
  exerciseDaysPerWeek
) {
  if (!proteinTargetGrams || proteinTargetGrams <= 0) return 0;

  // Protein ratio contributes 70 % of the score (capped at 100 %)
  const proteinRatio = Math.min(proteinIntakeGrams / proteinTargetGrams, 1);
  const proteinScore = proteinRatio * 70;

  // Exercise contributes 30 % of the score (optimal = 4+ days/week)
  const exerciseRatio = Math.min(exerciseDaysPerWeek / 4, 1);
  const exerciseScore = exerciseRatio * 30;

  return Math.round(proteinScore + exerciseScore);
}

/**
 * Calculate the sustainability / muscle-loss risk score.
 * (Exported as calculateReboundRisk for backward compatibility with existing callers.)
 *
 * @param {number} weeklyWeightLossPercent       – % of body weight lost this week
 * @param {number} proteinRatio                  – actual / target protein (0–1+)
 * @param {number} exerciseDaysPerWeek           – 0–7
 * @param {number} consecutiveLowProteinDays     – days in a row below target
 * @returns {{ score: number, level: 'Low'|'Medium'|'High', factors: string[] }}
 */
export function calculateReboundRisk(
  weeklyWeightLossPercent,
  proteinRatio,
  exerciseDaysPerWeek,
  consecutiveLowProteinDays
) {
  let score = 0;
  const factors = [];

  // Rapid weight loss → risk
  if (weeklyWeightLossPercent > 2) {
    score += 35;
    factors.push('Rapid weekly weight loss (>2%)');
  } else if (weeklyWeightLossPercent > 1) {
    score += 15;
    factors.push('Moderate weekly weight loss (>1%)');
  }

  // Low protein → risk
  if (proteinRatio < 0.6) {
    score += 30;
    factors.push('Protein intake critically low (<60% of target)');
  } else if (proteinRatio < 0.8) {
    score += 15;
    factors.push('Protein intake below target (<80%)');
  }

  // Low exercise → risk
  if (exerciseDaysPerWeek === 0) {
    score += 20;
    factors.push('No resistance exercise this week');
  } else if (exerciseDaysPerWeek < 2) {
    score += 10;
    factors.push('Low exercise frequency (<2 days/week)');
  }

  // Consecutive low-protein days → compounding risk
  if (consecutiveLowProteinDays >= 5) {
    score += 15;
    factors.push(`${consecutiveLowProteinDays} consecutive days of low protein`);
  } else if (consecutiveLowProteinDays >= 3) {
    score += 8;
    factors.push(`${consecutiveLowProteinDays} consecutive days of low protein`);
  }

  const clampedScore = Math.min(score, 100);
  let level;
  if (clampedScore < 30) {
    level = 'Low';
  } else if (clampedScore < 65) {
    level = 'Medium';
  } else {
    level = 'High';
  }

  return { score: clampedScore, level, factors };
}


/**
 * Generate a short, action-specific wellness guide message with exact gram amounts.
 *
 * @param {'en'|'tr'} language
 * @param {number}    weeklyChange            – kg lost (positive = lost weight)
 * @param {number}    proteinRatio            – actual / target (0–1+)
 * @param {'Low'|'Medium'|'High'} riskLevel  – sustainability score level
 * @param {{ proteinTarget?: number, analyzedTodayProtein?: number }} opts
 * @returns {string}
 */
export function generateCoachMessage(language, weeklyChange, proteinRatio, riskLevel, opts = {}) {
  const isEn = language !== 'tr';
  const { proteinTarget = 120, analyzedTodayProtein = 0 } = opts;
  const remaining = Math.max(0, Math.round(proteinTarget - analyzedTodayProtein));
  const goodProtein = proteinRatio >= 0.8;
  const lostWeight = weeklyChange > 0;

  function foodSuggestion(grams, isTr) {
    if (grams <= 0) return isTr ? 'Bugün proteininiz tam!' : 'Protein target reached today!';
    if (grams <= 25) return isTr
      ? `${grams}g kalmış — 1 yumurta (7g) + 1 kase yoğurt (10g) + peynir (8g).`
      : `Only ${grams}g left — 1 egg (7g) + yogurt (10g) + cheese (8g).`;
    if (grams <= 50) return isTr
      ? `${grams}g kalmış — 150g tavuk göğsü (35g) + protein shake (25g).`
      : `${grams}g left — 150g chicken breast (35g) + protein shake (25g).`;
    if (grams <= 80) return isTr
      ? `${grams}g kalmış — 200g ton balığı (40g) + Yunan yoğurdu (20g) + 2 yumurta (14g).`
      : `${grams}g left — 200g tuna (40g) + Greek yogurt (20g) + 2 eggs (14g).`;
    return isTr
      ? `${grams}g kalmış — Her öğüne protein ekleyin: tavuk, yumurta, ton balığı veya yoğurt.`
      : `${grams}g left — Add protein to every meal: chicken, eggs, tuna, or Greek yogurt.`;
  }

  if (isEn) {
    if (goodProtein && riskLevel === 'Low') {
      return lostWeight
        ? `Great work! You've lost ${weeklyChange.toFixed(1)} kg while protecting muscle — protein at ${Math.round(proteinRatio * 100)}% of ${proteinTarget}g means your body is burning fat efficiently. Keep this up.`
        : `Protein is strong (${Math.round(proteinRatio * 100)}% of ${proteinTarget}g) and muscle risk is low. Adding 2–3 resistance sessions this week could push your protein score even higher.`;
    }
    if (goodProtein && riskLevel === 'Medium') {
      return lostWeight
        ? `Solid week — ${weeklyChange.toFixed(1)} kg lost and protein on track. To drop muscle risk from Medium to Low: add 2 resistance sessions this week. Even bodyweight squats and push-ups count.`
        : `Protein is on track. To bring your risk score down: add 2 strength workouts this week and aim for 0.5–1% body weight loss per week maximum.`;
    }
    if (goodProtein && riskLevel === 'High') {
      return `Protein is solid but rapid weight loss is raising muscle risk. Aim for a maximum of 0.5–1% body weight loss per week. Add resistance exercise — this combination can significantly reduce muscle breakdown.`;
    }
    if (!goodProtein && riskLevel === 'Low') {
      const food = foodSuggestion(remaining, false);
      return `Muscle risk is still low — but protein is at ${Math.round(proteinRatio * 100)}% of ${proteinTarget}g today. ${food} Close the gap before bed to protect muscle overnight.`;
    }
    if (!goodProtein && riskLevel === 'Medium') {
      const food = foodSuggestion(remaining, false);
      return lostWeight
        ? `You lost ${weeklyChange.toFixed(1)} kg this week but today's protein is only ${analyzedTodayProtein}g / ${proteinTarget}g. ${food} Consistent low protein increases muscle maintenance.`
        : `Protein needs attention — ${analyzedTodayProtein}g of ${proteinTarget}g today. ${food} Also: 2–3 resistance sessions this week can reduce muscle maintenance even at current protein levels.`;
    }
    const food = foodSuggestion(remaining, false);
    return `⚠️ Muscle preservation needs action now. Protein: ${analyzedTodayProtein}g / ${proteinTarget}g — ${food} Every gram matters. Add resistance exercise this week to further reduce breakdown risk.`;
  }

  // Turkish
  if (goodProtein && riskLevel === 'Low') {
    return lostWeight
      ? `Harika! ${weeklyChange.toFixed(1)} kg verdiniz ve kaslarınızı korudunuz. %${Math.round(proteinRatio * 100)} protein oranıyla vücudunuz yağ yakıyor — bu ritmi koruyun.`
      : `Protein güçlü (%${Math.round(proteinRatio * 100)} / ${proteinTarget}g) ve kas riski düşük. Haftada 2–3 direnç egzersizi ekleyerek protein skorunuzu daha da yükseltebilirsiniz.`;
  }
  if (goodProtein && riskLevel === 'Medium') {
    return lostWeight
      ? `İyi hafta — ${weeklyChange.toFixed(1)} kg ve protein yolunda. Kas riskini orta'dan düşük'e indirmek için bu hafta 2 direnç antrenmanı ekleyin. Şınav ve squat bile sayılır.`
      : `Protein iyi gidiyor. Risk skorunu düşürmek için: haftada 2 güç antrenmanı + haftalık kayıp %0,5–1'i geçmesin.`;
  }
  if (goodProtein && riskLevel === 'High') {
    return `Protein alımınız iyi ama hızlı kilo kaybı kas riskini artırıyor. Haftalık kayıp maksimum %0,5–1 vücut ağırlığını geçmesin. Direnç egzersizi ekleyin — bu kombinasyon kas yıkımını ciddi ölçüde azaltabilir.`;
  }
  if (!goodProtein && riskLevel === 'Low') {
    const food = foodSuggestion(remaining, true);
    return `Kas riski henüz düşük — iyi haber! Ama bugün protein %${Math.round(proteinRatio * 100)} / ${proteinTarget}g. ${food} Geceye kalmadan farkı kapatın, kaslar geceleri en çok korunur.`;
  }
  if (!goodProtein && riskLevel === 'Medium') {
    const food = foodSuggestion(remaining, true);
    return lostWeight
      ? `Bu hafta ${weeklyChange.toFixed(1)} kg verdiniz ama bugün protein ${analyzedTodayProtein}g / ${proteinTarget}g. ${food} Düşük protein kas kaybı riskini artırıyor.`
      : `Protein öncelik — bugün ${analyzedTodayProtein}g / ${proteinTarget}g. ${food} Haftada 2–3 direnç egzersizi mevcut protein seviyesinde bile kas kaybını azaltabilir.`;
  }
  const food = foodSuggestion(remaining, true);
  return `⚠️ Kas koruması için hemen aksiyon gerekiyor. Protein: ${analyzedTodayProtein}g / ${proteinTarget}g. ${food} Her gram önemli. Bu hafta direnç egzersizi ekleyerek yıkım riskini azaltabilirsiniz.`;
}

/**
 * Detect weight rebound for maintenance / stopped GLP-1 users.
 *
 * Looks at the weight trajectory and flags sustained INCREASE from the recent
 * minimum (the low point the user reached). Useful for users who have stopped
 * or are tapering off the medication, where regaining weight is the key risk.
 *
 * @param {Array<{date: string|number|Date, weight: number}>} weightHistory
 *        Entries ordered oldest -> newest. `weight` is in kilograms.
 * @returns {{ trend: 'up'|'down'|'flat', gainedKg: number, weeksTracked: number, alert: 'none'|'watch'|'high' }}
 */
export function detectRebound(weightHistory) {
  // Defensive defaults — never throw, always return the documented shape.
  if (!Array.isArray(weightHistory) || weightHistory.length === 0) {
    return { trend: 'flat', gainedKg: 0, weeksTracked: 0, alert: 'none' };
  }

  // Keep only valid numeric weight entries, preserving oldest -> newest order.
  const points = weightHistory.filter(
    (p) => p && typeof p.weight === 'number' && isFinite(p.weight)
  );

  if (points.length === 0) {
    return { trend: 'flat', gainedKg: 0, weeksTracked: 0, alert: 'none' };
  }

  // Weeks tracked, derived from the date span when dates are usable.
  const firstTime = new Date(points[0].date).getTime();
  const lastTime = new Date(points[points.length - 1].date).getTime();
  let weeksTracked = 0;
  if (isFinite(firstTime) && isFinite(lastTime) && lastTime >= firstTime) {
    weeksTracked = Math.round(((lastTime - firstTime) / (7 * 24 * 60 * 60 * 1000)) * 10) / 10;
  }

  // Single data point: nothing to compare against.
  if (points.length === 1) {
    return { trend: 'flat', gainedKg: 0, weeksTracked, alert: 'none' };
  }

  const latest = points[points.length - 1].weight;

  // Find the most recent minimum (the low point reached) and gain since then.
  // We track the running minimum; rebound = current weight above that minimum.
  let recentMin = points[0].weight;
  for (let i = 1; i < points.length; i++) {
    if (points[i].weight < recentMin) recentMin = points[i].weight;
  }

  const gainedKg = Math.round((latest - recentMin) * 10) / 10;

  // Determine overall trend by comparing the latest reading to the first one.
  const netChange = latest - points[0].weight;
  let trend;
  if (netChange > 0.3) trend = 'up';
  else if (netChange < -0.3) trend = 'down';
  else trend = 'flat';

  // Rebound alert is driven by sustained gain from the recent minimum.
  let alert = 'none';
  if (gainedKg >= 2.5) alert = 'high';
  else if (gainedKg >= 1) alert = 'watch';

  return { trend, gainedKg: Math.max(0, gainedKg), weeksTracked, alert };
}
