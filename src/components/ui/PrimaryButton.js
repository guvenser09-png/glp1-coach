// PrimaryButton — filled indigo rounded button.
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { radii, typography, useTheme } from '../../theme';
import { tap as hapticTap } from '../../utils/haptics';

/**
 * PrimaryButton
 * @param {string} title  button label (or pass children)
 * @param {function} onPress
 * @param {boolean} disabled
 * @param {boolean} loading  shows spinner, disables press
 * @param {React.ReactNode} icon  optional leading element (e.g. emoji Text)
 * @param {boolean} fullWidth  stretch to container width (default true)
 * @param {object} style  outer override
 * @param {object} contentStyle  label/text style override
 */
export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  children,
  style,
  contentStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  ...rest
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDisabled = disabled || loading;
  // Auto-derive an accessible label from the title when caller doesn't supply one.
  const a11yLabel =
    accessibilityLabel != null
      ? accessibilityLabel
      : typeof title === 'string'
      ? title
      : undefined;
  // Light haptic on tap, then defer to the caller's handler (args preserved).
  const handlePress = (...args) => {
    hapticTap();
    if (onPress) onPress(...args);
  };
  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
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

const makeStyles = (colors) =>
  StyleSheet.create({
    btn: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    fullWidth: { alignSelf: 'stretch' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: { marginRight: 8 },
    label: {
      ...typography.labelMd,
      fontSize: 16,
      color: colors.onPrimary,
    },
    pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    disabled: { opacity: 0.5 },
  });
