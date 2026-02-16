-- Migration script to add biomarker_id field to test_results table
-- This migration was applied directly via Supabase Dashboard / SQL Editor

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_results' AND column_name = 'biomarker_id') THEN
        ALTER TABLE public.test_results ADD COLUMN biomarker_id UUID REFERENCES public.biomarkers_mastertable(biomarker_id);
    END IF;
END $$;
