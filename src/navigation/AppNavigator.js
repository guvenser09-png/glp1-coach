import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DietPlansScreen from '../screens/DietPlansScreen';
import MedicationScreen from '../screens/MedicationScreen';
import SocialScreen from '../screens/SocialScreen';
import HealthLogScreen from '../screens/HealthLogScreen';
import { useLanguage } from '../context/LanguageContext';
import { theme } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.outlineVariant,
          paddingTop: theme.spacing.stackSm,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
          ...theme.shadow('md'),
        },
        tabBarLabelStyle: {
          fontFamily: theme.fontFamily.bodySemiBold,
          fontSize: theme.typography.labelSm.fontSize,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'MealAnalysis') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'WeeklyReport') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
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
        options={{ tabBarLabel: t('dashboard') }}
      />
      <Tab.Screen
        name="MealAnalysis"
        component={MealAnalysisScreen}
        options={{ tabBarLabel: isTr ? 'Günlük Takip' : 'Daily Log' }}
      />
      <Tab.Screen
        name="WeeklyReport"
        component={WeeklyReportScreen}
        options={{ tabBarLabel: t('weeklyReport') }}
      />
      <Tab.Screen
        name="Social"
        component={SocialScreen}
        options={{ tabBarLabel: isTr ? 'Topluluk' : 'Community' }}
      />
      <Tab.Screen
        name="DietPlans"
        component={DietPlansScreen}
        options={{ tabBarLabel: t('dietPlans') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: t('settings') }}
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
    </Stack.Navigator>
  );
}

// ─── Root Navigator ──────────────────────────────────────────────────────────

export default function AppNavigator() {
  const { user, loading } = useAuth();
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  // User logged in but hasn't completed onboarding
  if (!onboardingComplete) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="MainApp" component={MainAppStack} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // User logged in and onboarding done
  return (
    <NavigationContainer>
      <MainAppStack />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
