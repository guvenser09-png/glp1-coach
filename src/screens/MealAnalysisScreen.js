import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getUserProfile } from '../services/firestoreService';
import { analyzeMealWithAI, analyzeMealWithText } from '../services/openaiService';
import { isAIConfigured } from '../services/aiClient';
import { getTodayMeals, addMeal, deleteMeal, updateMeal, getMealLogs } from '../services/firestoreService';
import { getWeightLogs } from '../services/firestoreService';
import { calculateReboundRisk } from '../utils/heuristics';
import { assessMuscleProtection, notClinicalNote } from '../utils/muscle';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import { getMedicationProfile } from '../services/medicationService';
import { sendCoachMessage } from '../services/coachChatService';
import AIConsentModal from '../components/AIConsentModal';
import MayaAvatar from '../components/MayaAvatar';
import { scheduleDailyMotivation } from '../services/notificationService';
import * as healthkitService from '../services/healthkitService';
import { useGamification } from '../context/GamificationContext';
import { useUnit } from '../context/UnitContext';
import { fontFamily, typography, spacing, radii, useTheme } from '../theme';
import { Screen, Card, GradientHero, PrimaryButton, SecondaryButton, Chip, SectionTitle, Badge, Ring, ProgressBar } from '../components/ui';
import { getReboundRiskContent } from '../utils/mealAnalysis';
import { makeStyles } from './mealAnalysis/styles';

const FREE_DAILY_LIMIT = 2;

export default function MealAnalysisScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { completeMission, earnXP } = useGamification();
  const { formatWeight } = useUnit();
  const { colors, semantic, shadow } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors, semantic, shadow), [colors, semantic, shadow]);
  const isTr = language === 'tr';

  const [imageUri, setImageUri] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [aiConsentVisible, setAiConsentVisible] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState(null);

  // Manual entry modal
  const [manualVisible, setManualVisible] = useState(false);
  const [manualAnalyzing, setManualAnalyzing] = useState(false);
  const [manualResult, setManualResult] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [manualFood, setManualFood] = useState('');
  const [manualPortion, setManualPortion] = useState('Medium');
  const [profile, setProfile] = useState(null);

  // Coach context: GLP-1 medication profile + recent weight history (optional/guarded)
  const [medProfile, setMedProfile] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);

  // 7-day analytics for Muscle Health / Weekly Report sections
  const [avgProteinRatio, setAvgProteinRatio] = useState(0);
  const [dailyProtein, setDailyProtein] = useState([]); // 7 day rows (oldest→newest)

  // Exercise logging
  const [exercises, setExercises] = useState([]);
  const [exerciseType, setExerciseType] = useState(null);
  const [exerciseDuration, setExerciseDuration] = useState(30);
  const [exerciseIntensity, setExerciseIntensity] = useState('moderate');
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [editExerciseIndex, setEditExerciseIndex] = useState(null);

  // Apple Watch / HealthKit
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthAuthorized, setHealthAuthorized] = useState(false);
  const [watchActiveEnergy, setWatchActiveEnergy] = useState(null); // kcal today
  const [latestHeartRate, setLatestHeartRate] = useState(null);     // bpm
  const [restingHeartRate, setRestingHeartRate] = useState(null);   // bpm
  const [healthLoading, setHealthLoading] = useState(false);

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


  const today = new Date().toISOString().split('T')[0];
  // Meals now live in Supabase (meal_logs) — no more daily_meals_ AsyncStorage key.
  const todayExerciseKey = user ? `daily_exercise_${user.uid}_${today}` : null;
  const freeAnalysesKey = user ? `free_analyses_${user.uid}_${today}` : null;

  const [freeAnalysesUsed, setFreeAnalysesUsed] = useState(0);

  useEffect(() => {
    if (!freeAnalysesKey) return;
    AsyncStorage.getItem(freeAnalysesKey).then(raw => {
      if (raw) setFreeAnalysesUsed(parseInt(raw, 10) || 0);
    });
  }, [freeAnalysesKey]);

  async function incrementFreeCount() {
    const next = freeAnalysesUsed + 1;
    setFreeAnalysesUsed(next);
    if (freeAnalysesKey) await AsyncStorage.setItem(freeAnalysesKey, String(next));
  }

  // Paywall removed — meal analysis is unlimited for all users.
  function checkFreeLimit() {
    return true;
  }

  const EXERCISE_TYPES = [
    { id: 'weights',    emoji: '🏋️', en: 'Weight Training', tr: 'Ağırlık',   met: 5.0,  muscleBoost: 'high' },
    { id: 'hiit',       emoji: '⚡',  en: 'HIIT',            tr: 'HIIT',      met: 10.0, muscleBoost: 'medium' },
    { id: 'running',    emoji: '🏃',  en: 'Running',         tr: 'Koşu',      met: 9.0,  muscleBoost: 'low' },
    { id: 'walking',    emoji: '🚶',  en: 'Walking',         tr: 'Yürüyüş',  met: 3.5,  muscleBoost: 'low' },
    { id: 'cycling',    emoji: '🚴',  en: 'Cycling',         tr: 'Bisiklet',  met: 7.5,  muscleBoost: 'low' },
    { id: 'yoga',       emoji: '🧘',  en: 'Yoga',            tr: 'Yoga',      met: 2.5,  muscleBoost: 'low' },
    { id: 'swimming',   emoji: '🏊',  en: 'Swimming',        tr: 'Yüzme',    met: 8.0,  muscleBoost: 'medium' },
    { id: 'basketball', emoji: '🏀',  en: 'Basketball',      tr: 'Basketbol', met: 8.0,  muscleBoost: 'medium' },
    { id: 'football',   emoji: '⚽',  en: 'Football',        tr: 'Futbol',    met: 7.0,  muscleBoost: 'low' },
  ];
  const DURATIONS = [15, 30, 45, 60, 90];
  const INTENSITIES = [
    { id: 'light',    en: 'Light',    tr: 'Hafif',    mult: 0.7 },
    { id: 'moderate', en: 'Moderate', tr: 'Orta',     mult: 1.0 },
    { id: 'intense',  en: 'Intense',  tr: 'Yoğun',   mult: 1.4 },
  ];

  // MET formülü: kalori = MET × kilo(kg) × süre(saat) × yoğunluk
  const calcCalories = (met, durationMin, intensityMult, weightKg) => {
    const w = weightKg || 75;
    return Math.round(met * w * (durationMin / 60) * intensityMult);
  };

  // Today's meals come FROM Supabase (meal_logs), oldest->newest. Guarded so a
  // network hiccup just leaves the current list intact instead of crashing.
  const loadTodayMeals = useCallback(async () => {
    if (!user) return;
    try {
      const meals = await getTodayMeals(user.uid);
      if (Array.isArray(meals)) setTodayMeals(meals);
    } catch (e) {}
  }, [user]);

  useEffect(() => { loadTodayMeals(); }, [loadTodayMeals]);
  useFocusEffect(useCallback(() => { loadTodayMeals(); }, [loadTodayMeals]));

  useEffect(() => {
    if (!todayExerciseKey) return;
    AsyncStorage.getItem(todayExerciseKey).then(raw => { if (raw) setExercises(JSON.parse(raw)); });
  }, [todayExerciseKey]);

  // ── 7-day protein/calorie scan for the daily insights sections ──────────────
  const loadWeeklyAnalytics = useCallback(async () => {
    if (!user) return;
    try {
      const userWeight = profile?.weight || 70;
      const userGender = profile?.gender;
      const bmr = Math.round(userWeight * (userGender === 'male' ? 24 : userGender === 'female' ? 22 : 23));
      const target = profile?.proteinTarget ?? 120;
      const DAY_NAMES_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let totalRatio = 0;
      let daysWithData = 0;
      const rows = [];
      // Meals now live in Supabase (meal_logs). Fetch once and group by date,
      // instead of the dead AsyncStorage `daily_meals_` key (nothing writes it).
      const allMeals = await getMealLogs(user.uid);
      const byDate = {};
      for (const m of Array.isArray(allMeals) ? allMeals : []) {
        const k = m.date;
        if (!k) continue;
        if (!byDate[k]) byDate[k] = { grams: 0, foodCal: 0, count: 0 };
        byDate[k].grams += m.protein || 0;
        byDate[k].foodCal += m.calories || 0;
        byDate[k].count += 1;
      }
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = isTr ? DAY_NAMES_TR[d.getDay()] : DAY_NAMES_EN[d.getDay()];
        let exList = [];
        try {
          const rawEx = await AsyncStorage.getItem(`daily_exercise_${user.uid}_${dateStr}`);
          exList = rawEx ? JSON.parse(rawEx) : [];
        } catch { exList = []; }
        const exerciseCal = exList.reduce((s, e) => s + (e.caloriesBurned || 0), 0);
        const day = byDate[dateStr];
        if (day && day.count > 0) {
          const grams = day.grams;
          const foodCal = day.foodCal;
          const balance = foodCal > 0 ? foodCal - (bmr + exerciseCal) : null;
          totalRatio += target > 0 ? grams / target : 0;
          daysWithData++;
          rows.push({ dayName, grams, target, ratio: target > 0 ? grams / target : 0, hasData: true, foodCal, exerciseCal, bmr, balance });
        } else {
          rows.push({ dayName, grams: 0, target, ratio: 0, hasData: false, foodCal: 0, exerciseCal: 0, bmr, balance: null });
        }
      }
      setDailyProtein(rows);
      setAvgProteinRatio(daysWithData > 0 ? totalRatio / daysWithData : 0);
    } catch {
      // best-effort — show zeros
    }
  }, [user, profile, isTr]);

  useEffect(() => { loadWeeklyAnalytics(); }, [loadWeeklyAnalytics]);
  useFocusEffect(useCallback(() => { loadWeeklyAnalytics(); }, [loadWeeklyAnalytics]));

  useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then(p => { if (p) setProfile(p); });
      // Optional coach context — guarded; nulls/empties are fine if unavailable.
      getMedicationProfile(user.uid).then(m => { if (m) setMedProfile(m); }).catch(() => {});
      getWeightLogs(user.uid).then(logs => {
        if (Array.isArray(logs)) {
          setWeightHistory(
            logs.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          );
        }
      }).catch(() => {});
    }
    scheduleDailyMotivation(language);
  }, [user]);

  // ── Apple Watch / HealthKit ────────────────────────────────────────────────
  const refreshHealthData = useCallback(async () => {
    if (!healthAvailable || !healthAuthorized) return;
    setHealthLoading(true);
    try {
      const [energy, hr, resting] = await Promise.all([
        healthkitService.getTodayActiveEnergy(),
        healthkitService.getLatestHeartRate(),
        healthkitService.getRestingHeartRate(),
      ]);
      setWatchActiveEnergy(typeof energy === 'number' ? energy : null);
      setLatestHeartRate(typeof hr === 'number' ? hr : null);
      setRestingHeartRate(typeof resting === 'number' ? resting : null);
    } catch {
      // graceful degradation — keep prior values / manual estimate
    } finally {
      setHealthLoading(false);
    }
  }, [healthAvailable, healthAuthorized]);

  // Probe availability once on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const available = await healthkitService.isHealthAvailable();
        if (mounted) setHealthAvailable(!!available);
      } catch {
        if (mounted) setHealthAvailable(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Connect = request permission, then pull data.
  const connectAppleWatch = useCallback(async () => {
    setHealthLoading(true);
    try {
      const ok = await healthkitService.requestHealthPermissions();
      setHealthAuthorized(!!ok);
      if (ok) {
        const [energy, hr, resting] = await Promise.all([
          healthkitService.getTodayActiveEnergy(),
          healthkitService.getLatestHeartRate(),
          healthkitService.getRestingHeartRate(),
        ]);
        setWatchActiveEnergy(typeof energy === 'number' ? energy : null);
        setLatestHeartRate(typeof hr === 'number' ? hr : null);
        setRestingHeartRate(typeof resting === 'number' ? resting : null);
      } else {
        Alert.alert(
          isTr ? 'Bağlanılamadı' : 'Could not connect',
          isTr
            ? 'Apple Sağlık erişimine izin verilmedi. Ayarlar > Gizlilik > Sağlık üzerinden açabilirsiniz.'
            : 'Apple Health access was not granted. You can enable it in Settings > Privacy > Health.'
        );
      }
    } catch {
      Alert.alert(
        isTr ? 'Hata' : 'Error',
        isTr ? 'Apple Watch verisi alınamadı.' : 'Could not read Apple Watch data.'
      );
    } finally {
      setHealthLoading(false);
    }
  }, [isTr]);

  // Refresh whenever the screen regains focus (if connected).
  useFocusEffect(
    useCallback(() => {
      refreshHealthData();
    }, [refreshHealthData])
  );

  const proteinTarget = profile?.proteinTarget ?? 120;

  function doOpenChat() {
    setChatMessages([{
      role: 'assistant',
      content: isTr
        ? `Merhaba! Ben Maya, GLP-1 Coach wellness rehberin 💪 Bugünkü öğünlerini görüyorum. Sana nasıl yardımcı olabilirim?`
        : `Hey! I'm Maya, your GLP-1 Coach wellness guide 💪 I can see your meals today. How can I help you?`,
    }]);
    setChatVisible(true);
  }

  async function openChat() {
    // Gate AI coach behind one-time consent (chat text leaves the device for AI).
    const consentGiven = await AsyncStorage.getItem('ai_consent_given');
    if (!consentGiven) {
      setPendingAnalysis('chat');
      setAiConsentVisible(true);
      return;
    }
    doOpenChat();
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
      // Latest weigh-in.
      const currentWeight =
        weightHistory.length > 0
          ? weightHistory[weightHistory.length - 1].weight
          : (profile?.weight ?? null);
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

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!picked.canceled && picked.assets.length > 0) {
      setImageUri(picked.assets[0].uri);
      setResult(null);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        isTr ? 'İzin gerekli' : 'Permission required',
        isTr ? 'Kamera erişimine izin verin.' : 'Please allow camera access.'
      );
      return;
    }
    const photo = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!photo.canceled && photo.assets.length > 0) {
      setImageUri(photo.assets[0].uri);
      setResult(null);
    }
  }

  async function handleAnalyze() {
    if (!imageUri) return;
    if (!checkFreeLimit()) return;
    const consentGiven = await AsyncStorage.getItem('ai_consent_given');
    if (!consentGiven) {
      setPendingAnalysis('image');
      setAiConsentVisible(true);
      return;
    }
    runAnalyze();
  }

  async function runAnalyze() {
    // No AI key → photo can't be "seen". Route to manual entry (offline estimate)
    // instead of showing an error.
    if (!isAIConfigured()) {
      Alert.alert(
        isTr ? 'Fotoğrafı Yazın' : 'Describe the Photo',
        isTr
          ? 'Fotoğraf analizi için yapay zekâ anahtarı gerekiyor. Fotoğraftaki yemeği yazın — protein ve kalori otomatik tahmin edilecek.'
          : 'Photo analysis needs an AI key. Type the meal from the photo — protein and calories are estimated automatically.'
      );
      openManualAdd();
      return;
    }
    setAnalyzing(true);
    try {
      const analysis = await analyzeMealWithAI(imageUri, language);
      await incrementFreeCount();
      setResult(analysis);
      // Persist to Supabase (meal_logs) and capture the returned row (incl. id),
      // then recompute the list from what actually got saved.
      const created = user
        ? await addMeal(user.uid, {
            protein: analysis.protein,
            calories: analysis.calories || 0,
            foodType: analysis.foodType,
            portionSize: analysis.portionSize,
            imageUri,
          })
        : null;
      // Keep session-only extras (timestamp for the time label) on the in-memory row.
      const newMeal = {
        ...(created || {
          protein: analysis.protein,
          calories: analysis.calories || 0,
          foodType: analysis.foodType,
          portionSize: analysis.portionSize,
          imageUri,
        }),
        timestamp: new Date().toISOString(),
      };
      const updatedMeals = [...todayMeals, newMeal];
      setTodayMeals(updatedMeals);
      await completeMission('upload_meal');
      await earnXP(10, '📸 Meal analyzed!');
      if (updatedMeals.length >= 3) await completeMission('log_3_meals');
    } catch (e) {
      Alert.alert(
        isTr ? 'Analiz Yapılamadı' : 'Analysis Unavailable',
        String(e?.message || e)
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function openManualAdd() {
    setEditIndex(null);
    setManualFood('');
    setManualResult(null);
    setManualPortion('Medium');
    setManualVisible(true);
  }

  function openEdit(index) {
    const meal = todayMeals[index];
    setEditIndex(index);
    setManualFood(meal.foodType || '');
    setManualResult(null);
    setManualVisible(true);
  }

  async function handleManualAnalyze() {
    if (!manualFood.trim()) {
      Alert.alert('', isTr ? 'Yediğiniz yemeği açıklayın.' : 'Describe what you ate.');
      return;
    }
    // Gate behind one-time consent: when AI is configured the typed meal text is
    // sent to OpenAI, so require the same consent the photo flow uses.
    const consentGiven = await AsyncStorage.getItem('ai_consent_given');
    if (!consentGiven) {
      setPendingAnalysis('manual');
      setAiConsentVisible(true);
      return;
    }
    runManualAnalyze();
  }

  async function runManualAnalyze() {
    if (!checkFreeLimit()) return;
    setManualAnalyzing(true);
    setManualResult(null);
    try {
      const analysis = await analyzeMealWithText(manualFood.trim(), language);
      await incrementFreeCount();
      setManualResult(analysis);
    } catch (e) {
      Alert.alert(isTr ? 'Analiz hatası' : 'Analysis error', String(e?.message || e));
    } finally {
      setManualAnalyzing(false);
    }
  }

  async function handleManualSave() {
    if (!manualResult) {
      await handleManualAnalyze();
      return;
    }
    const portionMultiplier = manualPortion === 'Small' ? 0.75 : manualPortion === 'Large' ? 1.35 : 1;
    const existing = editIndex !== null ? todayMeals[editIndex] : null;
    // Fields that persist to Supabase (meal_logs columns only).
    const persistedFields = {
      foodType: manualResult.foodType,
      protein: Math.round(manualResult.protein * portionMultiplier),
      calories: Math.round(manualResult.calories * portionMultiplier),
      portionSize: manualPortion,
    };
    // Session-only extras kept in memory for richer UI (not stored).
    const sessionExtras = {
      suggestion: manualResult.suggestion,
      muscleScore: manualResult.muscleScore,
      qualityTags: manualResult.qualityTags,
      timestamp: existing ? existing.timestamp : new Date().toISOString(),
    };
    let updated;
    if (existing) {
      // Edit -> persist by id, then reflect locally.
      if (user && existing.id != null) {
        try { await updateMeal(user.uid, existing.id, persistedFields); } catch {}
      }
      const merged = { ...existing, ...persistedFields, ...sessionExtras };
      updated = todayMeals.map((m, i) => (i === editIndex ? merged : m));
      setTodayMeals(updated);
    } else {
      // Add -> insert and capture the returned id.
      const created = user ? await addMeal(user.uid, persistedFields) : null;
      const newMeal = { ...(created || persistedFields), ...sessionExtras };
      updated = [...todayMeals, newMeal];
      setTodayMeals(updated);
      await completeMission('upload_meal');
      await earnXP(20, '🍽️ Meal logged!');
      if (updated.length >= 3) await completeMission('log_3_meals');
    }
    setManualVisible(false);
    setManualResult(null);
    setManualFood('');
  }

  async function saveExercise() {
    if (!exerciseType) {
      Alert.alert('', isTr ? 'Bir spor türü seçin.' : 'Please select a workout type.');
      return;
    }
    const type = EXERCISE_TYPES.find(e => e.id === exerciseType);
    const intensity = INTENSITIES.find(i => i.id === exerciseIntensity);
    const userWeight = profile?.weight || 75;
    const caloriesBurned = calcCalories(type.met, exerciseDuration, intensity.mult, userWeight);
    const entry = {
      type: exerciseType,
      emoji: type.emoji,
      name: isTr ? type.tr : type.en,
      duration: exerciseDuration,
      intensity: exerciseIntensity,
      caloriesBurned,
      weightUsed: userWeight,
      muscleBoost: type.muscleBoost,
      timestamp: new Date().toISOString(),
    };
    let updated;
    if (editExerciseIndex !== null) {
      updated = exercises.map((e, i) => i === editExerciseIndex ? entry : e);
    } else {
      updated = [...exercises, entry];
    }
    setExercises(updated);
    if (todayExerciseKey) await AsyncStorage.setItem(todayExerciseKey, JSON.stringify(updated));
    setExerciseModalVisible(false);
    setExerciseType(null);
    setExerciseDuration(30);
    setExerciseIntensity('moderate');
    setEditExerciseIndex(null);

    if (editExerciseIndex === null) {
      await completeMission('log_workout');
      if (exerciseType === 'weights') await earnXP(35, '🏋️ Weight training bonus!');
    }
  }

  function openEditExercise(index) {
    const ex = exercises[index];
    setEditExerciseIndex(index);
    setExerciseType(ex.type);
    setExerciseDuration(ex.duration);
    setExerciseIntensity(ex.intensity);
    setExerciseModalVisible(true);
  }

  async function handleDeleteExercise(index) {
    Alert.alert(
      isTr ? 'Sil' : 'Delete',
      isTr ? 'Bu egzersizi silmek istiyor musunuz?' : 'Delete this exercise?',
      [
        { text: isTr ? 'İptal' : 'Cancel', style: 'cancel' },
        {
          text: isTr ? 'Sil' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = exercises.filter((_, i) => i !== index);
            setExercises(updated);
            if (todayExerciseKey) await AsyncStorage.setItem(todayExerciseKey, JSON.stringify(updated));
          },
        },
      ]
    );
  }

  async function handleDelete(index) {
    Alert.alert(
      isTr ? 'Sil' : 'Delete',
      isTr ? 'Bu öğünü silmek istiyor musunuz?' : 'Delete this meal entry?',
      [
        { text: isTr ? 'İptal' : 'Cancel', style: 'cancel' },
        {
          text: isTr ? 'Sil' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            const target = todayMeals[index];
            // Optimistic local removal, then delete the row from Supabase by id.
            const updated = todayMeals.filter((_, i) => i !== index);
            setTodayMeals(updated);
            if (user && target?.id != null) {
              try { await deleteMeal(user.uid, target.id); } catch {}
            }
          },
        },
      ]
    );
  }

  function getFoodEmoji(foodType) {
    const t = (foodType || '').toLowerCase();
    if (t.includes('chicken') || t.includes('tavuk')) return '🍗';
    if (t.includes('fish') || t.includes('balık') || t.includes('salmon') || t.includes('somon')) return '🐟';
    if (t.includes('egg') || t.includes('yumurta')) return '🥚';
    if (t.includes('salad') || t.includes('salata')) return '🥗';
    if (t.includes('beef') || t.includes('dana') || t.includes('et')) return '🥩';
    if (t.includes('yogurt') || t.includes('yoğurt')) return '🥛';
    if (t.includes('rice') || t.includes('pirinç') || t.includes('makarna') || t.includes('pasta')) return '🍚';
    return '🍽️';
  }

  function formatTime(iso) {
    // Meals loaded from Supabase have no client timestamp — skip the time label
    // rather than render "Invalid Date".
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  }

  const totalProtein = todayMeals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCalories = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalExerciseCal = exercises.reduce((s, e) => s + (e.caloriesBurned || 0), 0);

  // BMR: Erkek = kilo × 24, Kadın = kilo × 22, Bilinmiyor = kilo × 23
  const userWeight = profile?.weight || 70;
  const userGender = profile?.gender;
  const bmr = Math.round(userWeight * (userGender === 'male' ? 24 : userGender === 'female' ? 22 : 23));

  // Apple Watch active energy (kcal burned today) takes priority over the
  // manual MET estimate when available — it reflects ALL movement, not just
  // logged workouts. Fall back to the manual sum otherwise.
  const usingWatchEnergy = watchActiveEnergy != null && watchActiveEnergy > 0;
  const activeCalories = usingWatchEnergy ? watchActiveEnergy : totalExerciseCal;

  // Kalori dengesi: yenilen - (BMR + aktif kalori) → eksi = açık (iyi), artı = fazla (kötü)
  const calBalance = totalCalories > 0 ? totalCalories - (bmr + activeCalories) : null;
  const balanceColor = calBalance === null ? colors.outline : calBalance > 0 ? colors.danger : colors.success;
  const balanceIcon = calBalance === null ? '—' : calBalance > 0 ? '🔴' : '🟢';
  const PORTIONS = ['Small', 'Medium', 'Large'];
  const portionLabel = (p) => ({ Small: isTr ? 'Küçük' : 'Small', Medium: isTr ? 'Orta' : 'Medium', Large: isTr ? 'Büyük' : 'Large' }[p] || p);

  // ── Daily insights: Muscle Health / Weekly Report ──────────
  const exerciseDaysPerWeek = profile?.exerciseDaysPerWeek ?? (exercises.length > 0 ? 1 : 0);
  const todayProteinRatio = proteinTarget > 0 ? totalProtein / proteinTarget : 0;

  // Weight-derived metrics (weightHistory is sorted oldest→newest)
  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : null;
  const totalWeightLost = weightHistory.length >= 2
    ? parseFloat((weightHistory[0].weight - weightHistory[weightHistory.length - 1].weight).toFixed(1))
    : 0;
  const dailyRate = (() => {
    if (weightHistory.length < 2) return 0;
    const first = weightHistory[0];
    const last = weightHistory[weightHistory.length - 1];
    const daysDiff = Math.max(1, Math.round(
      (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
    ));
    return parseFloat(((first.weight - last.weight) / daysDiff).toFixed(2));
  })();
  const weeklyRate = parseFloat((dailyRate * 7).toFixed(1));
  const weeklyLossPercent = currentWeight && dailyRate > 0 ? (weeklyRate / currentWeight) * 100 : 0;

  // Qualitative muscle-protection assessment (audit #10): no fabricated body
  // composition percentages or kg-of-muscle-lost — only a protein-driven trend.
  const muscleProtection = assessMuscleProtection({
    proteinGrams: totalProtein,
    targetGrams: proteinTarget,
    exerciseDaysPerWeek,
    adequacyRatio: avgProteinRatio > 0 ? avgProteinRatio : (todayProteinRatio || undefined),
  });
  const muscleTonePalette = semantic[muscleProtection.toneKey] || semantic.info;

  // Sustainability / rebound risk
  const consecutiveLowProteinDays = (() => {
    let count = 0;
    for (let i = dailyProtein.length - 1; i >= 0; i--) {
      const day = dailyProtein[i];
      if (!day.hasData) break;
      if (day.ratio < 0.8) count++;
      else break;
    }
    return count;
  })();
  const riskData = calculateReboundRisk(weeklyLossPercent, todayProteinRatio, exerciseDaysPerWeek, consecutiveLowProteinDays);
  const reboundInfo = getReboundRiskContent(riskData.level, isTr, colors);

  // 14-day projection
  const projected14 = dailyRate > 0 ? parseFloat((dailyRate * 14).toFixed(1)) : 0;
  const showProjection = projected14 > 0;

  // Weekly report metrics
  const hasWeeklyData = weightHistory.length >= 2;
  const weeklyChange = (() => {
    if (weightHistory.length < 2) return 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recent = weightHistory.filter((l) => new Date(l.date) >= weekAgo);
    return recent.length >= 2
      ? parseFloat((recent[0].weight - recent[recent.length - 1].weight).toFixed(1))
      : 0;
  })();
  const weeklyChangeAbs = Math.abs(weeklyChange);
  const avgPct = Math.max(0, Math.min(1, avgProteinRatio));
  const avgPctLabel = Math.round(avgProteinRatio * 100);

  const weekRangeLabel = (() => {
    const fmt = (dt) => dt.toLocaleDateString(isTr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' });
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  // Weekly insight cards (recommendations), driven by the qualitative
  // protein/muscle-protection trend — no fabricated kg-of-muscle figures.
  const recommendations = (() => {
    const recs = [];
    const weeklyAbs = Math.abs(weeklyChange);
    if (muscleProtection.trend === 'at-risk') {
      recs.push(isTr
        ? `Günlük ${proteinTarget}g protein hedefinizi artırın — kas korumayı desteklemek için.`
        : `Increase daily protein to ${proteinTarget}g to support muscle maintenance.`);
    } else {
      recs.push(isTr
        ? 'Protein alımınız kaslarınızı iyi koruyor. Bu tutarlılığı sürdürün!'
        : 'Your protein intake is protecting your muscles well. Keep up the consistency!');
    }
    if (weeklyAbs > 0 && weeklyAbs / (weeklyAbs + 70) > 0.01) {
      recs.push(isTr
        ? 'Haftalık kilo kaybı hızlı — proteine öncelik verin ve direnç egzersizi ekleyin.'
        : 'Weight loss pace is fast — prioritize protein and add resistance training.');
    } else if (weeklyChange > 0) {
      recs.push(isTr
        ? 'Kilo kaybı hızınız ideal aralıkta. Böyle devam edin!'
        : 'Your weight loss rate is in the ideal range. Keep it up!');
    } else {
      recs.push(isTr
        ? 'Bu hafta kilo değişimi yok. Genel beslenmenizi gözden geçirin.'
        : 'No weight change this week. Review your overall nutrition if needed.');
    }
    recs.push(isTr
      ? 'Tutarlılık en önemli faktör — her gün küçük adımlar büyük sonuçlar doğurur.'
      : 'Keep up the great work! Consistency is key — small daily steps lead to big results.');
    return recs;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AIConsentModal
        visible={aiConsentVisible}
        language={language}
        onAccept={async () => {
          await AsyncStorage.setItem('ai_consent_given', 'true');
          setAiConsentVisible(false);
          const pending = pendingAnalysis;
          setPendingAnalysis(null);
          if (pending === 'image') runAnalyze();
          else if (pending === 'manual') runManualAnalyze();
          else if (pending === 'chat') doOpenChat();
        }}
        onDecline={() => {
          setAiConsentVisible(false);
          setPendingAnalysis(null);
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.headerRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.heading}>{t('mealAnalysis')}</Text>
            <Text style={styles.subheading}>
              {isTr ? 'Fotoğraf çek veya manuel ekle' : 'Analyze a photo or add manually'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.coachBtn}
            onPress={openChat}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Koç ile sohbet et' : 'Chat with coach'}
          >
            <MayaAvatar size={22} style={{ marginRight: 6 }} />
            <Text style={styles.coachBtnText}>Maya</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={takePhoto}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Fotoğraf çek' : 'Take photo'}
          >
            <Text style={styles.photoBtnIcon}>📸</Text>
            <Text style={styles.photoBtnText}>{isTr ? 'Çek' : 'Camera'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={pickImage}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Galeriden seç' : 'Pick from gallery'}
          >
            <Text style={styles.photoBtnIcon}>🖼️</Text>
            <Text style={styles.photoBtnText}>{isTr ? 'Galeri' : 'Gallery'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={openManualAdd}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Manuel öğün ekle' : 'Add meal manually'}
          >
            <Text style={styles.manualBtnIcon}>✏️</Text>
            <Text style={styles.manualBtnText}>{isTr ? 'Manuel' : 'Manual'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exerciseBtn}
            onPress={() => setExerciseModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Egzersiz ekle' : 'Log exercise'}
          >
            <Text style={styles.manualBtnIcon}>🏋️</Text>
            <Text style={styles.exerciseBtnText}>{isTr ? 'Spor' : 'Exercise'}</Text>
          </TouchableOpacity>
        </View>

        {/* Image Picker */}
        {imageUri && (
          <Card padding={0} elevation="md" style={styles.imageCard}>
            <Image source={{ uri: imageUri }} style={styles.pickedImage} resizeMode="cover" />
            <View style={styles.imageActions}>
              <View style={styles.imageActionsTop}>
                <SecondaryButton
                  title={isTr ? '📸 Tekrar Çek' : '📸 Retake'}
                  variant="outline"
                  onPress={takePhoto}
                  fullWidth={false}
                  style={styles.changeBtn}
                />
                <SecondaryButton
                  title={isTr ? '🖼️ Galeri' : '🖼️ Gallery'}
                  variant="outline"
                  onPress={pickImage}
                  fullWidth={false}
                  style={styles.changeBtn}
                />
              </View>
              <PrimaryButton
                title={`🤖 ${isTr ? 'Yapay Zeka ile Analiz Et' : 'Analyze with AI'}`}
                onPress={handleAnalyze}
                loading={analyzing}
                disabled={analyzing}
              />
            </View>
          </Card>
        )}

        {/* Analysis Result */}
        {result && (
          <Card elevation="md" style={styles.resultCard}>
            {/* Header: food name + muscle score */}
            <View style={styles.resultHeaderRow}>
              <Text style={styles.resultFoodType}>{result.foodType}</Text>
              {result.muscleScore && (
                <View style={[styles.muscleScoreBadge, {
                  backgroundColor:
                    result.muscleScore === 'A+' ? '#ECFDF5' :
                    result.muscleScore === 'A'  ? colors.successBg :
                    result.muscleScore === 'B'  ? colors.infoBg :
                    result.muscleScore === 'C'  ? colors.warningBg : colors.dangerBg,
                }]}>
                  <Text style={[styles.muscleScoreText, {
                    color:
                      result.muscleScore === 'A+' ? colors.success :
                      result.muscleScore === 'A'  ? '#047857' :
                      result.muscleScore === 'B'  ? colors.primaryDark :
                      result.muscleScore === 'C'  ? colors.warning : colors.danger,
                  }]}>
                    {result.muscleScore}
                  </Text>
                </View>
              )}
            </View>

            {/* Macro chips — protein highlighted green */}
            <View style={styles.macroChipsRow}>
              <View style={[styles.macroChip, styles.macroChipProtein]}>
                <Text style={styles.macroChipLabel}>{t('proteinEstimate')}</Text>
                <Text style={[styles.macroChipValue, styles.macroChipValueProtein]}>{result.protein}g</Text>
              </View>
              <View style={styles.macroChip}>
                <Text style={styles.macroChipLabel}>{isTr ? 'Kalori' : 'Calories'}</Text>
                <Text style={styles.macroChipValue}>{result.calories} kcal</Text>
              </View>
              <View style={styles.macroChip}>
                <Text style={styles.macroChipLabel}>{t('portionSize')}</Text>
                <Text style={styles.macroChipValue}>{portionLabel(result.portionSize)}</Text>
              </View>
            </View>

            {/* Quality tags */}
            {result.qualityTags?.length > 0 && (
              <View style={styles.qualityTagsRow}>
                {result.qualityTags.map((tag, i) => (
                  <View key={i} style={styles.qualityTag}>
                    <Text style={styles.qualityTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Protein verdict badge */}
            <View style={styles.verdictRow}>
              <Badge
                label={result.sufficient ? `✅ ${t('sufficient')}` : `⚠️ ${t('insufficient')}`}
                tone={result.sufficient ? 'success' : 'warning'}
              />
            </View>

            {/* Suggestion */}
            {result.suggestion ? (
              <Text style={styles.suggestionText}>💡 {isTr ? result.suggestionTr || result.suggestion : result.suggestion}</Text>
            ) : null}

            {/* Smart swap */}
            {result.smartSwap ? (
              <View style={styles.smartSwapBox}>
                <Text style={styles.smartSwapTitle}>{isTr ? '🔄 Akıllı Değişim' : '🔄 Smart Swap'}</Text>
                <Text style={styles.smartSwapText}>{result.smartSwap}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {/* Apple Watch / HealthKit Card (iOS only, when available) */}
        {healthAvailable && (
          <Card elevation="md" style={styles.watchCard}>
            <View style={styles.watchHeaderRow}>
              <Text style={styles.watchTitle}>
                {isTr ? '⌚ Apple Watch & Sağlık' : '⌚ Apple Watch & Health'}
              </Text>
              {healthAuthorized && (
                <TouchableOpacity
                  onPress={refreshHealthData}
                  disabled={healthLoading}
                  style={styles.watchRefreshBtn}
                  accessibilityRole="button"
                  accessibilityLabel={isTr ? 'Sağlık verisini yenile' : 'Refresh health data'}
                >
                  {healthLoading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Text style={styles.watchRefreshText}>{isTr ? '↻ Yenile' : '↻ Refresh'}</Text>}
                </TouchableOpacity>
              )}
            </View>

            {!healthAuthorized ? (
              <>
                <Text style={styles.watchConnectNote}>
                  {isTr
                    ? 'Apple Watch ile yakılan gerçek aktif kaloriyi ve nabzını otomatik takip et.'
                    : 'Sync your real active calories and heart rate from Apple Watch automatically.'}
                </Text>
                <TouchableOpacity
                  style={[styles.watchConnectBtn, healthLoading && { opacity: 0.6 }]}
                  onPress={connectAppleWatch}
                  disabled={healthLoading}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isTr ? 'Apple Watch\'a bağlan' : 'Connect Apple Watch'}
                >
                  {healthLoading
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.watchConnectBtnText}>🔥⌚ {isTr ? 'Apple Watch\'a Bağlan' : 'Connect Apple Watch'}</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.watchStatsRow}>
                <View style={styles.watchStatItem}>
                  <Text style={styles.watchStatValue}>
                    {watchActiveEnergy != null ? watchActiveEnergy : '—'}
                  </Text>
                  <Text style={styles.watchStatLabel}>
                    {isTr ? '🔥 Aktif kcal' : '🔥 Active kcal'}
                  </Text>
                </View>
                <View style={styles.watchStatDivider} />
                <View style={styles.watchStatItem}>
                  <Text style={styles.watchStatValue}>
                    {latestHeartRate != null ? latestHeartRate : '—'}
                  </Text>
                  <Text style={styles.watchStatLabel}>
                    {isTr ? '❤️ Nabız (bpm)' : '❤️ Heart rate (bpm)'}
                  </Text>
                </View>
                <View style={styles.watchStatDivider} />
                <View style={styles.watchStatItem}>
                  <Text style={styles.watchStatValue}>
                    {restingHeartRate != null ? restingHeartRate : '—'}
                  </Text>
                  <Text style={styles.watchStatLabel}>
                    {isTr ? '🫀 Dinlenme (bpm)' : '🫀 Resting (bpm)'}
                  </Text>
                </View>
              </View>
            )}
          </Card>
        )}

        {/* Calorie Balance Card */}
        <Card elevation="md" style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>{isTr ? '⚖️ Günlük Kalori Dengesi' : '⚖️ Daily Calorie Balance'}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{totalCalories > 0 ? totalCalories : '—'}</Text>
              <Text style={styles.balanceLabel}>{isTr ? '🍽️ Yenen' : '🍽️ Eaten'}</Text>
            </View>
            <Text style={styles.balanceMinus}>−</Text>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{bmr}</Text>
              <Text style={styles.balanceLabel}>{isTr ? '🔥 BMR' : '🔥 BMR'}</Text>
            </View>
            <Text style={styles.balanceMinus}>−</Text>
            <View style={styles.balanceItem}>
              <Text style={[styles.balanceValue, usingWatchEnergy && { color: colors.success }]}>
                {activeCalories > 0 ? activeCalories : '—'}
              </Text>
              <Text style={[styles.balanceLabel, usingWatchEnergy && { color: colors.success }]}>
                {usingWatchEnergy
                  ? '🔥⌚ Apple Watch'
                  : (isTr ? '🏋️ Spor' : '🏋️ Exercise')}
              </Text>
            </View>
            <Text style={styles.balanceMinus}>=</Text>
            <View style={[styles.balanceItem, styles.balanceResult, { borderColor: balanceColor }]}>
              <Text style={[styles.balanceResultValue, { color: balanceColor }]}>
                {calBalance === null ? '—' : (calBalance > 0 ? `+${calBalance}` : `${calBalance}`)}
              </Text>
              <Text style={[styles.balanceLabel, { color: balanceColor }]}>kcal</Text>
            </View>
          </View>
          {calBalance !== null && (
            <Text style={[styles.balanceNote, { color: balanceColor }]}>
              {calBalance > 0
                ? (isTr ? `${balanceIcon} Kalori fazlası — daha az ye veya daha fazla hareket et` : `${balanceIcon} Calorie surplus — eat less or move more`)
                : (isTr ? `${balanceIcon} Kalori açığı — kas koruyarak yağ yakıyorsun` : `${balanceIcon} Calorie deficit — burning fat while preserving muscle`)}
            </Text>
          )}
          <Text style={styles.balanceBmrNote}>
            {isTr ? `BMR ${userWeight}kg ${userGender === 'male' ? '(erkek)' : userGender === 'female' ? '(kadın)' : ''} baz alınarak hesaplandı` : `BMR calculated using ${userWeight}kg ${userGender === 'male' ? '(male)' : userGender === 'female' ? '(female)' : ''}`}
          </Text>
          {usingWatchEnergy && (
            <Text style={[styles.balanceBmrNote, { color: colors.success, marginTop: 2 }]}>
              {isTr
                ? '🔥⌚ Aktif kalori Apple Watch\'tan alındı (manuel tahmin yerine)'
                : '🔥⌚ Active calories from Apple Watch (instead of manual estimate)'}
            </Text>
          )}
        </Card>

        {/* Today's Meals */}
        <View style={styles.todayHeader}>
          <Text style={styles.todaySectionTitle}>{t('todayMeals')}</Text>
          {todayMeals.length > 0 && (
            <View style={styles.todayTotals}>
              <Text style={styles.todayTotalBadge}>🥩 {totalProtein}g</Text>
              {totalCalories > 0 && <Text style={styles.todayTotalBadge}>🔥 {totalCalories} kcal</Text>}
            </View>
          )}
        </View>

        {todayMeals.length === 0 ? (
          <Card elevation="sm" style={styles.emptyCard} contentStyle={styles.emptyCardContent}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyText}>{isTr ? 'Henüz öğün eklenmedi' : 'No meals added yet'}</Text>
          </Card>
        ) : (
          <Card padding={0} elevation="md" style={styles.mealsCard}>
            <FlatList
              data={todayMeals}
              scrollEnabled={false}
              keyExtractor={(item, index) => (item.id != null ? String(item.id) : item.timestamp || String(index))}
              renderItem={({ item: meal, index }) => (
                <View style={[styles.mealItem, index < todayMeals.length - 1 && styles.mealBorder]}>
                  <Text style={styles.mealEmoji}>{getFoodEmoji(meal.foodType)}</Text>
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName}>{meal.foodType}</Text>
                    <Text style={styles.mealMeta}>
                      {[
                        formatTime(meal.timestamp),
                        meal.calories ? `${meal.calories} kcal` : '',
                        meal.portionSize ? portionLabel(meal.portionSize) : '',
                      ].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.mealProtein}>{meal.protein}g</Text>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEdit(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isTr ? 'Öğünü düzenle' : 'Edit meal'}: ${meal.foodType || ''}`}
                  >
                    <Text style={styles.editBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isTr ? 'Öğünü sil' : 'Delete meal'}: ${meal.foodType || ''}`}
                  >
                    <Text style={styles.deleteBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </Card>
        )}

        {/* Today's Exercises */}
        <View style={[styles.todayHeader, { marginTop: 24 }]}>
          <Text style={styles.todaySectionTitle}>{isTr ? '🏋️ Bugünkü Egzersizler' : '🏋️ Today\'s Exercises'}</Text>
          {exercises.length > 0 && (
            <Text style={styles.todayTotalBadge}>
              🔥 {exercises.reduce((s, e) => s + (e.caloriesBurned || 0), 0)} kcal
            </Text>
          )}
        </View>
        {exercises.length === 0 ? (
          <Card elevation="sm" style={styles.emptyCard} contentStyle={styles.emptyCardContent}>
            <Text style={styles.emptyEmoji}>🏃</Text>
            <Text style={styles.emptyText}>{isTr ? 'Henüz egzersiz eklenmedi' : 'No exercises logged yet'}</Text>
          </Card>
        ) : (
          <Card padding={0} elevation="md" style={styles.mealsCard}>
            <FlatList
              data={exercises}
              scrollEnabled={false}
              keyExtractor={(item, index) => item.timestamp || String(index)}
              renderItem={({ item: ex, index }) => {
                const exName = EXERCISE_TYPES.find(e => e.id === ex.type)?.[isTr ? 'tr' : 'en'] || ex.name;
                return (
                  <View style={[styles.mealItem, index < exercises.length - 1 && styles.mealBorder]}>
                    <Text style={styles.mealEmoji}>{ex.emoji}</Text>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealName}>{exName}</Text>
                      <Text style={styles.mealMeta}>
                        {ex.duration} min · {isTr ? (ex.intensity === 'light' ? 'Hafif' : ex.intensity === 'moderate' ? 'Orta' : 'Yoğun') : ex.intensity}
                        {ex.weightUsed ? ` · ${ex.weightUsed} kg` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.mealProtein, { color: colors.success }]}>{ex.caloriesBurned} kcal</Text>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEditExercise(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`${isTr ? 'Egzersizi düzenle' : 'Edit exercise'}: ${exName}`}
                    >
                      <Text style={styles.editBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteExercise(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`${isTr ? 'Egzersizi sil' : 'Delete exercise'}: ${exName}`}
                    >
                      <Text style={styles.deleteBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* DAILY INSIGHTS — Muscle Health + 14-Day Projection + Weekly Report  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* ── Kas Sağlığı / Muscle Health ── */}
        <SectionTitle
          title={isTr ? '🧠 Kas Sağlığı' : '🧠 Muscle Health'}
          style={styles.insightsSection}
        />
        <Card elevation="md" style={[styles.insightCardBlock, { backgroundColor: muscleTonePalette.bg }]}>
          <View style={styles.muscleCardRow}>
            <Text style={styles.muscleCardEmoji}>{muscleProtection.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.muscleCardLabel, { color: muscleTonePalette.fg }]}>
                {muscleProtection.label(language)}
              </Text>
              <Text style={styles.muscleCardDesc}>{muscleProtection.description(language)}</Text>
            </View>
          </View>
          <Text style={styles.muscleCardNotClinical}>{notClinicalNote(language)}</Text>

          {/* Factor breakdown: protein / exercise / loss-rate */}
          <View style={styles.scoreFactors}>
            <View style={styles.scoreFactor}>
              <Text style={styles.scoreFactorDot}>
                {todayProteinRatio >= 0.8 ? '🟢' : todayProteinRatio >= 0.6 ? '🟡' : '🔴'}
              </Text>
              <Text style={styles.scoreFactorText}>
                {isTr
                  ? `Protein: ${todayProteinRatio >= 0.8 ? 'İyi' : todayProteinRatio >= 0.6 ? 'Yetersiz' : 'Kritik'}`
                  : `Protein: ${todayProteinRatio >= 0.8 ? 'Good' : todayProteinRatio >= 0.6 ? 'Low' : 'Critical'}`}
              </Text>
            </View>
            <View style={styles.scoreFactor}>
              <Text style={styles.scoreFactorDot}>
                {exerciseDaysPerWeek >= 2 ? '🟢' : exerciseDaysPerWeek >= 1 ? '🟡' : '🔴'}
              </Text>
              <Text style={styles.scoreFactorText}>
                {isTr
                  ? `Egzersiz: ${exerciseDaysPerWeek >= 2 ? 'Aktif' : exerciseDaysPerWeek >= 1 ? 'Az' : 'Yok'}`
                  : `Exercise: ${exerciseDaysPerWeek >= 2 ? 'Active' : exerciseDaysPerWeek >= 1 ? 'Low' : 'None'}`}
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
        </Card>

        <MedicalDisclaimer variant="medical" style={styles.insightCardBlock} />

        {/* ── Sustainability Score ── */}
        <Card elevation="md" style={[styles.insightCardBlock, { backgroundColor: reboundInfo.bg }]}>
          <View style={styles.riskCardRow}>
            <Text style={styles.riskCardEmoji}>{reboundInfo.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.riskCardLabel, { color: reboundInfo.color }]}>{reboundInfo.label}</Text>
              <Text style={styles.riskCardDesc}>{reboundInfo.desc}</Text>
            </View>
          </View>
          {riskData.factors.length > 0 && (
            <View style={styles.riskFactors}>
              <Text style={styles.riskFactorsTitle}>{isTr ? 'Risk faktörleri:' : 'Risk factors:'}</Text>
              {riskData.factors.map((f, i) => (
                <Text key={i} style={styles.riskFactor}>✗ {f}</Text>
              ))}
            </View>
          )}
        </Card>

        {/* ── 14 Günlük Projeksiyon / 14-Day Projection ── */}
        {showProjection && (
          <>
            <SectionTitle
              title={isTr ? '📈 14 Günlük Projeksiyon' : '📈 14-Day Projection'}
              style={styles.insightsSection}
            />
            <Card elevation="md" style={styles.insightCardBlock}>
              <Text style={styles.projectionRateLabel}>
                {isTr
                  ? `Günlük hız: ${formatWeight(dailyRate)}/gün · ${weightHistory.length} ölçümden hesaplandı`
                  : `Daily rate: ${formatWeight(dailyRate)}/day · from ${weightHistory.length} weigh-ins`}
              </Text>

              <View style={styles.projTotalRow}>
                <Text style={styles.projTotalValue}>~{formatWeight(projected14)}</Text>
                <Text style={styles.projTotalLabel}>
                  {isTr ? 'tahmini 14 günlük değişim' : 'projected 14-day change'}
                </Text>
              </View>

              <Text style={styles.projDisclaimer}>
                {isTr
                  ? '📋 Bu tahmin son kilo kayıtlarınızdaki hıza dayanır; gerçek sonuçlar protein alımı, egzersiz ve diğer etkenlere göre değişir.'
                  : '📋 This projection is based on your recent weigh-in rate; actual results vary with protein intake, exercise and other factors.'}
              </Text>
            </Card>
          </>
        )}

        {/* ── Haftalık Rapor / Weekly Report ── */}
        <SectionTitle
          title={isTr ? '📊 Haftalık Rapor' : '📊 Weekly Report'}
          subtitle={weekRangeLabel}
          style={styles.insightsSection}
        />

        {hasWeeklyData ? (
          <>
            {/* This-week hero summary */}
            <GradientHero style={styles.weeklyHero}>
              <Text style={styles.weeklyHeroTitle}>{isTr ? '📉 Bu Hafta' : '📉 This Week'}</Text>
              <Text style={styles.weeklyHeroValue}>
                {weeklyChange > 0 ? '−' : weeklyChange < 0 ? '+' : ''}{formatWeight(weeklyChangeAbs)}
              </Text>
              <Text style={styles.weeklyHeroSubtitle}>
                {weeklyChange > 0
                  ? (isTr ? 'Bu hafta kaybedildi' : 'Lost this week')
                  : weeklyChange < 0
                  ? (isTr ? 'Bu hafta alındı' : 'Gained this week')
                  : (isTr ? 'Değişim yok' : 'No change this week')}
              </Text>
              <View style={styles.weeklyHeroDivider} />
              <View style={styles.weeklyHeroStatsRow}>
                <View style={styles.weeklyHeroStat}>
                  <Text style={styles.weeklyHeroStatValue}>{formatWeight(Math.abs(totalWeightLost))}</Text>
                  <Text style={styles.weeklyHeroStatLabel}>{isTr ? 'Toplam Kayıp' : 'Total Lost'}</Text>
                </View>
                <View style={styles.weeklyHeroStatDivider} />
                <View style={styles.weeklyHeroStat}>
                  <Text style={styles.weeklyHeroStatValue}>{avgPctLabel}%</Text>
                  <Text style={styles.weeklyHeroStatLabel}>{isTr ? 'Ort. Protein' : 'Avg Protein'}</Text>
                </View>
              </View>
            </GradientHero>

            {/* Avg protein ring + muscle grade */}
            <View style={styles.weeklyGridRow}>
              <Card style={styles.weeklyGridCard} contentStyle={styles.weeklyGridCardInner}>
                <Ring
                  progress={avgPct}
                  size={104}
                  strokeWidth={11}
                  color={avgPct >= 1 ? colors.success : avgPct >= 0.6 ? colors.warning : colors.danger}
                  trackColor={colors.outlineVariant}
                >
                  <Text style={[styles.weeklyRingValue, { color: avgPct >= 1 ? colors.success : avgPct >= 0.6 ? colors.warning : colors.danger }]}>
                    {avgPctLabel}%
                  </Text>
                  <Text style={styles.weeklyRingSub}>{proteinTarget}g</Text>
                </Ring>
                <Text style={styles.weeklyGridLabel}>{isTr ? 'Ort. Protein Hedefi' : 'Avg Protein Goal'}</Text>
              </Card>

              <Card style={styles.weeklyGridCard} contentStyle={styles.weeklyGridCardInner}>
                <View style={[styles.gradeCircle, { backgroundColor: muscleTonePalette.bg }]}>
                  <Text style={styles.gradeEmoji}>{muscleProtection.emoji}</Text>
                </View>
                <Text style={styles.weeklyGridLabel}>{isTr ? 'Kas Koruması' : 'Muscle Protection'}</Text>
                <Badge
                  label={muscleProtection.label(language)}
                  tone={muscleProtection.toneKey}
                  style={{ marginTop: spacing.stackSm }}
                />
                <Text style={styles.estimateCaptionCentered}>
                  {notClinicalNote(language)}
                </Text>
              </Card>
            </View>

            {/* 7-day protein-vs-target bar chart */}
            <Card elevation="md" style={styles.insightCardBlock}>
              <View style={styles.proteinChartHeader}>
                <Text style={styles.proteinChartSubtitle}>
                  {isTr ? `Hedef: ${proteinTarget}g / gün` : `Target: ${proteinTarget}g / day`}
                </Text>
                <View style={styles.proteinChartLegend}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendText}>{isTr ? 'Hedefe ulaştı' : 'Met'}</Text>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning, marginLeft: 10 }]} />
                  <Text style={styles.legendText}>{isTr ? 'Kısmen' : 'Partial'}</Text>
                  <View style={[styles.legendDot, { backgroundColor: colors.danger, marginLeft: 10 }]} />
                  <Text style={styles.legendText}>{isTr ? 'Düşük' : 'Low'}</Text>
                </View>
              </View>
              {dailyProtein.map((day, i) => {
                const pct = Math.min(day.ratio, 1);
                const barColor = pct >= 1 ? colors.success : pct >= 0.6 ? colors.warning : colors.danger;
                const bgColor = pct >= 1 ? colors.successBg : pct >= 0.6 ? colors.warningBg : colors.dangerBg;
                return (
                  <View key={i} style={[styles.proteinDayRow, i < dailyProtein.length - 1 && styles.proteinDayBorder]}>
                    <Text style={styles.proteinDayName}>{day.dayName}</Text>
                    <View style={styles.proteinBarContainer}>
                      <View style={styles.proteinBarBg}>
                        <View style={[styles.proteinBarFill, { width: day.hasData ? `${Math.round(pct * 100)}%` : '0%', backgroundColor: barColor }]} />
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

            {/* AI insight cards */}
            <SectionTitle
              title={`🤖 ${isTr ? 'Öneriler' : 'Recommendations'}`}
              subtitle={isTr ? 'Verilerinize göre üretildi' : 'Generated from your data'}
              style={styles.insightsSection}
            />
            {recommendations.map((rec, i) => (
              <Card key={i} style={styles.aiInsightCard} contentStyle={styles.aiInsightInner} elevation="sm">
                <View style={styles.aiInsightBullet}>
                  <Text style={styles.aiInsightBulletText}>{i + 1}</Text>
                </View>
                <Text style={styles.aiInsightText}>{rec}</Text>
              </Card>
            ))}

            <Text style={styles.weeklyDisclaimer}>
              {isTr
                ? '📋 Bu özet protein alımı ve kilo kayıtlarınızdan üretilir; klinik bir ölçüm değildir. Bu uygulama tıbbi tavsiye vermez.'
                : '📋 This summary is generated from your protein intake and weigh-ins; it is not a clinical measurement. This app does not provide medical advice.'}
            </Text>
          </>
        ) : (
          <Card elevation="sm" style={styles.insightCardBlock} contentStyle={styles.emptyCardContent}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>
              {isTr
                ? 'Haftalık rapor için en az 2 kilo girişi gerekiyor.'
                : 'Log at least 2 weights to see your weekly report.'}
            </Text>
          </Card>
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Floating add button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openManualAdd}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isTr ? 'Öğün ekle' : 'Add meal'}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>

      {/* Coach Chat Modal */}
      <Modal visible={chatVisible} animationType="slide" transparent onRequestClose={() => setChatVisible(false)}>
        <View style={styles.chatOverlay}>
          <TouchableOpacity style={styles.chatBackdrop} onPress={() => setChatVisible(false)} activeOpacity={1} />
          <View style={[styles.chatSheet, {
            height: keyboardHeight > 0
              ? Math.min(SCREEN_HEIGHT * 0.70, SCREEN_HEIGHT - keyboardHeight - 50)
              : SCREEN_HEIGHT * 0.70,
            marginBottom: keyboardHeight,
          }]}>
            {/* Handle */}
            <View style={styles.chatHandle} />

            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <View style={styles.chatAvatar}><MayaAvatar size={34} /></View>
                <View>
                  <Text style={styles.chatName}>Maya</Text>
                  <Text style={styles.chatStatus}>
                    {isTr
                      ? `Bugün ${todayMeals.reduce((s,m)=>s+(m.protein||0),0)}g protein`
                      : `${todayMeals.reduce((s,m)=>s+(m.protein||0),0)}g protein today`}
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

            {/* Messages */}
            <ScrollView
              ref={chatScrollRef}
              style={styles.chatMessages}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.map((msg, i) => (
                <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}>
                  {msg.role === 'assistant' && <MayaAvatar size={22} style={{ marginRight: 6, marginBottom: 4, alignSelf: 'flex-end' }} />}
                  <View style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextCoach]}>
                    <Text style={[styles.bubbleMsg, msg.role === 'user' ? styles.bubbleMsgUser : styles.bubbleMsgCoach]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}
              {chatLoading && (
                <View style={[styles.bubble, styles.bubbleCoach]}>
                  <MayaAvatar size={22} style={{ marginRight: 6, marginBottom: 4, alignSelf: 'flex-end' }} />
                  <View style={styles.bubbleTextCoach}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick Prompts */}
            {chatMessages.length <= 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickPrompts} contentContainerStyle={{ padding: 12, gap: 8 }}>
                {(isTr ? [
                  'Bugün nasıl gidiyorum?',
                  'Daha fazla protein için ne yiyeyim?',
                  'Kas kaybetmeden kilo verebilir miyim?',
                  'Akşam öğünü önerisi ver',
                ] : [
                  "How am I doing today?",
                  "What should I eat for more protein?",
                  "Can I lose fat without losing muscle?",
                  "Suggest a dinner for tonight",
                ]).map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickPrompt}
                    onPress={() => { setChatInput(q); }}
                    accessibilityRole="button"
                    accessibilityLabel={q}
                  >
                    <Text style={styles.quickPromptText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Input */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder={isTr ? 'Maya’ya bir şey sor...' : 'Ask Maya anything...'}
                placeholderTextColor={colors.outline}
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
              >
                <Text style={styles.sendBtnText}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Exercise Modal */}
      <Modal visible={exerciseModalVisible} transparent animationType="slide" onRequestClose={() => { setExerciseModalVisible(false); setEditExerciseIndex(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editExerciseIndex !== null
                  ? (isTr ? '✏️ Egzersizi Düzenle' : '✏️ Edit Exercise')
                  : (isTr ? '🏋️ Egzersiz Ekle' : '🏋️ Log Exercise')}
              </Text>

              {/* Exercise Type Grid */}
              <Text style={styles.fieldLabel}>{isTr ? 'Egzersiz Türü' : 'Workout Type'}</Text>
              <View style={styles.exerciseGrid}>
                {EXERCISE_TYPES.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.exerciseTypeBtn, exerciseType === ex.id && styles.exerciseTypeBtnActive]}
                    onPress={() => setExerciseType(ex.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: exerciseType === ex.id }}
                    accessibilityLabel={isTr ? ex.tr : ex.en}
                  >
                    <Text style={styles.exerciseTypeEmoji}>{ex.emoji}</Text>
                    <Text style={[styles.exerciseTypeName, exerciseType === ex.id && styles.exerciseTypeNameActive]}>
                      {isTr ? ex.tr : ex.en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Duration */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{isTr ? 'Süre (dakika)' : 'Duration (minutes)'}</Text>
              <View style={styles.portionRow}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.portionPill, exerciseDuration === d && styles.portionPillActive]}
                    onPress={() => setExerciseDuration(d)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: exerciseDuration === d }}
                    accessibilityLabel={`${d} ${isTr ? 'dakika' : 'minutes'}`}
                  >
                    <Text style={[styles.portionPillText, exerciseDuration === d && styles.portionPillTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Intensity */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{isTr ? 'Yoğunluk' : 'Intensity'}</Text>
              <View style={styles.portionRow}>
                {INTENSITIES.map((int) => (
                  <TouchableOpacity
                    key={int.id}
                    style={[styles.portionPill, exerciseIntensity === int.id && styles.portionPillActive, { flex: 1 }]}
                    onPress={() => setExerciseIntensity(int.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: exerciseIntensity === int.id }}
                    accessibilityLabel={isTr ? int.tr : int.en}
                  >
                    <Text style={[styles.portionPillText, exerciseIntensity === int.id && styles.portionPillTextActive]}>
                      {isTr ? int.tr : int.en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Calories preview */}
              {exerciseType && (
                <View style={styles.calPreview}>
                  <Text style={styles.calPreviewText}>
                    {isTr ? '🔥 Tahmini yakılan kalori: ' : '🔥 Est. calories burned: '}
                    <Text style={{ fontWeight: '800', color: colors.success, fontFamily: fontFamily.headingBold }}>
                      {calcCalories(
                        EXERCISE_TYPES.find(e => e.id === exerciseType)?.met || 5,
                        exerciseDuration,
                        INTENSITIES.find(i => i.id === exerciseIntensity)?.mult || 1,
                        profile?.weight
                      )} kcal
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.outline, marginTop: 4, textAlign: 'center', fontFamily: fontFamily.body }}>
                    {isTr
                      ? `MET formülü · ${profile?.weight || 75} kg baz alındı`
                      : `MET formula · based on ${profile?.weight || 75} kg`}
                  </Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setExerciseModalVisible(false); setEditExerciseIndex(null); }}
                  accessibilityRole="button"
                  accessibilityLabel={t('cancel')}
                >
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={saveExercise}
                  accessibilityRole="button"
                  accessibilityLabel={isTr ? 'Egzersizi kaydet' : 'Save exercise'}
                >
                  <Text style={styles.saveBtnText}>{isTr ? 'Kaydet' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Entry Modal */}
      <Modal visible={manualVisible} transparent animationType="slide" onRequestClose={() => { setManualVisible(false); setManualResult(null); setManualFood(''); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editIndex !== null
                  ? (isTr ? 'Öğünü Düzenle' : 'Edit Meal')
                  : (isTr ? 'Öğün Ekle' : 'Add Meal')}
              </Text>

              <Text style={styles.fieldLabel}>
                {isTr ? 'Ne yediniz? Dilediğiniz gibi anlatın.' : 'What did you eat? Describe freely.'}
              </Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder={isTr
                  ? 'örn. 2 haşlanmış yumurta ve 1 dilim tam tahıllı ekmek, yanında domates...'
                  : 'e.g. 2 boiled eggs and a slice of whole wheat bread, with tomatoes...'}
                placeholderTextColor={colors.outline}
                value={manualFood}
                onChangeText={text => { setManualFood(text); setManualResult(null); }}
                multiline
                maxLength={400}
              />

              {/* Portion selector */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                {isTr ? 'Porsiyon Büyüklüğü' : 'Portion Size'}
              </Text>
              <View style={styles.portionRow}>
                {['Small', 'Medium', 'Large'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.portionPill, manualPortion === p && styles.portionPillActive]}
                    onPress={() => setManualPortion(p)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: manualPortion === p }}
                    accessibilityLabel={portionLabel(p)}
                  >
                    <Text style={[styles.portionPillText, manualPortion === p && styles.portionPillTextActive]}>
                      {p === 'Small' ? (isTr ? '🤏 Küçük' : '🤏 Small')
                       : p === 'Medium' ? (isTr ? '✋ Orta' : '✋ Medium')
                       : (isTr ? '👐 Büyük' : '👐 Large')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* AI Analyze button */}
              {!manualResult && (
                <TouchableOpacity
                  style={[styles.analyzeManualBtn, manualAnalyzing && { opacity: 0.6 }]}
                  onPress={handleManualAnalyze}
                  disabled={manualAnalyzing}
                  accessibilityRole="button"
                  accessibilityLabel={isTr ? 'Yapay zeka ile analiz et' : 'Analyze with AI'}
                >
                  {manualAnalyzing
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.analyzeManualBtnText}>🤖 {isTr ? 'Yapay Zeka ile Analiz Et' : 'Analyze with AI'}</Text>
                  }
                </TouchableOpacity>
              )}

              {/* AI Result preview */}
              {manualResult && (
                <View style={styles.autoNutrition}>
                  <Text style={styles.autoNutritionTitle}>
                    🤖 {isTr ? 'AI Analizi' : 'AI Analysis'} — {manualResult.foodType}
                  </Text>
                  <View style={styles.autoNutritionRow}>
                    <View style={styles.autoNutritionItem}>
                      <Text style={styles.autoNutritionValue}>{manualResult.protein}g</Text>
                      <Text style={styles.autoNutritionLabel}>{t('protein')}</Text>
                    </View>
                    <View style={styles.autoNutritionDivider} />
                    <View style={styles.autoNutritionItem}>
                      <Text style={styles.autoNutritionValue}>{manualResult.calories}</Text>
                      <Text style={styles.autoNutritionLabel}>{isTr ? 'Kalori' : 'Calories'}</Text>
                    </View>
                    <View style={styles.autoNutritionDivider} />
                    <View style={styles.autoNutritionItem}>
                      <Text style={styles.autoNutritionValue}>{manualResult.muscleScore}</Text>
                      <Text style={styles.autoNutritionLabel}>{isTr ? 'Skor' : 'Score'}</Text>
                    </View>
                  </View>
                  {manualResult.suggestion ? (
                    <Text style={[styles.autoNutritionNote, { marginTop: 6 }]}>
                      💡 {manualResult.suggestion}
                    </Text>
                  ) : null}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setManualVisible(false); setManualResult(null); setManualFood(''); }}
                  accessibilityRole="button"
                  accessibilityLabel={t('cancel')}
                >
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                {manualResult && (
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleManualSave}
                    accessibilityRole="button"
                    accessibilityLabel={isTr ? 'Öğünü kaydet' : 'Save meal'}
                  >
                    <Text style={styles.saveBtnText}>{t('save')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
