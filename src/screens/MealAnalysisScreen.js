import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
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
import { saveMealAnalysis } from '../services/firestoreService';
import { getWeightLogs } from '../services/firestoreService';
import { getMedicationProfile } from '../services/medicationService';
import { sendCoachMessage } from '../services/coachChatService';
import AIConsentModal from '../components/AIConsentModal';
import { scheduleDailyMotivation } from '../services/notificationService';
import * as healthkitService from '../services/healthkitService';
import { useGamification } from '../context/GamificationContext';
import { useUnit } from '../context/UnitContext';
import { colors, semantic, fontFamily, typography, spacing, radii, shadow } from '../theme';
import { Screen, Card, GradientHero, PrimaryButton, SecondaryButton, Chip, SectionTitle, Badge } from '../components/ui';

const FREE_DAILY_LIMIT = 2;

export default function MealAnalysisScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { completeMission, earnXP } = useGamification();
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
  const todayMealsKey = user ? `daily_meals_${user.uid}_${today}` : null;
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

  const loadTodayMeals = useCallback(async () => {
    if (!todayMealsKey) return;
    try {
      const raw = await AsyncStorage.getItem(todayMealsKey);
      if (raw) setTodayMeals(JSON.parse(raw));
    } catch (e) {}
  }, [todayMealsKey]);

  useEffect(() => { loadTodayMeals(); }, [loadTodayMeals]);

  useEffect(() => {
    if (!todayExerciseKey) return;
    AsyncStorage.getItem(todayExerciseKey).then(raw => { if (raw) setExercises(JSON.parse(raw)); });
  }, [todayExerciseKey]);

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

  async function openChat() {
    setChatMessages([{
      role: 'assistant',
      content: isTr
        ? `Merhaba! Ben GLP-1 Coach wellness rehberinim 💪 Bugünkü öğünlerini görüyorum. Sana nasıl yardımcı olabilirim?`
        : `Hey! I'm your GLP-1 Coach Wellness Guide 💪 I can see your meals today. How can I help you?`,
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

  async function saveMeals(meals) {
    setTodayMeals(meals);
    if (todayMealsKey) {
      await AsyncStorage.setItem(todayMealsKey, JSON.stringify(meals));
    }
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    setAnalyzing(true);
    try {
      const analysis = await analyzeMealWithAI(imageUri, language);
      await incrementFreeCount();
      setResult(analysis);
      const newMeal = {
        protein: analysis.protein,
        calories: analysis.calories || 0,
        foodType: analysis.foodType,
        portionSize: analysis.portionSize,
        imageUri,
        timestamp: new Date().toISOString(),
      };
      const updatedMeals = [...todayMeals, newMeal];
      await saveMeals(updatedMeals);
      await completeMission('upload_meal');
      await earnXP(10, '📸 Meal analyzed!');
      if (updatedMeals.length >= 3) await completeMission('log_3_meals');
      if (user) {
        try { await saveMealAnalysis(user.uid, { ...analysis, imageUri }); } catch {}
      }
    } catch (e) {
      Alert.alert('Analysis Error', String(e?.message || e));
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
    const meal = {
      foodType: manualResult.foodType,
      protein: Math.round(manualResult.protein * portionMultiplier),
      calories: Math.round(manualResult.calories * portionMultiplier),
      portionSize: manualPortion,
      suggestion: manualResult.suggestion,
      muscleScore: manualResult.muscleScore,
      qualityTags: manualResult.qualityTags,
      timestamp: editIndex !== null ? todayMeals[editIndex].timestamp : new Date().toISOString(),
    };
    let updated;
    if (editIndex !== null) {
      updated = todayMeals.map((m, i) => (i === editIndex ? meal : m));
    } else {
      updated = [...todayMeals, meal];
    }
    await saveMeals(updated);
    if (editIndex === null) {
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
            const updated = todayMeals.filter((_, i) => i !== index);
            await saveMeals(updated);
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
    return new Date(iso).toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
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
  const balanceColor = calBalance === null ? '#9CA3AF' : calBalance > 0 ? '#EF4444' : '#10B981';
  const balanceIcon = calBalance === null ? '—' : calBalance > 0 ? '🔴' : '🟢';
  const PORTIONS = ['Small', 'Medium', 'Large'];
  const portionLabel = (p) => ({ Small: isTr ? 'Küçük' : 'Small', Medium: isTr ? 'Orta' : 'Medium', Large: isTr ? 'Büyük' : 'Large' }[p] || p);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AIConsentModal
        visible={aiConsentVisible}
        language={language}
        onAccept={async () => {
          await AsyncStorage.setItem('ai_consent_given', 'true');
          setAiConsentVisible(false);
          if (pendingAnalysis === 'image') runAnalyze();
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
          <TouchableOpacity style={styles.coachBtn} onPress={openChat} activeOpacity={0.85}>
            <Text style={styles.coachBtnEmoji}>🤖</Text>
            <Text style={styles.coachBtnText}>{isTr ? 'Koç' : 'Coach'}</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto} activeOpacity={0.8}>
            <Text style={styles.photoBtnIcon}>📸</Text>
            <Text style={styles.photoBtnText}>{isTr ? 'Çek' : 'Camera'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={pickImage} activeOpacity={0.8}>
            <Text style={styles.photoBtnIcon}>🖼️</Text>
            <Text style={styles.photoBtnText}>{isTr ? 'Galeri' : 'Gallery'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualBtn} onPress={openManualAdd} activeOpacity={0.8}>
            <Text style={styles.manualBtnIcon}>✏️</Text>
            <Text style={styles.manualBtnText}>{isTr ? 'Manuel' : 'Manual'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exerciseBtn} onPress={() => setExerciseModalVisible(true)} activeOpacity={0.8}>
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
                    result.muscleScore === 'A'  ? '#D1FAE5' :
                    result.muscleScore === 'B'  ? colors.infoBg :
                    result.muscleScore === 'C'  ? colors.warningBg : colors.dangerBg,
                }]}>
                  <Text style={[styles.muscleScoreText, {
                    color:
                      result.muscleScore === 'A+' ? '#065F46' :
                      result.muscleScore === 'A'  ? '#047857' :
                      result.muscleScore === 'B'  ? colors.primaryDark :
                      result.muscleScore === 'C'  ? '#92400E' : '#DC2626',
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
                <TouchableOpacity onPress={refreshHealthData} disabled={healthLoading} style={styles.watchRefreshBtn}>
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
              <Text style={[styles.balanceValue, usingWatchEnergy && { color: '#10B981' }]}>
                {activeCalories > 0 ? activeCalories : '—'}
              </Text>
              <Text style={[styles.balanceLabel, usingWatchEnergy && { color: '#10B981' }]}>
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
            <Text style={[styles.balanceBmrNote, { color: '#10B981', marginTop: 2 }]}>
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
            {todayMeals.map((meal, index) => (
              <View key={index} style={[styles.mealItem, index < todayMeals.length - 1 && styles.mealBorder]}>
                <Text style={styles.mealEmoji}>{getFoodEmoji(meal.foodType)}</Text>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName}>{meal.foodType}</Text>
                  <Text style={styles.mealMeta}>
                    {formatTime(meal.timestamp)}
                    {meal.calories ? ` · ${meal.calories} kcal` : ''}
                    {meal.portionSize ? ` · ${portionLabel(meal.portionSize)}` : ''}
                  </Text>
                </View>
                <Text style={styles.mealProtein}>{meal.protein}g</Text>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(index)}>
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(index)}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
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
            {exercises.map((ex, index) => (
              <View key={index} style={[styles.mealItem, index < exercises.length - 1 && styles.mealBorder]}>
                <Text style={styles.mealEmoji}>{ex.emoji}</Text>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName}>
                    {EXERCISE_TYPES.find(e => e.id === ex.type)?.[isTr ? 'tr' : 'en'] || ex.name}
                  </Text>
                  <Text style={styles.mealMeta}>
                    {ex.duration} min · {isTr ? (ex.intensity === 'light' ? 'Hafif' : ex.intensity === 'moderate' ? 'Orta' : 'Yoğun') : ex.intensity}
                    {ex.weightUsed ? ` · ${ex.weightUsed} kg` : ''}
                  </Text>
                </View>
                <Text style={[styles.mealProtein, { color: '#10B981' }]}>{ex.caloriesBurned} kcal</Text>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEditExercise(index)}>
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteExercise(index)}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Floating add button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openManualAdd}
        activeOpacity={0.85}
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
                <View style={styles.chatAvatar}><Text style={styles.chatAvatarEmoji}>🤖</Text></View>
                <View>
                  <Text style={styles.chatName}>{isTr ? 'GLP-1 Coach Rehberin' : 'Your Wellness Guide'}</Text>
                  <Text style={styles.chatStatus}>
                    {isTr
                      ? `Bugün ${todayMeals.reduce((s,m)=>s+(m.protein||0),0)}g protein`
                      : `${todayMeals.reduce((s,m)=>s+(m.protein||0),0)}g protein today`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatVisible(false)} style={styles.chatClose}>
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
                  <TouchableOpacity key={i} style={styles.quickPrompt} onPress={() => { setChatInput(q); }}>
                    <Text style={styles.quickPromptText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Input */}
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
                    <Text style={{ fontWeight: '800', color: '#10B981' }}>
                      {calcCalories(
                        EXERCISE_TYPES.find(e => e.id === exerciseType)?.met || 5,
                        exerciseDuration,
                        INTENSITIES.find(i => i.id === exerciseIntensity)?.mult || 1,
                        profile?.weight
                      )} kcal
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                    {isTr
                      ? `MET formülü · ${profile?.weight || 75} kg baz alındı`
                      : `MET formula · based on ${profile?.weight || 75} kg`}
                  </Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setExerciseModalVisible(false); setEditExerciseIndex(null); }}>
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveExercise}>
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
                style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder={isTr
                  ? 'örn. 2 haşlanmış yumurta ve 1 dilim tam tahıllı ekmek, yanında domates...'
                  : 'e.g. 2 boiled eggs and a slice of whole wheat bread, with tomatoes...'}
                placeholderTextColor="#9CA3AF"
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
                >
                  {manualAnalyzing
                    ? <ActivityIndicator color="#fff" size="small" />
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
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setManualVisible(false); setManualResult(null); setManualFood(''); }}>
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                {manualResult && (
                  <TouchableOpacity style={styles.saveBtn} onPress={handleManualSave}>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.containerMargin, paddingTop: spacing.gutter },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.stackLg },
  heading: { ...typography.headlineMd, color: colors.onSurface, marginBottom: 4 },
  subheading: { ...typography.labelMd, fontWeight: '400', fontFamily: fontFamily.body, color: colors.onSurfaceVariant },
  coachBtn: {
    backgroundColor: colors.primary, borderRadius: radii.lg, paddingHorizontal: 14,
    paddingVertical: 10, alignItems: 'center', minWidth: 64,
    ...shadow('md'),
  },
  coachBtnEmoji: { fontSize: 20 },
  coachBtnText: { color: colors.onPrimary, ...typography.labelSm, fontWeight: '700', marginTop: 2 },

  // Chat styles
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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarEmoji: { fontSize: 22 },
  chatName: { color: colors.white, fontFamily: fontFamily.headingBold, fontSize: 16, fontWeight: '700' },
  chatStatus: { color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.body, fontSize: 12, marginTop: 1 },
  chatClose: { padding: 8 },
  chatCloseText: { color: colors.white, fontFamily: fontFamily.headingSemiBold, fontSize: 18, fontWeight: '600' },
  chatMessages: { flex: 1 },
  bubble: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleCoach: { justifyContent: 'flex-start' },
  bubbleEmoji: { fontSize: 20, marginRight: 8, marginBottom: 4 },
  bubbleText: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleTextUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTextCoach: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, ...shadow('sm') },
  bubbleMsg: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  bubbleMsgUser: { color: colors.white },
  bubbleMsgCoach: { color: colors.onSurface },
  quickPrompts: { flexShrink: 0, maxHeight: 70, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceVariant },
  quickPrompt: {
    backgroundColor: colors.infoBg, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  quickPromptText: { color: colors.primary, fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600' },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.surfaceVariant,
  },
  chatInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontFamily: fontFamily.body, fontSize: 14,
    color: colors.onSurface, maxHeight: 100, backgroundColor: colors.background,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#C7D2FE' },
  sendBtnText: { color: colors.white, fontSize: 18 },

  freeBanner: {
    backgroundColor: colors.infoBg, borderRadius: radii.md, padding: 10,
    marginBottom: 14, borderWidth: 1, borderColor: '#C7D2FE',
    alignItems: 'center',
  },
  freeBannerText: { ...typography.labelSm, color: colors.primary, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: spacing.stackSm, marginBottom: spacing.stackLg },
  cameraBtn: {
    flex: 1, backgroundColor: colors.success, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
    ...shadow('sm'),
  },
  photoBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
    ...shadow('sm'),
  },
  photoBtnIcon: { fontSize: 24, marginBottom: 4 },
  photoBtnText: { color: colors.onPrimary, fontWeight: '700', ...typography.labelMd },
  manualBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  manualBtnIcon: { fontSize: 24, marginBottom: 4 },
  manualBtnText: { color: colors.onSurfaceVariant, fontWeight: '700', ...typography.labelMd },

  imageCard: {
    overflow: 'hidden', marginBottom: spacing.gutter,
  },
  pickedImage: { width: '100%', height: 200 },
  imageActions: { padding: spacing.gutter, gap: spacing.stackSm },
  imageActionsTop: { flexDirection: 'row', gap: spacing.stackSm },
  changeBtn: { flex: 1 },

  resultCard: { marginBottom: spacing.stackLg },
  resultHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.stackMd,
  },
  resultFoodType: { ...typography.labelMd, fontFamily: fontFamily.headingSemiBold, fontSize: 16, color: colors.onSurface, flex: 1, marginRight: spacing.stackSm },
  muscleScoreBadge: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...shadow('sm'),
  },
  muscleScoreText: { fontSize: 14, fontWeight: '900', fontFamily: fontFamily.headingBold },
  macroChipsRow: { flexDirection: 'row', gap: spacing.stackSm, marginBottom: spacing.stackMd },
  macroChip: {
    flex: 1, alignItems: 'center', backgroundColor: colors.surfaceVariant,
    borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: 6,
  },
  macroChipProtein: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: '#A7F3D0' },
  macroChipLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, marginBottom: 4, textAlign: 'center' },
  macroChipValue: { fontFamily: fontFamily.headingBold, fontSize: 17, fontWeight: '800', color: colors.onSurface },
  macroChipValueProtein: { color: colors.success },
  qualityTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  qualityTag: {
    backgroundColor: colors.infoBg, borderRadius: radii.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  qualityTagText: { ...typography.labelSm, fontWeight: '700', color: colors.primary },
  verdictRow: { flexDirection: 'row', marginBottom: spacing.stackSm },
  suggestionText: { ...typography.labelMd, fontWeight: '400', fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 19, marginBottom: spacing.stackSm },
  smartSwapBox: {
    backgroundColor: colors.successBg, borderRadius: radii.md, padding: 10,
    borderLeftWidth: 3, borderLeftColor: colors.success, marginTop: 4,
  },
  smartSwapTitle: { ...typography.labelSm, fontWeight: '700', color: '#065F46', marginBottom: 4 },
  smartSwapText: { ...typography.labelMd, fontWeight: '400', fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },

  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.stackMd },
  todaySectionTitle: { fontFamily: fontFamily.headingBold, fontSize: 18, fontWeight: '700', color: colors.onSurface },
  todayTotals: { flexDirection: 'row', gap: spacing.stackSm },
  todayTotalBadge: {
    backgroundColor: colors.infoBg, borderRadius: radii.pill, paddingHorizontal: 10,
    paddingVertical: 4, ...typography.labelSm, fontWeight: '700', color: colors.primary,
  },

  emptyCard: { },
  emptyCardContent: { alignItems: 'center', paddingVertical: 12 },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.stackSm },
  emptyText: { ...typography.labelMd, fontWeight: '500', color: colors.outline },

  mealsCard: { overflow: 'hidden' },
  mealItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.gutter },
  mealBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  mealEmoji: { fontSize: 26, marginRight: 12 },
  mealInfo: { flex: 1 },
  mealName: { ...typography.labelMd, color: colors.onSurface },
  mealMeta: { ...typography.labelSm, color: colors.outline, marginTop: 2 },
  mealProtein: { fontFamily: fontFamily.headingBold, fontSize: 15, fontWeight: '800', color: colors.primary, marginRight: spacing.stackSm },
  editBtn: { padding: 6 },
  editBtnText: { fontSize: 16 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 16 },

  fab: {
    position: 'absolute', right: spacing.containerMargin, bottom: spacing.stackLg,
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow('lg'),
  },
  fabIcon: { color: colors.onPrimary, fontSize: 34, fontWeight: '300', marginTop: Platform.OS === 'ios' ? -2 : -4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontFamily: fontFamily.headingBold, fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: 16 },
  fieldLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.md,
    padding: 13, fontFamily: fontFamily.body, fontSize: 15, color: colors.onSurface, backgroundColor: colors.background,
  },
  inputRow: { flexDirection: 'row' },
  portionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  portionPill: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.sm,
    paddingVertical: 10, alignItems: 'center', backgroundColor: colors.background,
  },
  portionPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  portionPillText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  portionPillTextActive: { color: colors.white },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.md,
    padding: 14, alignItems: 'center',
  },
  cancelBtnText: { color: colors.onSurfaceVariant, fontFamily: fontFamily.bodySemiBold, fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radii.md,
    padding: 14, alignItems: 'center',
  },
  saveBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },
  analyzeManualBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: 14, alignItems: 'center',
    marginTop: 16, alignSelf: 'stretch',
  },
  analyzeManualBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },

  suggestionsBox: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.outlineVariant,
    borderRadius: radii.md, marginTop: 4, overflow: 'hidden',
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceVariant },
  suggestionName: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, fontWeight: '600', color: colors.onSurface },
  suggestionMeta: { fontFamily: fontFamily.body, fontSize: 11, color: colors.outline, marginTop: 1 },
  suggestionStats: { alignItems: 'flex-end' },
  suggestionProtein: { fontFamily: fontFamily.headingBold, fontSize: 13, fontWeight: '700', color: colors.primary },
  suggestionCalories: { fontFamily: fontFamily.body, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },

  hintBox: {
    backgroundColor: colors.infoBg, borderRadius: radii.sm, padding: 10,
    marginTop: 8, borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  hintText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },
  hintBold: { fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.primary },

  autoNutrition: {
    backgroundColor: colors.infoBg, borderRadius: radii.md, padding: 14,
    marginTop: 12, borderWidth: 1, borderColor: '#C7D2FE',
  },
  autoNutritionTitle: { fontFamily: fontFamily.headingBold, fontSize: 12, fontWeight: '700', color: colors.primaryDark, marginBottom: 10 },
  autoNutritionRow: { flexDirection: 'row', alignItems: 'center' },
  autoNutritionItem: { flex: 1, alignItems: 'center' },
  autoNutritionValue: { fontFamily: fontFamily.headingBold, fontSize: 20, fontWeight: '800', color: colors.primary },
  autoNutritionLabel: { fontFamily: fontFamily.body, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  autoNutritionDivider: { width: 1, height: 36, backgroundColor: '#C7D2FE' },
  autoNutritionNote: { fontFamily: fontFamily.body, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' },

  exerciseBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.success,
  },
  exerciseBtnText: { color: colors.success, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 14 },
  exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  exerciseTypeBtn: {
    width: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.background, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  exerciseTypeBtnActive: { backgroundColor: colors.infoBg, borderColor: colors.primary },
  exerciseTypeEmoji: { fontSize: 24, marginBottom: 4 },
  exerciseTypeName: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, textAlign: 'center' },
  exerciseTypeNameActive: { color: colors.primary },
  calPreview: {
    backgroundColor: colors.successBg, borderRadius: radii.sm, padding: 12,
    marginTop: 16, borderWidth: 1, borderColor: '#A7F3D0',
  },
  calPreviewText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },

  balanceCard: { marginBottom: spacing.stackLg },
  balanceTitle: { fontFamily: fontFamily.headingSemiBold, fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 14 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  balanceItem: { alignItems: 'center', flex: 1 },
  balanceMinus: { fontSize: 18, fontWeight: '700', color: colors.outline, marginHorizontal: 2, fontFamily: fontFamily.headingBold },
  balanceValue: { fontFamily: fontFamily.headingBold, fontSize: 16, fontWeight: '800', color: colors.onSurface },
  balanceLabel: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 2, textAlign: 'center', fontFamily: fontFamily.bodySemiBold },
  balanceResult: {
    borderWidth: 2, borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 4,
  },
  balanceResultValue: { fontSize: 17, fontWeight: '900', fontFamily: fontFamily.headingBold },
  balanceNote: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 6, fontFamily: fontFamily.bodySemiBold },
  balanceBmrNote: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', fontFamily: fontFamily.body },

  // Apple Watch / HealthKit card
  watchCard: { marginBottom: spacing.stackLg },
  watchHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  watchTitle: { fontFamily: fontFamily.headingSemiBold, fontSize: 16, fontWeight: '700', color: colors.onSurface, flex: 1, marginRight: spacing.stackSm },
  watchRefreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm, backgroundColor: colors.infoBg },
  watchRefreshText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, fontWeight: '600', color: colors.primary },
  watchConnectNote: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18, marginBottom: 12 },
  watchConnectBtn: {
    backgroundColor: colors.success, borderRadius: radii.md,
    paddingVertical: 13, alignItems: 'center', ...shadow('sm'),
  },
  watchConnectBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },
  watchStatsRow: { flexDirection: 'row', alignItems: 'center' },
  watchStatItem: { flex: 1, alignItems: 'center' },
  watchStatValue: { fontFamily: fontFamily.headingBold, fontSize: 22, fontWeight: '800', color: colors.success },
  watchStatLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 3, textAlign: 'center' },
  watchStatDivider: { width: 1, height: 40, backgroundColor: colors.outlineVariant },
});
