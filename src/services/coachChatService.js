import { callAIChat, isAIConfigured } from './aiClient';

// ── Prompt-injection hardening (report C5) ────────────────────────────────────
// Neutralize control chars / instruction markers and cap length before any
// user-influenced text (meal names, chat turns) is embedded in a prompt.
function sanitizeUserText(input, maxLen = 600) {
  let s = String(input == null ? '' : input);
  // Strip ASCII control characters (incl. newlines/tabs) -> space.
  s = s.replace(/[\x00-\x1F\x7F]/g, ' ');
  s = s.replace(/```/g, "'").replace(/["“”]/g, "'");
  s = s.replace(
    /\b(ignore|disregard|forget)\b([^\n]{0,40}?)\b(previous|above|prior|all)\b([^\n]{0,40}?)\b(instructions?|prompt|rules?)\b/gi,
    '[filtered]'
  );
  s = s.replace(/\bsystem\s*:/gi, 'system-').replace(/\bassistant\s*:/gi, 'assistant-');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export async function sendCoachMessage({
  messages,
  todayMeals,
  proteinTarget,
  language,
  glp1Status,
  drug,
  doseMg,
  currentWeight,
  weeklyChange,
  weightTrend,
}) {
  const isTr = language === 'tr';
  const totalProtein = todayMeals.reduce((s, m) => s + (m.protein || 0), 0);
  const mealSummary = todayMeals.length > 0
    ? todayMeals
        .map(m => `${sanitizeUserText(m.foodType, 80)} (${m.protein}g protein)`)
        .join(', ')
    : (isTr ? 'henüz öğün girilmedi' : 'no meals logged yet');

  // --- GLP-1 medication context (all fields optional) ---
  const statusLabel = (() => {
    if (!glp1Status) return null;
    if (isTr) {
      if (glp1Status === 'currentlyUsing') return 'şu anda ilacı kullanıyor';
      if (glp1Status === 'recentlyStopped') return 'ilacı yakın zamanda bıraktı';
      if (glp1Status === 'planningToStop') return 'ilacı bırakmayı planlıyor';
      return null;
    }
    if (glp1Status === 'currentlyUsing') return 'currently using the medication';
    if (glp1Status === 'recentlyStopped') return 'recently stopped the medication';
    if (glp1Status === 'planningToStop') return 'planning to stop the medication';
    return null;
  })();

  const weeklyChangeLine = (() => {
    if (typeof weeklyChange !== 'number' || !isFinite(weeklyChange)) return null;
    const abs = Math.abs(weeklyChange).toFixed(1);
    if (isTr) {
      if (weeklyChange > 0) return `Bu hafta ${abs} kg verdi`;
      if (weeklyChange < 0) return `Bu hafta ${abs} kg aldı`;
      return 'Bu hafta kilo değişimi yok';
    }
    if (weeklyChange > 0) return `Lost ${abs} kg this week`;
    if (weeklyChange < 0) return `Gained ${abs} kg this week`;
    return 'No weight change this week';
  })();

  // --- Recent weight trend (optional short array, oldest->newest) ---
  const trendPoints = Array.isArray(weightTrend)
    ? weightTrend.filter(p => p && typeof p.weight === 'number' && isFinite(p.weight))
    : [];

  const trendSummaryLine = (() => {
    if (trendPoints.length < 2) return null;
    const first = trendPoints[0].weight;
    const last = trendPoints[trendPoints.length - 1].weight;
    const delta = last - first;
    const absDelta = Math.abs(delta).toFixed(1);
    let direction;
    if (delta <= -0.3) direction = isTr ? 'düşüşte' : 'dropping';
    else if (delta >= 0.3) direction = isTr ? 'yükselişte' : 'rising';
    else direction = isTr ? 'durağan (plato)' : 'stalling (plateau)';
    if (isTr) {
      return `Son ${trendPoints.length} ölçümde eğilim: ${direction} (toplam ${absDelta} kg, ${first} → ${last} kg)`;
    }
    return `Trend over last ${trendPoints.length} readings: ${direction} (${absDelta} kg total, ${first} → ${last} kg)`;
  })();

  const trendDetailLine = (() => {
    if (trendPoints.length < 2) return null;
    const seq = trendPoints
      .map(p => (p.date ? `${p.date}: ${p.weight}kg` : `${p.weight}kg`))
      .join(' → ');
    return isTr ? `Son ölçümler: ${seq}` : `Recent readings: ${seq}`;
  })();

  const glp1ContextLines = [];
  if (statusLabel) {
    glp1ContextLines.push(
      isTr ? `- GLP-1 durumu: ${statusLabel}` : `- GLP-1 status: ${statusLabel}`
    );
  }
  if (drug) {
    glp1ContextLines.push(isTr ? `- İlaç: ${drug}` : `- Medication: ${drug}`);
  }
  if (typeof doseMg === 'number' && isFinite(doseMg) && doseMg > 0) {
    glp1ContextLines.push(
      isTr ? `- Güncel doz: ${doseMg} mg` : `- Current dose: ${doseMg} mg`
    );
  }
  if (typeof currentWeight === 'number' && isFinite(currentWeight)) {
    glp1ContextLines.push(
      isTr ? `- Güncel kilo: ${currentWeight} kg` : `- Current weight: ${currentWeight} kg`
    );
  }
  if (weeklyChangeLine) {
    glp1ContextLines.push(isTr ? `- ${weeklyChangeLine}` : `- ${weeklyChangeLine}`);
  }
  if (trendSummaryLine) {
    glp1ContextLines.push(isTr ? `- ${trendSummaryLine}` : `- ${trendSummaryLine}`);
  }
  if (trendDetailLine) {
    glp1ContextLines.push(isTr ? `- ${trendDetailLine}` : `- ${trendDetailLine}`);
  }

  const glp1ContextBlock = glp1ContextLines.length > 0
    ? (isTr
        ? `\n\nGLP-1 ilaç bağlamı:\n${glp1ContextLines.join('\n')}`
        : `\n\nGLP-1 medication context:\n${glp1ContextLines.join('\n')}`)
    : '';

  // Extra guidance when the user has stopped or is planning to stop.
  const isOffOrLeaving = glp1Status === 'recentlyStopped' || glp1Status === 'planningToStop';
  const reboundGuidance = isOffOrLeaving
    ? (isTr
        ? `\n\nÖNEMLİ — Kullanıcı ilacı bırakıyor/bıraktı:
- İlaç bırakıldığında bir miktar kilo geri kazanımı (rebound) yaygındır; bunu normalleştir ve onu rahatlat, korkutma.
- Sonuçları ilaç olmadan korumanın anahtarının YETERLİ PROTEİN (hedefe ulaşmak) + DİRENÇ ANTRENMANI (haftada 2–3 gün) olduğunu vurgula; bunlar kas kütlesini korur ve metabolizmayı yüksek tutar.
- Tokluk hissini desteklemek için protein ve lif açısından zengin öğünler, bol su ve uyku öner.
- Hızlı kilo geri kazanımı veya doz değişimi gibi tıbbi konularda doktora yönlendir.`
        : `\n\nIMPORTANT — The user is stopping / has stopped the medication:
- Some weight regain (rebound) is common after stopping; normalize this and reassure them — do not alarm.
- Emphasize that the key to sustaining results without the drug is ADEQUATE PROTEIN (hitting the target) + RESISTANCE TRAINING (2–3 days/week); these preserve muscle mass and keep metabolism elevated.
- Suggest protein- and fiber-rich meals, plenty of water, and good sleep to support satiety now that appetite suppression is fading.
- For medical concerns like rapid regain or dose changes, direct them to their doctor.`)
    : '';

  // Guidance for users actively on the drug: acknowledge titration / dose changes
  // and that weight loss is rarely linear while ramping up.
  const onDrugGuidance = glp1Status === 'currentlyUsing'
    ? (isTr
        ? `\n\nİLAÇ KULLANIMI — Kullanıcı şu anda GLP-1 ilacı kullanıyor${typeof doseMg === 'number' && isFinite(doseMg) && doseMg > 0 ? ` (${doseMg} mg)` : ''}:
- Doz artışı (titrasyon) sürecinde kilo kaybının DOĞRUSAL OLMADIĞINI hatırlat; haftalar arası dalgalanma ve plato dönemleri normaldir.
- Eğilim durağansa (plato) bunu başarısızlık gibi sunma; vücudun adaptasyonu doğaldır ve doz arttıkça etkinin değişebileceğini nazikçe belirt.
- Yeterli protein ve direnç antrenmanının, kilo verirken kas kütlesini koruduğunu vurgula.
- Doz değişimi, yan etki veya tıbbi konularda mutlaka doktora yönlendir; doz önerme.`
        : `\n\nON MEDICATION — The user is currently on a GLP-1 drug${typeof doseMg === 'number' && isFinite(doseMg) && doseMg > 0 ? ` (${doseMg} mg)` : ''}:
- Remind them weight loss is NOT LINEAR during titration (dose ramp-up); week-to-week swings and plateaus are normal.
- If the trend is stalling (plateau), do not frame it as failure — the body adapting is expected, and effects can shift as the dose increases. Mention this gently.
- Emphasize that adequate protein plus resistance training preserves muscle while losing weight.
- For dose changes, side effects, or medical concerns, always direct them to their doctor; never recommend a dose.`)
    : '';

  const systemPrompt = isTr
    ? `Sen GLP-1 Coach uygulamasının kişisel beslenme ve wellness rehberisin.
Kullanıcı protein takibi yapan ve kas kütlesini korumak isteyen biri.

Bugünkü bilgiler:
- Bugün yediği öğünler: ${mealSummary}
- Bugün aldığı toplam protein: ${totalProtein}g
- Günlük protein hedefi: ${proteinTarget}g
- Hedef durumu: ${totalProtein >= proteinTarget ? '✅ Hedefe ulaştı!' : `⚠️ ${proteinTarget - totalProtein}g eksik`}${glp1ContextBlock}${onDrugGuidance}${reboundGuidance}

Görevin:
- Kısa, samimi ve motive edici yanıtlar ver (2-4 cümle)
- Yediklerine göre kişiselleştirilmiş öneriler sun
- Tıbbi tavsiye verme, yaşam tarzı desteği sağla
- Türkçe konuş, sıcak ve cesaretlendirici ol
- Gerektiğinde protein kaynaklarını öner (tavuk, yumurta, yoğurt, balık, mercimek vb.)
- Sağlık veya tıbbi karar içeren sorularda mutlaka "Bu konuda doktorunuza danışmanızı öneririm" diyerek yönlendir`
    : `You are a personal nutrition and wellness guide in the GLP-1 Coach app.
The user is someone tracking protein intake and working to preserve muscle mass.

Today's context:
- Today's meals: ${mealSummary}
- Total protein today: ${totalProtein}g
- Daily protein target: ${proteinTarget}g
- Target status: ${totalProtein >= proteinTarget ? '✅ Target reached!' : `⚠️ ${proteinTarget - totalProtein}g remaining`}${glp1ContextBlock}${onDrugGuidance}${reboundGuidance}

Your role:
- Give short, warm, motivating responses (2-4 sentences)
- Provide personalized suggestions based on what they ate
- No medical advice — lifestyle and fitness support only
- Speak in English, be encouraging and human
- Suggest protein sources when needed (chicken, eggs, yogurt, fish, lentils, etc.)
- For any question about medical conditions, symptoms, or medical decisions, always respond with "I'd recommend consulting your doctor about this" before offering lifestyle tips`;

  // Context-based local reply used when there's no AI key or the request fails,
  // so the coach never shows a scary "connection error" — it still helps.
  const buildOfflineReply = () => {
    const remaining = Math.max(0, proteinTarget - totalProtein);
    const proteinFoods = isTr
      ? 'tavuk, yumurta, yoğurt, balık ya da mercimek'
      : 'chicken, eggs, yogurt, fish, or lentils';
    const parts = [];
    if (totalProtein >= proteinTarget) {
      parts.push(isTr
        ? `Bugün protein hedefini tutturdun (${totalProtein}/${proteinTarget}g) 💪 Harika gidiyorsun!`
        : `You've hit your protein target today (${totalProtein}/${proteinTarget}g) 💪 Great work!`);
    } else {
      parts.push(isTr
        ? `Bugün ${totalProtein}/${proteinTarget}g protein aldın — ${remaining}g kaldı. ${proteinFoods} ile tamamlayabilirsin.`
        : `You're at ${totalProtein}/${proteinTarget}g protein today — ${remaining}g to go. Top it up with ${proteinFoods}.`);
    }
    if (isOffOrLeaving) {
      parts.push(isTr
        ? 'İlacı bıraktıktan sonra kiloyu korumanın anahtarı: yeterli protein + haftada 2–3 direnç antrenmanı.'
        : 'After stopping the medication, the key to maintaining is adequate protein + 2–3 resistance workouts a week.');
    } else if (glp1Status === 'currentlyUsing') {
      parts.push(isTr
        ? 'Doz artışı sürecinde kilo kaybı dalgalı olabilir; platolar normaldir, devam et.'
        : 'Weight loss can be uneven during dose ramp-up; plateaus are normal — keep going.');
    }
    parts.push(isTr
      ? '(Çevrimdışı yanıt — tam yapay zekâ koç için ayarlardan OpenAI anahtarı ekleyin.)'
      : '(Offline reply — add an OpenAI key to enable the full AI coach.)');
    return parts.join(' ');
  };

  // No AI proxy → local reply instead of an error.
  if (!isAIConfigured()) return buildOfflineReply();

  // Sanitize each chat turn's text before sending (report C5). Preserve roles
  // and any non-string content (defensive) untouched.
  const safeMessages = (Array.isArray(messages) ? messages : []).map(m => {
    if (m && typeof m.content === 'string') {
      return { ...m, content: sanitizeUserText(m.content, 1000) };
    }
    return m;
  });

  try {
    // Routed through the backend proxy — no client-side OpenAI key (report A1).
    // Coach chat is text-only → use the cheaper gpt-4o-mini (report #6, cost).
    const reply = await callAIChat({
      model: 'gpt-4o-mini',
      maxTokens: 150,
      temperature: 0.8,
      messages: [
        { role: 'system', content: systemPrompt },
        ...safeMessages,
      ],
    });
    return reply;
  } catch {
    // AI_UNAVAILABLE / network / quota / parse failure → graceful local reply.
    return buildOfflineReply();
  }
}
