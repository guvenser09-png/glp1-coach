import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useSubscription } from '../context/SubscriptionContext';
import { getUserProfile } from '../services/firestoreService';
import { analyzeMealWithAI, analyzeMealWithText } from '../services/openaiService';
import { saveMealAnalysis } from '../services/firestoreService';
import { sendCoachMessage } from '../services/coachChatService';
import { scheduleDailyMotivation, sendTestNotification } from '../services/notificationService';

export default function MealAnalysisScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { checkAccess } = useSubscription();
  const isTr = language === 'tr';

  const [imageUri, setImageUri] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);

  // Manual entry modal
  const [manualVisible, setManualVisible] = useState(false);
  const [manualAnalyzing, setManualAnalyzing] = useState(false);
  const [manualResult, setManualResult] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [manualFood, setManualFood] = useState('');
  const [profile, setProfile] = useState(null);

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

  useEffect(() => {
    if (!checkAccess('meal_analysis')) {
      navigation.navigate('Paywall', { featureKey: 'meal_analysis', featureName: t('mealAnalysis') });
    }
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayMealsKey = user ? `daily_meals_${user.uid}_${today}` : null;

  const loadTodayMeals = useCallback(async () => {
    if (!todayMealsKey) return;
    try {
      const raw = await AsyncStorage.getItem(todayMealsKey);
      if (raw) setTodayMeals(JSON.parse(raw));
    } catch (e) {}
  }, [todayMealsKey]);

  useEffect(() => { loadTodayMeals(); }, [loadTodayMeals]);

  useEffect(() => {
    if (user) getUserProfile(user.uid).then(p => { if (p) setProfile(p); });
    scheduleDailyMotivation(language);
  }, [user]);

  const proteinTarget = profile?.proteinTarget ?? 120;

  async function openChat() {
    setChatMessages([{
      role: 'assistant',
      content: isTr
        ? `Merhaba! Ben senin GLP-1 koçunum 💪 Bugünkü öğünlerini görüyorum. Sana nasıl yardımcı olabilirim?`
        : `Hey! I'm your GLP-1 coach 💪 I can see your meals today. How can I help you?`,
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
    setAnalyzing(true);
    try {
      const analysis = await analyzeMealWithAI(imageUri, language);
      setResult(analysis);
      const newMeal = {
        protein: analysis.protein,
        calories: analysis.calories || 0,
        foodType: analysis.foodType,
        portionSize: analysis.portionSize,
        imageUri,
        timestamp: new Date().toISOString(),
      };
      await saveMeals([...todayMeals, newMeal]);
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
    setManualAnalyzing(true);
    setManualResult(null);
    try {
      const analysis = await analyzeMealWithText(manualFood.trim(), language);
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
    const meal = {
      foodType: manualResult.foodType,
      protein: manualResult.protein,
      calories: manualResult.calories,
      portionSize: manualResult.portionSize,
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
    setManualVisible(false);
    setManualResult(null);
    setManualFood('');
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
  const PORTIONS = ['Small', 'Medium', 'Large'];
  const portionLabel = (p) => ({ Small: isTr ? 'Küçük' : 'Small', Medium: isTr ? 'Orta' : 'Medium', Large: isTr ? 'Büyük' : 'Large' }[p] || p);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.headerRow}>
          <View>
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
        </View>

        {/* Image Picker */}
        {imageUri && (
          <View style={styles.imageCard}>
            <Image source={{ uri: imageUri }} style={styles.pickedImage} resizeMode="cover" />
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.changeBtn} onPress={takePhoto}>
                <Text style={styles.changeBtnText}>{isTr ? '📸 Tekrar Çek' : '📸 Retake'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.changeBtn} onPress={pickImage}>
                <Text style={styles.changeBtnText}>{isTr ? '🖼️ Galeri' : '🖼️ Gallery'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
                onPress={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.analyzeBtnText}>{isTr ? 'Analiz ediliyor...' : 'Analyzing...'}</Text>
                  </View>
                ) : (
                  <Text style={styles.analyzeBtnText}>{t('analyzePhoto')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Analysis Result */}
        {result && (
          <View style={styles.resultCard}>
            {/* Header: food name + muscle score */}
            <View style={styles.resultHeaderRow}>
              <Text style={styles.resultFoodType}>{result.foodType}</Text>
              {result.muscleScore && (
                <View style={[styles.muscleScoreBadge, {
                  backgroundColor:
                    result.muscleScore === 'A+' ? '#ECFDF5' :
                    result.muscleScore === 'A'  ? '#D1FAE5' :
                    result.muscleScore === 'B'  ? '#EEF2FF' :
                    result.muscleScore === 'C'  ? '#FFFBEB' : '#FEF2F2',
                }]}>
                  <Text style={[styles.muscleScoreText, {
                    color:
                      result.muscleScore === 'A+' ? '#065F46' :
                      result.muscleScore === 'A'  ? '#047857' :
                      result.muscleScore === 'B'  ? '#3730A3' :
                      result.muscleScore === 'C'  ? '#92400E' : '#DC2626',
                  }]}>
                    {result.muscleScore}
                  </Text>
                </View>
              )}
            </View>

            {/* Macros row */}
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{t('proteinEstimate')}</Text>
                <Text style={styles.resultValue}>{result.protein}g</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{isTr ? 'Kalori' : 'Calories'}</Text>
                <Text style={styles.resultValue}>{result.calories} kcal</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{t('portionSize')}</Text>
                <Text style={styles.resultValue}>{portionLabel(result.portionSize)}</Text>
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

            {/* Sufficient badge */}
            <View style={[styles.evalBadge, { backgroundColor: result.sufficient ? '#ECFDF5' : '#FEF3C7' }]}>
              <Text style={[styles.evalText, { color: result.sufficient ? '#065F46' : '#92400E' }]}>
                {result.sufficient ? `✅ ${t('sufficient')}` : `⚠️ ${t('insufficient')}`}
              </Text>
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
          </View>
        )}

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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyText}>{isTr ? 'Henüz öğün eklenmedi' : 'No meals added yet'}</Text>
          </View>
        ) : (
          <View style={styles.mealsCard}>
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
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

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
                  <Text style={styles.chatName}>{isTr ? 'GLP-1 Koçun' : 'Your GLP-1 Coach'}</Text>
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

              {/* AI Analyze button */}
              {!manualResult && (
                <TouchableOpacity
                  style={[styles.saveBtn, { marginBottom: 8 }, manualAnalyzing && { opacity: 0.6 }]}
                  onPress={handleManualAnalyze}
                  disabled={manualAnalyzing}
                >
                  {manualAnalyzing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>🤖 {isTr ? 'Yapay Zeka ile Analiz Et' : 'Analyze with AI'}</Text>
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
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 24, paddingTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  heading: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#6B7280' },
  coachBtn: {
    backgroundColor: '#4F46E5', borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 10, alignItems: 'center', minWidth: 64,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  coachBtnEmoji: { fontSize: 20 },
  coachBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700', marginTop: 2 },

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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarEmoji: { fontSize: 22 },
  chatName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  chatStatus: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  chatClose: { padding: 8 },
  chatCloseText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  chatMessages: { flex: 1 },
  bubble: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleCoach: { justifyContent: 'flex-start' },
  bubbleEmoji: { fontSize: 20, marginRight: 8, marginBottom: 4 },
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

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  cameraBtn: {
    flex: 1, backgroundColor: '#10B981', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  photoBtn: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  photoBtnIcon: { fontSize: 24, marginBottom: 4 },
  photoBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  manualBtn: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  manualBtnIcon: { fontSize: 24, marginBottom: 4 },
  manualBtnText: { color: '#374151', fontWeight: '700', fontSize: 14 },

  imageCard: {
    backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  pickedImage: { width: '100%', height: 200 },
  imageActions: { flexDirection: 'row', padding: 12, gap: 10 },
  changeBtn: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center',
  },
  changeBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  analyzeBtn: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  resultCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  resultHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  resultFoodType: { fontSize: 15, fontWeight: '700', color: '#374151', flex: 1, marginRight: 8 },
  muscleScoreBadge: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  muscleScoreText: { fontSize: 14, fontWeight: '900' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  resultItem: { alignItems: 'center' },
  resultLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 2 },
  resultValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  qualityTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  qualityTag: {
    backgroundColor: '#EEF2FF', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  qualityTagText: { fontSize: 11, fontWeight: '700', color: '#4F46E5' },
  evalBadge: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
  evalText: { fontSize: 13, fontWeight: '600' },
  suggestionText: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 8 },
  smartSwapBox: {
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10,
    borderLeftWidth: 3, borderLeftColor: '#10B981', marginTop: 4,
  },
  smartSwapTitle: { fontSize: 12, fontWeight: '700', color: '#065F46', marginBottom: 4 },
  smartSwapText: { fontSize: 13, color: '#374151', lineHeight: 18 },

  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  todaySectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  todayTotals: { flexDirection: 'row', gap: 8 },
  todayTotalBadge: {
    backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 10,
    paddingVertical: 4, fontSize: 12, fontWeight: '700', color: '#4F46E5',
  },

  emptyCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 32,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  mealsCard: {
    backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  mealItem: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  mealBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  mealEmoji: { fontSize: 26, marginRight: 12 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  mealMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  mealProtein: { fontSize: 15, fontWeight: '800', color: '#4F46E5', marginRight: 8 },
  editBtn: { padding: 6 },
  editBtnText: { fontSize: 16 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 13, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  inputRow: { flexDirection: 'row' },
  portionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  portionPill: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#F9FAFB',
  },
  portionPillActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  portionPillText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  portionPillTextActive: { color: '#FFF' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  cancelBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  suggestionsBox: {
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, marginTop: 4, overflow: 'hidden',
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  suggestionName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  suggestionMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  suggestionStats: { alignItems: 'flex-end' },
  suggestionProtein: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  suggestionCalories: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  hintBox: {
    backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10,
    marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#4F46E5',
  },
  hintText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  hintBold: { fontWeight: '700', color: '#4F46E5' },

  autoNutrition: {
    backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14,
    marginTop: 12, borderWidth: 1, borderColor: '#C7D2FE',
  },
  autoNutritionTitle: { fontSize: 12, fontWeight: '700', color: '#4338CA', marginBottom: 10 },
  autoNutritionRow: { flexDirection: 'row', alignItems: 'center' },
  autoNutritionItem: { flex: 1, alignItems: 'center' },
  autoNutritionValue: { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  autoNutritionLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  autoNutritionDivider: { width: 1, height: 36, backgroundColor: '#C7D2FE' },
  autoNutritionNote: { fontSize: 11, color: '#6B7280', marginTop: 8, textAlign: 'center' },
});
