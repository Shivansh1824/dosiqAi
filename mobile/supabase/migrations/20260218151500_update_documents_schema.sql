-- Migration to update documents table with patient_name and diagnosis
-- Created to match the updated schema provided by the user

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS patient_name text,
ADD COLUMN IF NOT EXISTS diagnosis text;

-- Comments:
-- The patient_name and diagnosis columns are added to allow easier querying 
-- and display of these key fields without needing to parse the full AI analysis JSON result.
-- existing columns (id, user_id, type, local_file_path, family_member_id, ai_analysis_status, 
-- ai_analysis_result, ai_analyzed_at, ai_analysis_tokens_used, cloud_file_key, ai_analysis_error) 
-- and their constraints/indexes are preserved as per the baseline.
