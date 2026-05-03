import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSubscription } from '../context/SubscriptionContext';
import { getWeightLogs, getMealLogs, getUserProfile } from '../services/firestoreService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFatMuscleRatio(proteinRatio) {
  if (proteinRatio >= 1.0) return { fatPct: 95, musclePct: 5 };
  if (proteinRatio >= 0.8) return { fatPct: 80, musclePct: 20 };
  if (proteinRatio >= 0.6) return { fatPct: 65, musclePct: 35 };
  return { fatPct: 50, musclePct: 50 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyReportScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { checkAccess } = useSubscription();
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

  useEffect(() => {
    if (!checkAccess('weekly_report')) {
      navigation.navigate('Paywall', {
        featureKey: 'weekly_report',
        featureName: t('weeklyReport'),
      });
      return;
    }
    if (user) {
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
        if (raw) {
          const meals = JSON.parse(raw);
          const grams = meals.reduce((s, m) => s + (m.protein || 0), 0);
          totalRatio += target > 0 ? grams / target : 0;
          daysWithData++;
          dayRows.push({ dayName, grams, target, ratio: target > 0 ? grams / target : 0, hasData: true });
        } else {
          dayRows.push({ dayName, grams: 0, target, ratio: 0, hasData: false });
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

    // Muscle loss > 20% of total
    if (totalAbs > 0 && totalMuscleLost / totalAbs > 0.2) {
      recs.push(
        isTr
          ? `Günlük ${proteinTarget}g protein hedefinizi artırın — yüksek kas kaybı tespit edildi.`
          : `Increase daily protein to ${proteinTarget}g — high muscle loss detected.`
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasWeightData) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.screenTitle}>{t('weeklyReport')}</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>
              {isTr ? 'Henüz yeterli veri yok' : 'Not enough data yet'}
            </Text>
            <Text style={styles.emptyDesc}>
              {isTr
                ? 'Haftalık raporu görmek için en az 2 kilo girişi yapmanız gerekiyor. Dashboard\'dan kilonuzu kaydedin.'
                : 'You need at least 2 weight entries to see your weekly report. Log your weight from the Dashboard.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Text style={styles.emptyBtnText}>
                {isTr ? '📉 Kilo Kaydet' : '📉 Log Weight'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const weeklyChangeAbs = Math.abs(weeklyChange);
  const weeklyChangeColor =
    weeklyChange > 0 ? '#10B981' : weeklyChange < 0 ? '#EF4444' : '#6B7280';
  const weeklyChangePrefix = weeklyChange > 0 ? '−' : weeklyChange < 0 ? '+' : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Card: This Week ── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>
            {isTr ? '📉 Bu Hafta' : '📉 This Week'}
          </Text>
          <Text style={[styles.heroValue, { color: weeklyChangeColor }]}>
            {weeklyChangePrefix}{weeklyChangeAbs} kg
          </Text>
          <Text style={styles.heroSubtitle}>
            {weeklyChange > 0
              ? isTr ? 'Bu hafta kaybedildi' : 'Lost this week'
              : weeklyChange < 0
              ? isTr ? 'Bu hafta alındı' : 'Gained this week'
              : isTr ? 'Değişim yok' : 'No change this week'}
          </Text>
        </View>

        {/* ── Weekly Body Composition ── */}
        <Text style={styles.sectionTitle}>
          {isTr ? '🥩 Haftalık Vücut Kompozisyonu' : '🥩 Weekly Body Composition'}
        </Text>

        {/* Muscle alert when >= 30% */}
        {(() => {
          const { musclePct } = getFatMuscleRatio(avgProteinRatio);
          if (weeklyMuscleLost > 0 && musclePct >= 30) {
            return (
              <View style={[styles.muscleAlert, {
                backgroundColor: musclePct >= 50 ? '#FEF2F2' : '#FFFBEB',
                borderColor: musclePct >= 50 ? '#FCA5A5' : '#FDE68A',
              }]}>
                <Text style={[styles.muscleAlertTitle, { color: musclePct >= 50 ? '#DC2626' : '#D97706' }]}>
                  {musclePct >= 50 ? '🚨' : '⚠️'} {isTr
                    ? `Bu haftaki kaybın %${musclePct > 40 ? '40–50' : '25–35'}'i kas olabilir${musclePct >= 50 ? ' — Kritik Risk!' : '!'}`
                    : `${musclePct > 40 ? '40–50' : '25–35'}% of this week's loss may be muscle${musclePct >= 50 ? ' — Critical Risk!' : '!'}`}
                </Text>
                <Text style={styles.muscleAlertDesc}>
                  {isTr
                    ? `Metabolizmanız yavaşlayabilir ve kilo geri alım riski artabilir. Günlük ${proteinTarget}g protein + haftada 2–3 direnç egzersizi bu riski azaltabilir.`
                    : `Your metabolism may slow and rebound risk may increase. ${proteinTarget}g protein/day + 2–3 resistance sessions/week can reduce this risk.`}
                </Text>
              </View>
            );
          }
          return null;
        })()}

        <View style={styles.compRow}>
          <View style={[styles.compCard, { backgroundColor: '#ECFDF5' }]}>
            <Text style={styles.compIcon}>🟢</Text>
            <Text style={[styles.compValue, { color: '#065F46' }]}>{weeklyFatLost} kg</Text>
            <Text style={[styles.compLabel, { color: '#059669' }]}>
              {isTr ? 'Yağ Kaybı' : 'Fat Lost'}
            </Text>
            <Text style={[styles.compPct, { color: '#059669' }]}>
              %{getFatMuscleRatio(avgProteinRatio).fatPct}
            </Text>
          </View>
          <View style={[styles.compCard, {
            backgroundColor: getFatMuscleRatio(avgProteinRatio).musclePct >= 50 ? '#FEF2F2'
              : getFatMuscleRatio(avgProteinRatio).musclePct >= 30 ? '#FFF7ED' : '#F0FDF4',
          }]}>
            <Text style={styles.compIcon}>
              {getFatMuscleRatio(avgProteinRatio).musclePct >= 50 ? '🚨'
                : getFatMuscleRatio(avgProteinRatio).musclePct >= 30 ? '🟠' : '🟢'}
            </Text>
            <Text style={[styles.compValue, {
              color: getFatMuscleRatio(avgProteinRatio).musclePct >= 50 ? '#DC2626'
                : getFatMuscleRatio(avgProteinRatio).musclePct >= 30 ? '#92400E' : '#065F46',
              fontSize: 13, fontWeight: '700',
            }]}>
              {(() => {
                const mp = getFatMuscleRatio(avgProteinRatio).musclePct;
                return mp >= 50 ? (isTr ? 'Kritik' : 'Critical')
                  : mp >= 30 ? (isTr ? 'Yüksek' : 'High')
                  : (isTr ? 'Düşük' : 'Low');
              })()}
            </Text>
            <Text style={[styles.compLabel, {
              color: getFatMuscleRatio(avgProteinRatio).musclePct >= 50 ? '#EF4444'
                : getFatMuscleRatio(avgProteinRatio).musclePct >= 30 ? '#D97706' : '#059669',
            }]}>
              {isTr ? 'Kas Riski' : 'Muscle Risk'}
            </Text>
            <Text style={[styles.compPct, {
              color: getFatMuscleRatio(avgProteinRatio).musclePct >= 50 ? '#EF4444'
                : getFatMuscleRatio(avgProteinRatio).musclePct >= 30 ? '#D97706' : '#059669',
            }]}>
              %{(() => {
                const mp = getFatMuscleRatio(avgProteinRatio).musclePct;
                return mp >= 50 ? '40–50' : mp >= 30 ? '25–35' : '10–20';
              })()}
            </Text>
          </View>
        </View>

        {/* ── Total Progress Card ── */}
        <Text style={styles.sectionTitle}>
          {isTr ? '🏆 Başlangıçtan Bugüne' : '🏆 Total Progress Since Start'}
        </Text>
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>{Math.abs(totalLost)} kg</Text>
              <Text style={styles.totalLabel}>{isTr ? 'Toplam Kayıp' : 'Total Lost'}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: '#10B981' }]}>{totalFatLost} kg</Text>
              <Text style={styles.totalLabel}>{isTr ? 'Yağ Kaybı' : 'Fat Lost'}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, {
                color: getFatMuscleRatio(avgProteinRatio).musclePct >= 50 ? '#DC2626'
                  : getFatMuscleRatio(avgProteinRatio).musclePct >= 30 ? '#D97706' : '#10B981',
                fontSize: 14,
              }]}>
                {(() => {
                  const mp = getFatMuscleRatio(avgProteinRatio).musclePct;
                  return mp >= 50 ? (isTr ? 'Kritik' : 'Critical')
                    : mp >= 30 ? (isTr ? 'Yüksek' : 'High')
                    : (isTr ? 'Düşük' : 'Low');
                })()}
              </Text>
              <Text style={styles.totalLabel}>{isTr ? 'Kas Riski' : 'Muscle Risk'}</Text>
              <Text style={[styles.totalLabel, { fontSize: 10 }]}>
                ~%{(() => {
                  const mp = getFatMuscleRatio(avgProteinRatio).musclePct;
                  return mp >= 50 ? '40–50' : mp >= 30 ? '25–35' : '10–20';
                })()}
              </Text>
            </View>
          </View>

          {/* Progress bar: fat vs muscle */}
          {Math.abs(totalLost) > 0 && (
            <View style={styles.splitBarContainer}>
              <View style={styles.splitBar}>
                <View
                  style={[
                    styles.splitBarFat,
                    {
                      flex: getFatMuscleRatio(avgProteinRatio).fatPct,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.splitBarMuscle,
                    {
                      flex: getFatMuscleRatio(avgProteinRatio).musclePct,
                    },
                  ]}
                />
              </View>
              <View style={styles.splitBarLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>
                    {isTr ? 'Yağ' : 'Fat'} {getFatMuscleRatio(avgProteinRatio).fatPct}%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>
                    {isTr ? 'Kas' : 'Muscle'} {getFatMuscleRatio(avgProteinRatio).musclePct}%
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Daily Protein Chart ── */}
        <Text style={styles.sectionTitle}>
          {isTr ? '🥛 Günlük Protein Takibi' : '🥛 Daily Protein Tracker'}
        </Text>
        <View style={styles.proteinChartCard}>
          <View style={styles.proteinChartHeader}>
            <Text style={styles.proteinChartSubtitle}>
              {isTr ? `Hedef: ${proteinTarget}g / gün` : `Target: ${proteinTarget}g / day`}
            </Text>
            <View style={styles.proteinChartLegend}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>{isTr ? 'Hedefe ulaştı' : 'Met target'}</Text>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B', marginLeft: 10 }]} />
              <Text style={styles.legendText}>{isTr ? 'Kısmen' : 'Partial'}</Text>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444', marginLeft: 10 }]} />
              <Text style={styles.legendText}>{isTr ? 'Düşük' : 'Low'}</Text>
            </View>
          </View>

          {dailyProtein.map((day, i) => {
            const pct = Math.min(day.ratio, 1);
            const barColor = pct >= 1 ? '#10B981' : pct >= 0.6 ? '#F59E0B' : '#EF4444';
            const bgColor  = pct >= 1 ? '#ECFDF5' : pct >= 0.6 ? '#FFFBEB' : '#FEF2F2';
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
        </View>

        {/* ── Protein Target ── */}
        <View style={styles.proteinTargetCard}>
          <Text style={styles.proteinTargetTitle}>
            {isTr ? '💡 Günlük Protein Hedefi' : '💡 Daily Protein Target'}
          </Text>
          <Text style={styles.proteinTargetValue}>{proteinTarget}g</Text>
          <Text style={styles.proteinTargetNote}>
            {isTr
              ? 'Kas koruma ve yağ kaybı için önerilen miktar'
              : 'Recommended for muscle preservation and fat loss'}
          </Text>
        </View>

        {/* ── Recommendations ── */}
        <Text style={styles.sectionTitle}>{t('recommendations')}</Text>
        <View style={styles.recommendationsCard}>
          {recommendations.map((rec, i) => (
            <View
              key={i}
              style={[
                styles.recItem,
                i < recommendations.length - 1 && styles.recBorder,
              ]}
            >
              <Text style={styles.recBullet}>{i + 1}</Text>
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
        </View>

        {/* ── Disclaimer ── */}
        <Text style={styles.disclaimer}>
          {isTr
            ? '📋 Kas riski tahminleri protein alımı ve kilo kaybı hızına dayanmaktadır. Gerçek sonuçlar kişiye göre değişebilir. Bu uygulama tıbbi tavsiye vermez.'
            : '📋 Muscle risk estimates are based on protein intake and weight loss rate. Actual results may vary. This app does not provide medical advice.'}
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 24, paddingTop: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Hero ──
  heroCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    padding: 24,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  heroValue: {
    fontSize: 52,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // ── Section Title ──
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    marginBottom: 12,
  },

  // ── Muscle Alert ──
  muscleAlert: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 12,
  },
  muscleAlertTitle: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  muscleAlertDesc: { fontSize: 13, color: '#374151', lineHeight: 18 },

  // ── Body Comp Cards ──
  compRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  compCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  compIcon: { fontSize: 24, marginBottom: 6 },
  compValue: { fontSize: 28, fontWeight: '800' },
  compLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  compPct: { fontSize: 11, fontWeight: '700', marginTop: 2, opacity: 0.85 },

  // ── Total Progress Card ──
  totalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  totalRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  totalItem: { flex: 1, alignItems: 'center' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  totalLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  totalDivider: { width: 1, backgroundColor: '#F3F4F6', marginHorizontal: 8 },

  // ── Split bar ──
  splitBarContainer: { marginTop: 4 },
  splitBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  splitBarFat: { backgroundColor: '#10B981' },
  splitBarMuscle: { backgroundColor: '#F59E0B' },
  splitBarLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // ── Daily Protein Chart ──
  proteinChartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 4,
  },
  proteinChartHeader: {
    marginBottom: 14,
  },
  proteinChartSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  proteinChartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proteinDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  proteinDayBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  proteinDayName: {
    width: 32,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  proteinBarContainer: {
    flex: 1,
  },
  proteinBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    position: 'relative',
  },
  proteinBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  proteinBarTargetLine: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  proteinGramsBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  proteinGramsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  proteinPctLabel: {
    width: 34,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },

  // ── Protein Target Card ──
  proteinTargetCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  proteinTargetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3730A3',
    marginBottom: 6,
  },
  proteinTargetValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#4F46E5',
    marginBottom: 4,
  },
  proteinTargetNote: {
    fontSize: 12,
    color: '#6366F1',
    textAlign: 'center',
  },

  disclaimer: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 8,
  },

  // ── Recommendations ──
  recommendationsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  recItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  recBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
    flexShrink: 0,
  },
  recText: { fontSize: 14, color: '#374151', lineHeight: 20, flex: 1 },

  screenTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  emptyState: {
    alignItems: 'center', padding: 32,
    backgroundColor: '#FFF', borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 10, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
