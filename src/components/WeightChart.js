import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Line,
} from 'react-native-svg';
import { fontFamily, typography, spacing, radii, useTheme } from '../theme';

/**
 * WeightChart — premium custom SVG line chart.
 *
 * Props:
 *  data        {Array<{ date: string, weight: number }>}  oldest → newest
 *  height      {number}  chart drawing height (px)
 *  weightUnit  {string}  'kg' | 'lb'
 *  language    {string}  'tr' | 'en'
 */

// Catmull-Rom → cubic Bézier for a smooth monotone-ish curve.
function buildSmoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function WeightChart({
  data = [],
  height = 220,
  weightUnit = 'kg',
  language = 'en',
}) {
  const isTr = language === 'tr';
  const { colors, shadow } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors, shadow), [colors, shadow]);

  // Empty / insufficient state — graceful & on-theme.
  if (!data || data.length < 2) {
    return (
      <View
        style={[styles.card, styles.empty, { minHeight: height }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          isTr
            ? 'Kilo eğilim grafiği. Henüz yeterli veri yok; grafiği görmek için en az iki ölçüm ekleyin.'
            : 'Weight trend chart. Not enough data yet; log at least two weigh-ins to see your trend.'
        }
      >
        <View style={styles.emptyIcon}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path
              d="M3 17 L9 11 L13 15 L21 7"
              stroke={colors.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
        <Text style={styles.emptyTitle}>
          {isTr ? 'Henüz yeterli veri yok' : 'Not enough data yet'}
        </Text>
        <Text style={styles.emptyText}>
          {isTr
            ? 'Grafiği görmek için en az iki ölçüm ekleyin.'
            : 'Log at least two weigh-ins to see your trend.'}
        </Text>
      </View>
    );
  }

  // Sort oldest → newest so weight loss reads as a downward trend.
  const sorted = data
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const weights = sorted.map((d) => Number(d.weight));

  // ---- Layout geometry ----
  // viewBox-based responsive SVG: render in a fixed coordinate space and let
  // it scale to the container width. Reserve right gutter for value labels.
  const VB_W = 320;
  const VB_H = height;
  const padL = 14;
  const padR = 52; // room for current-value pill + min/max labels
  const padT = 24;
  const padB = 30; // room for date labels
  const plotW = VB_W - padL - padR;
  const plotH = VB_H - padT - padB;

  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  // Pad the value range so the line never touches the edges; handle flat lines.
  const rawRange = maxW - minW;
  const range = rawRange === 0 ? Math.max(1, maxW * 0.04) : rawRange;
  const yPad = range * 0.18;
  const domainMin = minW - yPad;
  const domainMax = maxW + yPad;
  const domain = domainMax - domainMin || 1;

  const n = sorted.length;
  const xFor = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (w) => padT + (1 - (w - domainMin) / domain) * plotH;

  const points = weights.map((w, i) => ({ x: xFor(i), y: yFor(w) }));
  const linePath = buildSmoothPath(points);
  const areaPath =
    linePath +
    ` L ${points[n - 1].x} ${padT + plotH}` +
    ` L ${points[0].x} ${padT + plotH} Z`;

  const last = points[n - 1];
  const lastWeight = weights[n - 1];
  const firstWeight = weights[0];
  const delta = lastWeight - firstWeight;
  const losing = delta < 0;

  // ---- Sparse date labels (few, not crowded) ----
  const fmtDate = (dateStr) => {
    const parts = String(dateStr).split('-');
    if (parts.length >= 3) return `${parts[1]}/${parts[2]}`; // MM/DD
    return String(dateStr);
  };
  const maxLabels = 4;
  const labelStep = Math.max(1, Math.ceil((n - 1) / (maxLabels - 1)));
  const dateLabels = [];
  for (let i = 0; i < n; i += labelStep) dateLabels.push(i);
  if (dateLabels[dateLabels.length - 1] !== n - 1) dateLabels.push(n - 1);

  const fmtVal = (v) => {
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  };

  const yMaxGuide = yFor(maxW);
  const yMinGuide = yFor(minW);

  // Accessibility: describe the whole chart as a single readable summary so
  // VoiceOver/TalkBack users get the trend without reading raw SVG nodes.
  const trendWord = losing
    ? isTr
      ? 'düşüş'
      : 'downward'
    : delta > 0
      ? isTr
        ? 'yükseliş'
        : 'upward'
      : isTr
        ? 'sabit'
        : 'flat';
  const a11yChartLabel = isTr
    ? `Kilo eğilim grafiği. ${n} ölçüm. Güncel ağırlık ${fmtVal(lastWeight)} ${weightUnit}. ` +
      `Başlangıçtan değişim ${delta > 0 ? '+' : delta < 0 ? '−' : ''}${fmtVal(
        Math.abs(delta)
      )} ${weightUnit}. En düşük ${fmtVal(minW)}, en yüksek ${fmtVal(
        maxW
      )} ${weightUnit}. Genel eğilim: ${trendWord}.`
    : `Weight trend chart. ${n} entries. Current weight ${fmtVal(
        lastWeight
      )} ${weightUnit}. Change since start ${
        delta > 0 ? '+' : delta < 0 ? '−' : ''
      }${fmtVal(Math.abs(delta))} ${weightUnit}. Lowest ${fmtVal(
        minW
      )}, highest ${fmtVal(maxW)} ${weightUnit}. Overall trend: ${trendWord}.`;

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11yChartLabel}
    >
      {/* Header: current value + change badge */}
      <View style={styles.header} importantForAccessibility="no-hide-descendants">
        <View>
          <Text style={styles.headerLabel}>
            {isTr ? 'Güncel ağırlık' : 'Current weight'}
          </Text>
          <View style={styles.currentRow}>
            <Text style={styles.currentValue}>{fmtVal(lastWeight)}</Text>
            <Text style={styles.currentUnit}>{weightUnit}</Text>
          </View>
        </View>
        <View
          style={[
            styles.deltaPill,
            { backgroundColor: losing ? colors.successBg : colors.infoBg },
          ]}
        >
          <Text
            style={[
              styles.deltaText,
              { color: losing ? colors.success : colors.primary },
            ]}
          >
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}
            {fmtVal(Math.abs(delta))} {weightUnit}
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={{ height }} importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Defs>
            <SvgLinearGradient id="wcArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.22} />
              <Stop offset="0.6" stopColor={colors.primary} stopOpacity={0.07} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </SvgLinearGradient>
            <SvgLinearGradient id="wcLine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="1" stopColor={colors.primaryLight} />
            </SvgLinearGradient>
          </Defs>

          {/* Subtle min/max guide lines */}
          <Line
            x1={padL}
            y1={yMaxGuide}
            x2={padL + plotW}
            y2={yMaxGuide}
            stroke={colors.outlineVariant}
            strokeWidth={1}
            strokeDasharray="2 5"
          />
          <Line
            x1={padL}
            y1={yMinGuide}
            x2={padL + plotW}
            y2={yMinGuide}
            stroke={colors.outlineVariant}
            strokeWidth={1}
            strokeDasharray="2 5"
          />

          {/* Area fill */}
          <Path d={areaPath} fill="url(#wcArea)" />

          {/* Smooth line */}
          <Path
            d={linePath}
            stroke="url(#wcLine)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Latest point: outer halo + filled dot */}
          <Circle cx={last.x} cy={last.y} r={9} fill={colors.primary} opacity={0.14} />
          <Circle cx={last.x} cy={last.y} r={5} fill={colors.primary} />
          <Circle cx={last.x} cy={last.y} r={2.2} fill={colors.white} />
        </Svg>

        {/* Min / Max value labels (RN text overlay for crisp typography) */}
        <Text
          style={[
            styles.guideLabel,
            { top: (yMaxGuide / VB_H) * height - 8, right: 6 },
          ]}
        >
          {fmtVal(maxW)}
        </Text>
        <Text
          style={[
            styles.guideLabel,
            { top: (yMinGuide / VB_H) * height - 8, right: 6 },
          ]}
        >
          {fmtVal(minW)}
        </Text>
      </View>

      {/* Date labels */}
      <View style={styles.dateRow} importantForAccessibility="no-hide-descendants">
        {dateLabels.map((idx) => {
          const xRatio = padL + (n === 1 ? plotW / 2 : (idx / (n - 1)) * plotW);
          const leftPct = (xRatio / VB_W) * 100;
          const isLast = idx === n - 1;
          return (
            <Text
              key={idx}
              style={[
                styles.dateLabel,
                {
                  left: `${leftPct}%`,
                  transform: [
                    { translateX: isLast ? -34 : idx === 0 ? 0 : -16 },
                  ],
                },
              ]}
              numberOfLines={1}
            >
              {fmtDate(sorted[idx].date)}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors, shadow) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.cardPadding,
    ...shadow('md'),
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.stackSm,
  },
  headerLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  currentValue: {
    ...typography.headlineLg,
    color: colors.onSurface,
  },
  currentUnit: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginLeft: 4,
    marginBottom: 5,
  },
  deltaPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  deltaText: {
    ...typography.labelMd,
  },
  guideLabel: {
    position: 'absolute',
    ...typography.labelSm,
    fontFamily: fontFamily.bodyMedium,
    color: colors.outline,
  },
  dateRow: {
    height: 18,
    marginTop: 2,
  },
  dateLabel: {
    position: 'absolute',
    ...typography.labelSm,
    color: colors.outline,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.stackLg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.stackMd,
  },
  emptyTitle: {
    ...typography.labelMd,
    color: colors.onSurface,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.stackMd,
  },
  });
