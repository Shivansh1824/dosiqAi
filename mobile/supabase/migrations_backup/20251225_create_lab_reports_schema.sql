-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Lab Reports Database Schema
-- Created: 2025-12-25
-- Purpose: Store structured lab report data for trending and analysis
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ═══════════════════════════════════════════════════════════════
-- TABLE 1: lab_reports (Report Metadata)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lab_reports (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign Keys (Relationships)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Report Metadata
  lab_name TEXT,  -- "Quest Diagnostics", "LabCorp", "Thyrocare", etc.
  report_type TEXT,  -- "blood_test", "urine_test", "full_body", "thyroid_panel", etc.
  report_date DATE NOT NULL,  -- When results were finalized
  sample_type TEXT,  -- "blood", "urine", "stool", "saliva"
  fasting_status BOOLEAN,  -- Was patient fasting?
  status TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('final', 'draft')),

  -- User Annotations
  notes TEXT,  -- User comments about the report
  verified_by_user BOOLEAN NOT NULL DEFAULT FALSE,  -- User confirmed accuracy

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lab_reports (Performance Optimization)
CREATE INDEX idx_lab_reports_user ON lab_reports(user_id);
CREATE INDEX idx_lab_reports_family_member_date ON lab_reports(family_member_id, report_date DESC);
CREATE INDEX idx_lab_reports_document ON lab_reports(document_id);
CREATE INDEX idx_lab_reports_status ON lab_reports(status) WHERE status = 'draft';

-- Row Level Security Policies for lab_reports
ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lab reports"
  ON lab_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lab reports"
  ON lab_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lab reports"
  ON lab_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lab reports"
  ON lab_reports FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 2: test_results (Individual Test Values)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS test_results (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign Keys (Relationships)
  lab_report_id UUID NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,  -- Denormalized for performance
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- Denormalized for RLS

  -- Test Identification
  category TEXT,  -- "HAEMATOLOGY", "BIOCHEMISTRY", "CLINICAL PATHOLOGY", "SEROLOGY", etc.
  test_name TEXT NOT NULL,  -- Display name: "Hemoglobin", "Total Cholesterol", etc.
  test_code TEXT,  -- Normalized code: "HGB", "CHOL", "GLU" (for trending across labs)

  -- Results
  result_value TEXT NOT NULL,  -- Original value: "14.2", "NEGATIVE", "120/80"
  result_numeric NUMERIC,  -- Extracted number for charting (NULL if not applicable)
  unit TEXT,  -- "g/dL", "mg/dL", "%", "mmol/L", "/cumm", etc.
  reference_range TEXT,  -- "13.0-17.0", "<200", "Negative", "Desirable <200"

  -- Abnormality Detection
  abnormal_flag TEXT NOT NULL DEFAULT 'NORMAL' CHECK (abnormal_flag IN ('NORMAL', 'HIGH', 'LOW', 'CRITICAL')),

  -- Audit & Verification
  ai_extracted BOOLEAN NOT NULL DEFAULT TRUE,  -- Was this extracted by AI?
  verified_by_user BOOLEAN NOT NULL DEFAULT FALSE,  -- User confirmed accuracy?
  notes TEXT,  -- User corrections or annotations

  -- Optional Metadata
  specimen_type TEXT,  -- "serum", "plasma", "whole blood", "spot urine", etc.
  test_method TEXT,  -- "ELISA", "Spectrophotometry", "HPLC" (rarely used)

  -- Timestamps
  measured_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- When test was performed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for test_results (CRITICAL for Performance)
CREATE INDEX idx_test_results_lab_report ON test_results(lab_report_id);
CREATE INDEX idx_test_results_family_member ON test_results(family_member_id);
CREATE INDEX idx_test_results_user ON test_results(user_id);

-- Trending query optimization (most common query pattern)
CREATE INDEX idx_test_results_trending ON test_results(family_member_id, test_code, measured_at DESC)
  WHERE test_code IS NOT NULL;

-- Alternative trending index for test_name (fallback if test_code missing)
CREATE INDEX idx_test_results_trending_name ON test_results(family_member_id, test_name, measured_at DESC);

-- Abnormal results filtering (for dashboard widget)
CREATE INDEX idx_test_results_abnormal ON test_results(family_member_id, abnormal_flag, measured_at DESC)
  WHERE abnormal_flag != 'NORMAL';

-- Category filtering (for grouping tests)
CREATE INDEX idx_test_results_category ON test_results(lab_report_id, category);

-- Row Level Security Policies for test_results
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own test results"
  ON test_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own test results"
  ON test_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test results"
  ON test_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own test results"
  ON test_results FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 3: Update existing documents table
-- ═══════════════════════════════════════════════════════════════

-- Add new columns to documents table (if not already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'document_date'
  ) THEN
    ALTER TABLE documents ADD COLUMN document_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'has_structured_data'
  ) THEN
    ALTER TABLE documents ADD COLUMN has_structured_data BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Index for filtering documents with structured data
CREATE INDEX IF NOT EXISTS idx_documents_structured ON documents(has_structured_data)
  WHERE has_structured_data = TRUE;

-- Index for document_date sorting
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date DESC)
  WHERE document_date IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS: Auto-update timestamps
-- ═══════════════════════════════════════════════════════════════

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lab_reports table
DROP TRIGGER IF EXISTS update_lab_reports_updated_at ON lab_reports;
CREATE TRIGGER update_lab_reports_updated_at
  BEFORE UPDATE ON lab_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS: Schema Documentation
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE lab_reports IS 'Stores metadata for uploaded lab reports (blood tests, urine tests, etc.)';
COMMENT ON TABLE test_results IS 'Stores individual test results from lab reports for trending and analysis';

COMMENT ON COLUMN lab_reports.fasting_status IS 'Critical for interpreting glucose and lipid panel results';
COMMENT ON COLUMN test_results.test_code IS 'Normalized medical code (e.g., HGB, CHOL) for trending across different labs';
COMMENT ON COLUMN test_results.result_numeric IS 'Extracted number for charting. NULL if result is text-only (e.g., NEGATIVE)';
COMMENT ON COLUMN test_results.abnormal_flag IS 'NORMAL, HIGH, LOW, or CRITICAL based on reference_range comparison';

-- ═══════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Lab reports schema migration completed successfully!';
  RAISE NOTICE 'Created tables: lab_reports, test_results';
  RAISE NOTICE 'Updated table: documents (added document_date, has_structured_data)';
  RAISE NOTICE 'Created % indexes', (
    SELECT COUNT(*) FROM pg_indexes
    WHERE tablename IN ('lab_reports', 'test_results', 'documents')
    AND indexname LIKE 'idx_lab%' OR indexname LIKE 'idx_test%' OR indexname LIKE 'idx_documents_%'
  );
  RAISE NOTICE 'RLS policies: Enabled and configured';
END $$;