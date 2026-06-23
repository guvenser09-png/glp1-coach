import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

const UNIT_KEY = 'unit_system';

function detectUnitSystem() {
  try {
    const locales = Localization.getLocales?.() || [];
    const region = locales[0]?.regionCode || '';
    return ['US', 'LR', 'MM'].includes(region) ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

const UnitContext = createContext({
  unitSystem: 'metric',
  setUnitSystem: () => {},
  toDisplayWeight: (kg) => kg,
  toDisplayHeight: (cm) => cm,
  toKg: (val) => val,
  toCm: (val) => val,
  weightUnit: 'kg',
  heightUnit: 'cm',
  formatWeight: (kg) => '',
  formatHeight: (cm) => '',
});

export function UnitProvider({ children }) {
  const [unitSystem, setUnitSystemState] = useState('metric');

  useEffect(() => {
    AsyncStorage.getItem(UNIT_KEY).then(v => {
      setUnitSystemState(v || detectUnitSystem());
    });
  }, []);

  const setUnitSystem = useCallback(async (sys) => {
    setUnitSystemState(sys);
    await AsyncStorage.setItem(UNIT_KEY, sys);
  }, []);

  const isImperial = unitSystem === 'imperial';

  // kg → lbs
  const toDisplayWeight = useCallback((kg) => isImperial ? Math.round(kg * 2.20462 * 10) / 10 : kg, [isImperial]);
  // cm → total inches (for display as ft'in")
  const toDisplayHeight = useCallback((cm) => isImperial ? cm / 2.54 : cm, [isImperial]);
  // lbs → kg
  const toKg = useCallback((lbs) => isImperial ? Math.round(lbs / 2.20462 * 10) / 10 : lbs, [isImperial]);
  // inches → cm
  const toCm = useCallback((inches) => isImperial ? Math.round(inches * 2.54) : inches, [isImperial]);

  const weightUnit = isImperial ? 'lbs' : 'kg';
  const heightUnit = isImperial ? 'in' : 'cm';

  const formatWeight = useCallback((kg) => {
    if (!kg && kg !== 0) return '—';
    if (isImperial) return `${toDisplayWeight(kg)} lbs`;
    return `${kg} kg`;
  }, [isImperial, toDisplayWeight]);

  const formatHeight = useCallback((cm) => {
    if (!cm && cm !== 0) return '—';
    if (isImperial) {
      const totalIn = cm / 2.54;
      const ft = Math.floor(totalIn / 12);
      const inches = Math.round(totalIn % 12);
      return `${ft}'${inches}"`;
    }
    return `${cm} cm`;
  }, [isImperial]);

  // Parse weight input string → kg (stored always as kg)
  const parseWeightToKg = useCallback((str) => {
    const val = parseFloat(str.replace(',', '.'));
    if (isNaN(val)) return null;
    return isImperial ? Math.round(val / 2.20462 * 10) / 10 : val;
  }, [isImperial]);

  // Parse height input string → cm (stored always as cm)
  const parseHeightToCm = useCallback((str) => {
    const val = parseFloat(str.replace(',', '.'));
    if (isNaN(val)) return null;
    return isImperial ? Math.round(val * 2.54) : val;
  }, [isImperial]);

  // Validation ranges in display units
  const weightRange = useMemo(() => isImperial ? { min: 66, max: 660 } : { min: 30, max: 300 }, [isImperial]);
  const heightRange = useMemo(() => isImperial ? { min: 39, max: 98 }  : { min: 100, max: 250 }, [isImperial]);

  const weightPlaceholder = useCallback(() => isImperial ? 'e.g. 176' : 'örn. 80', [isImperial]);
  const heightPlaceholder = useCallback(() => isImperial ? 'e.g. 69'  : 'örn. 170', [isImperial]);
  const weightLabel = useCallback((isTr) => isTr ? `Kilo (${weightUnit})` : `Weight (${weightUnit})`, [weightUnit]);
  const heightLabel = useCallback((isTr) => isTr ? `Boy (${heightUnit})`  : `Height (${heightUnit})`, [heightUnit]);

  const value = useMemo(() => ({
    unitSystem, setUnitSystem, isImperial,
    toDisplayWeight, toDisplayHeight, toKg, toCm,
    weightUnit, heightUnit,
    formatWeight, formatHeight,
    parseWeightToKg, parseHeightToCm,
    weightRange, heightRange,
    weightPlaceholder, heightPlaceholder,
    weightLabel, heightLabel,
  }), [
    unitSystem, setUnitSystem, isImperial,
    toDisplayWeight, toDisplayHeight, toKg, toCm,
    weightUnit, heightUnit,
    formatWeight, formatHeight,
    parseWeightToKg, parseHeightToCm,
    weightRange, heightRange,
    weightPlaceholder, heightPlaceholder,
    weightLabel, heightLabel,
  ]);

  return (
    <UnitContext.Provider value={value}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  return useContext(UnitContext);
}
