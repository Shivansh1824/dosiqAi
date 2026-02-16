-- Ensure only one "Self" family member exists per user
-- This prevents duplicate primary family members from being created
-- 
-- This migration is idempotent - it can be run multiple times safely
-- If the constraint already exists (created manually), this will be skipped

-- Check if the constraint already exists before creating it
DO $$
BEGIN
  -- Check if the unique index exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'family_members' 
    AND indexname = 'idx_unique_self_member'
  ) THEN
    -- Create unique partial index to ensure only one "Self" member per user
    -- Partial index (WHERE clause) makes this more efficient than a regular unique constraint
    CREATE UNIQUE INDEX idx_unique_self_member 
    ON family_members(user_id) 
    WHERE relationship = 'Self';
    
    RAISE NOTICE 'Created unique index: idx_unique_self_member';
  ELSE
    RAISE NOTICE 'Unique index idx_unique_self_member already exists, skipping';
  END IF;
END
$$;

-- Add a comment to document the constraint
COMMENT ON INDEX idx_unique_self_member IS 
'Ensures each user has exactly one family member with relationship = Self. This is the primary user profile.';
