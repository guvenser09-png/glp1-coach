// SectionTitle — section heading with optional subtitle and trailing action.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

/**
 * SectionTitle
 * @param {string} title  heading text (or pass children)
 * @param {string} subtitle  optional secondary line
 * @param {string} actionLabel  optional trailing link text
 * @param {function} onActionPress  handler for trailing link
 * @param {object} style  outer override
 * @param {object} contentStyle  title text style override
 */
export default function SectionTitle({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  children,
  style,
  contentStyle,
  ...rest
}) {
  return (
    <View style={[styles.wrap, style]} {...rest}>
      <View style={styles.textCol}>
        {title != null ? (
          <Text style={[styles.title, contentStyle]}>{title}</Text>
        ) : (
          children
        )}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable onPress={onActionPress} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.stackSm,
  },
  textCol: { flexShrink: 1, paddingRight: spacing.stackSm },
  title: { ...typography.headlineMd, color: colors.onSurface },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  action: { ...typography.labelMd, color: colors.primary },
});
