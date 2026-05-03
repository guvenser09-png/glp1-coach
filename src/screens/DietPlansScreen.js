import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView as RNSafeAreaView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSubscription } from '../context/SubscriptionContext';
import { getUserProfile } from '../services/firestoreService';

// ── Meal database (no pork) ──────────────────────────────────────────────────

const BREAKFASTS = [
  {
    en: 'Greek Yogurt Bowl',
    tr: 'Yunan Yoğurdu Kasesi',
    protein: 35,
    calories: 400,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['200g Greek yogurt', '1/2 cup mixed berries', '30g almonds', '1 tsp honey'],
      tr: ['200g Yunan yoğurdu', '1/2 su bardağı karışık meyve', '30g badem', '1 tsp bal'],
    },
    steps: {
      en: [
        'Add Greek yogurt to a bowl.',
        'Top with mixed berries and almonds.',
        'Drizzle honey on top.',
        'Optional: stir in a scoop of vanilla protein powder.',
      ],
      tr: [
        'Yunan yoğurdunu kaseye ekleyin.',
        'Üzerine karışık meyve ve badem koyun.',
        'Bal gezdirin.',
        'İsteğe bağlı: bir ölçek vanilyalı protein tozu karıştırın.',
      ],
    },
  },
  {
    en: 'Egg White Omelette',
    tr: 'Yumurta Beyazı Omleti',
    protein: 30,
    calories: 320,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['5 egg whites', 'handful spinach', '30g feta cheese', '1 tomato, diced'],
      tr: ['5 yumurta beyazı', 'bir avuç ıspanak', '30g beyaz peynir', '1 domates, küp doğranmış'],
    },
    steps: {
      en: [
        'Whisk egg whites with a pinch of salt.',
        'Heat a non-stick pan over medium heat with a little olive oil.',
        'Pour in egg whites; add spinach and tomato when edges set.',
        'Fold omelette, top with crumbled feta and serve.',
      ],
      tr: [
        'Yumurta beyazlarını bir tutam tuzla çırpın.',
        'Yapışmaz tavayı biraz zeytinyağıyla orta ateşte ısıtın.',
        'Yumurtaları dökün; kenarlar pişmeye başlayınca ıspanak ve domates ekleyin.',
        'Omleti katlayın, üzerine beyaz peynir ufalayın ve servis edin.',
      ],
    },
  },
  {
    en: 'Cottage Cheese Pancakes',
    tr: 'Lor Peynirli Krep',
    protein: 28,
    calories: 350,
    prepTime: '10 dk / 10 min',
    ingredients: {
      en: ['150g cottage cheese', '1/2 cup rolled oats', '2 eggs', '1 ripe banana'],
      tr: ['150g lor peyniri', '1/2 su bardağı yulaf', '2 yumurta', '1 olgun muz'],
    },
    steps: {
      en: [
        'Blend cottage cheese, oats, eggs, and banana until smooth.',
        'Heat a non-stick pan over medium heat.',
        'Pour small rounds of batter and cook 2-3 min each side.',
        'Serve with fresh berries or a drizzle of honey.',
      ],
      tr: [
        'Lor peyniri, yulaf, yumurta ve muzu pürüzsüz olana kadar blendın.',
        'Yapışmaz tavayı orta ateşte ısıtın.',
        'Hamuru küçük yuvarlaklar halinde dökün, her yüzünü 2-3 dk pişirin.',
        'Taze meyveler veya bal ile servis edin.',
      ],
    },
  },
  {
    en: 'Protein Smoothie Bowl',
    tr: 'Protein Smoothie Kasesi',
    protein: 32,
    calories: 380,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['1 scoop protein powder', '1 cup frozen mixed berries', '120ml almond milk', '30g granola'],
      tr: ['1 ölçek protein tozu', '1 su bardağı dondurulmuş karışık meyve', '120ml badem sütü', '30g granola'],
    },
    steps: {
      en: [
        'Blend protein powder, frozen berries, and almond milk until thick.',
        'Pour into a bowl — it should be thicker than a drink.',
        'Top with granola and any fresh fruit.',
        'Eat immediately before granola softens.',
      ],
      tr: [
        'Protein tozu, dondurulmuş meyve ve badem sütünü kalın kıvamlı olana kadar blendın.',
        'Kaseye dökün — içecekten daha kalın olmalı.',
        'Granola ve taze meyvelerle süsleyin.',
        'Granola yumuşamadan hemen yiyin.',
      ],
    },
  },
  {
    en: 'Turkey & Avocado Toast',
    tr: 'Hindi & Avokado Tostu',
    protein: 29,
    calories: 410,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['2 slices whole grain bread', '80g turkey breast slices', '1/2 avocado', '1 egg, poached'],
      tr: ['2 dilim tam buğday ekmeği', '80g hindi göğsü dilimi', '1/2 avokado', '1 yumurta, haşlanmış'],
    },
    steps: {
      en: [
        'Toast the bread slices until golden.',
        'Mash avocado with lemon juice, salt, and pepper.',
        'Spread avocado on toast, layer turkey slices on top.',
        'Add a poached or fried egg and season with chili flakes.',
      ],
      tr: [
        'Ekmek dilimlerini kızarana kadar kızartın.',
        'Avokadoyu limon suyu, tuz ve karabiberle ezin.',
        'Avokadoyu ekmeğe sürün, hindi dilimlerini üstüne koyun.',
        'Haşlanmış veya sahanda yumurta ekleyin, kırmızı pul biber serpin.',
      ],
    },
  },
  {
    en: 'Overnight Oats',
    tr: 'Gecelik Yulaf',
    protein: 24,
    calories: 360,
    prepTime: '5 dk (gece önce) / 5 min (night before)',
    ingredients: {
      en: ['1/2 cup rolled oats', '1 tbsp chia seeds', '150g Greek yogurt', '1 scoop protein powder', 'handful berries'],
      tr: ['1/2 su bardağı yulaf', '1 yemek kaşığı chia tohumu', '150g Yunan yoğurdu', '1 ölçek protein tozu', 'bir avuç meyve'],
    },
    steps: {
      en: [
        'Mix oats, chia seeds, Greek yogurt, and protein powder in a jar.',
        'Add enough almond milk to cover (about 150ml).',
        'Stir well, seal the jar, and refrigerate overnight.',
        'In the morning, top with fresh berries and eat cold.',
      ],
      tr: [
        'Yulaf, chia tohumu, Yunan yoğurdu ve protein tozunu bir kavanoze karıştırın.',
        'Üzerini örtecek kadar badem sütü ekleyin (yaklaşık 150ml).',
        'İyice karıştırın, kavanozun kapağını kapatın ve gecelik buzdolabına koyun.',
        'Sabah taze meyvelerle servis edin, soğuk yiyin.',
      ],
    },
  },
  {
    en: 'Smoked Salmon Toast',
    tr: 'Füme Somon Tostu',
    protein: 34,
    calories: 390,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['2 slices whole grain bread', '100g smoked salmon', '2 tbsp cream cheese', '1 tbsp capers', 'fresh dill'],
      tr: ['2 dilim tam buğday ekmeği', '100g füme somon', '2 yemek kaşığı krem peynir', '1 yemek kaşığı kapari', 'taze dereotu'],
    },
    steps: {
      en: [
        'Toast the bread until crispy.',
        'Spread cream cheese generously on each slice.',
        'Layer smoked salmon on top.',
        'Garnish with capers and fresh dill; add a squeeze of lemon.',
      ],
      tr: [
        'Ekmeği gevrek olana kadar kızartın.',
        'Her dilime bolca krem peynir sürün.',
        'Üzerine füme somon dilimleri koyun.',
        'Kapari ve taze dereotu ile süsleyin; limon sıkın.',
      ],
    },
  },
];

const LUNCHES = [
  {
    en: 'Grilled Chicken Salad',
    tr: 'Izgara Tavuk Salatası',
    protein: 42,
    calories: 450,
    prepTime: '10 dk / 10 min',
    ingredients: {
      en: ['150g chicken breast', '2 cups mixed greens', '1 tbsp olive oil', 'juice of 1 lemon', 'cherry tomatoes'],
      tr: ['150g tavuk göğsü', '2 su bardağı karışık yeşillik', '1 yemek kaşığı zeytinyağı', '1 limon suyu', 'cherry domates'],
    },
    steps: {
      en: [
        'Season chicken with salt, pepper, and garlic powder.',
        'Grill or pan-fry chicken 6-7 min per side until cooked through.',
        'Slice and let rest 2 minutes.',
        'Toss greens with olive oil and lemon, top with chicken and tomatoes.',
      ],
      tr: [
        'Tavuğu tuz, karabiber ve sarımsak tozu ile baharatlayın.',
        'Tavuğu her yüzü 6-7 dk ızgara veya tavada pişirin.',
        'Dilimleyin ve 2 dakika dinlendirin.',
        'Yeşillikleri zeytinyağı ve limonla karıştırın, tavuk ve domatesle servis edin.',
      ],
    },
  },
  {
    en: 'Tuna & Quinoa Bowl',
    tr: 'Ton Balığı & Kinoa Kasesi',
    protein: 38,
    calories: 420,
    prepTime: '15 dk / 15 min',
    ingredients: {
      en: ['1 can tuna in water (150g drained)', '1/2 cup quinoa (dry)', '1/2 cucumber, diced', 'cherry tomatoes', 'lemon juice'],
      tr: ['1 kutu ton balığı (150g süzülmüş)', '1/2 su bardağı kinoa (kuru)', '1/2 salatalık, küp doğranmış', 'cherry domates', 'limon suyu'],
    },
    steps: {
      en: [
        'Cook quinoa in 1 cup water for 12-15 min until fluffy; let cool.',
        'Drain and flake tuna.',
        'Mix quinoa, cucumber, tomatoes, and tuna in a bowl.',
        'Dress with olive oil, lemon juice, salt, and pepper.',
      ],
      tr: [
        'Kinoayı 1 su bardağı suda 12-15 dk pişirin; soğumaya bırakın.',
        'Ton balığını süzün ve parçalayın.',
        'Kinoa, salatalık, domates ve ton balığını kasede karıştırın.',
        'Zeytinyağı, limon suyu, tuz ve karabiberle tatlandırın.',
      ],
    },
  },
  {
    en: 'Turkey Wrap',
    tr: 'Hindi Dürümü',
    protein: 35,
    calories: 430,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['100g turkey breast slices', '1 whole wheat tortilla', '2 leaves romaine lettuce', '2 tbsp hummus', '1/4 cucumber'],
      tr: ['100g hindi göğsü dilimi', '1 tam buğday tortilla', '2 yaprak marul', '2 yemek kaşığı humus', '1/4 salatalık'],
    },
    steps: {
      en: [
        'Lay tortilla flat and spread hummus evenly.',
        'Layer lettuce, turkey slices, and cucumber strips.',
        'Season with salt, pepper, and a squeeze of lemon.',
        'Roll tightly, cut in half diagonally, and serve.',
      ],
      tr: [
        'Tortillayı düz koyun ve humusu eşit şekilde sürün.',
        'Marul, hindi dilimleri ve salatalık şeritlerini üstüne koyun.',
        'Tuz, karabiber ve biraz limon sıkın.',
        'Sıkıca sarın, çapraz kesin ve servis edin.',
      ],
    },
  },
  {
    en: 'Lentil Soup + Grilled Chicken',
    tr: 'Mercimek Çorbası + Izgara Tavuk',
    protein: 40,
    calories: 460,
    prepTime: '20 dk / 20 min',
    ingredients: {
      en: ['1/2 cup red lentils', '100g grilled chicken breast', '1 carrot', '1 onion', 'cumin, paprika'],
      tr: ['1/2 su bardağı kırmızı mercimek', '100g ızgara tavuk göğsü', '1 havuç', '1 soğan', 'kimyon, paprika'],
    },
    steps: {
      en: [
        'Sauté diced onion and carrot in olive oil 3-4 min.',
        'Add rinsed lentils, 500ml water, cumin, and paprika.',
        'Simmer 15-18 min until lentils are soft; blend partially.',
        'Serve soup alongside sliced grilled chicken.',
      ],
      tr: [
        'Küp doğranmış soğan ve havucu zeytinyağında 3-4 dk soteleyin.',
        'Yıkanmış mercimek, 500ml su, kimyon ve paprika ekleyin.',
        '15-18 dk mercimek yumuşayana kadar pişirin; kısmen blendın.',
        'Çorbayı dilimlenmiş ızgara tavukla servis edin.',
      ],
    },
  },
  {
    en: 'Greek Chicken Bowl',
    tr: 'Yunan Tavuk Kasesi',
    protein: 44,
    calories: 470,
    prepTime: '15 dk / 15 min',
    ingredients: {
      en: ['150g chicken thigh', '1/2 cup cooked brown rice', '3 tbsp tzatziki', '10 olives', '1/2 cucumber'],
      tr: ['150g tavuk but', '1/2 su bardağı pişmiş esmer pirinç', '3 yemek kaşığı tzatziki', '10 zeytin', '1/2 salatalık'],
    },
    steps: {
      en: [
        'Marinate chicken in lemon juice, garlic, and oregano 5 min.',
        'Grill or pan-cook chicken 7-8 min per side.',
        'Assemble bowl: rice base, sliced chicken, cucumber, olives.',
        'Add tzatziki on top and garnish with fresh herbs.',
      ],
      tr: [
        'Tavuğu limon suyu, sarımsak ve kekikle 5 dk marine edin.',
        'Tavuğu her yüzü 7-8 dk ızgara veya tavada pişirin.',
        'Kaseyi hazırlayın: pirinç tabanı, dilimlenmiş tavuk, salatalık, zeytin.',
        'Üstüne tzatziki ekleyin ve taze otlarla süsleyin.',
      ],
    },
  },
  {
    en: 'Egg Salad Lettuce Wraps',
    tr: 'Yumurtalı Salata Sarma',
    protein: 30,
    calories: 340,
    prepTime: '15 dk / 15 min',
    ingredients: {
      en: ['4 hard-boiled eggs', '2 tbsp Greek yogurt', '1 tsp mustard', '4 large lettuce leaves', 'chives, salt, pepper'],
      tr: ['4 haşlanmış yumurta', '2 yemek kaşığı Yunan yoğurdu', '1 tsp hardal', '4 büyük marul yaprağı', 'frenk soğanı, tuz, karabiber'],
    },
    steps: {
      en: [
        'Hard-boil eggs 10 min, cool under cold water, and peel.',
        'Chop eggs and mix with Greek yogurt, mustard, salt, pepper, and chives.',
        'Wash and dry large lettuce leaves.',
        'Spoon egg salad into each lettuce cup and serve.',
      ],
      tr: [
        'Yumurtaları 10 dk haşlayın, soğuk su altında soğutun ve soyun.',
        'Yumurtaları doğrayın; Yunan yoğurdu, hardal, tuz, karabiber ve frenk soğanıyla karıştırın.',
        'Büyük marul yapraklarını yıkayın ve kurulayın.',
        'Her marul yaprağına yumurta salatası koyun ve servis edin.',
      ],
    },
  },
  {
    en: 'Shrimp Stir-Fry',
    tr: 'Karidesli Kavurma',
    protein: 38,
    calories: 400,
    prepTime: '10 dk / 10 min',
    ingredients: {
      en: ['200g shrimp, peeled', '1/2 cup brown rice (cooked)', '1 cup broccoli florets', '2 tbsp soy sauce', '1 tsp fresh ginger'],
      tr: ['200g soyulmuş karides', '1/2 su bardağı esmer pirinç (pişmiş)', '1 su bardağı brokoli', '2 yemek kaşığı soya sosu', '1 tsp taze zencefil'],
    },
    steps: {
      en: [
        'Heat a wok or large pan over high heat with a little sesame oil.',
        'Add shrimp and cook 2-3 min until pink; remove and set aside.',
        'Stir-fry broccoli and ginger 3-4 min.',
        'Return shrimp, add soy sauce, toss with rice and serve.',
      ],
      tr: [
        'Wok veya büyük tavayı yüksek ateşte biraz susam yağıyla ısıtın.',
        'Karidesleri ekleyin, 2-3 dk pembeleşene kadar pişirin; kenara alın.',
        'Brokoli ve zencefili 3-4 dk kavurun.',
        'Karidesleri geri ekleyin, soya sosu ekleyin, pirinçle karıştırın ve servis edin.',
      ],
    },
  },
];

const DINNERS = [
  {
    en: 'Baked Salmon + Vegetables',
    tr: 'Fırın Somon + Sebzeler',
    protein: 45,
    calories: 500,
    prepTime: '10 dk / 30 min',
    ingredients: {
      en: ['200g salmon fillet', '1 cup broccoli', '1 small sweet potato', '2 tbsp olive oil', 'lemon, garlic'],
      tr: ['200g somon fileto', '1 su bardağı brokoli', '1 küçük tatlı patates', '2 yemek kaşığı zeytinyağı', 'limon, sarımsak'],
    },
    steps: {
      en: [
        'Preheat oven to 200°C (390°F).',
        'Toss broccoli and cubed sweet potato with olive oil, salt, and pepper on a baking tray.',
        'Place salmon fillet on the tray, season with garlic and lemon.',
        'Bake 20-22 min until salmon flakes easily.',
      ],
      tr: [
        'Fırını 200°C\'ye ısıtın.',
        'Brokoli ve küp kesilmiş tatlı patatesi zeytinyağı, tuz ve karabiberle fırın tepsisine koyun.',
        'Somon filetoyu tepsiye koyun, sarımsak ve limonla baharatlayın.',
        'Somon kolayca parçalanana kadar 20-22 dk pişirin.',
      ],
    },
  },
  {
    en: 'Grilled Chicken & Brown Rice',
    tr: 'Izgara Tavuk & Esmer Pirinç',
    protein: 48,
    calories: 520,
    prepTime: '10 dk / 25 min',
    ingredients: {
      en: ['200g chicken breast', '3/4 cup brown rice (dry)', '150g green beans', '3 garlic cloves', 'olive oil'],
      tr: ['200g tavuk göğsü', '3/4 su bardağı esmer pirinç (kuru)', '150g yeşil fasulye', '3 sarımsak dişi', 'zeytinyağı'],
    },
    steps: {
      en: [
        'Cook brown rice per packet instructions (about 25 min).',
        'Season chicken with garlic, olive oil, salt, and herbs; grill 6-7 min per side.',
        'Blanch green beans in salted water 3-4 min; drain.',
        'Slice chicken and serve over rice with green beans on the side.',
      ],
      tr: [
        'Esmer pirinci paket talimatlarına göre pişirin (yaklaşık 25 dk).',
        'Tavuğu sarımsak, zeytinyağı, tuz ve otlarla baharatlayın; her yüzü 6-7 dk ızgara yapın.',
        'Yeşil fasulyeleri tuzlu suda 3-4 dk haşlayın; süzün.',
        'Tavuğu dilimleyin ve yeşil fasulye ile birlikte pirinç üzerinde servis edin.',
      ],
    },
  },
  {
    en: 'Lean Beef Stir-Fry',
    tr: 'Yağsız Dana Kavurma',
    protein: 42,
    calories: 480,
    prepTime: '10 dk / 15 min',
    ingredients: {
      en: ['180g lean beef strips', '1 red bell pepper', '2 cups bok choy', '2 tbsp oyster sauce', '1 tsp sesame oil'],
      tr: ['180g yağsız dana şeritler', '1 kırmızı biber', '2 su bardağı bok choy', '2 yemek kaşığı istiridye sosu', '1 tsp susam yağı'],
    },
    steps: {
      en: [
        'Slice beef thinly against the grain.',
        'Heat wok on high; sear beef 2-3 min, remove and set aside.',
        'Stir-fry bell pepper and bok choy 3-4 min.',
        'Return beef, add oyster sauce and sesame oil; toss and serve with rice.',
      ],
      tr: [
        'Dananın lifine karşı ince dilimleyin.',
        'Woku yüksek ateşte ısıtın; danaları 2-3 dk kavurun, kenara alın.',
        'Kırmızı biber ve bok choyu 3-4 dk kavurun.',
        'Danaları geri ekleyin, istiridye sosu ve susam yağı ekleyin; pirinçle servis edin.',
      ],
    },
  },
  {
    en: 'Turkey Meatballs + Zucchini Noodles',
    tr: 'Hindi Köfte + Kabak Erişte',
    protein: 44,
    calories: 490,
    prepTime: '15 dk / 20 min',
    ingredients: {
      en: ['250g ground turkey', '2 zucchinis, spiralized', '150ml marinara sauce', '30g parmesan', 'garlic, parsley'],
      tr: ['250g kıyma hindi', '2 kabak, erişte şeklinde kesilmiş', '150ml marinara sosu', '30g parmesan', 'sarımsak, maydanoz'],
    },
    steps: {
      en: [
        'Mix ground turkey with garlic, parsley, salt, and pepper; shape into small balls.',
        'Brown meatballs in a pan with olive oil 8-10 min, turning occasionally.',
        'Add marinara sauce; simmer 5 min.',
        'Serve over raw or lightly sautéed zucchini noodles, topped with parmesan.',
      ],
      tr: [
        'Kıyma hindiyi sarımsak, maydanoz, tuz ve karabiberle karıştırın; küçük toplar yapın.',
        'Köfteleri zeytinyağıyla tavada 8-10 dk, ara sıra çevirerek kızartın.',
        'Marinara sosu ekleyin; 5 dk pişirin.',
        'Çiğ veya hafif sotelenmiş kabak erithe üzerinde parmesan ile servis edin.',
      ],
    },
  },
  {
    en: 'Cod & Asparagus',
    tr: 'Morina & Kuşkonmaz',
    protein: 40,
    calories: 420,
    prepTime: '5 dk / 20 min',
    ingredients: {
      en: ['200g cod fillet', '200g asparagus', 'juice of 1 lemon', '2 tbsp olive oil', 'fresh herbs (dill or parsley)'],
      tr: ['200g morina fileto', '200g kuşkonmaz', '1 limon suyu', '2 yemek kaşığı zeytinyağı', 'taze ot (dereotu veya maydanoz)'],
    },
    steps: {
      en: [
        'Preheat oven to 190°C (375°F).',
        'Lay asparagus on a baking tray, drizzle with olive oil and salt.',
        'Place cod on the tray, season with lemon juice, salt, and herbs.',
        'Bake 18-20 min until cod is opaque and flaky.',
      ],
      tr: [
        'Fırını 190°C\'ye ısıtın.',
        'Kuşkonmazı fırın tepsisine koyun, zeytinyağı ve tuz gezdirin.',
        'Morineyi tepsiye koyun, limon suyu, tuz ve otlarla baharatlayın.',
        'Morina opak ve parçalanır hale gelene kadar 18-20 dk pişirin.',
      ],
    },
  },
  {
    en: 'Chicken & Chickpea Curry',
    tr: 'Tavuklu Nohut Körisi',
    protein: 46,
    calories: 510,
    prepTime: '10 dk / 25 min',
    ingredients: {
      en: ['200g chicken breast, cubed', '200g canned chickpeas', '200ml coconut milk', '1 tbsp curry powder', 'onion, garlic, ginger'],
      tr: ['200g tavuk göğsü, küp kesilmiş', '200g konserve nohut', '200ml hindistan cevizi sütü', '1 yemek kaşığı köri tozu', 'soğan, sarımsak, zencefil'],
    },
    steps: {
      en: [
        'Sauté diced onion, garlic, and ginger in oil 3-4 min.',
        'Add curry powder and cook 1 min until fragrant.',
        'Add chicken cubes; brown 4-5 min.',
        'Stir in chickpeas and coconut milk; simmer 15 min. Serve with brown rice.',
      ],
      tr: [
        'Küp soğan, sarımsak ve zencefili yağda 3-4 dk soteleyin.',
        'Köri tozunu ekleyin ve 1 dk kokusu çıkana kadar pişirin.',
        'Tavuk küplerini ekleyin; 4-5 dk kızartın.',
        'Nohut ve hindistan cevizi sütünü karıştırın; 15 dk pişirin. Esmer pirinçle servis edin.',
      ],
    },
  },
  {
    en: 'Beef & Sweet Potato Bowl',
    tr: 'Dana & Tatlı Patates Kasesi',
    protein: 43,
    calories: 490,
    prepTime: '10 dk / 30 min',
    ingredients: {
      en: ['180g lean ground beef', '1 medium sweet potato', '1 cup Brussels sprouts', '1 apple, diced', 'olive oil, cinnamon, paprika'],
      tr: ['180g yağsız kıyma dana', '1 orta boy tatlı patates', '1 su bardağı Brüksel lahanası', '1 elma, küp doğranmış', 'zeytinyağı, tarçın, paprika'],
    },
    steps: {
      en: [
        'Preheat oven to 200°C. Halve Brussels sprouts and cube sweet potato.',
        'Toss vegetables with olive oil, paprika, salt; roast 25 min.',
        'Brown ground beef in a pan with cinnamon, salt, and pepper.',
        'Assemble bowl with roasted veggies, beef, and diced apple on top.',
      ],
      tr: [
        'Fırını 200°C\'ye ısıtın. Brüksel lahanasını ikiye bölün, tatlı patatesi küp kesin.',
        'Sebzeleri zeytinyağı, paprika ve tuzla karıştırın; 25 dk fırınlayın.',
        'Kıyma danaları tavada tarçın, tuz ve karabiberle pişirin.',
        'Kaseyi fırınlanmış sebzeler, dana ve üstüne elma ile hazırlayın.',
      ],
    },
  },
];

const SNACKS = [
  {
    en: 'Cottage Cheese + Cucumber',
    tr: 'Lor Peyniri + Salatalık',
    protein: 18,
    calories: 150,
    prepTime: '2 dk / 2 min',
    ingredients: {
      en: ['150g low-fat cottage cheese', '1/2 cucumber, sliced', 'pinch of black pepper'],
      tr: ['150g az yağlı lor peyniri', '1/2 salatalık, dilimlenmiş', 'bir tutam karabiber'],
    },
    steps: {
      en: [
        'Slice cucumber into rounds.',
        'Place cottage cheese in a small bowl.',
        'Arrange cucumber slices alongside.',
        'Season with black pepper and optional fresh herbs.',
      ],
      tr: [
        'Salatalığı dilimleyin.',
        'Lor peynirini küçük bir kaseye koyun.',
        'Salatalık dilimlerini yanına dizeyin.',
        'Karabiber ve isteğe bağlı taze ot ekleyin.',
      ],
    },
  },
  {
    en: 'Hard-Boiled Eggs',
    tr: 'Haşlanmış Yumurta',
    protein: 16,
    calories: 140,
    prepTime: '10 dk / 10 min',
    ingredients: {
      en: ['2 large eggs', 'pinch of salt', 'pinch of paprika'],
      tr: ['2 büyük yumurta', 'bir tutam tuz', 'bir tutam paprika'],
    },
    steps: {
      en: [
        'Place eggs in a small pot and cover with cold water.',
        'Bring to a boil, then reduce heat and simmer 9-10 min.',
        'Transfer to an ice bath for 2 min to stop cooking.',
        'Peel and season with salt and paprika.',
      ],
      tr: [
        'Yumurtaları küçük bir tencereye koyun ve soğuk suyla kapatın.',
        'Kaynamaya başlayınca ısıyı düşürün ve 9-10 dk haşlayın.',
        'Pişmeyi durdurmak için 2 dk buz banyosuna alın.',
        'Soyun ve tuz ile paprika ekleyin.',
      ],
    },
  },
  {
    en: 'Greek Yogurt + Almonds',
    tr: 'Yunan Yoğurdu + Badem',
    protein: 20,
    calories: 200,
    prepTime: '2 dk / 2 min',
    ingredients: {
      en: ['150g plain Greek yogurt', '20g almonds', 'pinch of cinnamon'],
      tr: ['150g sade Yunan yoğurdu', '20g badem', 'bir tutam tarçın'],
    },
    steps: {
      en: [
        'Spoon Greek yogurt into a bowl.',
        'Top with almonds.',
        'Sprinkle with cinnamon.',
        'Optional: add a few drops of vanilla extract.',
      ],
      tr: [
        'Yunan yoğurdunu kaseye koyun.',
        'Üstüne badem ekleyin.',
        'Tarçın serpin.',
        'İsteğe bağlı: birkaç damla vanilya özü ekleyin.',
      ],
    },
  },
  {
    en: 'Protein Bar',
    tr: 'Protein Bar',
    protein: 20,
    calories: 220,
    prepTime: '0 dk / 0 min',
    ingredients: {
      en: ['1 high-protein bar (20g+ protein)'],
      tr: ['1 yüksek proteinli bar (20g+ protein)'],
    },
    steps: {
      en: [
        'Choose a bar with at least 20g protein per serving.',
        'Prefer bars with minimal added sugar (under 10g).',
        'Pair with water or unsweetened tea.',
        'Great for on-the-go or post-workout.',
      ],
      tr: [
        'Porsiyon başına en az 20g protein içeren bir bar seçin.',
        'Düşük şekerli barları tercih edin (10g altı).',
        'Su veya şekersiz çayla birlikte tüketin.',
        'Hareket halindeyken veya antrenmandan sonra idealdir.',
      ],
    },
  },
  {
    en: 'Tuna + Rice Cakes',
    tr: 'Ton Balığı + Pirinç Keki',
    protein: 22,
    calories: 190,
    prepTime: '3 dk / 3 min',
    ingredients: {
      en: ['1 can tuna in water (80g drained)', '2 plain rice cakes', '1/4 avocado'],
      tr: ['1 kutu ton balığı (80g süzülmüş)', '2 sade pirinç keki', '1/4 avokado'],
    },
    steps: {
      en: [
        'Drain and flake canned tuna.',
        'Mash avocado with a fork; season with salt and lemon.',
        'Spread avocado on rice cakes.',
        'Top with tuna and optional chili flakes.',
      ],
      tr: [
        'Ton balığını süzün ve parçalayın.',
        'Avokadoyu çatalla ezin; tuz ve limonla tatlandırın.',
        'Pirinç keplerine avokado sürün.',
        'Ton balığı ekleyin, isteğe bağlı kırmızı pul biber serpin.',
      ],
    },
  },
  {
    en: 'Edamame',
    tr: 'Edamame',
    protein: 17,
    calories: 160,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['200g edamame (in shell)', 'pinch of sea salt'],
      tr: ['200g edamame (kabuklu)', 'bir tutam deniz tuzu'],
    },
    steps: {
      en: [
        'Bring a pot of salted water to a boil.',
        'Add edamame and cook 4-5 min.',
        'Drain well.',
        'Sprinkle with sea salt and serve warm.',
      ],
      tr: [
        'Tuzlu suyu kaynamaya getirin.',
        'Edamame ekleyin ve 4-5 dk pişirin.',
        'İyice süzün.',
        'Deniz tuzu serpin ve sıcak servis edin.',
      ],
    },
  },
  {
    en: 'String Cheese + Apple',
    tr: 'Dil Peyniri + Elma',
    protein: 14,
    calories: 170,
    prepTime: '2 dk / 2 min',
    ingredients: {
      en: ['2 sticks low-fat string cheese', '1 medium apple, sliced'],
      tr: ['2 adet az yağlı dil peyniri', '1 orta boy elma, dilimlenmiş'],
    },
    steps: {
      en: [
        'Wash and slice the apple into thin wedges.',
        'Peel string cheese into strips.',
        'Pair together for a satisfying protein + fiber snack.',
        'Optional: dip apple in a little almond butter.',
      ],
      tr: [
        'Elmayı yıkayın ve ince dilimleyin.',
        'Dil peynirini şeritler halinde soyun.',
        'Protein + lif kombinasyonu için birlikte tüketin.',
        'İsteğe bağlı: elmayı biraz badem ezmesine daldırın.',
      ],
    },
  },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function getMealForDay(mealArray, dayIndex) {
  return mealArray[dayIndex % mealArray.length];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DietPlansScreen({ navigation }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { checkAccess } = useSubscription();
  const isTr = language === 'tr';

  const [activeDay, setActiveDay] = useState(0);
  const [proteinTarget, setProteinTarget] = useState(120);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!checkAccess('diet_plans')) {
      navigation.navigate('Paywall', { featureKey: 'diet_plans', featureName: t('dietPlans') });
      return;
    }
    if (user) {
      getUserProfile(user.uid)
        .then((profile) => {
          if (profile?.proteinTarget) {
            setProteinTarget(profile.proteinTarget);
          } else if (profile?.weight) {
            setProteinTarget(Math.round(profile.weight * 1.6));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const dayMeals = {
    breakfast: getMealForDay(BREAKFASTS, activeDay),
    lunch: getMealForDay(LUNCHES, activeDay),
    dinner: getMealForDay(DINNERS, activeDay),
    snack: getMealForDay(SNACKS, activeDay),
  };

  const dailyProtein =
    dayMeals.breakfast.protein +
    dayMeals.lunch.protein +
    dayMeals.dinner.protein +
    dayMeals.snack.protein;

  const dailyCalories =
    dayMeals.breakfast.calories +
    dayMeals.lunch.calories +
    dayMeals.dinner.calories +
    dayMeals.snack.calories;

  const dayLabels = isTr ? DAYS_TR : DAYS;

  function openMealModal(mealKey, meal) {
    const labels = {
      breakfast: { en: 'Breakfast', tr: 'Kahvaltı' },
      lunch: { en: 'Lunch', tr: 'Öğle' },
      dinner: { en: 'Dinner', tr: 'Akşam' },
      snack: { en: 'Snack', tr: 'Atıştırma' },
    };
    const emojis = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
    setSelectedMeal({ ...meal, mealType: labels[mealKey], emoji: emojis[mealKey] });
    setModalVisible(true);
  }

  function renderMealCard(mealKey, meal) {
    const labels = { breakfast: t('breakfast'), lunch: t('lunch'), dinner: t('dinner'), snack: t('snack') };
    const emojis = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
    return (
      <TouchableOpacity
        key={mealKey}
        style={styles.mealCard}
        onPress={() => openMealModal(mealKey, meal)}
        activeOpacity={0.85}
      >
        <View style={styles.mealHeader}>
          <Text style={styles.mealEmoji}>{emojis[mealKey]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.mealType}>{labels[mealKey]}</Text>
            <Text style={styles.mealName}>{isTr ? meal.tr : meal.en}</Text>
          </View>
          <View style={styles.mealMacros}>
            <Text style={styles.mealProtein}>{meal.protein}g</Text>
            <Text style={styles.mealProteinLabel}>{t('protein')}</Text>
          </View>
        </View>
        <View style={styles.mealDetails}>
          <View style={styles.mealStat}>
            <Text style={styles.mealStatValue}>{meal.calories}</Text>
            <Text style={styles.mealStatLabel}>{t('calories')}</Text>
          </View>
          <View style={styles.mealStatDivider} />
          <Text style={styles.mealIngredients}>
            {(isTr ? meal.ingredients.tr : meal.ingredients.en).join(', ')}
          </Text>
        </View>
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>
            {isTr ? 'Tarif için dokun →' : 'Tap for recipe →'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>{t('dietPlans')}</Text>
        <View style={styles.proteinTargetBadge}>
          <Text style={styles.proteinTargetText}>🎯 {proteinTarget}g {t('perDay')}</Text>
        </View>
      </View>

      {/* Day tabs */}
      <View style={styles.dayTabsRow}>
        {dayLabels.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.dayTab, activeDay === index && styles.dayTabActive]}
            onPress={() => setActiveDay(index)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dayTabText, activeDay === index && styles.dayTabTextActive]}>
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Total Banner */}
        <View style={styles.dailyTotalBanner}>
          <View style={styles.dailyTotalItem}>
            <Text style={styles.dailyTotalValue}>{dailyProtein}g</Text>
            <Text style={styles.dailyTotalLabel}>{t('protein')}</Text>
          </View>
          <View style={styles.dailyTotalDivider} />
          <View style={styles.dailyTotalItem}>
            <Text style={styles.dailyTotalValue}>{dailyCalories}</Text>
            <Text style={styles.dailyTotalLabel}>{t('calories')}</Text>
          </View>
          <View style={styles.dailyTotalDivider} />
          <View style={styles.dailyTotalItem}>
            <Text style={[styles.dailyTotalValue, { color: dailyProtein >= proteinTarget ? '#10B981' : '#F59E0B' }]}>
              {Math.round((dailyProtein / proteinTarget) * 100)}%
            </Text>
            <Text style={styles.dailyTotalLabel}>{isTr ? 'Hedef' : 'Goal'}</Text>
          </View>
        </View>

        {/* Protein bar */}
        <View style={styles.proteinBarContainer}>
          <View style={styles.proteinBarTrack}>
            <View
              style={[
                styles.proteinBarFill,
                {
                  width: `${Math.min((dailyProtein / proteinTarget) * 100, 100)}%`,
                  backgroundColor: dailyProtein >= proteinTarget ? '#10B981' : '#4F46E5',
                },
              ]}
            />
          </View>
          <Text style={styles.proteinBarLabel}>
            {dailyProtein}g / {proteinTarget}g {t('protein')}
          </Text>
        </View>

        {/* Meal Cards */}
        {renderMealCard('breakfast', dayMeals.breakfast)}
        {renderMealCard('lunch', dayMeals.lunch)}
        {renderMealCard('dinner', dayMeals.dinner)}
        {renderMealCard('snack', dayMeals.snack)}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Meal Detail Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedMeal && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalEmoji}>{selectedMeal.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalMealType}>
                      {isTr ? selectedMeal.mealType.tr : selectedMeal.mealType.en}
                    </Text>
                    <Text style={styles.modalMealName}>
                      {isTr ? selectedMeal.tr : selectedMeal.en}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.modalCloseBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 32 }}
                >
                  {/* Prep time + Nutrition pills */}
                  <View style={styles.pillRow}>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>⏱ {selectedMeal.prepTime}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: '#EEF2FF' }]}>
                      <Text style={[styles.pillText, { color: '#4F46E5' }]}>
                        💪 {selectedMeal.protein}g {isTr ? 'protein' : 'protein'}
                      </Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: '#FFF7ED' }]}>
                      <Text style={[styles.pillText, { color: '#D97706' }]}>
                        🔥 {selectedMeal.calories} kcal
                      </Text>
                    </View>
                  </View>

                  {/* Ingredients */}
                  <Text style={styles.modalSectionTitle}>
                    {isTr ? '🛒 Malzemeler' : '🛒 Ingredients'}
                  </Text>
                  <View style={styles.ingredientsList}>
                    {(isTr ? selectedMeal.ingredients.tr : selectedMeal.ingredients.en).map(
                      (item, i) => (
                        <View key={i} style={styles.ingredientItem}>
                          <View style={styles.ingredientBullet} />
                          <Text style={styles.ingredientText}>{item}</Text>
                        </View>
                      )
                    )}
                  </View>

                  {/* Steps */}
                  <Text style={styles.modalSectionTitle}>
                    {isTr ? '👨‍🍳 Hazırlanış' : '👨‍🍳 Preparation'}
                  </Text>
                  <View style={styles.stepsList}>
                    {(isTr ? selectedMeal.steps.tr : selectedMeal.steps.en).map((step, i) => (
                      <View key={i} style={styles.stepItem}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Nutrition summary */}
                  <View style={styles.nutritionSummary}>
                    <Text style={styles.nutritionSummaryTitle}>
                      {isTr ? '📊 Besin Özeti' : '📊 Nutrition Summary'}
                    </Text>
                    <View style={styles.nutritionRow}>
                      <View style={styles.nutritionItem}>
                        <Text style={[styles.nutritionValue, { color: '#4F46E5' }]}>
                          {selectedMeal.protein}g
                        </Text>
                        <Text style={styles.nutritionLabel}>{isTr ? 'Protein' : 'Protein'}</Text>
                      </View>
                      <View style={styles.nutritionDivider} />
                      <View style={styles.nutritionItem}>
                        <Text style={[styles.nutritionValue, { color: '#F59E0B' }]}>
                          {selectedMeal.calories}
                        </Text>
                        <Text style={styles.nutritionLabel}>{isTr ? 'Kalori' : 'Calories'}</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heading: { fontSize: 24, fontWeight: '800', color: '#111827' },
  proteinTargetBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  proteinTargetText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  dayTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 6,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  dayTabActive: { backgroundColor: '#4F46E5' },
  dayTabText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  dayTabTextActive: { color: '#FFFFFF' },
  content: { paddingHorizontal: 24 },

  dailyTotalBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  dailyTotalItem: { flex: 1, alignItems: 'center' },
  dailyTotalValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  dailyTotalLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  dailyTotalDivider: { width: 1, backgroundColor: '#F3F4F6', marginHorizontal: 8 },

  proteinBarContainer: { marginBottom: 16 },
  proteinBarTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  proteinBarFill: { height: '100%', borderRadius: 4 },
  proteinBarLabel: { fontSize: 12, color: '#6B7280', textAlign: 'right' },

  mealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  mealEmoji: { fontSize: 26, marginRight: 12 },
  mealType: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealName: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 2 },
  mealMacros: { alignItems: 'flex-end' },
  mealProtein: { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  mealProteinLabel: { fontSize: 11, color: '#6B7280' },
  mealDetails: { flexDirection: 'row', alignItems: 'center' },
  mealStat: { alignItems: 'center', marginRight: 12 },
  mealStatValue: { fontSize: 16, fontWeight: '700', color: '#374151' },
  mealStatLabel: { fontSize: 11, color: '#9CA3AF' },
  mealStatDivider: { width: 1, height: 32, backgroundColor: '#F3F4F6', marginRight: 12 },
  mealIngredients: { fontSize: 13, color: '#6B7280', flex: 1, lineHeight: 18 },
  tapHint: { marginTop: 10, alignItems: 'flex-end' },
  tapHintText: { fontSize: 12, color: '#4F46E5', fontWeight: '600' },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  modalHeader: {
    backgroundColor: '#4F46E5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalEmoji: { fontSize: 30, marginRight: 12 },
  modalMealType: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalMealName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalCloseBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  ingredientsList: { marginBottom: 20 },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ingredientBullet: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4F46E5',
    marginTop: 6,
    marginRight: 10,
    flexShrink: 0,
  },
  ingredientText: { fontSize: 14, color: '#374151', lineHeight: 20, flex: 1 },

  stepsList: { marginBottom: 20 },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  stepNumberText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  stepText: { fontSize: 14, color: '#374151', lineHeight: 20, flex: 1 },

  nutritionSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  nutritionSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  nutritionRow: { flexDirection: 'row' },
  nutritionItem: { flex: 1, alignItems: 'center' },
  nutritionValue: { fontSize: 26, fontWeight: '800' },
  nutritionLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  nutritionDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 16 },
});
