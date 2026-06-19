// Ring — circular progress ring using react-native-svg.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../../theme';

/**
 * Ring
 * @param {number} progress  0..1 fill fraction
 * @param {number} size  diameter in px (default 96)
 * @param {number} strokeWidth  ring thickness (default 10)
 * @param {string} color  progress arc color (default theme primary)
 * @param {string} trackColor  background ring (default outlineVariant)
 * @param {React.ReactNode} children  centered content (e.g. label)
 * @param {string} label  shorthand centered text (used if no children)
 * @param {object} style  outer override
 * @param {object} contentStyle  centered content wrapper override
 */
export default function Ring({
  progress = 0,
  size = 96,
  strokeWidth = 10,
  color = colors.primary,
  trackColor = colors.outlineVariant,
  children,
  label,
  style,
  contentStyle,
  ...rest
}) {
  const pct = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <View style={[{ width: size, height: size }, style]} {...rest}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center, contentStyle]}>
        {children != null ? (
          children
        ) : label != null ? (
          <Text style={styles.label}>{label}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.headlineMd, color: colors.onSurface },
});
