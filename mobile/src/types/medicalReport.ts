/**
 * Medical Report Types
 * TypeScript interfaces for AI-analyzed medical reports
 * Distinct from LabReport which handles structured lab test results from database
 */

// ============================================================================
// Core Data Structures (matching AI JSON output from OpenRouter API)
// ============================================================================

export interface MedicalReportMetric {
  test_name: string;
  value: string;
  unit?: string;
  reference_range?: string;
  is_abnormal: boolean;
  method?: string;
}

export interface MedicalReportCategory {
  category_name: string;
  metrics: MedicalReportMetric[];
}

export interface MedicalReportData {
  lab_name?: string;
  report_date?: string;
  total_abnormalities?: number;
  grouped_metrics?: MedicalReportCategory[];
}

export interface AnalysisMetadata {
  confidence_score?: number;
  scan_clarity?: string;
}

export interface PatientInfo {
  name?: string;
  age?: string;
  gender?: string;
}

export interface CommonData {
  visit_date?: string;
  summary?: string;
}

export interface ErrorResponse {
  is_error: boolean;
  user_message?: string | null;
  technical_reason?: string | null;
}

export interface PrescriptionData {
  doctor_name?: string | null;
  hospital_name?: string | null;
  medical_issue_diagnosis?: string | null;
  recommended_tests?: string[];
  medicines?: any[];
}

/**
 * Main interface for AI-analyzed medical reports
 * This structure matches the JSON returned from the analyze-document edge function
 */
export interface MedicalReportAnalysis {
  document_type: 'medical_report';
  file_name?: string;
  analysis_metadata?: AnalysisMetadata;
  error_response?: ErrorResponse;
  patient_info?: PatientInfo;
  common_data?: CommonData;
  report_data?: MedicalReportData;
  prescription_data?: PrescriptionData;
}

// ============================================================================
// Display/UI Types
// ============================================================================

export interface MedicalReportSummary {
  totalMetrics: number;
  normalCount: number;
  abnormalCount: number;
  categories: MedicalReportCategory[];
  hasPatientInfo: boolean;
  hasSummary: boolean;
}

export type MetricStatus = 'normal' | 'abnormal';

// ============================================================================
// Status Colors (for UI components)
// ============================================================================

export interface StatusColor {
  primary: string;
  light: string;
  dark: string;
}

export const METRIC_STATUS_COLORS: Record<MetricStatus, StatusColor> = {
  normal: {
    primary: '#10B981', // Green
    light: '#D1FAE5',   // Light green background
    dark: '#059669',    // Dark green text
  },
  abnormal: {
    primary: '#EF4444', // Red
    light: '#FEE2E2',   // Light red background
    dark: '#DC2626',    // Dark red text
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate summary statistics from medical report data
 */
export function calculateReportSummary(
  reportData: MedicalReportAnalysis
): MedicalReportSummary {
  const categories = reportData.report_data?.grouped_metrics || [];

  let totalMetrics = 0;
  let abnormalCount = reportData.report_data?.total_abnormalities || 0;

  // Calculate total metrics across all categories
  categories.forEach((category) => {
    totalMetrics += category.metrics.length;
  });

  const normalCount = totalMetrics - abnormalCount;

  return {
    totalMetrics,
    normalCount,
    abnormalCount,
    categories,
    hasPatientInfo: !!reportData.patient_info?.name,
    hasSummary: !!reportData.common_data?.summary,
  };
}

/**
 * Format date string to readable format
 */
export function formatReportDate(dateString?: string): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Get count of abnormal metrics in a category
 */
export function getAbnormalCountInCategory(category: MedicalReportCategory): number {
  return category.metrics.filter((metric) => metric.is_abnormal).length;
}
