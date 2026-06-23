# Privacy Policy — GLP-1 Coach

_Last updated: 2026-06-23_

GLP-1 Coach ("the app", "we") helps people on GLP-1 medications (Ozempic, Wegovy,
Mounjaro and similar) track weight, nutrition, muscle protection, medication doses
and related health information. This policy explains what data we collect, how it is
used, where it is stored, and your rights. **A Turkish translation follows the
English text.**

## 1. Who is the data controller
The app developer (contact: see Support, below) is the data controller. Our backend
is hosted on Supabase (PostgreSQL, EU region). AI features are processed via OpenAI
through a server-side proxy (see §4).

## 2. What we collect
You provide this data when you use the app:
- **Account:** email address and password (password is handled by Supabase Auth and
  stored only as a secure hash; we never see your plaintext password).
- **Health & fitness data:** weight, height, goal weight, protein targets, meal logs
  (protein, calories, food description, optional meal photos), medication profile
  (drug, dose, frequency, injection schedule, reminders), dose logs, body
  measurements (waist, arm, neck, chest, hip), and symptom logs.
- **Apple Health / Apple Watch (iOS, optional):** if you grant permission, we read
  weight, body composition, active energy and heart rate to show progress and
  calories burned, and we write the weight you log back to Apple Health to keep it in
  sync. HealthKit data is used only inside the app for your own tracking; it is never
  used for advertising and never shared with third parties.
- **Diagnostics (optional):** if enabled, crash and performance data via Sentry, used
  only to fix bugs. This is not linked to your health data.

We do **not** use any advertising or cross-app tracking SDKs. The app does not track
you across other apps or websites.

## 3. How your data is stored and protected
- Your data is stored in our Supabase cloud database (not only on your device).
- **Row Level Security** is enforced on every table: you can only read and write your
  own rows. Community posts are publicly readable by design; everything else is
  private to your account.
- Connections use HTTPS/TLS. The app uses only standard encryption
  (ITSAppUsesNonExemptEncryption = false).

## 4. AI processing (OpenAI)
To analyze meal photos/descriptions, power the AI coach, and generate notifications
and diet suggestions, the relevant content is sent to OpenAI **through our server-side
proxy**. The OpenAI API key lives only on the server; it is never in the app. We send
only what is needed for the requested feature (e.g. the meal photo/text). We do not
send your identity beyond an authenticated request, and we do not log the content of
your AI requests. If AI is unavailable, the app falls back to local estimation.

## 5. Sharing
We do not sell your data. We share it only with the processors needed to run the app:
Supabase (hosting/database/auth), OpenAI (AI features, as above), and — if enabled —
Sentry (diagnostics).

## 6. Your rights (KVKK / GDPR)
- **Access & portability:** your data is yours; contact us for an export.
- **Deletion:** you can permanently delete your account and all associated health data
  from within the app (Settings → Delete Account). This removes your rows from every
  table on the server and deletes your authentication record. Deletion is immediate
  and irreversible.
- You may also withdraw Apple Health permission at any time in iOS Settings.

## 7. Children
The app is not intended for users under 18 and we do not knowingly collect data from
children.

## 8. Changes
We may update this policy; the "Last updated" date will change accordingly.

## 9. Support / contact
Support email: support@glp1coach.app

---

# Gizlilik Politikası — GLP-1 Coach (Türkçe)

GLP-1 Coach, GLP-1 ilaçları (Ozempic, Wegovy, Mounjaro vb.) kullanan kişilerin kilo,
beslenme, kas koruma, ilaç dozu ve ilgili sağlık bilgilerini takip etmesine yardımcı
olur. Bu politika hangi verileri topladığımızı, nasıl kullandığımızı, nerede
sakladığımızı ve haklarınızı açıklar.

- **Topladıklarımız:** e-posta + parola (parola yalnızca güvenli hash olarak,
  Supabase Auth ile); sağlık/fitness verileri (kilo, boy, hedef, protein hedefleri,
  öğün kayıtları + isteğe bağlı öğün fotoğrafları, ilaç profili/doz/enjeksiyon
  takvimi, doz kayıtları, vücut ölçümleri, semptom kayıtları); isteğe bağlı Apple
  Health/Apple Watch (kilo, vücut kompozisyonu, aktif enerji, nabız); isteğe bağlı
  tanılama (Sentry).
- **Reklam/çapraz uygulama takibi YOK.**
- **Saklama:** veriler Supabase bulut veritabanında (EU) tutulur; her tabloda
  satır-düzeyi güvenlik (RLS) ile yalnızca kendi verinize erişebilirsiniz; bağlantılar
  HTTPS/TLS.
- **Yapay zekâ:** öğün analizi/koç/bildirim için ilgili içerik sunucu tarafı proxy
  üzerinden OpenAI'ye gönderilir; OpenAI anahtarı yalnızca sunucudadır, istek içeriği
  loglanmaz.
- **Haklarınız (KVKK/GDPR):** verilerinize erişim/taşınabilirlik; **uygulama içinden
  hesabınızı ve tüm sağlık verilerinizi kalıcı silme** (Ayarlar → Hesabı Sil) — sunucudaki
  tüm satırlarınız + kimlik kaydınız silinir, geri alınamaz.
- **Çocuklar:** uygulama 18 yaş altı için değildir.
- **Destek:** support@glp1coach.app
