import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily } from '../theme';

const SIZE = 80;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * ScoreCard
 *
 * Props:
 *  score  {number}  0–100
 *  label  {string}  displayed below the circle
 *  color  {string}  accent colour for the progress arc and text
 *  icon   {string}  emoji icon shown inside the circle
 */
export default function ScoreCard({ score = 0, label = '', color = colors.primary, icon = '💪' }) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // We build the circular progress using border trick (pure View, no SVG needed)
  const rotation = (clampedScore / 100) * 360;

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ? `${label}: ${clampedScore} / 100` : `${clampedScore} / 100`}
    >
      {/* Circular progress indicator */}
      <View style={styles.circleContainer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {/* Background track */}
        <View style={[styles.track, { borderColor: colors.outlineVariant }]} />

        {/* Progress overlay — two half-circles technique */}
        <View style={styles.progressWrapper}>
          {/* Left half — always filled when > 50 % */}
          <View style={[styles.halfCircleContainer, styles.leftContainer]}>
            <View
              style={[
                styles.halfCircle,
                styles.leftHalfCircle,
                {
                  borderColor: clampedScore > 0 ? color : 'transparent',
                  transform: [
                    {
                      rotate:
                        clampedScore <= 50
                          ? `${(clampedScore / 50) * 180 - 180}deg`
                          : '0deg',
                    },
                  ],
                },
              ]}
            />
          </View>

          {/* Right half — fills first */}
          <View style={[styles.halfCircleContainer, styles.rightContainer]}>
            <View
              style={[
                styles.halfCircle,
                styles.rightHalfCircle,
                {
                  borderColor: clampedScore > 50 ? color : 'transparent',
                  transform: [
                    {
                      rotate:
                        clampedScore > 50
                          ? `${((clampedScore - 50) / 50) * 180}deg`
                          : '0deg',
                    },
                  ],
                },
              ]}
            />
          </View>
        </View>

        {/* Inner content */}
        <View style={styles.innerCircle}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.scoreText, { color }]}>{clampedScore}</Text>
        </View>
      </View>

      {/* Label */}
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  circleContainer: {
    width: SIZE,
    height: SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  track: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: STROKE,
  },
  progressWrapper: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
  halfCircleContainer: {
    position: 'absolute',
    width: SIZE / 2,
    height: SIZE,
    overflow: 'hidden',
    top: 0,
  },
  leftContainer: {
    left: 0,
  },
  rightContainer: {
    right: 0,
  },
  halfCircle: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: STROKE,
  },
  leftHalfCircle: {
    right: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transformOrigin: `${SIZE / 2}px ${SIZE / 2}px`,
  },
  rightHalfCircle: {
    left: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
    transformOrigin: `${SIZE / 2}px ${SIZE / 2}px`,
  },
  innerCircle: {
    width: SIZE - STROKE * 2 - 4,
    height: SIZE - STROKE * 2 - 4,
    borderRadius: (SIZE - STROKE * 2 - 4) / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    marginBottom: 1,
    fontFamily: fontFamily.body,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
    fontFamily: fontFamily.headingBold,
  },
  label: {
    fontSize: 12,
    color: colors.outline,
    textAlign: 'center',
    fontWeight: '500',
    fontFamily: fontFamily.bodyMedium,
  },
});
