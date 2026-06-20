// Card — white surface, radius 20, soft theme shadow.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, shadow, spacing } from '../../theme';

/**
 * Card
 * @param {React.ReactNode} children
 * @param {number} padding  inner padding (default cardPadding 20)
 * @param {'sm'|'md'|'lg'} elevation  shadow level (default 'md')
 * @param {function} onPress  if provided, renders a Pressable
 * @param {object} style  outer override
 * @param {object} contentStyle  inner content override
 */
export default function Card({
  children,
  padding = spacing.cardPadding,
  elevation = 'md',
  onPress,
  style,
  contentStyle,
  accessibilityRole,
  accessibilityLabel,
  ...rest
}) {
  const cardStyle = [styles.card, shadow(elevation), { padding }, style];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole={accessibilityRole || 'button'}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
        {...rest}
      >
        <View style={contentStyle}>{children}</View>
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
});
