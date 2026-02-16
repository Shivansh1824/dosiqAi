-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Lab Reports & Test Results Schema (V2)
-- Created: 2026-02-06
-- Purpose: Structured storage for lab results after AI extraction
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. LOINC Master Reference Table
CREATE TABLE IF NOT EXISTS loinc_codes (
    loinc_code TEXT PRIMARY KEY,
    loinc_name TEXT NOT NULL,
    category TEXT
);

-- 2. Lab Reports (Report Level Metadata)
CREATE TABLE IF NOT EXISTS lab_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    patient_name TEXT,
    age INTEGER, -- Extracted numeric age
    gender TEXT,
    lab_name TEXT,
    collection_date DATE,
    report_date DATE,
    ai_summary TEXT
);

-- 3. Test Results (Individual Test Level Data)
CREATE TABLE IF NOT EXISTS test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lab_report_id UUID NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
    report_date DATE, -- Denormalized for easy trending
    test_name TEXT NOT NULL,
    value TEXT, -- Both numeric and text values
    unit TEXT,
    ref_min NUMERIC,
    ref_max NUMERIC,
    ref_type TEXT, -- e.g., 'between', 'exact'
    interpretation TEXT,
    status TEXT, -- e.g., 'LOW', 'NORMAL', 'HIGH'
    loinc_code TEXT, -- Potential link to loinc_codes table
    loinc_category TEXT
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_lab_reports_user ON lab_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_document ON lab_reports(document_id);
CREATE INDEX IF NOT EXISTS idx_test_results_lab_report ON test_results(lab_report_id);
CREATE INDEX IF NOT EXISTS idx_test_results_user_name ON test_results(user_id, test_name);

-- ═══════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE loinc_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- loinc_codes: Everyone can read reference data
CREATE POLICY "Anyone can view loinc_codes" ON loinc_codes FOR SELECT USING (true);

-- lab_reports policies
CREATE POLICY "Users can manage their own lab reports" 
    ON lab_reports FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- test_results policies
CREATE POLICY "Users can manage their own test results" 
    ON test_results FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════

COMMENT ON COLUMN lab_reports.age IS 'Numeric age extracted from the report';
COMMENT ON COLUMN test_results.value IS 'Result value as string (handles both 14.3 and Neg)';
COMMENT ON COLUMN test_results.status IS 'Clinician/AI flagged status (NORMAL, LOW, HIGH, etc.)';
