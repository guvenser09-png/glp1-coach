// GLP-1 Coach Design System — light theme
// Single source of truth for colors, typography, spacing, radii, and shadows.
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// COLORS
// ---------------------------------------------------------------------------
export const colors = {
  // Brand
  primary: '#4F46E5', // indigo
  primaryLight: '#6366F1',
  primaryDark: '#3730A3',
  accent: '#6366F1',

  // Hero gradient (linear 135deg)
  gradient: {
    start: '#4F46E5',
    end: '#6366F1',
    angle: 135,
  },

  // Surfaces
  background: '#F7F9FB', // off-white app background
  surface: '#FFFFFF', // pure white cards
  surfaceVariant: '#F7F9FB',

  // Text
  onSurface: '#191C1E',
  onSurfaceVariant: '#464555',
  outline: '#777587',
  outlineVariant: '#E5E7EB',
  onPrimary: '#FFFFFF',

  // Semantic
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  info: '#4F46E5',
  infoBg: '#EEF2FF',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Grouped semantic helpers (color + matching background)
export const semantic = {
  success: { fg: colors.success, bg: colors.successBg },
  warning: { fg: colors.warning, bg: colors.warningBg },
  danger: { fg: colors.danger, bg: colors.dangerBg },
  info: { fg: colors.info, bg: colors.infoBg },
};

// ---------------------------------------------------------------------------
// FONT FAMILIES (mapped to @expo-google-fonts loaded names)
// ---------------------------------------------------------------------------
export const fontFamily = {
  // Headings -> Plus Jakarta Sans
  heading: 'PlusJakartaSans_700Bold',
  headingBold: 'PlusJakartaSans_700Bold',
  headingExtraBold: 'PlusJakartaSans_800ExtraBold',
  headingSemiBold: 'PlusJakartaSans_600SemiBold',
  headingMedium: 'PlusJakartaSans_500Medium',
  headingRegular: 'PlusJakartaSans_400Regular',

  // Body / labels -> Inter
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

// ---------------------------------------------------------------------------
// TYPOGRAPHY PRESETS
// ---------------------------------------------------------------------------
export const typography = {
  // Big stat number (e.g. weight / streak)
  displayStat: {
    fontFamily: fontFamily.headingExtraBold,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headlineLg: {
    fontFamily: fontFamily.headingBold,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  headlineMd: {
    fontFamily: fontFamily.headingBold,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: 0,
  },
  bodyLg: {
    fontFamily: fontFamily.body,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bodyMd: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  },
  labelMd: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  labelSm: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
};

// ---------------------------------------------------------------------------
// SPACING
// ---------------------------------------------------------------------------
export const spacing = {
  stackSm: 8,
  gutter: 16,
  stackMd: 16,
  cardPadding: 20,
  containerMargin: 20,
  stackLg: 24,
  // raw scale aliases
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// ---------------------------------------------------------------------------
// RADII
// ---------------------------------------------------------------------------
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 20,
  xl: 24,
  pill: 999,
  full: 9999,
};

// ---------------------------------------------------------------------------
// SHADOWS (cross-platform)
// level: 'sm' | 'md' | 'lg' (md is the default soft card shadow)
// ---------------------------------------------------------------------------
const shadowLevels = {
  sm: {
    ios: {
      shadowColor: colors.primary,
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
  },
  md: {
    ios: {
      shadowColor: colors.primary,
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 3 },
  },
  lg: {
    ios: {
      shadowColor: colors.primary,
      shadowOpacity: 0.1,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 16 },
    },
    android: { elevation: 6 },
  },
};

export function shadow(level = 'md') {
  const preset = shadowLevels[level] || shadowLevels.md;
  return Platform.select({
    ios: preset.ios,
    android: preset.android,
    default: preset.ios,
  });
}

// ---------------------------------------------------------------------------
// THEME (aggregate)
// ---------------------------------------------------------------------------
export const theme = {
  colors,
  semantic,
  fontFamily,
  typography,
  spacing,
  radii,
  shadow,
};

export default theme;
