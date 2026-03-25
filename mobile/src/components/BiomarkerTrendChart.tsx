import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryLine,
  VictoryArea,
  VictoryScatter,
  VictoryAxis,
  VictoryContainer,
  VictoryLabel
} from 'victory-native';
import { Colors, Sizes } from '../constants';
import { TestResult } from '../hooks/useLabReport';

interface BiomarkerTrendChartProps {
  currentTest: TestResult;
  pastTests: TestResult[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * A minimalistic trend chart for biomarkers using Victory Native.
 */
export default function BiomarkerTrendChart({ currentTest, pastTests }: BiomarkerTrendChartProps) {
  // Combine current and past data points
  const allDataPoints = [currentTest, ...pastTests]
    .filter(t => t.value && !isNaN(parseFloat(t.value)))
    .map(t => ({
      x: new Date(t.report_date),
      y: parseFloat(t.value),
      status: t.status,
      unit: t.unit
    }))
    .sort((a, b) => a.x.getTime() - b.x.getTime());

  if (allDataPoints.length < 1) return null;

  // Chart dimensions
  const chartWidth = SCREEN_WIDTH - (Sizes.lg * 4); // Adjusted for card padding
  const chartHeight = 140; // Slightly increased height for better visibility

  // Parse reference values as numbers
  const refMin = currentTest.ref_min !== null ? parseFloat(String(currentTest.ref_min)) : null;
  const refMax = currentTest.ref_max !== null ? parseFloat(String(currentTest.ref_max)) : null;

  // Calculate Y-axis domain for better scaling
  const values = allDataPoints.map(p => p.y);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  
  const boundaries = [dataMin, dataMax];
  if (refMin !== null) boundaries.push(refMin);
  if (refMax !== null) boundaries.push(refMax);
  
  const absoluteMin = Math.min(...boundaries);
  const absoluteMax = Math.max(...boundaries);
  
  const yRange = absoluteMax - absoluteMin;
  const padding = yRange * 0.25 || (absoluteMax === 0 ? 1 : Math.abs(absoluteMax) * 0.2);
  const domainY: [number, number] = [absoluteMin - padding, absoluteMax + padding];

  return (
    <View style={styles.container}>
      <VictoryChart
        width={chartWidth}
        height={chartHeight}
        padding={{ top: 20, bottom: 35, left: 10, right: 35 }} // Increased right padding for labels
        containerComponent={<VictoryContainer disableContainerEvents />}
        scale={{ x: "time" }}
        domain={{ y: domainY }}
      >
        {/* X Axis - Minimalist */}
        <VictoryAxis
          tickFormat={(x) => {
            const date = new Date(x);
            return `${date.toLocaleString('en-US', { month: 'short' })} '${date.getFullYear().toString().slice(-2)}`;
          }}
          style={{
            axis: { stroke: "transparent" },
            ticks: { stroke: "transparent" },
            tickLabels: { 
              fill: Colors.textTertiary, 
              fontSize: 10, 
              fontFamily: 'PlusJakartaSans-Medium',
              padding: 8
            }
          }}
        />

        {/* Y Axis - Hidden axis but keeping the scale */}
        <VictoryAxis 
          dependentAxis 
          style={{
            axis: { stroke: "transparent" },
            ticks: { stroke: "transparent" },
            tickLabels: { fill: "transparent" }
          }}
        />

        {/* Shaded Normal Range Area */}
        {refMin !== null && refMax !== null && !isNaN(refMin) && !isNaN(refMax) && (
          <VictoryArea
            data={[
              { x: allDataPoints[0].x, y: refMax, y0: refMin },
              { x: allDataPoints[allDataPoints.length - 1].x, y: refMax, y0: refMin }
            ]}
            style={{
              data: { 
                fill: Colors.successLight, 
                fillOpacity: 0.35
              }
            }}
          />
        )}

        {/* Reference Lines boundaries */}
        {refMin !== null && !isNaN(refMin) && (
          <VictoryLine
            data={[
              { x: allDataPoints[0].x, y: refMin },
              { x: allDataPoints[allDataPoints.length - 1].x, y: refMin }
            ]}
            style={{
              data: { 
                stroke: Colors.successDark, 
                strokeWidth: 1, 
                strokeDasharray: "4, 4",
                strokeOpacity: 0.3
              }
            } as any}
          />
        )}
        {refMax !== null && !isNaN(refMax) && (
          <VictoryLine
            data={[
              { x: allDataPoints[0].x, y: refMax },
              { x: allDataPoints[allDataPoints.length - 1].x, y: refMax }
            ]}
            style={{
              data: { 
                stroke: Colors.successDark, 
                strokeWidth: 1, 
                strokeDasharray: "4, 4",
                strokeOpacity: 0.3
              }
            } as any}
          />
        )}

        {/* Reference Labels */}
        {refMin !== null && !isNaN(refMin) && (
          <VictoryLabel
            text={refMin}
            datum={{ x: allDataPoints[allDataPoints.length - 1].x, y: refMin }}
            textAnchor="start"
            dx={8}
            style={{ 
              fill: Colors.successDark, 
              fontSize: 9, 
              fontFamily: 'PlusJakartaSans-Bold',
              opacity: 0.8
            }}
          />
        )}
        {refMax !== null && !isNaN(refMax) && (
          <VictoryLabel
            text={refMax}
            datum={{ x: allDataPoints[allDataPoints.length - 1].x, y: refMax }}
            textAnchor="start"
            dx={8}
            style={{ 
              fill: Colors.successDark, 
              fontSize: 9, 
              fontFamily: 'PlusJakartaSans-Bold',
              opacity: 0.8
            }}
          />
        )}

        {/* Area fill under trend line */}
        <VictoryArea
          data={allDataPoints}
          interpolation="monotoneX"
          style={{
            data: { fill: Colors.primary, fillOpacity: 0.08 }
          }}
        />

        {/* Trend Line */}
        <VictoryLine
          data={allDataPoints}
          interpolation="monotoneX"
          style={{
            data: { stroke: Colors.primary, strokeWidth: 2.0 }
          }}
        />

        {/* Data Points */}
        <VictoryScatter
          data={allDataPoints}
          size={5}
          style={{
            data: {
              fill: ({ datum }) => {
                const status = datum.status?.toUpperCase();
                if (status === 'NORMAL') return Colors.success;
                if (status === 'HIGH' || status === 'LOW') return Colors.error;
                return Colors.warning;
              },
              stroke: Colors.white,
              strokeWidth: 2
            }
          }}
        />
      </VictoryChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Sizes.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Sizes.radiusMd,
    overflow: 'hidden',
  },
});
