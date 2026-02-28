/**
 * LabReportDetailScreen
 * Interactive lab report viewer with charts and trend analysis
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Colors, Sizes, Typography } from '../constants';
import { useLabReportsStore } from '../store/labReportsStore';
import { LabMetricChart } from '../components/charts/LabMetricChart';
import { TrendIndicator } from '../components/charts/TrendIndicator';
import { TimeRangeSelector } from '../components/charts/TimeRangeSelector';
import type { TimeRangeOption, GroupedTestResults } from '../types/labReport';
import { STATUS_COLORS } from '../types/labReport';
import { RootStackParamList } from '../../App';
import ShareModal from '../components/ShareModal';
import * as Sharing from 'expo-sharing';
import { Alert, Share } from 'react-native';

type LabReportDetailNavigationProp = StackNavigationProp<RootStackParamList, 'LabReportDetail'>;
type LabReportDetailRouteProp = RouteProp<RootStackParamList, 'LabReportDetail'>;

interface LabReportDetailScreenProps {
  navigation: LabReportDetailNavigationProp;
  route: LabReportDetailRouteProp;
}

export default function LabReportDetailScreen({
  navigation,
  route,
}: LabReportDetailScreenProps) {
  const { labReportId } = route.params;
  const {
    loadSingleLabReport,
    getSummary,
    getMetricTimeSeries,
    isLoading,
    error,
  } = useLabReportsStore();

  const [labReport, setLabReport] = useState<any>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeOption>('6m');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loadingCharts, setLoadingCharts] = useState<Set<string>>(new Set());
  const [chartDataCache, setChartDataCache] = useState<Map<string, any>>(new Map());
  const [showShareModal, setShowShareModal] = useState(false);

  // Load lab report
  useEffect(() => {
    const loadReport = async () => {
      const report = await loadSingleLabReport(labReportId);
      setLabReport(report);

      // Expand all categories by default
      if (report) {
        const categories = new Set(report.test_results.map((r: any) => r.category));
        setExpandedCategories(categories);
      }
    };

    loadReport();
  }, [labReportId]);

  // Get summary
  const summary = labReport ? getSummary(labReportId) : null;

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle share button - Open share modal
  const handleShare = () => {
    setShowShareModal(true);
  };

  // Handle share document file
  const handleShareDocument = async () => {
    // For lab reports, we would need the document file path
    // Since LabReportDetailScreen doesn't have direct access to the document,
    // we'll share a summary for now
    Alert.alert(
      'Share Lab Report',
      'Lab report document sharing will be available soon. Please use "Share Analysis" to share the report details.',
      [{ text: 'OK' }]
    );
  };

  // Handle share analysis text
  const handleShareAnalysis = async () => {
    if (!labReport || !summary) {
      Alert.alert('Error', 'No lab report data available to share');
      return;
    }

    try {
      // Build formatted text for lab report
      let shareText = '';

      // Header
      shareText += `Lab Report Analysis\n`;
      shareText += `${'='.repeat(40)}\n\n`;

      // Lab Info
      if (labReport.lab_name) {
        shareText += `Lab: ${labReport.lab_name}\n`;
      }
      if (labReport.report_date) {
        shareText += `Date: ${new Date(labReport.report_date).toLocaleDateString()}\n`;
      }
      shareText += `\n`;

      // Summary
      shareText += `Summary:\n`;
      shareText += `Total Tests: ${summary.totalTests}\n`;
      if (summary.criticalCount > 0) {
        shareText += `Critical: ${summary.criticalCount}\n`;
      }
      if (summary.abnormalCount > 0) {
        shareText += `Abnormal: ${summary.abnormalCount}\n`;
      }
      if (summary.highCount > 0) {
        shareText += `High: ${summary.highCount}\n`;
      }
      if (summary.lowCount > 0) {
        shareText += `Low: ${summary.lowCount}\n`;
      }
      if (summary.borderlineCount > 0) {
        shareText += `Borderline: ${summary.borderlineCount}\n`;
      }
      shareText += `Normal: ${summary.normalCount}\n\n`;

      // Test Results by Category
      shareText += `Test Results:\n`;
      summary.groupedResults.forEach((group: GroupedTestResults) => {
        shareText += `\n${group.category}:\n`;
        group.testResults.forEach((result: any) => {
          shareText += `  • ${result.test_name}: ${result.result_value}`;
          if (result.unit) shareText += ` ${result.unit}`;
          if (result.abnormal_flag) {
            const statusMap: Record<string, string> = {
              'C': 'CRITICAL',
              'H': 'HIGH',
              'L': 'LOW',
              'B': 'BORDERLINE',
              'A': 'ABNORMAL'
            };
            const status = statusMap[result.abnormal_flag] || result.abnormal_flag;
            shareText += ` [${status}]`;
          }
          shareText += `\n`;
          if (result.reference_range) {
            shareText += `    Reference: ${result.reference_range}\n`;
          }
        });
      });

      // Footer
      shareText += `\n${'='.repeat(40)}\n`;
      shareText += `Generated by dosiqAi`;

      // Share using React Native Share API
      await Share.share({
        message: shareText,
        title: 'Lab Report Analysis',
      });
    } catch (error) {
      console.error('Error sharing lab report analysis:', error);
      Alert.alert('Error', 'Failed to share lab report analysis');
    }
  };

  // Render status pill
  const renderStatusPill = (label: string, count: number, status: keyof typeof STATUS_COLORS) => {
    if (count === 0) return null;

    return (
      <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[status].light }]}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status].primary }]} />
        <Text style={[styles.statusPillText, { color: STATUS_COLORS[status].dark }]}>
          {count} {label}
        </Text>
      </View>
    );
  };

  // Render metric card with chart
  const renderMetricCard = (result: any) => {
    const isLoading = loadingCharts.has(result.test_code);
    const hasChartData = chartDataCache.has(result.test_code);
    const chartData = chartDataCache.get(result.test_code);

    // Load time series data for this metric
    const loadChartData = async () => {
      if (!labReport) return;

      setLoadingCharts((prev) => new Set(prev).add(result.test_code));

      const timeSeriesData = await getMetricTimeSeries(
        labReport.family_member_id,
        result.test_code,
        selectedTimeRange
      );

      setLoadingCharts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(result.test_code);
        return newSet;
      });

      if (timeSeriesData) {
        setChartDataCache((prev) => new Map(prev).set(result.test_code, timeSeriesData));
      }

      return timeSeriesData;
    };

    // Auto-load chart data when metric card is rendered
    useEffect(() => {
      if (result.result_numeric !== null && !hasChartData && !isLoading) {
        loadChartData();
      }
    }, [result.test_code]);

    return (
      <View key={result.id} style={styles.metricCard}>
        {/* Metric Header */}
        <View style={styles.metricHeader}>
          <View style={styles.metricHeaderLeft}>
            <Text style={styles.metricName}>{result.test_name}</Text>
            {result.test_code && (
              <Text style={styles.metricCode}>({result.test_code})</Text>
            )}
          </View>

          {/* Status Badge */}
          {result.abnormal_flag && (
            <View
              style={[
                styles.statusBadge,
                (result.abnormal_flag === 'C' || result.abnormal_flag === 'CRITICAL') && { backgroundColor: STATUS_COLORS.critical.light },
                (result.abnormal_flag === 'H' || result.abnormal_flag === 'HIGH') && { backgroundColor: STATUS_COLORS.high.light },
                (result.abnormal_flag === 'L' || result.abnormal_flag === 'LOW') && { backgroundColor: STATUS_COLORS.low.light },
                (result.abnormal_flag === 'B' || result.abnormal_flag === 'BORDERLINE') && { backgroundColor: STATUS_COLORS.borderline.light },
                (result.abnormal_flag === 'A' || result.abnormal_flag === 'ABNORMAL') && { backgroundColor: STATUS_COLORS.abnormal.light },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  (result.abnormal_flag === 'C' || result.abnormal_flag === 'CRITICAL') && { color: STATUS_COLORS.critical.dark },
                  (result.abnormal_flag === 'H' || result.abnormal_flag === 'HIGH') && { color: STATUS_COLORS.high.dark },
                  (result.abnormal_flag === 'L' || result.abnormal_flag === 'LOW') && { color: STATUS_COLORS.low.dark },
                  (result.abnormal_flag === 'B' || result.abnormal_flag === 'BORDERLINE') && { color: STATUS_COLORS.borderline.dark },
                  (result.abnormal_flag === 'A' || result.abnormal_flag === 'ABNORMAL') && { color: STATUS_COLORS.abnormal.dark },
                ]}
              >
                {(() => {
                  const statusMap: Record<string, string> = {
                    'C': 'CRITICAL',
                    'H': 'HIGH',
                    'L': 'LOW',
                    'B': 'BORDERLINE',
                    'A': 'ABNORMAL'
                  };
                  return statusMap[result.abnormal_flag] || result.abnormal_flag;
                })()}
              </Text>
            </View>
          )}

          {/* Trend Indicator */}
          {result.trend && result.change_percentage !== null && (
            <TrendIndicator
              trend={result.trend}
              changePercentage={result.change_percentage}
              size="small"
            />
          )}
        </View>

        {/* Current Value */}
        <Text style={styles.metricValue}>
          {result.result_value} {result.unit || ''}
        </Text>

        {/* Reference Range */}
        {result.reference_range && (
          <Text style={styles.metricReference}>Reference: {result.reference_range}</Text>
        )}

        {/* Mini Chart - Load on demand */}
        {result.result_numeric !== null && (
          <View style={styles.chartContainer}>
            {isLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.chartLoadingText}>Loading chart...</Text>
              </View>
            ) : chartData ? (
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('LabMetricTrend', {
                    testResultId: result.id,
                    familyMemberId: labReport.family_member_id,
                    testCode: result.test_code,
                    testName: result.test_name,
                  });
                }}
                activeOpacity={0.7}
              >
                <LabMetricChart
                  data={chartData}
                  height={120}
                  showReferenceZone={true}
                  showMultiZone={false}
                  enableTooltips={false}
                  enableZoom={false}
                />
                <View style={styles.chartViewFullButton}>
                  <Text style={styles.chartViewFullButtonText}>View Full Trend</Text>
                  <Feather name="arrow-right" size={14} color={Colors.primary} />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.chartPlaceholder}
                onPress={loadChartData}
              >
                <Text style={styles.chartPlaceholderText}>Tap to load trend chart</Text>
                <Feather name="trending-up" size={20} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // Render category section
  const renderCategory = (groupedResult: GroupedTestResults) => {
    const isExpanded = expandedCategories.has(groupedResult.category);

    return (
      <View key={groupedResult.category} style={styles.categorySection}>
        {/* Category Header */}
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(groupedResult.category)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryHeaderLeft}>
            <Text style={styles.categoryTitle}>{groupedResult.category}</Text>
            <Text style={styles.categoryCount}>
              {groupedResult.testResults.length} tests
            </Text>
          </View>

          <View style={styles.categoryHeaderRight}>
            {groupedResult.criticalCount > 0 && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{groupedResult.criticalCount} critical</Text>
              </View>
            )}
            <Feather
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={Colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {/* Category Content */}
        {isExpanded && (
          <View style={styles.categoryContent}>
            {groupedResult.testResults.map(renderMetricCard)}
          </View>
        )}
      </View>
    );
  };

  if (isLoading || !labReport || !summary) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lab Report</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading lab report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Lab Report
        </Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Feather name="share-2" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Report Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="hospital-building" size={20} color={Colors.primary} />
            <Text style={styles.infoLabel}>Lab:</Text>
            <Text style={styles.infoValue}>{labReport.lab_name || 'Unknown'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar" size={20} color={Colors.primary} />
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>
              {new Date(labReport.report_date).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="test-tube" size={20} color={Colors.primary} />
            <Text style={styles.infoLabel}>Total Tests:</Text>
            <Text style={styles.infoValue}>{summary.totalTests}</Text>
          </View>
        </View>

        {/* Status Summary */}
        <View style={styles.statusSummary}>
          <Text style={styles.statusSummaryTitle}>Status Summary</Text>
          <View style={styles.statusPillsContainer}>
            {renderStatusPill('Critical', summary.criticalCount, 'critical')}
            {renderStatusPill('Abnormal', summary.abnormalCount, 'abnormal')}
            {renderStatusPill('High', summary.highCount, 'high')}
            {renderStatusPill('Low', summary.lowCount, 'low')}
            {renderStatusPill('Borderline', summary.borderlineCount, 'borderline')}
            {renderStatusPill('Normal', summary.normalCount, 'normal')}
          </View>
        </View>

        {/* Time Range Selector */}
        {summary.hasHistoricalData && (
          <TimeRangeSelector
            selectedRange={selectedTimeRange}
            onRangeChange={setSelectedTimeRange}
          />
        )}

        {/* Categories */}
        <View style={styles.categoriesContainer}>
          {summary.groupedResults.map(renderCategory)}
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentType="report"
        onShareDocument={handleShareDocument}
        onShareAnalysis={handleShareAnalysis}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizes.contentPadding,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.h3,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: 8,
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
  scrollView: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.white,
    margin: Sizes.md,
    padding: Sizes.md,
    borderRadius: 12,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  statusSummary: {
    backgroundColor: Colors.white,
    marginHorizontal: Sizes.contentPadding,
    marginBottom: Sizes.md,
    padding: Sizes.md,
    borderRadius: 12,
  },
  statusSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  statusPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoriesContainer: {
    marginHorizontal: Sizes.contentPadding,
    gap: 12,
  },
  categorySection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Sizes.md,
    backgroundColor: Colors.gray50,
  },
  categoryHeaderLeft: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: STATUS_COLORS.critical.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: STATUS_COLORS.critical.dark,
  },
  categoryContent: {
    padding: Sizes.md,
    gap: 12,
  },
  metricCard: {
    padding: 12,
    backgroundColor: Colors.gray50,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  metricHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  metricName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  metricCode: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  metricReference: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  chartContainer: {
    marginTop: 8,
  },
  chartLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  chartLoadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chartPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderStyle: 'dashed',
    gap: 8,
  },
  chartPlaceholderText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  chartViewFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 6,
    gap: 4,
  },
  chartViewFullButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
});
