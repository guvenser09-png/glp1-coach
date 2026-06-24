import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView as RNSafeAreaView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getUserProfile } from '../services/firestoreService';
import { callAIChat, isAIConfigured } from '../services/aiClient';
import { fontFamily, radii, spacing, typography, useTheme } from '../theme';
import { Chip } from '../components/ui';

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
  {
    en: 'Beef & Egg Scramble',
    tr: 'Dana & Yumurta Kavurması',
    protein: 38,
    calories: 430,
    prepTime: '10 dk / 10 min',
    ingredients: {
      en: ['120g lean ground beef', '3 eggs', '1 tbsp olive oil', '1/2 red bell pepper', 'salt, cumin'],
      tr: ['120g yağsız kıyma dana', '3 yumurta', '1 yemek kaşığı zeytinyağı', '1/2 kırmızı biber', 'tuz, kimyon'],
    },
    steps: {
      en: [
        'Brown ground beef with cumin and salt in olive oil 4-5 min.',
        'Add diced bell pepper and cook 2 min.',
        'Whisk eggs and pour over; scramble until just set.',
        'Serve immediately — great with whole grain toast.',
      ],
      tr: [
        'Kıymayı kimyon ve tuzla zeytinyağında 4-5 dk pişirin.',
        'Küp doğranmış biberi ekleyin, 2 dk pişirin.',
        'Yumurtaları çırpın ve üzerine dökün; karıştırarak pişirin.',
        'Hemen servis edin — tam buğday ekmeğiyle harika gider.',
      ],
    },
  },
  {
    en: 'Chia Pudding with Protein',
    tr: 'Proteinli Chia Pudingi',
    protein: 26,
    calories: 340,
    prepTime: '5 dk + gece / 5 min + overnight',
    ingredients: {
      en: ['3 tbsp chia seeds', '200ml almond milk', '1 scoop protein powder', '1 tbsp almond butter', 'fresh berries'],
      tr: ['3 yemek kaşığı chia tohumu', '200ml badem sütü', '1 ölçek protein tozu', '1 yemek kaşığı badem ezmesi', 'taze meyve'],
    },
    steps: {
      en: [
        'Mix chia seeds, almond milk, and protein powder in a jar.',
        'Stir well to prevent clumping; refrigerate overnight.',
        'In the morning, stir again and top with almond butter.',
        'Add fresh berries and serve cold.',
      ],
      tr: [
        'Chia tohumu, badem sütü ve protein tozunu bir kavanoze karıştırın.',
        'Topaklanmayı önlemek için iyice karıştırın; gecelik buzdolabına koyun.',
        'Sabah tekrar karıştırın ve üstüne badem ezmesi ekleyin.',
        'Taze meyvelerle soğuk servis edin.',
      ],
    },
  },
  {
    en: 'Tuna Stuffed Avocado',
    tr: 'Ton Balıklı Avokado',
    protein: 30,
    calories: 370,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['1 ripe avocado', '1 can tuna in water (120g drained)', '1 tbsp Greek yogurt', 'lemon juice', 'chives, pepper'],
      tr: ['1 olgun avokado', '1 kutu ton balığı (120g süzülmüş)', '1 yemek kaşığı Yunan yoğurdu', 'limon suyu', 'frenk soğanı, karabiber'],
    },
    steps: {
      en: [
        'Halve and pit the avocado.',
        'Mix drained tuna with Greek yogurt, lemon juice, and pepper.',
        'Spoon tuna mixture into avocado halves.',
        'Garnish with chives and a squeeze of lemon.',
      ],
      tr: [
        'Avokadoyu ikiye bölün ve çekirdeğini çıkarın.',
        'Süzülmüş ton balığını Yunan yoğurdu, limon suyu ve karabiberle karıştırın.',
        'Ton balığı karışımını avokado yarılarına koyun.',
        'Frenk soğanı ve limon ile servis edin.',
      ],
    },
  },
  {
    en: 'Ricotta & Berry Toast',
    tr: 'Ricotta & Meyveli Tost',
    protein: 22,
    calories: 310,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['2 slices whole grain bread', '100g ricotta cheese', '1/2 cup mixed berries', '1 tsp honey', 'pinch of cinnamon'],
      tr: ['2 dilim tam buğday ekmeği', '100g ricotta peyniri', '1/2 bardak karışık meyve', '1 tsp bal', 'bir tutam tarçın'],
    },
    steps: {
      en: [
        'Toast the bread until golden.',
        'Spread ricotta generously on each slice.',
        'Top with mixed berries and drizzle with honey.',
        'Sprinkle cinnamon and serve immediately.',
      ],
      tr: [
        'Ekmeği altın rengine kadar kızartın.',
        'Her dilime bolca ricotta sürün.',
        'Üzerine karışık meyve koyun ve bal gezdirin.',
        'Tarçın serpin ve hemen servis edin.',
      ],
    },
  },
  {
    en: 'High-Protein Oatmeal',
    tr: 'Yüksek Proteinli Yulaf Lapası',
    protein: 28,
    calories: 380,
    prepTime: '8 dk / 8 min',
    ingredients: {
      en: ['1/2 cup rolled oats', '1 scoop protein powder', '1 tbsp peanut butter', '1 banana', '200ml milk'],
      tr: ['1/2 bardak yulaf', '1 ölçek protein tozu', '1 yemek kaşığı fıstık ezmesi', '1 muz', '200ml süt'],
    },
    steps: {
      en: [
        'Cook oats in milk over medium heat 4-5 min, stirring.',
        'Remove from heat and stir in protein powder.',
        'Slice banana and place on top with peanut butter.',
        'Serve warm — add a drizzle of honey if desired.',
      ],
      tr: [
        'Yulafı sütte orta ateşte karıştırarak 4-5 dk pişirin.',
        'Ateşten alın ve protein tozunu karıştırın.',
        'Muzu dilimleyin, fıstık ezmesiyle üstüne koyun.',
        'Sıcak servis edin — istersen biraz bal ekleyin.',
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
  {
    en: 'Chicken & Lentil Soup',
    tr: 'Tavuklu Mercimek Çorbası',
    protein: 36,
    calories: 410,
    prepTime: '20 dk / 20 min',
    ingredients: {
      en: ['120g cooked chicken breast, shredded', '1/2 cup green lentils', '1 carrot', '1 celery stalk', 'vegetable broth, turmeric'],
      tr: ['120g pişmiş tavuk göğsü, didilmiş', '1/2 bardak yeşil mercimek', '1 havuç', '1 kereviz sapı', 'sebze suyu, zerdeçal'],
    },
    steps: {
      en: [
        'Dice carrot and celery; sauté in olive oil 3 min.',
        'Add rinsed lentils, broth, and turmeric; bring to a boil.',
        'Simmer 15 min until lentils are soft.',
        'Stir in shredded chicken, season, and serve hot.',
      ],
      tr: [
        'Havuç ve kerevizi küp doğrayın; zeytinyağında 3 dk soteleyin.',
        'Yıkanmış mercimek, sebze suyu ve zerdeçalı ekleyin; kaynatın.',
        'Mercimek yumuşayana kadar 15 dk kısık ateşte pişirin.',
        'Didilmiş tavuğu ekleyin, baharatlayın ve sıcak servis edin.',
      ],
    },
  },
  {
    en: 'Beef Taco Bowl',
    tr: 'Dana Taco Kasesi',
    protein: 40,
    calories: 450,
    prepTime: '15 dk / 15 min',
    ingredients: {
      en: ['150g lean ground beef', '1/2 cup black beans', '1/2 cup brown rice (cooked)', 'salsa, lime', 'cumin, paprika'],
      tr: ['150g yağsız kıyma dana', '1/2 bardak siyah fasulye', '1/2 bardak esmer pirinç (pişmiş)', 'salsa, misket limonu', 'kimyon, paprika'],
    },
    steps: {
      en: [
        'Brown ground beef with cumin and paprika 5-6 min.',
        'Add black beans; warm through 2 min.',
        'Assemble bowl: rice base, beef and beans, salsa on top.',
        'Squeeze lime juice and serve.',
      ],
      tr: [
        'Kıymayı kimyon ve paprikayla 5-6 dk pişirin.',
        'Siyah fasulyeleri ekleyin; 2 dk ısıtın.',
        'Kaseyi hazırlayın: pirinç tabanı, dana ve fasulye, üstüne salsa.',
        'Misket limonu sıkın ve servis edin.',
      ],
    },
  },
  {
    en: 'Sardine & Avocado Bowl',
    tr: 'Sardalya & Avokado Kasesi',
    protein: 32,
    calories: 390,
    prepTime: '5 dk / 5 min',
    ingredients: {
      en: ['1 can sardines in olive oil (120g)', '1/2 avocado', '1/2 cup cherry tomatoes', 'cucumber, lemon', 'whole grain crackers'],
      tr: ['1 kutu zeytinyağlı sardalya (120g)', '1/2 avokado', '1/2 bardak cherry domates', 'salatalık, limon', 'tam buğday kraker'],
    },
    steps: {
      en: [
        'Drain sardines and place in a bowl.',
        'Slice avocado, halve tomatoes, and dice cucumber.',
        'Arrange everything in a bowl; squeeze lemon juice over.',
        'Serve with whole grain crackers on the side.',
      ],
      tr: [
        'Sardalyaları süzün ve kaseye koyun.',
        'Avokadoyu dilimleyin, domatesleri ikiye bölün, salatalığı küp kesin.',
        'Her şeyi kasede düzenleyin; üzerine limon sıkın.',
        'Tam buğday krakerlerle servis edin.',
      ],
    },
  },
  {
    en: 'Tofu & Vegetable Bowl',
    tr: 'Tofu & Sebze Kasesi',
    protein: 28,
    calories: 370,
    prepTime: '15 dk / 15 min',
    ingredients: {
      en: ['200g firm tofu, cubed', '1 cup edamame', '1/2 cup quinoa (cooked)', '2 tbsp soy sauce', 'sesame seeds, ginger'],
      tr: ['200g sert tofu, küp kesilmiş', '1 bardak edamame', '1/2 bardak kinoa (pişmiş)', '2 yemek kaşığı soya sosu', 'susam, zencefil'],
    },
    steps: {
      en: [
        'Press tofu dry; pan-fry in sesame oil until golden, 8 min.',
        'Add soy sauce and ginger; toss to coat.',
        'Assemble bowl: quinoa base, tofu, edamame.',
        'Sprinkle sesame seeds and serve.',
      ],
      tr: [
        'Tofuyu kurulayın; susam yağında 8 dk altın rengi olana kadar pişirin.',
        'Soya sosu ve zencefil ekleyin; kaplayacak şekilde karıştırın.',
        'Kaseyi hazırlayın: kinoa tabanı, tofu, edamame.',
        'Susam serpin ve servis edin.',
      ],
    },
  },
  {
    en: 'Chicken Caesar Wrap',
    tr: 'Tavuk Caesar Dürümü',
    protein: 38,
    calories: 440,
    prepTime: '10 dk / 10 min',
    ingredients: {
      en: ['130g grilled chicken breast', '1 whole wheat tortilla', '2 tbsp light Caesar dressing', '2 leaves romaine', '15g parmesan'],
      tr: ['130g ızgara tavuk göğsü', '1 tam buğday tortilla', '2 yemek kaşığı light Caesar sos', '2 yaprak marul', '15g parmesan'],
    },
    steps: {
      en: [
        'Slice grilled chicken into strips.',
        'Spread Caesar dressing on tortilla.',
        'Layer romaine, chicken strips, and parmesan.',
        'Roll tightly, slice diagonally, and serve.',
      ],
      tr: [
        'Izgara tavuğu şeritler halinde dilimleyin.',
        'Tortillaya Caesar sos sürün.',
        'Marul, tavuk şeritleri ve parmesanı üstüne koyun.',
        'Sıkıca sarın, çapraz kesin ve servis edin.',
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
  {
    en: 'Lemon Herb Chicken Thighs',
    tr: 'Limonlu Otlu Tavuk Budu',
    protein: 44,
    calories: 480,
    prepTime: '10 dk / 30 min',
    ingredients: {
      en: ['250g chicken thighs (skinless)', 'juice of 1 lemon', '3 garlic cloves', 'fresh rosemary, thyme', '2 tbsp olive oil'],
      tr: ['250g tavuk budu (derisiz)', '1 limon suyu', '3 diş sarımsak', 'taze biberiye, kekik', '2 yemek kaşığı zeytinyağı'],
    },
    steps: {
      en: [
        'Mix lemon juice, garlic, rosemary, thyme, and olive oil.',
        'Marinate chicken 10 min in the mixture.',
        'Bake at 200°C for 25-28 min until golden and cooked through.',
        'Serve with steamed vegetables or a side salad.',
      ],
      tr: [
        'Limon suyu, sarımsak, biberiye, kekik ve zeytinyağını karıştırın.',
        'Tavuğu 10 dk bu karışımda marine edin.',
        '200°C\'de 25-28 dk altın renginde pişirin.',
        'Buharda sebzeler veya yan salata ile servis edin.',
      ],
    },
  },
  {
    en: 'Salmon Poke Bowl',
    tr: 'Somon Poke Kasesi',
    protein: 42,
    calories: 490,
    prepTime: '10 dk / 10 min',
    ingredients: {
      en: ['180g fresh salmon, cubed', '1/2 cup brown rice (cooked)', '1/2 avocado', '1/4 cucumber', '2 tbsp soy sauce, sesame oil'],
      tr: ['180g taze somon, küp kesilmiş', '1/2 bardak esmer pirinç (pişmiş)', '1/2 avokado', '1/4 salatalık', '2 yemek kaşığı soya sosu, susam yağı'],
    },
    steps: {
      en: [
        'Marinate salmon cubes in soy sauce and sesame oil 5 min.',
        'Slice avocado and cucumber.',
        'Assemble bowl: rice base, salmon, avocado, cucumber.',
        'Drizzle extra sauce on top and sprinkle sesame seeds.',
      ],
      tr: [
        'Somon küplerini soya sosu ve susam yağında 5 dk marine edin.',
        'Avokado ve salatalığı dilimleyin.',
        'Kaseyi hazırlayın: pirinç tabanı, somon, avokado, salatalık.',
        'Üstüne sos gezdirin ve susam serpin.',
      ],
    },
  },
  {
    en: 'White Bean & Vegetable Soup',
    tr: 'Beyaz Fasulye & Sebze Çorbası',
    protein: 36,
    calories: 420,
    prepTime: '10 dk / 25 min',
    ingredients: {
      en: ['200g canned white beans', '100g chicken breast, diced', '1 zucchini', '2 tomatoes', 'garlic, Italian herbs'],
      tr: ['200g konserve beyaz fasulye', '100g tavuk göğsü, küp kesilmiş', '1 kabak', '2 domates', 'sarımsak, İtalyan otları'],
    },
    steps: {
      en: [
        'Sauté garlic and diced chicken in olive oil 4 min.',
        'Add diced zucchini, tomatoes, and herbs; cook 3 min.',
        'Add white beans and 400ml water; simmer 15 min.',
        'Season and serve hot with whole grain bread.',
      ],
      tr: [
        'Sarımsak ve tavuk küplerini zeytinyağında 4 dk soteleyin.',
        'Küp kabak, domates ve otları ekleyin; 3 dk pişirin.',
        'Beyaz fasulye ve 400ml su ekleyin; 15 dk pişirin.',
        'Baharatlayın ve tam buğday ekmeğiyle sıcak servis edin.',
      ],
    },
  },
  {
    en: 'Teriyaki Chicken & Rice',
    tr: 'Teriyaki Tavuk & Pirinç',
    protein: 46,
    calories: 510,
    prepTime: '10 dk / 20 min',
    ingredients: {
      en: ['200g chicken breast', '3/4 cup white rice (cooked)', '3 tbsp teriyaki sauce', '1 cup broccoli', 'sesame seeds'],
      tr: ['200g tavuk göğsü', '3/4 bardak beyaz pirinç (pişmiş)', '3 yemek kaşığı teriyaki sosu', '1 bardak brokoli', 'susam'],
    },
    steps: {
      en: [
        'Slice chicken into strips; cook in a pan 5-6 min per side.',
        'Add teriyaki sauce; simmer 2 min until glazed.',
        'Steam broccoli 4 min until tender-crisp.',
        'Serve chicken and broccoli over rice; sprinkle sesame seeds.',
      ],
      tr: [
        'Tavuğu şeritler halinde kesin; tavada her yüzü 5-6 dk pişirin.',
        'Teriyaki sosu ekleyin; 2 dk sosa bulayarak pişirin.',
        'Brokoliyi 4 dk buharda pişirin.',
        'Tavuk ve brokoliyi pirinç üzerinde servis edin; susam serpin.',
      ],
    },
  },
  {
    en: 'Egg & Spinach Frittata',
    tr: 'Yumurta & Ispanak Frittata',
    protein: 38,
    calories: 400,
    prepTime: '5 dk / 20 min',
    ingredients: {
      en: ['5 whole eggs', '100g baby spinach', '50g feta cheese', '1 small onion', '1 tbsp olive oil'],
      tr: ['5 bütün yumurta', '100g bebek ıspanak', '50g beyaz peynir', '1 küçük soğan', '1 yemek kaşığı zeytinyağı'],
    },
    steps: {
      en: [
        'Preheat oven to 180°C. Sauté onion in oven-safe pan 3 min.',
        'Add spinach; wilt 1-2 min.',
        'Pour in whisked eggs; crumble feta on top.',
        'Bake 12-15 min until set. Slice and serve.',
      ],
      tr: [
        'Fırını 180°C\'ye ısıtın. Soğanı fırına girebilir tavada 3 dk soteleyin.',
        'Ispanağı ekleyin; 1-2 dk soldur.',
        'Çırpılmış yumurtaları dökün; üstüne beyaz peynir ufalayın.',
        '12-15 dk pişirin. Dilimleyin ve servis edin.',
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
  {
    en: 'Smoked Turkey Roll-Ups',
    tr: 'Füme Hindi Rulo',
    protein: 18,
    calories: 140,
    prepTime: '3 dk / 3 min',
    ingredients: {
      en: ['6 slices smoked turkey breast', '3 tbsp cream cheese', '6 cucumber spears'],
      tr: ['6 dilim füme hindi göğsü', '3 yemek kaşığı krem peynir', '6 salatalık çubuğu'],
    },
    steps: {
      en: [
        'Lay turkey slices flat on a board.',
        'Spread a thin layer of cream cheese on each.',
        'Place a cucumber spear at one end and roll up tightly.',
        'Serve immediately or refrigerate up to 2 hours.',
      ],
      tr: [
        'Hindi dilimlerini düz yüzeye koyun.',
        'Her birine ince bir tabaka krem peynir sürün.',
        'Bir ucuna salatalık çubuğu koyun ve sıkıca sarın.',
        'Hemen servis edin veya 2 saate kadar buzdolabında saklayın.',
      ],
    },
  },
  {
    en: 'Peanut Butter & Banana',
    tr: 'Fıstık Ezmesi & Muz',
    protein: 12,
    calories: 200,
    prepTime: '2 dk / 2 min',
    ingredients: {
      en: ['1 medium banana', '2 tbsp natural peanut butter', 'pinch of cinnamon'],
      tr: ['1 orta boy muz', '2 yemek kaşığı doğal fıstık ezmesi', 'bir tutam tarçın'],
    },
    steps: {
      en: [
        'Peel and slice banana into rounds.',
        'Serve with peanut butter for dipping.',
        'Sprinkle cinnamon on top.',
        'Great pre- or post-workout snack.',
      ],
      tr: [
        'Muzu soyun ve dilimleyin.',
        'Fıstık ezmesiyle birlikte servis edin.',
        'Üstüne tarçın serpin.',
        'Antrenman öncesi veya sonrası için mükemmel atıştırmalık.',
      ],
    },
  },
  {
    en: 'Roasted Chickpeas',
    tr: 'Kavrulmuş Nohut',
    protein: 15,
    calories: 180,
    prepTime: '5 dk / 25 min',
    ingredients: {
      en: ['200g canned chickpeas, drained', '1 tbsp olive oil', '1 tsp paprika', '1/2 tsp cumin', 'salt'],
      tr: ['200g konserve nohut, süzülmüş', '1 yemek kaşığı zeytinyağı', '1 tsp paprika', '1/2 tsp kimyon', 'tuz'],
    },
    steps: {
      en: [
        'Preheat oven to 200°C. Dry chickpeas thoroughly with a towel.',
        'Toss with olive oil, paprika, cumin, and salt.',
        'Spread on a baking tray; roast 20-25 min until crispy.',
        'Cool 5 min before eating — they crisp up more as they cool.',
      ],
      tr: [
        'Fırını 200°C\'ye ısıtın. Nohutu havluyla iyice kurulayın.',
        'Zeytinyağı, paprika, kimyon ve tuzla karıştırın.',
        'Fırın tepsisine yayın; 20-25 dk çıtır çıtır olana kadar pişirin.',
        'Yemeden önce 5 dk soğutun — soğudukça daha çıtır olur.',
      ],
    },
  },
  {
    en: 'Whey Protein Shake',
    tr: 'Whey Protein Shake',
    protein: 25,
    calories: 190,
    prepTime: '2 dk / 2 min',
    ingredients: {
      en: ['1 scoop whey protein powder', '200ml cold milk or almond milk', '1 tbsp cocoa powder (optional)', 'ice cubes'],
      tr: ['1 ölçek whey protein tozu', '200ml soğuk süt veya badem sütü', '1 yemek kaşığı kakao tozu (isteğe bağlı)', 'buz küpleri'],
    },
    steps: {
      en: [
        'Add protein powder, milk, and cocoa to a blender.',
        'Add a few ice cubes.',
        'Blend 20-30 seconds until smooth.',
        'Drink immediately post-workout for best results.',
      ],
      tr: [
        'Protein tozu, süt ve kakaoyu blendere ekleyin.',
        'Birkaç buz küpü ekleyin.',
        'Pürüzsüz olana kadar 20-30 saniye blendırın.',
        'En iyi sonuç için antrenman sonrası hemen için.',
      ],
    },
  },
  {
    en: 'Mixed Nuts & Dark Chocolate',
    tr: 'Karışık Kuruyemiş & Bitter Çikolata',
    protein: 10,
    calories: 210,
    prepTime: '1 dk / 1 min',
    ingredients: {
      en: ['25g mixed nuts (almonds, walnuts, cashews)', '15g dark chocolate (70%+)', 'optional: dried cranberries'],
      tr: ['25g karışık kuruyemiş (badem, ceviz, kaju)', '15g bitter çikolata (70%+)', 'isteğe bağlı: kurutulmuş kızılcık'],
    },
    steps: {
      en: [
        'Portion out nuts into a small bowl.',
        'Break dark chocolate into small pieces and add.',
        'Mix with dried cranberries if desired.',
        'A perfect balance of protein, healthy fats, and antioxidants.',
      ],
      tr: [
        'Kuruyemişleri küçük bir kaseye koyun.',
        'Bitter çikolatayı küçük parçalara kırın ve ekleyin.',
        'İsterseniz kurutulmuş kızılcık da ekleyin.',
        'Protein, sağlıklı yağ ve antioksidan dengesi mükemmel.',
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
  const isTr = language === 'tr';
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadow), [colors, shadow]);

  const [activeDay, setActiveDay] = useState(0);
  const [proteinTarget, setProteinTarget] = useState(120);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [ingredientInput, setIngredientInput] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeals, setAiMeals] = useState(null);
  const [planVariant, setPlanVariant] = useState(0);


  useEffect(() => {
    // Everything is unlocked — load the user's protein target for all users.
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

  const userIngredients = ingredientInput
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  function mealMatchesIngredients(meal) {
    if (!filterMode || userIngredients.length === 0) return true;
    const allIngredients = [
      ...meal.ingredients.en.map((i) => i.toLowerCase()),
      ...meal.ingredients.tr.map((i) => i.toLowerCase()),
    ].join(' ');
    return userIngredients.some((ing) => allIngredients.includes(ing));
  }

  function getBestMealForDay(mealArray, dayIndex) {
    if (!filterMode || userIngredients.length === 0) {
      return getMealForDay(mealArray, dayIndex);
    }
    const matching = mealArray.filter(mealMatchesIngredients);
    if (matching.length === 0) return getMealForDay(mealArray, dayIndex);
    return matching[dayIndex % matching.length];
  }

  // OFFLINE fallback (report A1): when the AI proxy is not configured or the
  // request fails, build a 4-meal plan from the LOCAL meal database, preferring
  // entries that actually contain the user's ingredients. This is real, curated
  // data — never fabricated "AI" content.
  function buildOfflineMeals() {
    const pick = (arr) => {
      const matching = arr.filter(mealMatchesIngredients);
      const source = matching.length > 0 ? matching : arr;
      return source[(activeDay + planVariant) % source.length];
    };
    return [
      { type: 'breakfast', ...pick(BREAKFASTS) },
      { type: 'lunch', ...pick(LUNCHES) },
      { type: 'dinner', ...pick(DINNERS) },
      { type: 'snack', ...pick(SNACKS) },
    ].map((m) => ({
      type: m.type,
      name: isTr ? m.tr : m.en,
      protein: m.protein,
      calories: m.calories,
      prepTime: m.prepTime,
      ingredients: isTr ? m.ingredients.tr : m.ingredients.en,
      steps: isTr ? m.steps.tr : m.steps.en,
    }));
  }

  async function generateAIRecipes() {
    if (!ingredientInput.trim()) return;
    setAiLoading(true);
    setAiMeals(null);

    // No proxy configured → go straight to the curated offline plan.
    if (!isAIConfigured()) {
      setAiMeals(buildOfflineMeals());
      setAiLoading(false);
      Alert.alert(
        isTr ? 'Çevrimdışı Mod' : 'Offline Mode',
        isTr
          ? 'AI servisi şu an kullanılamıyor. Malzemelerine göre kayıtlı tariflerden bir plan hazırlandı.'
          : 'The AI service is unavailable right now. We built a plan from our saved recipes matching your ingredients.'
      );
      return;
    }

    try {
      // Sanitize user text (report C5: prompt-injection) — strip control chars,
      // collapse whitespace, and cap length before embedding in the prompt.
      const safeIngredients = ingredientInput
        .replace(/[ -]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);

      const prompt = isTr
        ? `Elimdeki malzemeler: ${safeIngredients}.\n\nBu malzemeleri kullanarak kas kütlesini korumaya çalışan, protein takibi yapan biri için yüksek proteinli 4 tarif öner (1 kahvaltı, 1 öğle, 1 akşam, 1 atıştırmalık). Her tarif için şu JSON yapısını kullan. Cevabı SADECE JSON olarak ver, başka açıklama yapma:\n{"meals": [{"type":"breakfast","name":"...","protein":0,"calories":0,"prepTime":"10 dk","ingredients":["..."],"steps":["..."]},{"type":"lunch",...},{"type":"dinner",...},{"type":"snack",...}]}`
        : `My available ingredients: ${safeIngredients}.\n\nSuggest 4 high-protein recipes (1 breakfast, 1 lunch, 1 dinner, 1 snack) for someone focused on muscle preservation and protein tracking. Use ONLY this JSON format, no extra text:\n{"meals": [{"type":"breakfast","name":"...","protein":0,"calories":0,"prepTime":"10 min","ingredients":["..."],"steps":["..."]},{"type":"lunch",...},{"type":"dinner",...},{"type":"snack",...}]}`;

      // Route through the AI proxy (report A1). The OpenAI key lives server-side;
      // this never touches a client-side credential.
      const raw = await callAIChat({
        messages: [{ role: 'user', content: prompt }],
        responseFormat: { type: 'json_object' },
        maxTokens: 1200,
      });
      if (!raw) throw new Error('No response');
      const parsed = JSON.parse(raw);
      const rawMeals = Array.isArray(parsed?.meals)
        ? parsed.meals
        : Array.isArray(parsed)
          ? parsed
          : [];
      // Keep ONLY well-formed meal objects and coerce every field. A malformed AI
      // response (a null/string element, missing arrays, string numbers) used to
      // crash the render at `aiMeals.find(m => m.type)` — "Cannot read property
      // 'type' of null". Sanitizing here makes the screen crash-proof.
      const meals = rawMeals
        .filter((m) => m && typeof m === 'object')
        .map((m) => ({
          type: String(m.type || '').toLowerCase(),
          name: String(m.name || ''),
          protein: Number(m.protein) || 0,
          calories: Number(m.calories) || 0,
          prepTime: m.prepTime ? String(m.prepTime) : '—',
          ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
          steps: Array.isArray(m.steps) ? m.steps : [],
        }));
      if (meals.length === 0) throw new Error('Invalid format');
      setAiMeals(meals);
    } catch (e) {
      // Graceful fallback: on any AI failure (proxy unavailable / network /
      // bad shape) fall back to the curated local plan instead of an error wall.
      setAiMeals(buildOfflineMeals());
      Alert.alert(
        isTr ? 'Çevrimdışı Mod' : 'Offline Mode',
        isTr
          ? 'AI tarifleri alınamadı. Malzemelerine göre kayıtlı tariflerden bir plan gösteriliyor.'
          : 'Could not reach AI recipes. Showing a plan from our saved recipes matching your ingredients.'
      );
    } finally {
      setAiLoading(false);
    }
  }

  // 5 plan variants per day: shift by planVariant offset
  const dayMeals = {
    breakfast: getBestMealForDay(BREAKFASTS, activeDay + planVariant),
    lunch: getBestMealForDay(LUNCHES, activeDay + planVariant),
    dinner: getBestMealForDay(DINNERS, activeDay + planVariant),
    snack: getBestMealForDay(SNACKS, activeDay + planVariant),
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

  function openMealModal(mealKey, meal, isAI = false) {
    const labels = {
      breakfast: { en: 'Breakfast', tr: 'Kahvaltı' },
      lunch: { en: 'Lunch', tr: 'Öğle' },
      dinner: { en: 'Dinner', tr: 'Akşam' },
      snack: { en: 'Snack', tr: 'Atıştırma' },
    };
    const emojis = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
    if (isAI) {
      setSelectedMeal({
        en: meal.name, tr: meal.name,
        mealType: labels[mealKey], emoji: emojis[mealKey],
        protein: meal.protein, calories: meal.calories,
        prepTime: meal.prepTime || '—',
        ingredients: {
          en: Array.isArray(meal.ingredients) ? meal.ingredients : [],
          tr: Array.isArray(meal.ingredients) ? meal.ingredients : [],
        },
        steps: {
          en: Array.isArray(meal.steps) ? meal.steps : [],
          tr: Array.isArray(meal.steps) ? meal.steps : [],
        },
        isAI: true,
      });
    } else {
      setSelectedMeal({ ...meal, mealType: labels[mealKey], emoji: emojis[mealKey] });
    }
    setModalVisible(true);
  }

  function renderMealCard(mealKey, meal, isAI = false) {
    const labels = { breakfast: t('breakfast'), lunch: t('lunch'), dinner: t('dinner'), snack: t('snack') };
    const emojis = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
    const mealName = isAI ? meal.name : (isTr ? meal.tr : meal.en);
    const mealIngredients = isAI
      ? (Array.isArray(meal.ingredients) ? meal.ingredients : []).join(', ')
      : (isTr ? meal.ingredients.tr : meal.ingredients.en).join(', ');

    return (
      <TouchableOpacity
        key={mealKey}
        style={styles.mealCard}
        onPress={() => openMealModal(mealKey, meal, isAI)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          isTr
            ? `${labels[mealKey]}: ${mealName}, ${meal.protein} gram protein, ${meal.calories} kalori. Tarif için dokun`
            : `${labels[mealKey]}: ${mealName}, ${meal.protein} grams protein, ${meal.calories} calories. Tap for recipe`
        }
      >
        <View style={styles.mealHeader}>
          <Text style={styles.mealEmoji}>{emojis[mealKey]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.mealType}>{labels[mealKey]}{isAI ? '  🤖' : ''}</Text>
            <Text style={styles.mealName}>{mealName}</Text>
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
          <Text style={styles.mealIngredients} numberOfLines={2}>{mealIngredients}</Text>
        </View>
        <View style={styles.tapHintRow}>
          <Text style={styles.tapHintText}>
            {isTr ? 'Tarif için dokun →' : 'Tap for recipe →'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Build the ordered meal list once so it can drive a virtualized FlatList
  // (report P2: no list virtualization). Each entry resolves to AI data when
  // available, otherwise the curated static plan.
  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealList = MEAL_ORDER.map((type) => {
    if (aiMeals) {
      const aiMeal =
        aiMeals.find((m) => m && m.type === type) || aiMeals[MEAL_ORDER.indexOf(type)];
      if (aiMeal) return { key: type, type, meal: aiMeal, isAI: true };
    }
    return { key: type, type, meal: dayMeals[type], isAI: false };
  });

  const ListHeader = (
    <>
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
          <Text style={[styles.dailyTotalValue, { color: dailyProtein >= proteinTarget ? colors.success : colors.warning }]}>
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
                backgroundColor: dailyProtein >= proteinTarget ? colors.success : colors.primary,
              },
            ]}
          />
        </View>
        <Text style={styles.proteinBarLabel}>
          {dailyProtein}g / {proteinTarget}g {t('protein')}
        </Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>{t('dietPlans')}</Text>
        <View style={styles.proteinTargetBadge}>
          <Text style={styles.proteinTargetText}>🎯 {proteinTarget}g {t('perDay')}</Text>
        </View>
      </View>

      {/* Ingredient Filter + AI */}
      <View style={styles.ingredientSection}>
        <View style={styles.ingredientRow}>
          <TextInput
            style={styles.ingredientInput}
            placeholder={isTr ? '🛒 Elindeki malzemeleri yaz (virgülle ayır)...' : '🛒 Type your ingredients (comma separated)...'}
            placeholderTextColor={colors.outline}
            value={ingredientInput}
            onChangeText={(v) => { setIngredientInput(v); setAiMeals(null); }}
            returnKeyType="done"
          />
          {ingredientInput.trim().length > 0 && (
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => { setFilterMode(false); setIngredientInput(''); setAiMeals(null); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Malzemeleri temizle' : 'Clear ingredients'}
            >
              <Text style={styles.filterBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {ingredientInput.trim().length > 0 && (
          <TouchableOpacity
            style={[styles.aiSuggestBtn, aiLoading && { opacity: 0.6 }]}
            onPress={generateAIRecipes}
            disabled={aiLoading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: aiLoading, busy: aiLoading }}
            accessibilityLabel={
              isTr ? 'AI ile kişisel tarif oluştur' : 'Generate AI recipes for me'
            }
          >
            {aiLoading
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.aiSuggestBtnText}>
                  🤖 {isTr ? 'AI ile Kişisel Tarif Oluştur' : 'Generate AI Recipes for Me'}
                </Text>
            }
          </TouchableOpacity>
        )}
        {aiMeals && (
          <Text style={styles.filterInfo}>
            {isTr ? '✅ AI tarafından oluşturulan kişisel tarifler gösteriliyor' : '✅ Showing AI-generated personalized recipes'}
          </Text>
        )}
      </View>

      {/* Day filter chips */}
      <View style={styles.dayTabsRow}>
        {dayLabels.map((day, index) => (
          <Chip
            key={index}
            label={day}
            selected={activeDay === index}
            onPress={() => setActiveDay(index)}
            style={styles.dayChip}
          />
        ))}
      </View>

      {/* Plan variant selector */}
      {!aiMeals && (
        <View style={styles.planVariantRow}>
          <Text style={styles.planVariantLabel}>
            {isTr ? 'Plan:' : 'Plan:'}
          </Text>
          {[0, 1, 2, 3, 4].map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.planVariantBtn, planVariant === v && styles.planVariantBtnActive]}
              onPress={() => setPlanVariant(v)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: planVariant === v }}
              accessibilityLabel={isTr ? `Plan ${v + 1}` : `Plan ${v + 1}`}
            >
              <Text style={[styles.planVariantBtnText, planVariant === v && styles.planVariantBtnTextActive]}>
                {v + 1}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.planVariantHint}>
            {isTr ? '(5 farklı öneri)' : '(5 options)'}
          </Text>
        </View>
      )}

      {/* Meal Cards — virtualized list (AI or curated static plan) */}
      <FlatList
        data={mealList}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => renderMealCard(item.type, item.meal, item.isAI)}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<View style={{ height: 32 }} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

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
                    accessibilityRole="button"
                    accessibilityLabel={isTr ? 'Kapat' : 'Close'}
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
                    <View style={[styles.pill, { backgroundColor: colors.infoBg }]}>
                      <Text style={[styles.pillText, { color: colors.primary }]}>
                        💪 {selectedMeal.protein}g {isTr ? 'protein' : 'protein'}
                      </Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: colors.warningBg }]}>
                      <Text style={[styles.pillText, { color: colors.warning }]}>
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

                  {/* Citations */}
                  <View style={styles.citationBox}>
                    <Text style={styles.citationTitle}>
                      {isTr ? '📚 Kaynaklar' : '📚 Sources'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6566799/')}
                      accessibilityRole="link"
                      accessibilityLabel={isTr ? 'Kaynak: Stokes ve ark. (2018), NCBI — bağlantıyı aç' : 'Source: Stokes et al. (2018), NCBI — open link'}
                    >
                      <Text style={styles.citationLink}>
                        • Stokes et al. (2018) — Protein for muscle preservation during weight loss. NCBI →
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Linking.openURL('https://www.dietaryguidelines.gov')}
                      accessibilityRole="link"
                      accessibilityLabel={isTr ? 'Kaynak: USDA Beslenme Kılavuzu — bağlantıyı aç' : 'Source: USDA Dietary Guidelines — open link'}
                    >
                      <Text style={styles.citationLink}>
                        • USDA Dietary Guidelines for Americans →
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Linking.openURL('https://www.who.int/news-room/fact-sheets/detail/healthy-diet')}
                      accessibilityRole="link"
                      accessibilityLabel={isTr ? 'Kaynak: WHO Sağlıklı Beslenme Kılavuzu — bağlantıyı aç' : 'Source: WHO Healthy Diet Guidelines — open link'}
                    >
                      <Text style={styles.citationLink}>
                        • WHO Healthy Diet Guidelines →
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Nutrition summary */}
                  <View style={styles.nutritionSummary}>
                    <Text style={styles.nutritionSummaryTitle}>
                      {isTr ? '📊 Besin Özeti' : '📊 Nutrition Summary'}
                    </Text>
                    <View style={styles.nutritionRow}>
                      <View style={styles.nutritionItem}>
                        <Text style={[styles.nutritionValue, { color: colors.primary }]}>
                          {selectedMeal.protein}g
                        </Text>
                        <Text style={styles.nutritionLabel}>{isTr ? 'Protein' : 'Protein'}</Text>
                      </View>
                      <View style={styles.nutritionDivider} />
                      <View style={styles.nutritionItem}>
                        <Text style={[styles.nutritionValue, { color: colors.warning }]}>
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
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors, shadow) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.containerMargin,
    paddingTop: spacing.gutter,
    paddingBottom: 12,
  },
  heading: { ...typography.headlineMd, color: colors.onSurface },
  proteinTargetBadge: {
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  proteinTargetText: { fontSize: 13, fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.primary },
  ingredientSection: {
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: spacing.stackSm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingredientInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: fontFamily.body,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  filterBtn: {
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterBtnActive: { backgroundColor: colors.danger },
  filterBtnText: { fontSize: 13, fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.primary },
  filterBtnTextActive: { color: colors.white },
  filterInfo: {
    fontSize: 12,
    color: colors.success,
    marginTop: 6,
    fontFamily: fontFamily.bodyMedium,
    fontWeight: '500',
  },
  dayTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: 12,
    gap: 6,
  },
  dayChip: { flexGrow: 1 },
  content: { paddingHorizontal: spacing.containerMargin },

  dailyTotalBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.cardPadding,
    flexDirection: 'row',
    marginBottom: 12,
    ...shadow('md'),
  },
  dailyTotalItem: { flex: 1, alignItems: 'center' },
  dailyTotalValue: { fontSize: 22, fontFamily: fontFamily.headingExtraBold, fontWeight: '800', color: colors.onSurface },
  dailyTotalLabel: { fontSize: 12, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, marginTop: 2 },
  dailyTotalDivider: { width: 1, backgroundColor: colors.outlineVariant, marginHorizontal: 8 },

  proteinBarContainer: { marginBottom: 16 },
  proteinBarTrack: {
    height: 8,
    backgroundColor: colors.outlineVariant,
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginBottom: 6,
  },
  proteinBarFill: { height: '100%', borderRadius: radii.sm },
  proteinBarLabel: { fontSize: 12, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, textAlign: 'right' },

  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.cardPadding,
    marginBottom: 12,
    ...shadow('md'),
  },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  mealEmoji: { fontSize: 26, marginRight: 12 },
  mealType: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealName: { fontSize: 16, fontFamily: fontFamily.heading, fontWeight: '700', color: colors.onSurface, marginTop: 2 },
  mealMacros: {
    alignItems: 'center',
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  mealProtein: { fontSize: 20, fontFamily: fontFamily.headingExtraBold, fontWeight: '800', color: colors.primary },
  mealProteinLabel: { fontSize: 11, fontFamily: fontFamily.body, color: colors.primary },
  mealDetails: { flexDirection: 'row', alignItems: 'center' },
  mealStat: { alignItems: 'center', marginRight: 12 },
  mealStatValue: { fontSize: 16, fontFamily: fontFamily.heading, fontWeight: '700', color: colors.onSurface },
  mealStatLabel: { fontSize: 11, fontFamily: fontFamily.body, color: colors.outline },
  mealStatDivider: { width: 1, height: 32, backgroundColor: colors.outlineVariant, marginRight: 12 },
  mealIngredients: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, flex: 1, lineHeight: 18 },
  tapHintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  tapHintText: { fontSize: 12, color: colors.primary, fontFamily: fontFamily.bodySemiBold, fontWeight: '600' },
  planVariantRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.containerMargin, paddingBottom: 10, gap: 6,
  },
  planVariantLabel: { fontSize: 13, fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.onSurface, marginRight: 2 },
  planVariantBtn: {
    width: 32, height: 32, borderRadius: radii.pill,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  planVariantBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planVariantBtnText: { fontSize: 13, fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.onSurfaceVariant },
  planVariantBtnTextActive: { color: colors.white },
  planVariantHint: { fontSize: 11, fontFamily: fontFamily.body, color: colors.outline, marginLeft: 4 },
  aiSuggestBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: 12, alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    ...shadow('sm'),
  },
  aiSuggestBtnText: { color: colors.white, fontFamily: fontFamily.bodyBold, fontWeight: '700', fontSize: 14 },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '88%',
  },
  modalHeader: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.cardPadding,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalEmoji: { fontSize: 30, marginRight: 12 },
  modalMealType: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalMealName: {
    fontSize: 20,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    color: colors.white,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalCloseBtnText: { color: colors.white, fontFamily: fontFamily.bodyBold, fontWeight: '700', fontSize: 14 },
  modalBody: { paddingHorizontal: spacing.cardPadding, paddingTop: 16 },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 13, fontFamily: fontFamily.bodySemiBold, fontWeight: '600', color: colors.onSurfaceVariant },

  modalSectionTitle: {
    fontSize: 15,
    fontFamily: fontFamily.heading,
    fontWeight: '700',
    color: colors.onSurface,
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
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 10,
    flexShrink: 0,
  },
  ingredientText: { fontSize: 14, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 20, flex: 1 },

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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  stepNumberText: { color: colors.white, fontFamily: fontFamily.bodyBold, fontWeight: '700', fontSize: 13 },
  stepText: { fontSize: 14, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 20, flex: 1 },

  citationBox: {
    backgroundColor: colors.successBg, borderRadius: radii.md, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: colors.success,
  },
  citationTitle: { fontSize: 13, fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.success, marginBottom: 8 },
  citationLink: { fontSize: 12, fontFamily: fontFamily.body, color: colors.success, marginBottom: 6, lineHeight: 18 },
  nutritionSummary: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: radii.card,
    padding: spacing.gutter,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  nutritionSummaryTitle: {
    fontSize: 14,
    fontFamily: fontFamily.heading,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 12,
  },
  nutritionRow: { flexDirection: 'row' },
  nutritionItem: { flex: 1, alignItems: 'center' },
  nutritionValue: { fontSize: 26, fontFamily: fontFamily.headingExtraBold, fontWeight: '800' },
  nutritionLabel: { fontSize: 12, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, marginTop: 2 },
  nutritionDivider: { width: 1, backgroundColor: colors.outlineVariant, marginHorizontal: 16 },
  });
