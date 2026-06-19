import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnit } from '../context/UnitContext';
import { getUserProfile } from '../services/firestoreService';
import { saveMedicationProfile } from '../services/medicationService';
import { theme } from '../theme';
import { Card, GradientHero, PrimaryButton, SecondaryButton, Ring, Badge } from '../components/ui';

const { colors, fontFamily, spacing, radii, shadow } = theme;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GOALS = [
  { key: 'preserve_muscle', emoji: '🏋️', en: 'Preserve Muscle Mass', tr: 'Kas Kütlemi Korumak' },
  { key: 'lose_weight', emoji: '⚖️', en: 'Lose Weight Safely', tr: 'Güvenli Kilo Vermek' },
  { key: 'build_strength', emoji: '💪', en: 'Build Strength & Fitness', tr: 'Güç ve Fitness Geliştirmek' },
  { key: 'prevent_regain', emoji: '🔄', en: 'Prevent Weight Regain', tr: 'Kilo Geri Alımını Önlemek' },
];

// GLP-1 medication options (restored)
const GLP1_OPTIONS = [
  { key: 'Ozempic', emoji: '💉', label: 'Ozempic' },
  { key: 'Wegovy', emoji: '💊', label: 'Wegovy' },
  { key: 'Mounjaro', emoji: '🧬', label: 'Mounjaro' },
  { key: 'Other', emoji: '➕', en: 'Other', tr: 'Diğer' },
];

export default function OnboardingScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { unitSystem, setUnitSystem, parseWeightToKg, parseHeightToCm, weightUnit, heightUnit, weightRange, heightRange } = useUnit();
  const isTr = language === 'tr';

  const [step, setStep] = useState(0);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [gender, setGender] = useState(null);
  const [selectedGoals, setSelectedGoals] = useState([]);
  // ── GLP-1 medication state (restored) ──
  const [glp1Status, setGlp1Status] = useState(null);
  const [glp1Drug, setGlp1Drug] = useState(null);
  const [glp1Dose, setGlp1Dose] = useState('');
  const [injectionWeekday, setInjectionWeekday] = useState(null);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Auto-detect unit system from device locale
    try {
      const locales = getLocales();
      const region = locales[0]?.regionCode ?? '';
      const imperialRegions = ['US', 'LR', 'MM'];
      const detectedSystem = imperialRegions.includes(region) ? 'imperial' : 'metric';
      setUnitSystem(detectedSystem);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then((p) => setProfile(p)).catch(() => {});
    }
  }, [user]);

  function animateStep(nextStep) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
  }

  function toggleGoal(key) {
    setSelectedGoals((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
    );
  }

  async function handleFinish() {
    setSaving(true);
    try {
      if (user) {
        // Pass raw string to parseWeightToKg/parseHeightToCm — they handle comma→dot conversion
        const weightKg = weightInput.length > 0 ? parseWeightToKg(weightInput) : (profile?.weight || null);
        const heightCm = heightInput.length > 0 ? parseHeightToCm(heightInput) : (profile?.height || null);
        const proteinTargetVal = weightKg ? Math.round(weightKg * 1.6) : 120;

        // Save completion flag first so it's set even if profile save encounters an error
        await AsyncStorage.setItem(`onboarding_complete_${user.uid}`, 'true');
        await AsyncStorage.setItem(`onboarding_${user.uid}`, JSON.stringify({
          goals: selectedGoals, gender, completedAt: new Date().toISOString(),
        }));

        const { saveUserProfile, saveWeightLog } = require('../services/firestoreService');
        await saveUserProfile(user.uid, {
          name: user.displayName || '',
          weight: weightKg,
          height: heightCm,
          gender,
          goals: selectedGoals,
          proteinTarget: proteinTargetVal,
          exerciseDaysPerWeek: 3,
        });
        if (weightKg) await saveWeightLog(user.uid, weightKg).catch(() => {});

        // ── Save GLP-1 medication profile if the user selected a status (restored) ──
        if (glp1Status) {
          await saveMedicationProfile(user.uid, {
            status: glp1Status,
            drug: glp1Drug || 'Other',
            dose: glp1Dose.trim(),
            frequency: 'weekly',
            injectionWeekday: injectionWeekday == null ? 0 : injectionWeekday,
          }).catch(() => {});
        }
      }
      navigation.replace('MainApp');
    } catch (e) {
      console.warn('OnboardingScreen: failed to save onboarding data', e);
      // Ensure completion flag is saved even if other saves failed
      if (user) {
        await AsyncStorage.setItem(`onboarding_complete_${user.uid}`, 'true').catch(() => {});
      }
      navigation.replace('MainApp');
    } finally {
      setSaving(false);
    }
  }

  const w = parseFloat(weightInput.replace(',', '.'));
  const proteinTarget = (!isNaN(w) && w >= 30 && w <= 300)
    ? Math.round(w * 1.6)
    : profile ? Math.round((profile.weight || 70) * 1.6) : 112;

  // Step indices used for the progress dots (in display order)
  const STEP_ORDER = [0, 1, 2, 3, 4, 5];
  const currentIndex = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length;

  // ── Reusable progress dots ───────────────────────────────────────────────
  const renderProgressDots = () => (
    <View style={styles.progressBar}>
      {STEP_ORDER.map((s, idx) => (
        <View
          key={s}
          style={[
            styles.progressSegment,
            idx <= currentIndex && styles.progressSegmentActive,
          ]}
        />
      ))}
    </View>
  );

  const stepLabel = (n) =>
    isTr ? `Adım ${n} / ${totalSteps}` : `Step ${n} of ${totalSteps}`;

  // ── Step 0: Language, Units, Weight & Height ─────────────────────────────
  const renderStep0 = () => {
    const wRaw = parseFloat(weightInput.replace(',', '.'));
    const hRaw = parseFloat(heightInput.replace(',', '.'));
    const wValid = !isNaN(wRaw) && wRaw >= weightRange.min && wRaw <= weightRange.max;
    const hValid = !isNaN(hRaw) && hRaw >= heightRange.min && hRaw <= heightRange.max;
    const canContinue = (weightInput.length === 0 || wValid) && (heightInput.length === 0 || hValid);

    return (
      <View style={styles.stepContainer}>
        {/* Welcome hero */}
        <GradientHero style={{ marginBottom: spacing.stackLg }}>
          <Text style={styles.heroEmoji}>🛡️</Text>
          <Text style={styles.heroTitle}>
            {isTr ? "GLP-1 Coach'a hoş geldiniz" : 'Welcome to GLP-1 Coach'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isTr
              ? 'Protein hedefini koru, kasını sürdür, ilerlemeni takip et.'
              : 'Protect your protein, preserve your muscle, track your progress.'}
          </Text>
        </GradientHero>

        <Text style={styles.stepNumber}>{stepLabel(1)}</Text>
        <Text style={styles.stepTitle}>{isTr ? '🌍 Dil ve Ölçüler' : '🌍 Language & Metrics'}</Text>
        <Text style={styles.stepSubtitle}>
          {isTr ? 'Dilinizi seçin ve ölçülerinizi girin' : 'Choose your language and enter your measurements'}
        </Text>

        {/* Dil Seçimi */}
        <Text style={styles.measureLabel}>{isTr ? 'Dil' : 'Language'}</Text>
        <View style={styles.genderRow}>
          {[
            { key: 'en', flag: '🇺🇸', label: 'English' },
            { key: 'tr', flag: '🇹🇷', label: 'Türkçe' },
          ].map((opt) => {
            const selected = language === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.genderCard, selected && styles.genderCardSelected]}
                onPress={() => setLanguage(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.genderEmoji}>{opt.flag}</Text>
                <Text style={[styles.genderLabel, selected && styles.genderLabelSelected]}>{opt.label}</Text>
                {selected && <View style={styles.checkBadge}><Text style={styles.checkMark}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Ölçü Birimi */}
        <Text style={[styles.measureLabel, { marginTop: spacing.stackMd }]}>
          {isTr ? 'Ölçü Birimi' : 'Unit System'}
        </Text>
        <View style={styles.genderRow}>
          {[
            { key: 'metric',   flag: '📏', label: isTr ? 'Metrik (kg/cm)' : 'Metric (kg/cm)' },
            { key: 'imperial', flag: '🇺🇸', label: isTr ? 'İmperial (lbs/in)' : 'Imperial (lbs/in)' },
          ].map((opt) => {
            const selected = unitSystem === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.genderCard, selected && styles.genderCardSelected]}
                onPress={() => setUnitSystem(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.genderEmoji}>{opt.flag}</Text>
                <Text style={[styles.genderLabel, selected && styles.genderLabelSelected]}>{opt.label}</Text>
                {selected && <View style={styles.checkBadge}><Text style={styles.checkMark}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Kilo & Boy Girişi */}
        <Text style={[styles.measureLabel, { marginTop: spacing.stackMd }]}>
          {isTr ? 'Vücut Ölçüleriniz' : 'Your Measurements'}
        </Text>

        {/* Kilo */}
        <View style={styles.inputCard}>
          <View style={styles.inputCardLeft}>
            <Text style={styles.inputCardEmoji}>⚖️</Text>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.inputCardLabel}>{isTr ? 'Kilo' : 'Weight'}</Text>
                <Text style={styles.inputCardOptional}>{isTr ? '(İsteğe bağlı)' : '(Optional)'}</Text>
              </View>
              <Text style={styles.inputCardHint}>
                {unitSystem === 'imperial'
                  ? (isTr ? 'pound cinsinden' : 'in pounds')
                  : (isTr ? 'kilogram cinsinden' : 'in kilograms')}
              </Text>
            </View>
          </View>
          <View style={styles.inputCardRight}>
            <TextInput
              style={[
                styles.inputCardField,
                weightInput.length > 0 && !wValid && styles.inputCardFieldError,
              ]}
              placeholder={unitSystem === 'imperial' ? '170' : '75'}
              placeholderTextColor={colors.outline}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
              returnKeyType="next"
            />
            <Text style={styles.inputCardUnit}>{weightUnit}</Text>
          </View>
        </View>
        {weightInput.length > 0 && !wValid && (
          <Text style={styles.measureError}>
            {isTr
              ? `Lütfen ${weightRange.min}–${weightRange.max} ${weightUnit} arasında girin`
              : `Please enter ${weightRange.min}–${weightRange.max} ${weightUnit}`}
          </Text>
        )}

        {/* Boy */}
        <View style={[styles.inputCard, { marginTop: 10 }]}>
          <View style={styles.inputCardLeft}>
            <Text style={styles.inputCardEmoji}>📏</Text>
            <View>
              <Text style={styles.inputCardLabel}>{isTr ? 'Boy' : 'Height'}</Text>
              <Text style={styles.inputCardHint}>
                {unitSystem === 'imperial'
                  ? (isTr ? 'inç cinsinden' : 'in inches')
                  : (isTr ? 'santimetre cinsinden' : 'in centimeters')}
              </Text>
            </View>
          </View>
          <View style={styles.inputCardRight}>
            <TextInput
              style={[
                styles.inputCardField,
                heightInput.length > 0 && !hValid && styles.inputCardFieldError,
              ]}
              placeholder={unitSystem === 'imperial' ? '67' : '170'}
              placeholderTextColor={colors.outline}
              keyboardType="decimal-pad"
              value={heightInput}
              onChangeText={setHeightInput}
              returnKeyType="done"
            />
            <Text style={styles.inputCardUnit}>{heightUnit}</Text>
          </View>
        </View>
        {heightInput.length > 0 && !hValid && (
          <Text style={styles.measureError}>
            {isTr
              ? `Lütfen ${heightRange.min}–${heightRange.max} ${heightUnit} arasında girin`
              : `Please enter ${heightRange.min}–${heightRange.max} ${heightUnit}`}
          </Text>
        )}

        <PrimaryButton
          title={isTr ? 'Devam Et' : 'Continue'}
          onPress={() => animateStep(1)}
          disabled={!canContinue}
          style={{ marginTop: spacing.stackLg }}
        />
        <TouchableOpacity
          style={styles.skipLink}
          onPress={() => animateStep(1)}
          activeOpacity={0.7}
        >
          <Text style={styles.skipLinkText}>
            {isTr ? 'Şimdi atla, sonra gir' : 'Skip for now'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Step 1: Medical Disclaimer ───────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepNumber}>{stepLabel(2)}</Text>
      <Text style={styles.stepTitle}>
        {isTr ? '⚕️ Önemli Bilgilendirme' : '⚕️ Important Disclaimer'}
      </Text>

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerBody}>
          {isTr
            ? 'GLP-1 Coach, protein takibi ve fitness hedeflerinize ulaşmanıza yardımcı olmak amacıyla tasarlanmış bir yaşam tarzı destek uygulamasıdır.\n\nBu uygulama:\n• Tıbbi teşhis veya tedavi sunmaz\n• Doktor, diyetisyen veya sağlık uzmanının yerini tutamaz\n• Tıbbi tavsiye vermez\n\nBu uygulamayı kullanmadan önce ve beslenme veya egzersiz planınızda herhangi bir değişiklik yapmadan önce doktorunuza danışın.\n\nUygulama içindeki veriler tahmini değerler içerir. Bireysel sonuçlar farklılık gösterebilir.'
            : 'GLP-1 Coach is a lifestyle support app designed to help you track protein and reach your fitness goals.\n\nThis app:\n• Does not provide medical diagnosis or treatment\n• Is not a substitute for a doctor, dietitian, or healthcare professional\n• Does not provide medical advice\n\nThis app does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider before making changes to your diet or exercise regimen.\n\nData shown in the app includes estimates. Individual results may vary.'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setDisclaimerAccepted((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={[styles.checkbox, disclaimerAccepted && styles.checkboxChecked]}>
          {disclaimerAccepted && <Text style={styles.checkboxTick}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>
          {isTr
            ? 'Bu bilgilendirmeyi okudum ve anladım.'
            : 'I have read and understood this disclaimer.'}
        </Text>
      </TouchableOpacity>

      <PrimaryButton
        title={isTr ? 'Devam Et' : 'Continue'}
        onPress={() => animateStep(2)}
        disabled={!disclaimerAccepted}
      />
    </View>
  );

  // ── Step 2: Gender ──────────────────────────────────────────────────────
  const renderStep2 = () => {
    const canContinue = gender !== null;

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepNumber}>{stepLabel(3)}</Text>
        <Text style={styles.stepTitle}>
          {isTr ? 'Cinsiyetinizi seçin' : 'Select your gender'}
        </Text>
        <Text style={styles.stepSubtitle}>
          {isTr
            ? 'Günlük protein hedefinizi kişiselleştirmek için kullanılır'
            : 'Used to personalize your daily protein target'}
        </Text>

        <Text style={[styles.measureLabel, { marginTop: spacing.stackLg }]}>{isTr ? 'Cinsiyet' : 'Gender'}</Text>
        <View style={styles.genderRow}>
          {[
            { key: 'male',   emoji: '👨', tr: 'Erkek',  en: 'Male'   },
            { key: 'female', emoji: '👩', tr: 'Kadın',  en: 'Female' },
          ].map((opt) => {
            const selected = gender === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.genderCard, selected && styles.genderCardSelected]}
                onPress={() => setGender(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.genderEmoji}>{opt.emoji}</Text>
                <Text style={[styles.genderLabel, selected && styles.genderLabelSelected]}>
                  {isTr ? opt.tr : opt.en}
                </Text>
                {selected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.genderSkip}
          onPress={() => setGender('prefer_not_to_say')}
          activeOpacity={0.7}
        >
          <Text style={[styles.genderSkipText, gender === 'prefer_not_to_say' && styles.genderSkipTextActive]}>
            {isTr ? 'Belirtmek istemiyorum' : 'Prefer not to say'}
            {gender === 'prefer_not_to_say' ? ' ✓' : ''}
          </Text>
        </TouchableOpacity>

        <View style={styles.navRow}>
          <SecondaryButton
            title={isTr ? 'Geri' : 'Back'}
            variant="outline"
            onPress={() => animateStep(1)}
            fullWidth={false}
            style={styles.backBtn}
          />
          <PrimaryButton
            title={isTr ? 'Devam Et' : 'Continue'}
            onPress={() => animateStep(3)}
            disabled={!canContinue}
            style={styles.nextBtn}
          />
        </View>
      </View>
    );
  };

  // ── Step 3: Goal Selection ────────────────────────────────────────────────
  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepNumber}>{stepLabel(4)}</Text>
      <Text style={styles.stepTitle}>
        {isTr ? 'Ana hedefiniz nedir?' : "What's your main goal?"}
      </Text>
      <Text style={styles.stepSubtitle}>
        {isTr ? 'Birden fazla seçebilirsiniz' : 'You can select multiple'}
      </Text>

      <View style={styles.goalsGrid}>
        {GOALS.map((goal) => {
          const selected = selectedGoals.includes(goal.key);
          return (
            <TouchableOpacity
              key={goal.key}
              style={[styles.goalCard, selected && styles.goalCardSelected]}
              onPress={() => toggleGoal(goal.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.goalEmoji}>{goal.emoji}</Text>
              <Text style={[styles.goalText, selected && styles.goalTextSelected]}>
                {isTr ? goal.tr : goal.en}
              </Text>
              {selected && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.navRow}>
        <SecondaryButton
          title={isTr ? 'Geri' : 'Back'}
          variant="outline"
          onPress={() => animateStep(2)}
          fullWidth={false}
          style={styles.backBtn}
        />
        <PrimaryButton
          title={isTr ? 'Devam Et' : 'Continue'}
          onPress={() => animateStep(4)}
          disabled={selectedGoals.length === 0}
          style={styles.nextBtn}
        />
      </View>
    </View>
  );

  // ── Step 4: GLP-1 Medication (RESTORED) ──────────────────────────────────
  const renderStep4 = () => {
    const WEEKDAYS = isTr
      ? [
          { key: 0, label: 'Paz' }, { key: 1, label: 'Pzt' }, { key: 2, label: 'Sal' },
          { key: 3, label: 'Çar' }, { key: 4, label: 'Per' }, { key: 5, label: 'Cum' },
          { key: 6, label: 'Cmt' },
        ]
      : [
          { key: 0, label: 'Sun' }, { key: 1, label: 'Mon' }, { key: 2, label: 'Tue' },
          { key: 3, label: 'Wed' }, { key: 4, label: 'Thu' }, { key: 5, label: 'Fri' },
          { key: 6, label: 'Sat' },
        ];

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepNumber}>{stepLabel(5)}</Text>
        <Text style={styles.stepTitle}>
          {isTr ? '💉 GLP-1 Tedaviniz' : '💉 Your GLP-1 Treatment'}
        </Text>
        <Text style={styles.stepSubtitle}>
          {isTr
            ? 'İsterseniz enjeksiyon hatırlatıcısı için bilgilerinizi girin (isteğe bağlı)'
            : 'Optionally add details so we can remind you about injections (optional)'}
        </Text>

        {/* Status */}
        <Text style={styles.measureLabel}>{isTr ? 'Durum' : 'Status'}</Text>
        <View style={styles.glp1Options}>
          {['currentlyUsing', 'recentlyStopped', 'planningToStop'].map((key) => {
            const selected = glp1Status === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.statusPill, selected && styles.statusPillSelected]}
                onPress={() => setGlp1Status(selected ? null : key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.statusPillText, selected && styles.statusPillTextSelected]}>
                  {t(key)}
                </Text>
                {selected && <Text style={styles.statusPillCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Drug picker */}
        <Text style={[styles.measureLabel, { marginTop: spacing.stackMd }]}>
          {isTr ? 'İlaç' : 'Medication'}
        </Text>
        <View style={styles.drugGrid}>
          {GLP1_OPTIONS.map((opt) => {
            const selected = glp1Drug === opt.key;
            const label = opt.label || (isTr ? opt.tr : opt.en);
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.drugCard, selected && styles.drugCardSelected]}
                onPress={() => setGlp1Drug(selected ? null : opt.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.drugEmoji}>{opt.emoji}</Text>
                <Text style={[styles.drugLabel, selected && styles.drugLabelSelected]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dose */}
        <Text style={[styles.measureLabel, { marginTop: spacing.stackMd }]}>
          {isTr ? 'Doz' : 'Dose'}
        </Text>
        <View style={styles.inputCard}>
          <View style={styles.inputCardLeft}>
            <Text style={styles.inputCardEmoji}>🧪</Text>
            <View>
              <Text style={styles.inputCardLabel}>{isTr ? 'Doz miktarı' : 'Dose amount'}</Text>
              <Text style={styles.inputCardHint}>{isTr ? 'örn. 0.5 mg' : 'e.g. 0.5 mg'}</Text>
            </View>
          </View>
          <TextInput
            style={styles.doseField}
            placeholder={isTr ? '0.5 mg' : '0.5 mg'}
            placeholderTextColor={colors.outline}
            value={glp1Dose}
            onChangeText={setGlp1Dose}
            returnKeyType="done"
          />
        </View>

        {/* Injection weekday */}
        <Text style={[styles.measureLabel, { marginTop: spacing.stackMd }]}>
          {isTr ? 'Enjeksiyon Günü' : 'Injection Day'}
        </Text>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d) => {
            const selected = injectionWeekday === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                style={[styles.weekdayChip, selected && styles.weekdayChipSelected]}
                onPress={() => setInjectionWeekday(selected ? null : d.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.weekdayText, selected && styles.weekdayTextSelected]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.navRow, { marginTop: spacing.stackLg }]}>
          <SecondaryButton
            title={isTr ? 'Geri' : 'Back'}
            variant="outline"
            onPress={() => animateStep(3)}
            fullWidth={false}
            style={styles.backBtn}
          />
          <PrimaryButton
            title={isTr ? 'Devam Et' : 'Continue'}
            onPress={() => animateStep(5)}
            style={styles.nextBtn}
          />
        </View>
        <TouchableOpacity
          style={styles.skipLink}
          onPress={() => animateStep(5)}
          activeOpacity={0.7}
        >
          <Text style={styles.skipLinkText}>
            {isTr ? 'Şimdi atla' : 'Skip for now'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Step 5: Plan Preview / Protein Target Reveal ─────────────────────────
  const renderStep5 = () => {
    const wVal = parseFloat(weightInput.replace(',', '.'));
    const hVal = parseFloat(heightInput.replace(',', '.'));
    // Ring fill: visualize target relative to a 200g ceiling (purely decorative)
    const ringProgress = Math.max(0.15, Math.min(1, proteinTarget / 200));
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepNumber}>{stepLabel(6)}</Text>
        <Text style={styles.stepTitle}>
          {isTr ? 'Kişisel planınız hazır!' : 'Your personalized plan is ready!'}
        </Text>

        {/* Protein target reveal */}
        <Card style={{ alignItems: 'center', marginBottom: spacing.stackMd }}>
          <Ring progress={ringProgress} size={140} strokeWidth={14} color={colors.primary}>
            <Text style={styles.ringValue}>{proteinTarget}g</Text>
            <Text style={styles.ringLabel}>{isTr ? 'günlük protein' : 'daily protein'}</Text>
          </Ring>
          <Text style={styles.proteinCaption}>
            {isTr
              ? 'Hedefleriniz için önerilen günlük protein miktarınız'
              : 'Your recommended daily protein target'}
          </Text>
        </Card>

        <Card style={{ marginBottom: spacing.stackMd }} padding={16}>
          <View style={styles.planRow}>
            <Text style={styles.planLabel}>{isTr ? 'Kilo' : 'Weight'}</Text>
            <Text style={styles.planValue}>
              {!isNaN(wVal) && wVal > 0 ? `${wVal} ${weightUnit}` : '—'}
            </Text>
          </View>
          <View style={styles.planDivider} />
          <View style={styles.planRow}>
            <Text style={styles.planLabel}>{isTr ? 'Boy' : 'Height'}</Text>
            <Text style={styles.planValue}>
              {!isNaN(hVal) && hVal > 0 ? `${hVal} ${heightUnit}` : '—'}
            </Text>
          </View>
          <View style={styles.planDivider} />
          <View style={styles.planRow}>
            <Text style={styles.planLabel}>{isTr ? 'Günlük Protein Hedefi' : 'Daily Protein Target'}</Text>
            <Text style={styles.planValue}>{proteinTarget}g</Text>
          </View>
          <View style={styles.planDivider} />
          <View style={styles.planRow}>
            <Text style={styles.planLabel}>{isTr ? 'Seçilen Hedefler' : 'Selected Goals'}</Text>
            <Text style={styles.planValue}>{selectedGoals.length}</Text>
          </View>
          <View style={styles.planDivider} />
          <View style={styles.planRow}>
            <Text style={styles.planLabel}>{isTr ? 'Cinsiyet' : 'Gender'}</Text>
            <Text style={styles.planValue}>
              {gender === 'male'   ? (isTr ? '👨 Erkek'  : '👨 Male')
             : gender === 'female' ? (isTr ? '👩 Kadın'  : '👩 Female')
             : gender             ? (isTr ? 'Belirtilmedi' : 'Not specified')
             : '—'}
            </Text>
          </View>
          {glp1Status && (
            <>
              <View style={styles.planDivider} />
              <View style={styles.planRow}>
                <Text style={styles.planLabel}>GLP-1</Text>
                <Text style={styles.planValue}>
                  {(glp1Drug || (isTr ? 'Diğer' : 'Other'))}
                  {glp1Dose.trim() ? ` · ${glp1Dose.trim()}` : ''}
                </Text>
              </View>
            </>
          )}
        </Card>

        <View style={styles.navRow}>
          <SecondaryButton
            title={isTr ? 'Geri' : 'Back'}
            variant="outline"
            onPress={() => animateStep(4)}
            fullWidth={false}
            style={styles.backBtn}
          />
          <PrimaryButton
            title={isTr ? 'Başla' : 'Get Started'}
            onPress={handleFinish}
            loading={saving}
            disabled={saving}
            style={styles.nextBtn}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {renderProgressDots()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {step === 0 && renderStep0()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.lg },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 4,
    gap: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.outlineVariant,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  stepContainer: { paddingTop: spacing.stackLg },

  // Welcome hero
  heroEmoji: { fontSize: 40, marginBottom: spacing.sm },
  heroTitle: {
    fontFamily: fontFamily.headingExtraBold,
    fontSize: 26,
    fontWeight: '800',
    color: colors.onPrimary,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
  },

  stepNumber: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontFamily: fontFamily.headingBold,
    fontSize: 24,
    fontWeight: '800',
    color: colors.onSurface,
    marginBottom: spacing.sm,
    lineHeight: 32,
  },
  stepSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xl - 4,
  },

  disclaimerCard: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.lg,
    padding: spacing.gutter,
    marginBottom: spacing.stackLg - 4,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  disclaimerBody: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl - 4,
    gap: spacing.md - 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm - 2,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxTick: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },
  checkLabel: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },

  // Measurements
  measureLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  measureError: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    marginBottom: 2,
  },

  // Input card (kilo/boy/doz için kart tasarımı)
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.gutter,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    ...shadow('sm'),
  },
  inputCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    flex: 1,
  },
  inputCardEmoji: { fontSize: 28 },
  inputCardLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  inputCardOptional: { fontSize: 11, color: colors.outline, fontFamily: fontFamily.body },
  inputCardHint: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.outline,
    marginTop: 2,
  },
  inputCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputCardField: {
    backgroundColor: colors.background,
    borderRadius: radii.md - 2,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fontFamily.headingExtraBold,
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
    width: 80,
    textAlign: 'center',
  },
  inputCardFieldError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  inputCardUnit: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    minWidth: 24,
  },
  doseField: {
    backgroundColor: colors.background,
    borderRadius: radii.md - 2,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    width: 110,
    textAlign: 'center',
  },

  // Goals
  goalsGrid: { gap: spacing.md - 4, marginBottom: spacing.xl },
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    ...shadow('sm'),
  },
  goalCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.infoBg,
  },
  goalEmoji: { fontSize: 28, marginRight: 14 },
  goalText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    flex: 1,
    lineHeight: 22,
  },
  goalTextSelected: { color: colors.primary },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: colors.onPrimary, fontSize: 13, fontWeight: '700' },

  // Gender / language / unit cards
  genderRow: {
    flexDirection: 'row',
    gap: spacing.gutter,
    marginBottom: spacing.md - 4,
    marginTop: 4,
  },
  genderCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.cardPadding,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    ...shadow('sm'),
    position: 'relative',
  },
  genderCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.infoBg,
  },
  genderEmoji: { fontSize: 36, marginBottom: spacing.sm },
  genderLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  genderLabelSelected: { color: colors.primary },
  genderSkip: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: spacing.stackLg,
  },
  genderSkipText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.outline,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  genderSkipTextActive: { color: colors.primary, fontWeight: '700' },

  // GLP-1 status pills
  glp1Options: { gap: spacing.sm + 2 },
  statusPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.md + 2,
    paddingVertical: 16,
    paddingHorizontal: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    ...shadow('sm'),
  },
  statusPillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.infoBg,
  },
  statusPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  statusPillTextSelected: { color: colors.primary, fontFamily: fontFamily.bodyBold, fontWeight: '700' },
  statusPillCheck: { color: colors.primary, fontSize: 16, fontWeight: '800' },

  // Drug picker grid
  drugGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md - 4,
  },
  drugCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - (spacing.md - 4)) / 2,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.gutter,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    ...shadow('sm'),
  },
  drugCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.infoBg,
  },
  drugEmoji: { fontSize: 28, marginBottom: 6 },
  drugLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  drugLabelSelected: { color: colors.primary, fontWeight: '700' },

  // Weekday chips
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weekdayChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
  },
  weekdayChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekdayText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  weekdayTextSelected: { color: colors.onPrimary, fontWeight: '700' },

  // Protein target reveal
  ringValue: {
    fontFamily: fontFamily.headingExtraBold,
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
  },
  ringLabel: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  proteinCaption: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.md - 4,
    lineHeight: 18,
  },

  // Plan Preview
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  planLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    flex: 1,
  },
  planValue: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'right',
    flex: 1,
  },
  planDivider: { height: 1, backgroundColor: colors.outlineVariant },
  freeTrialBox: {
    backgroundColor: colors.infoBg,
    borderRadius: radii.md + 2,
    padding: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  freeTrialEmoji: { fontSize: 28 },
  freeTrialTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 3,
  },
  freeTrialSub: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },

  // Nav / links
  skipLink: { alignItems: 'center', paddingVertical: 10 },
  skipLinkText: { fontFamily: fontFamily.body, color: colors.outline, fontSize: 13 },
  navRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: spacing.md - 4 },
  nextBtn: { flex: 1 },
});
