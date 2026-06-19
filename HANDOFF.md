# GLP-1 Coach — Developer Handoff

GLP-1 (Ozempic / Wegovy / Mounjaro) **kas-koruma odaklı kilo yönetimi** uygulaması.
Expo (SDK 54) + React Native 0.81 + React Navigation. iOS + Android.

## Kurulum (Setup)

```bash
npm install
cp .env.example .env        # OpenAI anahtarını .env içine yaz (AI özellikleri için)
npx expo start              # Expo Go ile geliştirme (native modüller sınırlı)
```

> AI özellikleri (fotoğraftan öğün analizi, akıllı koç, AI diyet/bildirim) için `.env` içine
> `OPENAI_API_KEY=sk-...` gerekir. Anahtar yoksa uygulama **offline fallback** ile çalışır
> (manuel öğün girişi yerel besin veritabanından tahmin eder; koç yerel yanıt verir).

## Native / build

- Proje **CNG** kullanır: `ios/` ve `android/` klasörleri yoktur; `app.config.js`'teki
  config plugin'lerinden üretilir.
- HealthKit (Apple Watch: kalori/nabız/kilo) ve bildirimler **Expo Go'da çalışmaz** —
  dev build / EAS build gerekir. iOS'ta çökmemeleri için defansif yazıldılar.

```bash
npx expo prebuild              # native projeleri üret (Xcode/Android Studio gerekir)
npx expo run:ios               # yerel iOS build (Xcode şart)
eas build -p ios --profile preview   # bulut build (QR ile kurulum)
```

## Mimari

- **Backend YOK (şimdilik):** tüm veri cihazda yerel (AsyncStorage). Auth mock/local.
  - Sosyal akış (`socialService.js`) ve diğer servisler tek noktadan değiştirilebilir —
    gerçek backend (Supabase/Firebase) buraya takılabilir.
- `src/theme/` — tasarım sistemi (Google Stitch'ten): renkler, tipografi (Plus Jakarta Sans + Inter), spacing, shadow.
- `src/components/ui/` — paylaşılan bileşenler (Card, GradientHero, Button, Chip, Ring, ProgressBar, ListRow, StatCard, Badge…).
- `src/screens/` — Dashboard (ana), MealAnalysis ("Günlük": öğün + kas sağlığı + haftalık rapor), Social, DietPlans, Settings, Weight, Rewards, Medication, HealthLog, Onboarding, auth/Login.
- `src/services/` — openai, coachChat, medication, healthkit, notification, export, social, firestore(local), auth.
- `src/context/` — Auth, Language (TR/EN), Subscription (paywall dormant), Unit (kg/lb), Gamification.

## Önemli notlar / bilinen eksikler

- **Paywall kaldırıldı** ama RevenueCat altyapısı dormant (geri açılabilir).
- OpenAI anahtarı şu an client-side — **yayında backend proxy'ye taşınmalı**.
- Bilingual TR/EN. Bundle id: `com.glp1coach.app`.
- `npx expo export` ile temiz derleniyor; cihazda/EAS build ile gerçek test gerekli.
