import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { colors, fontFamily, shadow } from '../theme';

const { width } = Dimensions.get('window');

const STEPS_EN = [
  {
    emoji: '⚖️',
    title: 'Log Your Weight',
    desc: 'Tap the "Log Weight" button on the dashboard to record your weight. We\'ll track your progress and calculate your daily loss rate.',
    color: colors.primary,
  },
  {
    emoji: '📸',
    title: 'Analyze Your Meals',
    desc: 'Go to the Meal tab and take a photo of your food. Our AI will instantly calculate protein, calories, and give you personalized tips.',
    color: '#059669',
  },
  {
    emoji: '💪',
    title: 'Hit Your Protein Goal',
    desc: 'Your daily protein target is calculated from your weight. Track it here — green means you\'re protecting your muscle mass!',
    color: '#D97706',
  },
  {
    emoji: '📊',
    title: 'Weekly Report',
    desc: 'Check your Weekly Report tab every Sunday to see your progress, body composition breakdown, and personalized coaching insights.',
    color: '#7C3AED',
  },
];

const STEPS_TR = [
  {
    emoji: '⚖️',
    title: 'Kilonu Gir',
    desc: 'Dashboard\'daki "Kilo Gir" butonuna tıkla. Günlük kilo kaybın hesaplanacak ve ilerleme grafiğin güncellenecek.',
    color: colors.primary,
  },
  {
    emoji: '📸',
    title: 'Yemeğini Analiz Et',
    desc: 'Öğün sekmesine git ve yemeğinin fotoğrafını çek. Yapay zeka saniyeler içinde protein, kalori hesaplar ve öneride bulunur.',
    color: '#059669',
  },
  {
    emoji: '💪',
    title: 'Protein Hedefine Ulaş',
    desc: 'Günlük protein hedefin kilondan hesaplanıyor. Bunu burada takip et — yeşil görmek kas kütleni koruduğun anlamına gelir!',
    color: '#D97706',
  },
  {
    emoji: '📊',
    title: 'Haftalık Rapor',
    desc: 'Haftalık Rapor sekmesini her hafta kontrol et. İlerleme, protein hedeflerin ve kişisel fitness önerileri seni bekliyor.',
    color: '#7C3AED',
  },
];

export default function FeatureTour({ visible, onFinish, language }) {
  const [step, setStep] = useState(0);
  const isTr = language === 'tr';
  const steps = isTr ? STEPS_TR : STEPS_EN;
  const current = steps[step];

  function handleNext() {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      onFinish();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Step dots */}
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && { backgroundColor: current.color, width: 20 }]}
              />
            ))}
          </View>

          {/* Content */}
          <View style={[styles.emojiCircle, { backgroundColor: current.color + '20' }]}>
            <Text style={styles.emoji}>{current.emoji}</Text>
          </View>

          <Text style={styles.stepLabel}>
            {isTr ? `${step + 1} / ${steps.length}` : `${step + 1} of ${steps.length}`}
          </Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.desc}>{current.desc}</Text>

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: current.color }]}
            onPress={handleNext}
            activeOpacity={0.88}
          >
            <Text style={styles.nextBtnText}>
              {step < steps.length - 1
                ? (isTr ? 'İleri →' : 'Next →')
                : (isTr ? 'Başlayalım! 🚀' : "Let's go! 🚀")}
            </Text>
          </TouchableOpacity>

          {step < steps.length - 1 && (
            <TouchableOpacity onPress={onFinish} style={styles.skipBtn}>
              <Text style={styles.skipText}>{isTr ? 'Geç' : 'Skip'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    width: width - 48,
    alignItems: 'center',
    ...shadow('lg'),
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.outlineVariant,
  },
  emojiCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emoji: { fontSize: 36 },
  stepLabel: { fontSize: 12, fontFamily: fontFamily.bodySemiBold, color: colors.outline, fontWeight: '600', marginBottom: 8 },
  title: {
    fontSize: 22, fontWeight: '800', fontFamily: fontFamily.headingBold, color: colors.onSurface,
    textAlign: 'center', marginBottom: 12,
  },
  desc: {
    fontSize: 15, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, textAlign: 'center',
    lineHeight: 22, marginBottom: 28,
  },
  nextBtn: {
    width: '100%', borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 12,
  },
  nextBtnText: { color: colors.white, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bodySemiBold },
  skipBtn: { padding: 8 },
  skipText: { color: colors.outline, fontSize: 14, fontWeight: '500', fontFamily: fontFamily.bodyMedium },
});
