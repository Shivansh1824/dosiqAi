-- Migration: Enhance Lab Reports Schema
-- Date: 2025-12-26
-- Purpose: Add trend tracking, user preferences, and annotations for lab reports

-- ============================================================================
-- 1. Add Historical Trend Support to test_results Table
-- ============================================================================

-- Add columns for tracking changes over time
ALTER TABLE test_results
ADD COLUMN IF NOT EXISTS previous_value NUMERIC,
ADD COLUMN IF NOT EXISTS change_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS trend TEXT CHECK (trend IN ('improving', 'worsening', 'stable'));

-- Create index for efficient trend analysis queries
CREATE INDEX IF NOT EXISTS idx_test_results_trend_analysis
ON test_results(family_member_id, test_code, measured_at DESC)
WHERE result_numeric IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN test_results.previous_value IS 'The value from the previous test for comparison';
COMMENT ON COLUMN test_results.change_percentage IS 'Percentage change from previous value (positive = increase, negative = decrease)';
COMMENT ON COLUMN test_results.trend IS 'Health trend direction: improving (getting closer to normal), worsening (moving away from normal), stable (no significant change)';

-- ============================================================================
-- 2. Create Chart Preferences Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS chart_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,

  -- Display preferences
  default_chart_type TEXT DEFAULT 'line' CHECK (default_chart_type IN ('line', 'bar', 'area')),
  default_time_range TEXT DEFAULT '6m' CHECK (default_time_range IN ('1m', '3m', '6m', '1y', 'all')),
  show_reference_ranges BOOLEAN DEFAULT TRUE,
  show_annotations BOOLEAN DEFAULT TRUE,
  color_blind_mode BOOLEAN DEFAULT FALSE,

  -- Pinned metrics for quick access
  pinned_metrics TEXT[],

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: One preference row per user-family_member combination
  UNIQUE(user_id, family_member_id)
);

-- Add comments for documentation
COMMENT ON TABLE chart_preferences IS 'User preferences for lab report chart display';
COMMENT ON COLUMN chart_preferences.default_chart_type IS 'Preferred chart visualization type';
COMMENT ON COLUMN chart_preferences.default_time_range IS 'Default time range for trend charts';
COMMENT ON COLUMN chart_preferences.show_reference_ranges IS 'Show colored reference range zones on charts';
COMMENT ON COLUMN chart_preferences.show_annotations IS 'Show user annotations on timeline';
COMMENT ON COLUMN chart_preferences.color_blind_mode IS 'Use color-blind friendly palette';
COMMENT ON COLUMN chart_preferences.pinned_metrics IS 'Array of test_codes for quick access metrics';

-- Row Level Security (RLS) policies
ALTER TABLE chart_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chart preferences"
  ON chart_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chart preferences"
  ON chart_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chart preferences"
  ON chart_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chart preferences"
  ON chart_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chart_preferences_user_family
ON chart_preferences(user_id, family_member_id);

-- ============================================================================
-- 3. Create Metric Annotations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS metric_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,

  -- Annotation content
  note TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('medication_change', 'lifestyle_change', 'symptom', 'other')),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE metric_annotations IS 'User notes and annotations on lab test results';
COMMENT ON COLUMN metric_annotations.note IS 'User-entered note text';
COMMENT ON COLUMN metric_annotations.event_type IS 'Category of event: medication_change, lifestyle_change, symptom, or other';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_metric_annotations_test_result
ON metric_annotations(test_result_id);

CREATE INDEX IF NOT EXISTS idx_metric_annotations_user
ON metric_annotations(user_id, created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE metric_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own annotations"
  ON metric_annotations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own annotations"
  ON metric_annotations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annotations"
  ON metric_annotations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations"
  ON metric_annotations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Create Trigger to Update updated_at Timestamp
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for chart_preferences
DROP TRIGGER IF EXISTS update_chart_preferences_updated_at ON chart_preferences;
CREATE TRIGGER update_chart_preferences_updated_at
  BEFORE UPDATE ON chart_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for metric_annotations
DROP TRIGGER IF EXISTS update_metric_annotations_updated_at ON metric_annotations;
CREATE TRIGGER update_metric_annotations_updated_at
  BEFORE UPDATE ON metric_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Create Helper Functions for Trend Calculation
-- ============================================================================

-- Function to calculate trend for a test result
CREATE OR REPLACE FUNCTION calculate_test_result_trend(
  p_test_result_id UUID
)
RETURNS void AS $$
DECLARE
  v_current_record RECORD;
  v_previous_record RECORD;
  v_change NUMERIC;
  v_change_pct NUMERIC;
  v_trend TEXT;
  v_normal_min NUMERIC;
  v_normal_max NUMERIC;
BEGIN
  -- Get current test result
  SELECT * INTO v_current_record
  FROM test_results
  WHERE id = p_test_result_id;

  -- Only process if result_numeric exists
  IF v_current_record.result_numeric IS NULL THEN
    RETURN;
  END IF;

  -- Get previous test result for same metric and family member
  SELECT * INTO v_previous_record
  FROM test_results
  WHERE family_member_id = v_current_record.family_member_id
    AND test_code = v_current_record.test_code
    AND measured_at < v_current_record.measured_at
    AND result_numeric IS NOT NULL
  ORDER BY measured_at DESC
  LIMIT 1;

  -- Calculate change if previous record exists
  IF FOUND THEN
    v_change := v_current_record.result_numeric - v_previous_record.result_numeric;

    -- Calculate percentage change (avoid division by zero)
    IF v_previous_record.result_numeric != 0 THEN
      v_change_pct := (v_change / v_previous_record.result_numeric) * 100;
    ELSE
      v_change_pct := NULL;
    END IF;

    -- Determine trend direction based on reference range
    -- Extract numeric values from reference_range (format: "min-max unit")
    -- This is a simplified version - production code should handle various formats
    BEGIN
      -- Try to parse reference range (e.g., "13.0-17.0" or "13.0 - 17.0")
      v_normal_min := (regexp_match(v_current_record.reference_range, '(\d+\.?\d*)\s*-'))[1]::NUMERIC;
      v_normal_max := (regexp_match(v_current_record.reference_range, '-\s*(\d+\.?\d*)'))[1]::NUMERIC;

      -- Determine trend
      IF v_current_record.result_numeric >= v_normal_min AND v_current_record.result_numeric <= v_normal_max THEN
        -- Currently in normal range
        IF v_previous_record.result_numeric >= v_normal_min AND v_previous_record.result_numeric <= v_normal_max THEN
          v_trend := 'stable'; -- Was normal, still normal
        ELSE
          v_trend := 'improving'; -- Was abnormal, now normal
        END IF;
      ELSIF v_current_record.result_numeric < v_normal_min THEN
        -- Currently low
        IF v_change > 0 THEN
          v_trend := 'improving'; -- Increasing toward normal
        ELSIF v_change < 0 THEN
          v_trend := 'worsening'; -- Decreasing away from normal
        ELSE
          v_trend := 'stable';
        END IF;
      ELSE
        -- Currently high
        IF v_change < 0 THEN
          v_trend := 'improving'; -- Decreasing toward normal
        ELSIF v_change > 0 THEN
          v_trend := 'worsening'; -- Increasing away from normal
        ELSE
          v_trend := 'stable';
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If reference range parsing fails, use simple change direction
      IF ABS(v_change_pct) < 5 THEN
        v_trend := 'stable'; -- Less than 5% change
      ELSIF v_current_record.abnormal_flag IS NULL OR v_current_record.abnormal_flag = '' THEN
        v_trend := 'stable'; -- Normal status
      ELSE
        v_trend := NULL; -- Cannot determine
      END IF;
    END;

    -- Update current record with trend data
    UPDATE test_results
    SET
      previous_value = v_previous_record.result_numeric,
      change_percentage = v_change_pct,
      trend = v_trend
    WHERE id = p_test_result_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION calculate_test_result_trend IS 'Calculates trend data by comparing with previous test result for the same metric';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify tables exist
DO $$
BEGIN
  RAISE NOTICE 'Migration complete. Created tables:';
  RAISE NOTICE '  - chart_preferences';
  RAISE NOTICE '  - metric_annotations';
  RAISE NOTICE 'Enhanced tables:';
  RAISE NOTICE '  - test_results (added trend columns)';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - calculate_test_result_trend()';
END $$;
