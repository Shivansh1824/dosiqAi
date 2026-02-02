-- 1. Ensure start_date is populated (default to created_at)
UPDATE medication_schedules
SET start_date = created_at::date
WHERE start_date IS NULL;

-- 2. Handle INACTIVE medications (is_active = false)
-- Ensure they have an end_date in the past
UPDATE medication_schedules
SET end_date = CASE
    -- If already has a past end_date, keep it
    WHEN end_date IS NOT NULL AND end_date < CURRENT_DATE THEN end_date
    -- Otherwise set to updated_at or yesterday
    ELSE COALESCE(updated_at::date, CURRENT_DATE - INTERVAL '1 day')
    END
WHERE is_active = false;

-- 3. Handle ACTIVE medications (is_active = true)
-- Ensure they do NOT have an end_date in the past. If they do, clear it (make ongoing).
UPDATE medication_schedules
SET end_date = NULL
WHERE is_active = true AND (end_date IS NOT NULL AND end_date < CURRENT_DATE);

-- 4. Calculate duration_days where possible (consistency check)
-- Only set if missing and we have both dates
UPDATE medication_schedules
SET duration_days = (end_date - start_date)::int
WHERE duration_days IS NULL AND start_date IS NOT NULL AND end_date IS NOT NULL;

-- 5. Drop the old column
ALTER TABLE medication_schedules DROP COLUMN IF EXISTS is_active;
