import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useGamification, MISSIONS, LEVELS, getCurrentLevel, getNextLevel, getXPProgress, calcHealthScore } from '../context/GamificationContext';
import { useLanguage } from '../context/LanguageContext';
import { fontFamily, useTheme } from '../theme';

export default function DailyQuestsCard({ proteinPct = 0, mealCount = 0, loggedWorkout = false, loggedWeight = false }) {
  const { completedMissions, dailyXP, totalXP, streak, xpFlash } = useGamification();
  const { language } = useLanguage();
  const isTr = language === 'tr';
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const level = getCurrentLevel(totalXP);
  const nextLevel = getNextLevel(totalXP);
  const { pct, xpToNext } = getXPProgress(totalXP);
  const healthScore = calcHealthScore({ proteinPct, loggedMeals: mealCount, loggedWorkout, loggedWeight });

  const xpBarAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(xpBarAnim, { toValue: pct / 100, duration: 800, useNativeDriver: false }).start();
  }, [pct]);

  useEffect(() => {
    if (xpFlash) {
      flashAnim.setValue(0);
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [xpFlash]);

  const completedCount = MISSIONS.filter(m => completedMissions.includes(m.id)).length;
  const allDone = completedCount === MISSIONS.length;

  const healthColor = healthScore >= 80 ? colors.success : healthScore >= 50 ? colors.warning : colors.danger;

  return (
    <View style={styles.card}>

      {/* XP Flash notification */}
      {xpFlash && (
        <Animated.View style={[styles.xpFlash, { opacity: flashAnim, transform: [{ translateY: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
          <Text style={styles.xpFlashText}>+{xpFlash.xp} XP ⚡</Text>
        </Animated.View>
      )}

      {/* Level + Streak row */}
      <View style={styles.topRow}>
        <View
          style={styles.levelBadge}
          accessible
          accessibilityRole="text"
          accessibilityLabel={isTr ? `${level.tr}, Seviye ${level.level}` : `${level.en}, Level ${level.level}`}
        >
          <Text style={styles.levelEmoji}>{level.emoji}</Text>
          <View>
            <Text style={styles.levelName}>{isTr ? level.tr : level.en}</Text>
            <Text style={styles.levelNum}>{isTr ? `Seviye ${level.level}` : `Level ${level.level}`}</Text>
          </View>
        </View>
        <View style={styles.rightStats}>
          <View
            style={styles.streakBadge}
            accessible
            accessibilityRole="text"
            accessibilityLabel={isTr ? `${streak} günlük seri` : `${streak} day streak`}
          >
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLabel}>{isTr ? 'gün' : 'day'}</Text>
          </View>
          <View
            style={[styles.healthBadge, { backgroundColor: healthColor + '20', borderColor: healthColor }]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={isTr ? `Sağlık skoru ${healthScore}` : `Health score ${healthScore}`}
          >
            <Text style={[styles.healthScore, { color: healthColor }]}>{healthScore}</Text>
            <Text style={[styles.healthLabel, { color: healthColor }]}>{isTr ? 'Skor' : 'Score'}</Text>
          </View>
        </View>
      </View>

      {/* XP Progress bar */}
      <View style={styles.xpSection}>
        <View style={styles.xpLabelRow}>
          <Text style={styles.xpDaily}>+{dailyXP} XP {isTr ? 'bugün' : 'today'}</Text>
          {nextLevel
            ? <Text style={styles.xpToNext}>{xpToNext} XP → {isTr ? nextLevel.tr : nextLevel.en} {nextLevel.emoji}</Text>
            : <Text style={styles.xpToNext}>{isTr ? 'Maks seviye! 🏆' : 'Max level! 🏆'}</Text>
          }
        </View>
        <View style={styles.xpBarTrack}>
          <Animated.View style={[styles.xpBarFill, { width: xpBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <View style={styles.xpTotalRow}>
          <Text style={styles.xpTotal}>{isTr ? 'Toplam XP:' : 'Total XP:'} {totalXP}</Text>
        </View>
      </View>

      {/* Daily Missions */}
      <View style={styles.missionsSection}>
        <View style={styles.missionsTitleRow}>
          <Text style={styles.missionsTitle}>
            {isTr ? '📋 Günlük Görevler' : '📋 Daily Missions'}
          </Text>
          <Text style={styles.missionsPct}>
            {completedCount}/{MISSIONS.length}
            {allDone ? ' 🎯' : ''}
          </Text>
        </View>
        {MISSIONS.map((m) => {
          const done = completedMissions.includes(m.id);
          return (
            <View
              key={m.id}
              style={[styles.missionRow, done && styles.missionRowDone]}
              accessible
              accessibilityRole="text"
              accessibilityState={{ checked: done }}
              accessibilityLabel={`${isTr ? m.tr : m.en}, +${m.xp} XP, ${done ? (isTr ? 'tamamlandı' : 'completed') : (isTr ? 'tamamlanmadı' : 'not completed')}`}
            >
              <Text style={styles.missionIcon}>{done ? '✅' : m.icon}</Text>
              <Text style={[styles.missionText, done && styles.missionTextDone]}>
                {isTr ? m.tr : m.en}
              </Text>
              <View style={[styles.xpPill, done && styles.xpPillDone]}>
                <Text style={[styles.xpPillText, done && styles.xpPillTextDone]}>+{m.xp} XP</Text>
              </View>
            </View>
          );
        })}
        {allDone && (
          <View style={styles.bonusRow}>
            <Text style={styles.bonusText}>
              🎯 {isTr ? 'Tüm görevler tamamlandı! +50 XP bonus kazandın!' : 'All missions done! +50 XP bonus earned!'}
            </Text>
          </View>
        )}
      </View>

      {/* Health Score bar */}
      <View style={styles.healthSection}>
        <View style={styles.healthBarRow}>
          <Text style={styles.healthBarLabel}>{isTr ? '💚 Günlük Sağlık Skoru' : '💚 Daily Health Score'}</Text>
          <Text style={[styles.healthBarValue, { color: healthColor }]}>{healthScore}/100</Text>
        </View>
        <View style={styles.healthBarTrack}>
          <View style={[styles.healthBarFill, { width: `${healthScore}%`, backgroundColor: healthColor }]} />
        </View>
      </View>

    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  card: {
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  xpFlash: {
    position: 'absolute', top: 12, right: 16, zIndex: 10,
    backgroundColor: colors.warning, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  xpFlashText: { color: colors.white, fontWeight: '800', fontSize: 14, fontFamily: fontFamily.headingBold },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelEmoji: { fontSize: 32 },
  levelName: { color: colors.white, fontWeight: '800', fontSize: 15, fontFamily: fontFamily.headingBold },
  levelNum: { color: '#A5B4FC', fontSize: 11, marginTop: 1, fontFamily: fontFamily.body },
  rightStats: { flexDirection: 'row', gap: 10 },
  streakBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)',
  },
  streakEmoji: { fontSize: 16 },
  streakNum: { color: '#FCD34D', fontWeight: '800', fontSize: 16, lineHeight: 20, fontFamily: fontFamily.headingBold },
  streakLabel: { color: '#FCD34D', fontSize: 9, fontWeight: '600', fontFamily: fontFamily.bodySemiBold },
  healthBadge: {
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center', borderWidth: 1,
  },
  healthScore: { fontWeight: '800', fontSize: 16, lineHeight: 20, fontFamily: fontFamily.headingBold },
  healthLabel: { fontSize: 9, fontWeight: '600', fontFamily: fontFamily.bodySemiBold },

  xpSection: { marginBottom: 14 },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpDaily: { color: '#A5B4FC', fontSize: 12, fontWeight: '600', fontFamily: fontFamily.bodySemiBold },
  xpToNext: { color: '#6EE7B7', fontSize: 11, fontWeight: '600', flexShrink: 1, textAlign: 'right', fontFamily: fontFamily.bodySemiBold },
  xpBarTrack: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4, overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%', borderRadius: 4,
    backgroundColor: '#818CF8',
  },
  xpTotalRow: { alignItems: 'flex-end', marginTop: 4 },
  xpTotal: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: fontFamily.body },

  missionsSection: { marginBottom: 14 },
  missionsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  missionsTitle: { color: '#E0E7FF', fontWeight: '700', fontSize: 13, fontFamily: fontFamily.headingSemiBold },
  missionsPct: { color: '#A5B4FC', fontWeight: '700', fontSize: 13, fontFamily: fontFamily.headingSemiBold },
  missionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    marginBottom: 6,
  },
  missionRowDone: { backgroundColor: 'rgba(16,185,129,0.12)' },
  missionIcon: { fontSize: 18, width: 24, textAlign: 'center', fontFamily: fontFamily.body },
  missionText: { flex: 1, color: '#C7D2FE', fontSize: 13, fontWeight: '500', fontFamily: fontFamily.bodyMedium },
  missionTextDone: { color: '#6EE7B7', textDecorationLine: 'line-through' },
  xpPill: {
    backgroundColor: 'rgba(165,180,252,0.15)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  xpPillDone: { backgroundColor: 'rgba(110,231,183,0.15)' },
  xpPillText: { color: '#A5B4FC', fontSize: 11, fontWeight: '700', fontFamily: fontFamily.bodySemiBold },
  xpPillTextDone: { color: '#6EE7B7' },
  bonusRow: {
    backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10,
    padding: 10, marginTop: 4,
  },
  bonusText: { color: '#FCD34D', fontSize: 12, fontWeight: '600', textAlign: 'center', fontFamily: fontFamily.bodySemiBold },

  healthSection: {},
  healthBarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  healthBarLabel: { color: '#C7D2FE', fontSize: 12, fontWeight: '600', fontFamily: fontFamily.bodySemiBold },
  healthBarValue: { fontWeight: '800', fontSize: 13, fontFamily: fontFamily.headingBold },
  healthBarTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3, overflow: 'hidden',
  },
  healthBarFill: { height: '100%', borderRadius: 3 },
  });
