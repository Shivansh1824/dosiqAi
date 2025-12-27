/**
 * Document types for health records
 */

export type DocumentType =
  | 'Lab Report'
  | 'Imaging'
  | 'Prescription'
  | 'Report'
  | 'Record'
  | 'Other';

export type DocumentAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Medicine structure from prescription
export interface MedicineInfo {
  exact_written_name: string;
  assumed_enriched_data?: {
    is_identified: boolean;
    scientific_name?: string;
  };
  dosage_instruction?: string;
  frequency?: string;
  duration?: string;
  special_instructions?: string;
}

// Recommended test structure
export interface RecommendedTest {
  test_name: string;
  reason?: string;
}

// Lab metric structure
export interface LabMetric {
  metric_name: string;
  value: string;
  unit?: string;
  reference_range?: string;
  status?: 'normal' | 'high' | 'low' | 'critical';
}

// Grouped lab metrics
export interface GroupedMetrics {
  group_name: string;
  metrics: LabMetric[];
}

// AI Analysis result structure matching the prompt output
export interface DocumentAnalysisResult {
  // Document type
  document_type?: string;

  // AI-generated filename
  file_name?: string;

  // Analysis metadata
  analysis_metadata?: {
    confidence_score?: number;
    scan_clarity?: string;
  };

  // Error response
  error_response?: {
    is_error: boolean;
    user_message?: string;
    technical_reason?: string;
  };

  // Patient info
  patient_info?: {
    name?: string;
    age?: string;
    gender?: string;
  };

  // Common data (includes summary)
  common_data?: {
    visit_date?: string;
    summary?: string;
  };

  // Prescription specific data
  prescription_data?: {
    doctor_name?: string;
    hospital_name?: string;
    medical_issue_diagnosis?: string;
    recommended_tests?: RecommendedTest[];
    medicines?: MedicineInfo[];
  };

  // Report/Lab specific data
  report_data?: {
    lab_name?: string;
    grouped_metrics?: GroupedMetrics[];
  };

  // Legacy fields for backwards compatibility
  summary?: string;
  rawText?: string; // Fallback if JSON parsing fails
  parseError?: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  type: DocumentType;
  file_url?: string; // Legacy field, nullable
  local_file_path?: string; // New: local file path
  family_member_id?: string; // New: reference to family member
  is_local?: boolean; // New: flag for local vs cloud storage
  color: string; // Calculated on-the-fly from type, not stored in database
  created_at: string;
  updated_at: string;

  // AI Analysis fields
  ai_analysis_status?: DocumentAnalysisStatus;
  ai_analysis_result?: DocumentAnalysisResult;
  ai_analysis_error?: string; // NULL by default, only filled when analysis fails
  ai_analysis_prompt?: string; // NULL by default, only filled when custom prompt used
  ai_analyzed_at?: string;
  ai_analysis_tokens_used?: number;
}

export interface DocumentsState {
  documents: Document[];
  isLoading: boolean;
  error: string | null;

  // AI Analysis state
  isAnalyzing: boolean;
  analysisProgress: Record<string, number>; // documentId -> progress (0-100)
  uploadLimit: UploadLimitInfo | null;
}

export interface UploadLimitInfo {
  allowed: boolean;
  count: number;
  limit: number;
}

export interface DocumentsActions {
  loadFromCache: (userId: string) => Promise<boolean>;
  fetchDocuments: (userId: string, silent?: boolean) => Promise<void>;
  addDocument: (doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  syncDocuments: (userId: string) => Promise<void>;
  clearDocuments: () => void;
  setError: (error: string | null) => void;

  // AI Analysis actions
  triggerAnalysis: (documentId: string, localFilePath: string, customPrompt?: string) => Promise<void>;
  refreshUploadLimit: (userId: string) => Promise<void>;
  clearAnalysisError: (documentId: string) => Promise<void>;
  retryAnalysis: (documentId: string, localFilePath: string) => Promise<void>;

  // Local storage cleanup
  clearAllLocalDocuments: (userId?: string) => Promise<void>;
}

export type DocumentsStore = DocumentsState & DocumentsActions;

/**
 * Calculate color for a document based on its type
 *
 * IMPORTANT: Colors are NEVER stored in the database
 * - Performance optimization: No storage overhead
 * - Calculated on-the-fly when documents are fetched/displayed
 * - Type-based: Each document type has a consistent semantic color
 *
 * Color Meanings:
 * - Lab Report (Red): Critical health metrics
 * - Imaging (Blue): Diagnostic scans, trust
 * - Prescription (Green): Active medications, wellness
 * - Report (Orange): General reports
 * - Record (Purple): Historical data
 * - Other (Gray): Miscellaneous
 *
 * Uses Tailwind CSS 600 shades for WCAG AAA contrast compliance
 *
 * @param type - The document type
 * @returns Hex color code for UI rendering
 */
export const getDocumentColor = (type: DocumentType): string => {
  switch (type) {
    case 'Lab Report':
      return '#DC2626'; // Red-600 (better contrast)
    case 'Imaging':
      return '#2563EB'; // Blue-600
    case 'Prescription':
      return '#059669'; // Green-600
    case 'Report':
      return '#D97706'; // Orange-600
    case 'Record':
      return '#7C3AED'; // Purple-600
    default:
      return '#4B5563'; // Gray-600
  }
};
