import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnit } from '../context/UnitContext';
import { getWeightLogs, getMealLogs, getUserProfile } from '../services/firestoreService';
import { getMedicationProfile } from '../services/medicationService';
import { detectRebound } from '../utils/heuristics';

import { colors, semantic, typography, spacing, radii, shadow } from '../theme';
import {
  Screen,
  Card,
  GradientHero,
  PrimaryButton,
  Ring,
  SectionTitle,
  Badge,
} from '../components/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFatMuscleRatio(proteinRatio) {
  if (proteinRatio >= 1.0) return { fatPct: 95, musclePct: 5 };
  if (proteinRatio >= 0.8) return { fatPct: 80, musclePct: 20 };
  if (proteinRatio >= 0.6) return { fatPct: 65, musclePct: 35 };
  return { fatPct: 50, musclePct: 50 };
}

// Muscle-risk tier → tone + label helpers (centralized for the new design)
function muscleTier(musclePct) {
  if (musclePct >= 50) return 'critical';
  if (musclePct >= 30) return 'high';
  return 'low';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyReportScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatWeight } = useUnit();
  const isTr = language === 'tr';

  const [loading, setLoading] = useState(true);
  const [proteinTarget, setProteinTarget] = useState(120);
  const [hasWeightData, setHasWeightData] = useState(false);

  // Real data
  const [weeklyChange, setWeeklyChange] = useState(0);
  const [totalLost, setTotalLost] = useState(0);
  const [avgProteinRatio, setAvgProteinRatio] = useState(0);

  // Body composition
  const [weeklyFatLost, setWeeklyFatLost] = useState(0);
  const [weeklyMuscleLost, setWeeklyMuscleLost] = useState(0);
  const [totalFatLost, setTotalFatLost] = useState(0);
  const [totalMuscleLost, setTotalMuscleLost] = useState(0);

  // Daily protein chart data (7 days, newest first → reversed for display)
  const [dailyProtein, setDailyProtein] = useState([]);

  // Maintenance mode: surfaced when medication is recently/being stopped
  // maintenance shape: { active, rebound, goalWeight, latestWeight } | null
  const [maintenance, setMaintenance] = useState(null);

  useEffect(() => {
    if (user) {
      setLoading(true);
      loadData(user.uid);
    }
  }, [user]);

  async function loadData(userId) {
    try {
      const [weightLogs, mealLogs, profile] = await Promise.all([
        getWeightLogs(userId),
        getMealLogs(userId),
        getUserProfile(userId),
      ]);

      // Protein target from profile
      const target = profile?.proteinTarget ?? (profile?.weight ? Math.round(profile.weight * 1.6) : 120);
      setProteinTarget(target);

      // Sort weight logs oldest → newest
      const sortedLogs = weightLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
      setHasWeightData(sortedLogs.length >= 2);

      // Weekly weight change: compare oldest log in past 7 days vs most recent
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentLogs = sortedLogs.filter((l) => new Date(l.date) >= weekAgo);

      const wChange =
        recentLogs.length >= 2
          ? parseFloat(
              (recentLogs[0].weight - recentLogs[recentLogs.length - 1].weight).toFixed(1)
            )
          : 0;
      setWeeklyChange(wChange);

      // Total weight lost (all time): first log weight minus last log weight
      const tLost =
        sortedLogs.length >= 2
          ? parseFloat(
              (sortedLogs[0].weight - sortedLogs[sortedLogs.length - 1].weight).toFixed(1)
            )
          : 0;
      setTotalLost(tLost);

      // ── Maintenance mode: only when medication is recently/being stopped ──
      // After GLP-1 medication ends, the goal shifts from "lose faster" to
      // "hold your result" — so we reframe around weight maintenance.
      try {
        const medProfile = await getMedicationProfile(userId);
        const medStatus = medProfile?.status;
        if (medStatus === 'recentlyStopped' || medStatus === 'planningToStop') {
          const rebound = detectRebound(sortedLogs);
          const latestWeight =
            sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].weight : null;
          const goalWeight =
            profile?.goalWeight ?? profile?.targetWeight ?? null;
          setMaintenance({
            active: true,
            status: medStatus,
            rebound,
            goalWeight: typeof goalWeight === 'number' ? goalWeight : null,
            latestWeight,
          });
        } else {
          setMaintenance(null);
        }
      } catch {
        setMaintenance(null);
      }

      // Average protein ratio + per-day data for chart
      const DAY_NAMES_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let totalRatio = 0;
      let daysWithData = 0;
      const dayRows = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const key = `daily_meals_${userId}_${dateStr}`;
        const raw = await AsyncStorage.getItem(key);
        const dayName = isTr ? DAY_NAMES_TR[d.getDay()] : DAY_NAMES_EN[d.getDay()];
        const exerciseKey = `daily_exercise_${userId}_${dateStr}`;
        const exRaw = await AsyncStorage.getItem(exerciseKey);
        const exercises = exRaw ? JSON.parse(exRaw) : [];
        const exerciseCal = exercises.reduce((s, e) => s + (e.caloriesBurned || 0), 0);
        const userWeight = profile?.weight || 70;
        const userGender = profile?.gender;
        const bmr = Math.round(userWeight * (userGender === 'male' ? 24 : userGender === 'female' ? 22 : 23));

        if (raw) {
          const meals = JSON.parse(raw);
          const grams = meals.reduce((s, m) => s + (m.protein || 0), 0);
          const foodCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
          const balance = foodCal > 0 ? foodCal - (bmr + exerciseCal) : null;
          totalRatio += target > 0 ? grams / target : 0;
          daysWithData++;
          dayRows.push({ dayName, grams, target, ratio: target > 0 ? grams / target : 0, hasData: true, foodCal, exerciseCal, bmr, balance });
        } else {
          dayRows.push({ dayName, grams: 0, target, ratio: 0, hasData: false, foodCal: 0, exerciseCal: 0, bmr, balance: null });
        }
      }
      setDailyProtein(dayRows);
      const ratio = daysWithData > 0 ? totalRatio / daysWithData : 0;
      setAvgProteinRatio(ratio);

      // Body comp: weekly
      const { fatPct: wFatPct, musclePct: wMusclePct } = getFatMuscleRatio(ratio);
      const absWeekly = Math.abs(wChange);
      setWeeklyFatLost(
        absWeekly > 0 ? parseFloat(((absWeekly * wFatPct) / 100).toFixed(1)) : 0
      );
      setWeeklyMuscleLost(
        absWeekly > 0 ? parseFloat(((absWeekly * wMusclePct) / 100).toFixed(1)) : 0
      );

      // Body comp: total
      const { fatPct: tFatPct, musclePct: tMusclePct } = getFatMuscleRatio(ratio);
      const absTotal = Math.abs(tLost);
      setTotalFatLost(
        absTotal > 0 ? parseFloat(((absTotal * tFatPct) / 100).toFixed(1)) : 0
      );
      setTotalMuscleLost(
        absTotal > 0 ? parseFloat(((absTotal * tMusclePct) / 100).toFixed(1)) : 0
      );
    } catch {
      // fail silently — show zeros
    } finally {
      setLoading(false);
    }
  }

  // ── Recommendations ──────────────────────────────────────────────────────────
  const recommendations = (() => {
    const recs = [];
    const totalAbs = Math.abs(totalLost);
    const weeklyAbs = Math.abs(weeklyChange);

    // Muscle maintenance — check if muscle risk is high
    if (totalAbs > 0 && totalMuscleLost / totalAbs > 0.2) {
      recs.push(
        isTr
          ? `Günlük ${proteinTarget}g protein hedefinizi artırın — kas korumayı desteklemek için.`
          : `Increase daily protein to ${proteinTarget}g to support muscle maintenance.`
      );
    } else {
      recs.push(
        isTr
          ? 'Protein alımınız kaslarınızı iyi koruyor. Bu tutarlılığı sürdürün!'
          : 'Your protein intake is protecting your muscles well. Keep up the consistency!'
      );
    }

    // Weight loss > 1% per week
    const latestWeight = totalLost > 0 ? undefined : null;
    if (weeklyAbs > 0 && weeklyAbs / (weeklyAbs + 70) > 0.01) {
      recs.push(
        isTr
          ? 'Haftalık kilo kaybı hızlı — proteine öncelik verin ve direnç egzersizi ekleyin.'
          : 'Weight loss pace is fast — prioritize protein and add resistance training.'
      );
    } else if (weeklyChange > 0) {
      recs.push(
        isTr
          ? 'Kilo kaybı hızınız ideal aralıkta. Böyle devam edin!'
          : 'Your weight loss rate is in the ideal range. Keep it up!'
      );
    } else {
      recs.push(
        isTr
          ? 'Bu hafta kilo değişimi yok. Genel beslenmenizi gözden geçirin.'
          : 'No weight change this week. Review your overall nutrition if needed.'
      );
    }

    // Default motivation
    recs.push(
      isTr
        ? 'Tutarlılık en önemli faktör — her gün küçük adımlar büyük sonuçlar doğurur.'
        : 'Keep up the great work! Consistency is key — small daily steps lead to big results.'
    );

    return recs;
  })();

  // Week range label (e.g. "Jun 12 – Jun 18") for the header
  const weekRangeLabel = (() => {
    const fmt = (dt) =>
      dt.toLocaleDateString(isTr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' });
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  if (loading) {
    return (
      <Screen edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!hasWeightData) {
    return (
      <Screen edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.screenTitle}>{t('weeklyReport')}</Text>
          <Card style={styles.emptyState} contentStyle={styles.emptyInner}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>
              {isTr ? 'Henüz yeterli veri yok' : 'Not enough data yet'}
            </Text>
            <Text style={styles.emptyDesc}>
              {isTr
                ? 'Haftalık raporu görmek için en az 2 kilo girişi yapmanız gerekiyor. Dashboard\'dan kilonuzu kaydedin.'
                : 'You need at least 2 weight entries to see your weekly report. Log your weight from the Dashboard.'}
            </Text>
            <PrimaryButton
              title={isTr ? '📉 Kilo Kaydet' : '📉 Log Weight'}
              onPress={() => navigation.navigate('Dashboard')}
            />
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  const weeklyChangeAbs = Math.abs(weeklyChange);
  // direction-aware accent (loss = success green, gain = danger red)
  const weeklyChangeColor =
    weeklyChange > 0 ? colors.success : weeklyChange < 0 ? colors.danger : colors.onSurfaceVariant;
  const weeklyChangePrefix = weeklyChange > 0 ? '−' : weeklyChange < 0 ? '+' : '';

  // Average protein ring metrics
  const avgPct = Math.max(0, Math.min(1, avgProteinRatio));
  const avgPctLabel = Math.round(avgProteinRatio * 100);
  const avgRingColor =
    avgPct >= 1 ? colors.success : avgPct >= 0.6 ? colors.warning : colors.danger;

  // Muscle grade (derived from avg protein ratio → muscle risk tier)
  const muscleInfo = getFatMuscleRatio(avgProteinRatio);
  const tier = muscleTier(muscleInfo.musclePct);
  const muscleTone =
    tier === 'critical' ? 'danger' : tier === 'high' ? 'warning' : 'success';
  const muscleTonePalette = semantic[muscleTone];
  const muscleEmoji = tier === 'critical' ? '🚨' : tier === 'high' ? '🟠' : '🟢';
  const muscleGrade = tier === 'critical' ? 'C' : tier === 'high' ? 'B' : 'A';
  const muscleRiskLabel =
    tier === 'critical' ? (isTr ? 'Kritik' : 'Critical')
      : tier === 'high' ? (isTr ? 'Yüksek' : 'High')
      : (isTr ? 'Düşük' : 'Low');
  const muscleRiskRange = tier === 'critical' ? '40–50' : tier === 'high' ? '25–35' : '10–20';

  // ── Maintenance summary (medication recently/being stopped) ──
  // Heuristic copy derived from detectRebound() + goal proximity, NOT framed
  // around weight-loss speed.
  const maintenanceView = (() => {
    if (!maintenance?.active) return null;
    const rebound = maintenance.rebound || { trend: 'flat', gainedKg: 0, alert: 'none' };
    const gained = Math.abs(rebound.gainedKg || 0);
    const goal = maintenance.goalWeight;
    const latest = maintenance.latestWeight;
    const withinGoalKg =
      typeof goal === 'number' && typeof latest === 'number'
        ? parseFloat(Math.abs(latest - goal).toFixed(1))
        : null;

    // Tone: stable/within range → success; small drift → warning; rebound → danger
    let tone = 'success';
    if (rebound.alert === 'high') tone = 'danger';
    else if (rebound.alert === 'watch' || (withinGoalKg != null && withinGoalKg > 2)) tone = 'warning';
    const palette = semantic[tone];
    const emoji = tone === 'danger' ? '🚨' : tone === 'warning' ? '🟠' : '✅';

    const title =
      maintenance.status === 'planningToStop'
        ? (isTr ? 'Koruma Modu (ilacı bırakma planı)' : 'Maintenance Mode (planning to stop)')
        : (isTr ? 'Koruma Modu (ilaç bırakıldı)' : 'Maintenance Mode (medication stopped)');

    // Primary metric line
    let metric;
    if (withinGoalKg != null) {
      metric = isTr
        ? `Hedefinizin ${formatWeight(withinGoalKg)} içindesiniz`
        : `Within ${formatWeight(withinGoalKg)} of your goal`;
    } else if (rebound.alert === 'none') {
      metric = isTr ? 'Kilonuz stabil — sonucunuzu koruyorsunuz' : 'Weight is stable — you are holding your result';
    } else {
      metric = isTr
        ? `Düşük noktanızdan ${formatWeight(gained)} yukarıda`
        : `${formatWeight(gained)} above your lowest point`;
    }

    // Supporting description by rebound alert
    let desc;
    if (rebound.alert === 'high') {
      desc = isTr
        ? `Son düşük noktanızdan bu yana ${formatWeight(gained)} geri alındı. Protein ve direnç egzersizine ağırlık vererek bunu durdurabilirsiniz.`
        : `You've regained ${formatWeight(gained)} since your lowest point. Leaning into protein and resistance training can help stop the rebound.`;
    } else if (rebound.alert === 'watch') {
      desc = isTr
        ? `Hafif bir yükseliş var (${formatWeight(gained)}). Şimdi alışkanlıklara sadık kalmak sonucunuzu korur.`
        : `There's a slight uptick (${formatWeight(gained)}). Staying consistent now keeps your result locked in.`;
    } else {
      desc = isTr
        ? 'Kilonuzu iyi koruyorsunuz. Odak artık hızlı kayıp değil, sonucu sürdürmek.'
        : 'You are maintaining well. The focus now is sustaining your result, not losing faster.';
    }

    return { tone, palette, emoji, title, metric, desc };
  })();

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header: title + week range ── */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>{t('weeklyReport')}</Text>
          <Text style={styles.weekRange}>{weekRangeLabel}</Text>
        </View>

        {/* ── Hero Card: This Week summary ── */}
        <GradientHero style={styles.hero}>
          <Text style={styles.heroTitle}>
            {isTr ? '📉 Bu Hafta' : '📉 This Week'}
          </Text>
          <Text style={styles.heroValue}>
            {weeklyChangePrefix}{formatWeight(weeklyChangeAbs)}
          </Text>
          <Text style={styles.heroSubtitle}>
            {weeklyChange > 0
              ? isTr ? 'Bu hafta kaybedildi' : 'Lost this week'
              : weeklyChange < 0
              ? isTr ? 'Bu hafta alındı' : 'Gained this week'
              : isTr ? 'Değişim yok' : 'No change this week'}
          </Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{formatWeight(Math.abs(totalLost))}</Text>
              <Text style={styles.heroStatLabel}>{isTr ? 'Toplam Kayıp' : 'Total Lost'}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{formatWeight(totalFatLost)}</Text>
              <Text style={styles.heroStatLabel}>{isTr ? 'Yağ Kaybı' : 'Fat Lost'}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{avgPctLabel}%</Text>
              <Text style={styles.heroStatLabel}>{isTr ? 'Ort. Protein' : 'Avg Protein'}</Text>
            </View>
          </View>
        </GradientHero>

        {/* ── Maintenance summary (medication recently/being stopped) ── */}
        {maintenanceView && (
          <Card
            style={[styles.maintenanceCard, { backgroundColor: maintenanceView.palette.bg }]}
            contentStyle={styles.maintenanceInner}
            elevation="sm"
          >
            <Text style={[styles.maintenanceTitle, { color: maintenanceView.palette.fg }]}>
              {maintenanceView.emoji} {maintenanceView.title}
            </Text>
            <Text style={[styles.maintenanceMetric, { color: maintenanceView.palette.fg }]}>
              {maintenanceView.metric}
            </Text>
            <Text style={styles.maintenanceDesc}>{maintenanceView.desc}</Text>
            <Text style={styles.maintenanceEstimate}>
              {isTr
                ? 'Tahmin: kilo eğiliminizden hesaplandı — vücut ölçümü değildir.'
                : 'Estimate: based on your weight trend — not a body measurement.'}
            </Text>
          </Card>
        )}

        {/* ── Avg Protein Ring + Muscle Grade ── */}
        <View style={styles.gridRow}>
          {/* Avg Protein Ring */}
          <Card style={styles.gridCard} contentStyle={styles.gridCardInner}>
            <Ring
              progress={avgPct}
              size={104}
              strokeWidth={11}
              color={avgRingColor}
              trackColor={colors.outlineVariant}
            >
              <Text style={[styles.ringValue, { color: avgRingColor }]}>{avgPctLabel}%</Text>
              <Text style={styles.ringSub}>{proteinTarget}g</Text>
            </Ring>
            <Text style={styles.gridCardLabel}>
              {isTr ? 'Ort. Protein Hedefi' : 'Avg Protein Goal'}
            </Text>
          </Card>

          {/* Muscle Grade */}
          <Card style={styles.gridCard} contentStyle={styles.gridCardInner}>
            <View style={[styles.gradeCircle, { backgroundColor: muscleTonePalette.bg }]}>
              <Text style={[styles.gradeLetter, { color: muscleTonePalette.fg }]}>
                {muscleGrade}
              </Text>
            </View>
            <Text style={styles.gridCardLabel}>
              {isTr ? 'Kas Koruma Notu' : 'Muscle Grade'}
            </Text>
            <Badge
              label={`${muscleEmoji} ${muscleRiskLabel} ~%${muscleRiskRange}`}
              tone={muscleTone}
              style={styles.gradeBadge}
            />
            <Text style={styles.estimateCaption}>
              {isTr
                ? 'Tahmin — protein alımı ve kilo eğiliminden'
                : 'Estimate — from protein intake & weight trend'}
            </Text>
          </Card>
        </View>

        {/* Muscle alert when risk is elevated */}
        {weeklyMuscleLost > 0 && muscleInfo.musclePct >= 30 && (
          <Card
            style={[styles.alertCard, { backgroundColor: muscleTonePalette.bg }]}
            contentStyle={styles.alertInner}
            elevation="sm"
          >
            <Text style={[styles.alertTitle, { color: muscleTonePalette.fg }]}>
              {muscleEmoji} {isTr
                ? 'Bu hafta kas korumayı desteklemek için proteini yüksek tutun.'
                : 'Keep protein high to support muscle maintenance this week.'}
            </Text>
            <Text style={styles.alertDesc}>
              {isTr
                ? `Metabolizmanız yavaşlayabilir ve ilerlemeniz sekteye uğrayabilir. Günlük ${proteinTarget}g protein + haftada 2–3 direnç egzersizi bu riski azaltabilir.`
                : `Your metabolism may slow and progress sustainability may be affected. ${proteinTarget}g protein/day + 2–3 resistance sessions/week can reduce this risk.`}
            </Text>
          </Card>
        )}

        {/* ── Weekly Body Composition ── */}
        <SectionTitle
          title={isTr ? '🥩 Haftalık Vücut Kompozisyonu' : '🥩 Weekly Body Composition'}
          style={styles.section}
        />
        <View style={styles.gridRow}>
          <Card style={[styles.compCard, { backgroundColor: colors.successBg }]} contentStyle={styles.gridCardInner}>
            <Text style={styles.compIcon}>🟢</Text>
            <Text style={[styles.compValue, { color: colors.success }]}>{formatWeight(weeklyFatLost)}</Text>
            <Text style={[styles.compLabel, { color: colors.success }]}>
              {isTr ? 'Yağ Kaybı' : 'Fat Lost'}
            </Text>
            <Text style={[styles.compPct, { color: colors.success }]}>
              %{muscleInfo.fatPct}
            </Text>
          </Card>
          <Card style={[styles.compCard, { backgroundColor: muscleTonePalette.bg }]} contentStyle={styles.gridCardInner}>
            <Text style={styles.compIcon}>{muscleEmoji}</Text>
            <Text style={[styles.compValue, { color: muscleTonePalette.fg, fontSize: 18 }]}>
              {muscleRiskLabel}
            </Text>
            <Text style={[styles.compLabel, { color: muscleTonePalette.fg }]}>
              {isTr ? 'Kas Riski' : 'Muscle Risk'}
            </Text>
            <Text style={[styles.compPct, { color: muscleTonePalette.fg }]}>
              %{muscleRiskRange}
            </Text>
          </Card>
        </View>
        <Text style={styles.estimateCaptionWide}>
          {isTr
            ? 'Yağ/kas dağılımı bir tahmindir — protein alımı ve kilo eğiliminden hesaplanır, vücut ölçümü değildir.'
            : 'Fat/muscle split is an estimate — derived from protein intake & weight trend, not body measurements.'}
        </Text>

        {/* ── Total Progress Card ── */}
        <SectionTitle
          title={isTr ? '🏆 Başlangıçtan Bugüne' : '🏆 Total Progress Since Start'}
          style={styles.section}
        />
        <Card contentStyle={styles.totalInner}>
          <View style={styles.totalRow}>
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>{formatWeight(Math.abs(totalLost))}</Text>
              <Text style={styles.totalLabel}>{isTr ? 'Toplam Kayıp' : 'Total Lost'}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: colors.success }]}>{formatWeight(totalFatLost)}</Text>
              <Text style={styles.totalLabel}>{isTr ? 'Yağ Kaybı' : 'Fat Lost'}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: muscleTonePalette.fg, fontSize: 16 }]}>
                {muscleRiskLabel}
              </Text>
              <Text style={styles.totalLabel}>{isTr ? 'Kas Riski' : 'Muscle Risk'}</Text>
              <Text style={[styles.totalLabel, { fontSize: 10 }]}>~%{muscleRiskRange}</Text>
            </View>
          </View>

          {/* Progress bar: fat vs muscle */}
          {Math.abs(totalLost) > 0 && (
            <View style={styles.splitBarContainer}>
              <View style={styles.splitBar}>
                <View style={[styles.splitBarFat, { flex: muscleInfo.fatPct }]} />
                <View style={[styles.splitBarMuscle, { flex: muscleInfo.musclePct }]} />
              </View>
              <View style={styles.splitBarLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendText}>
                    {isTr ? 'Yağ' : 'Fat'} {muscleInfo.fatPct}%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                  <Text style={styles.legendText}>
                    {isTr ? 'Kas' : 'Muscle'} {muscleInfo.musclePct}%
                  </Text>
                </View>
              </View>
              <Text style={styles.estimateCaption}>
                {isTr
                  ? 'Tahmini dağılım — protein alımı ve kilo eğiliminden'
                  : 'Estimated split — from protein intake & weight trend'}
              </Text>
            </View>
          )}
        </Card>

        {/* ── Daily Protein Chart ── */}
        <SectionTitle
          title={isTr ? '🥛 Günlük Protein Takibi' : '🥛 Daily Protein Tracker'}
          style={styles.section}
        />
        <Card contentStyle={styles.chartInner}>
          <View style={styles.proteinChartHeader}>
            <Text style={styles.proteinChartSubtitle}>
              {isTr ? `Hedef: ${proteinTarget}g / gün` : `Target: ${proteinTarget}g / day`}
            </Text>
            <View style={styles.proteinChartLegend}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>{isTr ? 'Hedefe ulaştı' : 'Met target'}</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.warning, marginLeft: 10 }]} />
              <Text style={styles.legendText}>{isTr ? 'Kısmen' : 'Partial'}</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.danger, marginLeft: 10 }]} />
              <Text style={styles.legendText}>{isTr ? 'Düşük' : 'Low'}</Text>
            </View>
          </View>

          {dailyProtein.map((day, i) => {
            const pct = Math.min(day.ratio, 1);
            const barColor = pct >= 1 ? colors.success : pct >= 0.6 ? colors.warning : colors.danger;
            const bgColor  = pct >= 1 ? colors.successBg : pct >= 0.6 ? colors.warningBg : colors.dangerBg;
            return (
              <View key={i} style={[styles.proteinDayRow, i < dailyProtein.length - 1 && styles.proteinDayBorder]}>
                <Text style={styles.proteinDayName}>{day.dayName}</Text>
                <View style={styles.proteinBarContainer}>
                  <View style={styles.proteinBarBg}>
                    <View style={[styles.proteinBarFill, {
                      width: day.hasData ? `${Math.round(pct * 100)}%` : '0%',
                      backgroundColor: barColor,
                    }]} />
                    {/* Target line marker */}
                    <View style={styles.proteinBarTargetLine} />
                  </View>
                </View>
                <View style={[styles.proteinGramsBadge, { backgroundColor: bgColor }]}>
                  <Text style={[styles.proteinGramsText, { color: barColor }]}>
                    {day.hasData ? `${day.grams}g` : '—'}
                  </Text>
                </View>
                <Text style={[styles.proteinPctLabel, { color: barColor }]}>
                  {day.hasData ? `${Math.round(pct * 100)}%` : ''}
                </Text>
              </View>
            );
          })}
        </Card>

        {/* ── Calorie Balance Table ── */}
        <SectionTitle
          title={isTr ? '⚖️ Günlük Kalori Dengesi' : '⚖️ Daily Calorie Balance'}
          style={styles.section}
        />
        <Card contentStyle={styles.chartInner}>
          <View style={styles.calBalanceHeaderRow}>
            <Text style={[styles.calBalanceCol, styles.calBalanceHeadCol]}>{isTr ? 'Gün' : 'Day'}</Text>
            <Text style={[styles.calBalanceCol, styles.calBalanceHeadCol]}>{isTr ? 'Yenen' : 'Eaten'}</Text>
            <Text style={[styles.calBalanceCol, styles.calBalanceHeadCol]}>BMR</Text>
            <Text style={[styles.calBalanceCol, styles.calBalanceHeadCol]}>{isTr ? 'Spor' : 'Exercise'}</Text>
            <Text style={[styles.calBalanceCol, styles.calBalanceHeadCol]}>{isTr ? 'Denge' : 'Balance'}</Text>
          </View>
          {dailyProtein.map((day, i) => {
            const bal = day.balance;
            const balColor = bal === null ? colors.outline : bal > 0 ? colors.danger : colors.success;
            return (
              <View key={i} style={[styles.calBalanceRow, i < dailyProtein.length - 1 && styles.proteinDayBorder]}>
                <Text style={styles.calBalanceCol}>{day.dayName}</Text>
                <Text style={styles.calBalanceCol}>{day.foodCal > 0 ? `${day.foodCal}` : '—'}</Text>
                <Text style={styles.calBalanceCol}>{day.bmr}</Text>
                <Text style={styles.calBalanceCol}>{day.exerciseCal > 0 ? `${day.exerciseCal}` : '—'}</Text>
                <Text style={[styles.calBalanceCol, { color: balColor, fontWeight: '800' }]}>
                  {bal === null ? '—' : bal > 0 ? `+${bal}` : `${bal}`}
                </Text>
              </View>
            );
          })}
          <View style={styles.calBalanceLegend}>
            <View style={styles.legendDot2} /><Text style={styles.legendText2}>{isTr ? 'Açık (iyi)' : 'Deficit (good)'}</Text>
            <View style={[styles.legendDot2, { backgroundColor: colors.danger, marginLeft: 12 }]} /><Text style={styles.legendText2}>{isTr ? 'Fazla (kötü)' : 'Surplus (bad)'}</Text>
          </View>
        </Card>

        {/* ── Protein Target ── */}
        <Card style={styles.proteinTargetCard} contentStyle={styles.gridCardInner} elevation="sm">
          <Text style={styles.proteinTargetTitle}>
            {isTr ? '💡 Günlük Protein Hedefi' : '💡 Daily Protein Target'}
          </Text>
          <Text style={styles.proteinTargetValue}>{proteinTarget}g</Text>
          <Text style={styles.proteinTargetNote}>
            {isTr
              ? 'Kas koruma ve fitness için önerilen miktar'
              : 'Recommended for muscle maintenance and fitness'}
          </Text>
        </Card>

        {/* ── AI Insight Cards (Recommendations) ── */}
        <SectionTitle
          title={`🤖 ${t('recommendations')}`}
          subtitle={isTr ? 'Verilerinize göre üretildi' : 'Generated from your data'}
          style={styles.section}
        />
        {recommendations.map((rec, i) => (
          <Card key={i} style={styles.insightCard} contentStyle={styles.insightInner} elevation="sm">
            <View style={styles.insightBullet}>
              <Text style={styles.insightBulletText}>{i + 1}</Text>
            </View>
            <Text style={styles.insightText}>{rec}</Text>
          </Card>
        ))}

        {/* ── Disclaimer ── */}
        <Text style={styles.disclaimer}>
          {isTr
            ? '📋 Kas riski tahminleri protein alımı ve kilo kaybı hızına dayanmaktadır. Gerçek sonuçlar kişiye göre değişebilir. Bu uygulama tıbbi tavsiye vermez.'
            : '📋 Muscle risk estimates are based on protein intake and weight loss rate. Actual results may vary. This app does not provide medical advice.'}
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: spacing.containerMargin, paddingTop: spacing.gutter },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header ──
  header: { marginBottom: spacing.gutter },
  screenTitle: { ...typography.headlineLg, color: colors.onSurface },
  weekRange: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },

  // ── Hero ──
  hero: { marginBottom: spacing.stackMd, alignItems: 'stretch' },
  heroTitle: {
    ...typography.labelMd,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: spacing.stackSm,
    textAlign: 'center',
  },
  heroValue: {
    ...typography.displayStat,
    color: colors.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.labelMd,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 2,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: spacing.stackMd,
  },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: {
    ...typography.headlineMd,
    fontSize: 20,
    color: colors.white,
  },
  heroStatLabel: {
    ...typography.labelSm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textAlign: 'center',
  },
  heroStatDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 2,
  },

  // ── Section spacing ──
  section: { marginTop: spacing.stackLg },

  // ── 2-col grid ──
  gridRow: { flexDirection: 'row', gap: spacing.gutter },
  gridCard: { flex: 1 },
  gridCardInner: { alignItems: 'center' },
  gridCardLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.stackSm,
    textAlign: 'center',
  },

  // ── Ring centered content ──
  ringValue: { ...typography.headlineMd, fontSize: 22 },
  ringSub: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 1 },

  // ── Muscle grade ──
  gradeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeLetter: { ...typography.displayStat, fontSize: 38, lineHeight: 44 },
  gradeBadge: { marginTop: spacing.stackSm, alignSelf: 'center' },

  // ── Honest-estimate captions ──
  estimateCaption: {
    ...typography.labelSm,
    fontSize: 10,
    lineHeight: 13,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  estimateCaptionWide: {
    ...typography.labelSm,
    fontSize: 11,
    lineHeight: 15,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.stackSm,
    paddingHorizontal: spacing.stackSm,
  },

  // ── Maintenance card ──
  maintenanceCard: { marginBottom: spacing.stackMd },
  maintenanceInner: {},
  maintenanceTitle: { ...typography.labelMd, fontWeight: '700', marginBottom: 4 },
  maintenanceMetric: { ...typography.headlineMd, fontSize: 18, marginBottom: 6 },
  maintenanceDesc: {
    ...typography.bodyMd,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  maintenanceEstimate: {
    ...typography.labelSm,
    fontSize: 10,
    lineHeight: 13,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 8,
  },

  // ── Alert card ──
  alertCard: { marginTop: spacing.stackMd },
  alertInner: {},
  alertTitle: { ...typography.labelMd, fontWeight: '700', marginBottom: 6 },
  alertDesc: { ...typography.bodyMd, fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant },

  // ── Body Comp Cards ──
  compCard: { flex: 1 },
  compIcon: { fontSize: 24, marginBottom: 6 },
  compValue: { ...typography.headlineMd, fontSize: 26 },
  compLabel: { ...typography.labelSm, fontWeight: '600', marginTop: 2 },
  compPct: { ...typography.labelSm, fontWeight: '700', marginTop: 2, opacity: 0.85 },

  // ── Total Progress Card ──
  totalInner: {},
  totalRow: { flexDirection: 'row', marginBottom: spacing.stackMd },
  totalItem: { flex: 1, alignItems: 'center' },
  totalValue: { ...typography.headlineMd, fontSize: 22, color: colors.onSurface },
  totalLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 2, textAlign: 'center' },
  totalDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant, marginHorizontal: spacing.stackSm },

  // ── Split bar ──
  splitBarContainer: { marginTop: spacing.xs },
  splitBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: spacing.stackSm,
  },
  splitBarFat: { backgroundColor: colors.success },
  splitBarMuscle: { backgroundColor: colors.warning },
  splitBarLegend: { flexDirection: 'row', gap: spacing.gutter },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.labelSm, color: colors.onSurfaceVariant },

  // ── Daily Protein Chart ──
  chartInner: {},
  proteinChartHeader: { marginBottom: spacing.stackMd },
  proteinChartSubtitle: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.stackSm,
  },
  proteinChartLegend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  proteinDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  proteinDayBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  proteinDayName: {
    width: 32,
    ...typography.labelSm,
    fontWeight: '700',
    color: colors.onSurface,
  },
  proteinBarContainer: { flex: 1 },
  proteinBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
    position: 'relative',
  },
  proteinBarFill: { height: '100%', borderRadius: 5 },
  proteinBarTargetLine: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  proteinGramsBadge: {
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  proteinGramsText: { ...typography.labelSm, fontWeight: '700' },
  proteinPctLabel: {
    width: 34,
    ...typography.labelSm,
    fontWeight: '600',
    textAlign: 'right',
  },

  // ── Protein Target Card ──
  proteinTargetCard: { backgroundColor: colors.infoBg, marginTop: spacing.stackMd },
  proteinTargetTitle: { ...typography.labelMd, color: colors.primaryDark, marginBottom: 6 },
  proteinTargetValue: {
    ...typography.displayStat,
    fontSize: 36,
    lineHeight: 42,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  proteinTargetNote: { ...typography.labelSm, color: colors.primaryLight, textAlign: 'center' },

  // ── Calorie Balance ──
  calBalanceHeaderRow: {
    flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant, marginBottom: 4,
  },
  calBalanceRow: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center',
  },
  calBalanceCol: {
    flex: 1, ...typography.labelSm, color: colors.onSurfaceVariant, fontWeight: '600', textAlign: 'center',
  },
  calBalanceHeadCol: { color: colors.onSurface, fontWeight: '700' },
  calBalanceLegend: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.stackSm, justifyContent: 'center',
  },
  legendDot2: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 4 },
  legendText2: { ...typography.labelSm, color: colors.onSurfaceVariant },

  // ── Disclaimer ──
  disclaimer: {
    ...typography.labelSm,
    color: colors.outline,
    lineHeight: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.stackMd,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.stackSm,
  },

  // ── AI Insight Cards ──
  insightCard: { marginTop: spacing.stackSm },
  insightInner: { flexDirection: 'row', alignItems: 'flex-start' },
  insightBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.stackSm,
  },
  insightBulletText: { ...typography.labelMd, color: colors.white, fontWeight: '700' },
  insightText: { ...typography.bodyMd, fontSize: 14, lineHeight: 20, color: colors.onSurface, flex: 1 },

  // ── Empty state ──
  emptyState: { alignItems: 'center' },
  emptyInner: { alignItems: 'center' },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.stackMd },
  emptyTitle: { ...typography.headlineMd, color: colors.onSurface, marginBottom: spacing.stackSm, textAlign: 'center' },
  emptyDesc: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 22, marginBottom: spacing.stackLg },
});
