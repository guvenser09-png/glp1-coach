// GLP-1 Coach Design System — light + dark themes
// Single source of truth for colors, typography, spacing, radii, and shadows.
//
// DARK MODE — how it works:
// ---------------------------------------------------------------------------
// Two color sets are exported: `lightColors` and `darkColors`. They share the
// EXACT SAME KEY NAMES, so any screen reading `colors.surface`, `colors.onSurface`,
// etc. keeps working unchanged.
//
// The top-level `colors` / `semantic` / `theme` exports remain the LIGHT set so
// nothing breaks. To make a screen scheme-aware, opt in with the hook:
//
//   import { useThemeColors } from '../theme';
//   function MyScreen() {
//     const colors = useThemeColors();        // light or dark, follows OS
//     const styles = makeStyles(colors);      // build StyleSheet from colors
//     ...
//   }
//
// Or grab the whole scheme-aware theme:
//
//   import { useTheme } from '../theme';
//   const { colors, semantic, scheme } = useTheme();
//
// Outside React (rare), resolve once with `getColors()` / `getSemantic()` which
// read Appearance.getColorScheme(). Prefer the hooks inside components so the UI
// re-renders when the OS theme flips.
// ---------------------------------------------------------------------------
import { Platform, useColorScheme, Appearance } from 'react-native';

// ---------------------------------------------------------------------------
// COLORS — LIGHT
// ---------------------------------------------------------------------------
export const lightColors = {
  // Brand
  primary: '#4F46E5', // indigo
  primaryLight: '#6366F1',
  primaryDark: '#3730A3',
  accent: '#6366F1',

  // Hero gradient (linear 135deg) — vivid indigo→violet (Stitch "Maya")
  gradient: {
    start: '#4F46E5',
    end: '#7B6EF6',
    angle: 135,
  },

  // Surfaces (Stitch: soft lavender-white app bg, pure white cards)
  background: '#FAF8FF', // lavender-tinted app background
  surface: '#FFFFFF', // pure white cards
  surfaceVariant: '#F2F3FF', // soft indigo tint

  // Text (Stitch ink + slate)
  onSurface: '#131B2E',
  onSurfaceVariant: '#475569',
  outline: '#777587',
  outlineVariant: '#E2E7FF', // lavender hairline
  onPrimary: '#FFFFFF',

  // Semantic
  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  danger: '#EF4444',
  dangerBg: '#FFE4E6', // soft coral
  info: '#4F46E5',
  infoBg: '#EEF0FF',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// ---------------------------------------------------------------------------
// COLORS — DARK (same keys as lightColors)
// ---------------------------------------------------------------------------
export const darkColors = {
  // Brand — slightly brighter indigo for contrast on dark surfaces
  primary: '#818CF8', // indigo-400
  primaryLight: '#A5B4FC',
  primaryDark: '#6366F1',
  accent: '#A5B4FC',

  // Hero gradient (linear 135deg) — keep saturated, reads well on dark
  gradient: {
    start: '#4338CA',
    end: '#6366F1',
    angle: 135,
  },

  // Surfaces (Stitch dark: deep indigo-navy bg, slate elevated cards)
  background: '#0B1020', // near-black indigo app background
  surface: '#151B2E', // elevated cards
  surfaceVariant: '#1E293B', // slate

  // Text (Stitch slate scale)
  onSurface: '#F1F5F9', // off-white primary text
  onSurfaceVariant: '#94A3B8',
  outline: '#8A90A0',
  outlineVariant: '#334155',
  onPrimary: '#0B1020', // dark text on bright primary

  // Semantic — desaturated fg for legibility, deep tinted bg
  success: '#34D399',
  successBg: '#0E2A22',
  warning: '#FBBF24',
  warningBg: '#2B2410',
  danger: '#F87171',
  dangerBg: '#2C1414',
  info: '#818CF8',
  infoBg: '#1A1E3A',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Build a grouped semantic map (color + matching background) from a color set
function buildSemantic(c) {
  return {
    success: { fg: c.success, bg: c.successBg },
    warning: { fg: c.warning, bg: c.warningBg },
    danger: { fg: c.danger, bg: c.dangerBg },
    info: { fg: c.info, bg: c.infoBg },
  };
}

export const lightSemantic = buildSemantic(lightColors);
export const darkSemantic = buildSemantic(darkColors);

// ---------------------------------------------------------------------------
// Back-compat default exports — resolved to the device color scheme at app
// launch (via Appearance), so the many components/screens that import the static
// `colors`/`semantic` render the correct palette in dark mode too. (Live
// light/dark toggling without an app reload still needs the useTheme* hooks.)
// ---------------------------------------------------------------------------
const _initialScheme = Appearance.getColorScheme();
const _isDark = _initialScheme === 'dark';
export const colors = _isDark ? darkColors : lightColors;
export const semantic = _isDark ? darkSemantic : lightSemantic;

// ---------------------------------------------------------------------------
// SCHEME-AWARE RESOLVERS
// ---------------------------------------------------------------------------
// Imperative (non-React) resolution. Reads the current OS color scheme.
export function getColors(scheme) {
  const s = scheme || Appearance.getColorScheme() || 'light';
  return s === 'dark' ? darkColors : lightColors;
}

export function getSemantic(scheme) {
  const s = scheme || Appearance.getColorScheme() || 'light';
  return s === 'dark' ? darkSemantic : lightSemantic;
}

// React hooks — re-render automatically when the OS theme changes.
export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

export function useThemeSemantic() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkSemantic : lightSemantic;
}

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
// Shadow color + opacity differ by scheme: indigo-tinted soft shadows read on
// light surfaces, but on dark surfaces a deeper, more opaque black shadow works.
function makeShadowLevels(scheme) {
  const isDark = scheme === 'dark';
  const shadowColor = isDark ? '#000000' : lightColors.primary;
  const op = (light, dark) => (isDark ? dark : light);
  return {
    sm: {
      ios: {
        shadowColor,
        shadowOpacity: op(0.05, 0.3),
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    },
    md: {
      ios: {
        shadowColor,
        shadowOpacity: op(0.06, 0.4),
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 3 },
    },
    lg: {
      ios: {
        shadowColor,
        shadowOpacity: op(0.1, 0.5),
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 16 },
      },
      android: { elevation: 6 },
    },
  };
}

const shadowLevels = makeShadowLevels('light');
const darkShadowLevels = makeShadowLevels('dark');

// shadow(level, scheme?) — defaults to the light set for back-compat.
// Pass 'dark' (or use the scheme-aware theme from useTheme) for dark surfaces.
export function shadow(level = 'md', scheme) {
  const levels = scheme === 'dark' ? darkShadowLevels : shadowLevels;
  const preset = levels[level] || levels.md;
  return Platform.select({
    ios: preset.ios,
    android: preset.android,
    default: preset.ios,
  });
}

// ---------------------------------------------------------------------------
// THEME (aggregate) — default is the LIGHT set for back-compat
// ---------------------------------------------------------------------------
export const theme = {
  colors,
  semantic,
  fontFamily,
  typography,
  spacing,
  radii,
  shadow,
  scheme: 'light',
};

// Build a full theme bundle for a given scheme. typography/spacing/radii/fontFamily
// are scheme-independent and shared; colors/semantic/shadow resolve per scheme.
function buildTheme(scheme) {
  const s = scheme === 'dark' ? 'dark' : 'light';
  return {
    colors: s === 'dark' ? darkColors : lightColors,
    semantic: s === 'dark' ? darkSemantic : lightSemantic,
    fontFamily,
    typography,
    spacing,
    radii,
    // shadow bound to this scheme so callers can use shadow(level) directly
    shadow: (level = 'md') => shadow(level, s),
    scheme: s,
  };
}

// Imperative (non-React) full-theme resolver.
export function getTheme(scheme) {
  return buildTheme(scheme || Appearance.getColorScheme() || 'light');
}

// React hook — full scheme-aware theme, re-renders on OS theme change.
export function useTheme() {
  const scheme = useColorScheme();
  return buildTheme(scheme);
}

export default theme;
