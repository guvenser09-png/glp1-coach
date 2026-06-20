// ErrorBoundary — top-level crash guard (report B4).
// A single uncaught render error anywhere in the tree would otherwise leave the
// user staring at a blank white screen. This class component catches that error
// (componentDidCatch) and shows a friendly, bilingual fallback with a "Try again"
// action that resets the boundary so the app can re-mount and recover.
//
// It lives ABOVE the provider tree, so it cannot rely on React context (e.g.
// useLanguage) — class components can't use hooks anyway. Language is detected
// directly from the device locale, the same heuristic LanguageContext uses
// (Turkey/Turkish -> 'tr', everywhere else -> 'en').
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import * as Localization from 'expo-localization';

import { getTheme, typography, spacing, radii, fontFamily } from '../theme';
import { captureError } from '../services/sentry';

// Detect the device language once, defensively (never let detection itself throw).
function detectIsTr() {
  try {
    const locales = Localization.getLocales?.() || [];
    const tag = locales[0]?.languageTag || Localization.locale || 'en';
    return String(tag).toLowerCase().startsWith('tr');
  } catch (e) {
    return false;
  }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Render the fallback on the next render.
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log so the error is at least visible in dev tooling / device logs.
    console.error('ErrorBoundary caught a render error:', error, info?.componentStack);
    // Report to Sentry (report D2). Fully guarded — a missing or failing Sentry
    // must never break the boundary. / Sentry eksik/başarısız olsa bile sınır bozulmamalı.
    try {
      captureError(error, info);
    } catch (e) {
      // ignore — reporting is best-effort
    }
  }

  handleReset() {
    // Clear the error so children re-mount and the app can recover.
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Resolve colors/shadow for the current device scheme at render time. This
    // is a class component (no hooks), so we read the scheme imperatively; the
    // fallback only renders on error, so it reflects the scheme at that moment.
    const { colors, shadow } = getTheme();
    const styles = makeStyles(colors, shadow);

    const isTr = detectIsTr();
    const title = isTr ? 'Bir şeyler ters gitti' : 'Something went wrong';
    const subtitle = isTr
      ? 'Beklenmeyen bir hata oluştu. Tekrar denemek için aşağıdaki düğmeye dokunun.'
      : 'An unexpected error occurred. Tap the button below to try again.';
    const buttonLabel = isTr ? 'Tekrar dene' : 'Try again';

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.iconText} allowFontScaling={false} accessible={false}>
              !
            </Text>
          </View>

          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={this.handleReset}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const makeStyles = (colors, shadow) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.containerMargin,
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.stackLg,
  },
  iconText: {
    fontFamily: fontFamily.headingExtraBold,
    fontSize: 40,
    lineHeight: 48,
    color: colors.danger,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.stackSm,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.stackLg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.stackMd,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow('md'),
  },
  buttonText: {
    ...typography.labelMd,
    fontFamily: fontFamily.bodyBold,
    color: colors.onPrimary,
  },
  });
