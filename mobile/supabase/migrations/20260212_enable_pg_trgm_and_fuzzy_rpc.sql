-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Enable pg_trgm Extension & Create Fuzzy Search RPC
-- Created: 2026-02-12
-- Purpose: Trigram similarity search for biomarker name matching
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. Enable the pg_trgm extension for trigram similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create GIN index on alias_name for fast trigram searches
CREATE INDEX IF NOT EXISTS idx_biomarkers_aliases_alias_trgm 
  ON biomarkers_aliases USING GIN (alias_name gin_trgm_ops);

CREATE OR REPLACE FUNCTION search_biomarker_fuzzy(
  search_term TEXT
)
RETURNS TABLE(
  alias_name TEXT,
  biomarker_id UUID,
  mastertable_description TEXT,
  score REAL
) AS $$
BEGIN
  RETURN QUERY
  WITH similarity_matches AS (
    -- Priority 1: Top 4 by name similarity
    SELECT 
      ba.alias_name::TEXT,
      ba.biomarker_id,
      bm.description::TEXT AS mastertable_description,
      similarity(ba.alias_name, search_term)::REAL AS score
    FROM biomarkers_aliases ba
    JOIN biomarkers_mastertable bm ON ba.biomarker_id = bm.biomarker_id
    WHERE similarity(ba.alias_name, search_term) >= 0.6
    ORDER BY score DESC
    LIMIT 4
  ),
  ilike_matches AS (
    -- Priority 2: Top 3 by description substring match (excluding those already found)
    SELECT 
      ba.alias_name::TEXT,
      ba.biomarker_id,
      bm.description::TEXT AS mastertable_description,
      similarity(ba.alias_name, search_term)::REAL AS score
    FROM biomarkers_aliases ba
    JOIN biomarkers_mastertable bm ON ba.biomarker_id = bm.biomarker_id
    WHERE bm.description ILIKE '%' || search_term || '%'
    AND ba.biomarker_id NOT IN (SELECT sm.biomarker_id FROM similarity_matches sm)
    ORDER BY score DESC
    LIMIT 3
  )
  SELECT * FROM similarity_matches
  UNION ALL
  SELECT * FROM ilike_matches;
END;
$$ LANGUAGE plpgsql STABLE;
