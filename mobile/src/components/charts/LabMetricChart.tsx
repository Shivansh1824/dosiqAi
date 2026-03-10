/**
 * LabMetricChart Component
 * Main chart component for displaying lab metric trends using Victory Native
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryTheme,
  VictoryArea,
  VictoryScatter,
  VictoryVoronoiContainer,
  VictoryTooltip,
} from 'victory-native';
import { Colors } from '@/constants/Colors';
import type { TimeSeriesData, ReferenceRange } from '@/types/labReport';
import { STATUS_COLORS } from '@/types/labReport';
import { MultiZoneReferenceRangeBand } from './ReferenceRangeBand';

interface LabMetricChartProps {
  data: TimeSeriesData;
  height?: number;
  showReferenceZone?: boolean;
  colorBlindMode?: boolean;
  enableZoom?: boolean;
  enableTooltips?: boolean;
  showMultiZone?: boolean; // Show low/normal/high zones
  onPointPress?: (dataPoint: TimeSeriesData['dataPoints'][0]) => void;
}

const CHART_WIDTH = Dimensions.get('window').width - 32;

export const LabMetricChart: React.FC<LabMetricChartProps> = ({
  data,
  height = 200,
  showReferenceZone = true,
  colorBlindMode = false,
  enableZoom = false,
  enableTooltips = true,
  showMultiZone = false,
  onPointPress,
}) => {
  // Prepare chart data
  const chartData = useMemo(() => {
    return data.dataPoints.map((point) => ({
      ...point, // Include all original data for tooltips
      x: point.x,
      y: point.y,
      label: point.label,
    }));
  }, [data.dataPoints]);

  // Calculate X-axis domain
  const xDomain = useMemo(() => {
    if (chartData.length === 0) return [new Date(), new Date()];
    const dates = chartData.map((d) => d.x.getTime());
    return [new Date(Math.min(...dates)), new Date(Math.max(...dates))];
  }, [chartData]);

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    const values = chartData.map((d) => d.y);
    let min = Math.min(...values);
    let max = Math.max(...values);

    // Include reference range in domain if available
    if (showReferenceZone && data.referenceRange) {
      min = Math.min(min, data.referenceRange.min);
      max = Math.max(max, data.referenceRange.max);
    }

    // Add 10% padding
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [chartData, data.referenceRange, showReferenceZone]);

  // Determine line color based on latest status
  const getLineColor = () => {
    if (!data.latestValue || !data.latestValue.status) {
      return Colors.primary;
    }

    const status = data.latestValue.status;
    return STATUS_COLORS[status].primary;
  };

  // Reference zone background (using VictoryArea for shaded region)
  const referenceZoneData = useMemo(() => {
    if (!showReferenceZone || !data.referenceRange || chartData.length === 0) {
      return null;
    }

    const firstX = chartData[0].x;
    const lastX = chartData[chartData.length - 1].x;

    return [
      { x: firstX, y: data.referenceRange.min, y0: data.referenceRange.max },
      { x: lastX, y: data.referenceRange.min, y0: data.referenceRange.max },
    ];
  }, [data.referenceRange, chartData, showReferenceZone]);

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No data available</Text>
          <Text style={styles.emptyStateSubtext}>
            Upload lab reports to see trend charts
          </Text>
        </View>
      </View>
    );
  }

  // Single data point - show as dot
  if (chartData.length === 1) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.singlePointContainer}>
          <View style={[styles.dot, { backgroundColor: getLineColor() }]} />
          <Text style={styles.singlePointValue}>
            {data.latestValue?.value} {data.unit}
          </Text>
          <Text style={styles.singlePointDate}>
            {new Date(data.latestValue!.date).toLocaleDateString()}
          </Text>
          <Text style={styles.singlePointMessage}>
            Upload more reports to see trends over time
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <VictoryChart
        width={CHART_WIDTH}
        height={height}
        theme={VictoryTheme.material}
        padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
        domain={{ y: yDomain as [number, number] }}
        containerComponent={
          enableZoom || enableTooltips ? (
            <VictoryVoronoiContainer
              labels={enableTooltips ? (({ datum }: any) => `${datum.value} ${datum.unit || ''}`) : undefined}
              labelComponent={
                enableTooltips ? (
                  <VictoryTooltip
                    flyoutStyle={{
                      fill: 'rgba(0, 0, 0, 0.8)',
                      stroke: 'transparent',
                    }}
                    flyoutPadding={{ top: 6, bottom: 6, left: 10, right: 10 }}
                    cornerRadius={6}
                    pointerLength={4}
                    pointerWidth={8}
                    style={{
                      fill: Colors.white,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  />
                ) : undefined
              }
            />
          ) : undefined
        }
      >
        {/* Reference zone background */}
        {showReferenceZone && data.referenceRange && (
          showMultiZone ? (
            <MultiZoneReferenceRangeBand
              referenceRange={data.referenceRange}
              chartDomain={{ x: xDomain as [Date, Date], y: yDomain as [number, number] }}
              colorBlindMode={colorBlindMode}
            />
          ) : (
            referenceZoneData && (
              <VictoryArea
                data={referenceZoneData}
                style={{
                  data: {
                    fill: STATUS_COLORS.normal.light,
                    fillOpacity: 0.3,
                  },
                }}
              />
            )
          )
        )}

        {/* X-axis (dates) */}
        <VictoryAxis
          tickFormat={(date: Date) => {
            const d = new Date(date);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
          style={{
            axis: { stroke: Colors.gray300 },
            ticks: { stroke: Colors.gray300, size: 5 },
            tickLabels: {
              fontSize: 10,
              padding: 5,
              fill: Colors.textSecondary,
            },
            grid: { stroke: 'transparent' },
          }}
        />

        {/* Y-axis (values) */}
        <VictoryAxis
          dependentAxis
          tickFormat={(value: number) => {
            // Format based on magnitude
            if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
            if (value % 1 === 0) return value.toString();
            return value.toFixed(1);
          }}
          style={{
            axis: { stroke: Colors.gray300 },
            ticks: { stroke: Colors.gray300, size: 5 },
            tickLabels: {
              fontSize: 10,
              padding: 5,
              fill: Colors.textSecondary,
            },
            grid: { stroke: Colors.gray200, strokeDasharray: '3,3' },
          }}
        />

        {/* Line chart */}
        <VictoryLine
          data={chartData}
          style={{
            data: {
              stroke: getLineColor(),
              strokeWidth: 2,
            },
          }}
          interpolation="monotoneX" // Smooth curve
        />

        {/* Interactive data points */}
        {enableTooltips && (
          <VictoryScatter
            data={chartData}
            size={4}
            style={{
              data: {
                fill: getLineColor(),
                stroke: Colors.white,
                strokeWidth: 2,
              },
            }}
          />
        )}
      </VictoryChart>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          {data.testName} ({data.unit || 'N/A'})
        </Text>
        {data.referenceRange && (
          <Text style={styles.legendSubtext}>
            Reference: {data.referenceRange.min}-{data.referenceRange.max}{' '}
            {data.referenceRange.unit}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 8,
    marginVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  singlePointContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  singlePointValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  singlePointDate: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  singlePointMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  legend: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  legendSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
