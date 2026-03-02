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
  name_as_written: string;         // Renamed from exact_written_name
  generic_name?: string;           // Flattened from assumed_enriched_data
  is_identified?: boolean;         // Flattened from assumed_enriched_data
  confidence?: number;             // Flattened from assumed_enriched_data (0.0-1.0)
  purpose?: string;                // Renamed from medicine_purpose and flattened
  category?: string;               // Renamed from medicine_type (e.g., "Antibiotic")
  strength?: string;               // "200mg", "500mg"
  form?: MedicineForm;             // Tablet, Syrup, etc.
  instructions?: string;           // Renamed from dosage_instruction
  gap_between_days?: number;       // Renamed from interval_days (1=daily, 2=alternate, 0=as needed)
  duration_days?: number;          // Integer days
  timing?: {                       // Structured timing
    meal_relation?: MealRelation;  // Renamed from relation_to_meal
    pattern?: string;              // Renamed from dosage ("1-0-1" format)
    times_per_day?: number;        // Renamed from total_times_per_day (1, 2, 3, 4, etc.)
    // Legacy support for older components
    relation_to_meal?: string;
    total_times_per_day?: number;
    dosage?: string;
  };
  // Legacy support for older components
  source_raw?: any;
  assumed_enriched_data?: {
    confidence?: number;
    generic_name?: string;
    is_identified?: boolean;
    medicine_type?: string;
    medicine_purpose?: string;
  };
  dosage_instruction?: string;
  relation_to_meal?: string;
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
  // --- New Flattened Schema ---
  is_prescription?: boolean;
  is_invalid_or_unreadable?: boolean;
  error_reason?: string | null;

  metadata?: {
    confidence_score: number;
    scan_clarity: 'clear' | 'blurry' | 'unreadable';
    handwriting_detected: boolean;
  };

  patient?: {
    name?: string | null;
    age?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
  };

  doctor?: {
    name?: string | null;
    hospital_name?: string | null;
  };

  diagnosis?: {
    condition?: string | null;
    is_inferred?: boolean;
  };

  visit_date?: string | null;

  summary?: string | null;
  follow_up_days?: number | null;
  advised_tests?: RecommendedTest[];
  medicines?: MedicineInfo[];

  drug_interactions?: {
    has_interactions: boolean;
    note?: string | null;
  };

  additional_notes?: Array<{
    type: 'Diet' | 'Lifestyle' | 'Vitals' | 'Allergy' | 'General';
    text: string;
  }>;


  // Document type (Legacy - kept for app logic outside schema)
  document_type?: string;
  file_name?: string;
  rawText?: string;
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

  // New top-level fields extracted from AI analysis (Prescription only)
  patient_name?: string | null;
  diagnosis?: string | null;
  visit_date?: string | null;
  follow_up_date?: string | null;
  issued_by?: string | null;

  // Platform specific dates for timeline
  report_date?: string | null; // Joined from lab_reports table

  // created_at: string; // REMOVED: Use ai_analyzed_at for system date
  // updated_at: string; // REMOVED



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
  isInitialized: boolean;
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
/**
 * Generates a descriptive title for a document based on available metadata
 *
 * Pattern: [Date] - [Patient Name] - [Diagnosis] (by [Issuer])
 *
 * @param doc - The document object
 * @returns A formatted string
 */
export const getDocumentTitle = (doc: Document): string => {
  const parts: string[] = [];

  // 1. Patient Name
  if (doc.patient_name) {
    parts.push(doc.patient_name);
  }

  // 2. Diagnosis
  if (doc.diagnosis) {
    parts.push(doc.diagnosis);
  }

  // Construct base title
  let title = parts.length > 0 ? parts.join(' - ') : (doc.local_file_path?.split('/').pop() || 'Untitled Document');

  return title;
};
