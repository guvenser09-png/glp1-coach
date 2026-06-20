// Badge — small color-coded pill label.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, semantic, typography } from '../../theme';

/**
 * Badge
 * @param {string} label  badge text (or pass children)
 * @param {'success'|'warning'|'danger'|'info'|'neutral'} tone  color group (default 'info')
 * @param {React.ReactNode} icon  optional leading emoji/icon
 * @param {object} style  outer override
 * @param {object} contentStyle  text style override
 */
export default function Badge({
  label,
  tone = 'info',
  icon,
  children,
  style,
  contentStyle,
  accessibilityLabel,
  accessibilityRole,
  ...rest
}) {
  const palette =
    tone === 'neutral'
      ? { fg: colors.onSurfaceVariant, bg: colors.outlineVariant }
      : semantic[tone] || semantic.info;

  const a11yLabel =
    accessibilityLabel != null
      ? accessibilityLabel
      : typeof label === 'string'
      ? label
      : undefined;

  return (
    <View
      accessible={a11yLabel != null ? true : undefined}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={a11yLabel}
      style={[styles.badge, { backgroundColor: palette.bg }, style]}
      {...rest}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      {label != null ? (
        <Text style={[styles.text, { color: palette.fg }, contentStyle]}>
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  icon: { marginRight: 4 },
  text: { ...typography.labelSm },
});
