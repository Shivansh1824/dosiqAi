/**
 * ChartTooltip Component
 * Custom tooltip for Victory charts showing detailed metric information
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VictoryTooltip } from 'victory-native';
import { Colors } from '@/constants/Colors';
import type { TimeSeriesDataPoint } from '@/types/labReport';

interface ChartTooltipProps {
  x?: number;
  y?: number;
  datum?: TimeSeriesDataPoint & { _x?: number; _y?: number };
  active?: boolean;
}

/**
 * Custom tooltip component for Victory charts
 */
export const ChartTooltip: React.FC<ChartTooltipProps> = ({ datum }) => {
  if (!datum) return null;

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = () => {
    if (!datum.status) return Colors.textSecondary;
    switch (datum.status) {
      case 'critical':
        return '#EF4444';
      case 'high':
        return '#F59E0B';
      case 'low':
        return '#3B82F6';
      case 'normal':
        return '#10B981';
      default:
        return Colors.textSecondary;
    }
  };

  return (
    <VictoryTooltip
      flyoutStyle={{
        fill: Colors.white,
        stroke: Colors.gray300,
        strokeWidth: 1,
      }}
      flyoutPadding={{ top: 8, bottom: 8, left: 12, right: 12 }}
      cornerRadius={8}
      pointerLength={6}
      pointerWidth={12}
      renderInPortal={false}
      labelComponent={
        <View style={styles.tooltipContainer}>
          {/* Value */}
          <Text style={styles.tooltipValue}>
            {datum.value} {datum.unit || ''}
          </Text>

          {/* Date */}
          <Text style={styles.tooltipDate}>{formatDate(datum.date)}</Text>

          {/* Status */}
          {datum.status && datum.status !== 'normal' && (
            <View
              style={[
                styles.tooltipStatus,
                { backgroundColor: `${getStatusColor()}20` },
              ]}
            >
              <View
                style={[styles.tooltipStatusDot, { backgroundColor: getStatusColor() }]}
              />
              <Text style={[styles.tooltipStatusText, { color: getStatusColor() }]}>
                {datum.status.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      }
    />
  );
};

/**
 * Simple text-only tooltip (lightweight version)
 */
export const SimpleTooltip: React.FC<{ datum?: TimeSeriesDataPoint }> = ({ datum }) => {
  if (!datum) return null;

  return (
    <VictoryTooltip
      flyoutStyle={{
        fill: 'rgba(0, 0, 0, 0.8)',
        stroke: 'transparent',
      }}
      flyoutPadding={{ top: 6, bottom: 6, left: 10, right: 10 }}
      cornerRadius={6}
      pointerLength={4}
      pointerWidth={8}
      renderInPortal={false}
      style={{
        fill: Colors.white,
        fontSize: 12,
        fontWeight: '600',
      }}
      text={`${datum.value} ${datum.unit || ''}`}
    />
  );
};

const styles = StyleSheet.create({
  tooltipContainer: {
    alignItems: 'center',
    gap: 4,
  },
  tooltipValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  tooltipDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  tooltipStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    marginTop: 2,
  },
  tooltipStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tooltipStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
