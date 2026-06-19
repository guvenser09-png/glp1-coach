import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView as RNSafeAreaView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnit } from '../context/UnitContext';
import { useSubscription } from '../context/SubscriptionContext';
import {
  getUserProfile,
  saveUserProfile,
  getWeightLogs,
  getMealLogs,
} from '../services/firestoreService';
import {
  getMedicationProfile,
  getDoseChanges,
  getDoseLogs,
} from '../services/medicationService';
import { requestHealthPermissions, isHealthAvailable } from '../services/healthkitService';
import {
  scheduleInjectionReminder,
  cancelInjectionReminders,
} from '../services/notificationService';
import { Card, ListRow, SectionTitle, Chip, Badge, PrimaryButton, SecondaryButton } from '../components/ui';
import { colors, semantic, spacing, radii, typography, fontFamily, shadow } from '../theme';

export default function SettingsScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { unitSystem, setUnitSystem, formatWeight, formatHeight, isImperial,
          toDisplayWeight, toDisplayHeight, parseWeightToKg, parseHeightToCm,
          weightUnit, heightUnit, weightRange, heightRange } = useUnit();
  const { isPremium, isLoaded, subscriptionPlan, manageSubscription } = useSubscription();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editExercise, setEditExercise] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [medProfile, setMedProfile] = useState(null);
  const [injectionReminderOn, setInjectionReminderOn] = useState(false);

  // Protein target editor
  const [proteinModalVisible, setProteinModalVisible] = useState(false);
  const [selectedPerKg, setSelectedPerKg] = useState(null); // 1.6 | 1.8 | 2.0 | 2.2 | null (custom)
  const [customProtein, setCustomProtein] = useState('');
  const [savingProtein, setSavingProtein] = useState(false);

  // Data & Sync
  const [exporting, setExporting] = useState(null); // 'csv' | 'pdf' | null
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthSynced, setHealthSynced] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);

  const PROTEIN_PER_KG_OPTIONS = [1.6, 1.8, 2.0, 2.2];

  useEffect(() => {
    if (user) {
      loadProfile();
      loadMedication();
    }
  }, [user]);

  // Probe Apple Health availability on iOS (no-op / false elsewhere).
  useEffect(() => {
    let active = true;
    (async () => {
      if (Platform.OS !== 'ios') return;
      try {
        const avail = await isHealthAvailable();
        if (active) setHealthAvailable(!!avail);
      } catch {
        if (active) setHealthAvailable(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const p = await getUserProfile(user.uid);
      if (p) {
        setProfile(p);
        setEditName(p.name || '');
        setEditProtein(String(p.proteinTarget || 120));
        setEditExercise(String(p.exerciseDaysPerWeek || 3));
        setEditWeight(p.weight ? String(toDisplayWeight(p.weight)) : '');
        setEditHeight(p.height ? String(Math.round(toDisplayHeight(p.height))) : '');
      } else {
        const fallback = { name: '', email: user.email, proteinTarget: 120, exerciseDaysPerWeek: 3 };
        setProfile(fallback);
        setEditName(''); setEditProtein('120'); setEditExercise('3');
        setEditWeight(''); setEditHeight('');
      }
    } catch {
      const fallback = { name: '', email: user?.email || '', proteinTarget: 120, exerciseDaysPerWeek: 3 };
      setProfile(fallback);
      setEditName(''); setEditProtein('120'); setEditExercise('3');
      setEditWeight(''); setEditHeight('');
    } finally {
      setLoading(false);
    }
  }

  async function loadMedication() {
    try {
      const mp = await getMedicationProfile(user.uid);
      setMedProfile(mp);
      // Reminder is considered on if there's an active medication with a weekday.
      setInjectionReminderOn(
        !!mp && mp.status === 'currentlyUsing' && mp.injectionWeekday != null
      );
    } catch {
      setMedProfile(null);
      setInjectionReminderOn(false);
    }
  }

  async function handleToggleInjectionReminder(next) {
    const isTr = language === 'tr';
    if (next) {
      if (!medProfile || medProfile.injectionWeekday == null) {
        Alert.alert(
          isTr ? 'İlaç Bilgisi Gerekli' : 'Medication Info Needed',
          isTr
            ? 'Enjeksiyon hatırlatıcısını açmak için önce ilaç ve enjeksiyon gününü ayarlayın.'
            : 'To enable injection reminders, set up your medication and injection day first.',
          [
            { text: isTr ? 'İptal' : 'Cancel', style: 'cancel' },
            {
              text: isTr ? 'Ayarla' : 'Set up',
              onPress: () => navigation.navigate('Medication'),
            },
          ]
        );
        return;
      }
      let ok = false;
      try {
        ok = await scheduleInjectionReminder(medProfile, language);
      } catch {
        ok = false;
      }
      if (ok) {
        setInjectionReminderOn(true);
      } else {
        setInjectionReminderOn(false);
        Alert.alert(
          isTr ? 'Hatırlatıcı Açılamadı' : 'Could not enable reminder',
          isTr
            ? 'Bildirim izni gerekli veya ilaç durumu aktif değil. Lütfen ilaç ayarlarını kontrol edin.'
            : 'Notification permission is required or your medication is not active. Please check your medication settings.'
        );
      }
    } else {
      await cancelInjectionReminders();
      setInjectionReminderOn(false);
    }
  }

  async function handleSave() {
    const ed = parseInt(editExercise, 10);
    const isTr = language === 'tr';
    const wKg = editWeight ? parseWeightToKg(editWeight) : null;
    const hCm = editHeight ? parseHeightToCm(editHeight) : null;
    const wDisplay = editWeight ? parseFloat(editWeight.replace(',', '.')) : null;
    const hDisplay = editHeight ? parseFloat(editHeight.replace(',', '.')) : null;

    if (isNaN(ed) || ed < 0 || ed > 7) {
      Alert.alert(isTr ? 'Hatalı Giriş' : 'Invalid input', isTr ? 'Egzersiz günü 0-7 arasında olmalı.' : 'Exercise days must be between 0 and 7.');
      return;
    }
    if (editWeight && (wKg === null || wDisplay < weightRange.min || wDisplay > weightRange.max)) {
      Alert.alert(isTr ? 'Hatalı Giriş' : 'Invalid input',
        isTr ? `Kilo ${weightRange.min}-${weightRange.max} ${weightUnit} arasında olmalı.`
             : `Weight must be between ${weightRange.min}-${weightRange.max} ${weightUnit}.`);
      return;
    }
    if (editHeight && (hCm === null || hDisplay < heightRange.min || hDisplay > heightRange.max)) {
      Alert.alert(isTr ? 'Hatalı Giriş' : 'Invalid input',
        isTr ? `Boy ${heightRange.min}-${heightRange.max} ${heightUnit} arasında olmalı.`
             : `Height must be between ${heightRange.min}-${heightRange.max} ${heightUnit}.`);
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: editName.trim(),
        exerciseDaysPerWeek: ed,
        ...(wKg !== null ? { weight: wKg } : {}),
        ...(hCm !== null ? { height: hCm } : {}),
      };
      // Merge against the full stored profile so we never wipe other fields
      // (protein target/multiplier flags, gender, email, etc.).
      const base = (user ? await getUserProfile(user.uid) : null) || profile || {};
      const merged = { ...base, ...updates };
      if (user) await saveUserProfile(user.uid, merged);
      setProfile(merged);
      setEditMode(false);
    } catch {
      Alert.alert(isTr ? 'Hata' : 'Error', isTr ? 'Kaydedilemedi. Tekrar deneyin.' : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function openProteinModal() {
    // Prefill from current profile: pick up the saved g/kg multiplier if any,
    // otherwise treat the current grams target as a custom absolute value.
    const perKg = profile?.proteinPerKg;
    if (perKg != null && PROTEIN_PER_KG_OPTIONS.includes(perKg) && !profile?.proteinTargetCustom) {
      setSelectedPerKg(perKg);
      setCustomProtein('');
    } else {
      setSelectedPerKg(null);
      setCustomProtein(String(profile?.proteinTarget ?? 120));
    }
    setProteinModalVisible(true);
  }

  // Live preview of the resulting grams target inside the modal.
  const proteinWeightKg = profile?.weight || null;
  const proteinPreviewGrams =
    selectedPerKg != null && proteinWeightKg
      ? Math.round(proteinWeightKg * selectedPerKg)
      : selectedPerKg != null
        ? null
        : (customProtein ? parseInt(customProtein, 10) : null);

  async function handleSaveProtein() {
    const isTr = language === 'tr';

    if (selectedPerKg != null) {
      // Multiplier chosen — needs a known weight to compute grams.
      if (!proteinWeightKg) {
        Alert.alert(
          isTr ? 'Kilo Gerekli' : 'Weight Needed',
          isTr
            ? 'g/kg çarpanı kullanmak için önce profilinizde kilonuzu kaydedin.'
            : 'To use a g/kg multiplier, please save your weight in the profile first.'
        );
        return;
      }
    } else {
      // Custom absolute grams.
      const grams = parseInt(customProtein, 10);
      if (isNaN(grams) || grams < 50 || grams > 300) {
        Alert.alert(
          isTr ? 'Hatalı Giriş' : 'Invalid input',
          isTr ? 'Protein hedefi 50-300g arasında olmalı.' : 'Protein target must be between 50 and 300 g.'
        );
        return;
      }
    }

    setSavingProtein(true);
    try {
      const current = user ? await getUserProfile(user.uid) : (profile || {});
      const base = current || {};
      let updates;
      if (selectedPerKg != null) {
        const grams = Math.round(proteinWeightKg * selectedPerKg);
        updates = {
          proteinTarget: grams,
          proteinPerKg: selectedPerKg,
          proteinTargetCustom: false,
        };
      } else {
        const grams = parseInt(customProtein, 10);
        updates = {
          proteinTarget: grams,
          proteinTargetCustom: true,
        };
      }
      const merged = { ...base, ...updates };
      if (user) await saveUserProfile(user.uid, merged);
      setProfile((prev) => ({ ...prev, ...updates }));
      setEditProtein(String(updates.proteinTarget));
      setProteinModalVisible(false);
    } catch {
      Alert.alert(isTr ? 'Hata' : 'Error', isTr ? 'Kaydedilemedi. Tekrar deneyin.' : 'Failed to save. Please try again.');
    } finally {
      setSavingProtein(false);
    }
  }

  // ── Data export (CSV / PDF) ───────────────────────────────────────────────
  async function gatherExportData() {
    const uid = user?.uid;
    // Fetch everything in parallel; tolerate any single source failing.
    const [prof, weightLogs, mealLogs, doseLogs, doseChanges] = await Promise.all([
      (async () => { try { return uid ? await getUserProfile(uid) : null; } catch { return null; } })(),
      (async () => { try { return uid ? await getWeightLogs(uid) : []; } catch { return []; } })(),
      (async () => { try { return uid ? await getMealLogs(uid) : []; } catch { return []; } })(),
      (async () => { try { return uid ? await getDoseLogs(uid) : []; } catch { return []; } })(),
      (async () => { try { return uid ? await getDoseChanges(uid) : []; } catch { return []; } })(),
    ]);
    return {
      profile: prof || profile || {},
      weightLogs: weightLogs || [],
      mealLogs: mealLogs || [],
      doseLogs: doseLogs || [],
      doseChanges: doseChanges || [],
      exportedAt: new Date().toISOString(),
      language,
    };
  }

  async function handleExport(format) {
    if (exporting) return;
    // exportService is optional / may be a native-only build feature — load
    // it defensively so a missing module never crashes the screen.
    let exportService = null;
    try {
      exportService = require('../services/exportService');
    } catch {
      exportService = null;
    }
    const fn = exportService
      ? (format === 'pdf' ? exportService.exportAsPdf : exportService.exportAsCsv)
      : null;
    if (typeof fn !== 'function') {
      Alert.alert(
        isTr ? 'Şu An Kullanılamıyor' : 'Not Available',
        isTr
          ? 'Veri dışa aktarma bu sürümde henüz hazır değil. Lütfen daha sonra tekrar deneyin.'
          : 'Data export is not available in this build yet. Please try again later.'
      );
      return;
    }

    setExporting(format);
    try {
      const data = await gatherExportData();
      await fn({ ...data, language });
    } catch (e) {
      Alert.alert(
        isTr ? 'Dışa Aktarılamadı' : 'Export Failed',
        isTr
          ? 'Verileriniz dışa aktarılırken bir sorun oluştu. Lütfen tekrar deneyin.'
          : 'Something went wrong while exporting your data. Please try again.'
      );
    } finally {
      setExporting(null);
    }
  }

  // ── Apple Health ──────────────────────────────────────────────────────────
  async function handleConnectHealth() {
    if (healthBusy) return;
    if (Platform.OS !== 'ios') {
      Alert.alert(
        isTr ? 'Yalnızca iOS' : 'iOS Only',
        isTr
          ? 'Apple Health yalnızca iPhone üzerinde kullanılabilir.'
          : 'Apple Health is only available on iPhone.'
      );
      return;
    }
    setHealthBusy(true);
    try {
      const granted = await requestHealthPermissions();
      if (granted) {
        setHealthSynced(true);
      } else {
        setHealthSynced(false);
        Alert.alert(
          isTr ? 'Bağlanılamadı' : 'Could Not Connect',
          isTr
            ? 'Apple Health erişimi verilmedi. Ayarlar > Sağlık üzerinden izin verebilirsiniz.'
            : 'Apple Health access was not granted. You can allow it via Settings > Health.'
        );
      }
    } catch {
      setHealthSynced(false);
      Alert.alert(
        isTr ? 'Bağlanılamadı' : 'Could Not Connect',
        isTr
          ? 'Apple Health bu cihazda kullanılamıyor.'
          : 'Apple Health is unavailable on this device.'
      );
    } finally {
      setHealthBusy(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      language === 'tr' ? 'Hesabı Sil' : 'Delete Account',
      language === 'tr'
        ? 'Hesabınızı silmek istediğinizden emin misiniz? Tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz.'
        : 'Are you sure you want to delete your account? All your data will be permanently deleted. This cannot be undone.',
      [
        { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
        {
          text: language === 'tr' ? 'Hesabı Sil' : 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const AsyncStorage = require('@react-native-async-storage/async-storage').default;
              await AsyncStorage.clear();
              signOut();
            } catch {
              signOut();
            }
          },
        },
      ]
    );
  }

  function handleLogout() {
    Alert.alert(
      t('logout'),
      language === 'tr' ? 'Çıkış yapmak istediğinizden emin misiniz?' : 'Are you sure you want to log out?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  }

  const isTr = language === 'tr';

  const PRIVACY_TEXT = isTr ? `GİZLİLİK POLİTİKASI\n\nSon güncelleme: Mayıs 2026\n\n1. Toplanan Veriler\nUygulama; ad, e-posta, kilo, boy ve cinsiyet bilgilerinizi cihazınızda yerel olarak saklar. Öğün analizi veya wellness rehberi sohbeti için girdiğiniz metin ve fotoğraflar OpenAI'ye gönderilir.\n\n2. Verilerin Kullanımı\nVerileriniz yalnızca kişiselleştirilmiş protein hedefi ve beslenme önerileri oluşturmak için kullanılır. Üçüncü taraflara satılmaz veya paylaşılmaz.\n\n3. OpenAI\nÖğün analizi ve wellness sohbeti için girdiğiniz veriler OpenAI API'sine iletilir. OpenAI gizlilik politikası için: openai.com/privacy\n\n4. Veri Güvenliği\nVerileriniz şifreli bağlantılar (HTTPS/TLS) üzerinden iletilir. Yerel veriler cihazınızın güvenli depolama alanında tutulur.\n\n5. Veri Silme\nAyarlar > Hesabı Kalıcı Olarak Sil seçeneği ile tüm verilerinizi silebilirsiniz.\n\n6. İletişim\nSorularınız için: support@glp1coach.app` : `PRIVACY POLICY\n\nLast updated: May 2026\n\n1. Data We Collect\nThe app stores your name, email, weight, height, and gender locally on your device. Text and photos you enter for meal analysis or wellness guide chat are sent to OpenAI.\n\n2. How We Use Your Data\nYour data is used solely to generate personalized protein targets and nutrition suggestions. It is never sold or shared with third parties.\n\n3. OpenAI\nData you enter for meal analysis and wellness chat is sent to the OpenAI API. For OpenAI's privacy policy visit: openai.com/privacy\n\n4. Data Security\nAll data is transmitted over encrypted connections (HTTPS/TLS). Local data is stored in your device's secure storage.\n\n5. Data Deletion\nYou can delete all your data via Settings > Permanently Delete Account.\n\n6. Contact\nFor questions: support@glp1coach.app`;

  const TERMS_TEXT = isTr ? `KULLANIM KOŞULLARI\n\nSon güncelleme: Mayıs 2026\n\n1. Tıbbi Sorumluluk Reddi\nGLP-1 Coach bir yaşam tarzı takip uygulamasıdır. Tıbbi teşhis, tedavi veya tavsiye sunmaz. Sağlık kararları için her zaman bir sağlık profesyoneliyle görüşün.\n\n2. Acil Durum\nBu uygulama acil tıbbi durumlarda kullanılamaz. Acil durumda 112'yi arayın.\n\n3. Kullanıcı Sorumlulukları\nUygulamayı yasalara uygun şekilde kullanmayı, doğru bilgi girmeyi ve sağlığınızla ilgili kararları bir uzmanla değerlendirmeyi kabul edersiniz.\n\n4. Fikri Mülkiyet\nUygulama içeriği, tasarımı ve kodu telif hakkı koruması altındadır.\n\n5. Sorumluluk Sınırlaması\nUygulama "olduğu gibi" sunulmaktadır. Geliştiriciler uygulama kullanımından kaynaklanan doğrudan veya dolaylı zararlardan sorumlu tutulamaz.\n\n6. Değişiklikler\nBu koşullar önceden bildirim yapılmaksızın güncellenebilir. Uygulamayı kullanmaya devam etmek güncel koşulları kabul etmek anlamına gelir.\n\n7. İletişim\nSorularınız için: support@glp1coach.app` : `TERMS OF USE\n\nLast updated: May 2026\n\n1. Medical Disclaimer\nGLP-1 Coach is a lifestyle tracking application. It does not provide medical diagnosis, treatment, or advice. This app does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider for health decisions.\n\n2. Emergency Situations\nThis app cannot be used in medical emergencies. In an emergency, call your local emergency number.\n\n3. User Responsibilities\nYou agree to use the app in compliance with applicable laws, to enter accurate information, and to evaluate health-related decisions with a qualified professional.\n\n4. Intellectual Property\nApp content, design, and code are protected by copyright.\n\n5. Limitation of Liability\nThe app is provided "as is." Developers cannot be held liable for direct or indirect damages arising from use of the app.\n\n6. Changes\nThese terms may be updated without prior notice. Continued use of the app constitutes acceptance of the updated terms.\n\n7. Contact\nFor questions: support@glp1coach.app`;

  const LegalModal = ({ visible, onClose, title, content }) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RNSafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.7}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalBody}>{content}</Text>
        </ScrollView>
      </RNSafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const medSubtitle = medProfile?.drug
    ? `${medProfile.drug}${medProfile.dose ? ` · ${medProfile.dose}` : ''}`
    : (isTr ? 'İlaç ve enjeksiyon gününü ayarla' : 'Set up medication & injection day');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LegalModal
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
        title={isTr ? '🔒 Gizlilik Politikası' : '🔒 Privacy Policy'}
        content={PRIVACY_TEXT}
      />
      <LegalModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
        title={isTr ? '📄 Kullanım Koşulları' : '📄 Terms of Use'}
        content={TERMS_TEXT}
      />
      {/* Protein target editor modal */}
      <Modal
        visible={proteinModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProteinModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.proteinModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.proteinSheet}>
            <View style={styles.proteinHeader}>
              <Text style={styles.proteinTitle}>
                {isTr ? 'Protein Hedefi' : 'Protein Target'}
              </Text>
              <TouchableOpacity
                onPress={() => setProteinModalVisible(false)}
                style={styles.modalClose}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.proteinHint}>
              {isTr
                ? 'Kilonuza göre bir g/kg çarpanı seçin (antrenman günlerinde 2.0+ önerilir) veya sabit bir gram değeri girin.'
                : 'Pick a g/kg multiplier based on your weight (2.0+ recommended on training days), or enter a fixed grams value.'}
            </Text>

            <Text style={styles.fieldLabel}>{isTr ? 'g/kg Çarpanı' : 'g/kg Multiplier'}</Text>
            <View style={styles.chipRow}>
              {PROTEIN_PER_KG_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={`${opt.toFixed(1)} g/kg`}
                  selected={selectedPerKg === opt}
                  onPress={() => {
                    setSelectedPerKg(opt);
                    setCustomProtein('');
                  }}
                  style={styles.chip}
                />
              ))}
            </View>

            {selectedPerKg != null && (
              <Text style={styles.proteinPreview}>
                {proteinWeightKg
                  ? (isTr
                      ? `Hedef: ${Math.round(proteinWeightKg * selectedPerKg)}g (${Math.round(proteinWeightKg)} kg × ${selectedPerKg.toFixed(1)})`
                      : `Target: ${Math.round(proteinWeightKg * selectedPerKg)}g (${Math.round(proteinWeightKg)} kg × ${selectedPerKg.toFixed(1)})`)
                  : (isTr
                      ? 'Çarpan için profilinizde kilo gerekli.'
                      : 'Weight required in profile to use a multiplier.')}
              </Text>
            )}

            <Text style={styles.fieldLabel}>
              {isTr ? 'Veya sabit hedef (g)' : 'Or fixed target (g)'}
            </Text>
            <TextInput
              style={styles.input}
              value={customProtein}
              onChangeText={(txt) => {
                setCustomProtein(txt);
                if (txt) setSelectedPerKg(null);
              }}
              keyboardType="numeric"
              placeholder={isTr ? 'örn. 160' : 'e.g. 160'}
              placeholderTextColor={colors.outline}
              maxLength={3}
            />

            <View style={styles.editButtonRow}>
              <SecondaryButton
                title={t('cancel')}
                variant="outline"
                onPress={() => setProteinModalVisible(false)}
                style={{ flex: 1 }}
              />
              <View style={{ width: 10 }} />
              <PrimaryButton
                title={t('save')}
                onPress={handleSaveProtein}
                loading={savingProtein}
                disabled={savingProtein}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text style={styles.heading}>{t('settings')}</Text>

          {/* Subscription status (read-only — no paywall navigation) */}
          {isLoaded && isPremium && (
            <Card style={styles.cardSpacing} contentStyle={styles.premiumRow}>
              <Text style={styles.premiumIcon}>👑</Text>
              <View style={styles.premiumInfo}>
                <Text style={styles.premiumTitle}>
                  {isTr ? 'Premium Üye' : 'Premium Member'}
                </Text>
                <Text style={styles.premiumSub}>
                  {subscriptionPlan === 'annual'
                    ? (isTr ? 'Yıllık Plan' : 'Annual Plan')
                    : (isTr ? 'Aylık Plan' : 'Monthly Plan')}
                </Text>
              </View>
              <Badge label={isTr ? 'Aktif' : 'Active'} tone="success" />
            </Card>
          )}

          {/* Profile */}
          <SectionTitle title={isTr ? 'Profil' : 'Profile'} />
          <Card style={styles.cardSpacing}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {profile?.name || user?.email?.split('@')[0] || 'User'}
                </Text>
                <Text style={styles.profileEmail}>{user?.email || profile?.email || ''}</Text>
              </View>
              {!editMode && (
                <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(true)} activeOpacity={0.7}>
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
              )}
            </View>

            {editMode ? (
              <View style={styles.editSection}>
                <Text style={styles.fieldLabel}>{t('name')}</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('namePlaceholder')}
                  placeholderTextColor={colors.outline}
                />

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{isTr ? `Kilo (${weightUnit})` : `Weight (${weightUnit})`}</Text>
                    <TextInput
                      style={styles.input}
                      value={editWeight}
                      onChangeText={setEditWeight}
                      placeholder={isImperial ? '176' : '80'}
                      placeholderTextColor={colors.outline}
                      keyboardType="decimal-pad"
                      maxLength={6}
                    />
                  </View>
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{isTr ? `Boy (${heightUnit})` : `Height (${heightUnit})`}</Text>
                    <TextInput
                      style={styles.input}
                      value={editHeight}
                      onChangeText={setEditHeight}
                      placeholder={isImperial ? '69' : '170'}
                      placeholderTextColor={colors.outline}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>{t('exerciseFrequency')}</Text>
                <TextInput
                  style={styles.input}
                  value={editExercise}
                  onChangeText={setEditExercise}
                  keyboardType="numeric"
                  placeholderTextColor={colors.outline}
                />

                <View style={styles.editButtonRow}>
                  <SecondaryButton
                    title={t('cancel')}
                    variant="outline"
                    onPress={() => setEditMode(false)}
                    style={{ flex: 1 }}
                  />
                  <View style={{ width: 10 }} />
                  <PrimaryButton
                    title={t('save')}
                    onPress={handleSave}
                    loading={saving}
                    disabled={saving}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{profile?.weight ? formatWeight(profile.weight) : '—'}</Text>
                  <Text style={styles.statLabel}>{isTr ? 'Kilo' : 'Weight'}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{profile?.height ? formatHeight(profile.height) : '—'}</Text>
                  <Text style={styles.statLabel}>{isTr ? 'Boy' : 'Height'}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{profile?.proteinTarget ?? 120}g</Text>
                  <Text style={styles.statLabel}>{t('proteinTarget')}</Text>
                </View>
              </View>
            )}
          </Card>

          {/* Protein target — editable row */}
          <Card style={styles.cardSpacing} padding={0} contentStyle={styles.groupInner}>
            <ListRow
              icon={<Text style={styles.rowEmoji}>🥩</Text>}
              label={isTr ? 'Protein Hedefi' : 'Protein Target'}
              subtitle={
                profile?.proteinPerKg && !profile?.proteinTargetCustom
                  ? `${profile.proteinTarget ?? 120}g · ${profile.proteinPerKg} g/kg`
                  : `${profile?.proteinTarget ?? 120}g${profile?.proteinTargetCustom ? (isTr ? ' · özel' : ' · custom') : ''}`
              }
              chevron
              onPress={openProteinModal}
            />
          </Card>

          {/* Points & Rewards */}
          <SectionTitle title={isTr ? 'Puanlarım & Ödüller' : 'Points & Rewards'} />
          <Card style={styles.cardSpacing} padding={0} contentStyle={styles.groupInner}>
            <ListRow
              icon={<Text style={styles.rowEmoji}>🏆</Text>}
              label={isTr ? 'Puanlarım & Ödüller' : 'Points & Rewards'}
              subtitle={isTr ? 'Rozetler, görevler ve XP' : 'Badges, missions & XP'}
              chevron
              onPress={() => navigation.navigate('Rewards')}
            />
          </Card>

          {/* Medication & Reminders */}
          <SectionTitle title={isTr ? 'İlaç & Hatırlatıcılar' : 'Medication & Reminders'} />
          <Card style={styles.cardSpacing} padding={0} contentStyle={styles.groupInner}>
            <ListRow
              icon={<Text style={styles.rowEmoji}>💉</Text>}
              label={isTr ? 'İlaç' : 'Medication'}
              subtitle={medSubtitle}
              chevron
              onPress={() => navigation.navigate('Medication')}
              divider
            />
            <ListRow
              icon={<Text style={styles.rowEmoji}>🔔</Text>}
              label={isTr ? 'Enjeksiyon Hatırlatıcısı' : 'Injection Reminder'}
              subtitle={isTr ? 'Enjeksiyon gününde 09:00\'da bildirim' : 'Weekly alert at 9:00 AM on injection day'}
              toggle
              toggleValue={injectionReminderOn}
              onToggle={handleToggleInjectionReminder}
              divider
            />
            <ListRow
              icon={<Text style={styles.rowEmoji}>📋</Text>}
              label={isTr ? 'Ölçümler & Semptomlar' : 'Measurements & Symptoms'}
              subtitle={isTr ? 'Kilo, ölçü ve yan etki kaydı' : 'Log weight, measurements & side effects'}
              chevron
              onPress={() => navigation.navigate('HealthLog')}
            />
          </Card>

          {/* Language */}
          <SectionTitle title={t('language')} />
          <Card style={styles.cardSpacing}>
            <View style={styles.chipRow}>
              <Chip
                label="🇺🇸 English"
                selected={language === 'en'}
                onPress={() => setLanguage('en')}
                style={styles.chip}
              />
              <Chip
                label="🇹🇷 Türkçe"
                selected={language === 'tr'}
                onPress={() => setLanguage('tr')}
                style={styles.chip}
              />
            </View>
          </Card>

          {/* Units */}
          <SectionTitle title={isTr ? 'Ölçü Birimi' : 'Unit System'} />
          <Card style={styles.cardSpacing}>
            <View style={styles.chipRow}>
              <Chip
                label={isTr ? '📏 Metrik (kg/cm)' : '📏 Metric (kg/cm)'}
                selected={unitSystem === 'metric'}
                onPress={() => setUnitSystem('metric')}
                style={styles.chip}
              />
              <Chip
                label={isTr ? '📐 İmperial (lbs/in)' : '📐 Imperial (lbs/in)'}
                selected={unitSystem === 'imperial'}
                onPress={() => setUnitSystem('imperial')}
                style={styles.chip}
              />
            </View>
          </Card>

          {/* Data & Sync */}
          <SectionTitle title={isTr ? 'Veri & Senkronizasyon' : 'Data & Sync'} />
          <Card style={styles.cardSpacing} padding={0} contentStyle={styles.groupInner}>
            <ListRow
              icon={<Text style={styles.rowEmoji}>📄</Text>}
              label={isTr ? 'Verileri Dışa Aktar (CSV)' : 'Export Data (CSV)'}
              subtitle={isTr ? 'Kilo, öğün ve doz kayıtları' : 'Weight, meal & dose records'}
              right={
                exporting === 'csv' ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : undefined
              }
              chevron={exporting !== 'csv'}
              disabled={!!exporting}
              onPress={() => handleExport('csv')}
              divider
            />
            <ListRow
              icon={<Text style={styles.rowEmoji}>🧾</Text>}
              label={isTr ? 'Verileri Dışa Aktar (PDF)' : 'Export Data (PDF)'}
              subtitle={isTr ? 'Yazdırılabilir özet rapor' : 'Printable summary report'}
              right={
                exporting === 'pdf' ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : undefined
              }
              chevron={exporting !== 'pdf'}
              disabled={!!exporting}
              onPress={() => handleExport('pdf')}
              divider
            />
            {Platform.OS === 'ios' ? (
              <ListRow
                icon={<Text style={styles.rowEmoji}>❤️</Text>}
                label={isTr ? 'Apple Sağlık' : 'Apple Health'}
                subtitle={
                  healthSynced
                    ? (isTr ? 'Bağlı · senkronize' : 'Connected · synced')
                    : healthAvailable
                      ? (isTr ? 'Bağlamak için dokunun' : 'Tap to connect')
                      : (isTr ? 'Bu cihazda kullanılamıyor' : 'Unavailable on this device')
                }
                right={
                  healthBusy ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : healthSynced ? (
                    <Badge label={isTr ? 'Bağlı' : 'Synced'} tone="success" />
                  ) : undefined
                }
                chevron={!healthBusy && !healthSynced && healthAvailable}
                disabled={healthBusy || healthSynced || !healthAvailable}
                onPress={handleConnectHealth}
              />
            ) : (
              <ListRow
                icon={<Text style={styles.rowEmoji}>❤️</Text>}
                label={isTr ? 'Apple Sağlık' : 'Apple Health'}
                subtitle={isTr ? 'Yalnızca iOS' : 'iOS only'}
                right={<Badge label={isTr ? 'iOS' : 'iOS'} tone="neutral" />}
              />
            )}
          </Card>

          {/* Legal & Privacy */}
          <SectionTitle title={isTr ? '⚕️ Yasal & Gizlilik' : '⚕️ Legal & Privacy'} />
          <Card style={styles.cardSpacing}>
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                {isTr
                  ? 'Bu uygulama tıbbi tavsiye niteliği taşımaz. Sağlık durumunuzla ilgili kararlar için her zaman doktorunuza danışın.'
                  : 'This app does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider for health decisions.'}
              </Text>
            </View>

            <ListRow
              icon={<Text style={styles.rowEmoji}>🔒</Text>}
              label={isTr ? 'Gizlilik Politikası' : 'Privacy Policy'}
              chevron
              onPress={() => setPrivacyVisible(true)}
              divider
            />
            <ListRow
              icon={<Text style={styles.rowEmoji}>📄</Text>}
              label={isTr ? 'Kullanım Koşulları' : 'Terms of Use'}
              chevron
              onPress={() => setTermsVisible(true)}
            />
          </Card>

          {/* App Info */}
          <Card style={[styles.cardSpacing, styles.infoCard]}>
            <Text style={styles.infoTitle}>GLP-1 Coach</Text>
            <Text style={styles.infoText}>
              {isTr
                ? 'Protein takibi yapmanıza, güç kazanmanıza ve kas kütlenizi korumanıza yardımcı olmak için tasarlanmıştır.'
                : 'Designed to help you track protein, build strength, and maintain muscle mass.'}
            </Text>
            <Text style={styles.infoVersion}>v1.0.4</Text>
          </Card>

          {/* Sign out */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>

          {/* Delete Account */}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} activeOpacity={0.85}>
            <Text style={styles.deleteText}>
              {isTr ? '🗑 Hesabı Kalıcı Olarak Sil' : '🗑 Permanently Delete Account'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.containerMargin, paddingTop: spacing.gutter },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { ...typography.headlineMd, color: colors.onSurface, marginBottom: spacing.stackMd },

  cardSpacing: { marginBottom: spacing.stackMd },
  groupInner: { paddingHorizontal: spacing.cardPadding },

  // Premium status row (read-only)
  premiumRow: { flexDirection: 'row', alignItems: 'center' },
  premiumIcon: { fontSize: 28, marginRight: 12 },
  premiumInfo: { flex: 1 },
  premiumTitle: { ...typography.labelMd, color: colors.primaryDark, fontFamily: fontFamily.bodyBold },
  premiumSub: { ...typography.labelSm, color: colors.accent, marginTop: 2 },

  // Profile
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarEmoji: { fontSize: 24 },
  profileInfo: { flex: 1 },
  profileName: { ...typography.bodyLg, color: colors.onSurface, fontFamily: fontFamily.headingBold },
  profileEmail: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },
  editBtn: { padding: 8 },
  editBtnText: { fontSize: 18 },
  editSection: { marginTop: spacing.stackMd },
  rowInputs: { flexDirection: 'row', marginTop: 2 },
  fieldLabel: { ...typography.labelMd, color: colors.onSurfaceVariant, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    padding: 12,
    ...typography.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.background,
  },
  editButtonRow: { flexDirection: 'row', marginTop: spacing.stackMd },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.stackLg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.stackMd,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: colors.outlineVariant },
  statValue: { ...typography.headlineMd, color: colors.primary },
  statLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' },

  // Chips (language / units)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.stackSm },
  chip: { flexGrow: 1 },

  // Generic row emoji
  rowEmoji: { fontSize: 20 },

  // Info card
  infoCard: { backgroundColor: colors.infoBg },
  infoTitle: { ...typography.bodyMd, color: colors.primaryDark, fontFamily: fontFamily.headingExtraBold, marginBottom: 6 },
  infoText: { ...typography.labelSm, color: colors.primaryDark, lineHeight: 18 },
  infoVersion: { ...typography.labelSm, color: colors.accent, marginTop: 8 },

  // Disclaimer
  disclaimerBox: {
    backgroundColor: semantic.warning.bg,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  disclaimerText: { ...typography.labelSm, color: '#92400E', lineHeight: 18 },

  // Sign out / delete
  logoutButton: {
    backgroundColor: semantic.danger.bg,
    borderRadius: radii.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    marginTop: spacing.stackSm,
  },
  logoutText: { color: colors.danger, fontFamily: fontFamily.bodyBold, fontSize: 16 },
  deleteButton: {
    backgroundColor: 'transparent',
    borderRadius: radii.lg,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteText: { color: colors.outline, ...typography.labelMd },

  // Protein target modal
  proteinModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  proteinSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.cardPadding,
    paddingBottom: spacing.stackLg,
    ...shadow('lg'),
  },
  proteinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.stackSm,
  },
  proteinTitle: { flex: 1, ...typography.bodyLg, color: colors.onSurface, fontFamily: fontFamily.headingBold },
  proteinHint: { ...typography.labelSm, color: colors.onSurfaceVariant, lineHeight: 18, marginBottom: spacing.stackSm },
  proteinPreview: {
    ...typography.labelMd,
    color: colors.primary,
    fontFamily: fontFamily.bodySemiBold,
    marginTop: 8,
  },

  // Legal modal
  modalSafe: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  modalTitle: { flex: 1, ...typography.bodyLg, color: colors.onSurface, fontFamily: fontFamily.headingBold },
  modalClose: { padding: 8 },
  modalCloseText: { fontSize: 18, color: colors.onSurfaceVariant, fontFamily: fontFamily.bodySemiBold },
  modalContent: { padding: spacing.containerMargin },
  modalBody: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },
});
