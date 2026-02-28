import { useRouter, useLocalSearchParams } from 'expo-router';
/**
 * LabMetricTrendScreen
 * Full-screen interactive chart for detailed analysis of a single lab metric
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Colors, Sizes } from '../src/constants';
import { useLabReportsStore } from '../src/store/labReportsStore';
import { LabMetricChart } from '../src/components/charts/LabMetricChart';
import { TrendIndicator } from '../src/components/charts/TrendIndicator';
import { TimeRangeSelector } from '../src/components/charts/TimeRangeSelector';
import type { TimeRangeOption, TimeSeriesData } from '../src/types/labReport';
import { STATUS_COLORS } from '../src/types/labReport';
import { exportTimeSeriesAsCSV } from '../src/services/labAnalyticsService';

import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';

type LabMetricTrendNavigationProp = StackNavigationProp<RootStackParamList, 'LabMetricTrend'>;
type LabMetricTrendRouteProp = RouteProp<RootStackParamList, 'LabMetricTrend'>;

interface LabMetricTrendScreenProps {
  navigation: LabMetricTrendNavigationProp;
  route: LabMetricTrendRouteProp;
}

export default function LabMetricTrendScreen({
  navigation,
  route,
}: LabMetricTrendScreenProps) {
  const { testResultId, familyMemberId, testCode, testName } = useLocalSearchParams();

  const { getMetricTimeSeries, getAnnotationsForTestResult, addAnnotation, isLoading, error } =
    useLabReportsStore();

  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeOption>('6m');
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load time series data
  useEffect(() => {
    loadData();
  }, [testCode, familyMemberId, selectedTimeRange]);

  // Load annotations
  useEffect(() => {
    loadAnnotations();
  }, [testResultId]);

  const loadData = async () => {
    const data = await getMetricTimeSeries(familyMemberId, testCode, selectedTimeRange);
    setTimeSeriesData(data);
  };

  const loadAnnotations = async () => {
    const annots = await getAnnotationsForTestResult(testResultId);
    setAnnotations(annots);
  };

  const handleExportData = async () => {
    if (!timeSeriesData) return;

    try {
      setExporting(true);

      // Generate CSV
      const csv = exportTimeSeriesAsCSV(timeSeriesData);

      // Save to file using new expo-file-system API
      const fileName = `${testName.replace(/\s+/g, '_')}_trend_${new Date().toISOString().split('T')[0]}.csv`;
      const file = new File(Paths.document, fileName);

      // Write content to file
      await file.write(csv);

      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${testName} Data`,
        });
      } else {
        Alert.alert('Success', `Data exported to ${fileName}`);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleAddAnnotation = () => {
    Alert.prompt(
      'Add Note',
      'Add a note about this metric (e.g., medication change, symptoms)',
      async (text) => {
        if (text && text.trim()) {
          await addAnnotation(testResultId, text.trim(), 'other');
          loadAnnotations();
        }
      },
      'plain-text'
    );
  };

  if (isLoading || !timeSeriesData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{testName}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading trend data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const latestValue = timeSeriesData.latestValue;
  const hasMultiplePoints = timeSeriesData.dataPoints.length > 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {testName}
          </Text>
          <Text style={styles.headerSubtitle}>{testCode}</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={handleExportData}>
          {exporting ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Feather name="download" size={20} color={Colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Time Range Selector */}
        <TimeRangeSelector
          selectedRange={selectedTimeRange}
          onRangeChange={setSelectedTimeRange}
        />

        {/* Chart */}
        <View style={styles.chartSection}>
          <LabMetricChart
            data={timeSeriesData}
            height={300}
            showReferenceZone={true}
            showMultiZone={true}
            enableZoom={hasMultiplePoints}
            enableTooltips={true}
            colorBlindMode={false}
          />

          {hasMultiplePoints && (
            <View style={styles.chartHint}>
              <MaterialCommunityIcons name="gesture-pinch" size={16} color={Colors.textSecondary} />
              <Text style={styles.chartHintText}>Pinch to zoom • Swipe to pan • Tap for details</Text>
            </View>
          )}
        </View>

        {/* Latest Value Card */}
        <View style={styles.latestValueCard}>
          <Text style={styles.sectionTitle}>Latest Value</Text>

          <View style={styles.valueRow}>
            <View style={styles.valueMain}>
              <Text style={styles.valueNumber}>
                {latestValue?.value} {timeSeriesData.unit}
              </Text>
              {latestValue?.status && latestValue.status !== 'normal' && (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        STATUS_COLORS[latestValue.status as keyof typeof STATUS_COLORS].light,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          STATUS_COLORS[latestValue.status as keyof typeof STATUS_COLORS].dark,
                      },
                    ]}
                  >
                    {latestValue.status.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {timeSeriesData.trend && timeSeriesData.changePercentage !== null && (
              <TrendIndicator
                trend={timeSeriesData.trend}
                changePercentage={timeSeriesData.changePercentage}
                size="large"
                showLabel={true}
              />
            )}
          </View>

          {latestValue?.date && (
            <Text style={styles.valueDate}>
              Last tested: {new Date(latestValue.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          )}

          {timeSeriesData.referenceRange && (
            <View style={styles.referenceRangeInfo}>
              <MaterialCommunityIcons name="chart-line-variant" size={16} color={Colors.primary} />
              <Text style={styles.referenceRangeText}>
                Reference: {timeSeriesData.referenceRange.min}-{timeSeriesData.referenceRange.max}{' '}
                {timeSeriesData.referenceRange.unit}
              </Text>
            </View>
          )}
        </View>

        {/* Statistics */}
        {hasMultiplePoints && (
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Data Points</Text>
                <Text style={styles.statValue}>{timeSeriesData.dataPoints.length}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Highest</Text>
                <Text style={styles.statValue}>
                  {Math.max(...timeSeriesData.dataPoints.map((p) => p.value)).toFixed(1)}{' '}
                  {timeSeriesData.unit}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Lowest</Text>
                <Text style={styles.statValue}>
                  {Math.min(...timeSeriesData.dataPoints.map((p) => p.value)).toFixed(1)}{' '}
                  {timeSeriesData.unit}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Average</Text>
                <Text style={styles.statValue}>
                  {(
                    timeSeriesData.dataPoints.reduce((sum, p) => sum + p.value, 0) /
                    timeSeriesData.dataPoints.length
                  ).toFixed(1)}{' '}
                  {timeSeriesData.unit}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Annotations */}
        <View style={styles.annotationsCard}>
          <View style={styles.annotationsHeader}>
            <Text style={styles.sectionTitle}>Your Notes ({annotations.length})</Text>
            <TouchableOpacity style={styles.addNoteButton} onPress={handleAddAnnotation}>
              <Feather name="plus" size={16} color={Colors.primary} />
              <Text style={styles.addNoteButtonText}>Add Note</Text>
            </TouchableOpacity>
          </View>

          {annotations.length > 0 ? (
            <View style={styles.annotationsList}>
              {annotations.map((annotation) => (
                <View key={annotation.id} style={styles.annotationItem}>
                  <MaterialCommunityIcons name="note-text" size={16} color={Colors.primary} />
                  <View style={styles.annotationContent}>
                    <Text style={styles.annotationText}>{annotation.note}</Text>
                    <Text style={styles.annotationDate}>
                      {new Date(annotation.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noAnnotationsText}>
              No notes yet. Add notes to track medication changes, symptoms, or other events.
            </Text>
          )}
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizes.md,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  chartSection: {
    marginHorizontal: Sizes.md,
    marginTop: Sizes.md,
  },
  chartHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
  },
  chartHintText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  latestValueCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Sizes.md,
    marginTop: Sizes.md,
    padding: Sizes.md,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  valueMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  valueNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  valueDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  referenceRangeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  referenceRangeText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Sizes.md,
    marginTop: Sizes.md,
    padding: Sizes.md,
    borderRadius: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    backgroundColor: Colors.gray50,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  annotationsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Sizes.md,
    marginTop: Sizes.md,
    padding: Sizes.md,
    borderRadius: 12,
  },
  annotationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.gray50,
    borderRadius: 16,
  },
  addNoteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  annotationsList: {
    gap: 12,
  },
  annotationItem: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: Colors.gray50,
    borderRadius: 8,
  },
  annotationContent: {
    flex: 1,
  },
  annotationText: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  annotationDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  noAnnotationsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});
