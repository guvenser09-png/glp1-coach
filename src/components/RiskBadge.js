import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

const CONFIG = {
  Low: {
    bg: '#D1FAE5',
    text: '#065F46',
    dot: '#10B981',
    key: 'riskLow',
  },
  Medium: {
    bg: '#FEF3C7',
    text: '#92400E',
    dot: '#F59E0B',
    key: 'riskMedium',
  },
  High: {
    bg: '#FEE2E2',
    text: '#991B1B',
    dot: '#EF4444',
    key: 'riskHigh',
  },
};

/**
 * RiskBadge
 *
 * Props:
 *  level  {'Low'|'Medium'|'High'}
 */
export default function RiskBadge({ level = 'Low' }) {
  const { t } = useLanguage();
  const config = CONFIG[level] || CONFIG.Low;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
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
  },
});
