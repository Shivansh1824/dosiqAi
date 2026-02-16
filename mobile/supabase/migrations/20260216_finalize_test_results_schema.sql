-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Finalize Test Results Schema
-- Created: 2026-02-16
-- Purpose: Consolidate test_results table into the final simplified schema
--          removing legacy columns and indices from V1/V2 migrations.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO $$ 
BEGIN
    -- 1. Drop Legacy Indices from V1 and V2
    DROP INDEX IF EXISTS public.idx_test_results_trending;
    DROP INDEX IF EXISTS public.idx_test_results_trending_name;
    DROP INDEX IF EXISTS public.idx_test_results_abnormal;
    DROP INDEX IF EXISTS public.idx_test_results_category;
    DROP INDEX IF EXISTS public.idx_test_results_family_member;
    DROP INDEX IF EXISTS public.idx_test_results_user;
    DROP INDEX IF EXISTS public.idx_test_results_trend_analysis;

    -- 2. Drop Legacy Columns from V1
    -- V1: result_value, result_numeric, reference_range, abnormal_flag, ai_extracted, verified_by_user, notes, specimen_type, test_method, measured_at, family_member_id, category, test_code
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS result_value;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS result_numeric;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS reference_range;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS abnormal_flag;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS ai_extracted;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS verified_by_user;
    -- Note: 'notes' might contain useful data, but user schema doesn't have it.
    -- We drop it to strictly follow the new schema.
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS notes;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS specimen_type;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS test_method;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS measured_at;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS family_member_id;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS category;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS test_code;
    
    -- V1 Enhancement (Trend columns)
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS previous_value;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS change_percentage;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS trend;

    -- 3. Drop Legacy Columns from V2
    -- V2: interpretation, loinc_code, loinc_category
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS interpretation;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS loinc_code;
    ALTER TABLE public.test_results DROP COLUMN IF EXISTS loinc_category;

    -- 4. Ensure New Columns Exist with Correct Types
    -- and match user's provided schema: (value text, ref_min numeric, ref_max numeric, ref_type text, status text)
    
    -- value (V2 had value text, V1 had result_value)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_results' AND column_name = 'value') THEN
        ALTER TABLE public.test_results ADD COLUMN value TEXT;
    END IF;

    -- ref_min/max/type (V2 names)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_results' AND column_name = 'ref_min') THEN
        ALTER TABLE public.test_results ADD COLUMN ref_min NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_results' AND column_name = 'ref_max') THEN
        ALTER TABLE public.test_results ADD COLUMN ref_max NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_results' AND column_name = 'ref_type') THEN
        ALTER TABLE public.test_results ADD COLUMN ref_type TEXT;
    END IF;

    -- status (V2 had status text)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_results' AND column_name = 'status') THEN
        ALTER TABLE public.test_results ADD COLUMN status TEXT;
    END IF;

    -- biomarker_id (Added in recent migration, ensuring it exists)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_results' AND column_name = 'biomarker_id') THEN
        ALTER TABLE public.test_results ADD COLUMN biomarker_id UUID;
    END IF;

    -- 5. Re-check Constraints
    -- test_results_biomarker_id_fkey: Ensure SET NULL
    ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_biomarker_id_fkey;
    ALTER TABLE public.test_results ADD CONSTRAINT test_results_biomarker_id_fkey FOREIGN KEY (biomarker_id) REFERENCES biomarkers_mastertable (biomarker_id) ON DELETE SET NULL;

    -- test_results_lab_report_id_fkey: Ensure CASCADE
    ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_lab_report_id_fkey;
    ALTER TABLE public.test_results ADD CONSTRAINT test_results_lab_report_id_fkey FOREIGN KEY (lab_report_id) REFERENCES lab_reports (id) ON DELETE CASCADE;

    -- test_results_user_id_fkey: Ensure CASCADE
    ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_user_id_fkey;
    ALTER TABLE public.test_results ADD CONSTRAINT test_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

    -- 6. Indices (Matching user's request)
    CREATE INDEX IF NOT EXISTS idx_test_results_lab_report ON public.test_results (lab_report_id);
    
    -- Drop and recreate the composite index to ensure correct column order
    DROP INDEX IF EXISTS public.idx_test_results_user_name;
    CREATE INDEX idx_test_results_user_name ON public.test_results (user_id, test_name);

END $$;
