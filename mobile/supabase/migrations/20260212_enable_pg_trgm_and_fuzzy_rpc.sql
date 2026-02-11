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

-- 3. Create the fuzzy search RPC function
-- Called from match-biomarkers edge function via supabase.rpc('search_biomarker_fuzzy', ...)
CREATE OR REPLACE FUNCTION search_biomarker_fuzzy(
  search_term TEXT, 
  match_limit INT DEFAULT 5
)
RETURNS TABLE(
  alias_name TEXT,
  biomarker_id UUID,
  mastertable_interpretation TEXT,
  score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ba.alias_name::TEXT,
    ba.biomarker_id,
    bm.interpretation::TEXT AS mastertable_interpretation,
    similarity(ba.alias_name, search_term)::REAL AS score
  FROM biomarkers_aliases ba
  JOIN biomarkers_mastertable bm ON ba.biomarker_id = bm.biomarker_id
  WHERE 
    similarity(ba.alias_name, search_term) >= 0.3
    OR ba.alias_name ILIKE '%' || search_term || '%'
    OR bm.interpretation ILIKE '%' || search_term || '%'
  ORDER BY similarity(ba.alias_name, search_term) DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql STABLE;
