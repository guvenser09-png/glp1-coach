import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors, fontFamily, shadow } from '../theme';

const screenWidth = Dimensions.get('window').width;

/**
 * WeightChart
 *
 * Props:
 *  data  {Array<{ date: string, weight: number }>}  chronological order, oldest first
 */
export default function WeightChart({ data = [], height = 180, weightUnit = 'kg', language = 'en' }) {
  const isTr = language === 'tr';
  if (!data || data.length < 2) {
    return (
      <View style={[styles.card, styles.empty, { height }]}>
        <Text style={styles.emptyText}>
          {isTr ? 'Grafik için yeterli veri yok' : 'Not enough data to display chart'}
        </Text>
      </View>
    );
  }

  // Sort oldest → newest so weight loss shows as a downward trend
  const sorted = data.slice().sort((a, b) => a.date.localeCompare(b.date));

  const weights = sorted.map((d) => d.weight);
  const labels = sorted.map((d) => {
    const parts = d.date.split('-');
    return `${parts[1]}/${parts[2]}`; // MM/DD
  });

  // Only show up to 6 labels to avoid crowding
  const step = Math.max(1, Math.floor(labels.length / 6));
  const sparseLabels = labels.map((l, i) => (i % step === 0 ? l : ''));

  const chartData = {
    labels: sparseLabels,
    datasets: [
      {
        data: weights,
        color: () => colors.primary,
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    fillShadowGradientFrom: colors.surface,
    fillShadowGradientTo: colors.surface,
    fillShadowGradientOpacity: 0,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
    labelColor: () => '#6B7280',
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primary,
      fill: colors.surface,
    },
    propsForBackgroundLines: {
      stroke: '#F3F4F6',
      strokeDasharray: '4 4',
    },
    style: {
      borderRadius: 16,
    },
  };

  const chartWidth = screenWidth - 64; // account for screen padding + card padding

  return (
    <View style={styles.card}>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={height}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        withInnerLines
        withOuterLines={false}
        withShadow={false}
        fromZero={false}
        yAxisSuffix={` ${weightUnit}`}
        yAxisInterval={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 8,
    ...shadow('sm'),
    overflow: 'hidden',
  },
  chart: {
    borderRadius: 12,
  },
  empty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    color: colors.outline,
    fontSize: 14,
    fontFamily: fontFamily.body,
  },
});
