import { OPENAI_API_KEY } from '../config';

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return JSON.parse(text);
}

function buildResult(parsed, isTr) {
  if (!parsed || typeof parsed.protein === 'undefined') {
    throw new Error('Invalid response structure');
  }
  return {
    protein: Number(parsed.protein) || 0,
    foodType: parsed.foodType || (isTr ? 'Karışık' : 'Mixed'),
    portionSize: parsed.portionSize || (isTr ? 'Orta' : 'Medium'),
    calories: Number(parsed.calories) || 0,
    sufficient: Boolean(parsed.sufficient),
    suggestion: parsed.suggestion || '',
    muscleScore: parsed.muscleScore || 'B',
    qualityTags: Array.isArray(parsed.qualityTags) ? parsed.qualityTags : [],
    smartSwap: parsed.smartSwap || null,
  };
}

async function imageUriToBase64(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function analyzeMealWithAI(imageUri, language = 'en') {
  const isTr = language === 'tr';

  const prompt = isTr
    ? `Sen bir beslenme uzmanısın. Bu yemek fotoğrafını dikkatlice analiz et.

Görünen yiyecekleri tanımla, pişirme yöntemini ve porsiyon boyutunu tahmin et.
Standart porsiyon ağırlıklarına ve besin tablolarına göre hesapla.

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "protein": 30,
  "foodType": "Izgara Tavuk + Sebze",
  "portionSize": "Orta",
  "calories": 420,
  "sufficient": true,
  "suggestion": "Proteini iyi. Yanına yoğurt eklerseniz daha da güçlendirirsiniz.",
  "muscleScore": "A",
  "qualityTags": ["Yüksek Protein", "Düşük Yağ"],
  "smartSwap": "Beyaz pirinç yerine bulgur: +4g protein, +6g lif, aynı kalori"
}

Kurallar:
- protein: gram cinsinden (tüm görünen yiyeceklerin toplamı)
- foodType: Türkçe kısa yemek adı
- portionSize: "Küçük", "Orta" veya "Büyük"
- calories: tahmini toplam kalori
- sufficient: protein 25g ve üzerindeyse true
- suggestion: kas koruma odaklı 1 cümle öneri
- proteinScore: "A+" (protein>30g, kalori<600), "A" (protein 25-30g), "B" (protein 15-25g), "C" (protein<15g, karbonhidrat fazla), "D" (işlenmiş, protein yok)
- qualityTags: 2-3 kısa etiket, ör: ["Yüksek Protein", "Orta Kalori", "İyi Kurtarma"]
- smartSwap: tek bir yiyecek değişimi önerisi veya null`
    : `You are a nutrition expert. Carefully analyze this food photo.

Identify all visible foods, estimate cooking method and portion size.
Calculate based on standard portion weights and nutrition tables.

Respond with ONLY this JSON, nothing else:
{
  "protein": 30,
  "foodType": "Grilled Chicken + Vegetables",
  "portionSize": "Medium",
  "calories": 420,
  "sufficient": true,
  "suggestion": "Good protein. Adding yogurt on the side would boost it further.",
  "muscleScore": "A",
  "qualityTags": ["High Protein", "Low Fat"],
  "smartSwap": "Swap white rice for quinoa: +6g protein, +8g fiber, same calories"
}

Rules:
- protein: total grams from ALL visible foods (be precise)
- foodType: short descriptive name in English
- portionSize: "Small", "Medium", or "Large"
- calories: estimated total calories
- sufficient: true if protein >= 25g
- suggestion: 1 sentence muscle-preservation tip
- proteinScore: "A+" (protein>30g, calories<600), "A" (protein 25-30g), "B" (protein 15-25g), "C" (protein<15g, high carbs), "D" (ultra-processed, minimal protein)
- qualityTags: 2-3 short tags e.g. ["High Protein", "Moderate Carbs", "Good for Recovery"]
- smartSwap: one specific food substitution suggestion, or null`;

  const base64 = await imageUriToBase64(imageUri);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content.trim();
  try {
    return buildResult(extractJSON(raw), isTr);
  } catch {
    throw new Error(
      isTr
        ? 'Yemek analiz edilemedi. Lütfen daha net bir fotoğraf çekin veya manuel giriş yapın.'
        : 'Could not analyze meal. Please take a clearer photo or use manual entry.'
    );
  }
}

export async function analyzeMealWithText(description, language = 'en') {
  const isTr = language === 'tr';

  const prompt = isTr
    ? `Sen bir beslenme uzmanısın. Kullanıcının tarif ettiği yemeği analiz et.

Yemek açıklaması: "${description}"

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "protein": 25,
  "foodType": "2 Yumurta + Beyaz Peynir",
  "portionSize": "Orta",
  "calories": 280,
  "sufficient": false,
  "suggestion": "Yanına yoğurt ekleyerek proteini artırabilirsiniz.",
  "muscleScore": "B",
  "qualityTags": ["Orta Protein", "Düşük Karbonhidrat"],
  "smartSwap": null
}

Kurallar:
- protein: gram cinsinden toplam protein tahmini
- foodType: kısa Türkçe yemek özeti
- portionSize: "Küçük", "Orta" veya "Büyük"
- calories: tahmini toplam kalori
- sufficient: protein 25g ve üzerindeyse true
- proteinScore: "A+" (>30g protein, <600 kcal), "A" (25-30g), "B" (15-25g), "C" (<15g), "D" (işlenmiş)
- qualityTags: 2-3 kısa etiket`
    : `You are a nutrition expert. Analyze the meal described by the user.

Meal description: "${description}"

Respond with ONLY this JSON, nothing else:
{
  "protein": 25,
  "foodType": "2 Eggs + White Cheese",
  "portionSize": "Medium",
  "calories": 280,
  "sufficient": false,
  "suggestion": "Add Greek yogurt on the side to boost protein.",
  "muscleScore": "B",
  "qualityTags": ["Moderate Protein", "Low Carb"],
  "smartSwap": null
}

Rules:
- protein: total estimated protein in grams
- foodType: short English meal summary
- portionSize: "Small", "Medium", or "Large"
- calories: estimated total calories
- sufficient: true if protein >= 25g
- proteinScore: "A+" (>30g, <600 kcal), "A" (25-30g), "B" (15-25g), "C" (<15g), "D" (ultra-processed)
- qualityTags: 2-3 short tags`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 500,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content.trim();
  try {
    return buildResult(extractJSON(raw), isTr);
  } catch {
    throw new Error(
      isTr
        ? 'Yemek analiz edilemedi. Lütfen tekrar deneyin.'
        : 'Could not analyze meal. Please try again.'
    );
  }
}
