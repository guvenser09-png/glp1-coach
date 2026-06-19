// HealthLogScreen — Sağlık Günlüğü / Health Log (GLP-1 Coach design system).
// Two sections:
//   A) Body measurements (waist/arm/neck cm, chest/hip optional) with a save
//      action and a trend list (latest value + delta vs first reading).
//   B) Symptoms / side effects: quick-log chips + mild/moderate/severe selector,
//      a log action, and a recent-symptoms list with localized dates.
import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

import {
  saveMeasurement,
  getMeasurements,
  logSymptom,
  getSymptoms,
} from '../services/healthLogService';

import { colors, typography, spacing, radii } from '../theme';
import {
  Screen,
  Card,
  PrimaryButton,
  Chip,
  SectionTitle,
  Badge,
  ListRow,
} from '../components/ui';

// ─── Constants ──────────────────────────────────────────────────────────────

const todayIso = () => new Date().toISOString().split('T')[0];

// Sanitize a raw TextInput value to a numeric-only string (one decimal point).
const sanitizeCmInput = (raw) => {
  let s = String(raw).replace(',', '.').replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  return s;
};

const parseCm = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
};

// Measurement fields rendered in the form, in order.
const MEASUREMENT_FIELDS = [
  { key: 'waist', emoji: '📏', en: 'Waist', tr: 'Bel', optional: false },
  { key: 'arm', emoji: '💪', en: 'Arm', tr: 'Kol', optional: false },
  { key: 'neck', emoji: '🦒', en: 'Neck', tr: 'Boyun', optional: false },
  { key: 'chest', emoji: '🫁', en: 'Chest', tr: 'Göğüs', optional: true },
  { key: 'hip', emoji: '🍑', en: 'Hip', tr: 'Kalça', optional: true },
];

// Symptom / side-effect types with bilingual labels + emoji.
const SYMPTOM_TYPES = [
  { key: 'nausea', emoji: '🤢', en: 'Nausea', tr: 'Bulantı' },
  { key: 'fatigue', emoji: '😴', en: 'Fatigue', tr: 'Yorgunluk' },
  { key: 'constipation', emoji: '🚽', en: 'Constipation', tr: 'Kabızlık' },
  { key: 'headache', emoji: '🤕', en: 'Headache', tr: 'Baş ağrısı' },
  { key: 'appetite', emoji: '🍽️', en: 'Appetite', tr: 'İştah' },
  { key: 'other', emoji: '➕', en: 'Other', tr: 'Diğer' },
];

const SEVERITIES = [
  { value: 1, en: 'Mild', tr: 'Hafif', tone: 'success' },
  { value: 2, en: 'Moderate', tr: 'Orta', tone: 'warning' },
  { value: 3, en: 'Severe', tr: 'Şiddetli', tone: 'danger' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function HealthLogScreen({ navigation }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTr = language === 'tr';

  const [loading, setLoading] = useState(true);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [loggingSymptom, setLoggingSymptom] = useState(false);

  const [measurements, setMeasurements] = useState([]);
  const [symptoms, setSymptoms] = useState([]);

  // Measurement form (string-backed for TextInputs; '' means unset).
  const [fields, setFields] = useState({
    waist: '',
    arm: '',
    neck: '',
    chest: '',
    hip: '',
  });

  // Symptom composer
  const [symptomType, setSymptomType] = useState('nausea');
  const [severity, setSeverity] = useState(1);

  // ── Load on focus ──
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user) {
        setLoading(false);
        return;
      }
      (async () => {
        setLoading(true);
        try {
          const [m, s] = await Promise.all([
            getMeasurements(user.uid),
            getSymptoms(user.uid),
          ]);
          if (!active) return;
          setMeasurements(Array.isArray(m) ? m : []);
          setSymptoms(Array.isArray(s) ? s : []);
        } catch {
          // fail silently — show empty states
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [user])
  );

  const setField = (key, value) =>
    setFields((prev) => ({ ...prev, [key]: sanitizeCmInput(value) }));

  // ── Save measurement ──
  async function handleSaveMeasurement() {
    if (!user) return;
    const hasAny = MEASUREMENT_FIELDS.some((f) => parseCm(fields[f.key]) != null);
    if (!hasAny) {
      Alert.alert(
        isTr ? 'Ölçüm eksik' : 'No measurement',
        isTr
          ? 'Lütfen en az bir cm değeri girin.'
          : 'Please enter at least one cm value.'
      );
      return;
    }
    setSavingMeasurement(true);
    try {
      const payload = { date: todayIso() };
      MEASUREMENT_FIELDS.forEach((f) => {
        const cm = parseCm(fields[f.key]);
        if (cm != null) payload[f.key] = cm;
      });
      const updated = await saveMeasurement(user.uid, payload);
      setMeasurements(Array.isArray(updated) ? updated : []);
      setFields({ waist: '', arm: '', neck: '', chest: '', hip: '' });
      Alert.alert(
        isTr ? '✅ Ölçüm Kaydedildi' : '✅ Measurement Saved',
        isTr
          ? 'Vücut ölçümlerin güncellendi.'
          : 'Your body measurements have been updated.'
      );
    } catch {
      Alert.alert(
        isTr ? 'Hata' : 'Error',
        isTr ? 'Ölçüm kaydedilemedi.' : 'Could not save measurement.'
      );
    } finally {
      setSavingMeasurement(false);
    }
  }

  // ── Log symptom ──
  async function handleLogSymptom() {
    if (!user) return;
    setLoggingSymptom(true);
    try {
      const updated = await logSymptom(user.uid, {
        date: todayIso(),
        type: symptomType,
        severity,
      });
      setSymptoms(Array.isArray(updated) ? updated : []);
      Alert.alert(
        isTr ? '📝 Belirti Kaydedildi' : '📝 Symptom Logged',
        isTr
          ? 'Belirtin günlüğüne eklendi.'
          : 'Your symptom has been added to the log.'
      );
    } catch {
      Alert.alert(
        isTr ? 'Hata' : 'Error',
        isTr ? 'Belirti kaydedilemedi.' : 'Could not log symptom.'
      );
    } finally {
      setLoggingSymptom(false);
    }
  }

  // ── Derived: measurement trends per field (latest + delta vs first) ──
  const trends = MEASUREMENT_FIELDS.map((f) => {
    const series = measurements
      .filter((e) => parseCm(e?.[f.key]) != null)
      .map((e) => ({ date: e.date, value: parseCm(e[f.key]) }));
    if (series.length === 0) return { field: f, latest: null, first: null, delta: null, count: 0 };
    const first = series[0];
    const latest = series[series.length - 1];
    const delta = series.length > 1 ? latest.value - first.value : null;
    return { field: f, latest, first, delta, count: series.length };
  }).filter((t) => t.count > 0);

  // ── Date formatting ──
  const fmtDate = (d) => {
    try {
      return new Date(d).toLocaleDateString(isTr ? 'tr-TR' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  const symptomMeta = (key) =>
    SYMPTOM_TYPES.find((s) => s.key === key) || SYMPTOM_TYPES[SYMPTOM_TYPES.length - 1];
  const severityMeta = (value) =>
    SEVERITIES.find((s) => s.value === value) || SEVERITIES[0];

  // ── Header ──
  const renderHeader = () => (
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
      <Text style={styles.headerTitle}>
        {isTr ? 'Sağlık Günlüğü' : 'Health Log'}
      </Text>
      <View style={styles.backBtn} />
    </View>
  );

  if (loading) {
    return (
      <Screen edges={['top']}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {renderHeader()}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─────────────────── A) BODY MEASUREMENTS ─────────────────── */}
          <SectionTitle
            title={isTr ? '📐 Vücut Ölçüleri' : '📐 Body Measurements'}
            subtitle={
              isTr
                ? 'Tartı durduğunda santimleri takip et'
                : 'Track inches when the scale stalls'
            }
          />

          {/* Measurement form */}
          <Card contentStyle={styles.formInner}>
            {MEASUREMENT_FIELDS.map((f, i) => (
              <View
                key={f.key}
                style={[styles.fieldBlock, i > 0 && styles.fieldSpacing]}
              >
                <Text style={styles.fieldLabel}>
                  {f.emoji} {isTr ? f.tr : f.en}
                  {f.optional ? (
                    <Text style={styles.optionalTag}>
                      {isTr ? ' (isteğe bağlı)' : ' (optional)'}
                    </Text>
                  ) : null}
                </Text>
                <View style={styles.cmInputRow}>
                  <TextInput
                    value={fields[f.key]}
                    onChangeText={(t) => setField(f.key, t)}
                    placeholder={isTr ? 'örn. 92' : 'e.g. 92'}
                    placeholderTextColor={colors.outline}
                    style={[styles.input, styles.cmInput]}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                  <View style={styles.unitPill}>
                    <Text style={styles.unitPillText}>cm</Text>
                  </View>
                </View>
              </View>
            ))}

            <PrimaryButton
              title={isTr ? '💾 Ölçümü Kaydet' : '💾 Save Measurement'}
              onPress={handleSaveMeasurement}
              loading={savingMeasurement}
              style={styles.saveBtn}
            />
          </Card>

          {/* Measurement trends */}
          <SectionTitle
            title={isTr ? '📊 Eğilimler' : '📊 Trends'}
            style={styles.section}
          />
          {trends.length === 0 ? (
            <Card contentStyle={styles.emptyInner} elevation="sm">
              <Text style={styles.emptyEmoji}>📐</Text>
              <Text style={styles.emptyTitle}>
                {isTr ? 'Henüz ölçüm yok' : 'No measurements yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {isTr
                  ? 'İlk ölçümünü yukarıdan kaydet. Değişim eğilimlerin burada görünecek.'
                  : 'Save your first measurement above. Your change trends will appear here.'}
              </Text>
            </Card>
          ) : (
            <Card contentStyle={styles.trendsInner}>
              {trends.map((t, i) => {
                const isUp = t.delta != null && t.delta > 0;
                const isDown = t.delta != null && t.delta < 0;
                return (
                  <ListRow
                    key={t.field.key}
                    icon={<Text style={styles.rowEmoji}>{t.field.emoji}</Text>}
                    label={isTr ? t.field.tr : t.field.en}
                    subtitle={
                      isTr
                        ? `Güncel ${t.latest.value} cm · ${fmtDate(t.latest.date)}`
                        : `Now ${t.latest.value} cm · ${fmtDate(t.latest.date)}`
                    }
                    right={
                      t.delta == null ? (
                        <Badge
                          label={isTr ? 'İlk kayıt' : 'First entry'}
                          tone="neutral"
                        />
                      ) : (
                        <Text
                          style={[
                            styles.delta,
                            isDown && styles.deltaDown,
                            isUp && styles.deltaUp,
                          ]}
                        >
                          {t.delta === 0
                            ? '±0 cm'
                            : `${isDown ? '▼ ' : '▲ +'}${Math.abs(t.delta).toFixed(1)} cm`}
                        </Text>
                      )
                    }
                    divider={i < trends.length - 1}
                  />
                );
              })}
            </Card>
          )}

          {/* ─────────────────── B) SYMPTOMS / SIDE EFFECTS ─────────────────── */}
          <SectionTitle
            title={isTr ? '🩺 Belirtiler / Yan Etkiler' : '🩺 Symptoms / Side Effects'}
            subtitle={
              isTr
                ? 'Yan etkileri doz artışıyla ilişkilendir'
                : 'Correlate side effects with dose changes'
            }
            style={styles.section}
          />

          {/* Symptom composer */}
          <Card contentStyle={styles.formInner}>
            <Text style={styles.fieldLabel}>{isTr ? 'Belirti' : 'Symptom'}</Text>
            <View style={styles.chipWrap}>
              {SYMPTOM_TYPES.map((s) => (
                <Chip
                  key={s.key}
                  label={`${s.emoji} ${isTr ? s.tr : s.en}`}
                  selected={symptomType === s.key}
                  onPress={() => setSymptomType(s.key)}
                  style={styles.chip}
                />
              ))}
            </View>

            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
              {isTr ? 'Şiddet' : 'Severity'}
            </Text>
            <View style={styles.chipWrap}>
              {SEVERITIES.map((s) => (
                <Chip
                  key={s.value}
                  label={isTr ? s.tr : s.en}
                  selected={severity === s.value}
                  onPress={() => setSeverity(s.value)}
                  style={styles.chip}
                />
              ))}
            </View>

            <PrimaryButton
              title={isTr ? '📝 Belirtiyi Kaydet' : '📝 Log Symptom'}
              onPress={handleLogSymptom}
              loading={loggingSymptom}
              style={styles.saveBtn}
            />
          </Card>

          {/* Recent symptoms */}
          <SectionTitle
            title={isTr ? '📋 Son Belirtiler' : '📋 Recent Symptoms'}
            subtitle={
              symptoms.length > 0
                ? isTr
                  ? `${symptoms.length} kayıt`
                  : `${symptoms.length} entries`
                : undefined
            }
            style={styles.section}
          />
          {symptoms.length === 0 ? (
            <Card contentStyle={styles.emptyInner} elevation="sm">
              <Text style={styles.emptyEmoji}>🩺</Text>
              <Text style={styles.emptyTitle}>
                {isTr ? 'Henüz belirti yok' : 'No symptoms logged yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {isTr
                  ? 'Bir yan etki yaşadığında yukarıdan kaydet. Kayıtların burada görünecek.'
                  : 'Log a side effect above when you feel one. Your entries will appear here.'}
              </Text>
            </Card>
          ) : (
            <Card contentStyle={styles.historyInner}>
              {symptoms.map((entry, i) => {
                const meta = symptomMeta(entry.type);
                const sev = severityMeta(entry.severity);
                return (
                  <ListRow
                    key={`${entry.date}-${entry.type}-${i}`}
                    icon={<Text style={styles.rowEmoji}>{meta.emoji}</Text>}
                    label={isTr ? meta.tr : meta.en}
                    subtitle={fmtDate(entry.date)}
                    right={
                      <Badge
                        label={isTr ? sev.tr : sev.en}
                        tone={sev.tone}
                      />
                    }
                    divider={i < symptoms.length - 1}
                  />
                );
              })}
            </Card>
          )}

          {/* ── Disclaimer ── */}
          <Text style={styles.disclaimer}>
            {isTr
              ? '📋 Bu uygulama tıbbi tavsiye vermez. Belirtilerin sürerse veya kötüleşirse sağlık uzmanınıza danışın.'
              : '📋 This app does not provide medical advice. Consult your healthcare provider if symptoms persist or worsen.'}
          </Text>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.containerMargin, paddingTop: spacing.gutter },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header ──
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

  // ── Section ──
  section: { marginTop: spacing.stackLg },

  // ── Form ──
  formInner: {},
  fieldBlock: {},
  fieldLabel: {
    ...typography.labelMd,
    color: colors.onSurface,
    marginBottom: spacing.stackSm,
  },
  optionalTag: { ...typography.labelSm, color: colors.outline },
  fieldSpacing: { marginTop: spacing.stackMd },
  input: {
    ...typography.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.surfaceVariant,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: spacing.gutter,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  saveBtn: { marginTop: spacing.stackLg },

  // ── cm numeric input + unit ──
  cmInputRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.stackSm },
  cmInput: { flex: 1 },
  unitPill: {
    minWidth: 52,
    paddingHorizontal: spacing.gutter,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitPillText: { ...typography.labelMd, color: colors.primaryDark },

  // ── Chips ──
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.stackSm },
  chip: { marginBottom: 4 },

  // ── Trends / history rows ──
  trendsInner: {},
  historyInner: {},
  rowEmoji: { fontSize: 20 },
  delta: { ...typography.labelMd, color: colors.onSurfaceVariant },
  deltaDown: { color: colors.success },
  deltaUp: { color: colors.warning },

  // ── Empty ──
  emptyInner: { alignItems: 'center' },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.stackSm },
  emptyTitle: {
    ...typography.headlineMd,
    fontSize: 18,
    color: colors.onSurface,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    ...typography.bodyMd,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Disclaimer ──
  disclaimer: {
    ...typography.labelSm,
    color: colors.outline,
    lineHeight: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.stackLg,
    paddingHorizontal: spacing.stackSm,
  },
});
