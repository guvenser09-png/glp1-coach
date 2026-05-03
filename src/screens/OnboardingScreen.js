import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getUserProfile } from '../services/firestoreService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GOALS = [
  { key: 'preserve_muscle', emoji: '🏋️', en: 'Preserve Muscle Mass', tr: 'Kas Kütlemi Korumak' },
  { key: 'lose_weight', emoji: '⚖️', en: 'Lose Weight Safely', tr: 'Güvenli Kilo Vermek' },
  { key: 'body_composition', emoji: '💪', en: 'Improve Body Composition', tr: 'Vücut Kompozisyonumu İyileştirmek' },
  { key: 'prevent_regain', emoji: '🔄', en: 'Prevent Weight Regain', tr: 'Kilo Geri Alımını Önlemek' },
];

const GLP1_OPTIONS = [
  { key: 'currently_using',  en: 'Currently Using',    tr: 'Kullanıyorum' },
  { key: 'recently_stopped', en: 'Recently Stopped',   tr: 'Yeni Bıraktım' },
  { key: 'planning_to_stop', en: 'Planning to Stop',   tr: 'Bırakmayı Planlıyorum' },
  { key: 'not_using',        en: 'Not Using',          tr: 'Kullanmıyorum' },
];

export default function OnboardingScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isTr = language === 'tr';

  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [glp1Status, setGlp1Status] = useState(null);
  const [gender, setGender] = useState(null);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

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
        const onboardingData = {
          goals: selectedGoals,
          glp1Status,
          gender,
          completedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(
          `onboarding_${user.uid}`,
          JSON.stringify(onboardingData)
        );
        await AsyncStorage.setItem(`onboarding_complete_${user.uid}`, 'true');
      }
      // Navigate to main app
      navigation.replace('MainApp');
    } catch (e) {
      console.warn('OnboardingScreen: failed to save onboarding data', e);
      navigation.replace('MainApp');
    } finally {
      setSaving(false);
    }
  }

  const proteinTarget = profile ? Math.round((profile.weight || 70) * 1.6) : 112;

  // ── Step 0: Goal Selection ────────────────────────────────────────────────
  const renderStep0 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepNumber}>{isTr ? 'Adım 1 / 4' : 'Step 1 of 4'}</Text>
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

      <TouchableOpacity
        style={[styles.nextButton, selectedGoals.length === 0 && styles.nextButtonDisabled]}
        onPress={() => animateStep(1)}
        disabled={selectedGoals.length === 0}
        activeOpacity={0.85}
      >
        <Text style={styles.nextButtonText}>{isTr ? 'Devam Et' : 'Continue'}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Step 1: GLP-1 Status ──────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepNumber}>{isTr ? 'Adım 2 / 4' : 'Step 2 of 4'}</Text>
      <Text style={styles.stepTitle}>
        {isTr ? 'GLP-1 ilacı kullanıyor musunuz?' : 'Are you currently using GLP-1 medication?'}
      </Text>
      <Text style={styles.stepSubtitle}>
        {isTr ? 'Durumunuza en uygun seçeneği seçin' : 'Select the option that best describes you'}
      </Text>

      <View style={styles.glp1Options}>
        {GLP1_OPTIONS.map((option) => {
          const selected = glp1Status === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.glp1Pill, selected && styles.glp1PillSelected]}
              onPress={() => setGlp1Status(option.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.glp1PillText, selected && styles.glp1PillTextSelected]}>
                {isTr ? option.tr : option.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => animateStep(0)} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>{isTr ? 'Geri' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, { flex: 1, marginLeft: 12 }, !glp1Status && styles.nextButtonDisabled]}
          onPress={() => animateStep(2)}
          disabled={!glp1Status}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>{isTr ? 'Devam Et' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 2: Gender Selection ──────────────────────────────────────────────
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepNumber}>{isTr ? 'Adım 3 / 4' : 'Step 3 of 4'}</Text>
      <Text style={styles.stepTitle}>
        {isTr ? 'Cinsiyetiniz nedir?' : 'What is your gender?'}
      </Text>
      <Text style={styles.stepSubtitle}>
        {isTr
          ? 'Koçluk mesajlarını kişiselleştirmek için kullanılır'
          : 'Used to personalize your coaching messages'}
      </Text>

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
        onPress={() => { setGender('prefer_not_to_say'); animateStep(3); }}
        activeOpacity={0.7}
      >
        <Text style={styles.genderSkipText}>
          {isTr ? 'Belirtmek istemiyorum' : 'Prefer not to say'}
        </Text>
      </TouchableOpacity>

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => animateStep(1)} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>{isTr ? 'Geri' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, { flex: 1, marginLeft: 12 }, !gender && styles.nextButtonDisabled]}
          onPress={() => animateStep(3)}
          disabled={!gender}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>{isTr ? 'Devam Et' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 3: Plan Preview ──────────────────────────────────────────────────
  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepNumber}>{isTr ? 'Adım 4 / 4' : 'Step 4 of 4'}</Text>
      <Text style={styles.stepTitle}>
        {isTr ? 'Kişisel planınız hazır!' : 'Your personalized plan is ready!'}
      </Text>

      {/* Trial Badge */}
      <View style={styles.trialBadge}>
        <Text style={styles.trialBadgeText}>{t('trialBadge')}</Text>
      </View>

      {/* Plan Summary Card */}
      <View style={styles.planCard}>
        <View style={styles.planRow}>
          <Text style={styles.planLabel}>{isTr ? 'Günlük Protein Hedefi' : 'Daily Protein Target'}</Text>
          <Text style={styles.planValue}>{proteinTarget}g</Text>
        </View>
        <View style={styles.planDivider} />
        <View style={styles.planRow}>
          <Text style={styles.planLabel}>{isTr ? 'Aktivite Seviyesi' : 'Activity Level'}</Text>
          <Text style={styles.planValue}>{profile ? t(profile.activityLevel || 'moderatelyActive') : t('moderatelyActive')}</Text>
        </View>
        <View style={styles.planDivider} />
        <View style={styles.planRow}>
          <Text style={styles.planLabel}>{isTr ? 'Seçilen Hedefler' : 'Selected Goals'}</Text>
          <Text style={styles.planValue}>{selectedGoals.length}</Text>
        </View>
        <View style={styles.planDivider} />
        <View style={styles.planRow}>
          <Text style={styles.planLabel}>{isTr ? 'GLP-1 Durumu' : 'GLP-1 Status'}</Text>
          <Text style={styles.planValue}>
            {glp1Status
              ? GLP1_OPTIONS.find((o) => o.key === glp1Status)?.[isTr ? 'tr' : 'en'] || ''
              : '—'}
          </Text>
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
      </View>

      {/* Free Trial Highlight */}
      <View style={styles.freeTrialBox}>
        <Text style={styles.freeTrialEmoji}>🎁</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.freeTrialTitle}>{t('freeTrial')}</Text>
          <Text style={styles.freeTrialSub}>
            {isTr
              ? 'Tüm premium özelliklere 3 gün ücretsiz erişin'
              : 'Access all premium features free for 3 days'}
          </Text>
        </View>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => animateStep(2)} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>{isTr ? 'Geri' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, { flex: 1, marginLeft: 12 }, saving && styles.nextButtonDisabled]}
          onPress={handleFinish}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>
            {saving ? '...' : (isTr ? 'Ücretsiz Denemeyi Başlat' : 'Start Free Trial')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.progressSegment, i <= step && styles.progressSegmentActive]}
          />
        ))}
      </View>

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
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flexGrow: 1, padding: 24 },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  progressSegmentActive: {
    backgroundColor: '#4F46E5',
  },
  stepContainer: { paddingTop: 24 },
  stepNumber: { fontSize: 12, fontWeight: '600', color: '#4F46E5', marginBottom: 8, letterSpacing: 0.5 },
  stepTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8, lineHeight: 32 },
  stepSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 28 },

  // Goals
  goalsGrid: { gap: 12, marginBottom: 32 },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  goalCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  goalEmoji: { fontSize: 28, marginRight: 14 },
  goalText: { fontSize: 15, fontWeight: '600', color: '#374151', flex: 1, lineHeight: 22 },
  goalTextSelected: { color: '#4F46E5' },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Gender
  genderRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  genderCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  genderCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  genderEmoji: { fontSize: 48, marginBottom: 10 },
  genderLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  genderLabelSelected: { color: '#4F46E5' },
  genderSkip: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 28,
  },
  genderSkipText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // GLP-1 options
  glp1Options: { gap: 12, marginBottom: 40 },
  glp1Pill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  glp1PillSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
  },
  glp1PillText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  glp1PillTextSelected: { color: '#FFFFFF' },

  // Plan Preview
  trialBadge: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  trialBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  planLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500', flex: 1 },
  planValue: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'right', flex: 1 },
  planDivider: { height: 1, backgroundColor: '#F3F4F6' },
  freeTrialBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  freeTrialEmoji: { fontSize: 28 },
  freeTrialTitle: { fontSize: 15, fontWeight: '700', color: '#4338CA', marginBottom: 3 },
  freeTrialSub: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // Nav buttons
  navRow: { flexDirection: 'row', alignItems: 'center' },
  nextButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  backButton: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButtonText: { color: '#374151', fontWeight: '600', fontSize: 15 },
});
