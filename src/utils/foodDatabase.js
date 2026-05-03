// Protein ve kalori değerleri 1 orta porsiyon (100g veya belirtilen miktar) için

export const FOOD_DATABASE = [
  // ─── Tavuk & Hindi ───────────────────────────────────────────
  { name: 'Chicken Breast', nameTr: 'Tavuk Göğsü', protein: 31, calories: 165, portion: '100g' },
  { name: 'Grilled Chicken', nameTr: 'Izgara Tavuk', protein: 27, calories: 155, portion: '100g' },
  { name: 'Chicken Thigh', nameTr: 'Tavuk But', protein: 24, calories: 210, portion: '100g' },
  { name: 'Chicken Wings', nameTr: 'Tavuk Kanat', protein: 20, calories: 203, portion: '100g' },
  { name: 'Turkey Breast', nameTr: 'Hindi Göğsü', protein: 29, calories: 135, portion: '100g' },
  { name: 'Turkey Mince', nameTr: 'Hindi Kıyma', protein: 27, calories: 160, portion: '100g' },

  // ─── Kırmızı Et ───────────────────────────────────────────────
  { name: 'Ground Beef', nameTr: 'Dana Kıyma', protein: 26, calories: 250, portion: '100g' },
  { name: 'Beef Steak', nameTr: 'Biftek', protein: 28, calories: 220, portion: '100g' },
  { name: 'Lamb Chops', nameTr: 'Kuzu Pirzola', protein: 25, calories: 260, portion: '100g' },
  { name: 'Lamb Mince', nameTr: 'Kuzu Kıyma', protein: 24, calories: 270, portion: '100g' },
  { name: 'Veal', nameTr: 'Dana Eti', protein: 26, calories: 200, portion: '100g' },
  { name: 'Köfte', nameTr: 'Köfte', protein: 22, calories: 250, portion: '3 adet (100g)' },
  { name: 'Döner', nameTr: 'Döner', protein: 20, calories: 280, portion: '100g' },
  { name: 'Sucuk', nameTr: 'Sucuk', protein: 14, calories: 320, portion: '50g (4-5 dilim)' },
  { name: 'Pastırma', nameTr: 'Pastırma', protein: 18, calories: 180, portion: '50g' },

  // ─── Balık & Deniz Ürünleri ───────────────────────────────────
  { name: 'Salmon', nameTr: 'Somon', protein: 25, calories: 208, portion: '100g' },
  { name: 'Tuna (canned)', nameTr: 'Konserve Ton Balığı', protein: 30, calories: 132, portion: '100g' },
  { name: 'Sea Bass', nameTr: 'Levrek', protein: 24, calories: 124, portion: '100g' },
  { name: 'Sea Bream', nameTr: 'Çipura', protein: 23, calories: 128, portion: '100g' },
  { name: 'Mackerel', nameTr: 'Uskumru', protein: 19, calories: 205, portion: '100g' },
  { name: 'Anchovy', nameTr: 'Hamsi', protein: 20, calories: 131, portion: '100g' },
  { name: 'Trout', nameTr: 'Alabalık', protein: 22, calories: 148, portion: '100g' },
  { name: 'Shrimp', nameTr: 'Karides', protein: 20, calories: 99, portion: '100g' },
  { name: 'Grilled Fish', nameTr: 'Izgara Balık', protein: 24, calories: 140, portion: '100g' },

  // ─── Yumurta ──────────────────────────────────────────────────
  { name: 'Egg', nameTr: 'Yumurta', protein: 6, calories: 78, portion: '1 adet' },
  { name: 'Boiled Egg', nameTr: 'Haşlanmış Yumurta', protein: 6, calories: 78, portion: '1 adet' },
  { name: 'Scrambled Eggs', nameTr: 'Çırpılmış Yumurta', protein: 11, calories: 148, portion: '2 yumurta' },
  { name: 'Omelette', nameTr: 'Omlet', protein: 14, calories: 190, portion: '2 yumurtalı' },
  { name: 'Menemen', nameTr: 'Menemen', protein: 10, calories: 180, portion: '1 porsiyon' },

  // ─── Süt Ürünleri ─────────────────────────────────────────────
  { name: 'Greek Yogurt', nameTr: 'Yunan Yoğurdu', protein: 10, calories: 100, portion: '100g' },
  { name: 'Plain Yogurt', nameTr: 'Sade Yoğurt', protein: 6, calories: 90, portion: '100g' },
  { name: 'Cottage Cheese', nameTr: 'Lor / Süzme Peynir', protein: 11, calories: 98, portion: '100g' },
  { name: 'White Cheese', nameTr: 'Beyaz Peynir', protein: 14, calories: 180, portion: '60g' },
  { name: 'Kashar Cheese', nameTr: 'Kaşar Peyniri', protein: 10, calories: 160, portion: '40g dilim' },
  { name: 'Milk', nameTr: 'Süt', protein: 3, calories: 61, portion: '100ml' },
  { name: 'Whey Protein Shake', nameTr: 'Protein Tozu', protein: 25, calories: 120, portion: '1 ölçek (30g)' },

  // ─── Baklagiller ──────────────────────────────────────────────
  { name: 'Lentil Soup', nameTr: 'Mercimek Çorbası', protein: 7, calories: 130, portion: '1 kase (250ml)' },
  { name: 'Red Lentils', nameTr: 'Kırmızı Mercimek', protein: 9, calories: 116, portion: '100g pişmiş' },
  { name: 'Green Lentils', nameTr: 'Yeşil Mercimek', protein: 9, calories: 116, portion: '100g pişmiş' },
  { name: 'Chickpeas', nameTr: 'Nohut', protein: 9, calories: 164, portion: '100g pişmiş' },
  { name: 'White Beans', nameTr: 'Kuru Fasulye', protein: 8, calories: 150, portion: '100g pişmiş' },
  { name: 'Black-eyed Peas', nameTr: 'Börülce', protein: 8, calories: 130, portion: '100g pişmiş' },
  { name: 'Tofu', nameTr: 'Tofu', protein: 8, calories: 76, portion: '100g' },
  { name: 'Edamame', nameTr: 'Edamame', protein: 11, calories: 121, portion: '100g' },

  // ─── Tahıllar ─────────────────────────────────────────────────
  { name: 'Oats', nameTr: 'Yulaf Ezmesi', protein: 5, calories: 150, portion: '40g (yarım kase)' },
  { name: 'Quinoa', nameTr: 'Kinoa', protein: 4, calories: 120, portion: '100g pişmiş' },
  { name: 'Brown Rice', nameTr: 'Esmer Pirinç', protein: 3, calories: 110, portion: '100g pişmiş' },
  { name: 'White Rice', nameTr: 'Pilav', protein: 3, calories: 130, portion: '100g pişmiş' },
  { name: 'Bulgur', nameTr: 'Bulgur', protein: 4, calories: 140, portion: '100g pişmiş' },
  { name: 'Whole Wheat Bread', nameTr: 'Tam Buğday Ekmeği', protein: 4, calories: 90, portion: '1 dilim' },
  { name: 'Pasta', nameTr: 'Makarna', protein: 5, calories: 158, portion: '100g pişmiş' },

  // ─── Sebzeler ─────────────────────────────────────────────────
  { name: 'Broccoli', nameTr: 'Brokoli', protein: 3, calories: 35, portion: '100g' },
  { name: 'Spinach', nameTr: 'Ispanak', protein: 3, calories: 23, portion: '100g' },
  { name: 'Peas', nameTr: 'Bezelye', protein: 5, calories: 80, portion: '100g' },
  { name: 'Corn', nameTr: 'Mısır', protein: 3, calories: 86, portion: '100g' },

  // ─── Kuruyemiş ────────────────────────────────────────────────
  { name: 'Almonds', nameTr: 'Badem', protein: 6, calories: 164, portion: '28g (avuç)' },
  { name: 'Walnuts', nameTr: 'Ceviz', protein: 4, calories: 185, portion: '28g (avuç)' },
  { name: 'Peanuts', nameTr: 'Fıstık', protein: 7, calories: 161, portion: '28g (avuç)' },
  { name: 'Peanut Butter', nameTr: 'Fıstık Ezmesi', protein: 8, calories: 190, portion: '2 kaşık (32g)' },
  { name: 'Cashews', nameTr: 'Kaju', protein: 5, calories: 157, portion: '28g (avuç)' },

  // ─── Hazır / Fast Food ────────────────────────────────────────
  { name: 'Lahmacun', nameTr: 'Lahmacun', protein: 12, calories: 210, portion: '1 adet' },
  { name: 'Pide', nameTr: 'Pide', protein: 15, calories: 320, portion: '1 dilim' },
  { name: 'Dürüm', nameTr: 'Dürüm', protein: 22, calories: 350, portion: '1 adet' },
  { name: 'Burger', nameTr: 'Burger', protein: 20, calories: 400, portion: '1 adet' },
  { name: 'Chicken Sandwich', nameTr: 'Tavuk Sandviç', protein: 24, calories: 350, portion: '1 adet' },
];

// Porsiyon çarpanları
const PORTION_MULTIPLIERS = { Small: 0.6, Medium: 1.0, Large: 1.5 };

export function getPortionValues(food, portionSize = 'Medium') {
  const mult = PORTION_MULTIPLIERS[portionSize] ?? 1.0;
  return {
    protein: Math.round(food.protein * mult),
    calories: Math.round(food.calories * mult),
  };
}

export function searchFood(query, language = 'en') {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return FOOD_DATABASE.filter((f) =>
    f.nameTr.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
  ).slice(0, 6);
}
