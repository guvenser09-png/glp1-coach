import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { saveUserProfile } from '../../services/firestoreService';

const ACTIVITY_LEVELS = [
  { key: 'sedentary', days: 0 },
  { key: 'lightlyActive', days: 2 },
  { key: 'moderatelyActive', days: 4 },
  { key: 'veryActive', days: 6 },
];

function Field({ label, error, children }) {
  return (
    <View style={fieldStyles.fieldWrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
      {error ? <Text style={fieldStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  fieldWrapper: { marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 2 },
});

export default function RegisterScreen({ navigation }) {
  const { signUp } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderatelyActive');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    const h = parseInt(height, 10);
    if (isNaN(h) || h < 100 || h > 250) newErrors.height = 'Enter a valid height (100–250 cm)';
    const w = parseFloat(weight);
    if (isNaN(w) || w < 30 || w > 300) newErrors.weight = 'Enter a valid weight (30–300 kg)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { user } = await signUp(email, password);
      const weightVal = parseFloat(weight);
      const heightVal = parseInt(height, 10);
      const selectedActivity = ACTIVITY_LEVELS.find((a) => a.key === activityLevel);
      const exerciseDaysPerWeek = selectedActivity ? selectedActivity.days : 4;
      const proteinTarget = Math.round(weightVal * 1.6);

      await saveUserProfile(user.uid, {
        name: name.trim(),
        email: email.trim(),
        height: heightVal,
        weight: weightVal,
        proteinTarget,
        activityLevel,
        exerciseDaysPerWeek,
        createdAt: new Date().toISOString(),
      });

      // Navigate to Onboarding after register
      navigation.navigate('Onboarding');
    } catch (err) {
      let msg = 'Registration failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      else if (err.code === 'auth/invalid-email') msg = 'Invalid email address.';
      else if (err.code === 'auth/weak-password') msg = 'Password is too weak.';
      Alert.alert('Registration Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>💊</Text>
          </View>
          <Text style={styles.appName}>GLP-1 Coach</Text>
          <Text style={styles.tagline}>{t('appTagline')}</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>{t('register')}</Text>

          <Field label={t('name')} error={errors.name}>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder={t('namePlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: null })); }}
              returnKeyType="next"
            />
          </Field>

          <Field label={t('email')} error={errors.email}>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: null })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </Field>

          <Field label={t('password')} error={errors.password}>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: null })); }}
              secureTextEntry
              returnKeyType="next"
            />
          </Field>

          {/* Height & Weight row */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('height')} (cm)</Text>
              <TextInput
                style={[styles.input, errors.height && styles.inputError]}
                placeholder={t('heightPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={height}
                onChangeText={(v) => { setHeight(v); setErrors((e) => ({ ...e, height: null })); }}
                keyboardType="numeric"
                returnKeyType="next"
              />
              {errors.height ? <Text style={styles.errorText}>{errors.height}</Text> : null}
            </View>

            <View style={[styles.halfField, { marginLeft: 12 }]}>
              <Text style={styles.label}>{t('weight')} (kg)</Text>
              <TextInput
                style={[styles.input, errors.weight && styles.inputError]}
                placeholder="70"
                placeholderTextColor="#9CA3AF"
                value={weight}
                onChangeText={(v) => { setWeight(v); setErrors((e) => ({ ...e, weight: null })); }}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              {errors.weight ? <Text style={styles.errorText}>{errors.weight}</Text> : null}
            </View>
          </View>

          {/* Protein target preview */}
          {weight && !isNaN(parseFloat(weight)) && (
            <View style={styles.proteinPreview}>
              <Text style={styles.proteinPreviewText}>
                🥩 {t('proteinTarget')}: {Math.round(parseFloat(weight) * 1.6)}g / {t('perDay')}
              </Text>
            </View>
          )}

          {/* Activity Level */}
          <Text style={[styles.label, { marginTop: 12 }]}>{t('activityLevel')}</Text>
          <View style={styles.activityRow}>
            {ACTIVITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.key}
                style={[
                  styles.activityPill,
                  activityLevel === level.key && styles.activityPillActive,
                ]}
                onPress={() => setActivityLevel(level.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.activityPillText,
                    activityLevel === level.key && styles.activityPillTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {t(level.key)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t('register')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={styles.linkLabel}>{t('hasAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>{t('login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoSection: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  logoEmoji: { fontSize: 32 },
  appName: { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  fieldWrapper: { marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 2 },
  row: { flexDirection: 'row', marginTop: 4 },
  halfField: { flex: 1 },
  proteinPreview: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
  },
  proteinPreviewText: { fontSize: 13, color: '#4338CA', fontWeight: '600' },
  activityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  activityPill: {
    flex: 1,
    minWidth: '44%',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  activityPillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  activityPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  activityPillTextActive: {
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  linkLabel: { color: '#6B7280', fontSize: 14 },
  link: { color: '#4F46E5', fontSize: 14, fontWeight: '600' },
});
