import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  SafeAreaView as RNSafeAreaView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, typography, fontFamily, spacing, radii, shadow } from '../../theme';
import { GradientHero } from '../../components/ui';

const PRIVACY_TEXT = {
  tr: `GİZLİLİK POLİTİKASI\n\nSon güncelleme: Mayıs 2026\n\n1. Toplanan Veriler\nUygulama; ad, e-posta, kilo, boy, cinsiyet bilgilerinizi ve günlük protein alımı, adım sayısı ve egzersiz kayıtlarınızı cihazınızda yerel olarak saklar. Öğün analizi veya wellness rehberi sohbeti için girdiğiniz metin ve fotoğraflar OpenAI'ye gönderilir.\n\n2. Verilerin Kullanımı\nVerileriniz yalnızca kişiselleştirilmiş protein hedefi ve beslenme önerileri oluşturmak için kullanılır. Üçüncü taraflara satılmaz veya paylaşılmaz.\n\n3. OpenAI\nÖğün analizi ve wellness sohbeti için girdiğiniz veriler OpenAI API'sine iletilir. OpenAI gizlilik politikası: openai.com/privacy\n\n4. Veri Güvenliği\nVerileriniz şifreli bağlantılar (HTTPS/TLS) üzerinden iletilir.\n\n5. Veri Silme\nAyarlar > Hesabı Kalıcı Olarak Sil seçeneği ile tüm verilerinizi silebilirsiniz.\n\n6. İletişim\nSorularınız için: support@glp1coach.app`,
  en: `PRIVACY POLICY\n\nLast updated: May 2026\n\n1. Data We Collect\nThe app stores your name, email, weight, height, gender, daily protein intake, step counts, and exercise logs locally on your device. Text and photos you enter for meal analysis or wellness guide chat are sent to OpenAI.\n\n2. How We Use Your Data\nYour data is used solely to generate personalized protein targets and nutrition suggestions. It is never sold or shared with third parties.\n\n3. OpenAI\nData you enter for meal analysis and wellness chat is sent to the OpenAI API. For OpenAI's privacy policy visit: openai.com/privacy\n\n4. Data Security\nAll data is transmitted over encrypted connections (HTTPS/TLS).\n\n5. Data Deletion\nYou can delete all your data via Settings > Permanently Delete Account.\n\n6. Contact\nFor questions: support@glp1coach.app`,
};

const TERMS_TEXT = {
  tr: `KULLANIM KOŞULLARI\n\nSon güncelleme: Mayıs 2026\n\n1. Tıbbi Sorumluluk Reddi\nGLP-1 Coach bir yaşam tarzı takip uygulamasıdır. Tıbbi teşhis, tedavi veya tavsiye sunmaz. Sağlık kararları için her zaman bir sağlık profesyoneliyle görüşün.\n\n2. Acil Durum\nBu uygulama acil tıbbi durumlarda kullanılamaz. Acil durumda 112'yi arayın.\n\n3. Kullanıcı Sorumlulukları\nUygulamayı yasalara uygun şekilde kullanmayı ve sağlıkla ilgili kararları bir uzmanla değerlendirmeyi kabul edersiniz.\n\n4. Sorumluluk Sınırlaması\nUygulama "olduğu gibi" sunulmaktadır. Geliştiriciler uygulamadan kaynaklanan zararlardan sorumlu tutulamaz.\n\n5. İletişim\nSorularınız için: support@glp1coach.app`,
  en: `TERMS OF USE\n\nLast updated: May 2026\n\n1. Medical Disclaimer\nGLP-1 Coach is a lifestyle tracking application. It does not provide medical diagnosis, treatment, or advice. Always consult a healthcare professional for health decisions.\n\n2. Emergency Situations\nThis app cannot be used in medical emergencies. In an emergency, call your local emergency number.\n\n3. User Responsibilities\nYou agree to use the app in compliance with applicable laws and to evaluate health-related decisions with a qualified professional.\n\n4. Limitation of Liability\nThe app is provided "as is." Developers cannot be held liable for damages arising from use of the app.\n\n5. Contact\nFor questions: support@glp1coach.app`,
};

export default function LoginScreen() {
  const { signInWithApple, signInWithEmail } = useAuth();
  const { language } = useLanguage();
  const isTr = language === 'tr';
  const [loading, setLoading] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  // Email auth (cross-platform — primary path on Android)
  const [signupMode, setSignupMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  async function handleAppleLogin() {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        // user cancelled — stay silent
      } else if (err?.message === 'apple-unavailable') {
        Alert.alert(
          isTr ? 'Apple ile Giriş' : 'Apple Sign-In',
          isTr
            ? 'Apple ile giriş şu anda kullanılamıyor; şimdilik e-posta ile giriş yapın.'
            : 'Apple sign-in is not available right now; use email for now.'
        );
      } else {
        Alert.alert(
          isTr ? 'Giriş Hatası' : 'Sign-In Error',
          isTr
            ? 'Apple ile giriş yapılamadı. Lütfen tekrar deneyin.'
            : 'Could not sign in with Apple. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailAuth() {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || (signupMode && !name.trim())) {
      Alert.alert(
        isTr ? 'Eksik Bilgi' : 'Missing Info',
        isTr
          ? 'Lütfen tüm alanları doldurun.'
          : 'Please fill in all fields.'
      );
      return;
    }
    if (password.length < 6) {
      Alert.alert(
        isTr ? 'Zayıf Şifre' : 'Weak Password',
        isTr
          ? 'Şifre en az 6 karakter olmalıdır.'
          : 'Password must be at least 6 characters.'
      );
      return;
    }
    setEmailLoading(true);
    try {
      await signInWithEmail(cleanEmail, password, signupMode ? name : undefined);
    } catch (err) {
      const code = err?.message;

      // Account created but e-mail not yet confirmed — friendly, not an error.
      if (code === 'confirm-email') {
        Alert.alert(
          isTr ? 'E-postanı doğrula' : 'Check your email',
          isTr
            ? 'Hesabını onaylamak için e-postandaki doğrulama bağlantısına tıkla, sonra giriş yap.'
            : 'Check your email to confirm your account, then sign in.'
        );
        return;
      }

      let msg;
      switch (code) {
        case 'wrong-password':
          msg = isTr
            ? 'E-posta veya şifre hatalı.'
            : 'Incorrect email or password.';
          break;
        case 'email-exists':
          msg = isTr
            ? 'Bu e-posta zaten kayıtlı. Lütfen giriş yapın.'
            : 'This email is already registered. Please sign in.';
          break;
        case 'invalid-email':
          msg = isTr
            ? 'Geçerli bir e-posta adresi girin.'
            : 'Please enter a valid email address.';
          break;
        case 'weak-password':
          msg = isTr
            ? 'Şifre en az 6 karakter olmalıdır.'
            : 'Password must be at least 6 characters.';
          break;
        case 'network-error':
          msg = isTr
            ? 'Bağlantı hatası. İnternetini kontrol edip tekrar dene.'
            : 'Connection error. Check your internet and try again.';
          break;
        case 'auth-unavailable':
          msg = isTr
            ? 'Giriş şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
            : 'Sign-in is unavailable right now. Please try again later.';
          break;
        default:
          msg = isTr
            ? 'Giriş yapılamadı. Tekrar deneyin.'
            : 'Could not sign in. Please try again.';
      }
      Alert.alert(isTr ? 'Giriş Hatası' : 'Sign-In Error', msg);
    } finally {
      setEmailLoading(false);
    }
  }

  const LegalModal = ({ visible, onClose, title, content }) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RNSafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.modalClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Kapat' : 'Close'}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalBody}>{content}</Text>
        </ScrollView>
      </RNSafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LegalModal
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
        title={isTr ? '🔒 Gizlilik Politikası' : '🔒 Privacy Policy'}
        content={isTr ? PRIVACY_TEXT.tr : PRIVACY_TEXT.en}
      />
      <LegalModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
        title={isTr ? '📄 Kullanım Koşulları' : '📄 Terms of Use'}
        content={isTr ? TERMS_TEXT.tr : TERMS_TEXT.en}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

        {/* Logo */}
        <View style={styles.logoSection}>
          <GradientHero
            borderRadius={radii.full}
            padding={0}
            shadowed
            style={styles.logoCircle}
            contentStyle={styles.logoCircleContent}
          >
            <Text style={styles.logoEmoji}>💪</Text>
          </GradientHero>
          <Text style={styles.appName}>GLP-1 Coach</Text>
          <Text style={styles.tagline}>
            {isTr
              ? 'Kas kütleni koru, proteini takip et'
              : 'Protect your muscle, track your protein'}
          </Text>
        </View>

        {/* Medical disclaimer */}
        <View style={styles.healthDisclaimer}>
          <Text style={styles.healthDisclaimerText}>
            {isTr
              ? 'ℹ️ Bu uygulama yaşam tarzı desteği sağlar. Tıbbi tavsiye değildir. Sağlık kararları için doktorunuza danışın.'
              : 'ℹ️ This app provides lifestyle support only, not medical advice. Consult your doctor for health decisions.'}
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          {[
            { icon: '🥩', tr: 'Kişisel protein takibi', en: 'Personalized protein tracking' },
            { icon: '📊', tr: 'Haftalık ilerleme raporları', en: 'Weekly progress reports' },
            { icon: '🤖', tr: 'Yapay zeka koç', en: 'AI-powered coach' },
            { icon: '📷', tr: 'Fotoğrafla öğün analizi', en: 'Meal analysis by photo' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={styles.featureText}>{isTr ? f.tr : f.en}</Text>
            </View>
          ))}
        </View>

        {/* Apple Sign-In (iOS only) */}
        {Platform.OS === 'ios' && (
          <>
            <TouchableOpacity
              style={[styles.appleBtn, loading && styles.btnDisabled]}
              onPress={handleAppleLogin}
              disabled={loading}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
              accessibilityLabel={isTr ? 'Apple ile Devam Et' : 'Continue with Apple'}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.appleBtnIcon}></Text>
                  <Text style={styles.appleBtnText}>
                    {isTr ? 'Apple ile Devam Et' : 'Continue with Apple'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{isTr ? 'veya' : 'or'}</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}

        {/* Email Sign-In / Sign-Up (cross-platform) */}
        <View style={styles.emailForm}>
          {signupMode && (
            <TextInput
              style={styles.input}
              placeholder={isTr ? 'Ad Soyad' : 'Full Name'}
              placeholderTextColor={colors.outline}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel={isTr ? 'Ad Soyad' : 'Full Name'}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder={isTr ? 'E-posta' : 'Email'}
            placeholderTextColor={colors.outline}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={isTr ? 'E-posta' : 'Email'}
          />
          <TextInput
            style={styles.input}
            placeholder={isTr ? 'Şifre' : 'Password'}
            placeholderTextColor={colors.outline}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleEmailAuth}
            accessibilityLabel={isTr ? 'Şifre' : 'Password'}
          />
          <TouchableOpacity
            style={[styles.emailBtn, emailLoading && styles.btnDisabled]}
            onPress={handleEmailAuth}
            disabled={emailLoading}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityState={{ disabled: emailLoading, busy: emailLoading }}
            accessibilityLabel={
              signupMode
                ? isTr ? 'Hesap Oluştur' : 'Create Account'
                : isTr ? 'Giriş Yap' : 'Sign In'
            }
          >
            {emailLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.emailBtnText}>
                {signupMode
                  ? isTr ? 'Hesap Oluştur' : 'Create Account'
                  : isTr ? 'Giriş Yap' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSignupMode((m) => !m)}
            activeOpacity={0.7}
            style={styles.switchModeBtn}
            accessibilityRole="button"
            accessibilityLabel={
              signupMode
                ? isTr ? 'Zaten hesabın var mı? Giriş yap' : 'Already have an account? Sign in'
                : isTr ? 'Hesabın yok mu? Kayıt ol' : "Don't have an account? Sign up"
            }
          >
            <Text style={styles.switchModeText}>
              {signupMode
                ? isTr ? 'Zaten hesabın var mı? Giriş yap' : 'Already have an account? Sign in'
                : isTr ? 'Hesabın yok mu? Kayıt ol' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Disclaimer with tappable links */}
        <View style={styles.disclaimerRow}>
          <Text style={styles.disclaimer}>
            {isTr ? 'Devam ederek ' : 'By continuing, you agree to our '}
          </Text>
          <TouchableOpacity
            onPress={() => setTermsVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Kullanım Koşulları' : 'Terms of Use'}
          >
            <Text style={styles.disclaimerLink}>
              {isTr ? 'Kullanım Koşulları' : 'Terms of Use'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            {isTr ? ' ve ' : ' and '}
          </Text>
          <TouchableOpacity
            onPress={() => setPrivacyVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Gizlilik Politikası' : 'Privacy Policy'}
          >
            <Text style={styles.disclaimerLink}>
              {isTr ? 'Gizlilik Politikası' : 'Privacy Policy'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            {isTr ? 'nı kabul etmiş olursunuz.' : '.'}
          </Text>
        </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.stackMd,
    gap: spacing.stackSm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  dividerText: {
    ...typography.labelSm,
    color: colors.outline,
  },

  emailForm: { gap: spacing.stackSm, marginBottom: spacing.stackMd },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.gutter,
    paddingVertical: 14,
    ...typography.bodyMd,
    fontFamily: fontFamily.body,
    color: colors.onSurface,
  },
  emailBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.stackSm,
    ...shadow('sm'),
  },
  emailBtnText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBold,
    fontSize: 17,
    fontWeight: '700',
  },
  switchModeBtn: { alignItems: 'center', paddingVertical: spacing.stackSm },
  switchModeText: {
    ...typography.labelMd,
    color: colors.primary,
    fontFamily: fontFamily.bodySemiBold,
  },

  logoSection: { alignItems: 'center', marginBottom: spacing.xl },
  logoCircle: {
    width: 88, height: 88,
    marginBottom: spacing.stackMd,
  },
  logoCircleContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 40 },
  appName: {
    ...typography.headlineLg,
    color: colors.onSurface,
  },
  tagline: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.stackSm,
    textAlign: 'center',
  },

  featuresCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.cardPadding,
    marginBottom: spacing.xl,
    gap: spacing.stackMd,
    ...shadow('md'),
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd },
  featureIconWrap: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center', justifyContent: 'center',
  },
  featureIcon: { fontSize: 20, textAlign: 'center' },
  featureText: {
    ...typography.bodyMd,
    fontFamily: fontFamily.bodyMedium,
    fontWeight: '500',
    color: colors.onSurface,
    flex: 1,
  },

  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.black, borderRadius: radii.md, paddingVertical: 16, gap: spacing.stackSm,
    marginBottom: spacing.stackMd,
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  btnDisabled: { opacity: 0.6 },
  appleBtnIcon: { fontSize: 20, color: colors.white },
  appleBtnText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBold,
    fontSize: 17,
    fontWeight: '700',
  },

  healthDisclaimer: {
    backgroundColor: colors.warningBg, borderRadius: radii.md, padding: spacing.gutter,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.warning + '33',
  },
  healthDisclaimerText: {
    ...typography.labelSm,
    fontFamily: fontFamily.bodyMedium,
    color: colors.warning,
    lineHeight: 17,
    textAlign: 'center',
  },

  disclaimerRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center',
  },
  disclaimer: {
    ...typography.labelSm,
    color: colors.outline,
    lineHeight: 18,
  },
  disclaimerLink: {
    ...typography.labelSm,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: colors.primary,
    lineHeight: 18,
    textDecorationLine: 'underline',
  },

  modalSafe: { flex: 1, backgroundColor: colors.surface },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.containerMargin, paddingVertical: spacing.gutter,
    borderBottomWidth: 1, borderBottomColor: colors.outlineVariant,
  },
  modalTitle: {
    ...typography.headlineMd,
    fontSize: 18,
    color: colors.onSurface,
  },
  modalClose: {
    width: 32, height: 32, borderRadius: radii.full,
    backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
  },
  modalCloseText: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  modalContent: { padding: spacing.containerMargin, paddingBottom: spacing.xl + spacing.stackSm },
  modalBody: {
    ...typography.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
  },
});
