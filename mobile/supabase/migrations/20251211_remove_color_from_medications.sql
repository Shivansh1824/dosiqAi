-- Drop color column from medications table
-- Migration: Remove color field - calculate on-the-fly instead
-- Created: 2025-12-11
--
-- Context:
-- Color is deterministic: medicationColors[index % 7]
-- No need to store what can be calculated
-- Saves ~10 bytes per medication
-- Same optimization pattern as documents table

-- Drop color column
ALTER TABLE medications
  DROP COLUMN IF EXISTS color;

-- Verify the column was dropped
-- Run this to check results:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'medications'
-- ORDER BY ordinal_position;

-- Expected: color column should not appear in results
