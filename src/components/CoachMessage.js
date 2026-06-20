import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { fontFamily, useTheme } from '../theme';

/**
 * CoachMessage
 *
 * Props:
 *  message {string}  The coaching message to display
 */
export default function CoachMessage({ message = '' }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card} accessible accessibilityRole="summary" accessibilityLabel={`${t('coachTitle')}. ${message}`}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.iconEmoji}>🧠</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">{t('coachTitle')}</Text>
          <View style={styles.activeDot} accessibilityElementsHidden importantForAccessibility="no" />
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no" />

      {/* Message body */}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 22,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fontFamily.headingBold,
    color: colors.white,
    flex: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    fontFamily: fontFamily.body,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 22,
    fontWeight: '400',
  },
  });
