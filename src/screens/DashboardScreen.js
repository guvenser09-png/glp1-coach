import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useSubscription } from '../context/SubscriptionContext';
import CoachMessage from '../components/CoachMessage';
import WeightChart from '../components/WeightChart';
import { sendCoachMessage } from '../services/coachChatService';
import { scheduleDailyMotivation, schedulePersonalizedNotifications } from '../services/notificationService';
import { Pedometer } from 'expo-sensors';

import {
  calculateMuscleScore,
  calculateReboundRisk,
  generateCoachMessage,
} from '../utils/heuristics';
import {
  saveWeightLog,
  getWeightLogs,
  getUserProfile,
  saveUserProfile,
} from '../services/firestoreService';

const PROTEIN_TARGET = 120;
const EXERCISE_DAYS = 3;
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// ─── helpers ────────────────────────────────────────────────────────────────

function getFatMuscleRatio(proteinRatio) {
  if (proteinRatio >= 1.0) return { fatPct: 95, musclePct: 5 };
  if (proteinRatio >= 0.8) return { fatPct: 80, musclePct: 20 };
  if (proteinRatio >= 0.6) return { fatPct: 65, musclePct: 35 };
  return { fatPct: 50, musclePct: 50 };
}

function getGreeting(language) {
  const hour = new Date().getHours();
  const isTr = language === 'tr';
  if (hour < 12) return isTr ? 'Günaydın' : 'Good morning';
  if (hour < 18) return isTr ? 'İyi günler' : 'Good afternoon';
  return isTr ? 'İyi akşamlar' : 'Good evening';
}

function getMuscleScoreLabel(score, language) {
  const isTr = language === 'tr';
  if (score >= 85) {
    return {
      emoji: '💪',
      label: isTr ? 'Mükemmel Koruma' : 'Excellent Protection',
      desc: isTr
        ? 'Protein alımınız kaslarınızı çok iyi koruyor.'
        : 'Your protein intake is protecting your muscles well.',
      color: '#10B981',
    };
  }
  if (score >= 65) {
    return {
      emoji: '✅',
      label: isTr ? 'İyi Koruma' : 'Good Protection',
      desc: isTr
        ? 'Daha iyi sonuçlar için proteini biraz artırın.'
        : 'Slightly increase protein for better results.',
      color: '#4F46E5',
    };
  }
  if (score >= 40) {
    return {
      emoji: '⚠️',
      label: isTr ? 'Orta Risk' : 'Moderate Risk',
      desc: isTr
        ? 'Protein alımı optimal değil. Günlük hedefe ulaşmaya çalışın.'
        : 'Protein intake is below optimal. Try to reach your daily target.',
      color: '#F59E0B',
    };
  }
  return {
    emoji: '🚨',
    label: isTr ? 'Yüksek Risk' : 'High Risk',
    desc: isTr
      ? 'Çok düşük protein alımı. Kas kaybı olası. Bugün proteine öncelik verin.'
      : 'Very low protein intake. Muscle loss is likely. Prioritize protein today.',
    color: '#EF4444',
  };
}

function getReboundRiskContent(level, language) {
  const isTr = language === 'tr';
  if (level === 'Low') {
    return {
      emoji: '🟢',
      label: isTr ? 'Düşük Geri Alım Riski' : 'Low Rebound Risk',
      desc: isTr
        ? 'Alışkanlıklarınız kilo geri alımına karşı koruma sağlıyor. Devam edin!'
        : 'Your habits are protecting against weight regain. Keep it up!',
      color: '#10B981',
      bg: '#ECFDF5',
    };
  }
  if (level === 'Medium') {
    return {
      emoji: '🟡',
      label: isTr ? 'Orta Risk' : 'Moderate Risk',
      desc: isTr
        ? 'Bazı alışkanlıkların dikkat gerektiriyor. Protein ve harekete odaklan.'
        : 'Some habits need attention. Focus on protein and movement.',
      color: '#D97706',
      bg: '#FFFBEB',
    };
  }
  return {
    emoji: '🔴',
    label: isTr ? 'Yüksek Geri Alım Riski' : 'High Rebound Risk',
    desc: isTr
      ? 'Hızlı kilo kaybı + düşük protein = yüksek geri alım riski. Hemen protein kaynaklarına yönelin.'
      : 'Fast weight loss + low protein = high regain risk. Add protein sources now.',
    color: '#EF4444',
    bg: '#FEF2F2',
  };
}

// ─── GLP-1 After Tips data ───────────────────────────────────────────────────

const getAfterTips = (language) => {
  const isTr = language === 'tr';
  return [
    {
      icon: '🥩',
      iconBg: '#ECFDF5',
      title: isTr ? 'Önce Protein' : 'Protein First',
      text: isTr
        ? 'Her öğüne protein kaynağıyla başlayın. İlaç olmadan tokluk için her öğünde 25-35g protein hedefleyin.'
        : 'Every meal should start with a protein source. Aim for 25-35g per meal to maintain satiety without the medication.',
    },
    {
      icon: '🏋️',
      iconBg: '#EEF2FF',
      title: isTr ? 'Güç Egzersizi' : 'Strength Training',
      text: isTr
        ? 'Haftada 2-3 kez direnç antrenmanı kas kütlenizi korur ve metabolizmanızı hızlandırır.'
        : '2-3x per week resistance training preserves muscle and boosts metabolism to prevent regain.',
    },
    {
      icon: '🧘',
      iconBg: '#F0FDF4',
      title: isTr ? 'Yavaş Yiyin' : 'Eat Slowly',
      text: isTr
        ? 'GLP-1 yeme hızınızı yavaşlattı. Bu alışkanlığı koruyun — tokluk sinyalleri beyne 20 dakikada ulaşır.'
        : 'GLP-1 slowed your eating pace. Keep this habit — it takes 20 mins for fullness signals to reach your brain.',
    },
    {
      icon: '⚠️',
      iconBg: '#FFFBEB',
      title: isTr ? 'Karbonhidratı İzleyin' : 'Watch Carbs',
      text: isTr
        ? 'İlaç olmadan karbonhidrat isteği geri gelebilir. Rafine karbonhidratları kompleks olanlarla değiştirin (yulaf, kinoa, bulgur).'
        : 'Without GLP-1, carb cravings may return. Swap refined carbs for complex ones (oats, quinoa, bulgur).',
    },
  ];
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { checkAccess } = useSubscription();

  const [refreshing, setRefreshing] = useState(false);
  const [weightHistory, setWeightHistory] = useState([]);
  const [proteinLogs, setProteinLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [logWeightVisible, setLogWeightVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [todayMeals, setTodayMeals] = useState([]);
  const [avgProteinRatio, setAvgProteinRatio] = useState(0);

  // Step counter
  const [stepCount, setStepCount] = useState(null);

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

  const { fatPct, musclePct } = getFatMuscleRatio(avgProteinRatio || proteinRatio);
  const fatLostKg =
    totalWeightLost > 0 ? parseFloat(((totalWeightLost * fatPct) / 100).toFixed(1)) : 0;
  const muscleLostKg =
    totalWeightLost > 0 ? parseFloat(((totalWeightLost * musclePct) / 100).toFixed(1)) : 0;

  // 14-day projection using real daily rate
  const projected14 = dailyRate > 0 ? parseFloat((dailyRate * 14).toFixed(1)) : 0;
  // Path A — current trajectory
  const proj14Fat    = projected14 > 0 ? parseFloat(((projected14 * fatPct) / 100).toFixed(1)) : 0;
  const proj14Muscle = projected14 > 0 ? parseFloat(((projected14 * musclePct) / 100).toFixed(1)) : 0;
  // Path B — protein 100% (95/5 split)
  const proj14FatOpt    = projected14 > 0 ? parseFloat(((projected14 * 95) / 100).toFixed(1)) : 0;
  const proj14MuscleOpt = projected14 > 0 ? parseFloat(((projected14 * 5)  / 100).toFixed(1)) : 0;
  // Path C — protein 100% + resistance exercise (98/2 split)
  const proj14FatBest    = projected14 > 0 ? parseFloat(((projected14 * 98) / 100).toFixed(1)) : 0;
  const proj14MuscleBest = projected14 > 0 ? parseFloat(((projected14 * 2)  / 100).toFixed(1)) : 0;
  const showProjection = projected14 > 0;

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

  const muscleScoreInfo = getMuscleScoreLabel(muscleScore, language);
  const reboundInfo = getReboundRiskContent(riskData.level, language);
  const afterTips = getAfterTips(language);

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

        // Load today's analyzed meals
        const mealsKey = `daily_meals_${user.uid}_${today}`;
        const rawMeals = await AsyncStorage.getItem(mealsKey);
        if (rawMeals) setTodayMeals(JSON.parse(rawMeals));

        // Compute 7-day average protein ratio (same method as weekly report)
        const target = userProfile?.proteinTarget ?? PROTEIN_TARGET;
        let totalRatio = 0;
        let days = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const key = `daily_meals_${user.uid}_${dateStr}`;
          const raw = await AsyncStorage.getItem(key);
          if (raw) {
            const meals = JSON.parse(raw);
            const dayProtein = meals.reduce((s, m) => s + (m.protein || 0), 0);
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
          const todayMealsRaw = await AsyncStorage.getItem(`daily_meals_${user.uid}_${today}`);
          const todayProtein = todayMealsRaw
            ? JSON.parse(todayMealsRaw).reduce((s, m) => s + (m.protein || 0), 0)
            : 0;
          const { musclePct: notifMusclePct } = getFatMuscleRatio(computedAvgRatio);
          await schedulePersonalizedNotifications(
            {
              currentWeight: latestWeight,
              proteinTarget: target,
              analyzedTodayProtein: todayProtein,
              avgProteinRatio: computedAvgRatio,
              weeklyChange: wChange,
              musclePct: notifMusclePct,
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  async function handleSaveWeight() {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(w) || w < 30 || w > 300) {
      Alert.alert('Invalid weight', 'Enter a weight between 30 and 300 kg.');
      return;
    }
    setSavingWeight(true);
    try {
      if (user) {
        await saveWeightLog(user.uid, w);

        // Update protein target based on new weight
        const newProteinTarget = Math.round(w * 1.6);
        const updatedProfile = { ...profile, weight: w, proteinTarget: newProteinTarget };
        await saveUserProfile(user.uid, updatedProfile);
        setProfile(updatedProfile);
      }
      const todayDate = new Date().toISOString().split('T')[0];
      setWeightHistory((prev) => {
        const updated = prev.filter((e) => e.date !== todayDate);
        return [...updated, { date: todayDate, weight: w }].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      });
      setLogWeightVisible(false);
      setWeightInput('');
    } catch {
      Alert.alert('Error', 'Failed to save weight. Please try again.');
    } finally {
      setSavingWeight(false);
    }
  }

  function openCoachChat() {
    setChatMessages([{
      role: 'assistant',
      content: isTr
        ? `Merhaba! Ben senin GLP-1 koçunum 💪 Sana nasıl yardımcı olabilirim?`
        : `Hey! I'm your GLP-1 coach 💪 How can I help you today?`,
    }]);
    setChatVisible(true);
  }

  async function handleSendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput('');
    setChatLoading(true);
    try {
      const reply = await sendCoachMessage({
        messages: updated,
        todayMeals,
        proteinTarget,
        language,
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

  const displayName = profile?.name || user?.email?.split('@')[0] || 'there';
  const greeting = getGreeting(language);

  // Last 8 weight entries for chart
  const chartWeightData = weightHistory.slice(-8);

  const isTr = language === 'tr';
  const proteinMet = analyzedTodayProtein >= proteinTarget;
  const remainingProtein = proteinTarget - analyzedTodayProtein;
  const proteinProgressPct = proteinTarget > 0 ? Math.min(analyzedTodayProtein / proteinTarget, 1) : 0;

  // BMI
  const bmiWeight = currentWeight ?? profile?.weight ?? null;
  const bmiHeight = profile?.height ?? null;
  const bmi = bmiWeight && bmiHeight
    ? parseFloat((bmiWeight / Math.pow(bmiHeight / 100, 2)).toFixed(1))
    : null;
  const bmiInfo = (() => {
    if (!bmi) return null;
    if (bmi < 18.5) return { label: isTr ? 'Zayıf' : 'Underweight', color: '#3B82F6' };
    if (bmi < 25)   return { label: isTr ? 'Normal' : 'Normal',      color: '#10B981' };
    if (bmi < 30)   return { label: isTr ? 'Fazla Kilolu' : 'Overweight', color: '#F59E0B' };
    return           { label: isTr ? 'Obez' : 'Obese',               color: '#EF4444' };
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
      >
        {/* ── Hero Card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroGreeting}>
                {greeting}, {displayName}! 💪
              </Text>
              {currentWeight != null ? (
                <Text style={styles.heroWeight}>{currentWeight} kg</Text>
              ) : (
                <Text style={styles.heroWeightEmpty}>
                  {isTr ? 'Kilo girilmedi' : 'No weight logged'}
                </Text>
              )}
            </View>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroCoachBtn}
                onPress={openCoachChat}
                activeOpacity={0.85}
              >
                <Text style={styles.heroCoachBtnEmoji}>🤖</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroLogBtn}
                onPress={() => setLogWeightVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.heroLogBtnText}>{t('logWeight')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {dailyRate !== 0 && (
            <View style={[styles.heroPill, { backgroundColor: dailyRate > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)', borderColor: dailyRate > 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)' }]}>
              <Text style={[styles.heroPillText, { color: dailyRate > 0 ? '#6EE7B7' : '#FCA5A5' }]}>
                {dailyRate > 0
                  ? `▼ ${dailyRate} kg/${isTr ? 'gün' : 'day'}`
                  : `▲ ${Math.abs(dailyRate)} kg/${isTr ? 'gün' : 'day'}`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Body Stats Row (Weight / Height / BMI) ── */}
        {(bmiWeight || bmiHeight) && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⚖️</Text>
              <Text style={styles.statValue}>{bmiWeight ?? '—'}</Text>
              <Text style={styles.statUnit}>kg</Text>
              <Text style={styles.statLabel}>{isTr ? 'Kilo' : 'Weight'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>📏</Text>
              <Text style={styles.statValue}>{bmiHeight ?? '—'}</Text>
              <Text style={styles.statUnit}>cm</Text>
              <Text style={styles.statLabel}>{isTr ? 'Boy' : 'Height'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🧮</Text>
              <Text style={[styles.statValue, bmiInfo ? { color: bmiInfo.color } : null]}>
                {bmi ?? '—'}
              </Text>
              <Text style={styles.statUnit}>VKİ</Text>
              {bmiInfo && (
                <Text style={[styles.statBmiTag, { color: bmiInfo.color }]}>{bmiInfo.label}</Text>
              )}
            </View>
          </View>
        )}

        {/* ── Step Counter ── */}
        {stepCount !== null && (() => {
          const steps = stepCount;
          const goal = 10000;
          const mid = 5000;
          const pct = Math.min(steps / goal, 1);
          const barColor = steps >= goal ? '#10B981' : steps >= mid ? '#F59E0B' : '#EF4444';
          const bgColor  = steps >= goal ? '#ECFDF5' : steps >= mid ? '#FFFBEB' : '#FEF2F2';
          const emoji    = steps >= goal ? '🏆' : steps >= mid ? '👟' : '⚠️';
          const message  = isTr
            ? steps >= goal
              ? `Günlük 10.000 adım hedefini tamamladın! Harika iş.`
              : steps >= mid
              ? `${steps.toLocaleString()} adım — hedefe ${(goal - steps).toLocaleString()} adım kaldı.`
              : `Bugün ${steps.toLocaleString()} adım — 5.000 adım at, metabolizmanı destekle!`
            : steps >= goal
              ? `Daily 10,000 step goal completed! Great work.`
              : steps >= mid
              ? `${steps.toLocaleString()} steps — ${(goal - steps).toLocaleString()} more to reach your goal.`
              : `${steps.toLocaleString()} steps today — aim for 5,000 to boost your metabolism!`;

          return (
            <View style={[styles.stepCard, { backgroundColor: bgColor }]}>
              <View style={styles.stepCardTop}>
                <Text style={styles.stepEmoji}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCount, { color: barColor }]}>
                    {steps.toLocaleString()}
                    <Text style={styles.stepGoal}> / {goal.toLocaleString()} {isTr ? 'adım' : 'steps'}</Text>
                  </Text>
                  <Text style={styles.stepMsg}>{message}</Text>
                </View>
              </View>
              <View style={styles.stepBarBg}>
                <View style={[styles.stepBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
              </View>
            </View>
          );
        })()}

        {/* ── Protein Streak Mini-Banner ── */}
        <View
          style={[
            styles.streakBanner,
            { backgroundColor: proteinMet ? '#ECFDF5' : '#FFF7ED' },
          ]}
        >
          <Text style={[styles.streakText, { color: proteinMet ? '#065F46' : '#92400E' }]}>
            {proteinMet
              ? isTr
                ? '🔥 Bugün protein hedefinize ulaştınız!'
                : '🔥 Protein target reached today!'
              : isTr
              ? `💪 Hedefe ulaşmak için ${remainingProtein}g daha protein`
              : `💪 ${remainingProtein}g more protein to reach today's goal`}
          </Text>
        </View>

        {/* ── Coach Message ── */}
        {checkAccess('coach_message') ? (
          <CoachMessage message={coachMsg} />
        ) : (
          <View style={styles.lockedCard}>
            <View style={styles.lockedContent}>
              <Text style={styles.lockedEmoji}>🤖</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.lockedTitle}>{t('coachTitle')}</Text>
                <Text style={styles.lockedSub}>{t('locked')}</Text>
              </View>
            </View>
            <View style={styles.lockedOverlay}>
              <Text style={styles.lockedOverlayIcon}>🔒</Text>
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() =>
                  navigation.navigate('Paywall', {
                    featureKey: 'coach_message',
                    featureName: t('coachTitle'),
                  })
                }
                activeOpacity={0.85}
              >
                <Text style={styles.upgradeBtnText}>{t('upgrade')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Weight History Chart ── */}
        <SectionTitle title={isTr ? '📉 Kilo Geçmişi (kg)' : '📉 Weight Progress'} />
        <WeightChart data={chartWeightData} height={220} />

        {/* ── Fat vs Muscle Loss ── */}
        <SectionTitle title={isTr ? '🥩 Vücut Kompozisyonu' : '🥩 Body Composition'} />
        {totalWeightLost > 0 ? (
          <>
            {/* Muscle Alert Banner */}
            {musclePct >= 30 && (
              <View style={[
                styles.muscleAlertBanner,
                { backgroundColor: musclePct >= 50 ? '#FEF2F2' : '#FFFBEB',
                  borderColor: musclePct >= 50 ? '#FCA5A5' : '#FDE68A' },
              ]}>
                <Text style={styles.muscleAlertEmoji}>{musclePct >= 50 ? '🚨' : '⚠️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.muscleAlertTitle, { color: musclePct >= 50 ? '#DC2626' : '#D97706' }]}>
                    {isTr
                      ? `Kas kaybı ${musclePct >= 50 ? 'kritik' : 'yüksek'} risk — kaybın %${musclePct > 40 ? '40–50' : '25–35'}'i kas olabilir`
                      : `Muscle loss ${musclePct >= 50 ? 'critical' : 'high'} risk — ${musclePct > 40 ? '40–50' : '25–35'}% of loss may be muscle`}
                  </Text>
                  <Text style={styles.muscleAlertDesc}>
                    {isTr
                      ? `Metabolizmanız yavaşlayabilir ve kilo geri alım riski artabilir. Protein + direnç egzersizi kombinasyonu bu riski ciddi ölçüde azaltabilir.`
                      : `Your metabolism may slow and rebound risk may increase. Protein + resistance exercise can significantly reduce this risk.`}
                  </Text>
                </View>
                <TouchableOpacity style={[
                  styles.muscleAlertBtn,
                  { backgroundColor: musclePct >= 50 ? '#DC2626' : '#D97706' },
                ]} onPress={openCoachChat}>
                  <Text style={styles.muscleAlertBtnText}>{isTr ? 'Koç' : 'Coach'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.fatMuscleRow}>
              <View style={[styles.fatMuscleCard, { backgroundColor: '#ECFDF5' }]}>
                <Text style={styles.fatMuscleIcon}>🟢</Text>
                <Text style={[styles.fatMuscleValue, { color: '#065F46' }]}>{fatLostKg} kg</Text>
                <Text style={[styles.fatMuscleLabel, { color: '#059669' }]}>
                  {isTr ? 'Yağ Kaybı' : 'Fat Lost'}
                </Text>
                <Text style={[styles.fatMusclePct, { color: '#059669' }]}>%{fatPct}</Text>
              </View>
              <View style={[styles.fatMuscleCard, {
                backgroundColor: musclePct >= 50 ? '#FEF2F2' : musclePct >= 30 ? '#FFF7ED' : '#F0FDF4',
              }]}>
                <Text style={styles.fatMuscleIcon}>{musclePct >= 50 ? '🚨' : musclePct >= 30 ? '🟠' : '🟢'}</Text>
                <Text style={[styles.fatMuscleValue, { color: musclePct >= 50 ? '#DC2626' : musclePct >= 30 ? '#92400E' : '#065F46', fontSize: 13, fontWeight: '700' }]}>
                  {musclePct >= 50 ? (isTr ? 'Kritik' : 'Critical') : musclePct >= 30 ? (isTr ? 'Yüksek' : 'High') : (isTr ? 'Düşük' : 'Low')}
                </Text>
                <Text style={[styles.fatMuscleLabel, { color: musclePct >= 50 ? '#EF4444' : musclePct >= 30 ? '#D97706' : '#059669' }]}>
                  {isTr ? 'Kas Riski' : 'Muscle Risk'}
                </Text>
                <Text style={[styles.fatMusclePct, { color: musclePct >= 50 ? '#EF4444' : musclePct >= 30 ? '#D97706' : '#059669' }]}>
                  %{musclePct >= 50 ? '40–50' : musclePct >= 30 ? '25–35' : '10–20'}
                </Text>
              </View>
            </View>

            {/* Fat/muscle split bar */}
            <View style={styles.splitBarRow}>
              <View style={[styles.splitBarSeg, { flex: fatPct, backgroundColor: '#10B981' }]} />
              <View style={[styles.splitBarSeg, { flex: musclePct, backgroundColor: musclePct >= 50 ? '#EF4444' : '#F59E0B' }]} />
            </View>
            <View style={styles.splitBarLegend}>
              <Text style={styles.splitBarLegendText}>🟢 {isTr ? 'Yağ' : 'Fat'} %{fatPct}</Text>
              <Text style={[styles.splitBarLegendText, { color: musclePct >= 50 ? '#EF4444' : '#D97706' }]}>
                {musclePct >= 30 ? '⚠️' : '🟠'} {isTr ? 'Kas' : 'Muscle'} %{musclePct}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              {isTr
                ? 'Hesaplama için daha fazla kilo kaydı gerekiyor.'
                : 'Log more weights to see your fat vs muscle breakdown.'}
            </Text>
          </View>
        )}

        {/* ── 14-Day Projection ── */}
        {showProjection && (
          <>
            <SectionTitle title={isTr ? '📈 14 Günlük Projeksiyon' : '📈 14-Day Projection'} />

            <View style={styles.projectionCard}>
              <Text style={styles.projectionRateLabel}>
                {isTr
                  ? `Günlük hız: ${dailyRate} kg/gün · ${weightHistory.length} ölçümden hesaplandı`
                  : `Daily rate: ${dailyRate} kg/day · from ${weightHistory.length} weigh-ins`}
              </Text>

              {/* ── 3-path comparison table ── */}
              <View style={styles.proj3Row}>

                {/* Path A — current */}
                <View style={[styles.proj3Col, { backgroundColor: musclePct >= 30 ? '#FEF2F2' : '#FFFBEB' }]}>
                  <Text style={styles.proj3ColBadge}>
                    {isTr ? 'Şu Gidişle' : 'As-Is'}
                  </Text>
                  <Text style={styles.proj3KgTotal}>~{projected14} kg</Text>
                  <View style={styles.proj3BarWrap}>
                    <View style={[styles.proj3BarFat, { flex: fatPct }]} />
                    <View style={[styles.proj3BarMuscle, {
                      flex: musclePct,
                      backgroundColor: musclePct >= 30 ? '#EF4444' : '#F59E0B',
                    }]} />
                  </View>
                  <Text style={styles.proj3Fat}>🟢 {isTr ? 'Yağ baskın' : 'Fat dominant'}</Text>
                  <Text style={[styles.proj3Muscle, { color: musclePct >= 30 ? '#DC2626' : '#D97706' }]}>
                    {musclePct >= 30 ? '🚨' : '⚠️'} {isTr
                      ? `Kas riski ${musclePct >= 50 ? 'kritik' : 'yüksek'}`
                      : `Muscle risk ${musclePct >= 50 ? 'critical' : 'high'}`}
                  </Text>
                  <Text style={[styles.proj3RiskRange, { color: musclePct >= 30 ? '#DC2626' : '#D97706' }]}>
                    %{musclePct >= 50 ? '40–50' : '25–35'} {isTr ? 'kas olabilir' : 'may be muscle'}
                  </Text>
                </View>

                {/* Path B — protein */}
                <View style={[styles.proj3Col, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={[styles.proj3ColBadge, { color: '#065F46', backgroundColor: '#D1FAE5' }]}>
                    {isTr ? '+ Protein' : '+ Protein'}
                  </Text>
                  <Text style={styles.proj3KgTotal}>~{projected14} kg</Text>
                  <View style={styles.proj3BarWrap}>
                    <View style={[styles.proj3BarFat, { flex: 95 }]} />
                    <View style={[styles.proj3BarMuscle, { flex: 5, backgroundColor: '#10B981' }]} />
                  </View>
                  <Text style={styles.proj3Fat}>🟢 {isTr ? 'Yağ baskın' : 'Fat dominant'}</Text>
                  <Text style={[styles.proj3Muscle, { color: '#059669' }]}>
                    ✅ {isTr ? 'Kas riski düşük' : 'Muscle risk low'}
                  </Text>
                  <Text style={[styles.proj3RiskRange, { color: '#059669' }]}>
                    %5 {isTr ? 'kas olabilir' : 'may be muscle'}
                  </Text>
                </View>

                {/* Path C — protein + exercise */}
                <View style={[styles.proj3Col, { backgroundColor: '#EEF2FF', borderWidth: 1.5, borderColor: '#A5B4FC' }]}>
                  <Text style={[styles.proj3ColBadge, { color: '#3730A3', backgroundColor: '#C7D2FE' }]}>
                    {isTr ? '+ Egzersiz' : '+ Exercise'}
                  </Text>
                  <Text style={styles.proj3KgTotal}>~{projected14} kg</Text>
                  <View style={styles.proj3BarWrap}>
                    <View style={[styles.proj3BarFat, { flex: 98 }]} />
                    <View style={[styles.proj3BarMuscle, { flex: 2, backgroundColor: '#6366F1' }]} />
                  </View>
                  <Text style={styles.proj3Fat}>🟢 {isTr ? 'Yağ baskın' : 'Fat dominant'}</Text>
                  <Text style={[styles.proj3Muscle, { color: '#4F46E5' }]}>
                    💪 {isTr ? 'Kas riski minimum' : 'Muscle risk minimal'}
                  </Text>
                  <Text style={[styles.proj3RiskRange, { color: '#4F46E5' }]}>
                    %2 {isTr ? 'kas olabilir' : 'may be muscle'}
                  </Text>
                </View>

              </View>

              {/* ── Action tips ── */}
              <View style={styles.projTipsWrap}>

                {musclePct >= 30 && (
                  <View style={styles.projTip}>
                    <Text style={styles.projTipIcon}>🥩</Text>
                    <Text style={styles.projTipText}>
                      {isTr
                        ? `Günlük protein hedefine ulaşırsan kas kaybı oranı %${musclePct}'ten yaklaşık %5'e düşebilir.`
                        : `Hitting your daily protein target could bring muscle loss rate from ~${musclePct}% down to ~5%.`}
                    </Text>
                  </View>
                )}

                <View style={[styles.projTip, { backgroundColor: '#EEF2FF' }]}>
                  <Text style={styles.projTipIcon}>💪</Text>
                  <Text style={styles.projTipText}>
                    {isTr
                      ? `Haftada 2–3 direnç egzersizi kas kaybı riskini ciddi ölçüde azaltabilir — metabolizmanız daha iyi korunabilir.`
                      : `2–3 resistance sessions/week can significantly reduce muscle loss risk — your metabolism stays better protected.`}
                  </Text>
                </View>

                <View style={[styles.projTip, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={styles.projTipIcon}>🏆</Text>
                  <Text style={styles.projTipText}>
                    {isTr
                      ? `Protein + egzersiz kombinasyonu en güçlü senaryo — kas kaybı riski minimum seviyeye inebilir ve metabolizma hızı korunabilir.`
                      : `Protein + exercise is the strongest combination — muscle loss risk may drop to minimal and your metabolism stays protected.`}
                  </Text>
                </View>

              </View>

              {/* ── Disclaimer ── */}
              <Text style={styles.projDisclaimer}>
                {isTr
                  ? `📋 Bu tahminler protein alımı, kilo kaybı hızı ve aktivite düzeyine dayanmaktadır. Gerçek sonuçlar kişiye göre değişebilir.`
                  : `📋 Estimates are based on protein intake, weight loss rate, and activity level. Actual results may vary.`}
              </Text>
            </View>
          </>
        )}

        {/* ── Muscle Preservation Score ── */}
        <SectionTitle
          title={isTr ? '🧠 Kas Sağlığı' : '🧠 Muscle Health'}
        />
        <View style={styles.scoreCard}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.scoreCardEmoji}>{muscleScoreInfo.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scoreCardLabel, { color: muscleScoreInfo.color }]}>
                {muscleScoreInfo.label}
              </Text>
              <Text style={styles.scoreCardDesc}>{muscleScoreInfo.desc}</Text>
            </View>
            <Text style={[styles.scoreValue, { color: muscleScoreInfo.color }]}>
              {muscleScore}
            </Text>
          </View>

          {/* Horizontal progress bar */}
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(muscleScore, 100)}%`,
                  backgroundColor: muscleScoreInfo.color,
                },
              ]}
            />
          </View>
          <View style={styles.progressBarLabels}>
            <Text style={styles.progressBarMin}>0</Text>
            <Text style={styles.progressBarMax}>100</Text>
          </View>

          {/* Factor breakdown */}
          <View style={styles.scoreFactors}>
            <View style={styles.scoreFactor}>
              <Text style={styles.scoreFactorDot}>
                {proteinRatio >= 0.8 ? '🟢' : proteinRatio >= 0.6 ? '🟡' : '🔴'}
              </Text>
              <Text style={styles.scoreFactorText}>
                {isTr
                  ? `Protein: ${proteinRatio >= 0.8 ? 'İyi' : proteinRatio >= 0.6 ? 'Yetersiz' : 'Kritik'}`
                  : `Protein: ${proteinRatio >= 0.8 ? 'Good' : proteinRatio >= 0.6 ? 'Low' : 'Critical'}`}
              </Text>
            </View>
            <View style={styles.scoreFactor}>
              <Text style={styles.scoreFactorDot}>
                {exerciseDays >= 2 ? '🟢' : exerciseDays >= 1 ? '🟡' : '🔴'}
              </Text>
              <Text style={styles.scoreFactorText}>
                {isTr
                  ? `Egzersiz: ${exerciseDays >= 2 ? 'Aktif' : exerciseDays >= 1 ? 'Az' : 'Yok'}`
                  : `Exercise: ${exerciseDays >= 2 ? 'Active' : exerciseDays >= 1 ? 'Low' : 'None'}`}
              </Text>
            </View>
            <View style={styles.scoreFactor}>
              <Text style={styles.scoreFactorDot}>
                {weeklyRate <= 0.5 ? '🟢' : weeklyRate <= 1.0 ? '🟡' : '🔴'}
              </Text>
              <Text style={styles.scoreFactorText}>
                {isTr
                  ? `Kayıp hızı: ${weeklyRate <= 0.5 ? 'Normal' : weeklyRate <= 1.0 ? 'Orta' : 'Hızlı'}`
                  : `Loss rate: ${weeklyRate <= 0.5 ? 'Normal' : weeklyRate <= 1.0 ? 'Moderate' : 'Fast'}`}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Rebound Risk ── */}
        <SectionTitle title={isTr ? '⚡ Geri Alım Riski' : '⚡ Rebound Risk'} />
        <View style={[styles.riskCard, { backgroundColor: reboundInfo.bg }]}>
          <View style={styles.riskCardRow}>
            <Text style={styles.riskCardEmoji}>{reboundInfo.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.riskCardLabel, { color: reboundInfo.color }]}>
                {reboundInfo.label}
              </Text>
              <Text style={styles.riskCardDesc}>{reboundInfo.desc}</Text>
            </View>
          </View>
          {riskData.factors.length > 0 && (
            <View style={styles.riskFactors}>
              <Text style={styles.riskFactorsTitle}>
                {isTr ? 'Risk faktörleri:' : 'Risk factors:'}
              </Text>
              {riskData.factors.map((f, i) => (
                <Text key={i} style={styles.riskFactor}>✗ {f}</Text>
              ))}
            </View>
          )}
        </View>

        {/* ── Motivational Protein Card ── */}
        <SectionTitle title={isTr ? '💡 Günlük Protein Hedefi' : '💡 Daily Protein Goal'} />

        {/* "Why X grams?" explanation */}
        {profile?.weight && (
          <View style={styles.proteinWhyCard}>
            <Text style={styles.proteinWhyText}>
              {isTr
                ? `Neden ${proteinTarget}g? → ${profile.weight} kg × 1,6 g/kg = kas koruması için bilimsel minimum. Direnç egzersizi yapılan günlerde 2,0 g/kg'a çıkmak kas kaybını daha da azaltabilir.`
                : `Why ${proteinTarget}g? → ${profile.weight} kg × 1.6 g/kg = scientific minimum for muscle preservation. On resistance training days, 2.0 g/kg may further reduce muscle loss.`}
            </Text>
            <View style={styles.proteinThresholds}>
              <View style={[styles.proteinThresholdPill, { backgroundColor: '#FEE2E2' }]}>
                <Text style={styles.proteinThresholdPillText}>
                  {isTr ? `<${Math.round(proteinTarget * 0.6)}g 🚨 Risk` : `<${Math.round(proteinTarget * 0.6)}g 🚨 Risk`}
                </Text>
              </View>
              <View style={[styles.proteinThresholdPill, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.proteinThresholdPillText}>
                  {`${Math.round(proteinTarget * 0.6)}–${Math.round(proteinTarget * 0.8)}g ⚠️`}
                </Text>
              </View>
              <View style={[styles.proteinThresholdPill, { backgroundColor: '#ECFDF5' }]}>
                <Text style={styles.proteinThresholdPillText}>
                  {`>${Math.round(proteinTarget * 0.8)}g ✅`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {proteinMet ? (
          <View style={[styles.proteinActionCard, { backgroundColor: '#ECFDF5' }]}>
            <Text style={styles.proteinActionEmoji}>🎯</Text>
            <Text style={[styles.proteinActionTitle, { color: '#065F46' }]}>
              {isTr
                ? 'Günlük protein hedefinize ulaştınız! Kaslarınızı harika koruyorsunuz.'
                : 'Daily protein target reached! Great job protecting your muscles today.'}
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '100%', backgroundColor: '#10B981' }]} />
            </View>
            <Text style={styles.proteinProgressLabel}>
              {analyzedTodayProtein}g / {proteinTarget}g
            </Text>
          </View>
        ) : (
          <View style={[styles.proteinActionCard, {
            backgroundColor: proteinProgressPct < 0.6 ? '#FEF2F2' : proteinProgressPct < 0.8 ? '#FFFBEB' : '#EEF2FF',
          }]}>
            <Text style={styles.proteinActionEmoji}>
              {proteinProgressPct < 0.6 ? '🚨' : proteinProgressPct < 0.8 ? '⚠️' : '💪'}
            </Text>
            <Text style={[styles.proteinActionTitle, {
              color: proteinProgressPct < 0.6 ? '#DC2626' : proteinProgressPct < 0.8 ? '#D97706' : '#3730A3',
            }]}>
              {isTr
                ? `${remainingProtein}g kalmış. ${
                    remainingProtein <= 30
                      ? '1 yumurta (7g) + yoğurt (10g) + peynir (8g).'
                      : remainingProtein <= 60
                      ? '150g tavuk göğsü (35g) + Yunan yoğurdu (20g).'
                      : '200g ton balığı (40g) + 2 yumurta (14g) + yoğurt (20g).'
                  }`
                : `${remainingProtein}g left. ${
                    remainingProtein <= 30
                      ? '1 egg (7g) + yogurt (10g) + cheese (8g).'
                      : remainingProtein <= 60
                      ? '150g chicken breast (35g) + Greek yogurt (20g).'
                      : '200g tuna (40g) + 2 eggs (14g) + yogurt (20g).'
                  }`}
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[
                styles.progressBarFill,
                {
                  width: `${Math.round(proteinProgressPct * 100)}%`,
                  backgroundColor: proteinProgressPct < 0.6 ? '#EF4444' : proteinProgressPct < 0.8 ? '#F59E0B' : '#4F46E5',
                },
              ]} />
            </View>
            <Text style={styles.proteinProgressLabel}>
              {analyzedTodayProtein}g / {proteinTarget}g ({Math.round(proteinProgressPct * 100)}%)
            </Text>
          </View>
        )}

        {/* ── After GLP-1 Tips ── */}
        <SectionTitle title={isTr ? '🔄 GLP-1 Sonrası Yaşam' : '🔄 Life After GLP-1'} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tipsScroll}
        >
          {afterTips.map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <View style={[styles.tipIconCircle, { backgroundColor: tip.iconBg }]}>
                <Text style={styles.tipIcon}>{tip.icon}</Text>
              </View>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Coach Chat Modal ── */}
      <Modal visible={chatVisible} animationType="slide" transparent onRequestClose={() => setChatVisible(false)}>
        <View style={styles.chatOverlay}>
          <TouchableOpacity style={styles.chatBackdrop} onPress={() => setChatVisible(false)} activeOpacity={1} />
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
                  <Text style={styles.chatName}>{isTr ? 'GLP-1 Koçun' : 'Your GLP-1 Coach'}</Text>
                  <Text style={styles.chatStatus}>
                    {isTr
                      ? `Bugün ${analyzedTodayProtein}g protein`
                      : `${analyzedTodayProtein}g protein today`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatVisible(false)} style={styles.chatClose}>
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
                    <ActivityIndicator size="small" color="#4F46E5" />
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
                  <TouchableOpacity key={i} style={styles.quickPrompt} onPress={() => setChatInput(q)}>
                    <Text style={styles.quickPromptText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder={isTr ? 'Koçuna bir şey sor...' : 'Ask your coach anything...'}
                placeholderTextColor="#9CA3AF"
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                maxLength={300}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!chatInput.trim() || chatLoading) && styles.sendBtnDisabled]}
                onPress={handleSendChat}
                disabled={!chatInput.trim() || chatLoading}
              >
                <Text style={styles.sendBtnText}>➤</Text>
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
              <Text style={styles.modalTitle}>{t('logWeight')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t('weightPlaceholder')}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setLogWeightVisible(false);
                    setWeightInput('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, savingWeight && { opacity: 0.7 }]}
                  onPress={handleSaveWeight}
                  disabled={savingWeight}
                >
                  {savingWeight ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('save')}</Text>
                  )}
                </TouchableOpacity>
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
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 24, paddingTop: 16 },

  // ── Hero Card ──
  heroCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heroGreeting: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  heroWeight: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroWeightEmpty: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCoachBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroCoachBtnEmoji: { fontSize: 20 },
  heroLogBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroLogBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

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
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  chatHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#4F46E5', padding: 14,
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarEmoji: { fontSize: 20 },
  chatName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  chatStatus: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  chatClose: { padding: 8 },
  chatCloseText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  chatMessages: { flex: 1 },
  bubble: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleCoach: { justifyContent: 'flex-start' },
  bubbleEmoji: { fontSize: 18, marginRight: 6, marginBottom: 4 },
  bubbleText: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleTextUser: { backgroundColor: '#4F46E5', borderBottomRightRadius: 4 },
  bubbleTextCoach: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  bubbleMsg: { fontSize: 14, lineHeight: 20 },
  bubbleMsgUser: { color: '#FFF' },
  bubbleMsgCoach: { color: '#111827' },
  quickPrompts: { flexShrink: 0, maxHeight: 70, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  quickPrompt: {
    backgroundColor: '#EEF2FF', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  quickPromptText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  chatInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    color: '#111827', maxHeight: 100, backgroundColor: '#F9FAFB',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#4F46E5',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#C7D2FE' },
  sendBtnText: { color: '#FFF', fontSize: 18 },
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
    fontWeight: '700',
  },

  // ── Body Stats Row ──
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  statEmoji: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statUnit: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 1 },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginTop: 2 },
  statBmiTag: { fontSize: 11, fontWeight: '700', marginTop: 2 },

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
  stepCount: { fontSize: 20, fontWeight: '800' },
  stepGoal: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  stepMsg: { fontSize: 12, color: '#374151', marginTop: 3, lineHeight: 17 },
  stepBarBg: {
    height: 8, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden',
  },
  stepBarFill: { height: '100%', borderRadius: 4 },

  // ── Streak Banner ──
  streakBanner: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Section Title ──
  sectionTitleRow: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  // ── Locked coach message card ──
  lockedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  lockedContent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  lockedEmoji: { fontSize: 28 },
  lockedTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  lockedSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  lockedOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 10,
  },
  lockedOverlayIcon: { fontSize: 18 },
  upgradeBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  upgradeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

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
  muscleAlertTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  muscleAlertDesc: { fontSize: 12, color: '#374151', lineHeight: 17 },
  muscleAlertBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  muscleAlertBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },

  // ── Fat vs Muscle Loss ──
  fatMuscleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  fatMuscleCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  fatMuscleIcon: { fontSize: 20, marginBottom: 4 },
  fatMuscleValue: { fontSize: 26, fontWeight: '800' },
  fatMuscleLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  fatMusclePct: { fontSize: 11, fontWeight: '700', marginTop: 2, opacity: 0.8 },
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
  splitBarLegendText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  // ── 14-Day Projection ──
  projectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  projectionRateLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 12, textAlign: 'center' },

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
    color: '#92400E',
    backgroundColor: '#FDE68A',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  proj3KgTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
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
  proj3BarFat: { backgroundColor: '#10B981' },
  proj3BarMuscle: {},
  proj3Fat: { fontSize: 11, fontWeight: '600', color: '#059669', textAlign: 'center' },
  proj3Muscle: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  proj3RiskRange: { fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 1 },

  // Action tips
  projDisclaimer: {
    marginTop: 10,
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  projTipsWrap: { gap: 8 },
  projTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  projTipIcon: { fontSize: 16, marginTop: 1 },
  projTipText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500', lineHeight: 18 },

  // ── Protein Why Card ──
  proteinWhyCard: {
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  proteinWhyText: { fontSize: 13, fontWeight: '600', color: '#3730A3', marginBottom: 8, lineHeight: 18 },
  proteinThresholds: { flexDirection: 'row', gap: 6 },
  proteinThresholdPill: { flex: 1, borderRadius: 8, paddingVertical: 4, alignItems: 'center' },
  proteinThresholdPillText: { fontSize: 10, fontWeight: '700', color: '#374151' },

  // ── Risk Factors ──
  riskFactors: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  riskFactorsTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  riskFactor: { fontSize: 12, color: '#6B7280', marginBottom: 3, lineHeight: 16 },

  // ── Empty state ──
  emptyCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyCardText: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  // ── Muscle Score Card ──
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  scoreCardEmoji: { fontSize: 22, marginTop: 1 },
  scoreCardLabel: { fontSize: 15, fontWeight: '700' },
  scoreCardDesc: { fontSize: 13, color: '#6B7280', marginTop: 3, lineHeight: 18 },
  scoreValue: { fontSize: 26, fontWeight: '800' },

  // ── Shared progress bar ──
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressBarMin: { fontSize: 11, color: '#9CA3AF' },
  progressBarMax: { fontSize: 11, color: '#9CA3AF' },

  scoreFactors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  scoreFactor: { alignItems: 'center', flex: 1 },
  scoreFactorDot: { fontSize: 14, marginBottom: 2 },
  scoreFactorText: { fontSize: 11, color: '#6B7280', textAlign: 'center', fontWeight: '500' },

  // ── Rebound Risk Card ──
  riskCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  riskCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  riskCardEmoji: { fontSize: 22, marginTop: 1 },
  riskCardLabel: { fontSize: 15, fontWeight: '700' },
  riskCardDesc: { fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 18 },

  // ── Protein Action Card ──
  proteinActionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  proteinActionEmoji: { fontSize: 22, marginBottom: 6 },
  proteinActionTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 12 },
  proteinProgressLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '500',
  },

  // ── After GLP-1 Tips ──
  tipsScroll: { paddingRight: 24, paddingBottom: 4 },
  tipCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
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
  tipTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 6 },
  tipText: { fontSize: 12, color: '#6B7280', lineHeight: 18 },

  // ── Log Weight Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  modalButtons: { flexDirection: 'row', marginTop: 20, gap: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#374151', fontWeight: '600', fontSize: 16 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
