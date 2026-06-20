import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import { fontFamily, useTheme } from '../theme';

export default function AIConsentModal({ visible, onAccept, onDecline, language }) {
  const isTr = language === 'tr';
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            {isTr ? '🤖 Yapay Zeka Veri Paylaşımı' : '🤖 AI Data Sharing'}
          </Text>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
              {isTr
                ? 'Bu özelliği kullanmak için verileriniz (sağlık ve öğün bilgileriniz dahil) cihazınızdan internet üzerinden harici bir yapay zeka sunucusuna (OpenAI) gönderilir ve orada analiz edilir. Onaylamadan önce lütfen aşağıdakileri okuyun:'
                : 'To use this feature, your data (including health and meal information) is sent from your device over the internet to an external AI server (OpenAI), where it is processed and analyzed. Please review the details below before you consent:'}
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isTr ? '📤 Gönderilen Veriler' : '📤 Data Sent'}
              </Text>
              <Text style={styles.sectionBody}>
                {isTr
                  ? '• Yemek fotoğrafları veya metin açıklamaları\n• Günlük protein ve kalori bilgileri\n• Koç sohbetindeki mesajlarınız'
                  : '• Meal photos or text descriptions\n• Daily protein and calorie data\n• Messages you send to the AI coach'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isTr ? '🏢 Kimle Paylaşılıyor' : '🏢 Who Receives It'}
              </Text>
              <Text style={styles.sectionBody}>
                {isTr
                  ? 'OpenAI, L.L.C. — Yapay zeka analizi için. Verileriniz model eğitiminde kullanılmaz.'
                  : 'OpenAI, L.L.C. — For AI analysis only. Your data is not used for model training.'}
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://openai.com/policies/privacy-policy')}
                accessibilityRole="link"
                accessibilityLabel={isTr ? 'OpenAI Gizlilik Politikasını aç' : 'Open OpenAI Privacy Policy'}
                accessibilityHint={isTr ? 'Tarayıcıda açılır' : 'Opens in your browser'}
              >
                <Text style={styles.link}>
                  {isTr ? 'OpenAI Gizlilik Politikası →' : 'OpenAI Privacy Policy →'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isTr ? '🔒 Saklanmıyor' : '🔒 Not Stored'}
              </Text>
              <Text style={styles.sectionBody}>
                {isTr
                  ? 'Fotoğraflarınız OpenAI\'ya gönderilir ve analiz tamamlandıktan sonra silinir. GLP-1 Coach sunucularında saklanmaz.'
                  : 'Your photos are sent to OpenAI and deleted after analysis is complete. They are not stored on GLP-1 Coach servers.'}
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => {
              // TODO(haptics): add light impact feedback here once a haptics util exists (expo-haptics not installed)
              onAccept();
            }}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Anladım, devam et' : 'I understand, continue'}
            accessibilityHint={isTr ? 'Verilerin yapay zeka sunucusuna gönderilmesini onaylar' : 'Consents to sending your data to the AI server'}
          >
            <Text style={styles.acceptText}>
              {isTr ? 'Anladım, Devam Et' : 'I Understand, Continue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.declineBtn}
            onPress={onDecline}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'İptal' : 'Cancel'}
          >
            <Text style={styles.declineText}>
              {isTr ? 'İptal' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  title: { fontSize: 20, fontWeight: '800', fontFamily: fontFamily.headingBold, color: colors.onSurface, marginBottom: 16, textAlign: 'center' },
  body: { maxHeight: 340, marginBottom: 16 },
  intro: { fontSize: 14, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 20, marginBottom: 16 },
  section: {
    backgroundColor: colors.surfaceVariant, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.outlineVariant,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', fontFamily: fontFamily.headingSemiBold, color: colors.onSurface, marginBottom: 6 },
  sectionBody: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 20 },
  link: { fontSize: 13, fontFamily: fontFamily.bodySemiBold, color: colors.primary, fontWeight: '600', marginTop: 6 },
  acceptBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  acceptText: { color: colors.white, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bodySemiBold },
  declineBtn: { alignItems: 'center', padding: 10 },
  declineText: { color: colors.outline, fontSize: 15, fontWeight: '500', fontFamily: fontFamily.bodyMedium },
  });
