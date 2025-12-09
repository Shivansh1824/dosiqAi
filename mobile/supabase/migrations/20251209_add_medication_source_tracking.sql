-- Migration: Add source tracking columns to medications table
-- Date: 2025-12-09
-- Purpose: Enable tracking of AI-extracted medications from prescription documents

-- Add source tracking columns to medications table
ALTER TABLE medications
ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_document_title TEXT,
ADD COLUMN IF NOT EXISTS ai_extracted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_by_user BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_frequency_code TEXT,
ADD COLUMN IF NOT EXISTS scientific_name TEXT;

-- Add index for faster lookups by source document
CREATE INDEX IF NOT EXISTS idx_medications_source_document
ON medications(source_document_id)
WHERE source_document_id IS NOT NULL;

-- Add index for active medications (for duplicate detection performance)
CREATE INDEX IF NOT EXISTS idx_medications_active
ON medications(user_id, is_active)
WHERE is_active = TRUE;

-- Add index for end_date filtering (for active medication queries)
CREATE INDEX IF NOT EXISTS idx_medications_end_date
ON medications(end_date)
WHERE end_date IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN medications.source_document_id IS 'Reference to the prescription document if AI-extracted';
COMMENT ON COLUMN medications.source_document_title IS 'Cached document title for quick display without joins';
COMMENT ON COLUMN medications.ai_extracted IS 'True if medication was extracted by AI from prescription';
COMMENT ON COLUMN medications.verified_by_user IS 'True if user reviewed and verified the medication data';
COMMENT ON COLUMN medications.original_frequency_code IS 'Original medical frequency code from prescription (e.g., Q6H, TDS, BD)';
COMMENT ON COLUMN medications.scientific_name IS 'Generic/scientific name if available from AI extraction';
