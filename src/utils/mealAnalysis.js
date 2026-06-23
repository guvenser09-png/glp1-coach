// Pure helpers extracted from MealAnalysisScreen (audit #12: god-component split).
// No React hooks, component state, props, or context here — keep it pure.

// ── Sustainability / rebound-risk copy helper ──
export function getReboundRiskContent(level, isTr, colors) {
  if (level === 'Low') {
    return {
      emoji: '🟢',
      label: isTr ? 'Yüksek Sürdürülebilirlik Skoru' : 'High Sustainability Score',
      desc: isTr
        ? 'Alışkanlıklarınız ilerlemenizi korumaya yardımcı oluyor. Devam edin!'
        : 'Your habits are helping sustain your progress. Keep it up!',
      color: colors.success,
      bg: colors.successBg,
    };
  }
  if (level === 'Medium') {
    return {
      emoji: '🟡',
      label: isTr ? 'Orta Sürdürülebilirlik Skoru' : 'Moderate Sustainability Score',
      desc: isTr
        ? 'Bazı alışkanlıkların dikkat gerektiriyor. Protein ve harekete odaklan.'
        : 'Some habits need attention. Focus on protein and movement.',
      color: '#D97706',
      bg: colors.warningBg,
    };
  }
  return {
    emoji: '🔴',
    label: isTr ? 'Düşük Sürdürülebilirlik Skoru' : 'Low Sustainability Score',
    desc: isTr
      ? 'Hızlı kilo kaybı + düşük protein = sürdürülebilirlik riski. Hemen protein kaynaklarına yönelin.'
      : 'Fast weight loss + low protein = sustainability risk. Add protein sources now.',
    color: colors.danger,
    bg: colors.dangerBg,
  };
}
