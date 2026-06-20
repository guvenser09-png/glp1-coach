// GradientHero — indigo gradient hero banner (135deg #4F46E5 -> #6366F1).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radii, spacing, useTheme } from '../../theme';

/**
 * GradientHero
 * @param {React.ReactNode} children
 * @param {number} padding  inner padding (default cardPadding 20)
 * @param {number} borderRadius  (default radii.card 20)
 * @param {boolean} shadowed  apply soft shadow (default true)
 * @param {object} style  outer override
 * @param {object} contentStyle  inner content override
 */
export default function GradientHero({
  children,
  padding = spacing.cardPadding,
  borderRadius = radii.card,
  shadowed = true,
  style,
  contentStyle,
  ...rest
}) {
  const { colors, shadow } = useTheme();
  return (
    <View style={[shadowed && shadow('md'), { borderRadius }, style]} {...rest}>
      <LinearGradient
        // 135deg diagonal: top-left -> bottom-right
        colors={[colors.gradient.start, colors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { padding, borderRadius }]}
      >
        <View style={contentStyle}>{children}</View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
  },
});
