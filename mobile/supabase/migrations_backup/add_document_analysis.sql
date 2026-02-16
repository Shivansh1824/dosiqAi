-- Add AI analysis fields to documents table
-- Migration: Add document analysis capabilities
-- Created: 2025-12-05

-- Add AI analysis columns to existing documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS ai_analysis_status TEXT DEFAULT 'pending' CHECK (ai_analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS ai_analysis_result JSONB,
  ADD COLUMN IF NOT EXISTS ai_analysis_error TEXT,
  ADD COLUMN IF NOT EXISTS ai_analysis_prompt TEXT,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ai_analysis_tokens_used INTEGER;

-- Create index for querying by analysis status
CREATE INDEX IF NOT EXISTS idx_documents_analysis_status ON documents(ai_analysis_status);

-- Create index for querying analyzed documents
CREATE INDEX IF NOT EXISTS idx_documents_analyzed_at ON documents(ai_analyzed_at DESC) WHERE ai_analyzed_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN documents.ai_analysis_status IS 'Status of AI analysis: pending, processing, completed, failed';
COMMENT ON COLUMN documents.ai_analysis_result IS 'JSON object containing AI analysis results (document type, summary, extracted data, etc.)';
COMMENT ON COLUMN documents.ai_analysis_error IS 'Error message if analysis failed';
COMMENT ON COLUMN documents.ai_analysis_prompt IS 'Custom prompt used for analysis (if any)';
COMMENT ON COLUMN documents.ai_analyzed_at IS 'Timestamp when analysis completed';
COMMENT ON COLUMN documents.ai_analysis_tokens_used IS 'Number of tokens used in OpenRouter API call for cost tracking';
