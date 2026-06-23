import * as Notifications from 'expo-notifications';

import { callAIChat } from './aiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 54 / expo-notifications 0.32: foreground presentation needs
    // shouldShowBanner + shouldShowList (shouldShowAlert is deprecated).
    shouldShowBanner: true,
    shouldShowList: true,
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
  { title: "🔬 Body Science", body: "Enough protein at every meal helps protect muscle while you lose weight. Make it count!" },
  { title: "💡 Smart Move", body: "High protein + movement = muscle preservation. You know what to do today!" },
  { title: "🎉 Keep the Momentum", body: "Consistency beats perfection. One more good day — you've got this!" },
  { title: "🚀 Level Up", body: "Small actions compound. A yogurt here, an egg there — your muscles notice!" },
  { title: "🤖 Wellness Check-in", body: "Your GLP-1 Coach guide wants to know how you're doing. Tap to chat." },
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
  { title: "🔬 Vücut Bilimi", body: "Her öğünde yeterli protein, kilo verirken kaslarını korumana yardımcı olur. Önemli kıl!" },
  { title: "💡 Akıllı Adım", body: "Yüksek protein + hareket = kas koruması. Bugün ne yapman gerektiğini biliyorsun!" },
  { title: "🎉 Momentumu Koru", body: "Tutarlılık mükemmelliği geçer. Bir gün daha iyi beslen — başarabilirsin!" },
  { title: "🚀 Seviye Atla", body: "Küçük eylemler birikir. Bir yoğurt, bir yumurta — kasların fark eder!" },
  { title: "🤖 Wellness Hatırlatıcısı", body: "GLP-1 Coach rehberin bugün nasıl gittiğini merak ediyor. Sohbet etmek için aç." },
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
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
    }
  }

  return true;
}

// ── AI personalized notification generator (via secure proxy) ────────────────

// Local fallback used when the AI proxy is unavailable (AI_UNAVAILABLE) or any
// request/parse error occurs. Pulls a fresh message from the existing banks so a
// missed AI call still surfaces a real, on-brand notification (never fake AI).
function pickFallbackMotivation(language) {
  const messages = language === 'tr' ? MESSAGES_TR : MESSAGES_EN;
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Generates a personalized morning notification via the secure AI proxy
 * (callAIChat — no client-side OpenAI key). On AI_UNAVAILABLE or any failure,
 * falls back to the existing local message banks so a notification is always
 * scheduled. Returns { title, body }.
 */
async function generateMotivationViaAI(userData, language) {
  const isTr = language === 'tr';
  const {
    currentWeight,
    proteinTarget = 120,
    analyzedTodayProtein = 0,
    avgProteinRatio = 0.5,
    weeklyChange = 0,
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
    ? `Kilo: ${currentWeight || '?'}kg | Protein hedefi: ${proteinTarget}g | Bugün: ${analyzedTodayProtein}g (%${proteinPct}) | Kalan: ${remaining}g | Haftalık kayıp: ${weeklyChange.toFixed(1)}kg | 7g ort protein: %${Math.round(avgProteinRatio * 100)}`
    : `Weight: ${currentWeight || '?'}kg | Protein target: ${proteinTarget}g | Today: ${analyzedTodayProtein}g (${proteinPct}%) | Remaining: ${remaining}g | Weekly loss: ${weeklyChange.toFixed(1)}kg | 7d avg protein: ${Math.round(avgProteinRatio * 100)}%`;

  try {
    // Route through the secure proxy — no client-side key. callAIChat returns the
    // assistant text and signals AI_UNAVAILABLE (throw or error code) when no
    // backend/key is configured.
    const raw = await callAIChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContext },
      ],
      temperature: 0.9,
      maxTokens: 80,
    });

    const text = typeof raw === 'string' ? raw : raw?.content;
    if (!text) throw new Error('AI_UNAVAILABLE');

    const parsed = JSON.parse(String(text).replace(/```json|```/g, '').trim());
    if (parsed && parsed.title && parsed.body) {
      return { title: String(parsed.title), body: String(parsed.body) };
    }
    throw new Error('AI_UNAVAILABLE');
  } catch {
    // AI_UNAVAILABLE or network/parse failure → real local message bank entry.
    return pickFallbackMotivation(language);
  }
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
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrow },
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
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: middayToday },
    });
  }
}

// ── GLP-1 injection reminders ───────────────────────────────────────────────

const INJECTION_REMINDER_KEY = 'glp1_injection_reminder';
const MISSED_DOSE_NUDGE_KEY = 'glp1_missed_dose_nudge';

// How many hours after the reminder to fire the "did you take your dose?" nudge.
const MISSED_DOSE_NUDGE_OFFSET_HOURS = 4;

// Resolve the reminder time from explicit opts, then profile fields, then 9:00.
function resolveReminderTime(profile = {}, opts = {}) {
  const rawHour = opts.hour != null ? opts.hour : profile.reminderHour;
  const rawMinute = opts.minute != null ? opts.minute : profile.reminderMinute;

  let hour = Number(rawHour);
  let minute = Number(rawMinute);

  if (Number.isNaN(hour) || hour < 0 || hour > 23) hour = 9;
  if (Number.isNaN(minute) || minute < 0 || minute > 59) minute = 0;

  return { hour, minute };
}

/**
 * Schedules a recurring weekly injection reminder on the profile's
 * injectionWeekday. Cancels any previously-scheduled injection reminder first.
 * profile = { drug, dose, frequency, injectionWeekday (0-6), startDate, status,
 *             reminderHour, reminderMinute }
 * opts = { hour, minute } — overrides the reminder time (falls back to
 *   profile.reminderHour/reminderMinute, then 9:00).
 */
export async function scheduleInjectionReminder(profile, language = 'en', opts = {}) {
  if (!profile || profile.injectionWeekday == null) return false;
  if (profile.status && profile.status !== 'currentlyUsing') {
    // Not actively injecting — make sure no stale reminder lingers.
    await cancelInjectionReminders();
    return false;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  // Clear previous injection reminder(s) before rescheduling.
  await cancelInjectionReminders();

  const isTr = language === 'tr';
  const weekday = Number(profile.injectionWeekday);
  if (Number.isNaN(weekday)) return false;

  const { hour, minute } = resolveReminderTime(profile, opts);

  const drug = profile.drug || (isTr ? 'ilacın' : 'your medication');
  const dose = profile.dose ? ` (${profile.dose})` : '';

  const title = isTr ? '💉 Enjeksiyon Zamanı' : '💉 Injection Day';
  const body = isTr
    ? `Bugün ${drug}${dose} enjeksiyon günün. Dozunu almayı unutma!`
    : `Today is your ${drug}${dose} injection day. Don't forget your dose!`;

  // expo-notifications weekly trigger: weekday is 1-7 (Sunday = 1),
  // while our profile stores 0-6 (Sunday = 0).
  await Notifications.scheduleNotificationAsync({
    identifier: INJECTION_REMINDER_KEY,
    content: { title, body, sound: true, data: { type: 'injectionReminder' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: weekday + 1,
      hour,
      minute,
    },
  });

  return true;
}

/**
 * Schedules a same-day follow-up nudge a few hours AFTER the injection reminder
 * ("did you take your dose?"), on the same injection weekday. Only when the user
 * is actively injecting (status === 'currentlyUsing'). Cancel it via
 * cancelMissedDoseNudge() when a dose is logged so we don't nag afterwards.
 * opts = { hour, minute } — same resolution as scheduleInjectionReminder; the
 *   nudge fires MISSED_DOSE_NUDGE_OFFSET_HOURS after this time.
 */
export async function scheduleMissedDoseNudge(profile, language = 'en', opts = {}) {
  if (!profile || profile.injectionWeekday == null) return false;
  if (profile.status !== 'currentlyUsing') {
    // Only nudge active injectors — clear any stale nudge otherwise.
    await cancelMissedDoseNudge();
    return false;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  // Clear any previous nudge before rescheduling.
  await cancelMissedDoseNudge();

  const isTr = language === 'tr';
  const weekday = Number(profile.injectionWeekday);
  if (Number.isNaN(weekday)) return false;

  const { hour, minute } = resolveReminderTime(profile, opts);

  // Fire a few hours after the reminder; wrap within the same calendar day so
  // the nudge stays on the injection day rather than spilling to the next.
  const nudgeHour = Math.min(23, hour + MISSED_DOSE_NUDGE_OFFSET_HOURS);

  const drug = profile.drug || (isTr ? 'ilacın' : 'your medication');
  const dose = profile.dose ? ` (${profile.dose})` : '';

  const title = isTr ? '⏰ Dozunu Aldın mı?' : '⏰ Did You Take Your Dose?';
  const body = isTr
    ? `Bugün ${drug}${dose} dozunu aldın mı? Aldıysan uygulamada kaydet, almadıysan unutma!`
    : `Did you take your ${drug}${dose} dose today? Log it in the app if you have — otherwise don't forget!`;

  await Notifications.scheduleNotificationAsync({
    identifier: MISSED_DOSE_NUDGE_KEY,
    content: { title, body, sound: true, data: { type: 'missedDoseNudge' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: weekday + 1,
      hour: nudgeHour,
      minute,
    },
  });

  return true;
}

/**
 * Cancels the missed-dose nudge. Call this when a dose is logged so we don't
 * keep nagging after the user has already taken their injection.
 */
export async function cancelMissedDoseNudge() {
  try {
    await Notifications.cancelScheduledNotificationAsync(MISSED_DOSE_NUDGE_KEY);
  } catch {
    // No nudge with that identifier — nothing to cancel.
  }

  // Defensive sweep in case an older build scheduled without an identifier.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n?.content?.data?.type === 'missedDoseNudge') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // Ignore — best-effort cleanup.
  }
}

/**
 * Cancels the scheduled injection reminder(s).
 */
export async function cancelInjectionReminders() {
  try {
    await Notifications.cancelScheduledNotificationAsync(INJECTION_REMINDER_KEY);
  } catch {
    // No reminder with that identifier — nothing to cancel.
  }

  // Defensive sweep in case older builds scheduled without an identifier.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n?.content?.data?.type === 'injectionReminder') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // Ignore — best-effort cleanup.
  }
}

// Whether an injection reminder is currently scheduled (used to rehydrate the
// reminder toggle so it reflects real state when the screen is reopened).
export async function isInjectionReminderScheduled() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.some(
      (n) =>
        n?.identifier === INJECTION_REMINDER_KEY ||
        n?.content?.data?.type === 'injectionReminder'
    );
  } catch {
    return false;
  }
}

// ── Test notification ─────────────────────────────────────────────────────────

export async function sendTestNotification(language = 'en') {
  const messages = language === 'tr' ? MESSAGES_TR : MESSAGES_EN;
  const msg = messages[Math.floor(Math.random() * messages.length)];
  await Notifications.scheduleNotificationAsync({
    content: { title: msg.title, body: msg.body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
}
