import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { fontFamily, useTheme } from '../theme';

const buildConfig = (colors) => ({
  Low: {
    bg: colors.successBg,
    text: colors.success,
    dot: colors.success,
    key: 'riskLow',
  },
  Medium: {
    bg: colors.warningBg,
    text: colors.warning,
    dot: colors.warning,
    key: 'riskMedium',
  },
  High: {
    bg: colors.dangerBg,
    text: colors.danger,
    dot: colors.danger,
    key: 'riskHigh',
  },
});

/**
 * RiskBadge
 *
 * Props:
 *  level  {'Low'|'Medium'|'High'}
 */
export default function RiskBadge({ level = 'Low' }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const CONFIG = useMemo(() => buildConfig(colors), [colors]);
  const config = CONFIG[level] || CONFIG.Low;

  return (
    <View
      style={[styles.badge, { backgroundColor: config.bg }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t(config.key)}
    >
      <View style={[styles.dot, { backgroundColor: config.dot }]} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[styles.text, { color: config.text }]}>{t(config.key)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fontFamily.bodySemiBold,
  },
});
