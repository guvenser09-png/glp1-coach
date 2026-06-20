// WeightScreen — dedicated weight-tracking screen for GLP-1 Coach.
// Pushed from Home's hero ('Weight' route). Restyled to the approved Stitch
// design language: indigo gradient hero, clean white rounded cards, simple
// ring/bar progress, soft shadows, generous spacing.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Screen,
  Card,
  GradientHero,
  PrimaryButton,
  Ring,
  ProgressBar,
  SectionTitle,
  Badge,
} from '../components/ui';
import WeightChart from '../components/WeightChart';
import {
  fontFamily,
  radii,
  spacing,
  typography,
  useTheme,
} from '../theme';

// Fixed tints that read on the indigo hero gradient (which stays dark in both
// light & dark schemes), so they are intentionally scheme-independent.
const HERO_LOSS_TINT = '#A7F3D0'; // soft green
const HERO_GAIN_TINT = '#FECACA'; // soft red
const HERO_OVERLAY_STRONG = 'rgba(255,255,255,0.85)';
const HERO_OVERLAY_MED = 'rgba(255,255,255,0.8)';
const HERO_OVERLAY_SOFT = 'rgba(255,255,255,0.75)';
const HERO_TRACK = 'rgba(255,255,255,0.28)';
// Modal scrim — standard semi-transparent black dim, scheme-independent.
const MODAL_SCRIM = 'rgba(0,0,0,0.5)';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnit } from '../context/UnitContext';
import { useGamification } from '../context/GamificationContext';

import {
  getWeightLogs,
  saveWeightLog,
  getUserProfile,
  saveUserProfile,
} from '../services/firestoreService';
import {
  saveWeightKg,
  isHealthAvailable,
  getLatestWeightKg,
} from '../services/healthkitService';

export default function WeightScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isTr = language === 'tr';
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadow), [colors, shadow]);
  const {
    weightUnit,
    toDisplayWeight,
    parseWeightToKg,
    weightRange,
    weightPlaceholder,
    weightLabel,
  } = useUnit();
  const { completeMission, earnXP } = useGamification();

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]); // [{date, weight(kg)}], chronological asc
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [logs, prof] = await Promise.all([
        getWeightLogs(user.uid),
        getUserProfile(user.uid),
      ]);
      const normalized = (logs || [])
        .filter((l) => l && typeof l.weight === 'number' && l.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      setHistory(normalized);
      setProfile(prof || null);
    } catch {
      // Best-effort load — leave whatever we have.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived stats (all internal math in kg) ───────────────────────────────
  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const startKg = first.weight;
    const currentKg = last.weight;
    const changeKg = currentKg - startKg; // negative = loss

    // Days elapsed between first & last entry (avoid divide-by-zero).
    let perDayKg = 0;
    try {
      const d0 = new Date(first.date).getTime();
      const d1 = new Date(last.date).getTime();
      const days = Math.max(1, Math.round((d1 - d0) / 86400000));
      perDayKg = changeKg / days;
    } catch {
      perDayKg = 0;
    }

    return { startKg, currentKg, changeKg, perDayKg };
  }, [history]);

  // Goal weight — only if the profile defines one (goalWeight / targetWeight).
  const goalKg = useMemo(() => {
    const g = profile?.goalWeight ?? profile?.targetWeight ?? profile?.target;
    return typeof g === 'number' && g > 0 ? g : null;
  }, [profile]);

  // Progress toward goal: 0..1 of the journey from start → goal.
  const goalProgress = useMemo(() => {
    if (!stats || goalKg == null) return null;
    const total = stats.startKg - goalKg; // total to lose (can be negative for gain goals)
    if (Math.abs(total) < 0.0001) return 1;
    const done = stats.startKg - stats.currentKg;
    return Math.max(0, Math.min(1, done / total));
  }, [stats, goalKg]);

  // ── Formatting helpers ─────────────────────────────────────────────────────
  const fmt = (kg) => {
    if (kg == null || !Number.isFinite(kg)) return '—';
    const v = toDisplayWeight(kg);
    return `${Number.isInteger(v) ? v : v.toFixed(1)}`;
  };
  const fmtDelta = (kg) => {
    if (kg == null || !Number.isFinite(kg)) return '—';
    const v = toDisplayWeight(Math.abs(kg));
    const sign = kg > 0 ? '+' : kg < 0 ? '−' : '';
    const num = Number.isInteger(v) ? v : v.toFixed(1);
    return `${sign}${num}`;
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(isTr ? 'tr-TR' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Most-recent-first list with per-entry change vs the previous (older) entry.
  const historyRows = useMemo(() => {
    const asc = history;
    return asc
      .map((entry, i) => {
        const prev = i > 0 ? asc[i - 1] : null;
        const delta = prev ? entry.weight - prev.weight : null;
        return { ...entry, delta };
      })
      .slice()
      .reverse(); // newest first
  }, [history]);

  // ── Add-weight modal ───────────────────────────────────────────────────────
  const openModal = useCallback(async () => {
    setModalVisible(true);
    // Nicety: prefill from Apple Health if available and input is empty.
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const loggedToday = history.some((e) => e.date === todayDate);
      if (
        loggedToday ||
        weightInput ||
        typeof isHealthAvailable !== 'function' ||
        typeof getLatestWeightKg !== 'function'
      ) {
        return;
      }
      const available = await isHealthAvailable();
      if (!available) return;
      const latestKg = await getLatestWeightKg();
      if (latestKg == null || !Number.isFinite(Number(latestKg))) return;
      const display = toDisplayWeight(Number(latestKg));
      if (display == null) return;
      setWeightInput(String(display));
    } catch {
      // Prefill is best-effort — never block opening the modal.
    }
  }, [history, weightInput, toDisplayWeight]);

  const closeModal = () => {
    setModalVisible(false);
    setWeightInput('');
  };

  async function handleSave() {
    const wKg = parseWeightToKg(weightInput);
    const raw = parseFloat(weightInput.replace(',', '.'));
    if (!wKg || isNaN(raw) || raw < weightRange.min || raw > weightRange.max) {
      Alert.alert(
        isTr ? 'Geçersiz Kilo' : 'Invalid Weight',
        isTr
          ? `Lütfen ${weightRange.min}–${weightRange.max} ${weightUnit} arasında bir değer girin.`
          : `Please enter a value between ${weightRange.min}–${weightRange.max} ${weightUnit}.`
      );
      return;
    }
    setSaving(true);
    try {
      if (user) {
        await saveWeightLog(user.uid, wKg);

        // Update protein target from new weight unless the user set a custom one.
        const updatedProfile = { ...(profile || {}), weight: wKg };
        if (!profile?.proteinTargetCustom) {
          const perKg =
            typeof profile?.proteinPerKg === 'number' && profile.proteinPerKg > 0
              ? profile.proteinPerKg
              : 1.6;
          updatedProfile.proteinTarget = Math.round(wKg * perKg);
        }
        await saveUserProfile(user.uid, updatedProfile);
        setProfile(updatedProfile);
      }

      const todayDate = new Date().toISOString().split('T')[0];
      setHistory((prev) => {
        const updated = prev.filter((e) => e.date !== todayDate);
        return [...updated, { date: todayDate, weight: wKg }].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      });

      await completeMission('log_weight');
      await earnXP(10, '⚖️ Weight logged!');

      // Two-way Health sync — fully guarded, best-effort, never blocks save.
      try {
        if (typeof saveWeightKg === 'function') {
          await saveWeightKg(wKg);
        }
      } catch {
        // ignore Health write failures
      }

      closeModal();
    } catch {
      Alert.alert(
        isTr ? 'Hata' : 'Error',
        isTr
          ? 'Kilo kaydedilemedi. Lütfen tekrar deneyin.'
          : 'Failed to save weight. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const lossIsGood = stats && stats.changeKg <= 0;
  const changeTone = stats
    ? stats.changeKg < 0
      ? 'success'
      : stats.changeKg > 0
        ? 'danger'
        : 'neutral'
    : 'neutral';

  return (
    <Screen>
      {/* Back header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={isTr ? 'Geri' : 'Back'}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Text
            style={styles.backIcon}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            ‹
          </Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isTr ? 'Kilo Takibi' : 'Weight Tracking'}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={historyRows}
          keyExtractor={(row, i) => `${row.date}-${i}`}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
          {/* ── Hero: current weight + change + goal progress ── */}
          <GradientHero style={styles.hero} padding={spacing.stackLg}>
            <Text style={styles.heroLabel}>
              {isTr ? 'GÜNCEL KİLO' : 'CURRENT WEIGHT'}
            </Text>

            <View style={styles.heroRow}>
              <View style={styles.heroStatCol}>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>
                    {stats ? fmt(stats.currentKg) : '—'}
                  </Text>
                  <Text style={styles.heroUnit}>{weightUnit}</Text>
                </View>

                {stats ? (
                  <View style={styles.heroChangeRow}>
                    <Text
                      style={[
                        styles.heroChange,
                        { color: lossIsGood ? HERO_LOSS_TINT : HERO_GAIN_TINT },
                      ]}
                    >
                      {stats.changeKg < 0 ? '▼' : stats.changeKg > 0 ? '▲' : '•'}{' '}
                      {fmtDelta(stats.changeKg)} {weightUnit}
                    </Text>
                    <Text style={styles.heroChangeSub}>
                      {isTr ? 'başlangıçtan' : 'since start'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.heroChangeSub}>
                    {isTr
                      ? 'İlk kaydını ekle'
                      : 'Add your first entry'}
                  </Text>
                )}

                {stats && Math.abs(stats.perDayKg) > 0.0001 ? (
                  <Text style={styles.heroPerDay}>
                    {fmtDelta(stats.perDayKg)} {weightUnit}
                    {isTr ? ' / gün' : ' / day'}
                  </Text>
                ) : null}
              </View>

              {/* Goal ring (only when a goal weight exists) */}
              {goalKg != null && goalProgress != null ? (
                <Ring
                  progress={goalProgress}
                  size={104}
                  strokeWidth={11}
                  color={colors.white}
                  trackColor={HERO_TRACK}
                >
                  <Text style={styles.ringPct}>
                    {Math.round(goalProgress * 100)}%
                  </Text>
                  <Text style={styles.ringLabel}>
                    {isTr ? 'hedef' : 'goal'}
                  </Text>
                </Ring>
              ) : null}
            </View>

            {/* Goal progress bar with start/goal markers */}
            {goalKg != null && goalProgress != null ? (
              <View style={styles.heroGoalBlock}>
                <ProgressBar
                  progress={goalProgress}
                  height={8}
                  color={colors.white}
                  trackColor={HERO_TRACK}
                />
                <View style={styles.heroGoalMarks}>
                  <Text style={styles.heroGoalMark}>
                    {fmt(stats?.startKg)} {weightUnit}
                  </Text>
                  <Text style={styles.heroGoalMark}>
                    {isTr ? 'Hedef' : 'Goal'} {fmt(goalKg)} {weightUnit}
                  </Text>
                </View>
              </View>
            ) : null}
          </GradientHero>

          {/* ── Quick stat row ── */}
          {stats ? (
            <View style={styles.statRow}>
              <Card style={styles.statCard} padding={spacing.gutter} elevation="sm">
                <Text style={styles.statCardLabel}>
                  {isTr ? 'Başlangıç' : 'Start'}
                </Text>
                <Text style={styles.statCardValue}>
                  {fmt(stats.startKg)}
                  <Text style={styles.statCardUnit}> {weightUnit}</Text>
                </Text>
              </Card>

              <Card style={styles.statCard} padding={spacing.gutter} elevation="sm">
                <Text style={styles.statCardLabel}>
                  {isTr ? 'Değişim' : 'Change'}
                </Text>
                <Text
                  style={[
                    styles.statCardValue,
                    {
                      color:
                        changeTone === 'success'
                          ? colors.success
                          : changeTone === 'danger'
                            ? colors.danger
                            : colors.onSurface,
                    },
                  ]}
                >
                  {fmtDelta(stats.changeKg)}
                  <Text style={styles.statCardUnit}> {weightUnit}</Text>
                </Text>
              </Card>

              <Card style={styles.statCard} padding={spacing.gutter} elevation="sm">
                <Text style={styles.statCardLabel}>
                  {isTr ? 'Kayıt' : 'Entries'}
                </Text>
                <Text style={styles.statCardValue}>{history.length}</Text>
              </Card>
            </View>
          ) : null}

          {/* ── Chart ── */}
          <SectionTitle
            title={isTr ? 'Eğilim' : 'Trend'}
            subtitle={
              isTr ? 'Son kilo kayıtların' : 'Your recent weight history'
            }
            style={styles.section}
          />
          <View style={styles.chartCard}>
            <WeightChart
              data={history}
              height={200}
              weightUnit={weightUnit}
              language={language}
            />
          </View>

          {/* ── Add weight button ── */}
          <PrimaryButton
            title={isTr ? 'Kilo Ekle' : 'Log Weight'}
            onPress={openModal}
            icon={<Text style={styles.btnIcon} accessibilityElementsHidden importantForAccessibility="no">⚖️</Text>}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Kilo ekle' : 'Log weight'}
            accessibilityHint={
              isTr
                ? 'Yeni kilo kaydı eklemek için bir pencere açar'
                : 'Opens a dialog to add a new weight entry'
            }
          />

          {/* ── History list ── */}
          <SectionTitle
            title={isTr ? 'Geçmiş' : 'History'}
            style={styles.section}
          />
            </View>
          }
          renderItem={({ item: row, index: i }) => {
            const isLatest = i === 0;
            const delta = row.delta;
            const deltaDown = delta != null && delta < 0;
            const deltaUp = delta != null && delta > 0;
            const hasDelta = delta != null && Math.abs(delta) > 0.0001;
            // One readable summary per row for screen readers.
            const a11yRowLabel =
              `${formatDate(row.date)}${
                isLatest ? `, ${isTr ? 'en güncel' : 'latest'}` : ''
              }. ${fmt(row.weight)} ${weightUnit}.` +
              (hasDelta
                ? ` ${
                    deltaDown
                      ? isTr
                        ? 'önceki kayda göre düşüş'
                        : 'down from previous entry'
                      : isTr
                        ? 'önceki kayda göre artış'
                        : 'up from previous entry'
                  } ${fmtDelta(delta)} ${weightUnit}.`
                : '');
            return (
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={a11yRowLabel}
                style={[
                  styles.historyRow,
                  i === 0 && styles.historyRowFirst,
                  i === historyRows.length - 1 && styles.historyRowLast,
                  i < historyRows.length - 1 && styles.historyRowDivider,
                ]}
              >
                <View style={styles.historyLeft}>
                  <View
                    style={[styles.dateDot, isLatest && styles.dateDotActive]}
                  />
                  <View>
                    <Text style={styles.historyDate}>
                      {formatDate(row.date)}
                    </Text>
                    {isLatest ? (
                      <Text style={styles.historyLatest}>
                        {isTr ? 'En güncel' : 'Latest'}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.historyRight}>
                  <Text style={styles.historyWeight}>
                    {fmt(row.weight)}
                    <Text style={styles.historyWeightUnit}> {weightUnit}</Text>
                  </Text>
                  {hasDelta ? (
                    <Badge
                      tone={deltaDown ? 'success' : deltaUp ? 'danger' : 'neutral'}
                      label={`${deltaDown ? '▼' : '▲'} ${fmtDelta(delta)}`}
                      style={styles.deltaBadge}
                    />
                  ) : (
                    <Text style={styles.deltaFlat}>—</Text>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📉</Text>
              <Text style={styles.emptyTitle}>
                {isTr ? 'Henüz kayıt yok' : 'No entries yet'}
              </Text>
              <Text style={styles.emptyText}>
                {isTr
                  ? 'İlerlemeni takip etmek için ilk kilonu ekle.'
                  : 'Log your first weight to start tracking progress.'}
              </Text>
            </Card>
          }
          ListFooterComponent={<View style={{ height: spacing.stackLg }} />}
          style={styles.historyList}
        />
      )}

      {/* ── Add-weight modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {isTr ? 'Kilo Ekle' : 'Log Weight'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {isTr
                  ? `Bugünkü kilonu ${weightUnit} cinsinden gir.`
                  : `Enter today's weight in ${weightUnit}.`}
              </Text>

              <Text style={styles.modalInputLabel}>{weightLabel(isTr)}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={weightPlaceholder()}
                placeholderTextColor={colors.outline}
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
                autoFocus
                accessibilityLabel={weightLabel(isTr)}
                accessibilityHint={
                  isTr
                    ? `Geçerli aralık: ${weightRange.min} ile ${weightRange.max} ${weightUnit} arası`
                    : `Valid range: ${weightRange.min} to ${weightRange.max} ${weightUnit}`
                }
              />
              <Text style={styles.modalHint}>
                {isTr
                  ? `Geçerli aralık: ${weightRange.min}–${weightRange.max} ${weightUnit}`
                  : `Valid range: ${weightRange.min}–${weightRange.max} ${weightUnit}`}
              </Text>

              <View style={styles.modalButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    pressed && styles.cancelBtnPressed,
                  ]}
                  onPress={closeModal}
                  accessibilityRole="button"
                  accessibilityLabel={
                    t('cancel') === 'cancel' ? (isTr ? 'İptal' : 'Cancel') : t('cancel')
                  }
                >
                  <Text style={styles.cancelBtnText}>
                    {t('cancel') === 'cancel' ? (isTr ? 'İptal' : 'Cancel') : t('cancel')}
                  </Text>
                </Pressable>
                <PrimaryButton
                  style={styles.saveBtn}
                  title={t('save') === 'save' ? (isTr ? 'Kaydet' : 'Save') : t('save')}
                  loading={saving}
                  onPress={handleSave}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const makeStyles = (colors, shadow) =>
  StyleSheet.create({
  // Header
  header: {
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
    backgroundColor: colors.surface,
    ...shadow('sm'),
  },
  backBtnPressed: { opacity: 0.7 },
  backIcon: {
    fontFamily: fontFamily.headingBold,
    fontSize: 30,
    lineHeight: 32,
    color: colors.onSurface,
    marginTop: -2,
  },
  headerTitle: {
    ...typography.headlineMd,
    fontSize: 20,
    color: colors.onSurface,
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scrollContent: {
    paddingHorizontal: spacing.containerMargin,
    paddingTop: spacing.stackSm,
    paddingBottom: spacing.stackLg,
  },

  // Hero
  hero: { marginBottom: spacing.gutter },
  heroLabel: {
    ...typography.labelSm,
    color: HERO_OVERLAY_MED,
    letterSpacing: 1.2,
    marginBottom: spacing.stackSm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStatCol: { flexShrink: 1, paddingRight: spacing.stackSm },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroValue: {
    ...typography.displayStat,
    color: colors.white,
  },
  heroUnit: {
    ...typography.headlineMd,
    color: HERO_OVERLAY_STRONG,
    marginBottom: 8,
    marginLeft: 4,
  },
  heroChangeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  heroChange: {
    ...typography.bodyLg,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
  },
  heroChangeSub: {
    ...typography.bodyMd,
    color: HERO_OVERLAY_STRONG,
    marginLeft: 6,
  },
  heroPerDay: {
    ...typography.labelSm,
    color: HERO_OVERLAY_SOFT,
    marginTop: 4,
  },
  ringPct: {
    ...typography.headlineMd,
    fontSize: 22,
    color: colors.white,
  },
  ringLabel: {
    ...typography.labelSm,
    color: HERO_OVERLAY_STRONG,
  },
  heroGoalBlock: { marginTop: spacing.gutter },
  heroGoalMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.stackSm,
  },
  heroGoalMark: {
    ...typography.labelSm,
    color: HERO_OVERLAY_STRONG,
  },

  // Quick stats
  statRow: {
    flexDirection: 'row',
    marginBottom: spacing.gutter,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  statCardLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  statCardValue: {
    ...typography.headlineMd,
    fontSize: 22,
    color: colors.onSurface,
  },
  statCardUnit: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },

  // Sections
  section: { marginTop: spacing.stackSm },

  chartCard: { marginBottom: spacing.gutter },

  btnIcon: { fontSize: 18 },
  addBtn: { marginBottom: spacing.stackLg },

  // History
  emptyCard: { alignItems: 'center', paddingVertical: spacing.stackLg },
  emptyIcon: { fontSize: 40, marginBottom: spacing.stackSm },
  emptyTitle: {
    ...typography.headlineMd,
    fontSize: 18,
    color: colors.onSurface,
    marginBottom: 4,
  },
  emptyText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  historyCard: { overflow: 'hidden' },
  // FlatList card-like container: rounded surface block built from rows.
  historyList: { overflow: 'visible' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.cardPadding,
    backgroundColor: colors.surface,
  },
  historyRowFirst: {
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    ...shadow('sm'),
  },
  historyRowLast: {
    borderBottomLeftRadius: radii.card,
    borderBottomRightRadius: radii.card,
  },
  historyRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  dateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.outlineVariant,
    marginRight: spacing.gutter,
  },
  dateDotActive: { backgroundColor: colors.primary },
  historyDate: {
    ...typography.bodyMd,
    fontFamily: fontFamily.bodyMedium,
    color: colors.onSurface,
  },
  historyLatest: {
    ...typography.labelSm,
    color: colors.primary,
    marginTop: 1,
  },
  historyRight: { flexDirection: 'row', alignItems: 'center' },
  historyWeight: {
    ...typography.headlineMd,
    fontSize: 18,
    color: colors.onSurface,
    marginRight: spacing.stackSm,
  },
  historyWeightUnit: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  deltaBadge: { minWidth: 56, justifyContent: 'center' },
  deltaFlat: {
    ...typography.labelMd,
    color: colors.outline,
    minWidth: 56,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: MODAL_SCRIM,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.stackLg,
    paddingBottom: spacing.xl,
    ...shadow('lg'),
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    alignSelf: 'center',
    marginBottom: spacing.gutter,
  },
  modalTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: 4,
  },
  modalSubtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.stackLg,
  },
  modalInputLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.stackSm,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.gutter,
    paddingVertical: 14,
    fontFamily: fontFamily.headingBold,
    fontSize: 24,
    color: colors.onSurface,
  },
  modalHint: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: spacing.stackSm,
  },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.stackLg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.stackSm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    minHeight: 52,
  },
  cancelBtnPressed: { opacity: 0.7 },
  cancelBtnText: {
    ...typography.labelMd,
    fontSize: 16,
    color: colors.onSurfaceVariant,
  },
  saveBtn: { flex: 1, marginLeft: spacing.stackSm },
  });
