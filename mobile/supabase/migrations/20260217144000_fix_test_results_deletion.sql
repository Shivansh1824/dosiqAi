-- Fix deletion conflict for test_results
ALTER TABLE public.potential_biomarker 
DROP CONSTRAINT IF EXISTS fk_test_results;

ALTER TABLE public.potential_biomarker 
ADD CONSTRAINT fk_test_results 
FOREIGN KEY (test_results_id) 
REFERENCES public.test_results (id) 
ON DELETE CASCADE;

-- Also add missing foreign key for metric_annotations to ensure clean deletions
ALTER TABLE public.metric_annotations
DROP CONSTRAINT IF EXISTS metric_annotations_test_result_id_fkey;

ALTER TABLE public.metric_annotations
ADD CONSTRAINT metric_annotations_test_result_id_fkey 
FOREIGN KEY (test_result_id) 
REFERENCES public.test_results (id) 
ON DELETE CASCADE;
