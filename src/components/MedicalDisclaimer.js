import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../theme';
import { getDisclaimer } from '../constants/legal';

// Per-variant accent + leading glyph. Colors resolve from the scheme-aware
// semantic palette so the banner works in light AND dark mode.
//   medical -> warning (caution)
//   ai      -> info    (informational)
//   data    -> info    (informational / privacy)
const VARIANT_META = {
  medical: { tone: 'warning', glyph: '⚕' },
  ai: { tone: 'info', glyph: '✨' },
  data: { tone: 'info', glyph: '🔒' },
};

/**
 * MedicalDisclaimer
 *
 * Small reusable themed banner for compliance copy. Drop into any screen.
 *
 * Props:
 *  variant   {'medical'|'ai'|'data'}  which disclaimer to show (default 'medical')
 *  language  {'en'|'tr'}              optional override; defaults to app language
 *  compact   {boolean}               title only, no body (default false)
 *  style                             extra container style
 */
export default function MedicalDisclaimer({
  variant = 'medical',
  language,
  compact = false,
  style,
}) {
  const { language: appLanguage } = useLanguage();
  const { semantic, colors, fontFamily, spacing, radii } = useTheme();

  const lang = language || appLanguage || 'en';
  const meta = VARIANT_META[variant] || VARIANT_META.medical;
  const tone = semantic[meta.tone] || semantic.info;
  const { title, body } = getDisclaimer(variant, lang);

  const isTr = lang === 'tr';
  const a11yLabel = compact ? title : `${title}. ${body}`;

  const styles = useMemo(
    () => makeStyles({ colors, fontFamily, spacing, radii }),
    [colors, fontFamily, spacing, radii]
  );

  return (
    <View
      style={[styles.banner, { backgroundColor: tone.bg, borderLeftColor: tone.fg }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      <Text
        style={styles.glyph}
        accessibilityElementsHidden
        importantForAccessibility="no"
        allowFontScaling
      >
        {meta.glyph}
      </Text>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: tone.fg }]} allowFontScaling>
          {title}
        </Text>
        {!compact ? (
          <Text style={[styles.body, { color: colors.onSurfaceVariant }]} allowFontScaling>
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles({ colors, fontFamily, spacing, radii }) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderLeftWidth: 3,
      borderRadius: radii.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    glyph: {
      fontSize: 16,
      lineHeight: 20,
      marginRight: spacing.sm,
      fontFamily: fontFamily.body,
    },
    textCol: {
      flex: 1,
    },
    title: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      fontFamily: fontFamily.bodySemiBold,
    },
    body: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '400',
      fontFamily: fontFamily.body,
    },
  });
}
