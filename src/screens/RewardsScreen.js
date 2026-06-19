// RewardsScreen — gamification / points hub (moved off Home, reachable from Settings).
// Stitch-style: indigo gradient hero, clean white rounded cards, simple bars, soft shadows.
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { Screen, Card, GradientHero, ProgressBar, SectionTitle } from '../components/ui';
import {
  colors,
  spacing,
  radii,
  typography,
  fontFamily,
  shadow,
} from '../theme';
import { useLanguage } from '../context/LanguageContext';
import {
  useGamification,
  MISSIONS,
  getCurrentLevel,
  getNextLevel,
  getXPProgress,
} from '../context/GamificationContext';

export default function RewardsScreen({ navigation }) {
  const { language } = useLanguage();
  const isTr = language === 'tr';

  // Read whatever the context exposes; degrade gracefully for missing fields.
  const gamif = useGamification() || {};
  const totalXP = gamif.totalXP || 0;
  const dailyXP = gamif.dailyXP || 0;
  const streak = gamif.streak || 0;
  const completedMissions = gamif.completedMissions || [];
  const missions = Array.isArray(MISSIONS) ? MISSIONS : [];

  const level = getCurrentLevel(totalXP);
  const nextLevel = getNextLevel(totalXP);
  const { pct = 0, xpToNext = 0 } = getXPProgress(totalXP) || {};

  const completedCount = missions.filter((m) => completedMissions.includes(m.id)).length;
  const allDone = missions.length > 0 && completedCount === missions.length;

  // Animate the hero XP bar fill.
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: Math.max(0, Math.min(1, pct / 100)),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <Screen edges={['top', 'left', 'right']}>
      {/* Back header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation?.goBack?.()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Geri' : 'Back'}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backChevron}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isTr ? 'Ödüller' : 'Rewards'}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: level + XP + progress to next level ── */}
        <GradientHero style={styles.hero}>
          <Text style={styles.heroEyebrow}>
            {isTr ? `SEVİYE ${level.level}` : `LEVEL ${level.level}`}
          </Text>

          <View style={styles.heroTitleRow}>
            <Text style={styles.heroEmoji}>{level.emoji}</Text>
            <Text style={styles.heroLevelName}>{isTr ? level.tr : level.en}</Text>
          </View>

          <Text style={styles.heroXP}>
            {totalXP} <Text style={styles.heroXPUnit}>XP</Text>
          </Text>

          {/* Progress to next level */}
          <View style={styles.heroBarTrack}>
            <Animated.View
              style={[
                styles.heroBarFill,
                {
                  width: barAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <Text style={styles.heroBarCaption}>
            {nextLevel
              ? isTr
                ? `${xpToNext} XP → Seviye ${nextLevel.level} · ${nextLevel.tr} ${nextLevel.emoji}`
                : `${xpToNext} XP → Level ${nextLevel.level} · ${nextLevel.en} ${nextLevel.emoji}`
              : isTr
                ? 'En yüksek seviye! 🏆'
                : 'Max level reached! 🏆'}
          </Text>
        </GradientHero>

        {/* ── Quick stats: streak + today's XP ── */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard} contentStyle={styles.statInner}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>
              {isTr ? 'günlük seri' : 'day streak'}
            </Text>
          </Card>

          <Card style={styles.statCard} contentStyle={styles.statInner}>
            <Text style={styles.statEmoji}>⚡</Text>
            <Text style={styles.statValue}>+{dailyXP}</Text>
            <Text style={styles.statLabel}>
              {isTr ? 'bugün kazanılan XP' : 'XP earned today'}
            </Text>
          </Card>
        </View>

        {/* ── Daily missions ── */}
        <SectionTitle
          title={isTr ? 'Günlük Görevler' : 'Daily Missions'}
          subtitle={
            isTr
              ? `${completedCount}/${missions.length} tamamlandı`
              : `${completedCount}/${missions.length} completed`
          }
          style={styles.section}
        />

        <Card style={styles.missionsCard} padding={spacing.stackSm}>
          {missions.map((m, idx) => {
            const done = completedMissions.includes(m.id);
            return (
              <View
                key={m.id}
                style={[
                  styles.missionRow,
                  idx > 0 && styles.missionDivider,
                ]}
              >
                <View
                  style={[
                    styles.missionIconWrap,
                    done && styles.missionIconWrapDone,
                  ]}
                >
                  <Text style={styles.missionIcon}>{done ? '✓' : m.icon}</Text>
                </View>

                <Text
                  style={[styles.missionText, done && styles.missionTextDone]}
                  numberOfLines={2}
                >
                  {isTr ? m.tr : m.en}
                </Text>

                <View style={[styles.xpPill, done && styles.xpPillDone]}>
                  <Text style={[styles.xpPillText, done && styles.xpPillTextDone]}>
                    +{m.xp} XP
                  </Text>
                </View>
              </View>
            );
          })}

          {allDone && (
            <View style={styles.bonusRow}>
              <Text style={styles.bonusText}>
                🎯{' '}
                {isTr
                  ? 'Tüm görevler tamam! +50 XP bonus kazandın.'
                  : 'All missions done! You earned a +50 XP bonus.'}
              </Text>
            </View>
          )}
        </Card>

        {/* ── How it works ── */}
        <Card style={styles.infoCard} contentStyle={styles.infoInner}>
          <Text style={styles.infoTitle}>
            {isTr ? 'Nasıl çalışır?' : 'How it works'}
          </Text>
          <Text style={styles.infoText}>
            {isTr
              ? 'Kilonu kaydet, öğün ve spor ekle, protein hedefine ulaş — her aktiviteyle XP kazanır, seviye atlar ve serini büyütürsün. Puanlar burada birikir.'
              : 'Log your weight, add meals and workouts, hit your protein target — every action earns XP, levels you up, and grows your streak. Points accrue here.'}
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.containerMargin,
    paddingVertical: spacing.stackSm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: { ...typography.headlineLg, color: colors.onSurface, lineHeight: 36 },
  headerTitle: { ...typography.headlineMd, color: colors.onSurface },
  pressed: { opacity: 0.6 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.containerMargin,
    paddingTop: spacing.stackSm,
    paddingBottom: spacing.stackLg * 2,
  },

  // Hero
  hero: { marginBottom: spacing.stackMd },
  heroEyebrow: {
    ...typography.labelSm,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroEmoji: { fontSize: 28, fontFamily: fontFamily.body },
  heroLevelName: {
    ...typography.headlineMd,
    color: colors.white,
    flexShrink: 1,
  },
  heroXP: {
    ...typography.displayStat,
    fontSize: 44,
    lineHeight: 50,
    color: colors.white,
    marginTop: spacing.stackSm,
  },
  heroXPUnit: {
    ...typography.headlineMd,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 20,
  },
  heroBarTrack: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    marginTop: spacing.stackMd,
  },
  heroBarFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.white,
  },
  heroBarCaption: {
    ...typography.labelSm,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing.stackSm,
  },

  // Quick stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.stackMd,
    marginBottom: spacing.stackLg,
  },
  statCard: { flex: 1 },
  statInner: { alignItems: 'center' },
  statEmoji: { fontSize: 26, fontFamily: fontFamily.body },
  statValue: {
    ...typography.headlineLg,
    color: colors.onSurface,
    marginTop: 4,
  },
  statLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'center',
  },

  // Section
  section: { marginBottom: spacing.stackSm },

  // Missions
  missionsCard: { marginBottom: spacing.stackLg },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.stackMd,
    paddingVertical: spacing.stackSm + 2,
    paddingHorizontal: spacing.stackSm,
  },
  missionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  missionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionIconWrapDone: { backgroundColor: colors.successBg },
  missionIcon: { fontSize: 18, fontFamily: fontFamily.body, color: colors.success },
  missionText: {
    flex: 1,
    ...typography.bodyMd,
    fontFamily: fontFamily.bodyMedium,
    color: colors.onSurface,
  },
  missionTextDone: {
    color: colors.onSurfaceVariant,
    textDecorationLine: 'line-through',
  },
  xpPill: {
    backgroundColor: colors.infoBg,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  xpPillDone: { backgroundColor: colors.successBg },
  xpPillText: {
    ...typography.labelSm,
    fontFamily: fontFamily.bodySemiBold,
    color: colors.primary,
  },
  xpPillTextDone: { color: colors.success },
  bonusRow: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.stackMd,
    marginTop: spacing.stackSm,
  },
  bonusText: {
    ...typography.labelMd,
    color: colors.warning,
    textAlign: 'center',
  },

  // Info
  infoCard: {},
  infoInner: {},
  infoTitle: {
    ...typography.labelMd,
    fontFamily: fontFamily.headingSemiBold,
    color: colors.onSurface,
    marginBottom: 6,
  },
  infoText: {
    ...typography.bodyMd,
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurfaceVariant,
  },
});
