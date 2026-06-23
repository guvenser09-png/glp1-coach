# GLP-1 Coach — Developer Handoff

GLP-1 (Ozempic / Wegovy / Mounjaro) **kas-koruma odaklı kilo yönetimi** uygulaması.
Expo (SDK 54) + React Native 0.81 + React Navigation. iOS + Android.

## Kurulum (Setup)

```bash
npm install
cp .env.example .env        # EXPO_PUBLIC_SUPABASE_URL + ANON_KEY değerlerini gir
npx expo start              # Expo Go ile geliştirme (native modüller sınırlı)
```

> **Backend = Supabase** (Auth + Postgres + Edge Functions). `.env` içine Supabase
> proje URL'si ve **publishable (anon)** anahtarı yazılır (bunlar istemcide güvenli/halka açıktır).
> Şema + RLS politikaları repoda: `supabase/migrations/`.
>
> **AI** (fotoğraftan öğün analizi, koç, bildirim, diyet) Supabase Edge Function
> `ai-proxy` üzerinden çalışır; **OpenAI anahtarı yalnızca sunucuda** (Supabase
> Edge Function secret: `OPENAI_API_KEY`). İstemcide OpenAI anahtarı YOKTUR. AI
> ulaşılamazsa uygulama offline fallback'e düşer (yerel besin tahmini / yerel koç).

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

## Backend (Supabase)

- **Tek backend = Supabase.** İstemci yalnızca `supabase-js` ile konuşur (`src/services/supabaseClient.ts`).
- **Şema + RLS** repoda versiyonlu: `supabase/migrations/`. Her tabloda owner-only
  Row Level Security (`auth.uid() = user_id`); sosyal akış için ayrı public-read politikası.
  Uygulama: `supabase db push` veya dashboard SQL editor.
- **AI proxy:** `supabase/functions/ai-proxy` — kullanıcının JWT'sini doğrular, OpenAI
  anahtarını sunucuda tutar. İstemci `supabase.functions.invoke('ai-proxy')` çağırır
  (`src/services/aiClient.ts`). AI'nın açık olup olmadığını `isAIConfigured()` söyler.
- **Hesap silme:** `supabase/functions/delete-account` — kullanıcının tüm owner
  satırlarını + auth kaydını sunucu tarafında siler (KVKK/GDPR silme hakkı).

## Mimari

- `src/theme/` — tasarım sistemi: renkler (light/dark), tipografi (Plus Jakarta Sans + Inter), spacing, shadow; `useTheme`/`useThemeColors`.
- `src/components/ui/` — paylaşılan bileşenler (Card, GradientHero, Button, Chip, Ring, ProgressBar, ListRow, StatCard, Badge…).
- `src/screens/` — Dashboard (ana), MealAnalysis ("Günlük": öğün + kas sağlığı + haftalık rapor), Social, DietPlans, Settings, Weight, Rewards, Medication, HealthLog, Onboarding, auth/Login.
- `src/services/` — supabaseClient, aiClient (proxy), openai (offline fallback + foto), coachChat, medication, healthkit, notification, export, social, firestore (Supabase-backed; veri katmanı), sentry.
- `src/context/` — Auth (Supabase Auth), Language (TR/EN), Subscription (paywall dormant), Unit (kg/lb), Gamification.

## Önemli notlar

- **Paywall kaldırıldı**; RevenueCat altyapısı dormant (geri açılabilir).
- Bilingual TR/EN. Bundle id: `com.glp1coach.app`.
- `npx expo export` ile temiz derleniyor; cihazda/EAS build ile gerçek test gerekli.
- Sırlar: hiçbir gizli anahtar repoda/git geçmişinde olmamalı. Supabase anon key
  istemcide güvenlidir; `service_role` ve `OPENAI_API_KEY` yalnızca sunucuda.
