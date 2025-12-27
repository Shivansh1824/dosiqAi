/**
 * Lab Report Types
 * TypeScript interfaces for lab reports, test results, and trend analysis
 */

// ============================================================================
// Database Models (match Supabase schema)
// ============================================================================

export interface LabReport {
  id: string;
  user_id: string;
  family_member_id: string | null;
  document_id: string | null;

  // Lab Report Metadata
  lab_name: string | null;
  report_type: string | null;
  report_date: string; // ISO date string
  sample_type: string | null;
  fasting_status: boolean | null;

  // User Annotations
  notes: string | null;
  verified_by_user: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  id: string;
  lab_report_id: string;
  user_id: string;
  family_member_id: string | null;

  // Test Identification
  category: string; // e.g., "HAEMATOLOGY", "BIOCHEMISTRY"
  test_name: string; // e.g., "Hemoglobin"
  test_code: string | null; // e.g., "HGB", standardized code for consistency

  // Test Results
  result_value: string; // Original value as string (may include qualitative values)
  result_numeric: number | null; // Parsed numeric value for trending
  unit: string | null; // e.g., "g/dL", "mg/dL"

  // Reference Data
  reference_range: string | null; // e.g., "13.0-17.0", "13.0 - 17.0 g/dL"
  abnormal_flag: string | null; // e.g., "H" (high), "L" (low), "C" (critical)

  // Trend Analysis (added by migration 20251226)
  previous_value: number | null;
  change_percentage: number | null;
  trend: 'improving' | 'worsening' | 'stable' | null;

  // Audit
  ai_extracted: boolean;
  verified_by_user: boolean;
  notes: string | null;
  measured_at: string; // ISO date-time string

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ChartPreferences {
  id: string;
  user_id: string;
  family_member_id: string | null;

  // Display Preferences
  default_chart_type: 'line' | 'bar' | 'area';
  default_time_range: '1m' | '3m' | '6m' | '1y' | 'all';
  show_reference_ranges: boolean;
  show_annotations: boolean;
  color_blind_mode: boolean;

  // Pinned Metrics
  pinned_metrics: string[] | null; // Array of test_codes

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface MetricAnnotation {
  id: string;
  user_id: string;
  test_result_id: string;

  // Annotation Content
  note: string;
  event_type: 'medication_change' | 'lifestyle_change' | 'symptom' | 'other' | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Extended Types with Relationships
// ============================================================================

export interface TestResultWithAnnotations extends TestResult {
  annotations: MetricAnnotation[];
}

export interface LabReportWithResults extends LabReport {
  test_results: TestResult[];
}

export interface LabReportFull extends LabReport {
  test_results: TestResultWithAnnotations[];
}

// ============================================================================
// Chart Data Types
// ============================================================================

export interface TimeSeriesDataPoint {
  x: Date; // Date object for chart libraries
  y: number; // Numeric value
  label?: string; // Optional label for tooltips
  date: string; // ISO date string for display
  value: number; // Original value
  unit: string | null;
  status: 'normal' | 'high' | 'low' | 'critical' | null;
  abnormalFlag: string | null;
  labReportId: string;
  testResultId: string;
}

export interface TimeSeriesData {
  testCode: string;
  testName: string;
  unit: string | null;
  category: string;
  dataPoints: TimeSeriesDataPoint[];
  referenceRange: ReferenceRange | null;
  latestValue: TimeSeriesDataPoint | null;
  trend: 'improving' | 'worsening' | 'stable' | null;
  changePercentage: number | null;
}

export interface ReferenceRange {
  min: number;
  max: number;
  unit: string | null;
  rawString: string; // Original string (e.g., "13.0-17.0 g/dL")
}

// ============================================================================
// Grouped Metrics for Display
// ============================================================================

export interface GroupedTestResults {
  category: string; // e.g., "HAEMATOLOGY"
  testResults: TestResult[];
  abnormalCount: number; // Count of abnormal results in this group
  criticalCount: number; // Count of critical results in this group
}

export interface LabReportSummary {
  labReport: LabReport;
  groupedResults: GroupedTestResults[];
  totalTests: number;
  normalCount: number;
  highCount: number;
  lowCount: number;
  criticalCount: number;
  hasHistoricalData: boolean; // true if any test has previous results
}

// ============================================================================
// Time Range Types
// ============================================================================

export type TimeRangeOption = '1m' | '3m' | '6m' | '1y' | 'all';

export interface TimeRange {
  label: string; // e.g., "1M", "3M", "6M", "1Y", "All"
  value: TimeRangeOption;
  days: number | null; // null for 'all'
}

export const TIME_RANGES: TimeRange[] = [
  { label: '1M', value: '1m', days: 30 },
  { label: '3M', value: '3m', days: 90 },
  { label: '6M', value: '6m', days: 180 },
  { label: '1Y', value: '1y', days: 365 },
  { label: 'All', value: 'all', days: null },
];

// ============================================================================
// Chart Configuration Types
// ============================================================================

export type ChartType = 'line' | 'bar' | 'area';

export interface ChartConfig {
  type: ChartType;
  showReferenceRanges: boolean;
  showAnnotations: boolean;
  colorBlindMode: boolean;
  timeRange: TimeRangeOption;
  enableZoom: boolean;
  enablePan: boolean;
  showTooltips: boolean;
}

// ============================================================================
// Status and Color Types
// ============================================================================

export type TestStatus = 'normal' | 'high' | 'low' | 'critical';

export interface StatusColor {
  primary: string;
  light: string;
  dark: string;
}

export const STATUS_COLORS: Record<TestStatus, StatusColor> = {
  normal: {
    primary: '#10B981', // Green
    light: '#D1FAE5', // Light green background
    dark: '#059669', // Dark green text
  },
  high: {
    primary: '#F59E0B', // Amber
    light: '#FEF3C7', // Light amber background
    dark: '#D97706', // Dark amber text
  },
  low: {
    primary: '#3B82F6', // Blue (different from high)
    light: '#DBEAFE', // Light blue background
    dark: '#2563EB', // Dark blue text
  },
  critical: {
    primary: '#EF4444', // Red
    light: '#FEE2E2', // Light red background
    dark: '#DC2626', // Dark red text
  },
};

export const COLOR_BLIND_PALETTE: Record<TestStatus, StatusColor> = {
  normal: {
    primary: '#0077BB', // Blue
    light: '#D1E9F6',
    dark: '#00558B',
  },
  high: {
    primary: '#EE7733', // Orange
    light: '#FFE8D9',
    dark: '#CC5511',
  },
  low: {
    primary: '#009988', // Teal
    light: '#D1F2ED',
    dark: '#006655',
  },
  critical: {
    primary: '#CC3311', // Red
    light: '#F7D7D0',
    dark: '#991100',
  },
};

// ============================================================================
// Utility Types
// ============================================================================

export interface MetricComparison {
  current: TestResult;
  previous: TestResult | null;
  change: number | null; // Absolute change
  changePercentage: number | null;
  trend: 'improving' | 'worsening' | 'stable' | null;
}

export interface ChartExportData {
  testName: string;
  testCode: string;
  unit: string | null;
  dataPoints: Array<{
    date: string;
    value: number;
    status: string;
  }>;
  referenceRange: string | null;
}

// ============================================================================
// Helper Functions (Type Guards and Parsers)
// ============================================================================

/**
 * Parse reference range string to ReferenceRange object
 * Handles formats: "13.0-17.0", "13.0 - 17.0", "13.0-17.0 g/dL"
 */
export function parseReferenceRange(rangeString: string): ReferenceRange | null {
  if (!rangeString) return null;

  // Extract numeric values using regex
  const match = rangeString.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (!match) return null;

  const min = parseFloat(match[1]);
  const max = parseFloat(match[2]);

  if (isNaN(min) || isNaN(max)) return null;

  // Extract unit (everything after the range)
  const unitMatch = rangeString.match(/-\s*\d+\.?\d*\s*(.+)/);
  const unit = unitMatch ? unitMatch[1].trim() : null;

  return {
    min,
    max,
    unit,
    rawString: rangeString,
  };
}

/**
 * Determine test status from result value and reference range
 */
export function getTestStatus(
  resultNumeric: number,
  referenceRange: ReferenceRange | null,
  abnormalFlag: string | null
): TestStatus {
  // If there's a critical flag
  if (abnormalFlag === 'C' || abnormalFlag === 'CC' || abnormalFlag === 'CRITICAL') {
    return 'critical';
  }

  // If no reference range, use abnormal flag
  if (!referenceRange) {
    if (abnormalFlag === 'H' || abnormalFlag === 'HH' || abnormalFlag === 'HIGH') return 'high';
    if (abnormalFlag === 'L' || abnormalFlag === 'LL' || abnormalFlag === 'LOW') return 'low';
    return 'normal';
  }

  // Check if value is within range
  if (resultNumeric >= referenceRange.min && resultNumeric <= referenceRange.max) {
    return 'normal';
  } else if (resultNumeric > referenceRange.max) {
    // Check if critically high (e.g., >20% above max)
    if (resultNumeric > referenceRange.max * 1.2) {
      return 'critical';
    }
    return 'high';
  } else {
    // Check if critically low (e.g., <20% below min)
    if (resultNumeric < referenceRange.min * 0.8) {
      return 'critical';
    }
    return 'low';
  }
}

/**
 * Convert ISO date string to display format
 */
export function formatDateForDisplay(isoDateString: string): string {
  const date = new Date(isoDateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get date range for time range option
 */
export function getDateRangeForTimeRange(timeRange: TimeRangeOption): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = new Date();
  let startDate = new Date();

  const range = TIME_RANGES.find((r) => r.value === timeRange);
  if (range && range.days !== null) {
    startDate.setDate(endDate.getDate() - range.days);
  } else {
    // 'all' - set to distant past
    startDate = new Date(2000, 0, 1);
  }

  return { startDate, endDate };
}
