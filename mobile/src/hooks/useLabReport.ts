import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/apiClient';
import { useDocumentsStore } from '../store/documentsStore';
import { useAuthStore } from '../store/authStore';

export interface TestResult {
  id: string;
  user_id: string;
  document_id: string;
  report_date: string;
  test_name: string;
  value: string;
  unit: string | null;
  ref_min: number | null;
  ref_max: number | null;
  ref_type: string | null;
  status: string | null; // e.g., 'NORMAL', 'HIGH', 'LOW'
  biomarker_id: string | null;
  biomarker?: {
    test_results: string | null;
  } | null;
}

export type GroupedTestResults = {
  actionRequired: TestResult[];
  optimalResults: TestResult[];
};

export function useLabReport(documentId?: string) {
  const [reportData, setReportData] = useState<GroupedTestResults>({ actionRequired: [], optimalResults: [] });
  const [pastValues, setPastValues] = useState<Record<string, TestResult[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { documents } = useDocumentsStore();
  const { user } = useAuthStore();
  
  const document = documents.find(d => d.id === documentId);

  const fetchData = useCallback(async () => {
    if (!documentId || !user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      // Fetch current test results for this report
      const { data: resultsData, error: resultsError } = await api.from('test_results')
        .select('*')
        .eq('document_id', documentId);

      if (resultsError) throw new Error(resultsError.message);

      let results: TestResult[] = (resultsData || []).map((r: any) => ({
        ...r,
        biomarker: null
      }));

      // Fetch biomarker info separately since join might not be supported
      const currentBiomarkerIds = results
        .map(r => r.biomarker_id)
        .filter((id): id is string => !!id);

      if (currentBiomarkerIds.length > 0) {
        const { data: biomarkerData, error: biomarkerError } = await api.from('biomarkers_mastertable')
          .select('biomarker_id, description, interpretation_normal, interpretation_low, interpretation_high, interpretation_borderline, interpretation_critical, interpretation_abnormal')
          .in('biomarker_id', Array.from(new Set(currentBiomarkerIds)));

        if (!biomarkerError && biomarkerData) {
          const biomarkerMap: Record<string, any> = {};
          biomarkerData.forEach((b: any) => {
            biomarkerMap[b.biomarker_id] = b;
          });

          results = results.map(r => {
            const biomarker = r.biomarker_id ? biomarkerMap[r.biomarker_id] : null;
            if (!biomarker) return { ...r, biomarker: null };

            const status = r.status?.toLowerCase() || 'normal';
            // Use the status to pick the right interpretation column
            const interpretationKey = `interpretation_${status}`;
            const interpretation = biomarker[interpretationKey];

            let finalDescription = biomarker.description || '';
            if (interpretation && interpretation.trim()) {
              if (finalDescription) {
                finalDescription += '\n\n';
              }
              finalDescription += interpretation;
            }

            return {
              ...r,
              biomarker: {
                test_results: finalDescription || null
              }
            };
          });
        }
      }
      
      const actionRequired = results.filter(r => r.status && r.status.toUpperCase() !== 'NORMAL');
      const optimalResults = results.filter(r => !r.status || r.status.toUpperCase() === 'NORMAL');

      setReportData({ actionRequired, optimalResults });

      // Fetch past values for tests with biomarker_id
      const biomarkerIds = results
        .map(r => r.biomarker_id)
        .filter((id): id is string => !!id);

      if (biomarkerIds.length > 0) {
        // We need to fetch past values for these biomarkers
        // In Supabase, we can use the `.in()` filter
        const { data: pastData, error: pastError } = await api.from('test_results')
          .select('*')
          .in('biomarker_id', biomarkerIds)
          .neq('document_id', documentId) // Exclude current report
          .order('report_date', { ascending: false });

        if (!pastError && pastData) {
          const pastByBiomarker: Record<string, TestResult[]> = {};
          pastData.forEach((result: TestResult) => {
            if (result.biomarker_id) {
              if (!pastByBiomarker[result.biomarker_id]) {
                pastByBiomarker[result.biomarker_id] = [];
              }
              pastByBiomarker[result.biomarker_id].push(result);
            }
          });
          setPastValues(pastByBiomarker);
        }
      }

    } catch (err: any) {
      console.error('[useLabReport] Fetch error:', err);
      setError(err.message || 'Failed to load lab report data.');
    } finally {
      setIsLoading(false);
    }
  }, [documentId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    document,
    reportData,
    pastValues,
    isLoading,
    error,
    refetch: fetchData,
  };
}
