-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Create Simplified Biomarker Debug Logs Table
-- Created: 2026-02-12
-- Purpose: Store matching results using a simple test ID reference
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS biomarker_debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    test_reference TEXT, -- Storing the first test_id from the payload for easy lookup
    exact_matches JSONB,
    fuzzy_matches JSONB,
    not_found JSONB
);

-- Enable RLS
ALTER TABLE biomarker_debug_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert logs
CREATE POLICY "Enable insert for service role" ON biomarker_debug_logs 
    FOR INSERT TO service_role WITH CHECK (true);

-- Allow authenticated users to view logs
CREATE POLICY "Enable select for authenticated users" ON biomarker_debug_logs 
    FOR SELECT TO authenticated USING (true);
