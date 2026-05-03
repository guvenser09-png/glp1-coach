import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

/**
 * WeightChart
 *
 * Props:
 *  data  {Array<{ date: string, weight: number }>}  chronological order, oldest first
 */
export default function WeightChart({ data = [], height = 180 }) {
  if (!data || data.length < 2) {
    return (
      <View style={[styles.card, styles.empty, { height }]}>
        <Text style={styles.emptyText}>Not enough data to display chart</Text>
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
        color: () => '#4F46E5',
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    fillShadowGradientFrom: '#FFFFFF',
    fillShadowGradientTo: '#FFFFFF',
    fillShadowGradientOpacity: 0,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
    labelColor: () => '#6B7280',
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#4F46E5',
      fill: '#FFFFFF',
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
        yAxisSuffix=" kg"
        yAxisInterval={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
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
    color: '#9CA3AF',
    fontSize: 14,
  },
});
