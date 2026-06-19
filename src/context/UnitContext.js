import React, { createContext, useContext, useState, useEffect } from 'react';
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

  const setUnitSystem = async (sys) => {
    setUnitSystemState(sys);
    await AsyncStorage.setItem(UNIT_KEY, sys);
  };

  const isImperial = unitSystem === 'imperial';

  // kg → lbs
  const toDisplayWeight = (kg) => isImperial ? Math.round(kg * 2.20462 * 10) / 10 : kg;
  // cm → total inches (for display as ft'in")
  const toDisplayHeight = (cm) => isImperial ? cm / 2.54 : cm;
  // lbs → kg
  const toKg = (lbs) => isImperial ? Math.round(lbs / 2.20462 * 10) / 10 : lbs;
  // inches → cm
  const toCm = (inches) => isImperial ? Math.round(inches * 2.54) : inches;

  const weightUnit = isImperial ? 'lbs' : 'kg';
  const heightUnit = isImperial ? 'in' : 'cm';

  function formatWeight(kg) {
    if (!kg && kg !== 0) return '—';
    if (isImperial) return `${toDisplayWeight(kg)} lbs`;
    return `${kg} kg`;
  }

  function formatHeight(cm) {
    if (!cm && cm !== 0) return '—';
    if (isImperial) {
      const totalIn = cm / 2.54;
      const ft = Math.floor(totalIn / 12);
      const inches = Math.round(totalIn % 12);
      return `${ft}'${inches}"`;
    }
    return `${cm} cm`;
  }

  // Parse weight input string → kg (stored always as kg)
  function parseWeightToKg(str) {
    const val = parseFloat(str.replace(',', '.'));
    if (isNaN(val)) return null;
    return isImperial ? Math.round(val / 2.20462 * 10) / 10 : val;
  }

  // Parse height input string → cm (stored always as cm)
  function parseHeightToCm(str) {
    const val = parseFloat(str.replace(',', '.'));
    if (isNaN(val)) return null;
    return isImperial ? Math.round(val * 2.54) : val;
  }

  // Validation ranges in display units
  const weightRange = isImperial ? { min: 66, max: 660 } : { min: 30, max: 300 };
  const heightRange = isImperial ? { min: 39, max: 98 }  : { min: 100, max: 250 };

  function weightPlaceholder() { return isImperial ? 'e.g. 176' : 'örn. 80'; }
  function heightPlaceholder() { return isImperial ? 'e.g. 69'  : 'örn. 170'; }
  function weightLabel(isTr)  { return isTr ? `Kilo (${weightUnit})` : `Weight (${weightUnit})`; }
  function heightLabel(isTr)  { return isTr ? `Boy (${heightUnit})`  : `Height (${heightUnit})`; }

  return (
    <UnitContext.Provider value={{
      unitSystem, setUnitSystem, isImperial,
      toDisplayWeight, toDisplayHeight, toKg, toCm,
      weightUnit, heightUnit,
      formatWeight, formatHeight,
      parseWeightToKg, parseHeightToCm,
      weightRange, heightRange,
      weightPlaceholder, heightPlaceholder,
      weightLabel, heightLabel,
    }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  return useContext(UnitContext);
}
