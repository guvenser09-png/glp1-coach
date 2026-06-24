# GLP-1 Coach — Şirkete Devir Paketi

Bu doküman, uygulamayı bir **şirket (tüzel kişilik) üzerinden** yayına alacak ekip için
hazırlandı. Uygulama bir **sağlık uygulamasıdır** (ilaç/doz/ölçüm/öğün verisi işler), bu
yüzden hesaplar, gizlilik metinleri ve App Store/Play onayları şirket adına kurulmalıdır.

Sıra önemli: önce **hesaplar**, sonra **backend**, sonra **uygulama config'i**, en son **yayın**.

---

## 1) Teslim edilenler (repoda hazır)

- **Kaynak kod:** GitHub `guvenser09-png/glp1-coach`, dal **`glp1-coach-revamp`** (güncel kod burada).
- **Backend şeması + güvenlik:** `supabase/migrations/` (tablolar + owner-only RLS + trigger'lar).
- **Sunucu fonksiyonları:** `supabase/functions/ai-proxy` (OpenAI proxy), `supabase/functions/delete-account` (KVKK/GDPR hesap silme).
- **Dokümanlar:** `HANDOFF.md` (teknik kurulum), `docs/PRIVACY.md`, `docs/TERMS.md`, `docs/STORE-SUBMISSION.md` (mağaza adımları + App Privacy etiketi + HealthKit notları).

> Not: Uygulamada OpenAI gizli anahtarı **yoktur**; yalnızca Supabase Edge Function secret'ında durur. Repo public olduğu sürece içinde sır yoktur.

---

## 2) Şirketin AÇMASI gereken hesaplar (kendi adına)

| Hesap | Ne için | Not (sağlık app) |
|---|---|---|
| **Apple Developer Program — Organization** | iOS yayını | **D-U-N-S numarası** + tüzel kişilik şart. HealthKit kullanımı için review gerekçesi gerekir. |
| **Google Play Console — Organization** (Android'e de çıkılacaksa) | Android yayını | "Health apps" beyanı + Data Safety formu. |
| **Expo (EAS) hesabı/organizasyonu** | Build/submit | Ücretsiz başlanabilir. |
| **Supabase organizasyonu** | Backend (DB+Auth+Fonksiyonlar) | Kendi projelerini kurmaları önerilir (aşağıda). |
| **OpenAI hesabı + ödeme** | AI özellikleri | Anahtar yalnızca Supabase secret'ına girilir. |
| **Sentry** (opsiyonel) | Çökme/hata izleme | DSN girilince aktif olur. |
| **Alan adı / e-posta** | Gizlilik & destek URL'leri | ör. privacy/terms sayfaları + support@sirket.com |

---

## 3) Backend'i şirket adına kurma (önerilen: kendi Supabase'leri)

En temiz devir — şirket kendi Supabase projesini kurar, böylece veri ve fatura tamamen onlarda olur:

1. Supabase'de yeni proje aç (tercihen AB/Türkiye'ye yakın bölge — sağlık verisi).
2. Şemayı uygula: `supabase/migrations/` içindeki SQL'leri sırayla çalıştır (Supabase SQL Editor veya `supabase db push`).
3. Fonksiyonları deploy et: `supabase/functions/ai-proxy` ve `supabase/functions/delete-account` (her ikisi de `verify_jwt = true`).
4. **Secret'ları gir** (Dashboard → Edge Functions → Secrets):
   - `OPENAI_API_KEY` = şirketin kendi OpenAI anahtarı
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase otomatik sağlar (genelde elle gerekmez)
5. Authentication ayarları: e-posta giriş açık; "Leaked password protection" aç; gerekiyorsa kurumsal SMTP bağla.

> Alternatif (kısa vade): mevcut backend paylaşılabilir, ama o zaman veri ve OpenAI faturası **ilk sahipte** kalır — kalıcı şirket devri için önerilmez.

---

## 4) Kodda şirket bilgileriyle değiştirilecek alanlar

`app.config.js`:
- `name`, `slug` (gerekiyorsa marka adı)
- `ios.bundleIdentifier` ve `android.package` → şirketin tercih ettiği kimlik (ör. `com.SIRKET.glp1coach`)
- `owner` → şirketin Expo organizasyonu
- `extra.eas.projectId` → şirketin EAS projesi (eas init ile gelir)
- `extra.supabaseUrl` / `extra.supabaseAnonKey` → şirketin Supabase projesi (veya `.env`)

`eas.json` → `submit.production.ios`:
- `appleId`, `appleTeamId`, `ascAppId` → şirketin Apple hesabı/uygulaması

`.env` (yerel) / EAS secrets:
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` → şirketin projesi

---

## 5) Mağaza varlıkları ve YASAL (sağlık app — kritik)

- **Gizlilik Politikası & Kullanım Şartları:** `docs/PRIVACY.md` ve `docs/TERMS.md` taslak olarak hazır. Şirket **veri sorumlusu (data controller)** olarak kendi **tüzel unvanını, adresini ve iletişimini** bunlara eklemeli; Türkiye için **KVKK / VERBİS** kaydı gerekebilir. Bu iki metni herkese açık bir URL'de yayınlayıp App Store/Play'e girmeli.
- **Destek URL'si / e-posta.**
- **App Privacy "nutrition label"** (App Store) ve **Data Safety** (Play): `docs/STORE-SUBMISSION.md`'deki tabloyu kullan.
- **HealthKit review gerekçesi + demo hesap:** `docs/STORE-SUBMISSION.md`'de hazır metin var.
- **Ekran görüntüleri, açıklama, anahtar kelimeler** (TR/EN).
- **Tıbbi sorumluluk:** uygulama "tıbbi tavsiye değildir" / "klinik ölçüm değildir" uyarılarını içeriyor ve doz **önermiyor** — bu davranış korunmalı (Apple 1.4.1). Şirket tıbbi iddia eklerse ek mevzuat sorumluluğu doğar.

---

## 6) Erişim ver (devir sırasında)

- **GitHub:** repo private yapılınca ilgili kişileri **Collaborator** ekle (Settings → Collaborators). Ya da kodu şirketin GitHub organizasyonuna **transfer/fork** et.
- **Supabase:** mevcut backend kısa süre paylaşılacaksa, ekip üyelerini **Owner/Administrator/Developer** rolüyle davet et (viewer yetmez).
- Hesaplar şirkete geçtikten sonra ilk sahibin erişimleri kaldırılabilir.

---

## 7) Önerilen sıra (özet)

1. Şirket hesaplarını aç (Apple Org, Expo, Supabase, OpenAI).
2. Backend'i şirketin Supabase'inde kur (migrations + functions + secrets).
3. `app.config.js` + `eas.json` + `.env`'i şirket bilgileriyle güncelle.
4. Gizlilik/Şartlar metinlerine şirket unvanını ekle, yayınla, URL'leri al.
5. `eas build -p ios --profile production` → `eas submit`.
6. App Store Connect: App Privacy + HealthKit notu + demo hesap + görseller → Submit.
7. (Android'e çıkılacaksa) Play Console: Data Safety + Health beyanı + AAB → internal test → yayın.

Detaylı teknik kurulum: `HANDOFF.md`. Mağaza adım adım: `docs/STORE-SUBMISSION.md`.
