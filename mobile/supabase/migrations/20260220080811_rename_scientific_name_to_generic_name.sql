-- Rename scientific_name to generic_name
ALTER TABLE public.medication_schedules RENAME COLUMN scientific_name TO generic_name;
