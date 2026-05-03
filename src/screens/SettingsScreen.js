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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getUserProfile, saveUserProfile } from '../services/firestoreService';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editExercise, setEditExercise] = useState('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    setLoading(true);
    try {
      const p = await getUserProfile(user.uid);
      if (p) {
        setProfile(p);
        setEditName(p.name || '');
        setEditProtein(String(p.proteinTarget || 120));
        setEditExercise(String(p.exerciseDaysPerWeek || 3));
      } else {
        // Fallback defaults
        const fallback = { name: '', email: user.email, proteinTarget: 120, exerciseDaysPerWeek: 3 };
        setProfile(fallback);
        setEditName('');
        setEditProtein('120');
        setEditExercise('3');
      }
    } catch {
      // Firebase not configured
      const fallback = { name: '', email: user?.email || '', proteinTarget: 120, exerciseDaysPerWeek: 3 };
      setProfile(fallback);
      setEditName('');
      setEditProtein('120');
      setEditExercise('3');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const pt = parseInt(editProtein, 10);
    const ed = parseInt(editExercise, 10);
    if (isNaN(pt) || pt < 50 || pt > 300) {
      Alert.alert('Invalid input', 'Protein target must be between 50 and 300 g.');
      return;
    }
    if (isNaN(ed) || ed < 0 || ed > 7) {
      Alert.alert('Invalid input', 'Exercise days must be between 0 and 7.');
      return;
    }

    setSaving(true);
    try {
      if (user) {
        await saveUserProfile(user.uid, {
          name: editName.trim(),
          proteinTarget: pt,
          exerciseDaysPerWeek: ed,
        });
      }
      setProfile((prev) => ({
        ...prev,
        name: editName.trim(),
        proteinTarget: pt,
        exerciseDaysPerWeek: ed,
      }));
      setEditMode(false);
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.heading}>{t('settings')}</Text>

        {/* Profile Card */}
        <View style={styles.card}>
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
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(true)}>
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
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.fieldLabel}>{t('proteinTarget')} (g)</Text>
              <TextInput
                style={styles.input}
                value={editProtein}
                onChangeText={setEditProtein}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>{t('exerciseFrequency')}</Text>
              <TextInput
                style={styles.input}
                value={editExercise}
                onChangeText={setEditExercise}
                keyboardType="numeric"
              />

              <View style={styles.editButtonRow}>
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => setEditMode(false)}
                >
                  <Text style={styles.cancelEditText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveEditBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveEditText}>{t('save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{profile?.proteinTarget ?? 120}g</Text>
                <Text style={styles.statLabel}>{t('proteinTarget')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{profile?.exerciseDaysPerWeek ?? 3}</Text>
                <Text style={styles.statLabel}>{t('exerciseFrequency')}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Language Section */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('language')}</Text>
          <View style={styles.languageRow}>
            <TouchableOpacity
              style={[
                styles.langButton,
                language === 'en' && styles.langButtonActive,
              ]}
              onPress={() => setLanguage('en')}
              activeOpacity={0.8}
            >
              <Text style={styles.langFlag}>🇺🇸</Text>
              <Text
                style={[
                  styles.langText,
                  language === 'en' && styles.langTextActive,
                ]}
              >
                {t('english')}
              </Text>
              {language === 'en' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.langButton,
                language === 'tr' && styles.langButtonActive,
              ]}
              onPress={() => setLanguage('tr')}
              activeOpacity={0.8}
            >
              <Text style={styles.langFlag}>🇹🇷</Text>
              <Text
                style={[
                  styles.langText,
                  language === 'tr' && styles.langTextActive,
                ]}
              >
                {t('turkish')}
              </Text>
              {language === 'tr' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={[styles.card, styles.infoCard]}>
          <Text style={styles.infoTitle}>GLP-1 Coach</Text>
          <Text style={styles.infoText}>
            {language === 'tr'
              ? 'GLP-1 tedavisi sırasında kas kitlenizi korumak için tasarlanmıştır.'
              : 'Designed to help preserve muscle mass during GLP-1 treatment.'}
          </Text>
          <Text style={styles.infoVersion}>v1.0.0</Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 24, paddingTop: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarEmoji: { fontSize: 24 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  profileEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  editBtn: { padding: 8 },
  editBtnText: { fontSize: 18 },
  editSection: { marginTop: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  editButtonRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  cancelEditBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  cancelEditText: { color: '#374151', fontWeight: '600' },
  saveEditBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  saveEditText: { color: '#FFFFFF', fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#F3F4F6' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#4F46E5' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 14 },
  languageRow: { flexDirection: 'row', gap: 10 },
  langButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  langButtonActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  langFlag: { fontSize: 20 },
  langText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
  langTextActive: { color: '#4F46E5', fontWeight: '700' },
  checkmark: { fontSize: 16, color: '#4F46E5', fontWeight: '700' },
  infoCard: { backgroundColor: '#EEF2FF' },
  infoTitle: { fontSize: 16, fontWeight: '800', color: '#4338CA', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#4338CA', lineHeight: 18 },
  infoVersion: { fontSize: 11, color: '#818CF8', marginTop: 8 },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 16 },
});
