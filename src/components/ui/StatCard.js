// StatCard — white card showing a big stat value with label + optional delta.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, semantic, typography } from '../../theme';
import Card from './Card';

/**
 * StatCard
 * @param {string|number} value  the big stat (e.g. '82.4')
 * @param {string} unit  optional small unit suffix (e.g. 'kg')
 * @param {string} label  caption under/over the value
 * @param {React.ReactNode} icon  optional leading emoji/icon
 * @param {string} delta  optional change text (e.g. '-1.2')
 * @param {'success'|'warning'|'danger'|'info'} deltaTone  delta color group (default 'success')
 * @param {function} onPress  makes the card pressable
 * @param {object} style  outer override
 * @param {object} contentStyle  inner content override
 */
export default function StatCard({
  value,
  unit,
  label,
  icon,
  delta,
  deltaTone = 'success',
  onPress,
  style,
  contentStyle,
  ...rest
}) {
  const tone = semantic[deltaTone] || semantic.success;
  return (
    <Card onPress={onPress} style={style} contentStyle={contentStyle} {...rest}>
      <View style={styles.headerRow}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {delta ? (
        <View style={[styles.deltaPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.deltaText, { color: tone.fg }]}>{delta}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { ...typography.labelMd, color: colors.onSurfaceVariant },
  icon: { marginLeft: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  value: { ...typography.displayStat, color: colors.onSurface, fontSize: 36, lineHeight: 42 },
  unit: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginLeft: 4,
    marginBottom: 6,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  deltaText: { ...typography.labelSm },
});
