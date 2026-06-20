// ListRow — row with leading icon, label/subtitle, and a trailing value,
// chevron, or toggle switch.
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

/**
 * ListRow
 * @param {React.ReactNode} icon  leading element (emoji Text / svg)
 * @param {string} label  primary text
 * @param {string} subtitle  optional secondary text
 * @param {string} value  optional trailing value text
 * @param {boolean} chevron  show trailing ">" chevron
 * @param {boolean} toggle  render a trailing Switch (controlled)
 * @param {boolean} toggleValue  switch value (toggle mode)
 * @param {function} onToggle  switch change handler (toggle mode)
 * @param {React.ReactNode} right  custom trailing element (overrides others)
 * @param {function} onPress  makes the row pressable
 * @param {boolean} disabled  dim the row and block interaction
 * @param {boolean} divider  show bottom hairline (default false)
 * @param {object} style  outer override
 * @param {object} contentStyle  inner row override
 */
export default function ListRow({
  icon,
  label,
  subtitle,
  value,
  chevron = false,
  toggle = false,
  toggleValue = false,
  onToggle,
  right,
  onPress,
  disabled = false,
  divider = false,
  style,
  contentStyle,
  accessibilityRole,
  accessibilityLabel,
  ...rest
}) {
  const Container = onPress ? Pressable : View;

  // Compose an accessible label from the visible texts when none is supplied.
  const composedLabel = [label, subtitle, value]
    .filter((v) => typeof v === 'string' && v.length > 0)
    .join(', ');
  const a11yLabel =
    accessibilityLabel != null
      ? accessibilityLabel
      : composedLabel || undefined;

  const renderTrailing = () => {
    if (right) return right;
    if (toggle) {
      return (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityLabel={
            typeof label === 'string' ? label : accessibilityLabel
          }
          accessibilityState={{ checked: !!toggleValue, disabled }}
          trackColor={{ false: colors.outlineVariant, true: colors.primary }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.outlineVariant}
        />
      );
    }
    return (
      <View style={styles.trailRow}>
        {value != null ? <Text style={styles.value}>{value}</Text> : null}
        {chevron ? <Text style={styles.chevron}>{'›'}</Text> : null}
      </View>
    );
  };

  return (
    <Container
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole || (onPress ? 'button' : undefined)}
      accessibilityLabel={onPress ? a11yLabel : accessibilityLabel}
      accessibilityState={onPress ? { disabled } : undefined}
      style={({ pressed } = {}) => [
        styles.row,
        divider && styles.divider,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <View style={[styles.inner, contentStyle]}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <View style={styles.textCol}>
          {label != null ? <Text style={styles.label}>{label}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {renderTrailing()}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant },
  inner: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: spacing.stackSm, minWidth: 28, alignItems: 'center' },
  textCol: { flex: 1 },
  label: { ...typography.bodyMd, color: colors.onSurface },
  subtitle: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },
  trailRow: { flexDirection: 'row', alignItems: 'center' },
  value: { ...typography.labelMd, color: colors.onSurfaceVariant },
  chevron: { ...typography.headlineMd, color: colors.outline, marginLeft: 6 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
