/**
 * Lab Reports Store
 * Zustand store for managing lab reports, test results, and chart preferences
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import type {
  LabReport,
  TestResult,
  ChartPreferences,
  MetricAnnotation,
  LabReportSummary,
  LabReportWithResults,
  TimeSeriesData,
  TimeRangeOption,
  GroupedTestResults,
} from '../types/labReport';

// ============================================================================
// Store State Interface
// ============================================================================

interface LabReportsState {
  // Data
  labReports: LabReportWithResults[];
  chartPreferences: ChartPreferences | null;
  selectedLabReportId: string | null;
  timeSeriesCache: Map<string, TimeSeriesData>; // Cache key: `${familyMemberId}:${testCode}:${timeRange}`

  // Loading States
  isLoading: boolean;
  isSyncing: boolean;
  isAnalyzingTrends: boolean;

  // Error State
  error: string | null;

  // Actions
  loadLabReports: (familyMemberId: string, forceRefresh?: boolean) => Promise<void>;
  loadSingleLabReport: (labReportId: string) => Promise<LabReportWithResults | null>;
  getSummary: (labReportId: string) => LabReportSummary | null;
  getGroupedResults: (labReportId: string) => GroupedTestResults[];

  // Chart Preferences
  loadChartPreferences: (userId: string, familyMemberId: string | null) => Promise<void>;
  updateChartPreferences: (preferences: Partial<ChartPreferences>) => Promise<void>;

  // Annotations
  addAnnotation: (
    testResultId: string,
    note: string,
    eventType: MetricAnnotation['event_type']
  ) => Promise<void>;
  getAnnotationsForTestResult: (testResultId: string) => Promise<MetricAnnotation[]>;

  // Time Series Data
  getMetricTimeSeries: (
    familyMemberId: string,
    testCode: string,
    timeRange: TimeRangeOption
  ) => Promise<TimeSeriesData | null>;
  clearTimeSeriesCache: () => void;

  // Utility
  setSelectedLabReport: (labReportId: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Cache Keys
// ============================================================================

const CACHE_KEYS = {
  LAB_REPORTS: (familyMemberId: string) => `lab_reports:${familyMemberId}`,
  CHART_PREFERENCES: (userId: string, familyMemberId: string | null) =>
    `chart_preferences:${userId}:${familyMemberId || 'null'}`,
  TIME_SERIES: (familyMemberId: string, testCode: string, timeRange: TimeRangeOption) =>
    `metric_trend:${familyMemberId}:${testCode}:${timeRange}`,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Group test results by category
 */
function groupTestResultsByCategory(testResults: TestResult[]): GroupedTestResults[] {
  const grouped = testResults.reduce((acc, result) => {
    const category = result.category || 'Other';
    if (!acc[category]) {
      acc[category] = {
        category,
        testResults: [],
        abnormalCount: 0,
        criticalCount: 0,
      };
    }
    acc[category].testResults.push(result);

    // Count abnormal results
    if (result.abnormal_flag) {
      acc[category].abnormalCount++;
      if (
        result.abnormal_flag === 'C' ||
        result.abnormal_flag === 'CC' ||
        result.abnormal_flag === 'CRITICAL'
      ) {
        acc[category].criticalCount++;
      } else if (
        result.abnormal_flag === 'A' ||
        result.abnormal_flag === 'ABNORMAL'
      ) {
        acc[category].abnormalCount++;
      }
    }

    return acc;
  }, {} as Record<string, GroupedTestResults>);

  return Object.values(grouped).sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * Calculate summary statistics for a lab report
 */
function calculateSummary(labReport: LabReportWithResults): LabReportSummary {
  const groupedResults = groupTestResultsByCategory(labReport.test_results);

  const summary: LabReportSummary = {
    labReport,
    groupedResults,
    totalTests: labReport.test_results.length,
    normalCount: 0,
    highCount: 0,
    lowCount: 0,
    criticalCount: 0,
    borderlineCount: 0,
    abnormalCount: 0,
    hasHistoricalData: false,
  };

  labReport.test_results.forEach((result) => {
    // Check if this result has historical data
    if (result.previous_value !== null) {
      summary.hasHistoricalData = true;
    }

    // Count by status
    if (!result.abnormal_flag || result.abnormal_flag === '') {
      summary.normalCount++;
    } else if (
      result.abnormal_flag === 'CRITICAL' ||
      result.abnormal_flag === 'C'
    ) {
      summary.criticalCount++;
    } else if (
      result.abnormal_flag === 'HIGH' ||
      result.abnormal_flag === 'H'
    ) {
      summary.highCount++;
    } else if (
      result.abnormal_flag === 'LOW' ||
      result.abnormal_flag === 'L'
    ) {
      summary.lowCount++;
    } else if (
      result.abnormal_flag === 'BORDERLINE' ||
      result.abnormal_flag === 'B'
    ) {
      // @ts-ignore: added borderlineCount to summary
      summary.borderlineCount++;
    } else if (
      result.abnormal_flag === 'ABNORMAL' ||
      result.abnormal_flag === 'A'
    ) {
      // @ts-ignore: added abnormalCount to summary
      summary.abnormalCount++;
    }
  });

  return summary;
}

// ============================================================================
// Zustand Store
// ============================================================================

export const useLabReportsStore = create<LabReportsState>((set, get) => ({
  // Initial State
  labReports: [],
  chartPreferences: null,
  selectedLabReportId: null,
  timeSeriesCache: new Map(),
  isLoading: false,
  isSyncing: false,
  isAnalyzingTrends: false,
  error: null,

  // ======================================
  // Load Lab Reports
  // ======================================
  loadLabReports: async (familyMemberId: string, forceRefresh = false) => {
    try {
      set({ isLoading: true, error: null });

      // Cache-first approach (if not force refresh)
      if (!forceRefresh) {
        const cacheKey = CACHE_KEYS.LAB_REPORTS(familyMemberId);
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const labReports = JSON.parse(cached) as LabReportWithResults[];
          set({ labReports, isLoading: false });

          // Background refresh
          get().loadLabReports(familyMemberId, true);
          return;
        }
      }

      // Fetch from Supabase
      const { data: labReportsData, error: labReportsError } = await supabase
        .from('lab_reports')
        .select('*')
        .eq('family_member_id', familyMemberId)
        .order('report_date', { ascending: false });

      if (labReportsError) throw labReportsError;

      // Fetch test results for each lab report
      const labReportsWithResults: LabReportWithResults[] = await Promise.all(
        (labReportsData || []).map(async (report) => {
          const { data: testResults, error: testResultsError } = await supabase
            .from('test_results')
            .select('*')
            .eq('lab_report_id', report.id)
            .order('category', { ascending: true })
            .order('test_name', { ascending: true });

          if (testResultsError) throw testResultsError;

          return {
            ...report,
            test_results: testResults || [],
          };
        })
      );

      // Cache the results
      const cacheKey = CACHE_KEYS.LAB_REPORTS(familyMemberId);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(labReportsWithResults));

      set({ labReports: labReportsWithResults, isLoading: false });
    } catch (error) {
      console.error('Error loading lab reports:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load lab reports',
        isLoading: false,
      });
    }
  },

  // ======================================
  // Load Single Lab Report
  // ======================================
  loadSingleLabReport: async (labReportId: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data: labReport, error: labReportError } = await supabase
        .from('lab_reports')
        .select('*')
        .eq('id', labReportId)
        .single();

      if (labReportError) throw labReportError;

      const { data: testResults, error: testResultsError } = await supabase
        .from('test_results')
        .select('*')
        .eq('lab_report_id', labReportId)
        .order('category', { ascending: true })
        .order('test_name', { ascending: true });

      if (testResultsError) throw testResultsError;

      const labReportWithResults: LabReportWithResults = {
        ...labReport,
        test_results: testResults || [],
      };

      set({ isLoading: false });
      return labReportWithResults;
    } catch (error) {
      console.error('Error loading lab report:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load lab report',
        isLoading: false,
      });
      return null;
    }
  },

  // ======================================
  // Get Summary
  // ======================================
  getSummary: (labReportId: string) => {
    const labReport = get().labReports.find((r) => r.id === labReportId);
    if (!labReport) return null;
    return calculateSummary(labReport);
  },

  // ======================================
  // Get Grouped Results
  // ======================================
  getGroupedResults: (labReportId: string) => {
    const labReport = get().labReports.find((r) => r.id === labReportId);
    if (!labReport) return [];
    return groupTestResultsByCategory(labReport.test_results);
  },

  // ======================================
  // Chart Preferences
  // ======================================
  loadChartPreferences: async (userId: string, familyMemberId: string | null) => {
    try {
      // Try cache first
      const cacheKey = CACHE_KEYS.CHART_PREFERENCES(userId, familyMemberId);
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        set({ chartPreferences: JSON.parse(cached) });
      }

      // Fetch from Supabase
      let query = supabase.from('chart_preferences').select('*').eq('user_id', userId);

      if (familyMemberId) {
        query = query.eq('family_member_id', familyMemberId);
      } else {
        query = query.is('family_member_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (data) {
        set({ chartPreferences: data });
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } else {
        // Create default preferences
        const defaultPrefs: Omit<ChartPreferences, 'id' | 'created_at' | 'updated_at'> = {
          user_id: userId,
          family_member_id: familyMemberId,
          default_chart_type: 'line',
          default_time_range: '6m',
          show_reference_ranges: true,
          show_annotations: true,
          color_blind_mode: false,
          pinned_metrics: null,
        };

        const { data: newPrefs, error: insertError } = await supabase
          .from('chart_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (insertError) throw insertError;

        set({ chartPreferences: newPrefs });
        await AsyncStorage.setItem(cacheKey, JSON.stringify(newPrefs));
      }
    } catch (error) {
      console.error('Error loading chart preferences:', error);
      // Use default preferences on error
      set({
        chartPreferences: {
          id: 'default',
          user_id: userId,
          family_member_id: familyMemberId,
          default_chart_type: 'line',
          default_time_range: '6m',
          show_reference_ranges: true,
          show_annotations: true,
          color_blind_mode: false,
          pinned_metrics: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }
  },

  updateChartPreferences: async (preferences: Partial<ChartPreferences>) => {
    try {
      const current = get().chartPreferences;
      if (!current) throw new Error('No chart preferences loaded');

      const { error } = await supabase
        .from('chart_preferences')
        .update(preferences)
        .eq('id', current.id);

      if (error) throw error;

      const updated = { ...current, ...preferences, updated_at: new Date().toISOString() };
      set({ chartPreferences: updated });

      // Update cache
      const cacheKey = CACHE_KEYS.CHART_PREFERENCES(current.user_id, current.family_member_id);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating chart preferences:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to update preferences',
      });
    }
  },

  // ======================================
  // Annotations
  // ======================================
  addAnnotation: async (
    testResultId: string,
    note: string,
    eventType: MetricAnnotation['event_type']
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.from('metric_annotations').insert({
        user_id: user.id,
        test_result_id: testResultId,
        note,
        event_type: eventType,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding annotation:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add annotation',
      });
    }
  },

  getAnnotationsForTestResult: async (testResultId: string) => {
    try {
      const { data, error } = await supabase
        .from('metric_annotations')
        .select('*')
        .eq('test_result_id', testResultId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting annotations:', error);
      return [];
    }
  },

  // ======================================
  // Time Series Data
  // ======================================
  getMetricTimeSeries: async (
    familyMemberId: string,
    testCode: string,
    timeRange: TimeRangeOption
  ) => {
    try {
      // Check cache first
      const cacheKey = CACHE_KEYS.TIME_SERIES(familyMemberId, testCode, timeRange);
      const cache = get().timeSeriesCache;

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!;
      }

      // Calculate date range
      const endDate = new Date();
      let startDate = new Date();

      const timeRangeDays: Record<TimeRangeOption, number | null> = {
        '1m': 30,
        '3m': 90,
        '6m': 180,
        '1y': 365,
        all: null,
      };

      const days = timeRangeDays[timeRange];
      if (days !== null) {
        startDate.setDate(endDate.getDate() - days);
      } else {
        startDate = new Date(2000, 0, 1); // Far past for 'all'
      }

      // Fetch from Supabase
      let query = supabase
        .from('test_results')
        .select('*')
        .eq('family_member_id', familyMemberId)
        .eq('test_code', testCode)
        .not('result_numeric', 'is', null)
        .order('measured_at', { ascending: true });

      if (days !== null) {
        query = query.gte('measured_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        return null;
      }

      // Build time series data
      const timeSeriesData: TimeSeriesData = {
        testCode,
        testName: data[0].test_name,
        unit: data[0].unit,
        category: data[0].category,
        dataPoints: data.map((result) => ({
          x: new Date(result.measured_at),
          y: result.result_numeric!,
          label: `${result.result_numeric} ${result.unit || ''}`,
          date: result.measured_at,
          value: result.result_numeric!,
          unit: result.unit,
          status: result.abnormal_flag
            ? result.abnormal_flag === 'CRITICAL' || result.abnormal_flag === 'C'
              ? 'critical'
              : result.abnormal_flag === 'HIGH' || result.abnormal_flag === 'H'
                ? 'high'
                : result.abnormal_flag === 'LOW' || result.abnormal_flag === 'L'
                  ? 'low'
                  : result.abnormal_flag === 'BORDERLINE' || result.abnormal_flag === 'B'
                    ? 'borderline'
                    : result.abnormal_flag === 'ABNORMAL' || result.abnormal_flag === 'A'
                      ? 'abnormal'
                      : 'normal'
            : 'normal',
          abnormalFlag: result.abnormal_flag,
          labReportId: result.lab_report_id,
          testResultId: result.id,
        })),
        referenceRange: null, // Will be parsed from first result
        latestValue: null, // Will be set to last data point
        trend: data[data.length - 1].trend as any,
        changePercentage: data[data.length - 1].change_percentage,
      };

      // Parse reference range from first result
      if (data[0].reference_range) {
        const match = data[0].reference_range.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
        if (match) {
          timeSeriesData.referenceRange = {
            min: parseFloat(match[1]),
            max: parseFloat(match[2]),
            unit: data[0].unit,
            rawString: data[0].reference_range,
          };
        }
      }

      // Set latest value
      timeSeriesData.latestValue = timeSeriesData.dataPoints[timeSeriesData.dataPoints.length - 1];

      // Cache the result
      cache.set(cacheKey, timeSeriesData);
      set({ timeSeriesCache: new Map(cache) });

      // Also cache to AsyncStorage
      await AsyncStorage.setItem(cacheKey, JSON.stringify(timeSeriesData));

      return timeSeriesData;
    } catch (error) {
      console.error('Error getting metric time series:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load time series data',
      });
      return null;
    }
  },

  clearTimeSeriesCache: () => {
    set({ timeSeriesCache: new Map() });
    // Clear AsyncStorage cache (optional, for memory management)
    // This would require iterating through all keys matching the pattern
  },

  // ======================================
  // Utility
  // ======================================
  setSelectedLabReport: (labReportId: string | null) => {
    set({ selectedLabReportId: labReportId });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      labReports: [],
      chartPreferences: null,
      selectedLabReportId: null,
      timeSeriesCache: new Map(),
      isLoading: false,
      isSyncing: false,
      isAnalyzingTrends: false,
      error: null,
    });
  },
}));
