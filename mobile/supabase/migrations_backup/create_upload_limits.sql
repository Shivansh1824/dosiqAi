-- Create upload_limits table for daily upload tracking
-- Migration: Add upload limit tracking
-- Created: 2025-12-05

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create upload_limits table for tracking daily uploads per user
CREATE TABLE IF NOT EXISTS upload_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
  upload_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, upload_date)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_upload_limits_user_date ON upload_limits(user_id, upload_date);
CREATE INDEX IF NOT EXISTS idx_upload_limits_date ON upload_limits(upload_date DESC);

-- Enable Row Level Security
ALTER TABLE upload_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own upload limits
CREATE POLICY "Users can view their own upload limits"
  ON upload_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own upload limits"
  ON upload_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own upload limits"
  ON upload_limits FOR UPDATE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE upload_limits IS 'Tracks daily document upload counts per user for rate limiting (max 5 per day)';
COMMENT ON COLUMN upload_limits.upload_date IS 'Date of uploads (used for daily reset)';
COMMENT ON COLUMN upload_limits.upload_count IS 'Number of uploads on this date';

-- ============================================
-- FUNCTION: Increment upload count for user
-- ============================================
CREATE OR REPLACE FUNCTION increment_upload_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Insert or update upload count for today
  INSERT INTO upload_limits (user_id, upload_date, upload_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, upload_date)
  DO UPDATE SET
    upload_count = upload_limits.upload_count + 1,
    updated_at = NOW()
  RETURNING upload_count INTO v_count;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION increment_upload_count IS 'Increments upload count for user on current date, returns new count';

-- ============================================
-- FUNCTION: Check if user has exceeded daily limit
-- ============================================
CREATE OR REPLACE FUNCTION check_upload_limit(p_user_id UUID, p_max_uploads INTEGER DEFAULT 5)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Get current upload count for today
  SELECT COALESCE(upload_count, 0)
  INTO v_count
  FROM upload_limits
  WHERE user_id = p_user_id AND upload_date = CURRENT_DATE;

  -- Return true if user is below limit, false if at or above limit
  RETURN COALESCE(v_count, 0) < p_max_uploads;
END;
$$;

COMMENT ON FUNCTION check_upload_limit IS 'Returns true if user can upload more documents today (below 5 limit), false otherwise';

-- ============================================
-- FUNCTION: Get current upload count for user
-- ============================================
CREATE OR REPLACE FUNCTION get_upload_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COALESCE(upload_count, 0)
  INTO v_count
  FROM upload_limits
  WHERE user_id = p_user_id AND upload_date = CURRENT_DATE;

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION get_upload_count IS 'Returns current upload count for user today';

-- ============================================
-- OPTIONAL: Cleanup old records (keep last 90 days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_upload_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM upload_limits
  WHERE upload_date < CURRENT_DATE - INTERVAL '90 days';
END;
$$;

COMMENT ON FUNCTION cleanup_old_upload_limits IS 'Deletes upload limit records older than 90 days (for data cleanup)';

-- Note: To automate cleanup, you can schedule this function using pg_cron extension
-- Example (if pg_cron is enabled):
-- SELECT cron.schedule('cleanup-upload-limits', '0 2 * * *', 'SELECT cleanup_old_upload_limits()');
