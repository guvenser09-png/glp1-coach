import * as Notifications from 'expo-notifications';

const OPENAI_API_KEY = '***REMOVED***';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Fallback message banks ────────────────────────────────────────────────────

const MESSAGES_EN = [
  { title: "💪 Protein Time!", body: "Your muscles are waiting. Don't forget your protein today — every gram counts!" },
  { title: "🔥 Stay on Track!", body: "You've come this far. One consistent day builds the foundation for lasting change." },
  { title: "🧬 Protect Your Gains", body: "Fat loss without muscle loss is the goal. Log your meals today and stay ahead." },
  { title: "⚡ Morning Fuel", body: "Start strong! A protein-rich breakfast sets the tone for the whole day." },
  { title: "🏆 Champions Log", body: "The best athletes track what they eat. Log today's meals and own your progress." },
  { title: "🎯 Daily Mission", body: "Hit your protein target today. Your future self will thank you." },
  { title: "🤖 Ask Your Coach", body: "Your AI coach is ready. Ask: 'What should I eat today?' — open the app for a quick answer." },
  { title: "🌟 You're Doing Great", body: "Every healthy choice you make today is an investment in a stronger tomorrow." },
  { title: "🥩 Protein Reminder", body: "Halfway through the day? Check your protein intake and top it up if needed!" },
  { title: "🔬 Body Science", body: "Studies show protein at every meal reduces muscle loss by up to 40%. Make it count!" },
  { title: "💡 Smart Move", body: "High protein + movement = muscle preservation. You know what to do today!" },
  { title: "🎉 Keep the Momentum", body: "Consistency beats perfection. One more good day — you've got this!" },
  { title: "🚀 Level Up", body: "Small actions compound. A yogurt here, an egg there — your muscles notice!" },
  { title: "🤖 Coach Check-in", body: "Your GLP-1 coach wants to know how you're doing. Tap to chat." },
];

const MESSAGES_TR = [
  { title: "💪 Protein Zamanı!", body: "Kasların seni bekliyor. Bugün proteini unutma — her gram önemli!" },
  { title: "🔥 Yolda Kal!", body: "Bu kadar geldik. Tutarlı bir gün, kalıcı değişimin temelini atar." },
  { title: "🧬 Kaslarını Koru", body: "Hedef yağ kaybetmek, kas kaybetmemek. Bugün öğünlerini kaydet ve öne geç." },
  { title: "⚡ Sabah Yakıtı", body: "Güçlü başla! Proteinli bir kahvaltı tüm günü belirler." },
  { title: "🏆 Şampiyonlar Takip Eder", body: "En iyi sporcular yediklerini takip eder. Bugünkü öğünleri kaydet!" },
  { title: "🎯 Günlük Görev", body: "Bugün protein hedefini yakala. Gelecekteki sen sana teşekkür edecek." },
  { title: "🤖 Koçuna Sor", body: "AI koçun hazır. 'Bugün ne yemeli?' diye sor — uygulama açıkken saniyeler içinde yanıt al." },
  { title: "🌟 Harika Gidiyorsun", body: "Bugün yaptığın her sağlıklı seçim daha güçlü bir yarına yapılan yatırım." },
  { title: "🥩 Protein Hatırlatıcı", body: "Günün yarısı geçti mi? Protein alımını kontrol et ve eksikse tamamla!" },
  { title: "🔬 Vücut Bilimi", body: "Her öğündeki protein, kas kaybını %40'a kadar azaltır. Önemli kıl!" },
  { title: "💡 Akıllı Adım", body: "Yüksek protein + hareket = kas koruması. Bugün ne yapman gerektiğini biliyorsun!" },
  { title: "🎉 Momentumu Koru", body: "Tutarlılık mükemmelliği geçer. Bir gün daha iyi beslen — başarabilirsin!" },
  { title: "🚀 Seviye Atla", body: "Küçük eylemler birikir. Bir yoğurt, bir yumurta — kasların fark eder!" },
  { title: "🤖 Koç Hatırlatıcısı", body: "GLP-1 koçun bugün nasıl gittiğini merak ediyor. Sohbet etmek için aç." },
];

// ── Permissions ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Standard 14-day fallback schedule ────────────────────────────────────────

export async function scheduleDailyMotivation(language = 'en', hour = 9, minute = 0) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const messages = language === 'tr' ? MESSAGES_TR : MESSAGES_EN;

  for (let i = 0; i < 14; i++) {
    const msg = messages[i % messages.length];
    const trigger = new Date();
    trigger.setDate(trigger.getDate() + i);
    trigger.setHours(hour, minute, 0, 0);

    if (trigger > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: { title: msg.title, body: msg.body, sound: true },
        trigger,
      });
    }
  }

  return true;
}

// ── OpenAI personalized notification generator ───────────────────────────────

async function generateMotivationViaAI(userData, language) {
  const isTr = language === 'tr';
  const {
    currentWeight,
    proteinTarget = 120,
    analyzedTodayProtein = 0,
    avgProteinRatio = 0.5,
    weeklyChange = 0,
    musclePct = 20,
  } = userData;

  const remaining = Math.max(0, proteinTarget - analyzedTodayProtein);
  const proteinPct = Math.round((analyzedTodayProtein / proteinTarget) * 100);

  const systemPrompt = isTr
    ? `Sen motivasyon koçusun. Kullanıcı verisine göre SADECE BİR bildirim mesajı yaz.
Başlık max 40 karakter, içerik max 100 karakter. Spesifik rakamlar kullan, emoji ekle, 1 somut aksiyon öner.
Sadece JSON döndür: {"title":"...","body":"..."}`
    : `You are a motivation coach. Generate ONE push notification based on user data.
Title max 40 chars, body max 100 chars. Use real numbers, add emoji, suggest 1 concrete action.
Return JSON only: {"title":"...","body":"..."}`;

  const userContext = isTr
    ? `Kilo: ${currentWeight || '?'}kg | Protein hedefi: ${proteinTarget}g | Bugün: ${analyzedTodayProtein}g (%${proteinPct}) | Kalan: ${remaining}g | Haftalık kayıp: ${weeklyChange.toFixed(1)}kg | Kas kaybı: %${musclePct} | 7g ort protein: %${Math.round(avgProteinRatio * 100)}`
    : `Weight: ${currentWeight || '?'}kg | Protein target: ${proteinTarget}g | Today: ${analyzedTodayProtein}g (${proteinPct}%) | Remaining: ${remaining}g | Weekly loss: ${weeklyChange.toFixed(1)}kg | Muscle loss: ${musclePct}% | 7d avg protein: ${Math.round(avgProteinRatio * 100)}%`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 80,
      temperature: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContext },
      ],
    }),
  });

  if (!response.ok) throw new Error('OpenAI notification error');
  const data = await response.json();
  const raw = data.choices[0].message.content.trim();
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Schedule personalized notifications (call on app open) ───────────────────

/**
 * Generates an AI-personalized notification for tomorrow morning
 * + a midday coach CTA for today.
 * Call this each time the app loads with fresh user data.
 */
export async function schedulePersonalizedNotifications(userData, language = 'en', hour = 9, minute = 0) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const isTr = language === 'tr';
  const proteinTarget = userData.proteinTarget || 120;
  const analyzedTodayProtein = userData.analyzedTodayProtein || 0;
  const remaining = Math.max(0, proteinTarget - analyzedTodayProtein);

  // AI-personalized morning notification for tomorrow
  try {
    const personalizedMsg = await generateMotivationViaAI(userData, language);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hour, minute, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: { title: personalizedMsg.title, body: personalizedMsg.body, sound: true },
      trigger: tomorrow,
    });
  } catch {
    // OpenAI failed — fallback 14-day schedule is already running
  }

  // Midday coach CTA (only if it's still before 12:30 today)
  const middayToday = new Date();
  middayToday.setHours(12, 30, 0, 0);

  if (middayToday > new Date()) {
    const middayMsg = remaining > 0
      ? {
          title: isTr ? '🥩 Öğle Protein Kontrolü' : '🥩 Midday Protein Check',
          body: isTr
            ? `${remaining}g kalmış. Koçuna sor: "Öğle ne yemeli?" →`
            : `${remaining}g left today. Ask your coach: "What for lunch?" →`,
        }
      : {
          title: isTr ? '🎯 Harika Gidiyorsun!' : '🎯 On Track!',
          body: isTr
            ? 'Protein hedefindesin! Koçun seni tebrik etmek istiyor →'
            : "You're hitting your target! Your coach has a message →",
        };

    await Notifications.scheduleNotificationAsync({
      content: { title: middayMsg.title, body: middayMsg.body, sound: true },
      trigger: middayToday,
    });
  }
}

// ── Test notification ─────────────────────────────────────────────────────────

export async function sendTestNotification(language = 'en') {
  const messages = language === 'tr' ? MESSAGES_TR : MESSAGES_EN;
  const msg = messages[Math.floor(Math.random() * messages.length)];
  await Notifications.scheduleNotificationAsync({
    content: { title: msg.title, body: msg.body },
    trigger: { seconds: 3 },
  });
}
