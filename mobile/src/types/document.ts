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

// Medicine form types
export type MedicineForm = 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Drops' | 'Cream' | 'Inhaler' | 'Sachet' | null;

// Meal timing relationship
export type MealRelation = 'before_food' | 'after_food' | 'with_food' | 'empty_stomach' | 'any' | null;

// Medicine structure from prescription
export interface MedicineInfo {
  exact_written_name: string;
  assumed_enriched_data?: {
    is_identified: boolean;
    confidence?: number;           // NEW: 0.0-1.0 per medicine
    scientific_name?: string;
    medicine_purpose?: string;     // NEW: "Bacterial Infection Treatment"
    medicine_type?: string;        // NEW: "Antibiotic", "Analgesic", etc.
  };
  strength?: string;               // NEW: "200mg", "500mg"
  form?: MedicineForm;             // NEW: Tablet, Syrup, etc.
  dosage_instruction?: string;
  interval_days?: number;          // NEW: 1=daily, 2=alternate, 7=weekly, 0=as needed
  timing?: {                       // NEW: Structured timing
    relation_to_meal?: MealRelation;
    dosage?: string;               // "1-0-1" format (morning-afternoon-night)
    total_times_per_day?: number;  // 1, 2, 3, 4, etc.
  };
  duration_days?: number;          // NEW: Integer days

  // Legacy fields (kept for backward compatibility)
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
  status?: 'normal' | 'low' | 'high' | 'borderline' | 'critical' | 'abnormal';
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
    handwriting_detected?: boolean;  // NEW: Indicates handwritten prescription
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
    diagnosis_source?: 'explicit' | 'inferred';  // NEW: How diagnosis was determined
    follow_up?: {                                 // NEW: Follow-up info
      follow_up_date?: string;
      follow_up_notes?: string;
    };
    recommended_tests?: RecommendedTest[];
    medicines?: MedicineInfo[];
    drug_interactions?: {                         // NEW: Drug interaction warning
      potential_interactions_flag: boolean;
      interaction_note?: string;
    };
    other_information?: Array<{                   // NEW: Vitals, lifestyle, allergies
      category: 'Diet' | 'Lifestyle' | 'Vitals' | 'Allergy' | 'Notes';
      value: string;
    }>;
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
  type: DocumentType;
  local_file_path?: string; // New: local file path
  cloud_file_key?: string; // R2 storage key for cloud sync
  family_member_id?: string; // New: reference to family member
  color: string; // Calculated on-the-fly from type, not stored in database
  created_at: string;
  updated_at: string;


  // AI Analysis fields
  ai_analysis_status?: DocumentAnalysisStatus;
  ai_analysis_result?: DocumentAnalysisResult;
  ai_analysis_error?: DocumentAnalysisError | null; // Changed to object with { error, prompt }
  ai_analyzed_at?: string;
  ai_analysis_token_count?: number;
}

export interface DocumentAnalysisError {
  error: string;
  prompt: string;
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
  triggerAnalysis: (documentId: string, localFilePath: string, customPrompt?: string, isReport?: boolean) => Promise<void>;
  refreshUploadLimit: (userId: string) => Promise<void>;
  clearAnalysisError: (documentId: string) => Promise<void>;
  retryAnalysis: (documentId: string, localFilePath: string) => Promise<void>;

  // Cloud storage actions
  updateCloudFileKey: (documentId: string, cloudFileKey: string) => Promise<boolean>;

  // Local storage cleanup
  clearAllLocalDocuments: (userId?: string) => Promise<void>;

  // Cloud storage cleanup
  clearAllCloudDocuments: (userId: string) => Promise<void>;

  // Comprehensive account cleanup
  clearAllAccountData: (userId: string) => Promise<void>;
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
