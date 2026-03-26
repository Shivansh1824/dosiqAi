import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLabReport, TestResult } from './useLabReport';
import { normalizeBiomarkerName, formatCategoryName } from '../utils/stringUtils';

function filterAndSort(tests: TestResult[], searchQuery: string, selectedCategory: string): TestResult[] {
  return tests
    .filter(t => {
      const normalizedSearch = normalizeBiomarkerName(searchQuery);
      const matchesSearch = !normalizedSearch || normalizeBiomarkerName(t.test_name).includes(normalizedSearch);
      const matchesCategory = selectedCategory === 'All' || t.biomarker?.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (a.biomarker_id && !b.biomarker_id) return -1;
      if (!a.biomarker_id && b.biomarker_id) return 1;
      return 0;
    });
}

export function useLabReportScreen(documentId: string) {
  const { document, reportData, pastValues, isLoading, error, refetch } = useLabReport(documentId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((testId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  }, []);

  const filteredActionRequired = useMemo(
    () => filterAndSort(reportData.actionRequired, searchQuery, selectedCategory),
    [reportData.actionRequired, searchQuery, selectedCategory],
  );

  const filteredOptimalResults = useMemo(
    () => filterAndSort(reportData.optimalResults, searchQuery, selectedCategory),
    [reportData.optimalResults, searchQuery, selectedCategory],
  );

  const { categoriesList, countsMap } = useMemo(() => {
    const allTests = [...reportData.actionRequired, ...reportData.optimalResults];
    const counts: Record<string, number> = { All: allTests.length };

    allTests.forEach(t => {
      if (t.biomarker?.category) {
        counts[t.biomarker.category] = (counts[t.biomarker.category] || 0) + 1;
      }
    });

    const list = ['All', ...Object.keys(counts).filter(c => c !== 'All').sort()];
    return { categoriesList: list, countsMap: counts };
  }, [reportData]);

  const patientName = document?.patient_name || 'Patient Report';

  const reportDate = document?.visit_date
    ? new Date(document.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : document?.ai_analysis_result?.visit_date
      ? new Date(document.ai_analysis_result.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : document?.ai_analyzed_at
        ? new Date(document.ai_analyzed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Unknown Date';

  const displayTitle = document?.ai_analysis_result?.patient?.name || (document?.local_file_path?.split('/').pop() || 'Medical Document');

  const isAnalyzing = document?.ai_analysis_status === 'processing' || document?.ai_analysis_status === 'pending';
  const isEmpty = reportData.actionRequired.length === 0 && reportData.optimalResults.length === 0;

  return {
    document,
    reportData,
    pastValues,
    isLoading,
    error,
    refetch,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    expandedCards,
    toggleExpand,
    filteredActionRequired,
    filteredOptimalResults,
    categoriesList,
    countsMap,
    patientName,
    reportDate,
    displayTitle,
    isAnalyzing,
    isEmpty,
    formatCategoryName,
  };
}
