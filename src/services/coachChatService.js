const OPENAI_API_KEY = '***REMOVED***';

export async function sendCoachMessage({ messages, todayMeals, proteinTarget, language }) {
  const isTr = language === 'tr';
  const totalProtein = todayMeals.reduce((s, m) => s + (m.protein || 0), 0);
  const mealSummary = todayMeals.length > 0
    ? todayMeals.map(m => `${m.foodType} (${m.protein}g protein)`).join(', ')
    : (isTr ? 'henüz öğün girilmedi' : 'no meals logged yet');

  const systemPrompt = isTr
    ? `Sen GLP-1 Coach uygulamasının kişisel beslenme ve motivasyon koçusun.
Kullanıcı GLP-1 kilo verme ilacı kullanan veya yeni bırakan biri.

Bugünkü bilgiler:
- Bugün yediği öğünler: ${mealSummary}
- Bugün aldığı toplam protein: ${totalProtein}g
- Günlük protein hedefi: ${proteinTarget}g
- Hedef durumu: ${totalProtein >= proteinTarget ? '✅ Hedefe ulaştı!' : `⚠️ ${proteinTarget - totalProtein}g eksik`}

Görevin:
- Kısa, samimi ve motive edici yanıtlar ver (2-4 cümle)
- Yediklerine göre kişiselleştirilmiş öneriler sun
- Tıbbi tavsiye verme, yaşam tarzı desteği sağla
- Türkçe konuş, sıcak ve cesaretlendirici ol
- Gerektiğinde protein kaynaklarını öner (tavuk, yumurta, yoğurt, balık, mercimek vb.)`
    : `You are a personal nutrition and motivation coach in the GLP-1 Coach app.
The user is someone using or recently stopping GLP-1 weight loss medication.

Today's context:
- Today's meals: ${mealSummary}
- Total protein today: ${totalProtein}g
- Daily protein target: ${proteinTarget}g
- Target status: ${totalProtein >= proteinTarget ? '✅ Target reached!' : `⚠️ ${proteinTarget - totalProtein}g remaining`}

Your role:
- Give short, warm, motivating responses (2-4 sentences)
- Provide personalized suggestions based on what they ate
- No medical advice — lifestyle support only
- Speak in English, be encouraging and human
- Suggest protein sources when needed (chicken, eggs, yogurt, fish, lentils, etc.)`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 150,
      temperature: 0.8,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
