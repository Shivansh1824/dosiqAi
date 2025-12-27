/**
 * ReferenceRangeBand Component
 * Displays colored background zones for normal/warning/critical ranges on charts
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { VictoryArea } from 'victory-native';
import { STATUS_COLORS, COLOR_BLIND_PALETTE } from '@/types/labReport';
import type { ReferenceRange } from '@/types/labReport';

interface ReferenceRangeBandProps {
  referenceRange: ReferenceRange;
  chartDomain: { x: [Date, Date]; y: [number, number] };
  colorBlindMode?: boolean;
}

export const ReferenceRangeBand: React.FC<ReferenceRangeBandProps> = ({
  referenceRange,
  chartDomain,
  colorBlindMode = false,
}) => {
  const colors = colorBlindMode ? COLOR_BLIND_PALETTE : STATUS_COLORS;

  // Create data points for the reference zone
  const normalZoneData = [
    {
      x: chartDomain.x[0],
      y: referenceRange.min,
      y0: referenceRange.max,
    },
    {
      x: chartDomain.x[1],
      y: referenceRange.min,
      y0: referenceRange.max,
    },
  ];

  return (
    <VictoryArea
      data={normalZoneData}
      style={{
        data: {
          fill: colors.normal.light,
          fillOpacity: 0.3,
          stroke: 'transparent',
        },
      }}
    />
  );
};

/**
 * Multi-zone reference band (shows low, normal, high zones)
 */
export const MultiZoneReferenceRangeBand: React.FC<ReferenceRangeBandProps> = ({
  referenceRange,
  chartDomain,
  colorBlindMode = false,
}) => {
  const colors = colorBlindMode ? COLOR_BLIND_PALETTE : STATUS_COLORS;

  const { min: normalMin, max: normalMax } = referenceRange;
  const yRange = chartDomain.y[1] - chartDomain.y[0];

  // Calculate critical thresholds (20% beyond normal range)
  const criticalLow = normalMin * 0.8;
  const criticalHigh = normalMax * 1.2;

  // Low zone (below normal)
  const lowZoneData = [
    { x: chartDomain.x[0], y: chartDomain.y[0], y0: normalMin },
    { x: chartDomain.x[1], y: chartDomain.y[0], y0: normalMin },
  ];

  // Normal zone
  const normalZoneData = [
    { x: chartDomain.x[0], y: normalMin, y0: normalMax },
    { x: chartDomain.x[1], y: normalMin, y0: normalMax },
  ];

  // High zone (above normal)
  const highZoneData = [
    { x: chartDomain.x[0], y: normalMax, y0: chartDomain.y[1] },
    { x: chartDomain.x[1], y: normalMax, y0: chartDomain.y[1] },
  ];

  return (
    <>
      {/* Low Zone */}
      <VictoryArea
        data={lowZoneData}
        style={{
          data: {
            fill: colors.low.light,
            fillOpacity: 0.15,
            stroke: 'transparent',
          },
        }}
      />

      {/* Normal Zone */}
      <VictoryArea
        data={normalZoneData}
        style={{
          data: {
            fill: colors.normal.light,
            fillOpacity: 0.3,
            stroke: 'transparent',
          },
        }}
      />

      {/* High Zone */}
      <VictoryArea
        data={highZoneData}
        style={{
          data: {
            fill: colors.high.light,
            fillOpacity: 0.15,
            stroke: 'transparent',
          },
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  // No styles needed for Victory components
});
