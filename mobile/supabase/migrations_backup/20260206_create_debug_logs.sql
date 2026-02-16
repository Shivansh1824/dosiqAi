-- Create a debug_logs table for storing generic JSON logs
CREATE TABLE IF NOT EXISTS debug_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT NOT NULL, -- e.g., 'enrich-test-results'
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    data JSONB, -- The actual log data
    log_level TEXT DEFAULT 'INFO'
);

-- Enable RLS (allow insert from service role, select for authenticated users if needed)
ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for service role only" ON debug_logs
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Enable select for authenticated users" ON debug_logs
    FOR SELECT TO authenticated USING (true);
