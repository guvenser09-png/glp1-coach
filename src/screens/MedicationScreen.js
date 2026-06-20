// MedicationScreen — GLP-1 medication & dose tracking (GLP-1 Coach design system).
// Profile summary + next-injection countdown, editable profile form,
// "log dose taken today" action with dose history, and an injection-reminder toggle.
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
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
  getMedicationProfile,
  saveMedicationProfile,
  logDose,
  getDoseLogs,
  getDaysUntilNextInjection,
  getNextInjectionDate,
  recordDoseChange,
  getDoseChanges,
} from '../services/medicationService';
import {
  scheduleInjectionReminder,
  cancelInjectionReminders,
  requestNotificationPermission,
  isInjectionReminderScheduled,
  scheduleMissedDoseNudge,
  cancelMissedDoseNudge,
} from '../services/notificationService';

import { colors, semantic, typography, spacing, radii, fontFamily } from '../theme';
import {
  Screen,
  Card,
  GradientHero,
  PrimaryButton,
  SecondaryButton,
  Chip,
  SectionTitle,
  Badge,
  ListRow,
} from '../components/ui';

// ─── Dose helpers (titration) ─────────────────────────────────────────────────

// Parse a leading number from a string (numeric input or legacy '0.5 mg').
const parseMg = (v) => {
  if (v == null) return null;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isNaN(n) ? null : n;
};

// Sanitize a raw TextInput value to a numeric-only string (one decimal point).
const sanitizeMgInput = (raw) => {
  let s = String(raw).replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  return s;
};

const todayIso = () => new Date().toISOString().split('T')[0];

// ─── Reminder time helpers ─────────────────────────────────────────────────────

const MINUTE_STEPS = [0, 15, 30, 45];

const clampHour = (h) => {
  const n = Number(h);
  if (Number.isNaN(n)) return 9;
  return ((Math.round(n) % 24) + 24) % 24;
};

// Snap an arbitrary minute to the nearest allowed step (0/15/30/45).
const snapMinute = (m) => {
  const n = Number(m);
  if (Number.isNaN(n)) return 0;
  const mod = ((Math.round(n) % 60) + 60) % 60;
  let best = MINUTE_STEPS[0];
  let bestDist = Infinity;
  for (const step of MINUTE_STEPS) {
    const d = Math.abs(step - mod);
    if (d < bestDist) {
      bestDist = d;
      best = step;
    }
  }
  return best;
};

const pad2 = (n) => String(n).padStart(2, '0');

// Bilingual clock label (24h is unambiguous in both locales).
const formatTime = (h, m) => `${pad2(clampHour(h))}:${pad2(snapMinute(m))}`;

// ─── Static option data ──────────────────────────────────────────────────────

const DRUG_OPTIONS = ['Ozempic', 'Wegovy', 'Mounjaro', 'Other'];
const DRUG_EMOJI = { Ozempic: '💉', Wegovy: '💉', Mounjaro: '💉', Other: '🩹' };

const STATUS_OPTIONS = ['currentlyUsing', 'recentlyStopped', 'planningToStop'];

// Indexed by stored weekday (Sunday=0 .. Saturday=6).
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

// Monday-first display order (TR convention / matches DietPlans). Values are the
// stored 0-6 indices (Sunday=0); only the on-screen order changes.
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ─── Component ────────────────────────────────────────────────────────────────

export default function MedicationScreen({ navigation }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTr = language === 'tr';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);

  const [profile, setProfile] = useState(null);
  const [doseLogs, setDoseLogs] = useState([]);

  // Editable form state
  const [drug, setDrug] = useState('Other');
  // Numeric dose (string-backed for the TextInput; '' means unset).
  const [doseMgText, setDoseMgText] = useState('');
  const [injectionWeekday, setInjectionWeekday] = useState(0);
  const [status, setStatus] = useState('currentlyUsing');

  // Reminder toggle
  const [reminderOn, setReminderOn] = useState(false);
  // Flexible reminder time (JS-only picker; persisted on the profile).
  const [reminderHour, setReminderHour] = useState(9);
  const [reminderMinute, setReminderMinute] = useState(0);

  // ── Dose titration ──
  const [doseChanges, setDoseChanges] = useState([]);
  const [savingDoseChange, setSavingDoseChange] = useState(false);
  // Dose-change composer
  const [newDoseMgText, setNewDoseMgText] = useState('');
  const [newDoseDate, setNewDoseDate] = useState(todayIso());

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
          const [p, logs, reminderScheduled, changes] = await Promise.all([
            getMedicationProfile(user.uid),
            getDoseLogs(user.uid),
            isInjectionReminderScheduled(),
            typeof getDoseChanges === 'function'
              ? getDoseChanges(user.uid)
              : Promise.resolve([]),
          ]);
          if (!active) return;
          if (p) {
            setProfile(p);
            setDrug(p.drug ?? 'Other');
            const mg = p.doseMg != null ? p.doseMg : parseMg(p.dose);
            setDoseMgText(mg != null ? String(mg) : '');
            setInjectionWeekday(Number(p.injectionWeekday ?? 0));
            setStatus(p.status ?? 'currentlyUsing');
            setReminderHour(clampHour(p.reminderHour ?? 9));
            setReminderMinute(snapMinute(p.reminderMinute ?? 0));
          }
          setReminderOn(!!reminderScheduled);
          setDoseLogs(Array.isArray(logs) ? logs.slice().reverse() : []);
          setDoseChanges(Array.isArray(changes) ? changes : []);
        } catch {
          // fail silently — show empty/default form
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [user])
  );

  // Schedule the injection reminder + missed-dose nudge for a saved profile,
  // passing the chosen time. Both calls degrade gracefully if the service
  // build doesn't yet export the newer time-aware signatures.
  async function scheduleRemindersFor(savedProfile) {
    const opts = { hour: clampHour(reminderHour), minute: snapMinute(reminderMinute) };
    let ok = false;
    try {
      ok = await scheduleInjectionReminder(savedProfile, language, opts);
    } catch {
      ok = false;
    }
    if (typeof scheduleMissedDoseNudge === 'function') {
      try {
        await scheduleMissedDoseNudge(savedProfile, language, opts);
      } catch {
        // Best-effort: a missing/older nudge implementation must not block.
      }
    }
    return !!ok;
  }

  // ── Save profile ──
  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const mg = parseMg(doseMgText);
      const next = {
        ...(profile || {}),
        drug,
        doseMg: mg,
        doseUnit: 'mg',
        // Keep legacy display string in sync so older views still render.
        dose: mg != null ? `${mg} mg` : '',
        frequency: 'weekly',
        injectionWeekday: Number(injectionWeekday),
        status,
        reminderHour: clampHour(reminderHour),
        reminderMinute: snapMinute(reminderMinute),
      };
      const saved = await saveMedicationProfile(user.uid, next);
      setProfile(saved);

      // Keep any active reminder in sync with the new schedule/status/time.
      if (reminderOn) {
        if (saved.status === 'currentlyUsing') {
          await scheduleRemindersFor(saved);
        } else {
          await cancelInjectionReminders();
          if (typeof cancelMissedDoseNudge === 'function') {
            try {
              await cancelMissedDoseNudge();
            } catch {
              // ignore
            }
          }
          setReminderOn(false);
        }
      }

      Alert.alert(
        isTr ? 'Kaydedildi' : 'Saved',
        isTr ? 'İlaç bilgileriniz güncellendi.' : 'Your medication details have been updated.'
      );
    } catch {
      Alert.alert(
        isTr ? 'Hata' : 'Error',
        isTr ? 'Kaydedilemedi. Lütfen tekrar deneyin.' : 'Could not save. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Log dose taken today ──
  async function handleLogDose() {
    if (!user) return;
    setLogging(true);
    try {
      const mg = parseMg(doseMgText);
      const doseStr = mg != null ? `${mg} mg` : (profile?.dose || '').trim();
      await logDose(user.uid, { dose: doseStr });
      // Dose is in — don't nag the user with a missed-dose nudge.
      if (typeof cancelMissedDoseNudge === 'function') {
        try {
          await cancelMissedDoseNudge();
        } catch {
          // Best-effort; logging the dose still succeeded.
        }
      }
      const logs = await getDoseLogs(user.uid);
      setDoseLogs(Array.isArray(logs) ? logs.slice().reverse() : []);
      Alert.alert(
        isTr ? '✅ Doz Kaydedildi' : '✅ Dose Logged',
        isTr ? 'Bugünkü dozunuz kaydedildi.' : 'Today\'s dose has been recorded.'
      );
    } catch {
      Alert.alert(
        isTr ? 'Hata' : 'Error',
        isTr ? 'Doz kaydedilemedi.' : 'Could not log dose.'
      );
    } finally {
      setLogging(false);
    }
  }

  // ── Reminder toggle ──
  async function handleToggleReminder(value) {
    if (!user) return;
    if (value) {
      if (status !== 'currentlyUsing') {
        Alert.alert(
          isTr ? 'Hatırlatıcı kurulamadı' : 'Reminder not set',
          isTr
            ? 'Enjeksiyon hatırlatıcısı yalnızca ilacı aktif kullanırken ayarlanabilir.'
            : 'Injection reminders can only be set while you are currently using the medication.'
        );
        return;
      }
      try {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            isTr ? 'İzin gerekli' : 'Permission required',
            isTr
              ? 'Hatırlatıcılar için bildirim izni vermeniz gerekiyor.'
              : 'Please enable notifications to receive reminders.'
          );
          return;
        }
        // Persist current edits so the reminder uses the latest schedule.
        const mg = parseMg(doseMgText);
        const saved = await saveMedicationProfile(user.uid, {
          ...(profile || {}),
          drug,
          doseMg: mg,
          doseUnit: 'mg',
          dose: mg != null ? `${mg} mg` : '',
          frequency: 'weekly',
          injectionWeekday: Number(injectionWeekday),
          status,
          reminderHour: clampHour(reminderHour),
          reminderMinute: snapMinute(reminderMinute),
        });
        setProfile(saved);
        const ok = await scheduleRemindersFor(saved);
        setReminderOn(!!ok);
        if (!ok) {
          Alert.alert(
            isTr ? 'Hatırlatıcı kurulamadı' : 'Reminder not set',
            isTr ? 'Lütfen tekrar deneyin.' : 'Please try again.'
          );
        }
      } catch {
        setReminderOn(false);
      }
    } else {
      try {
        await cancelInjectionReminders();
        if (typeof cancelMissedDoseNudge === 'function') {
          try {
            await cancelMissedDoseNudge();
          } catch {
            // ignore
          }
        }
      } finally {
        setReminderOn(false);
      }
    }
  }

  // Apply a new reminder time. Updates local state and, if a reminder is
  // already active (and the user is currently using), re-schedules it + the
  // missed-dose nudge so the new time takes effect immediately.
  async function applyReminderTime(nextHour, nextMinute) {
    const h = clampHour(nextHour);
    const m = snapMinute(nextMinute);
    setReminderHour(h);
    setReminderMinute(m);
    if (!user || !reminderOn || status !== 'currentlyUsing') return;
    try {
      const mg = parseMg(doseMgText);
      const saved = await saveMedicationProfile(user.uid, {
        ...(profile || {}),
        drug,
        doseMg: mg,
        doseUnit: 'mg',
        dose: mg != null ? `${mg} mg` : '',
        frequency: 'weekly',
        injectionWeekday: Number(injectionWeekday),
        status,
        reminderHour: h,
        reminderMinute: m,
      });
      setProfile(saved);
      // Use the just-saved time directly (state update is async).
      const opts = { hour: h, minute: m };
      try {
        await scheduleInjectionReminder(saved, language, opts);
      } catch {
        // ignore — keep the toggle as-is
      }
      if (typeof scheduleMissedDoseNudge === 'function') {
        try {
          await scheduleMissedDoseNudge(saved, language, opts);
        } catch {
          // best-effort
        }
      }
    } catch {
      // Persisting/rescheduling failed silently; time is still updated in UI.
    }
  }

  const stepHour = (delta) => applyReminderTime(reminderHour + delta, reminderMinute);

  // ── Record a dose change (titration) ──
  async function handleRecordDoseChange() {
    if (!user) return;
    if (typeof recordDoseChange !== 'function') return;
    const mg = parseMg(newDoseMgText);
    if (mg == null || mg <= 0) {
      Alert.alert(
        isTr ? 'Geçersiz doz' : 'Invalid dose',
        isTr ? 'Lütfen geçerli bir mg değeri girin.' : 'Please enter a valid mg value.'
      );
      return;
    }
    const date = (newDoseDate || '').trim() || todayIso();
    // Validate the date (YYYY-MM-DD) so a malformed string never enters the timeline.
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime());
    if (!dateOk) {
      Alert.alert(
        isTr ? 'Geçersiz tarih' : 'Invalid date',
        isTr ? 'Lütfen YYYY-AA-GG biçiminde geçerli bir tarih girin.' : 'Please enter a valid date in YYYY-MM-DD format.'
      );
      return;
    }
    setSavingDoseChange(true);
    try {
      const updated = await recordDoseChange(user.uid, { doseMg: mg, date });
      setDoseChanges(Array.isArray(updated) ? updated : []);
      // Reflect the new current dose in the form + profile.
      setDoseMgText(String(mg));
      setProfile((prev) =>
        prev ? { ...prev, doseMg: mg, doseUnit: 'mg', dose: `${mg} mg` } : prev
      );
      setNewDoseMgText('');
      setNewDoseDate(todayIso());
      Alert.alert(
        isTr ? '📈 Doz Güncellendi' : '📈 Dose Updated',
        isTr
          ? `Yeni doz ${mg} mg olarak kaydedildi.`
          : `New dose recorded as ${mg} mg.`
      );
    } catch {
      Alert.alert(
        isTr ? 'Hata' : 'Error',
        isTr ? 'Doz değişikliği kaydedilemedi.' : 'Could not record dose change.'
      );
    } finally {
      setSavingDoseChange(false);
    }
  }

  // ── Derived display ──
  const currentMg = parseMg(doseMgText);
  const doseDisplay = currentMg != null ? `${currentMg} mg` : '';
  const draftProfile = {
    ...(profile || {}),
    drug,
    doseMg: currentMg,
    doseUnit: 'mg',
    dose: doseDisplay,
    frequency: 'weekly',
    injectionWeekday: Number(injectionWeekday),
    status,
  };

  // Titration timeline, newest first (service returns oldest->newest).
  const timeline = (Array.isArray(doseChanges) ? doseChanges : [])
    .filter((c) => c && parseMg(c.doseMg) != null)
    .slice()
    .reverse();
  const daysUntil = getDaysUntilNextInjection(draftProfile);
  const nextDate = getNextInjectionDate(draftProfile);

  const weekdayNames = isTr ? WEEKDAYS_TR : WEEKDAYS_EN;
  const weekdayLong = (idx) =>
    nextDate
      ? nextDate.toLocaleDateString(isTr ? 'tr-TR' : 'en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        })
      : weekdayNames[idx];

  const statusLabel = (s) => {
    if (s === 'currentlyUsing') return isTr ? 'Aktif Kullanıyorum' : 'Currently Using';
    if (s === 'recentlyStopped') return isTr ? 'Yakında Bıraktım' : 'Recently Stopped';
    return isTr ? 'Bırakmayı Planlıyorum' : 'Planning to Stop';
  };
  const statusTone = (s) =>
    s === 'currentlyUsing' ? 'success' : s === 'recentlyStopped' ? 'warning' : 'info';

  const countdownLabel = (() => {
    if (daysUntil == null) return isTr ? 'Belirsiz' : 'Not set';
    if (daysUntil === 0) return isTr ? 'Bugün' : 'Today';
    if (daysUntil === 1) return isTr ? 'Yarın' : 'Tomorrow';
    return isTr ? `${daysUntil} gün sonra` : `In ${daysUntil} days`;
  })();

  const fmtLogDate = (d) => {
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString(isTr ? 'tr-TR' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

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
      <Text style={styles.headerTitle}>{isTr ? 'İlaç Takibi' : 'Medication'}</Text>
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
          {/* ── Hero: next injection countdown ── */}
          <GradientHero style={styles.hero}>
            <Text style={styles.heroEyebrow}>
              {isTr ? '💉 Sıradaki Enjeksiyon' : '💉 Next Injection'}
            </Text>
            <Text style={styles.heroValue}>{countdownLabel}</Text>
            <Text style={styles.heroSubtitle}>
              {nextDate ? weekdayLong(Number(injectionWeekday)) : (isTr ? 'Enjeksiyon günü seçin' : 'Pick an injection day')}
            </Text>

            <View style={styles.heroDivider} />

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>
                  {DRUG_EMOJI[drug] || '💊'} {drug || (isTr ? 'Diğer' : 'Other')}
                </Text>
                <Text style={styles.heroStatLabel}>{isTr ? 'İlaç' : 'Medication'}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>
                  {doseDisplay ? doseDisplay : '—'}
                </Text>
                <Text style={styles.heroStatLabel}>{isTr ? 'Doz' : 'Dose'}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{isTr ? 'Haftalık' : 'Weekly'}</Text>
                <Text style={styles.heroStatLabel}>{isTr ? 'Sıklık' : 'Frequency'}</Text>
              </View>
            </View>
          </GradientHero>

          {/* ── Current status badge ── */}
          <View style={styles.statusRow}>
            <Badge
              label={`${status === 'currentlyUsing' ? '🟢' : status === 'recentlyStopped' ? '🟡' : '🔵'} ${statusLabel(status)}`}
              tone={statusTone(status)}
            />
          </View>

          {/* ── Medical-safety banner (Apple 1.4.1) — visible near dose/titration ── */}
          <View
            style={styles.safetyBanner}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={
              isTr
                ? 'Tıbbi uyarı: Bu uygulama tıbbi tavsiye değildir. Doktorunuza danışın. Dozunuzu asla uygulamaya bakarak değiştirmeyin.'
                : 'Medical warning: This app is not medical advice. Consult your doctor. Never change your dose based on the app.'
            }
          >
            <Text style={styles.safetyBannerIcon}>⚠️</Text>
            <Text style={styles.safetyBannerText}>
              {isTr
                ? 'Bu uygulama tıbbi tavsiye değildir. İlaç ve doz kararları için doktorunuza danışın — dozunuzu asla uygulamaya bakarak değiştirmeyin.'
                : 'This app is not medical advice. Consult your doctor for medication and dose decisions — never change your dose based on the app.'}
            </Text>
          </View>

          {/* ── Log dose action ── */}
          <Card style={styles.logCard} contentStyle={styles.logInner} elevation="sm">
            <View style={styles.logTextCol}>
              <Text style={styles.logTitle}>
                {isTr ? '🗓️ Bugün dozunu aldın mı?' : '🗓️ Took your dose today?'}
              </Text>
              <Text style={styles.logDesc}>
                {isTr
                  ? 'Tek dokunuşla bugünkü dozunu kaydet.'
                  : 'Log today\'s dose with one tap.'}
              </Text>
            </View>
            <PrimaryButton
              title={isTr ? '✅ Dozu Kaydet' : '✅ Log Dose'}
              onPress={handleLogDose}
              loading={logging}
              fullWidth={false}
              style={styles.logBtn}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Bugünkü dozu kaydet' : 'Log today\'s dose'}
            />

            {/* Quick shortcut: log side effects (nausea etc.) tied to the dose. */}
            <Pressable
              onPress={() => navigation?.navigate?.('HealthLog')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Yan Etki Kaydet' : 'Log Side Effect'}
              style={({ pressed }) => [styles.sideEffectLink, pressed && styles.pressed]}
            >
              <Text style={styles.sideEffectLinkText}>
                {isTr ? '🤢 Yan Etki Kaydet →' : '🤢 Log Side Effect →'}
              </Text>
            </Pressable>
          </Card>

          {/* ── Injection reminder toggle + time picker ── */}
          <Card contentStyle={styles.reminderInner}>
            <ListRow
              icon={<Text style={styles.rowEmoji}>🔔</Text>}
              label={isTr ? 'Enjeksiyon Hatırlatıcısı' : 'Injection Reminder'}
              subtitle={
                status === 'currentlyUsing'
                  ? isTr
                    ? `Her ${weekdayNames[Number(injectionWeekday)]} ${formatTime(reminderHour, reminderMinute)}`
                    : `Every ${weekdayNames[Number(injectionWeekday)]} at ${formatTime(reminderHour, reminderMinute)}`
                  : isTr
                  ? 'Yalnızca aktif kullanımda'
                  : 'Available while currently using'
              }
              toggle
              toggleValue={reminderOn}
              onToggle={handleToggleReminder}
            />

            {/* JS-only time selector (no native datetime dependency) */}
            <View style={styles.timeBlock}>
              <Text style={styles.timeBlockLabel}>
                {isTr ? '⏰ Hatırlatma Saati' : '⏰ Reminder Time'}
              </Text>

              <View style={styles.timeRow}>
                {/* Hour stepper */}
                <Text style={styles.timeFieldLabel}>{isTr ? 'Saat' : 'Hour'}</Text>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => stepHour(-1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={isTr ? 'Saati azalt' : 'Decrease hour'}
                    style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <View style={styles.stepValueBox}>
                    <Text style={styles.stepValueText}>{pad2(clampHour(reminderHour))}</Text>
                  </View>
                  <Pressable
                    onPress={() => stepHour(1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={isTr ? 'Saati artır' : 'Increase hour'}
                    style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>

              {/* Minute chips (0 / 15 / 30 / 45) */}
              <Text style={[styles.timeFieldLabel, styles.minuteLabel]}>
                {isTr ? 'Dakika' : 'Minute'}
              </Text>
              <View style={styles.chipWrap}>
                {MINUTE_STEPS.map((m) => (
                  <Chip
                    key={m}
                    label={pad2(m)}
                    selected={snapMinute(reminderMinute) === m}
                    onPress={() => applyReminderTime(reminderHour, m)}
                    style={styles.minuteChip}
                  />
                ))}
              </View>
            </View>
          </Card>

          {/* ── Editable profile form ── */}
          <SectionTitle
            title={isTr ? '⚙️ İlaç Bilgileri' : '⚙️ Medication Details'}
            style={styles.section}
          />
          <Card contentStyle={styles.formInner}>
            {/* Drug */}
            <Text style={styles.fieldLabel}>{isTr ? 'İlaç' : 'Medication'}</Text>
            <View style={styles.chipWrap}>
              {DRUG_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={`${DRUG_EMOJI[opt] || ''} ${opt === 'Other' ? (isTr ? 'Diğer' : 'Other') : opt}`}
                  selected={drug === opt}
                  onPress={() => setDrug(opt)}
                  style={styles.chip}
                />
              ))}
            </View>

            {/* Dose (numeric, mg) */}
            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
              {isTr ? 'Doz (mg)' : 'Dose (mg)'}
            </Text>
            <View style={styles.doseInputRow}>
              <TextInput
                value={doseMgText}
                onChangeText={(t) => setDoseMgText(sanitizeMgInput(t))}
                placeholder={isTr ? 'örn. 2.5' : 'e.g. 2.5'}
                placeholderTextColor={colors.outline}
                style={[styles.input, styles.doseInput]}
                keyboardType="decimal-pad"
                returnKeyType="done"
                accessibilityLabel={isTr ? 'Doz, miligram' : 'Dose in milligrams'}
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitPillText}>mg</Text>
              </View>
            </View>

            {/* Injection weekday */}
            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
              {isTr ? 'Enjeksiyon Günü' : 'Injection Day'}
            </Text>
            <View style={styles.chipWrap}>
              {WEEKDAY_DISPLAY_ORDER.map((idx) => (
                <Chip
                  key={idx}
                  label={weekdayNames[idx]}
                  selected={Number(injectionWeekday) === idx}
                  onPress={() => setInjectionWeekday(idx)}
                  style={styles.dayChip}
                />
              ))}
            </View>

            {/* Status */}
            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
              {isTr ? 'Durum' : 'Status'}
            </Text>
            <View style={styles.chipWrap}>
              {STATUS_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={statusLabel(opt)}
                  selected={status === opt}
                  onPress={() => setStatus(opt)}
                  style={styles.chip}
                />
              ))}
            </View>

            <PrimaryButton
              title={isTr ? '💾 Bilgileri Kaydet' : '💾 Save Details'}
              onPress={handleSaveProfile}
              loading={saving}
              style={styles.saveBtn}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'İlaç bilgilerini kaydet' : 'Save medication details'}
            />
          </Card>

          {/* ── Dose titration ── */}
          <SectionTitle
            title={isTr ? '📈 Doz Titrasyonu' : '📈 Dose Titration'}
            subtitle={
              isTr
                ? 'Doz artışlarını takip et'
                : 'Track your dose escalation'
            }
            style={styles.section}
          />

          {/* Dose-change composer */}
          <Card contentStyle={styles.composerInner}>
            <Text style={styles.composerTitle}>
              {isTr ? 'Yeni Doz Kaydet' : 'Record New Dose'}
            </Text>
            <Text style={styles.composerDesc}>
              {isTr
                ? 'Dozun değiştiğinde buraya ekle; titrasyon merdivenin aşağıda oluşur.'
                : 'Add a new dose when it changes; your titration ladder builds below.'}
            </Text>

            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
              {isTr ? 'Yeni Doz (mg)' : 'New Dose (mg)'}
            </Text>
            <View style={styles.doseInputRow}>
              <TextInput
                value={newDoseMgText}
                onChangeText={(t) => setNewDoseMgText(sanitizeMgInput(t))}
                placeholder={isTr ? 'örn. 5' : 'e.g. 5'}
                placeholderTextColor={colors.outline}
                style={[styles.input, styles.doseInput]}
                keyboardType="decimal-pad"
                returnKeyType="done"
                accessibilityLabel={isTr ? 'Yeni doz, miligram' : 'New dose in milligrams'}
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitPillText}>mg</Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
              {isTr ? 'Tarih' : 'Date'}
            </Text>
            <View style={styles.doseInputRow}>
              <TextInput
                value={newDoseDate}
                onChangeText={setNewDoseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.outline}
                style={[styles.input, styles.doseInput]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel={isTr ? 'Doz değişikliği tarihi, yıl ay gün' : 'Dose change date, year month day'}
              />
              <Pressable
                onPress={() => setNewDoseDate(todayIso())}
                hitSlop={6}
                style={({ pressed }) => [styles.todayPill, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Tarihi bugüne ayarla' : 'Set date to today'}
              >
                <Text style={styles.todayPillText}>{isTr ? 'Bugün' : 'Today'}</Text>
              </Pressable>
            </View>

            <PrimaryButton
              title={isTr ? '📈 Doz Artışını Kaydet' : '📈 Record Dose Change'}
              onPress={handleRecordDoseChange}
              loading={savingDoseChange}
              style={styles.saveBtn}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Doz değişikliğini kaydet' : 'Record dose change'}
            />
          </Card>

          {/* Titration timeline */}
          {timeline.length === 0 ? (
            <Card contentStyle={styles.emptyInner} elevation="sm">
              <Text style={styles.emptyEmoji}>📈</Text>
              <Text style={styles.emptyTitle}>
                {isTr ? 'Henüz doz değişikliği yok' : 'No dose changes yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {isTr
                  ? 'İlk dozunu yukarıya ekle. Sonraki artışlar burada bir merdiven olarak görünecek.'
                  : 'Add your first dose above. Future escalations will appear here as a ladder.'}
              </Text>
            </Card>
          ) : (
            <Card contentStyle={styles.timelineInner}>
              <FlatList
                data={timeline}
                scrollEnabled={false}
                keyExtractor={(entry, i) => `${entry.date}-${i}`}
                renderItem={({ item: entry, index: i }) => {
                  const mg = parseMg(entry.doseMg);
                  // Previous (chronologically earlier) entry, for the delta.
                  const prev = timeline[i + 1];
                  const prevMg = prev ? parseMg(prev.doseMg) : null;
                  const delta = prevMg != null ? mg - prevMg : null;
                  const isUp = delta != null && delta > 0;
                  const isDown = delta != null && delta < 0;
                  const isLatest = i === 0;
                  const isLast = i === timeline.length - 1;
                  return (
                    <View style={styles.timelineRow}>
                      {/* Rail + node */}
                      <View style={styles.timelineRail}>
                        <View
                          style={[
                            styles.timelineDot,
                            isLatest && styles.timelineDotLatest,
                          ]}
                        />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>

                      {/* Content */}
                      <View style={styles.timelineContent}>
                        <View style={styles.timelineTopLine}>
                          <Text style={styles.timelineDose}>
                            {prevMg != null ? `${prevMg} mg → ${mg} mg` : `${mg} mg`}
                          </Text>
                          {isLatest ? (
                            <Badge label={isTr ? 'Güncel' : 'Current'} tone="success" />
                          ) : null}
                        </View>
                        <View style={styles.timelineMetaRow}>
                          <Text style={styles.timelineDate}>{fmtLogDate(entry.date)}</Text>
                          {delta != null && delta !== 0 ? (
                            <Text
                              style={[
                                styles.timelineDelta,
                                isUp && styles.deltaUp,
                                isDown && styles.deltaDown,
                              ]}
                            >
                              {isUp ? '▲ +' : '▼ '}
                              {Math.abs(delta)} mg
                            </Text>
                          ) : prevMg == null ? (
                            <Text style={styles.timelineStart}>
                              {isTr ? 'Başlangıç' : 'Starting dose'}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            </Card>
          )}

          {/* ── Dose history ── */}
          <SectionTitle
            title={isTr ? '📋 Doz Geçmişi' : '📋 Dose History'}
            subtitle={
              doseLogs.length > 0
                ? isTr
                  ? `${doseLogs.length} kayıt`
                  : `${doseLogs.length} entries`
                : undefined
            }
            style={styles.section}
          />
          {doseLogs.length === 0 ? (
            <Card contentStyle={styles.emptyInner} elevation="sm">
              <Text style={styles.emptyEmoji}>💉</Text>
              <Text style={styles.emptyTitle}>
                {isTr ? 'Henüz doz kaydı yok' : 'No doses logged yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {isTr
                  ? 'Dozunu aldığında yukarıdaki butonla kaydet. Geçmişin burada görünecek.'
                  : 'Log a dose with the button above and your history will appear here.'}
              </Text>
            </Card>
          ) : (
            <Card contentStyle={styles.historyInner}>
              <FlatList
                data={doseLogs}
                scrollEnabled={false}
                keyExtractor={(log, i) => `${log.timestamp || log.date}-${i}`}
                renderItem={({ item: log, index: i }) => (
                  <ListRow
                    icon={<Text style={styles.rowEmoji}>💉</Text>}
                    label={fmtLogDate(log.date)}
                    subtitle={log.dose ? log.dose : isTr ? 'Doz belirtilmedi' : 'No dose noted'}
                    right={
                      i === 0 ? (
                        <Badge label={isTr ? 'Son' : 'Latest'} tone="success" />
                      ) : null
                    }
                    divider={i < doseLogs.length - 1}
                  />
                )}
              />
            </Card>
          )}

          {/* ── Disclaimer ── */}
          <Text style={styles.disclaimer}>
            {isTr
              ? '📋 Bu uygulama tıbbi tavsiye vermez. İlaç ve doz değişiklikleri için sağlık uzmanınıza danışın.'
              : '📋 This app does not provide medical advice. Consult your healthcare provider for any medication or dose changes.'}
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

  // ── Hero ──
  hero: { marginBottom: spacing.stackMd, alignItems: 'stretch' },
  heroEyebrow: {
    ...typography.labelMd,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: spacing.stackSm,
  },
  heroValue: { ...typography.displayStat, fontSize: 40, lineHeight: 46, color: colors.white, textAlign: 'center' },
  heroSubtitle: {
    ...typography.labelMd,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    marginTop: 4,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: spacing.stackMd,
  },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { ...typography.labelMd, fontWeight: '700', color: colors.white, textAlign: 'center' },
  heroStatLabel: { ...typography.labelSm, color: 'rgba(255,255,255,0.7)', marginTop: 2, textAlign: 'center' },
  heroStatDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 2,
  },

  // ── Status ──
  statusRow: { flexDirection: 'row', marginBottom: spacing.stackMd },

  // ── Medical-safety banner (Apple 1.4.1) ──
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.stackSm,
    backgroundColor: colors.warningBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warning,
    borderRadius: radii.md,
    padding: spacing.stackMd,
    marginBottom: spacing.stackMd,
  },
  safetyBannerIcon: { fontSize: 18, fontFamily: fontFamily.body, lineHeight: 20 },
  safetyBannerText: {
    flex: 1,
    ...typography.labelSm,
    color: colors.onSurface,
    lineHeight: 18,
  },

  // ── Log dose card ──
  logCard: { backgroundColor: colors.infoBg, marginBottom: spacing.stackMd },
  logInner: {},
  logTextCol: { marginBottom: spacing.stackMd },
  logTitle: { ...typography.labelMd, color: colors.primaryDark, marginBottom: 4 },
  logDesc: { ...typography.bodyMd, fontSize: 14, color: colors.onSurfaceVariant },
  logBtn: { alignSelf: 'flex-start' },
  sideEffectLink: {
    marginTop: spacing.stackMd,
    alignSelf: 'flex-start',
  },
  sideEffectLinkText: { ...typography.labelMd, color: colors.primaryDark },

  // ── Reminder ──
  reminderInner: {},
  rowEmoji: { fontSize: 20, fontFamily: fontFamily.body },
  timeBlock: {
    marginTop: spacing.stackMd,
    paddingTop: spacing.stackMd,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  timeBlockLabel: {
    ...typography.labelMd,
    color: colors.onSurface,
    marginBottom: spacing.stackSm,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeFieldLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  minuteLabel: { marginTop: spacing.stackMd, marginBottom: spacing.stackSm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { ...typography.headlineMd, color: colors.primaryDark, lineHeight: 26 },
  stepValueBox: {
    minWidth: 56,
    paddingHorizontal: spacing.stackSm,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueText: { ...typography.headlineMd, fontSize: 18, color: colors.onSurface },
  minuteChip: { marginBottom: 4, minWidth: 52, alignItems: 'center' },

  // ── Section ──
  section: { marginTop: spacing.stackLg },

  // ── Form ──
  formInner: {},
  fieldLabel: { ...typography.labelMd, color: colors.onSurface, marginBottom: spacing.stackSm },
  fieldSpacing: { marginTop: spacing.stackMd },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.stackSm },
  chip: { marginBottom: 4 },
  dayChip: { marginBottom: 4, minWidth: 52, alignItems: 'center' },
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

  // ── Dose numeric input + unit ──
  doseInputRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.stackSm },
  doseInput: { flex: 1 },
  unitPill: {
    minWidth: 52,
    paddingHorizontal: spacing.gutter,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitPillText: { ...typography.labelMd, color: colors.primaryDark },
  todayPill: {
    paddingHorizontal: spacing.gutter,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPillText: { ...typography.labelMd, color: colors.primaryDark },

  // ── Dose-change composer ──
  composerInner: {},
  composerTitle: { ...typography.labelMd, color: colors.onSurface, marginBottom: 4 },
  composerDesc: {
    ...typography.bodyMd,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },

  // ── Titration timeline ──
  timelineInner: {},
  timelineRow: { flexDirection: 'row' },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.outlineVariant,
    marginTop: 4,
  },
  timelineDotLatest: { backgroundColor: colors.primary },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.outlineVariant,
    marginTop: 2,
    marginBottom: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.stackMd,
    paddingBottom: spacing.stackMd,
  },
  timelineTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineDose: { ...typography.labelMd, fontSize: 15, color: colors.onSurface, flexShrink: 1 },
  timelineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timelineDate: { ...typography.labelSm, color: colors.onSurfaceVariant },
  timelineDelta: { ...typography.labelSm, color: colors.onSurfaceVariant },
  deltaUp: { color: colors.success },
  // A downward dose change is a neutral event, not a medical warning.
  deltaDown: { color: colors.onSurfaceVariant },
  timelineStart: { ...typography.labelSm, color: colors.outline, fontStyle: 'italic' },

  // ── History ──
  historyInner: {},

  // ── Empty ──
  emptyInner: { alignItems: 'center' },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.stackSm, fontFamily: fontFamily.body },
  emptyTitle: { ...typography.headlineMd, fontSize: 18, color: colors.onSurface, marginBottom: 6, textAlign: 'center' },
  emptyDesc: { ...typography.bodyMd, fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },

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
