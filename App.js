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

  // Fail-open: if a font errors OR is slow, still render (text falls back to the
  // system font) instead of hanging forever on the loading spinner. A 4s timeout
  // guarantees the app never gets stuck on the font gate.
  const [fontTimeout, setFontTimeout] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setFontTimeout(true), 4000);
    return () => clearTimeout(id);
  }, []);

  const fontsReady =
    (jakartaLoaded || !!jakartaError) && (interLoaded || !!interError);

  if (!fontsReady && !fontTimeout) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LanguageProvider>
          <SubscriptionProvider>
            <GamificationProvider>
              <UnitProvider>
                <StatusBar style="dark" backgroundColor="#F9FAFB" />
                <AppNavigator />
              </UnitProvider>
            </GamificationProvider>
          </SubscriptionProvider>
        </LanguageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F9FB',
  },
});
