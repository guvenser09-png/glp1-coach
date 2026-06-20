import * as FileSystem from 'expo-file-system/legacy';
import { callAIChat, isAIConfigured } from './aiClient';
import { FOOD_DATABASE } from '../utils/foodDatabase';

// ── Prompt-injection hardening (report C5) ────────────────────────────────────
// Strip control chars, collapse whitespace, neutralize obvious instruction
// markers, and cap length before embedding user-typed text in a prompt.
function sanitizeUserText(input, maxLen = 400) {
  let s = String(input == null ? '' : input);
  // Strip ASCII control characters (incl. newlines/tabs) -> space.
  s = s.replace(/[\x00-\x1F\x7F]/g, ' ');
  // Neutralize fenced/code markers and quotes that could break out of context.
  s = s.replace(/```/g, "'").replace(/["“”]/g, "'");
  // Defang common prompt-injection phrasing without dropping the user's content.
  s = s.replace(
    /\b(ignore|disregard|forget)\b([^\n]{0,40}?)\b(previous|above|prior|all)\b([^\n]{0,40}?)\b(instructions?|prompt|rules?)\b/gi,
    '[filtered]'
  );
  s = s.replace(/\bsystem\s*:/gi, 'system-').replace(/\bassistant\s*:/gi, 'assistant-');
  // Collapse runs of whitespace and trim to a sane length.
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

// ── Offline estimator ────────────────────────────────────────────────────────
// Works WITHOUT an OpenAI key: matches the typed description against the local
// food database and sums protein/calories. Used as a fallback so meal logging
// (and protein/calorie totals) still works when AI is unavailable.
function estimateMealOffline(description, isTr) {
  const text = String(description || '').toLowerCase();
  const matched = [];
  let protein = 0;
  let calories = 0;
  for (const f of FOOD_DATABASE) {
    const en = String(f.name || '').toLowerCase();
    const tr = String(f.nameTr || '').toLowerCase();
    if ((en && text.includes(en)) || (tr && text.includes(tr))) {
      protein += Number(f.protein) || 0;
      calories += Number(f.calories) || 0;
      matched.push(isTr ? (f.nameTr || f.name) : f.name);
    }
  }
  if (matched.length === 0) {
    return {
      protein: 0,
      foodType: isTr ? 'Tanınamadı' : 'Not recognized',
      portionSize: isTr ? 'Orta' : 'Medium',
      calories: 0,
      sufficient: false,
      suggestion: isTr
        ? 'Yemeği daha açık yazın (ör. "150g tavuk göğsü, 1 yumurta").'
        : 'Describe the food more specifically (e.g. "150g chicken breast, 1 egg").',
      muscleScore: 'C',
      qualityTags: [isTr ? 'Çevrimdışı tahmin' : 'Offline estimate'],
      smartSwap: null,
      offline: true,
    };
  }
  return {
    protein,
    calories,
    foodType: matched.join(' + '),
    portionSize: isTr ? 'Orta' : 'Medium',
    sufficient: protein >= 25,
    suggestion: isTr
      ? 'Yaklaşık değerler (çevrimdışı tahmin). Daha hassas analiz için yapay zekâ anahtarı ekleyin.'
      : 'Approximate values (offline estimate). Add an AI key for precise analysis.',
    muscleScore: protein >= 30 ? 'A' : protein >= 20 ? 'B' : 'C',
    qualityTags: [isTr ? 'Çevrimdışı tahmin' : 'Offline estimate'],
    smartSwap: null,
    offline: true,
  };
}

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
  // React-Native-correct: read the local file as base64 via expo-file-system.
  // (fetch(uri).blob() + FileReader is unreliable for file:// URIs in RN/Expo.)
  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

// Clear, localized error when the AI proxy isn't configured (instead of a
// cryptic "analysis error"). Photo analysis needs vision AI — there is no
// offline path for an image, so we surface a friendly message and let the
// screen route the user to manual entry.
function assertApiKeyForPhoto(isTr) {
  if (!isAIConfigured()) {
    throw new Error(
      isTr
        ? 'Fotoğraf analizi için yapay zekâ anahtarı gerekiyor. Şimdilik yemeği "Manuel Ekle" ile yazabilirsiniz — protein ve kalori otomatik tahmin edilir.'
        : 'Photo analysis needs an AI key. For now, use "Add manually" to type the meal — protein and calories are estimated automatically.'
    );
  }
}

export async function analyzeMealWithAI(imageUri, language = 'en') {
  const isTr = language === 'tr';
  assertApiKeyForPhoto(isTr);

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
- muscleScore: "A+" (protein>30g, kalori<600), "A" (protein 25-30g), "B" (protein 15-25g), "C" (protein<15g, karbonhidrat fazla), "D" (işlenmiş, protein yok)
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
- muscleScore: "A+" (protein>30g, calories<600), "A" (protein 25-30g), "B" (protein 15-25g), "C" (protein<15g, high carbs), "D" (ultra-processed, minimal protein)
- qualityTags: 2-3 short tags e.g. ["High Protein", "Moderate Carbs", "Good for Recovery"]
- smartSwap: one specific food substitution suggestion, or null`;

  let raw;
  try {
    // Read the image inside the try so an unreadable file hits the friendly catch.
    const base64 = await imageUriToBase64(imageUri);
    // Routed through the backend proxy — no client-side OpenAI key (report A1).
    raw = await callAIChat({
      model: 'gpt-4o',
      maxTokens: 600,
      temperature: 0,
      responseFormat: { type: 'json_object' },
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
    });
  } catch {
    // AI_UNAVAILABLE / network / proxy failure. There is no offline path for an
    // image, so surface the same friendly "use manual entry" message.
    throw new Error(
      isTr
        ? 'Fotoğraf analizi şu anda yapılamıyor. Lütfen daha sonra tekrar deneyin veya yemeği "Manuel Ekle" ile yazın.'
        : 'Photo analysis is unavailable right now. Please try again later or use "Add manually" to type the meal.'
    );
  }

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
  // No AI proxy → estimate from the local food database (still returns protein/calories).
  if (!isAIConfigured()) return estimateMealOffline(description, isTr);

  // Sanitize user-typed text before embedding it in the prompt (report C5).
  const safeDescription = sanitizeUserText(description);

  const prompt = isTr
    ? `Sen bir beslenme uzmanısın. Kullanıcının tarif ettiği yemeği analiz et.

Yemek açıklaması: "${safeDescription}"

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
- muscleScore: "A+" (>30g protein, <600 kcal), "A" (25-30g), "B" (15-25g), "C" (<15g), "D" (işlenmiş)
- qualityTags: 2-3 kısa etiket`
    : `You are a nutrition expert. Analyze the meal described by the user.

Meal description: "${safeDescription}"

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
- muscleScore: "A+" (>30g, <600 kcal), "A" (25-30g), "B" (15-25g), "C" (<15g), "D" (ultra-processed)
- qualityTags: 2-3 short tags`;

  try {
    // Routed through the backend proxy — no client-side OpenAI key (report A1).
    const raw = await callAIChat({
      model: 'gpt-4o',
      maxTokens: 500,
      temperature: 0,
      responseFormat: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    return buildResult(extractJSON(raw), isTr);
  } catch {
    // AI_UNAVAILABLE / network / quota / parse → fall back to the offline
    // estimate so the user still gets protein & calories.
    return estimateMealOffline(description, isTr);
  }
}
