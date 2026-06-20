// Chip — pill-shaped, selectable filter/tag chip.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '../../theme';
import { tap as hapticTap } from '../../utils/haptics';

/**
 * Chip
 * @param {string} label  chip text (or pass children)
 * @param {boolean} selected  selected (filled indigo) state
 * @param {function} onPress
 * @param {React.ReactNode} icon  optional leading element (emoji Text)
 * @param {object} style  outer override
 * @param {object} contentStyle  label style override
 */
export default function Chip({
  label,
  selected = false,
  onPress,
  icon,
  children,
  style,
  contentStyle,
  accessibilityRole,
  accessibilityLabel,
  ...rest
}) {
  const Container = onPress ? Pressable : View;
  // Light haptic on tap, then defer to the caller's handler (args preserved).
  const handlePress = onPress
    ? (...args) => {
        hapticTap();
        onPress(...args);
      }
    : undefined;
  const a11yLabel =
    accessibilityLabel != null
      ? accessibilityLabel
      : typeof label === 'string'
      ? label
      : undefined;
  return (
    <Container
      onPress={handlePress}
      accessibilityRole={accessibilityRole || (onPress ? 'button' : undefined)}
      accessibilityLabel={a11yLabel}
      accessibilityState={onPress ? { selected } : undefined}
      style={({ pressed } = {}) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      {label != null ? (
        <Text
          style={[
            styles.label,
            selected ? styles.labelSelected : styles.labelUnselected,
            contentStyle,
          ]}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  unselected: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  icon: { marginRight: 6 },
  label: { ...typography.labelMd },
  labelUnselected: { color: colors.onSurfaceVariant },
  labelSelected: { color: colors.onPrimary },
  pressed: { opacity: 0.85 },
});
