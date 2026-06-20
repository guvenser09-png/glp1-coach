import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts as usePlusJakartaSans,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

enableScreens();

import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { GamificationProvider } from './src/context/GamificationContext';
import { UnitProvider } from './src/context/UnitContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { colors } from './src/theme';

// Max time (ms) to wait on the font gate before rendering anyway. Fail-open: if a
// font is slow or stalls, the app still renders (text falls back to the system
// font) instead of hanging forever on the loading spinner (report F4).
const FONT_GATE_TIMEOUT_MS = 4000;

export default function App() {
  const [jakartaLoaded, jakartaError] = usePlusJakartaSans({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [interLoaded, interError] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Fail-open font gate: if a font errors OR is slow, still render (text falls
  // back to the system font) instead of hanging forever (see FONT_GATE_TIMEOUT_MS).
  const [fontTimeout, setFontTimeout] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setFontTimeout(true), FONT_GATE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  const fontsReady =
    (jakartaLoaded || !!jakartaError) && (interLoaded || !!interError);

  if (!fontsReady && !fontTimeout) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <LanguageProvider>
            <SubscriptionProvider>
              <GamificationProvider>
                <UnitProvider>
                  <StatusBar style="auto" />
                  <AppNavigator />
                </UnitProvider>
              </GamificationProvider>
            </SubscriptionProvider>
          </LanguageProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
