import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { 
  VictoryChart, 
  VictoryLine, 
  VictoryArea, 
  VictoryScatter, 
  VictoryAxis, 
  VictoryContainer 
} from 'victory-native';
import { Svg, Defs, LinearGradient, Stop } from 'react-native-svg';
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
  const chartHeight = 120;

  // Parse reference values as numbers
  const refMin = currentTest.ref_min !== null ? parseFloat(String(currentTest.ref_min)) : null;
  const refMax = currentTest.ref_max !== null ? parseFloat(String(currentTest.ref_max)) : null;

  return (
    <View style={styles.container}>
      <Svg style={{ height: 0, width: 0 }}>
        <Defs>
          <LinearGradient id="gradientFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0.01" />
          </LinearGradient>
        </Defs>
      </Svg>

      <VictoryChart
        width={chartWidth}
        height={chartHeight}
        padding={{ top: 20, bottom: 30, left: 10, right: 10 }}
        containerComponent={<VictoryContainer disableContainerEvents />}
        scale={{ x: "time" }}
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
              padding: 5
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

        {/* Reference Lines */}
        {refMin !== null && !isNaN(refMin) && (
          <VictoryLine
            data={[
              { x: allDataPoints[0].x, y: refMin },
              { x: allDataPoints[allDataPoints.length - 1].x, y: refMin }
            ]}
            style={{
              data: { 
                stroke: Colors.gray300, 
                strokeWidth: 1, 
                strokeDasharray: "4, 4" 
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
                stroke: Colors.gray300, 
                strokeWidth: 1, 
                strokeDasharray: "4, 4" 
              }
            } as any}
          />
        )}

        {/* Gradient Area */}
        <VictoryArea
          data={allDataPoints}
          interpolation="monotoneX"
          style={{
            data: { fill: "url(#gradientFill)" }
          }}
        />

        {/* Trend Line */}
        <VictoryLine
          data={allDataPoints}
          interpolation="monotoneX"
          style={{
            data: { stroke: Colors.primary, strokeWidth: 3 }
          }}
        />

        {/* Data Points */}
        <VictoryScatter
          data={allDataPoints}
          size={4}
          style={{
            data: {
              fill: ({ datum }) => {
                if (datum.status?.toUpperCase() === 'NORMAL') return Colors.success;
                if (datum.status?.toUpperCase() === 'HIGH' || datum.status?.toUpperCase() === 'LOW') return Colors.error;
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
