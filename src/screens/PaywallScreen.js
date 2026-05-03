import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';

const FEATURE_ICONS = {
  meal_analysis: '📷',
  weekly_report: '📊',
  diet_plans: '🥗',
  coach_message: '🤖',
};

const FEATURE_NAMES = {
  meal_analysis: { en: 'Meal Analysis', tr: 'Öğün Analizi' },
  weekly_report: { en: 'Weekly Report', tr: 'Haftalık Rapor' },
  diet_plans: { en: 'Diet Plans', tr: 'Diyet Planları' },
  coach_message: { en: 'AI Coach', tr: 'Yapay Zeka Koç' },
};

const MONTHLY_FEATURES = [
  { en: 'Unlimited meal analysis', tr: 'Sınırsız öğün analizi' },
  { en: 'Weekly progress reports', tr: 'Haftalık ilerleme raporları' },
  { en: 'AI coach messages', tr: 'Yapay zeka koç mesajları' },
  { en: 'Personalized diet plans', tr: 'Kişisel diyet planları' },
];

const ANNUAL_FEATURES = [
  { en: 'Everything in Monthly', tr: 'Aylık plandaki her şey' },
  { en: 'Priority support', tr: 'Öncelikli destek' },
  { en: 'Save 50% vs monthly', tr: 'Aylığa göre %50 tasarruf' },
];

export default function PaywallScreen({ navigation, route }) {
  const { featureName, featureKey } = route?.params || {};
  const { startTrial, subscribe } = useSubscription();
  const { t, language } = useLanguage();
  const isTr = language === 'tr';

  const [selectedPlan, setSelectedPlan] = useState('annual');
  const [loading, setLoading] = useState(false);

  const featureIcon = FEATURE_ICONS[featureKey] || '🔒';
  const displayName =
    featureName ||
    (FEATURE_NAMES[featureKey]?.[isTr ? 'tr' : 'en']) ||
    (isTr ? 'Premium Özellik' : 'Premium Feature');

  async function handleStartTrial() {
    setLoading(true);
    try {
      await startTrial();
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe() {
    setLoading(true);
    try {
      await subscribe(selectedPlan);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.featureIcon}>{featureIcon}</Text>
          <Text style={styles.unlockTitle}>
            {isTr ? `${displayName} Kilidini Aç` : `Unlock ${displayName}`}
          </Text>
          <Text style={styles.unlockSubtitle}>
            {isTr
              ? 'Premium planla tüm özelliklere erişin'
              : 'Get access to all features with a premium plan'}
          </Text>
        </View>

        {/* Plan Cards */}
        <View style={styles.plansContainer}>
          {/* Monthly Plan */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.85}
          >
            <View style={styles.planCardTop}>
              <View>
                <Text style={styles.planName}>{t('monthly')}</Text>
                <Text style={styles.planPrice}>$9.99</Text>
                <Text style={styles.planPeriod}>{isTr ? 'aylık' : 'per month'}</Text>
              </View>
              <View style={[styles.radioCircle, selectedPlan === 'monthly' && styles.radioCircleSelected]}>
                {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
              </View>
            </View>
            <View style={styles.planFeaturesList}>
              {MONTHLY_FEATURES.map((f, i) => (
                <View key={i} style={styles.featureItem}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureItemText}>{isTr ? f.tr : f.en}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          {/* Annual Plan */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('annual')}
            activeOpacity={0.85}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>{isTr ? 'EN İYİ DEĞER' : 'BEST VALUE'}</Text>
            </View>
            <View style={styles.planCardTop}>
              <View>
                <Text style={styles.planName}>{t('annual')}</Text>
                <Text style={styles.planPrice}>$59.99</Text>
                <Text style={styles.planPeriod}>{isTr ? 'yıllık' : 'per year'}</Text>
                <View style={styles.savingsTag}>
                  <Text style={styles.savingsText}>{isTr ? '%50 tasarruf' : 'Save 50%'}</Text>
                </View>
              </View>
              <View style={[styles.radioCircle, selectedPlan === 'annual' && styles.radioCircleSelected]}>
                {selectedPlan === 'annual' && <View style={styles.radioInner} />}
              </View>
            </View>
            <View style={styles.planFeaturesList}>
              {ANNUAL_FEATURES.map((f, i) => (
                <View key={i} style={styles.featureItem}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureItemText}>{isTr ? f.tr : f.en}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </View>

        {/* Subscribe button */}
        <TouchableOpacity
          style={[styles.subscribeBtn, loading && styles.subscribeBtnDisabled]}
          onPress={handleSubscribe}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.subscribeBtnText}>
              {selectedPlan === 'monthly'
                ? isTr ? 'Aylık Planı Başlat' : 'Start Monthly Plan'
                : isTr ? 'Yıllık Planı Başlat' : 'Start Annual Plan'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Free Trial */}
        <TouchableOpacity
          style={[styles.trialBtn, loading && styles.subscribeBtnDisabled]}
          onPress={handleStartTrial}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.trialBtnText}>{t('startFreeTrial')}</Text>
        </TouchableOpacity>

        {/* Maybe later */}
        <TouchableOpacity
          style={styles.laterBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.laterBtnText}>{t('maybeLater')}</Text>
        </TouchableOpacity>

        {/* Fine print */}
        <Text style={styles.finePrint}>{t('cancelAnytime')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 24, paddingBottom: 40 },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  closeBtnText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },

  header: { alignItems: 'center', marginBottom: 32 },
  featureIcon: { fontSize: 52, marginBottom: 16 },
  unlockTitle: { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 },
  unlockSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  plansContainer: { gap: 16, marginBottom: 24 },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: { borderColor: '#4F46E5' },
  planCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  planPrice: { fontSize: 28, fontWeight: '800', color: '#111827' },
  planPeriod: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  savingsTag: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  savingsText: { fontSize: 12, color: '#059669', fontWeight: '700' },
  bestValueBadge: {
    position: 'absolute',
    top: 12,
    right: 0,
    backgroundColor: '#10B981',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bestValueText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  radioCircleSelected: { borderColor: '#4F46E5' },
  radioInner: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#4F46E5' },
  planFeaturesList: { gap: 8 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCheck: { fontSize: 13, color: '#10B981', fontWeight: '700' },
  featureItemText: { fontSize: 14, color: '#374151', flex: 1 },

  subscribeBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  subscribeBtnDisabled: { opacity: 0.6 },
  subscribeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  trialBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4F46E5',
    marginBottom: 12,
  },
  trialBtnText: { color: '#4F46E5', fontSize: 15, fontWeight: '700' },

  laterBtn: { alignItems: 'center', padding: 12 },
  laterBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },

  finePrint: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 8 },
});
