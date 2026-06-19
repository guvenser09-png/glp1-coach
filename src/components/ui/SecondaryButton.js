// SecondaryButton — outlined / tonal indigo button.
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, typography } from '../../theme';

/**
 * SecondaryButton
 * @param {string} title  button label (or pass children)
 * @param {function} onPress
 * @param {boolean} disabled
 * @param {boolean} loading
 * @param {React.ReactNode} icon  optional leading element
 * @param {'outline'|'tonal'} variant  outline (border) or tonal (soft indigo bg). default 'outline'
 * @param {boolean} fullWidth  default true
 * @param {object} style  outer override
 * @param {object} contentStyle  label style override
 */
export default function SecondaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = 'outline',
  fullWidth = true,
  children,
  style,
  contentStyle,
  ...rest
}) {
  const isDisabled = disabled || loading;
  const isTonal = variant === 'tonal';
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        isTonal ? styles.tonal : styles.outline,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          {title != null ? (
            <Text style={[styles.label, contentStyle]}>{title}</Text>
          ) : (
            children
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  outline: {
    backgroundColor: colors.transparent,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  tonal: { backgroundColor: colors.infoBg },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: 8 },
  label: {
    ...typography.labelMd,
    fontSize: 16,
    color: colors.primary,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
