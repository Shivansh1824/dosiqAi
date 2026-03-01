/**
 * Lab Analytics Service
 * Business logic for processing lab data, calculating trends, and preparing chart data
 */
import { from, rpc } from '../lib/apiClient';

import type {
  LabReport,
  TestResult,
  LabReportSummary,
  GroupedTestResults,
  TimeSeriesData,
  TimeRangeOption,
  MetricComparison,
  ReferenceRange,
  TestStatus,
} from '../types/labReport';
import { parseReferenceRange, getTestStatus } from '../types/labReport';
import type { DocumentAnalysisResult } from '../types/document';

// ============================================================================
// Process Lab Report from AI Analysis
// ============================================================================

/**
 * Process a lab report after AI analysis completes
 * Saves to lab_reports and test_results tables, calculates trends
 */
export async function processLabReport(
  documentId: string,
  analysisResult: any,
  userId: string,
  familyMemberId: string
): Promise<{ labReportId: string; testResultIds: string[] } | null> {
  try {
    // Validate that this is a lab report
    if (
      !analysisResult.report_data ||
      !analysisResult.report_data.grouped_metrics ||
      analysisResult.report_data.grouped_metrics.length === 0
    ) {
      console.log('Not a lab report or no metrics found');
      return null;
    }

    // Extract lab report metadata
    const labReportData: Omit<
      LabReport,
      'id' | 'created_at' | 'updated_at'
    > = {
      user_id: userId,
      family_member_id: familyMemberId,
      document_id: documentId,
      lab_name: analysisResult.report_data.lab_name || null,
      report_type: analysisResult.document_type || 'Lab Report',
      report_date: analysisResult.common_data?.visit_date || new Date().toISOString(),
      sample_type: null, // Not extracted by AI currently
      fasting_status: null, // Not extracted by AI currently
      notes: null,
      verified_by_user: false,
    };

    // Insert lab report
    const { data: labReport, error: labReportError } = await from('lab_reports')
      .insert(labReportData)
      .select()
      .single();

    if (labReportError) throw labReportError;

    // Extract and insert test results
    const testResultIds: string[] = [];

    for (const group of analysisResult.report_data.grouped_metrics) {
      for (const metric of group.metrics) {
        // Parse numeric value from result
        const resultNumeric = parseNumericValue(metric.value);

        // Determine abnormal flag from status
        const abnormalFlag = mapStatusToAbnormalFlag(metric.status);

        // Create test result
        const testResultData: Omit<
          TestResult,
          'id' | 'created_at' | 'updated_at' | 'previous_value' | 'change_percentage' | 'trend'
        > = {
          lab_report_id: labReport.id,
          user_id: userId,
          family_member_id: familyMemberId,
          category: group.group_name,
          test_name: metric.metric_name,
          test_code: generateTestCode(metric.metric_name), // Generate standardized code
          result_value: metric.value,
          result_numeric: resultNumeric,
          unit: metric.unit || null,
          reference_range: metric.reference_range || null,
          abnormal_flag: abnormalFlag,
          ai_extracted: true,
          verified_by_user: false,
          notes: null,
          measured_at: labReportData.report_date,
        };

        const { data: testResult, error: testResultError } = await from('test_results')
          .insert(testResultData)
          .select()
          .single();

        if (testResultError) throw testResultError;

        testResultIds.push(testResult.id);

        // Calculate trends for this test result
        await calculateTestResultTrend(testResult.id);
      }
    }

    console.log(
      `Processed lab report ${labReport.id} with ${testResultIds.length} test results`
    );

    return {
      labReportId: labReport.id,
      testResultIds,
    };
  } catch (error) {
    console.error('Error processing lab report:', error);
    return null;
  }
}

// ============================================================================
// Trend Calculation
// ============================================================================

/**
 * Calculate trend for a specific test result by comparing with previous results
 * Calls the API function calculate_test_result_trend
 */
export async function calculateTestResultTrend(testResultId: string): Promise<void> {
  try {
    const { error } = await rpc.call('calculate_test_result_trend', {
      p_test_result_id: testResultId,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error calculating test result trend:', error);
  }
}

/**
 * Recalculate trends for all test results of a family member
 * Useful when reference ranges are updated or corrections are made
 */
export async function recalculateTrendsForFamilyMember(
  familyMemberId: string
): Promise<void> {
  try {
    const { data: testResults, error } = await from('test_results')
      .select('id')
      .eq('family_member_id', familyMemberId)
      .not('result_numeric', 'is', null);

    if (error) throw error;

    // Calculate trends for each result
    for (const result of testResults || []) {
      await calculateTestResultTrend(result.id);
    }

    console.log(`Recalculated trends for ${testResults?.length || 0} test results`);
  } catch (error) {
    console.error('Error recalculating trends:', error);
  }
}

// ============================================================================
// Comparison
// ============================================================================

/**
 * Compare current test result with previous result
 */
export async function compareWithPrevious(
  testResultId: string
): Promise<MetricComparison | null> {
  try {
    const { data: current, error: currentError } = await from('test_results')
      .select('*')
      .eq('id', testResultId)
      .single();

    if (currentError) throw currentError;

    // Get previous result
    const { data: previous, error: previousError } = await from('test_results')
      .select('*')
      .eq('family_member_id', current.family_member_id)
      .eq('test_code', current.test_code)
      .lt('measured_at', current.measured_at)
      .not('result_numeric', 'is', null)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousError) throw previousError;

    const comparison: MetricComparison = {
      current,
      previous: previous || null,
      change: previous ? current.result_numeric! - previous.result_numeric! : null,
      changePercentage: current.change_percentage,
      trend: current.trend as any,
    };

    return comparison;
  } catch (error) {
    console.error('Error comparing test results:', error);
    return null;
  }
}

/**
 * Compare two lab reports side by side
 * Returns array of comparisons for all matching metrics
 */
export async function compareLabReports(
  currentReportId: string,
  previousReportId: string
): Promise<MetricComparison[]> {
  try {
    const { data: currentResults, error: currentError } = await from('test_results')
      .select('*')
      .eq('lab_report_id', currentReportId);

    if (currentError) throw currentError;

    const { data: previousResults, error: previousError } = await from('test_results')
      .select('*')
      .eq('lab_report_id', previousReportId);

    if (previousError) throw previousError;

    const comparisons: MetricComparison[] = [];

    for (const current of currentResults || []) {
      const previous = previousResults?.find((p: any) => p.test_code === current.test_code);

      if (previous && current.result_numeric !== null && previous.result_numeric !== null) {
        const change = current.result_numeric - previous.result_numeric;
        const changePercentage =
          previous.result_numeric !== 0
            ? (change / previous.result_numeric) * 100
            : null;

        comparisons.push({
          current,
          previous,
          change,
          changePercentage,
          trend: current.trend as any,
        });
      }
    }

    return comparisons;
  } catch (error) {
    console.error('Error comparing lab reports:', error);
    return [];
  }
}

// ============================================================================
// Data Export
// ============================================================================

/**
 * Export time series data to CSV format
 */
export function exportTimeSeriesAsCSV(timeSeriesData: TimeSeriesData): string {
  const headers = ['Date', 'Value', 'Unit', 'Status', 'Reference Range'];
  const rows = timeSeriesData.dataPoints.map((point) => [
    new Date(point.date).toLocaleDateString(),
    point.value.toString(),
    point.unit || '',
    point.status || 'normal',
    timeSeriesData.referenceRange?.rawString || '',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csv;
}

/**
 * Export lab report summary to text format
 */
export function exportLabReportSummary(summary: LabReportSummary): string {
  let text = `Lab Report Summary\n`;
  text += `==================\n\n`;
  text += `Lab: ${summary.labReport.lab_name || 'Unknown'}\n`;
  text += `Date: ${new Date(summary.labReport.report_date).toLocaleDateString()}\n`;
  text += `Total Tests: ${summary.totalTests}\n`;
  text += `Normal: ${summary.normalCount}, High: ${summary.highCount}, Low: ${summary.lowCount}, Critical: ${summary.criticalCount}\n\n`;

  for (const group of summary.groupedResults) {
    text += `${group.category}\n`;
    text += `${'-'.repeat(group.category.length)}\n`;
    for (const result of group.testResults) {
      text += `  ${result.test_name}: ${result.result_value} ${result.unit || ''}`;
      if (result.abnormal_flag) {
        text += ` [${result.abnormal_flag}]`;
      }
      text += `\n`;
      if (result.reference_range) {
        text += `    Reference: ${result.reference_range}\n`;
      }
    }
    text += `\n`;
  }

  return text;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse numeric value from string
 * Handles formats: "18.2", "<5.0", ">100", "5.0-6.0"
 */
function parseNumericValue(value: string): number | null {
  if (!value) return null;

  // Remove common prefixes
  let cleaned = value.replace(/[<>≤≥]/g, '').trim();

  // If it's a range, take the average
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts.length === 2) {
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(max)) {
        return (min + max) / 2;
      }
    }
  }

  // Try to parse as float
  const numeric = parseFloat(cleaned);
  return isNaN(numeric) ? null : numeric;
}

/**
 * Map status to abnormal flag
 */
function mapStatusToAbnormalFlag(
  status: 'normal' | 'low' | 'high' | 'borderline' | 'critical' | 'abnormal' | undefined
): string | null {
  if (!status) return null;

  // Normalize to uppercase for flag storage
  const normalizedStatus = status.toUpperCase();

  switch (normalizedStatus) {
    case 'CRITICAL':
      return 'C';
    case 'HIGH':
      return 'H';
    case 'LOW':
      return 'L';
    case 'BORDERLINE':
      return 'B';
    case 'ABNORMAL':
      return 'A';
    case 'NORMAL':
    default:
      return null;
  }
}

/**
 * Generate standardized test code from test name
 * This ensures consistency across different lab reports
 */
function generateTestCode(testName: string): string {
  // Common test name to code mappings
  const commonCodes: Record<string, string> = {
    hemoglobin: 'HGB',
    'white blood cell count': 'WBC',
    'red blood cell count': 'RBC',
    platelet: 'PLT',
    glucose: 'GLU',
    creatinine: 'CREAT',
    'blood urea nitrogen': 'BUN',
    'alanine aminotransferase': 'ALT',
    'aspartate aminotransferase': 'AST',
    'total cholesterol': 'CHOL',
    'hdl cholesterol': 'HDL',
    'ldl cholesterol': 'LDL',
    triglycerides: 'TRIG',
    'hba1c': 'HBA1C',
    'thyroid stimulating hormone': 'TSH',
    sodium: 'NA',
    potassium: 'K',
    calcium: 'CA',
    'vitamin d': 'VIT_D',
    'vitamin b12': 'VIT_B12',
    iron: 'FE',
  };

  const normalized = testName.toLowerCase().trim();

  // Check for exact match
  if (commonCodes[normalized]) {
    return commonCodes[normalized];
  }

  // Check for partial match
  for (const [name, code] of Object.entries(commonCodes)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      return code;
    }
  }

  // Generate code from test name
  // Take first 2-4 letters of each word, uppercase
  const words = normalized.split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  } else {
    return words
      .map((word) => word.substring(0, 2))
      .join('')
      .toUpperCase()
      .substring(0, 6);
  }
}

/**
 * Detect outliers in time series data using 3-sigma rule
 */
export function detectOutliers(values: number[]): boolean[] {
  if (values.length < 3) return values.map(() => false);

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return values.map((val) => Math.abs(val - mean) > 3 * stdDev);
}

/**
 * Decimate data points to reduce chart complexity
 * Uses Largest Triangle Three Buckets (LTTB) algorithm
 */
export function decimateDataPoints<T extends { x: Date; y: number }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) return data;

  const bucketSize = (data.length - 2) / (maxPoints - 2);
  const decimated: T[] = [data[0]]; // Always include first point

  for (let i = 0; i < maxPoints - 2; i++) {
    const bucketStart = Math.floor(i * bucketSize) + 1;
    const bucketEnd = Math.floor((i + 1) * bucketSize) + 1;

    // Find point with largest triangle area
    let maxArea = -1;
    let maxIndex = bucketStart;

    const prevPoint = decimated[decimated.length - 1];

    for (let j = bucketStart; j < bucketEnd; j++) {
      // Calculate area of triangle formed by prev, current, and next bucket average
      const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1;
      const nextBucketEnd = Math.min(
        Math.floor((i + 2) * bucketSize) + 1,
        data.length
      );
      const nextAvgX =
        data
          .slice(nextBucketStart, nextBucketEnd)
          .reduce((sum, p) => sum + p.x.getTime(), 0) /
        (nextBucketEnd - nextBucketStart);
      const nextAvgY =
        data.slice(nextBucketStart, nextBucketEnd).reduce((sum, p) => sum + p.y, 0) /
        (nextBucketEnd - nextBucketStart);

      const area = Math.abs(
        prevPoint.x.getTime() * (data[j].y - nextAvgY) +
        data[j].x.getTime() * (nextAvgY - prevPoint.y) +
        nextAvgX * (prevPoint.y - data[j].y)
      );

      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    decimated.push(data[maxIndex]);
  }

  decimated.push(data[data.length - 1]); // Always include last point

  return decimated;
}
