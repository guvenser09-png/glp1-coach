// ProgressBar — filled or segmented horizontal progress bar.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, useTheme } from '../../theme';

/**
 * ProgressBar
 * @param {number} progress  0..1 fill fraction (filled mode)
 * @param {string} color  fill color (default theme primary)
 * @param {string} trackColor  background track (default outlineVariant)
 * @param {number} height  bar height (default 8)
 * @param {number} segments  if > 0, renders a segmented bar
 * @param {number} filledSegments  number of filled segments (segmented mode)
 * @param {object} style  outer override
 * @param {object} contentStyle  fill/segment style override
 */
export default function ProgressBar({
  progress = 0,
  color,
  trackColor,
  height = 8,
  segments = 0,
  filledSegments = 0,
  style,
  contentStyle,
  ...rest
}) {
  const { colors } = useTheme();
  const fillColor = color != null ? color : colors.primary;
  const track = trackColor != null ? trackColor : colors.outlineVariant;
  if (segments > 0) {
    return (
      <View style={[styles.segRow, style]} {...rest}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                height,
                borderRadius: height / 2,
                backgroundColor: i < filledSegments ? fillColor : track,
                marginLeft: i === 0 ? 0 : 4,
              },
              contentStyle,
            ]}
          />
        ))}
      </View>
    );
  }

  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: track },
        style,
      ]}
      {...rest}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${pct * 100}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: fillColor,
          },
          contentStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: {},
  segRow: { flexDirection: 'row', width: '100%' },
  segment: { flex: 1 },
});
