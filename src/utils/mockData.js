/**
 * mockData.js
 * Simulated data generators used while Firebase is not yet configured
 * or during development and testing.
 */

const FOOD_TYPES = ['Protein-Rich', 'Mixed', 'Carb-Heavy', 'Vegetarian'];
const PORTION_SIZES = ['Small', 'Medium', 'Large'];

const SUGGESTIONS_EN = {
  'Protein-Rich': 'Excellent choice! This meal supports muscle preservation and your protein goals.',
  Mixed: 'Good balance. Consider swapping a carb serving for extra protein next time.',
  'Carb-Heavy': 'This meal is high in carbs. Pair it with a protein source like Greek yogurt or eggs.',
  Vegetarian: 'Great plant-based choice! Add legumes or tofu to boost your protein intake.',
};

const SUGGESTIONS_TR = {
  'Protein-Rich': 'Mükemmel seçim! Bu öğün kas korumanızı ve protein hedeflerinizi destekliyor.',
  Mixed: 'İyi denge. Bir sonraki öğünde bir karbonhidrat porsiyonunu ekstra proteinle değiştirmeyi düşünün.',
  'Carb-Heavy': 'Bu öğün yüksek karbonhidrat içeriyor. Yanına Yunan yoğurdu veya yumurta gibi bir protein kaynağı ekleyin.',
  Vegetarian: 'Harika bitkisel seçim! Protein alımınızı artırmak için baklagiller veya tofu ekleyin.',
};

/**
 * Simulate AI meal photo analysis.
 * Resolves after a realistic 1.5 s delay.
 *
 * @param {string} imageUri
 * @returns {Promise<{
 *   protein: number,
 *   foodType: string,
 *   portionSize: string,
 *   sufficient: boolean,
 *   suggestion: string,
 *   suggestionTr: string
 * }>}
 */
export function analyzeMealPhoto(imageUri) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const protein = Math.floor(Math.random() * 41) + 15; // 15–55 g
      const foodType = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
      const portionSize = PORTION_SIZES[Math.floor(Math.random() * PORTION_SIZES.length)];
      const sufficient = protein >= 25;

      resolve({
        protein,
        foodType,
        portionSize,
        sufficient,
        suggestion: SUGGESTIONS_EN[foodType],
        suggestionTr: SUGGESTIONS_TR[foodType],
      });
    }, 1500);
  });
}

/**
 * Generate a mock weight history for the last 8 weeks.
 *
 * @param {number} startWeight – starting weight in kg (most recent)
 * @returns {Array<{ date: string, weight: number }>} oldest → newest
 */
export function generateMockWeightHistory(startWeight = 95) {
  const entries = [];
  const today = new Date();

  for (let i = 7; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i * 7);
    const dateStr = date.toISOString().split('T')[0];

    // Simulate gradual weight loss with small random variance
    const weekLoss = 0.3 + Math.random() * 0.7; // 0.3–1.0 kg per week
    const variance = (Math.random() - 0.5) * 0.2;
    const weight = parseFloat(
      (startWeight - (7 - i) * weekLoss + variance).toFixed(1)
    );

    entries.push({ date: dateStr, weight });
  }

  return entries;
}

/**
 * Generate mock protein intake logs for the last 7 days.
 *
 * @param {number} target – daily protein target in grams
 * @returns {Array<{ date: string, grams: number, target: number }>} oldest → newest
 */
export function generateMockProteinLogs(target = 120) {
  const logs = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Some days hit target, some don't — realistic distribution
    const hitTarget = Math.random() > 0.35;
    const grams = hitTarget
      ? Math.floor(target * (0.85 + Math.random() * 0.3)) // 85–115% of target
      : Math.floor(target * (0.4 + Math.random() * 0.35)); // 40–75% of target

    logs.push({ date: dateStr, grams, target });
  }

  return logs;
}
