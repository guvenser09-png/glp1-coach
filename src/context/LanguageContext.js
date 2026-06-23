import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import en from '../i18n/en.json';
import tr from '../i18n/tr.json';

const LANGUAGE_KEY = '@glp1_language';

const translations = { en, tr };

const LanguageContext = createContext({
  t: (key) => key,
  language: 'en',
  setLanguage: async () => {},
});

export function LanguageProvider({ children }) {
  const [language, setLangState] = useState('en');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (saved && translations[saved]) {
          setLangState(saved);
        } else {
          // Auto-detect from device locale — Turkey = Turkish, everywhere else = English
          const locales = Localization.getLocales?.() || [];
          const tag = locales[0]?.languageTag || Localization.locale || 'en';
          const detected = tag.toLowerCase().startsWith('tr') ? 'tr' : 'en';
          setLangState(detected);
        }
      } catch (e) {
        console.warn('LanguageContext: failed to load saved language', e);
      }
    })();
  }, []);

  const t = useCallback(
    (key) => {
      const dict = translations[language] || translations.en;
      return dict[key] || key;
    },
    [language]
  );

  const setLanguage = useCallback(async (lang) => {
    if (!translations[lang]) return;
    setLangState(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    } catch (e) {
      console.warn('LanguageContext: failed to persist language', e);
    }
  }, []);

  const value = useMemo(
    () => ({ t, language, setLanguage }),
    [t, language, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default LanguageContext;
