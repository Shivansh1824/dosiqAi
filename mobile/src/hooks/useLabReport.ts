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

      const results: TestResult[] = resultsData || [];
      
      const actionRequired = results.filter(r => r.status && r.status.toUpperCase() !== 'NORMAL');
      const optimalResults = results.filter(r => !r.status || r.status.toUpperCase() === 'NORMAL');

      setReportData({ actionRequired, optimalResults });

      // Fetch past values for tests with biomarker_id
      const biomarkerIds = actionRequired
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
