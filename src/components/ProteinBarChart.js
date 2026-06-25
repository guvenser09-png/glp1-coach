// ProteinBarChart — 7-day protein-vs-target vertical bar chart for the Daily
// screen, matching the Stitch mockup (day labels under bars, dashed target line,
// today highlighted, bars colored by ratio and animated up on load).
// Pure data in -> bars out. No new deps.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, AccessibilityInfo } from 'react-native';
import { fontFamily, typography, radii, useTheme } from '../theme';

const CHART_HEIGHT = 132; // drawable bar area height (px)

export default function ProteinBarChart({ rows = [], target = 120, isTr = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [reduceMotion, setReduceMotion] = useState(false);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduceMotion(!!v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) { grow.setValue(1); return; }
    grow.setValue(0);
    const anim = Animated.timing(grow, {
      toValue: 1, duration: 650, delay: 120, useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, rows, grow]);

  // Target line sits at full bar height (ratio == 1 -> top of drawable area).
  // Bars can exceed the line (ratio > 1) so we cap the visual fill at 1.08 to
  // keep an over-target day clearly above the dashed line without overflowing.
  return (
    <View style={styles.wrap}>
      <View style={styles.plot}>
        {/* Dashed target line at the top of the drawable area */}
        <View style={styles.targetLine}>
          <View style={styles.targetDash} />
          <Text style={styles.targetLabel}>
            {isTr ? `Hedef ${target}g` : `Target ${target}g`}
          </Text>
        </View>

        <View style={styles.bars}>
          {rows.map((day, i) => {
            const ratio = day.ratio || 0;
            const capped = Math.min(ratio, 1.08);
            const fillH = day.hasData ? Math.max(capped * CHART_HEIGHT, 4) : 4;
            const isToday = i === rows.length - 1;
            const barColor = !day.hasData
              ? colors.outlineVariant
              : ratio >= 1
              ? colors.success
              : ratio >= 0.6
              ? colors.warning
              : colors.danger;

            const animH = grow.interpolate({
              inputRange: [0, 1],
              outputRange: [4, fillH],
            });

            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <Animated.View
                    style={[
                      styles.barFill,
                      {
                        height: animH,
                        backgroundColor: barColor,
                        opacity: day.hasData ? 1 : 0.5,
                      },
                      isToday && day.hasData && styles.barToday,
                    ]}
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={
                      day.hasData
                        ? `${day.dayName}: ${day.grams}g`
                        : `${day.dayName}: ${isTr ? 'veri yok' : 'no data'}`
                    }
                  />
                </View>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                  {isToday ? (isTr ? 'Bugün' : 'Today') : day.dayName}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    wrap: { marginTop: 6 },
    plot: { position: 'relative' },
    targetLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      zIndex: 2,
      justifyContent: 'center',
    },
    targetDash: {
      borderTopWidth: 1,
      borderTopColor: colors.outline,
      borderStyle: 'dashed',
      opacity: 0.5,
    },
    targetLabel: {
      position: 'absolute',
      right: 0,
      top: -16,
      ...typography.labelSm,
      fontSize: 10,
      color: colors.onSurfaceVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 4,
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 8,
      height: CHART_HEIGHT,
    },
    barCol: { flex: 1, alignItems: 'center' },
    barTrack: {
      width: '100%',
      height: CHART_HEIGHT,
      justifyContent: 'flex-end',
      borderRadius: radii.sm,
      overflow: 'hidden',
      backgroundColor: colors.surfaceVariant,
    },
    barFill: {
      width: '100%',
      borderTopLeftRadius: radii.sm,
      borderTopRightRadius: radii.sm,
    },
    barToday: {
      borderTopLeftRadius: radii.sm,
      borderTopRightRadius: radii.sm,
    },
    dayLabel: {
      marginTop: 6,
      ...typography.labelSm,
      fontSize: 10,
      color: colors.onSurfaceVariant,
    },
    dayLabelToday: {
      color: colors.primary,
      fontFamily: fontFamily.bodyBold,
      fontWeight: '700',
    },
  });
