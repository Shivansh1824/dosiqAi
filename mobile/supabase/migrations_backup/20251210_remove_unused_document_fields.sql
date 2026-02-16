-- Remove unused fields from documents table to optimize storage
-- Migration: Remove file_size and color columns
-- Created: 2025-12-10
--
-- Context:
-- - file_size: Stored but never displayed to users
-- - color: Stored as empty string, calculated from document type instead
--
-- Storage savings: ~140 KB per 10,000 documents
-- Cost savings: ~$1.75/month per 10 million documents

-- Drop file_size column (4 bytes per document saved)
ALTER TABLE documents
  DROP COLUMN IF EXISTS file_size;

-- Drop color column (~10 bytes per document saved)
ALTER TABLE documents
  DROP COLUMN IF EXISTS color;

-- Verify the columns were dropped
-- Run this to confirm changes:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'documents'
-- ORDER BY ordinal_position;
