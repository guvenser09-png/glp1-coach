import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme as NavDefaultTheme,
  DarkTheme as NavDarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MealAnalysisScreen from '../screens/MealAnalysisScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DietPlansScreen from '../screens/DietPlansScreen';
import MedicationScreen from '../screens/MedicationScreen';
import SocialScreen from '../screens/SocialScreen';
import HealthLogScreen from '../screens/HealthLogScreen';
import WeightScreen from '../screens/WeightScreen';
import RewardsScreen from '../screens/RewardsScreen';
import { useLanguage } from '../context/LanguageContext';
import { theme, useTheme } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Build a React Navigation theme (used by NavigationContainer) from our tokens,
// so the navigator chrome (backgrounds, borders, text, card) follows the OS scheme.
function buildNavTheme(scheme, t) {
  const isDark = scheme === 'dark';
  const base = isDark ? NavDarkTheme : NavDefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: t.colors.primary,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.colors.onSurface,
      border: t.colors.outlineVariant,
      notification: t.colors.danger,
    },
  };
}

// ─── Auth Stack ─────────────────────────────────────────────────────────────

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}

// ─── Main Tab Navigator ──────────────────────────────────────────────────────

function MainTabs() {
  const { t, language } = useLanguage();
  const isTr = language === 'tr';
  const insets = useSafeAreaInsets();
  const tt = useTheme(); // scheme-aware tokens (colors/shadow follow OS theme)

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: tt.colors.primary,
        tabBarInactiveTintColor: tt.colors.outline,
        tabBarStyle: {
          backgroundColor: tt.colors.surface,
          borderTopWidth: 1,
          borderTopColor: tt.colors.outlineVariant,
          paddingTop: tt.spacing.stackSm,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
          ...tt.shadow('md'),
        },
        tabBarLabelStyle: {
          fontFamily: tt.fontFamily.bodySemiBold,
          fontSize: tt.typography.labelSm.fontSize,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'MealAnalysis') {
            iconName = focused ? 'today' : 'today-outline';
          } else if (route.name === 'Social') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'DietPlans') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: t('dashboard'),
          tabBarAccessibilityLabel: isTr ? 'Ana sayfa sekmesi' : 'Dashboard tab',
        }}
      />
      <Tab.Screen
        name="MealAnalysis"
        component={MealAnalysisScreen}
        options={{
          tabBarLabel: isTr ? 'Günlük' : 'Daily',
          tabBarAccessibilityLabel: isTr ? 'Günlük takip sekmesi' : 'Daily log tab',
        }}
      />
      <Tab.Screen
        name="Social"
        component={SocialScreen}
        options={{
          tabBarLabel: isTr ? 'Topluluk' : 'Community',
          tabBarAccessibilityLabel: isTr ? 'Topluluk sekmesi' : 'Community tab',
        }}
      />
      <Tab.Screen
        name="DietPlans"
        component={DietPlansScreen}
        options={{
          tabBarLabel: t('dietPlans'),
          tabBarAccessibilityLabel: isTr ? 'Diyet planları sekmesi' : 'Diet plans tab',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('settings'),
          tabBarAccessibilityLabel: isTr ? 'Ayarlar sekmesi' : 'Settings tab',
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Main App Stack (tabs + pushed screens like Medication) ──────────────────

function MainAppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Medication" component={MedicationScreen} />
      <Stack.Screen name="HealthLog" component={HealthLogScreen} />
      <Stack.Screen name="Weight" component={WeightScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
    </Stack.Navigator>
  );
}

// ─── Root Navigator ──────────────────────────────────────────────────────────

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const scheme = useColorScheme();
  const tt = useTheme(); // scheme-aware tokens, re-renders on OS theme flip
  const navTheme = buildNavTheme(scheme, tt);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    if (user) {
      (async () => {
        try {
          const flag = await AsyncStorage.getItem(`onboarding_complete_${user.uid}`);
          if (flag === 'true') {
            setOnboardingComplete(true);
          } else {
            // Fallback for returning users who installed before the completion flag was added:
            // if they already have a saved profile with weight/height, skip onboarding
            const profileRaw = await AsyncStorage.getItem(`user_profile_${user.uid}`);
            const profile = profileRaw ? JSON.parse(profileRaw) : null;
            if (profile?.weight && profile?.height) {
              await AsyncStorage.setItem(`onboarding_complete_${user.uid}`, 'true');
              setOnboardingComplete(true);
            } else {
              setOnboardingComplete(false);
            }
          }
        } catch {
          setOnboardingComplete(false);
        } finally {
          setOnboardingChecked(true);
        }
      })();
    } else {
      setOnboardingChecked(false);
      setOnboardingComplete(false);
    }
  }, [user]);

  if (loading || (user && !onboardingChecked)) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: tt.colors.background }]}>
        <ActivityIndicator size="large" color={tt.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <NavigationContainer theme={navTheme}>
        <AuthStack />
      </NavigationContainer>
    );
  }

  // User logged in but hasn't completed onboarding
  if (!onboardingComplete) {
    return (
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="MainApp" component={MainAppStack} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // User logged in and onboarding done
  return (
    <NavigationContainer theme={navTheme}>
      <MainAppStack />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    // backgroundColor applied inline (scheme-aware); fallback token below
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
