-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Consolidated Baseline Migration
-- Created: 2026-02-17
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ═══════════════════════════════════════════════════════════════
-- 1. EXTENSIONS
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ═══════════════════════════════════════════════════════════════
-- 2. FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Update updated_at timestamp column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fuzzy search for biomarkers
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

-- ═══════════════════════════════════════════════════════════════
-- 3. TABLES
-- ═══════════════════════════════════════════════════════════════

-- [family_members]
CREATE TABLE public.family_members (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL,
  name text NOT NULL,
  relationship text NULL,
  gender text NULL,
  date_of_birth date NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  linked_user_id uuid NULL,
  morning_dose_time time without time zone NULL DEFAULT '08:00:00'::time without time zone,
  afternoon_dose_time time without time zone NULL DEFAULT '14:00:00'::time without time zone,
  night_dose_time time without time zone NULL DEFAULT '20:00:00'::time without time zone,
  snooze_duration integer NULL DEFAULT 10,
  reminder_style text NULL DEFAULT 'standard'::text,
  alert_display_mode text NULL DEFAULT 'temporary'::text,
  ios_followup_count integer NULL DEFAULT 2,
  ios_notification_tune text NULL DEFAULT 'default'::text,
  android_notification_tune text NULL DEFAULT 'default'::text,
  CONSTRAINT family_members_pkey PRIMARY KEY (id),
  CONSTRAINT family_members_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES auth.users (id),
  CONSTRAINT family_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT family_members_alert_display_mode_check CHECK (alert_display_mode = ANY (ARRAY['temporary'::text, 'alert'::text])),
  CONSTRAINT family_members_ios_followup_count_check CHECK ((ios_followup_count >= 0) AND (ios_followup_count <= 3)),
  CONSTRAINT family_members_reminder_style_check CHECK (reminder_style = ANY (ARRAY['standard'::text, 'assurance'::text]))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_self_member ON public.family_members USING btree (user_id, relationship) WHERE (relationship = 'Self'::text);

-- [biomarkers_mastertable]
CREATE TABLE public.biomarkers_mastertable (
  biomarker_id uuid NOT NULL DEFAULT gen_random_uuid (),
  standard_name character varying(100) NOT NULL,
  display_name character varying(100) NULL,
  short_name character varying(50) NULL,
  unit character varying(20) NULL,
  min_value real NULL,
  max_value real NULL,
  description text NULL,
  category character varying(50) NULL,
  specimen_type character varying(30) NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  interpretation_normal text NULL,
  interpretation_low text NULL,
  interpretation_high text NULL,
  interpretation_borderline text NULL,
  interpretation_critical text NULL,
  interpretation_abnormal text NULL,
  CONSTRAINT biomarkers_mastertable_pkey PRIMARY KEY (biomarker_id),
  CONSTRAINT biomarkers_mastertable_standard_name_key UNIQUE (standard_name)
) TABLESPACE pg_default;

-- [biomarkers_aliases]
CREATE TABLE public.biomarkers_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  biomarker_id uuid NOT NULL,
  alias_name character varying(100) NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT biomarkers_aliases_pkey PRIMARY KEY (id, alias_name),
  CONSTRAINT biomarkers_aliases_biomarker_id_fkey FOREIGN KEY (biomarker_id) REFERENCES biomarkers_mastertable (biomarker_id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_alias_name ON public.biomarkers_aliases USING btree (alias_name);
CREATE INDEX IF NOT EXISTS idx_biomarkers_aliases_alias_trgm ON public.biomarkers_aliases USING gin (alias_name gin_trgm_ops);

-- [documents]
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'Other'::text,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  local_file_path text NULL,
  family_member_id uuid NULL,
  ai_analysis_status text NULL DEFAULT 'pending'::text,
  ai_analysis_result jsonb NULL,
  ai_analyzed_at timestamp with time zone NULL,
  ai_analysis_tokens_used integer NULL,
  cloud_file_key text NULL,
  ai_analysis_error jsonb NULL,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_family_member_id_fkey FOREIGN KEY (family_member_id) REFERENCES family_members (id) ON DELETE CASCADE,
  CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT documents_ai_analysis_status_check CHECK (ai_analysis_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_documents_analysis_status ON public.documents USING btree (ai_analysis_status);
CREATE INDEX IF NOT EXISTS idx_documents_analyzed_at ON public.documents USING btree (ai_analyzed_at DESC) WHERE (ai_analyzed_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_documents_family_member ON public.documents USING btree (family_member_id);
CREATE INDEX IF NOT EXISTS idx_documents_cloud_file_key ON public.documents USING btree (cloud_file_key) WHERE (cloud_file_key IS NOT NULL);

-- [appointments]
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL,
  doctor_name text NOT NULL,
  appointment_type text NOT NULL DEFAULT 'General'::text,
  date date NOT NULL,
  time time without time zone NOT NULL,
  location text NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'scheduled'::text,
  color text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  family_member_id uuid NOT NULL,
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_family_member_id_fkey FOREIGN KEY (family_member_id) REFERENCES family_members (id) ON DELETE CASCADE,
  CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_appointments_family_member ON public.appointments USING btree (family_member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON public.appointments USING btree (family_member_id, status, date) WHERE (status = 'scheduled'::text);

-- [biomarker_debug_logs]
CREATE TABLE public.biomarker_debug_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  created_at timestamp with time zone NULL DEFAULT now(),
  test_reference text NULL,
  exact_matches jsonb NULL,
  fuzzy_matches jsonb NULL,
  not_found jsonb NULL,
  CONSTRAINT biomarker_debug_logs_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- [chart_preferences]
CREATE TABLE public.chart_preferences (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL,
  family_member_id uuid NULL,
  default_chart_type text NULL DEFAULT 'line'::text,
  default_time_range text NULL DEFAULT '6m'::text,
  show_reference_ranges boolean NULL DEFAULT true,
  show_annotations boolean NULL DEFAULT true,
  color_blind_mode boolean NULL DEFAULT false,
  pinned_metrics text[] NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT chart_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT chart_preferences_user_id_family_member_id_key UNIQUE (user_id, family_member_id),
  CONSTRAINT chart_preferences_family_member_id_fkey FOREIGN KEY (family_member_id) REFERENCES family_members (id) ON DELETE CASCADE,
  CONSTRAINT chart_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT chart_preferences_default_chart_type_check CHECK (default_chart_type = ANY (ARRAY['line'::text, 'bar'::text, 'area'::text])),
  CONSTRAINT chart_preferences_default_time_range_check CHECK (default_time_range = ANY (ARRAY['1m'::text, '3m'::text, '6m'::text, '1y'::text, 'all'::text]))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_chart_preferences_user_family ON public.chart_preferences USING btree (user_id, family_member_id);

-- [health_vitals]
CREATE TABLE public.health_vitals (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL,
  family_member_id uuid NULL,
  type text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  unit text NULL,
  status text NOT NULL,
  icon_name text NOT NULL,
  trend text NULL,
  detail text NULL,
  measured_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT health_vitals_pkey PRIMARY KEY (id),
  CONSTRAINT health_vitals_family_member_id_fkey FOREIGN KEY (family_member_id) REFERENCES family_members (id) ON DELETE CASCADE,
  CONSTRAINT health_vitals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT health_vitals_status_check CHECK (status = ANY (ARRAY['normal'::text, 'warning'::text, 'critical'::text])),
  CONSTRAINT health_vitals_trend_check CHECK (trend = ANY (ARRAY['up'::text, 'down'::text, 'stable'::text])),
  CONSTRAINT health_vitals_type_check CHECK (type = ANY (ARRAY['vital'::text, 'finding'::text]))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_health_vitals_type ON public.health_vitals USING btree (type);
CREATE INDEX IF NOT EXISTS idx_health_vitals_user_id ON public.health_vitals USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_health_vitals_measured_at ON public.health_vitals USING btree (measured_at DESC);

-- [lab_reports]
CREATE TABLE public.lab_reports (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL,
  patient_name text NULL,
  age integer NULL,
  gender text NULL,
  lab_name text NULL,
  collection_date date NULL,
  report_date date NULL,
  ai_summary text NULL,
  CONSTRAINT lab_reports_pkey PRIMARY KEY (id),
  CONSTRAINT lab_reports_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
  CONSTRAINT lab_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_lab_reports_user ON public.lab_reports USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_document ON public.lab_reports USING btree (document_id);

-- [test_results]
CREATE TABLE public.test_results (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL,
  lab_report_id uuid NOT NULL,
  report_date date NULL,
  test_name text NOT NULL,
  value text NULL,
  unit text NULL,
  ref_min numeric NULL,
  ref_max numeric NULL,
  ref_type text NULL,
  status text NULL,
  biomarker_id uuid NULL,
  CONSTRAINT test_results_pkey PRIMARY KEY (id),
  CONSTRAINT test_results_id_key UNIQUE (id),
  CONSTRAINT test_results_biomarker_id_fkey FOREIGN KEY (biomarker_id) REFERENCES biomarkers_mastertable (biomarker_id) ON DELETE SET NULL,
  CONSTRAINT test_results_lab_report_id_fkey FOREIGN KEY (lab_report_id) REFERENCES lab_reports (id) ON DELETE CASCADE,
  CONSTRAINT test_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_test_results_lab_report ON public.test_results USING btree (lab_report_id);
CREATE INDEX IF NOT EXISTS idx_test_results_user_name ON public.test_results USING btree (user_id, test_name);

-- [medication_logs]
CREATE TABLE public.medication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  medication_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scheduled_date text NOT NULL,
  scheduled_time text NOT NULL,
  taken_at timestamp with time zone NULL,
  status text NOT NULL,
  notes text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT medication_logs_pkey PRIMARY KEY (id),
  CONSTRAINT medication_logs_medication_id_scheduled_date_scheduled_time_key UNIQUE (medication_id, scheduled_date, scheduled_time),
  CONSTRAINT medication_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT medication_logs_status_check CHECK (status = ANY (ARRAY['pending'::text, 'taken'::text, 'missed'::text, 'skipped'::text]))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_medication_logs_user_id ON public.medication_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_medication_id ON public.medication_logs USING btree (medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_scheduled_date ON public.medication_logs USING btree (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_medication_logs_status ON public.medication_logs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_med_logs_user_date ON public.medication_logs USING btree (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_med_logs_medication ON public.medication_logs USING btree (medication_id);

-- [medication_schedules]
CREATE TABLE public.medication_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL,
  family_member_id uuid NOT NULL,
  name text NOT NULL,
  scientific_name text NULL,
  medicine_type text NULL,
  medicine_purpose text NULL,
  form text NULL,
  strength text NULL,
  dosage_instruction text NULL,
  timing_dosage text NULL,
  times_per_day integer NULL,
  reminder_times jsonb NULL,
  food_relationship text NULL,
  interval_days integer NULL,
  start_date date NOT NULL,
  duration_days integer NULL,
  end_date date NULL,
  notes text NULL,
  source_document_id uuid NULL,
  ai_confidence real NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medication_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT medication_schedules_family_member_id_fkey FOREIGN KEY (family_member_id) REFERENCES family_members (id),
  CONSTRAINT medication_schedules_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES documents (id),
  CONSTRAINT medication_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_med_schedules_user_id ON public.medication_schedules USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_med_schedules_family_member ON public.medication_schedules USING btree (family_member_id);

-- [metric_annotations]
CREATE TABLE public.metric_annotations (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL,
  test_result_id uuid NOT NULL,
  note text NOT NULL,
  event_type text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT metric_annotations_pkey PRIMARY KEY (id),
  CONSTRAINT metric_annotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT metric_annotations_event_type_check CHECK (event_type = ANY (ARRAY['medication_change'::text, 'lifestyle_change'::text, 'symptom'::text, 'other'::text]))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_metric_annotations_test_result ON public.metric_annotations USING btree (test_result_id);
CREATE INDEX IF NOT EXISTS idx_metric_annotations_user ON public.metric_annotations USING btree (user_id, created_at DESC);

-- [potential_biomarker]
CREATE TABLE public.potential_biomarker (
  test_results_id uuid NOT NULL DEFAULT gen_random_uuid (),
  created_at timestamp with time zone NULL DEFAULT now(),
  test_name text NOT NULL,
  source text NULL,
  CONSTRAINT potential_biomarker_pkey PRIMARY KEY (test_name),
  CONSTRAINT fk_test_results FOREIGN KEY (test_results_id) REFERENCES test_results (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- [upload_limits]
CREATE TABLE public.upload_limits (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  user_id uuid NOT NULL,
  upload_date date NOT NULL DEFAULT CURRENT_DATE,
  upload_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT upload_limits_pkey PRIMARY KEY (id),
  CONSTRAINT upload_limits_user_id_upload_date_key UNIQUE (user_id, upload_date),
  CONSTRAINT upload_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_upload_limits_user_date ON public.upload_limits USING btree (user_id, upload_date);
CREATE INDEX IF NOT EXISTS idx_upload_limits_date ON public.upload_limits USING btree (upload_date DESC);

-- ═══════════════════════════════════════════════════════════════
-- 4. TRIGGERS
-- ═══════════════════════════════════════════════════════════════

CREATE TRIGGER update_chart_preferences_updated_at BEFORE UPDATE ON chart_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column ();
CREATE TRIGGER update_health_vitals_updated_at BEFORE UPDATE ON health_vitals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column ();
CREATE TRIGGER update_metric_annotations_updated_at BEFORE UPDATE ON metric_annotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column ();
