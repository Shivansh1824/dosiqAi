-- Clear ai_analysis_prompt from all successfully analyzed documents
-- Migration: Clean up prompts that were saved for successful analyses
-- Created: 2025-12-10
--
-- Context:
-- Previously, ai_analysis_prompt was saved for ALL analyses (successful or failed)
-- New strategy: Only save prompt when analysis FAILS (NULL by default)
-- This migration clears prompts from all successful analyses

-- Clear ai_analysis_prompt for all documents with status 'completed' (successful)
UPDATE documents
SET ai_analysis_prompt = NULL
WHERE ai_analysis_status = 'completed'
  AND ai_analysis_prompt IS NOT NULL;

-- Verify the cleanup
-- Run this to check results:
-- SELECT
--   ai_analysis_status,
--   COUNT(*) as count,
--   COUNT(ai_analysis_prompt) as count_with_prompt,
--   COUNT(ai_analysis_error) as count_with_error
-- FROM documents
-- GROUP BY ai_analysis_status;

-- Expected results:
-- status='completed': count_with_prompt=0, count_with_error=0 (all NULL)
-- status='failed': count_with_prompt>0, count_with_error>0 (has values)
-- status='pending': count_with_prompt=0, count_with_error=0 (all NULL)
