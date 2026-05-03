import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

import en from './en.json';
import tr from './tr.json';

const LANGUAGE_KEY = '@glp1_language';

const translations = { en, tr };

let currentLanguage = 'en';
let listeners = [];

export function t(key) {
  const dict = translations[currentLanguage] || translations.en;
  return dict[key] || key;
}

export async function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLanguage = lang;
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch (e) {
    console.warn('Failed to persist language:', e);
  }
  listeners.forEach((fn) => fn(lang));
}

export async function getLanguage() {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved && translations[saved]) {
      currentLanguage = saved;
      return saved;
    }
  } catch (e) {
    console.warn('Failed to load language:', e);
  }
  return 'en';
}

export function getCurrentLanguage() {
  return currentLanguage;
}

function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function useTranslation() {
  const [lang, setLang] = useState(currentLanguage);

  useEffect(() => {
    const unsub = subscribe((newLang) => setLang(newLang));
    return unsub;
  }, []);

  const translate = useCallback(
    (key) => {
      const dict = translations[lang] || translations.en;
      return dict[key] || key;
    },
    [lang]
  );

  const changeLang = useCallback(async (newLang) => {
    await setLanguage(newLang);
  }, []);

  return { t: translate, language: lang, setLanguage: changeLang };
}
