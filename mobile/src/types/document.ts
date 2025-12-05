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

export interface DocumentAnalysisResult {
  documentType?: string;
  patientName?: string;
  documentDate?: string;
  vitalSigns?: Record<string, any>;
  labResults?: Array<any>;
  diagnoses?: Array<string>;
  medications?: Array<any>;
  criticalFindings?: Array<string>;
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
  file_size?: number; // New: file size in bytes
  is_local?: boolean; // New: flag for local vs cloud storage
  color: string;
  created_at: string;
  updated_at: string;

  // AI Analysis fields
  ai_analysis_status?: DocumentAnalysisStatus;
  ai_analysis_result?: DocumentAnalysisResult;
  ai_analysis_error?: string;
  ai_analysis_prompt?: string;
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
}

export type DocumentsStore = DocumentsState & DocumentsActions;

// Helper to get color based on document type
export const getDocumentColor = (type: DocumentType): string => {
  switch (type) {
    case 'Lab Report':
      return '#EF4444'; // Red
    case 'Imaging':
      return '#3B82F6'; // Blue
    case 'Prescription':
      return '#10B981'; // Green
    case 'Report':
      return '#F59E0B'; // Orange
    case 'Record':
      return '#8B5CF6'; // Purple
    default:
      return '#6B7280'; // Gray
  }
};
