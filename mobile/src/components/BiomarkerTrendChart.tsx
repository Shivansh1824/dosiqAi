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
import { Defs, LinearGradient, Stop } from 'react-native-svg';
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
  // Chart dimensions - accounting for screen padding (Sizes.md * 2) and card padding (Sizes.md * 2)
  const chartWidth = SCREEN_WIDTH - (Sizes.md * 4); 
  const chartHeight = 150; // Slightly increased height for better visibility

  // Parse reference values as numbers
  const refMin = currentTest.ref_min != null ? Number(currentTest.ref_min) : null;
  const refMax = currentTest.ref_max != null ? Number(currentTest.ref_max) : null;

  const hasRefMin = refMin !== null && !isNaN(refMin);
  const hasRefMax = refMax !== null && !isNaN(refMax);

  // Calculate Y-axis domain for better scaling
  const values = allDataPoints.map(p => p.y);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  
  const boundaries = [dataMin, dataMax];
  if (hasRefMin) boundaries.push(refMin as number);
  if (hasRefMax) boundaries.push(refMax as number);
  
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
        padding={{ top: 5, bottom: 35, left: 15, right: 15 }} // Centered horizontal padding since labels are now inside
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

        {/* Shaded Normal Range Area (Green) */}
        {(hasRefMin || hasRefMax) && (
          <VictoryArea
            data={[
              { 
                x: allDataPoints[0].x, 
                y: hasRefMax ? (refMax as number) : domainY[1], 
                y0: hasRefMin ? (refMin as number) : (hasRefMax ? 0 : domainY[0]) 
              },
              { 
                x: allDataPoints[allDataPoints.length - 1].x, 
                y: hasRefMax ? (refMax as number) : domainY[1], 
                y0: hasRefMin ? (refMin as number) : (hasRefMax ? 0 : domainY[0])
              }
            ]}
            style={{
              data: { 
                fill: Colors.successLight, 
                fillOpacity: 0.35
              }
            }}
          />
        )}

        {/* Shaded Danger Area - Above Max (Red) */}
        {hasRefMax && (
          <VictoryArea
            data={[
              { x: allDataPoints[0].x, y: domainY[1], y0: refMax as number },
              { x: allDataPoints[allDataPoints.length - 1].x, y: domainY[1], y0: refMax as number }
            ]}
            style={{
              data: { 
                fill: Colors.errorLight, 
                fillOpacity: 0.35
              }
            }}
          />
        )}

        {/* Shaded Danger Area - Below Min (Red) */}
        {hasRefMin && (
          <VictoryArea
            data={[
              { x: allDataPoints[0].x, y: refMin as number, y0: domainY[0] },
              { x: allDataPoints[allDataPoints.length - 1].x, y: refMin as number, y0: domainY[0] }
            ]}
            style={{
              data: { 
                fill: Colors.errorLight, 
                fillOpacity: 0.35
              }
            }}
          />
        )}

        {/* Reference Lines boundaries */}
        {hasRefMin && (
          <VictoryLine
            data={[
              { x: allDataPoints[0].x, y: refMin as number },
              { x: allDataPoints[allDataPoints.length - 1].x, y: refMin as number }
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
        {hasRefMax && (
          <VictoryLine
            data={[
              { x: allDataPoints[0].x, y: refMax as number },
              { x: allDataPoints[allDataPoints.length - 1].x, y: refMax as number }
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
        {hasRefMin && (
          <VictoryLabel
            text={refMin as number}
            datum={{ x: allDataPoints[allDataPoints.length - 1].x, y: refMin as number }}
            textAnchor="end"
            dx={-10}
            style={{ 
              fill: Colors.successDark, 
              fontSize: 9, 
              fontFamily: 'PlusJakartaSans-Bold',
              opacity: 0.8
            }}
          />
        )}
        {hasRefMax && (
          <VictoryLabel
            text={refMax as number}
            datum={{ x: allDataPoints[allDataPoints.length - 1].x, y: refMax as number }}
            textAnchor="end"
            dx={-10}
            style={{ 
              fill: Colors.successDark, 
              fontSize: 9, 
              fontFamily: 'PlusJakartaSans-Bold',
              opacity: 0.8
            }}
          />
        )}



        <Defs>
          <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.primary} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={Colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Shaded Area under the line */}
        <VictoryArea
          data={allDataPoints}
          interpolation="monotoneX"
          style={{
            data: { fill: "url(#chartGradient)" }
          }}
        />

        {/* Trend Line */}
        <VictoryLine
          data={allDataPoints}
          interpolation="monotoneX"
          style={{
            data: { 
              stroke: Colors.primary, 
              strokeWidth: 3.5,
              strokeLinecap: 'round'
            }
          }}
        />

        {/* Data Points */}
        <VictoryScatter
          data={allDataPoints}
          size={5.5}
          style={{
            data: {
              fill: ({ datum }) => {
                const status = datum.status?.toUpperCase();
                if (status === 'NORMAL') return Colors.success;
                if (status === 'HIGH' || status === 'LOW') return Colors.error;
                return Colors.warning;
              },
              stroke: Colors.white,
              strokeWidth: 2.5
            }
          }}
        />
      </VictoryChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
