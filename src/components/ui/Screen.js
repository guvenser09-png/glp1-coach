// Screen — SafeAreaView wrapper with the GLP-1 Coach off-white background.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

/**
 * Screen
 * @param {React.ReactNode} children
 * @param {string[]} edges  safe-area edges (default ['top','left','right'])
 * @param {string} backgroundColor  override bg (default theme background)
 * @param {object} style  outer SafeAreaView style override
 * @param {object} contentStyle  inner content View style override
 */
export default function Screen({
  children,
  edges = ['top', 'left', 'right'],
  backgroundColor,
  style,
  contentStyle,
  ...rest
}) {
  const { colors } = useTheme();
  const bg = backgroundColor != null ? backgroundColor : colors.background;
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safe, { backgroundColor: bg }, style]}
      {...rest}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1 },
});
