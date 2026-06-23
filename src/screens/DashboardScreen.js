import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnit } from '../context/UnitContext';
import CoachMessage from '../components/CoachMessage';
import { useGamification } from '../context/GamificationContext';
import FeatureTour from '../components/FeatureTour';
import { sendCoachMessage } from '../services/coachChatService';
import AIConsentModal from '../components/AIConsentModal';
import { scheduleDailyMotivation, schedulePersonalizedNotifications } from '../services/notificationService';
import { Pedometer } from 'expo-sensors';

import {
  calculateMuscleScore,
  calculateReboundRisk,
  generateCoachMessage,
  detectRebound,
} from '../utils/heuristics';
import { assessMuscleProtection } from '../utils/muscle';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import {
  saveWeightLog,
  getWeightLogs,
  getUserProfile,
  saveUserProfile,
  getTodayMeals,
  getMealLogs,
} from '../services/firestoreService';
import {
  getMedicationProfile,
  getDaysUntilNextInjection,
  getNextInjectionDate,
} from '../services/medicationService';
import {
  isHealthAvailable,
  requestHealthPermissions,
  getTodayActiveEnergy,
  getLatestHeartRate,
  getRestingHeartRate,
  saveWeightKg,
  getLatestWeightKg,
} from '../services/healthkitService';

import { spacing, radii, typography, fontFamily, useTheme } from '../theme';
import {
  Card,
  GradientHero,
  PrimaryButton,
  ProgressBar,
  Ring,
  Badge,
} from '../components/ui';

const PROTEIN_TARGET = 120;
const EXERCISE_DAYS = 3;
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const PROTEIN_SUGGESTIONS = {
  en: [
    (g) => `${g}g left. Try: 150g chicken breast (35g) + Greek yogurt (20g).`,
    (g) => `${g}g more protein needed. Grab 2 eggs (14g) + 100g tuna (22g) + yogurt (10g).`,
    (g) => `Only ${g}g to go! A scoop of protein powder in milk gets you 25g instantly.`,
    (g) => `${g}g remaining. Try: cottage cheese (150g = 18g) + 3 slices turkey (15g).`,
    (g) => `${g}g left. 200g salmon for dinner = 40g protein — you'll crush your goal.`,
    (g) => `Need ${g}g more. Edamame (200g = 17g) + cheese (30g = 8g) + hard-boiled eggs (14g).`,
    (g) => `${g}g to go. A Greek yogurt bowl with almonds gives you ~25g protein fast.`,
  ],
  tr: [
    (g) => `${g}g kalmış. Deneyin: 150g tavuk göğsü (35g) + Yunan yoğurdu (20g).`,
    (g) => `${g}g daha protein lazım. 2 yumurta (14g) + 100g ton balığı (22g) + yoğurt (10g).`,
    (g) => `Sadece ${g}g kaldı! Sütte protein tozu ile anında 25g protein alın.`,
    (g) => `${g}g kalmış. Lor peyniri (150g = 18g) + 3 dilim hindi (15g) deneyin.`,
    (g) => `${g}g kaldı. Akşam 200g somon = 40g protein — hedefinizi geçersiniz.`,
    (g) => `${g}g daha lazım. Edamame (200g = 17g) + peynir (30g = 8g) + haşlanmış yumurta (14g).`,
    (g) => `${g}g kaldı. Bademli Yunan yoğurdu kasesi hızlıca ~25g protein sağlar.`,
  ],
};

function getRotatingSuggestion(remainingProtein, language) {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const idx = (hour + day * 3) % PROTEIN_SUGGESTIONS.en.length;
  const suggestions = PROTEIN_SUGGESTIONS[language] || PROTEIN_SUGGESTIONS.en;
  return suggestions[idx](remainingProtein);
}

// ─── helpers ────────────────────────────────────────────────────────────────

// NOTE (audit #10): the old getFatMuscleRatio() turned a protein ratio into a
// fabricated fat-vs-muscle split (and precise kg-of-muscle-lost / "muscle risk
// %" figures). The app cannot measure body composition, so those numbers were
// not clinically valid. Muscle-protection messaging now lives in
// utils/muscle.js (assessMuscleProtection), which returns a qualitative trend
// with no invented percentages or kg.

function getGreeting(language) {
  const hour = new Date().getHours();
  const isTr = language === 'tr';
  if (hour < 12) return isTr ? 'Günaydın' : 'Good morning';
  if (hour < 18) return isTr ? 'İyi günler' : 'Good afternoon';
  return isTr ? 'İyi akşamlar' : 'Good evening';
}

function getMuscleScoreLabel(score, language, colors) {
  const isTr = language === 'tr';
  if (score >= 85) {
    return {
      emoji: '💪',
      label: isTr ? 'Mükemmel Koruma' : 'Excellent Protection',
      desc: isTr
        ? 'Protein alımınız kaslarınızı çok iyi koruyor.'
        : 'Your protein intake is protecting your muscles well.',
      color: colors.success,
    };
  }
  if (score >= 65) {
    return {
      emoji: '✅',
      label: isTr ? 'İyi Koruma' : 'Good Protection',
      desc: isTr
        ? 'Daha iyi sonuçlar için proteini biraz artırın.'
        : 'Slightly increase protein for better results.',
      color: colors.primary,
    };
  }
  if (score >= 40) {
    return {
      emoji: '⚠️',
      label: isTr ? 'Orta Risk' : 'Moderate Risk',
      desc: isTr
        ? 'Protein alımı optimal değil. Günlük hedefe ulaşmaya çalışın.'
        : 'Protein intake is below optimal. Try to reach your daily target.',
      color: colors.warning,
    };
  }
  return {
    emoji: '🚨',
    label: isTr ? 'Yüksek Risk' : 'High Risk',
    desc: isTr
      ? 'Çok düşük protein alımı. Kas koruma için bugün proteine öncelik verin.'
      : 'Very low protein intake. Prioritize protein today for muscle maintenance.',
    color: colors.danger,
  };
}

function getReboundRiskContent(level, language, colors) {
  const isTr = language === 'tr';
  if (level === 'Low') {
    return {
      emoji: '🟢',
      label: isTr ? 'Yüksek Sürdürülebilirlik Skoru' : 'High Sustainability Score',
      desc: isTr
        ? 'Alışkanlıklarınız ilerlemenizi korumaya yardımcı oluyor. Devam edin!'
        : 'Your habits are helping sustain your progress. Keep it up!',
      color: colors.success,
      bg: colors.successBg,
    };
  }
  if (level === 'Medium') {
    return {
      emoji: '🟡',
      label: isTr ? 'Orta Sürdürülebilirlik Skoru' : 'Moderate Sustainability Score',
      desc: isTr
        ? 'Bazı alışkanlıkların dikkat gerektiriyor. Protein ve harekete odaklan.'
        : 'Some habits need attention. Focus on protein and movement.',
      color: colors.warning,
      bg: colors.warningBg,
    };
  }
  return {
    emoji: '🔴',
    label: isTr ? 'Düşük Sürdürülebilirlik Skoru' : 'Low Sustainability Score',
    desc: isTr
      ? 'Hızlı kilo kaybı + düşük protein = sürdürülebilirlik riski. Hemen protein kaynaklarına yönelin.'
      : 'Fast weight loss + low protein = sustainability risk. Add protein sources now.',
    color: colors.danger,
    bg: colors.dangerBg,
  };
}

// ─── Rebound detection (P0 stopped-medication journey) ──────────────────────
// ─── Sustaining Your Progress Tips data ─────────────────────────────────────

const getAfterTips = (language, colors) => {
  const isTr = language === 'tr';
  return [
    {
      icon: '🥩',
      iconBg: colors.successBg,
      title: isTr ? 'Önce Protein' : 'Protein First',
      text: isTr
        ? 'Her öğüne protein kaynağıyla başlayın. Tokluk ve kas koruma için her öğünde 25-35g protein hedefleyin.'
        : 'Every meal should start with a protein source. Aim for 25-35g per meal to maintain satiety and protect muscle.',
    },
    {
      icon: '🏋️',
      iconBg: colors.infoBg,
      title: isTr ? 'Güç Egzersizi' : 'Strength Training',
      text: isTr
        ? 'Haftada 2-3 kez direnç antrenmanı kas kütlenizi korur ve metabolizmanızı hızlandırır.'
        : '2-3x per week resistance training preserves muscle and boosts metabolism.',
    },
    {
      icon: '🧘',
      iconBg: colors.successBg,
      title: isTr ? 'Yavaş Yiyin' : 'Eat Slowly',
      text: isTr
        ? 'Yavaş yemek tokluk sinyallerinin beyne ulaşmasına yardımcı olur — her öğünde en az 20 dakika ayırın.'
        : 'Eating slowly helps fullness signals reach your brain — take at least 20 minutes for each meal.',
    },
    {
      icon: '🌾',
      iconBg: colors.warningBg,
      title: isTr ? 'Karbonhidratı İzleyin' : 'Watch Carbs',
      text: isTr
        ? 'Rafine karbonhidratları kompleks olanlarla değiştirin (yulaf, kinoa, bulgur). Bu, kan şekerini dengede tutar ve enerjiyi korur.'
        : 'Swap refined carbs for complex ones (oats, quinoa, bulgur). This keeps blood sugar stable and energy levels steady.',
    },
  ];
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { colors, semantic, shadow } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors, semantic, shadow), [colors, semantic, shadow]);
  const { formatWeight, formatHeight, toDisplayWeight, weightUnit, parseWeightToKg, weightRange, weightPlaceholder, weightLabel } = useUnit();
  const { completeMission, earnXP } = useGamification();

  const [refreshing, setRefreshing] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [weightHistory, setWeightHistory] = useState([]);
  const [proteinLogs, setProteinLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [logWeightVisible, setLogWeightVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [todayMeals, setTodayMeals] = useState([]);
  const [todayExercises, setTodayExercises] = useState([]);
  const [avgProteinRatio, setAvgProteinRatio] = useState(0);

  // Step counter
  const [stepCount, setStepCount] = useState(null);

  // Medication tracking summary
  const [medProfile, setMedProfile] = useState(null);
  const [medLoaded, setMedLoaded] = useState(false);

  const loadMedication = useCallback(async () => {
    if (!user) return;
    try {
      const mp = await getMedicationProfile(user.uid);
      setMedProfile(mp || null);
    } catch {
      setMedProfile(null);
    } finally {
      setMedLoaded(true);
    }
  }, [user]);

  useEffect(() => { loadMedication(); }, [loadMedication]);
  useFocusEffect(useCallback(() => { loadMedication(); }, [loadMedication]));

  // ── Apple Watch / HealthKit summary ──
  const [healthData, setHealthData] = useState(null); // { activeEnergy, heartRate, restingHeartRate }
  const [healthAvailable, setHealthAvailable] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      const available = await isHealthAvailable();
      if (!available) {
        setHealthAvailable(false);
        setHealthData(null);
        return;
      }
      const granted = await requestHealthPermissions();
      if (!granted) {
        setHealthAvailable(false);
        setHealthData(null);
        return;
      }
      const [activeEnergy, heartRate, restingHeartRate] = await Promise.all([
        getTodayActiveEnergy(),
        getLatestHeartRate(),
        getRestingHeartRate(),
      ]);
      // Only mark available if we actually got at least one data point.
      if (activeEnergy == null && heartRate == null && restingHeartRate == null) {
        setHealthAvailable(false);
        setHealthData(null);
        return;
      }
      setHealthAvailable(true);
      setHealthData({ activeEnergy, heartRate, restingHeartRate });
    } catch {
      setHealthAvailable(false);
      setHealthData(null);
    }
  }, []);

  useEffect(() => { loadHealth(); }, [loadHealth]);
  useFocusEffect(useCallback(() => { loadHealth(); }, [loadHealth]));

  useEffect(() => {
    let subscription;
    (async () => {
      const available = await Pedometer.isAvailableAsync().catch(() => false);
      if (!available) return;
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      let baseSteps = 0;
      try {
        const result = await Pedometer.getStepCountAsync(start, end);
        baseSteps = result.steps;
        setStepCount(result.steps);
      } catch {}
      subscription = Pedometer.watchStepCount(r => setStepCount(baseSteps + r.steps));
    })();
    return () => subscription?.remove();
  }, []);

  // Coach chat
  const [chatVisible, setChatVisible] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const proteinTarget = profile?.proteinTarget ?? PROTEIN_TARGET;
  const exerciseDays = profile?.exerciseDaysPerWeek ?? EXERCISE_DAYS;

  // Derived weight data — weightHistory is sorted oldest → newest
  const currentWeight =
    weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : null;

  // Total weight lost: first entry vs latest entry
  const totalWeightLost =
    weightHistory.length >= 2
      ? parseFloat(
          (weightHistory[0].weight - weightHistory[weightHistory.length - 1].weight).toFixed(1)
        )
      : 0;

  // Daily rate: total lost ÷ actual days between first and last entry
  const dailyRate = (() => {
    if (weightHistory.length < 2) return 0;
    const first = weightHistory[0];
    const last = weightHistory[weightHistory.length - 1];
    const daysDiff = Math.max(
      1,
      Math.round(
        (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    return parseFloat(((first.weight - last.weight) / daysDiff).toFixed(2));
  })();

  const today = new Date().toISOString().split('T')[0];
  const analyzedTodayProtein = todayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);
  const proteinRatio = proteinTarget > 0 ? analyzedTodayProtein / proteinTarget : 0;

  // Qualitative muscle-protection assessment (audit #10) — no fabricated
  // fat/muscle split, no kg-of-muscle-lost, no precise "muscle risk %".
  const muscleAssessment = assessMuscleProtection({
    proteinGrams: analyzedTodayProtein,
    targetGrams: proteinTarget,
    exerciseDaysPerWeek: exerciseDays,
    adequacyRatio: avgProteinRatio || proteinRatio,
  });

  const consecutiveLowProteinDays = (() => {
    let count = 0;
    for (let i = proteinLogs.length - 1; i >= 0; i--) {
      if (proteinLogs[i].grams < proteinLogs[i].target * 0.8) count++;
      else break;
    }
    return count;
  })();

  // Weekly equivalent rate for risk calculations
  const weeklyRate = parseFloat((dailyRate * 7).toFixed(1));
  const weeklyLossPercent =
    currentWeight && dailyRate > 0 ? (weeklyRate / currentWeight) * 100 : 0;

  const muscleScore = calculateMuscleScore(analyzedTodayProtein, proteinTarget, exerciseDays);
  const riskData = calculateReboundRisk(
    weeklyLossPercent,
    proteinRatio,
    exerciseDays,
    consecutiveLowProteinDays
  );
  const coachMsg = generateCoachMessage(language, weeklyRate, proteinRatio, riskData.level, {
    proteinTarget,
    analyzedTodayProtein,
  });

  const muscleScoreInfo = getMuscleScoreLabel(muscleScore, language, colors);
  const reboundInfo = getReboundRiskContent(riskData.level, language, colors);
  const afterTips = getAfterTips(language, colors);

  const loadData = useCallback(async () => {
    let history = [];
    try {
      if (user) {
        const [logs, userProfile] = await Promise.all([
          getWeightLogs(user.uid),
          getUserProfile(user.uid),
        ]);
        if (userProfile) setProfile(userProfile);
        if (logs.length > 0) {
          // Sort oldest → newest
          history = logs
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((l) => ({ date: l.date, weight: l.weight }));
        }

        // Load meals from Supabase (single source of truth — fixes the
        // split-brain where the dashboard read local AsyncStorage while
        // meal logging wrote to Supabase). getMealLogs returns every meal
        // (each row carries its own `date`); we group/filter by date in JS.
        // getTodayMeals is RLS-scoped + date-filtered to today, oldest→newest.
        const target = userProfile?.proteinTarget ?? PROTEIN_TARGET;
        const [todaysMeals, allMeals] = await Promise.all([
          getTodayMeals(user.uid),
          getMealLogs(user.uid),
        ]);
        setTodayMeals(Array.isArray(todaysMeals) ? todaysMeals : []);

        // Protein per day, summed from each meal row's `date`.
        const proteinByDate = {};
        (Array.isArray(allMeals) ? allMeals : []).forEach((m) => {
          if (!m || !m.date) return;
          proteinByDate[m.date] = (proteinByDate[m.date] || 0) + (m.protein || 0);
        });

        // 7-day average protein ratio — group the last 7 dates that have meals.
        let totalRatio = 0;
        let days = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          if (proteinByDate[dateStr] != null) {
            const dayProtein = proteinByDate[dateStr];
            totalRatio += target > 0 ? dayProtein / target : 0;
            days++;
          }
        }
        const computedAvgRatio = days > 0 ? totalRatio / days : 0;
        if (days > 0) setAvgProteinRatio(computedAvgRatio);

        // Schedule personalized AI notifications with fresh user data
        try {
          const latestWeight = history.length > 0 ? history[history.length - 1].weight : null;
          const prevWt = history.length > 1 ? history[history.length - 2].weight : null;
          const wChange = latestWeight && prevWt ? parseFloat((prevWt - latestWeight).toFixed(1)) : 0;
          const todayProtein = (Array.isArray(todaysMeals) ? todaysMeals : []).reduce(
            (s, m) => s + (m.protein || 0),
            0
          );
          // Pass real protein-adequacy data only — no fabricated muscle-loss
          // percentage (audit #10).
          await schedulePersonalizedNotifications(
            {
              currentWeight: latestWeight,
              proteinTarget: target,
              analyzedTodayProtein: todayProtein,
              avgProteinRatio: computedAvgRatio,
              weeklyChange: wChange,
            },
            language
          );
        } catch {
          // notification scheduling is best-effort
        }
      }
    } catch {
      // Storage not configured yet
    }

    setWeightHistory(history);
  }, [user, today, language]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload data when screen comes into focus (e.g. after onboarding completes)
  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  useEffect(() => {
    if (!user) return;
    const exerciseKey = `daily_exercise_${user.uid}_${new Date().toISOString().split('T')[0]}`;
    AsyncStorage.getItem(exerciseKey).then(raw => { if (raw) setTodayExercises(JSON.parse(raw)); });
  }, [user]);

  useEffect(() => {
    if (analyzedTodayProtein > 0 && proteinTarget > 0 && analyzedTodayProtein >= proteinTarget) {
      completeMission('reach_protein');
    }
  }, [analyzedTodayProtein, proteinTarget]);

  useEffect(() => {
    if (!user) return;
    const key = `tour_shown_${user.uid}`;
    AsyncStorage.getItem(key).then((v) => {
      if (!v) {
        setShowTour(true);
        AsyncStorage.setItem(key, 'true');
      }
    });
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  async function handleSaveWeight() {
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
    setSavingWeight(true);
    try {
      if (user) {
        await saveWeightLog(user.uid, wKg);

        // Update protein target based on new weight (always stored in kg).
        // Respect a user-chosen (custom) target — never auto-overwrite it.
        // Otherwise recompute using the profile's proteinPerKg (defaults to 1.6).
        const updatedProfile = { ...profile, weight: wKg };
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
      setWeightHistory((prev) => {
        const updated = prev.filter((e) => e.date !== todayDate);
        return [...updated, { date: todayDate, weight: wKg }].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      });
      await completeMission('log_weight');
      await earnXP(10, '⚖️ Weight logged!');

      // Two-way Health sync: also write the weight to Apple Health.
      // Fully guarded — never block the save flow or crash on Android / Expo Go
      // (the service no-ops off iOS, and the fn may be absent in some builds).
      try {
        if (typeof saveWeightKg === 'function') {
          await saveWeightKg(wKg);
        }
      } catch {
        // Health write is best-effort — ignore failures.
      }

      setLogWeightVisible(false);
      setWeightInput('');
    } catch {
      Alert.alert('Error', 'Failed to save weight. Please try again.');
    } finally {
      setSavingWeight(false);
    }
  }

  // Open the "log weight" modal. Nicety: if Apple Health is available, there's
  // no entry yet today, and the input is empty, prefill with the latest Health
  // weight (clearly editable). Fully guarded so it degrades gracefully on
  // Android / Expo Go — the modal always opens regardless of Health state.
  async function openLogWeight() {
    setLogWeightVisible(true);
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const alreadyLoggedToday = weightHistory.some((e) => e.date === todayDate);
      if (
        alreadyLoggedToday ||
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
      // Convert the kg value into the user's display unit and stringify it,
      // matching the editable text field's expected format.
      const display = toDisplayWeight(Number(latestKg));
      if (display == null) return;
      setWeightInput(String(display));
    } catch {
      // Prefill is best-effort — never block opening the modal.
    }
  }

  function showChat() {
    setChatMessages([{
      role: 'assistant',
      content: isTr
        ? `Merhaba! Ben GLP-1 Coach rehberinim 💪 Protein takibi ve fitness hedeflerin için sana nasıl yardımcı olabilirim?\n\nℹ️ Bu bir yaşam tarzı rehberidir, tıbbi tavsiye değildir. Yanıtlar tahminidir; sağlık kararları için doktoruna danış. Mesajların analiz için güvenli bir sunucuya gönderilir.`
        : `Hey! I'm your GLP-1 Coach Wellness Guide 💪 How can I help with your protein tracking and fitness goals today?\n\nℹ️ This is lifestyle guidance, not medical advice. Replies are estimates; consult your doctor for health decisions. Your messages are sent to a secure server for analysis.`,
    }]);
    setChatVisible(true);
  }

  // Gate AI coach behind one-time consent (health data leaves the device).
  async function openCoachChat() {
    try {
      const consent = await AsyncStorage.getItem('ai_consent_given');
      if (consent === 'true') {
        showChat();
      } else {
        setConsentVisible(true);
      }
    } catch {
      setConsentVisible(true);
    }
  }

  async function handleSendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput('');
    setChatLoading(true);
    try {
      // Last ~5 weight points (oldest→newest) so the coach can see the trend.
      const weightTrend = weightHistory
        .slice(-5)
        .map((e) => ({ date: e.date, weight: e.weight }));
      // Week-over-week change: previous weigh-in minus latest (positive = lost).
      const weeklyChange =
        weightHistory.length >= 2
          ? parseFloat(
              (
                weightHistory[weightHistory.length - 2].weight -
                weightHistory[weightHistory.length - 1].weight
              ).toFixed(1)
            )
          : null;
      const reply = await sendCoachMessage({
        messages: updated,
        todayMeals,
        proteinTarget,
        language,
        glp1Status: medProfile?.status ?? null,
        drug: medProfile?.drug ?? null,
        doseMg: medProfile?.doseMg ?? null,
        currentWeight: currentWeight ?? null,
        weeklyChange,
        weightTrend,
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: isTr ? 'Bağlantı hatası. Tekrar deneyin.' : 'Connection error. Please try again.',
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  const displayName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'there';
  const greeting = getGreeting(language);

  // Last 8 weight entries for chart — converted to display unit (kg or lbs)
  const chartWeightData = weightHistory.slice(-8).map((entry) => ({
    ...entry,
    weight: toDisplayWeight(entry.weight),
  }));

  const isTr = language === 'tr';
  const proteinMet = analyzedTodayProtein >= proteinTarget;
  const remainingProtein = proteinTarget - analyzedTodayProtein;
  const proteinProgressPct = proteinTarget > 0 ? Math.min(analyzedTodayProtein / proteinTarget, 1) : 0;

  const bmiWeight = currentWeight ?? profile?.weight ?? null;
  const bmiHeight = profile?.height ?? null;

  // ── Medication summary (next injection) ──
  const medActive = medProfile && medProfile.status === 'currentlyUsing';
  // P0: stopped / planning-to-stop journeys reframe the screen around being
  // medication-free + maintenance rather than the next injection.
  const medStopped =
    medProfile &&
    (medProfile.status === 'recentlyStopped' || medProfile.status === 'planningToStop');
  const medPlanning = medProfile && medProfile.status === 'planningToStop';

  // Days since stopping the medication (best-effort from startDate / stopDate).
  const daysSinceStopped = (() => {
    if (!medStopped) return null;
    const ref = medProfile?.stopDate || medProfile?.startDate;
    if (!ref) return null;
    const refDate = new Date(ref);
    if (Number.isNaN(refDate.getTime())) return null;
    const ms = Date.now() - refDate.getTime();
    return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  })();

  // Rebound detection over the saved weight history (oldest→newest).
  const reboundAlert = medStopped
    ? detectRebound(weightHistory)
    : { alert: 'none', gainedKg: 0 };
  const showReboundAlert =
    medStopped && (reboundAlert.alert === 'watch' || reboundAlert.alert === 'high');
  const daysUntilInjection = medActive ? getDaysUntilNextInjection(medProfile) : null;
  const nextInjectionDate = medActive ? getNextInjectionDate(medProfile) : null;
  const weekdayNames = isTr
    ? ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const nextInjectionLabel = (() => {
    if (daysUntilInjection == null) return null;
    if (daysUntilInjection === 0) return isTr ? 'Bugün' : 'Today';
    if (daysUntilInjection === 1) return isTr ? 'Yarın' : 'Tomorrow';
    if (nextInjectionDate) return weekdayNames[nextInjectionDate.getDay()];
    return isTr ? `${daysUntilInjection} gün içinde` : `in ${daysUntilInjection} days`;
  })();
  const medTone = daysUntilInjection === 0 ? 'warning' : 'info';

  function goToMedication() {
    // 'Medication' route may not be registered in every build — guard so we never crash.
    try {
      navigation.navigate('Medication');
    } catch {
      try { navigation.navigate('Settings'); } catch {}
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FeatureTour
        visible={showTour}
        language={language}
        onFinish={() => setShowTour(false)}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Medical disclaimer banner */}
        <View style={styles.medDisclaimer}>
          <Text style={styles.medDisclaimerText}>
            {isTr
              ? 'ℹ️ Bu uygulama yaşam tarzı desteği sağlar. Tıbbi tavsiye vermez. Sağlık kararları için doktorunuza danışın.'
              : 'ℹ️ This app provides lifestyle support only, not medical advice. Consult your doctor for health decisions.'}
          </Text>
        </View>

        {/* ── Hero Card ── */}
        <GradientHero style={styles.heroCard} padding={spacing.stackLg}>
          <Text style={styles.heroGreeting}>
            {greeting}, {displayName} 👋
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Weight')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              currentWeight != null
                ? (isTr
                    ? `Mevcut kilo ${formatWeight(currentWeight)}. Kilo geçmişi ve grafiği aç.`
                    : `Current weight ${formatWeight(currentWeight)}. Open weight history and chart.`)
                : (isTr ? 'Kilo geçmişi ve grafiği aç' : 'Open weight history and chart')
            }
          >
            {currentWeight != null ? (
              <Text style={styles.heroWeight}>{formatWeight(currentWeight)}</Text>
            ) : (
              <Text style={styles.heroWeightEmpty}>
                {isTr ? 'Henüz kilo girilmedi' : 'No weight logged yet'}
              </Text>
            )}
            <Text style={{ ...typography.labelSm, fontFamily: fontFamily.bodyMedium, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              {isTr ? 'Kilo geçmişi & grafik ›' : 'Weight history & chart ›'}
            </Text>
          </TouchableOpacity>

          {dailyRate !== 0 && (
            <View
              style={[
                styles.heroPill,
                {
                  backgroundColor: dailyRate > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
                  borderColor: dailyRate > 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
                },
              ]}
            >
              <Text style={[styles.heroPillText, { color: dailyRate > 0 ? '#6EE7B7' : '#FCA5A5' }]}>
                {dailyRate > 0
                  ? `▼ ${formatWeight(dailyRate)}/${isTr ? 'gün' : 'day'}`
                  : `▲ ${formatWeight(Math.abs(dailyRate))}/${isTr ? 'gün' : 'day'}`}
              </Text>
            </View>
          )}

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={openCoachChat}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'AI Koç ile sohbet et' : 'Chat with AI Coach'}
            >
              <Text style={styles.heroActionEmoji} accessibilityElementsHidden importantForAccessibility="no">🤖</Text>
              <Text style={styles.heroActionText}>{isTr ? 'AI Koç' : 'AI Coach'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroActionBtn, styles.heroActionBtnSolid]}
              onPress={() => setLogWeightVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Kilo ekle' : 'Log weight'}
            >
              <Text style={styles.heroActionEmoji} accessibilityElementsHidden importantForAccessibility="no">＋</Text>
              <Text style={[styles.heroActionText, styles.heroActionTextSolid]}>
                {isTr ? 'Kilo Ekle' : 'Log Weight'}
              </Text>
            </TouchableOpacity>
          </View>
        </GradientHero>

        {/* ── Compact Next Injection Card (only when actively using medication) ── */}
        {medLoaded && medActive && (
          <Card
            onPress={goToMedication}
            style={styles.medCard}
            accessibilityRole="button"
            accessibilityLabel={
              isTr
                ? `Sonraki enjeksiyon${nextInjectionLabel ? `: ${nextInjectionLabel}` : ''}. İlaç takibini aç.`
                : `Next injection${nextInjectionLabel ? `: ${nextInjectionLabel}` : ''}. Open medication tracking.`
            }
          >
            <View style={styles.medRow}>
              <View style={[styles.medIconCircle, { backgroundColor: semantic[medTone].bg }]}>
                <Text style={styles.medIconEmoji}>💉</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.medTitle}>
                  {isTr ? 'Sonraki enjeksiyon' : 'Next injection'}
                </Text>
                <Text style={styles.medSub}>
                  {medProfile?.drug || (isTr ? 'İlaç' : 'Medication')}
                  {medProfile?.dose ? ` · ${medProfile.dose}` : ''}
                </Text>
              </View>
              {nextInjectionLabel != null && (
                <Badge label={nextInjectionLabel} tone={medTone} />
              )}
            </View>
          </Card>
        )}

        {/* ── Compact Steps Card ── */}
        {stepCount !== null && (() => {
          const steps = stepCount;
          const goal = 10000;
          const pct = Math.min(steps / goal, 1);
          const reached = steps >= goal;
          const barColor = reached ? colors.success : colors.primary;
          return (
            <Card style={styles.stepsCard}>
              <View style={styles.stepsRow}>
                <Text style={styles.stepsEmoji}>👟</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepsLabel}>{isTr ? 'Adımlar' : 'Steps'}</Text>
                  <Text style={styles.stepsValue}>
                    {steps.toLocaleString()}
                    <Text style={styles.stepsGoal}> / {goal.toLocaleString()}</Text>
                  </Text>
                </View>
                {reached && <Text style={styles.stepsEmoji}>🏆</Text>}
              </View>
              <ProgressBar
                progress={pct}
                color={barColor}
                height={8}
                style={styles.stepsBar}
              />
            </Card>
          );
        })()}

        {/* ── Simple Daily Protein Goal Card ── */}
        <Card style={styles.proteinCard}>
          <View style={styles.proteinHeader}>
            <Text style={styles.proteinTitle}>
              {isTr ? 'Günlük Protein Hedefi' : 'Daily Protein Goal'}
            </Text>
            <Badge
              label={proteinMet ? (isTr ? 'Tamam' : 'Met') : `${analyzedTodayProtein} / ${proteinTarget}g`}
              tone={proteinMet ? 'success' : 'info'}
            />
          </View>

          <View style={styles.proteinBody}>
            <Ring
              progress={proteinProgressPct}
              size={96}
              strokeWidth={10}
              color={proteinMet ? colors.success : colors.primary}
            >
              <Text
                style={[
                  styles.proteinRingValue,
                  { color: proteinMet ? colors.success : colors.primary },
                ]}
              >
                {Math.round(proteinProgressPct * 100)}%
              </Text>
            </Ring>
            <View style={styles.proteinInfo}>
              <Text style={styles.proteinBig}>
                {analyzedTodayProtein}
                <Text style={styles.proteinUnit}> / {proteinTarget}g</Text>
              </Text>
              <Text style={styles.proteinRemaining}>
                {proteinMet
                  ? (isTr ? 'Bugünkü hedefine ulaştın 🎯' : "Today's goal reached 🎯")
                  : isTr
                  ? `Hedefe ${remainingProtein}g kaldı`
                  : `${remainingProtein}g to go`}
              </Text>
            </View>
          </View>

          <ProgressBar
            progress={proteinProgressPct}
            color={proteinMet ? colors.success : colors.primary}
            height={8}
            style={styles.proteinBar}
          />
        </Card>

        {/* ── Muscle protection insight (qualitative trend, audit #10) ── */}
        {(() => {
          const tone =
            semantic[muscleAssessment.toneKey] || semantic.info; // 'primary' → info
          return (
            <Card style={styles.muscleCard}>
              <View style={styles.muscleHeader}>
                <Text style={styles.muscleEmoji}>{muscleAssessment.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.muscleLabel, { color: tone.fg }]}>
                    {muscleAssessment.label(language)}
                  </Text>
                  <Text style={styles.muscleDesc}>
                    {muscleAssessment.description(language)}
                  </Text>
                </View>
              </View>
              <Text style={styles.muscleNotClinical}>
                {muscleAssessment.notClinical(language)}
              </Text>
            </Card>
          );
        })()}

        {/* Health-guidance disclaimer, bound near the muscle/health insight. */}
        <MedicalDisclaimer variant="medical" style={styles.muscleDisclaimer} />

        {/* ── Coach Message ── (always available) */}
        <CoachMessage message={coachMsg} />

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Coach Chat Modal ── */}
      <AIConsentModal
        visible={consentVisible}
        language={language}
        onAccept={async () => {
          try { await AsyncStorage.setItem('ai_consent_given', 'true'); } catch {}
          setConsentVisible(false);
          showChat();
        }}
        onDecline={() => setConsentVisible(false)}
      />

      <Modal visible={chatVisible} animationType="slide" transparent onRequestClose={() => setChatVisible(false)}>
        <View style={styles.chatOverlay}>
          <TouchableOpacity
            style={styles.chatBackdrop}
            onPress={() => setChatVisible(false)}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Sohbeti kapat' : 'Close chat'}
          />
          <View style={[styles.chatSheet, {
            height: keyboardHeight > 0
              ? Math.min(screenHeight * 0.70, screenHeight - keyboardHeight - 50)
              : screenHeight * 0.70,
            marginBottom: keyboardHeight,
          }]}>
            <View style={styles.chatHandle} />
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <View style={styles.chatAvatar}><Text style={styles.chatAvatarEmoji}>🤖</Text></View>
                <View>
                  <Text style={styles.chatName}>{isTr ? 'GLP-1 Coach Rehberin' : 'Your Wellness Guide'}</Text>
                  <Text style={styles.chatStatus}>
                    {isTr
                      ? `Bugün ${analyzedTodayProtein}g protein`
                      : `${analyzedTodayProtein}g protein today`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setChatVisible(false)}
                style={styles.chatClose}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Sohbeti kapat' : 'Close chat'}
              >
                <Text style={styles.chatCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={chatScrollRef}
              style={styles.chatMessages}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.map((msg, i) => (
                <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}>
                  {msg.role === 'assistant' && <Text style={styles.bubbleEmoji}>🤖</Text>}
                  <View style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextCoach]}>
                    <Text style={[styles.bubbleMsg, msg.role === 'user' ? styles.bubbleMsgUser : styles.bubbleMsgCoach]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}
              {chatLoading && (
                <View style={[styles.bubble, styles.bubbleCoach]}>
                  <Text style={styles.bubbleEmoji}>🤖</Text>
                  <View style={styles.bubbleTextCoach}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                </View>
              )}
            </ScrollView>
            {chatMessages.length <= 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickPrompts} contentContainerStyle={{ padding: 12, gap: 8 }}>
                {(isTr ? [
                  'Bugün nasıl gidiyorum?',
                  'Daha fazla protein için ne yiyeyim?',
                  'Kas kaybetmeden kilo verebilir miyim?',
                ] : [
                  "How am I doing today?",
                  "What should I eat for more protein?",
                  "Can I lose fat without losing muscle?",
                ]).map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickPrompt}
                    onPress={() => setChatInput(q)}
                    accessibilityRole="button"
                    accessibilityLabel={q}
                  >
                    <Text style={styles.quickPromptText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder={isTr ? 'Koçuna bir şey sor...' : 'Ask your coach anything...'}
                placeholderTextColor={colors.outline}
                accessibilityLabel={isTr ? 'Mesaj kutusu' : 'Message input'}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                maxLength={300}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!chatInput.trim() || chatLoading) && styles.sendBtnDisabled]}
                onPress={handleSendChat}
                disabled={!chatInput.trim() || chatLoading}
                accessibilityRole="button"
                accessibilityLabel={isTr ? 'Mesaj gönder' : 'Send message'}
                accessibilityState={{ disabled: !chatInput.trim() || chatLoading }}
              >
                <Text style={styles.sendBtnText} accessibilityElementsHidden importantForAccessibility="no">➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Log Weight Modal ── */}
      <Modal
        visible={logWeightVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogWeightVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{weightLabel(isTr)}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={weightPlaceholder()}
                placeholderTextColor={colors.outline}
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
                accessibilityLabel={weightLabel(isTr)}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setLogWeightVisible(false);
                    setWeightInput('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('cancel')}
                >
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <PrimaryButton
                  style={styles.saveBtn}
                  title={t('save')}
                  loading={savingWeight}
                  onPress={handleSaveWeight}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Section Title sub-component ─────────────────────────────────────────────

function SectionTitle({ title }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.stackLg, marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 18,
          fontFamily: fontFamily.headingBold,
          fontWeight: '700',
          color: colors.onSurface,
          letterSpacing: -0.25,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors, semantic, shadow) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.containerMargin, paddingTop: spacing.gutter },

  medDisclaimer: {
    backgroundColor: colors.warningBg, borderRadius: radii.md, padding: 10,
    marginBottom: 14, borderWidth: 1, borderColor: colors.warning,
  },
  medDisclaimerText: { fontSize: 11, fontFamily: fontFamily.body, color: colors.warning, lineHeight: 16, textAlign: 'center' },

  // ── Medication summary Card ──
  medCard: { marginBottom: 12 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medIconCircle: {
    width: 44, height: 44, borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center',
  },
  medIconEmoji: { fontSize: 22 },
  medTitle: { ...typography.labelMd, fontSize: 15, color: colors.onSurface },
  medSub: { ...typography.bodyMd, fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  medChevron: { fontSize: 26, color: colors.outline, marginLeft: 4, marginTop: -2 },

  // ── Rebound alert Card (P0 medication-free journey) ──
  reboundCard: { marginBottom: 12, borderWidth: 1.5 },
  reboundRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reboundEmoji: { fontSize: 22, marginTop: 1 },
  reboundTitle: { fontSize: 14, fontFamily: fontFamily.headingBold, fontWeight: '800', marginBottom: 4 },
  reboundDesc: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },
  reboundBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reboundBtnText: { color: colors.onPrimary, fontSize: 13, fontFamily: fontFamily.bodySemiBold, fontWeight: '600' },

  // ── Apple Watch / HealthKit Card ──
  watchCard: { marginBottom: 12 },
  watchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  watchEmoji: { fontSize: 20 },
  watchTitle: { fontSize: 15, fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.onSurface },
  watchStatsRow: { flexDirection: 'row', alignItems: 'center' },
  watchStat: { flex: 1, alignItems: 'center' },
  watchStatDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.outlineVariant, marginVertical: 4 },
  watchStatEmoji: { fontSize: 20, marginBottom: 4 },
  watchStatValue: { fontSize: 24, fontFamily: fontFamily.headingExtraBold, fontWeight: '800', color: colors.onSurface },
  watchStatUnit: { fontSize: 13, fontFamily: fontFamily.bodyMedium, fontWeight: '500', color: colors.onSurfaceVariant },
  watchStatLabel: { fontSize: 12, fontFamily: fontFamily.bodyMedium, color: colors.onSurfaceVariant, marginTop: 2 },
  watchRestingLine: {
    fontSize: 12,
    fontFamily: fontFamily.body,
    color: colors.onSurfaceVariant,
    marginTop: 12,
    textAlign: 'center',
  },

  // ── Honest estimate caption ──
  estimateCaption: {
    fontSize: 11,
    fontFamily: fontFamily.body,
    color: colors.outline,
    lineHeight: 15,
    marginBottom: 10,
    fontStyle: 'italic',
  },

  // ── Hero Card ──
  heroCard: {
    marginBottom: spacing.stackLg,
  },
  heroGreeting: {
    ...typography.bodyMd,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 6,
  },
  heroWeight: {
    ...typography.displayStat,
    fontSize: 44,
    lineHeight: 50,
    color: colors.onPrimary,
  },
  heroWeightEmpty: {
    ...typography.headlineMd,
    color: 'rgba(255,255,255,0.7)',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.stackLg,
  },
  heroActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroActionBtnSolid: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  heroActionEmoji: { fontSize: 18 },
  heroActionText: {
    color: colors.onPrimary,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    fontSize: 14,
  },
  heroActionTextSolid: {
    color: colors.primary,
  },

  // ── Compact Steps Card ──
  stepsCard: { marginBottom: spacing.stackMd },
  stepsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepsEmoji: { fontSize: 24 },
  stepsLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  stepsValue: {
    fontSize: 22,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    color: colors.onSurface,
    marginTop: 2,
  },
  stepsGoal: {
    fontSize: 14,
    fontFamily: fontFamily.bodyMedium,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  stepsBar: { marginTop: 2 },

  // ── Simple Daily Protein Goal Card ──
  proteinCard: { marginBottom: spacing.stackMd },
  proteinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.stackMd,
  },
  proteinTitle: {
    ...typography.headlineMd,
    fontSize: 18,
    lineHeight: 24,
    color: colors.onSurface,
  },
  proteinBody: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: spacing.stackMd },
  proteinRingValue: {
    fontSize: 22,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
  },
  proteinInfo: { flex: 1 },
  proteinBig: {
    ...typography.headlineLg,
    fontSize: 30,
    lineHeight: 36,
    color: colors.onSurface,
  },
  proteinUnit: {
    fontSize: 16,
    fontFamily: fontFamily.bodyMedium,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  proteinRemaining: {
    ...typography.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  proteinBar: { marginTop: 2 },

  // ── Muscle protection insight (qualitative trend) ──
  muscleCard: { marginBottom: spacing.stackSm },
  muscleHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  muscleEmoji: { fontSize: 24, marginTop: 1 },
  muscleLabel: {
    fontSize: 15,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
    marginBottom: 3,
  },
  muscleDesc: {
    fontSize: 13,
    fontFamily: fontFamily.body,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  muscleNotClinical: {
    marginTop: 10,
    fontSize: 11,
    fontFamily: fontFamily.body,
    color: colors.outline,
    lineHeight: 15,
    fontStyle: 'italic',
  },
  muscleDisclaimer: { marginBottom: spacing.stackMd },

  // ── Coach Chat ──
  chatOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chatBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  chatSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
  },
  chatHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.outlineVariant, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, padding: 14,
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarEmoji: { fontSize: 20 },
  chatName: { color: colors.onPrimary, fontSize: 15, fontFamily: fontFamily.bodyBold, fontWeight: '700' },
  chatStatus: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: fontFamily.body, marginTop: 1 },
  chatClose: { padding: 8 },
  chatCloseText: { color: colors.onPrimary, fontSize: 18, fontFamily: fontFamily.bodySemiBold, fontWeight: '600' },
  chatMessages: { flex: 1 },
  bubble: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleCoach: { justifyContent: 'flex-start' },
  bubbleEmoji: { fontSize: 18, marginRight: 6, marginBottom: 4 },
  bubbleText: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleTextUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTextCoach: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, ...shadow('sm') },
  bubbleMsg: { fontSize: 14, fontFamily: fontFamily.body, lineHeight: 20 },
  bubbleMsgUser: { color: colors.onPrimary },
  bubbleMsgCoach: { color: colors.onSurface },
  quickPrompts: { flexShrink: 0, maxHeight: 70, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  quickPrompt: {
    backgroundColor: colors.infoBg, borderRadius: radii.pill,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  quickPromptText: { color: colors.primary, fontSize: 13, fontFamily: fontFamily.bodySemiBold, fontWeight: '600' },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.outlineVariant,
  },
  chatInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: fontFamily.body,
    color: colors.onSurface, maxHeight: 100, backgroundColor: colors.background,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.outlineVariant },
  sendBtnText: { color: colors.onPrimary, fontSize: 18 },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  heroPillText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
  },

  // ── Body Stats Row ──
  statCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCardItem: { flex: 1 },
  statEmoji: { fontSize: 18 },

  // ── Step Counter Card ──
  stepCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  stepCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepEmoji: { fontSize: 24, marginTop: 1 },
  stepCount: { fontSize: 20, fontWeight: '800', fontFamily: fontFamily.headingBold },
  stepGoal: { fontSize: 13, fontWeight: '500', color: colors.outline, fontFamily: fontFamily.bodyMedium },
  stepMsg: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 3, lineHeight: 17, fontFamily: fontFamily.body },

  // ── Streak Banner ──
  streakBanner: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  streakText: {
    fontSize: 13,
    fontFamily: fontFamily.bodyBold,
    fontWeight: '700',
  },

  // ── Section Title ──
  sectionTitleRow: {
    marginTop: spacing.stackLg,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamily.headingBold,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.25,
  },

  // ── Muscle Alert Banner ──
  muscleAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  muscleAlertEmoji: { fontSize: 22 },
  muscleAlertTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2, fontFamily: fontFamily.headingBold },
  muscleAlertDesc: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17, fontFamily: fontFamily.body },
  muscleAlertBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  muscleAlertBtnText: { color: colors.white, fontWeight: '700', fontSize: 12, fontFamily: fontFamily.bodySemiBold },

  // ── Fat vs Muscle Loss ──
  fatMuscleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  fatMuscleCard: {
    flex: 1,
    borderRadius: radii.card,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow('sm'),
  },
  fatMuscleIcon: { fontSize: 20, marginBottom: 4 },
  fatMuscleValue: { fontSize: 26, fontFamily: fontFamily.headingExtraBold, fontWeight: '800' },
  fatMuscleLabel: { fontSize: 12, fontFamily: fontFamily.bodySemiBold, fontWeight: '600', marginTop: 2 },
  fatMusclePct: { fontSize: 11, fontFamily: fontFamily.bodyBold, fontWeight: '700', marginTop: 2, opacity: 0.8 },
  splitBarRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  splitBarSeg: { height: '100%' },
  splitBarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  splitBarLegendText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, fontFamily: fontFamily.bodySemiBold },

  // ── 14-Day Projection ──
  projectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    ...shadow('md'),
  },
  projectionRateLabel: { fontSize: 11, fontFamily: fontFamily.body, color: colors.outline, marginBottom: 12, textAlign: 'center' },

  // 3-path table
  proj3Row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  proj3Col: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  proj3ColBadge: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fontFamily.bodySemiBold,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  proj3KgTotal: {
    fontSize: 18,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    color: colors.onSurface,
    marginBottom: 6,
  },
  proj3BarWrap: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 8,
  },
  proj3BarFat: { backgroundColor: colors.success },
  proj3BarMuscle: {},
  proj3Fat: { fontSize: 11, fontWeight: '600', color: colors.success, textAlign: 'center', fontFamily: fontFamily.bodySemiBold },
  proj3Muscle: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 2, fontFamily: fontFamily.bodySemiBold },
  proj3RiskRange: { fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 1, fontFamily: fontFamily.bodyMedium },

  // Action tips
  projDisclaimer: {
    marginTop: 10,
    fontSize: 11,
    color: colors.outline,
    lineHeight: 15,
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: fontFamily.body,
  },
  projTipsWrap: { gap: 8 },
  projTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningBg,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  projTipIcon: { fontSize: 16, marginTop: 1 },
  projTipText: { flex: 1, fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 18, fontFamily: fontFamily.bodyMedium },

  // ── Protein Why Card ──
  proteinWhyCard: {
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  proteinWhyText: { fontSize: 13, fontFamily: fontFamily.bodySemiBold, fontWeight: '600', color: colors.primaryDark, marginBottom: 8, lineHeight: 18 },
  proteinThresholds: { flexDirection: 'row', gap: 6 },
  proteinThresholdPill: { flex: 1, borderRadius: 8, paddingVertical: 4, alignItems: 'center' },
  proteinThresholdPillText: { fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant, fontFamily: fontFamily.bodySemiBold },

  // ── Risk Factors ──
  riskFactors: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  riskFactorsTitle: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, marginBottom: 6, fontFamily: fontFamily.bodySemiBold },
  riskFactor: { fontSize: 12, color: colors.outline, marginBottom: 3, lineHeight: 16, fontFamily: fontFamily.body },

  // ── Empty state ──
  emptyCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyCardText: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },

  // ── Protein Score Card ──
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    ...shadow('md'),
  },
  scoreRingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  scoreRingTextCol: { flex: 1 },
  scoreRingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  scoreRingValue: { fontSize: 26, fontFamily: fontFamily.headingExtraBold, fontWeight: '800' },
  scoreRingMax: { fontSize: 11, fontFamily: fontFamily.bodySemiBold, color: colors.outline, marginTop: -2 },
  scoreCardEmoji: { fontSize: 20 },
  scoreCardLabel: { fontSize: 15, fontFamily: fontFamily.bodyBold, fontWeight: '700', flexShrink: 1 },
  scoreCardDesc: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, marginTop: 3, lineHeight: 18 },

  // ── Shared progress bar ──
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.outlineVariant,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },

  scoreFactors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  scoreFactor: { alignItems: 'center', flex: 1 },
  scoreFactorDot: { fontSize: 14, marginBottom: 2 },
  scoreFactorText: { fontSize: 11, color: colors.outline, textAlign: 'center', fontWeight: '500', fontFamily: fontFamily.bodyMedium },

  // ── Rebound Risk Card ──
  riskCard: {
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    ...shadow('sm'),
  },
  riskCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  riskCardEmoji: { fontSize: 22, marginTop: 1 },
  riskCardLabel: { fontSize: 15, fontFamily: fontFamily.bodyBold, fontWeight: '700' },
  riskCardDesc: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 },

  // ── Protein Action Card ──
  proteinActionCard: {
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    ...shadow('sm'),
  },
  proteinActionEmoji: { fontSize: 22, marginBottom: 6 },
  proteinActionTitle: { fontSize: 14, fontFamily: fontFamily.bodySemiBold, fontWeight: '600', lineHeight: 20, marginBottom: 12 },
  proteinProgressLabel: {
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
    color: colors.onSurfaceVariant,
    marginTop: 6,
    fontWeight: '500',
  },

  // ── Sustaining Your Progress Tips ──
  tipsScroll: { paddingRight: 24, paddingBottom: 4 },
  tipCard: {
    width: 200,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    marginRight: 12,
    ...shadow('md'),
  },
  tipIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tipIcon: { fontSize: 22 },
  tipTitle: { fontSize: 14, fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.onSurface, marginBottom: 6 },
  tipText: { fontSize: 12, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },

  // ── Log Weight Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontFamily: fontFamily.headingBold, fontWeight: '700', color: colors.onSurface, marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 18,
    fontFamily: fontFamily.body,
    color: colors.onSurface,
    backgroundColor: colors.background,
  },
  modalButtons: { flexDirection: 'row', marginTop: 20, gap: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.onSurfaceVariant, fontFamily: fontFamily.bodySemiBold, fontWeight: '600', fontSize: 16 },
  saveBtn: {
    flex: 1,
  },
});
