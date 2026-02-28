import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image, Alert, ActivityIndicator, FlatList, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Sizes, Typography } from '../src/constants';
import { Document, DocumentAnalysisResult } from '../src/types/document';
import { fileExists, getAbsolutePath, deleteLocalFile } from '../src/utils/fileStorage';
import { useFamilyMembersStore } from '../src/store/familyMembersStore';
import { useDocumentsStore } from '../src/store/documentsStore';
import { useMedicationsStore } from '../src/store/medicationsStore';
import { useAuthStore } from '../src/store/authStore';
import { useDocumentManager } from '../src/hooks/useDocumentManager';
import { parseAIMedication, detectDuplicateMedication } from '../src/utils/medicationParser';
import { supabase } from '../src/lib/apiClient';
import {
  MedicalReportAnalysis,
  calculateReportSummary,
  formatReportDate,
  getAbnormalCountInCategory,
  METRIC_STATUS_COLORS,
} from '../src/types/medicalReport';
import { InfoRow, MetricCard, ExpandableSection } from '../src/components/medicalReport';
import { generateAndSharePDF, sharePDF, PDFGenerationResult } from '../src/services/pdfGenerationService';
import LoadingOverlay from '../src/components/LoadingOverlay';
import { useAnalysisPDF } from '../src/hooks/useAnalysisPDF';
import ShareModal from '../src/components/ShareModal';
import AnalysisLoading from '../src/components/AnalysisLoading';
import DocumentOptionsModal from '../src/components/DocumentOptionsModal';
import { LinearGradient } from 'expo-linear-gradient';
import MedicationVerificationCard from '../src/components/MedicationVerificationCard';
import { VerifiedMedicationsGroup } from '../src/components/prescription/VerifiedMedicationsGroup';
import { PrescriptionSummary, MedicationsSection, DocumentPreview, DocumentPreviewLoading } from '../src/components/prescription';
import { AnalysisResultsDisplay } from '../src/components/prescription/AnalysisResultsDisplay';
import { GroupedTestsCard } from '../src/components/prescription/GroupedTestsCard';

import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import Pdf from 'react-native-pdf';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import FullScreenImageModal from '../src/components/FullScreenImageModal';
import { DocumentPreviewCard } from '../src/components/document/DocumentPreviewCard';

type DocumentDetailNavigationProp = StackNavigationProp<RootStackParamList, 'PrescriptionSummary'>;

interface DocumentDetailScreenProps {
  onBack: () => void;
  document: Document | undefined;
  navigation: DocumentDetailNavigationProp;
}

export default function DocumentDetailScreen({ onBack, document: documentProp, navigation }: DocumentDetailScreenProps) {
  const { familyMembers } = useFamilyMembersStore();
  const { documents, analysisProgress, retryAnalysis, deleteDocument } = useDocumentsStore();
  const { addMedicationFromAI, getActiveMedications } = useMedicationsStore();
  const { user } = useAuthStore();
  const {
    imageUri,
    fileNotFound,
    downloading,
    isDeleting: loading,
    isPdf,
    confirmDelete,
    handleDownload
  } = useDocumentManager({ document: documentProp, onDeleteSuccess: onBack });

  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [verifiedMedications, setVerifiedMedications] = useState<Set<string>>(new Set());
  const [dismissedMedicationIds, setDismissedMedicationIds] = useState<Set<string>>(new Set());
  // Live updates for medication reminders (index -> updates)
  const [medicationLiveUpdates, setMedicationLiveUpdates] = useState<Record<number, { current_reminder_times?: string[] }>>({});
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [labReportId, setLabReportId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  // Detect document type for share modal
  const documentType = useMemo(() => {
    const type = documentProp?.ai_analysis_result?.document_type?.toLowerCase();
    if (type === 'prescription') return 'prescription';
    if (type === 'lab_report' || type === 'report' || type === 'medical_report') return 'report';
    return 'other';
  }, [documentProp?.ai_analysis_result]);

  // VALIDATION: Handle undefined document
  if (!documentProp) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document Error</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>Document Not Found</Text>
          <Text style={styles.errorMessage}>
            The document you're trying to view could not be loaded. Please go back and try again.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={onBack} activeOpacity={0.8}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // SAFE: documentProp is guaranteed to exist after this point
  // Get LIVE document from store (updates when AI analysis completes and updates title)
  // Falls back to prop if not found in store (e.g., during initial load)
  const document = documents.find(d => d.id === documentProp.id) || documentProp;

  // AsyncStorage key for dismissed medications (NOW SAFE)
  const DISMISSED_MEDS_STORAGE_KEY = `dismissed_medications_${document.id} `;

  // Get analysis progress for this document
  const documentProgress = analysisProgress[document.id] || 0;

  // Get family member name
  const familyMember = familyMembers.find(m => m.id === document.family_member_id);


  // Get display title - prefer AI-generated filename from analysis result, fallback to document title
  // Smart Header Logic
  const analysis = document.ai_analysis_result;

  const { titleText, subtitleText } = useMemo(() => {
    let title = (document.ai_analysis_status === 'processing' || document.ai_analysis_status === 'pending')
      ? "dosiq Ai • Analyzing..."
      : (document.local_file_path?.split('/').pop() || 'Medical Document');
    let subtitle = '';

    if (analysis) {
      // 1. Construct Smart Title
      if (analysis.document_type === 'prescription' && analysis.diagnosis?.condition) {
        title = `${analysis.diagnosis.condition} Prescription`;
      } else if (analysis.document_type) {
        // Map 'invalid' to friendlier 'Needs Review' label
        if (analysis.document_type.toLowerCase() === 'invalid') {
          title = 'Unrecognized Document';
        } else {
          // Capitalize (e.g., "lab_report" -> "Lab Report")
          title = analysis.document_type
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      } else if (analysis.file_name) {
        // Fallback to filename if no specific type data
        title = analysis.file_name;
      }

      // 2. Construct Subtitle (Patient • Date)
      const parts = [];
      if (analysis.patient?.name) parts.push(analysis.patient.name);

      if (analysis.visit_date) {
        parts.push(analysis.visit_date);
      }
      subtitle = parts.join(' • ');
    }

    return { titleText: title, subtitleText: subtitle };
  }, [document.ai_analysis_status, document.local_file_path, analysis]);

  // Keep displayTitle for shared PDF viewer
  const displayTitle = titleText;




  useEffect(() => {
    const loadDismissedMedications = async () => {
      try {
        const stored = await AsyncStorage.getItem(DISMISSED_MEDS_STORAGE_KEY);
        if (stored) {
          const dismissed = JSON.parse(stored);
          setDismissedMedicationIds(new Set(dismissed));
          console.log('[DocumentDetail] Loaded dismissed medications:', dismissed);
        }
      } catch (error) {
        console.error('[DocumentDetail] Error loading dismissed medications:', error);
      }
    };

    loadDismissedMedications();
  }, [document.id]);

  // Load lab report ID if this document is a lab report
  useEffect(() => {
    const loadLabReportId = async () => {
      try {
        const { data, error } = await supabase
          .from('lab_reports')
          .select('id')
          .eq('document_id', document.id)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') {
            // PGRST116 = no rows returned (not a lab report)
            console.error('[DocumentDetail] Error loading lab report:', error);
          }
          setLabReportId(null);
        } else if (data) {
          setLabReportId(data.id);
          console.log('[DocumentDetail] Found lab report ID:', data.id);
        }
      } catch (error) {
        console.error('[DocumentDetail] Error querying lab_reports:', error);
        setLabReportId(null);
      }
    };

    // Only query if document has AI analysis and is a lab report
    if (document.ai_analysis_result && document.ai_analysis_result.document_type?.toLowerCase() === 'lab_report') {
      loadLabReportId();
    } else {
      setLabReportId(null);
    }
  }, [document.id, document.ai_analysis_result, document.ai_analysis_result?.document_type]);



  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Handle view full document
  const handleViewFullDocument = () => {
    if (!imageUri) {
      Alert.alert('Error', 'Document file not found');
      return;
    }

    console.log('[DocumentDetail] Opening document viewer');
    console.log('[DocumentDetail] File type is PDF:', isPdf);
    console.log('[DocumentDetail] URI being passed:', imageUri);
    console.log('[DocumentDetail] URI has file:// protocol:', imageUri.startsWith('file://'));

    if (isPdf) {
      // Navigate to embedded PDF viewer
      router.navigate('/pdfviewer', {
        uri: imageUri,
        title: displayTitle
      });
      console.log('[DocumentDetail] Navigated to PdfViewer with URI:', imageUri);
    } else {
      // For images, open full-screen image viewer
      setShowFullScreenImage(true);
      console.log('[DocumentDetail] Opened full-screen image modal');
    }
  };



  // Handle share
  const handleShare = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'Document file not found');
      return;
    }
    setShowShareModal(true);
  };

  const handleShareDocument = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(imageUri!);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      Alert.alert('Error', 'Failed to share document');
    }
  };

  const { isGenerating: isGeneratingAnalysis, generateAndShare: handleShareAnalysis } = useAnalysisPDF({
    analysis: document.ai_analysis_result,
    documentType,
    imageUri,
    displayTitle
  });



  // Save dismissed medications to AsyncStorage
  const saveDismissedToStorage = async (dismissedSet: Set<string>) => {
    try {
      await AsyncStorage.setItem(
        DISMISSED_MEDS_STORAGE_KEY,
        JSON.stringify(Array.from(dismissedSet))
      );
      console.log('[DocumentDetail] Saved dismissed medications:', Array.from(dismissedSet));
    } catch (error) {
      console.error('[DocumentDetail] Error saving dismissed medications:', error);
    }
  };

  // Handle dismissing a medication from verification list
  const handleDismissMedication = (medicineIndex: number) => {
    const dismissId = `${document.id}_${medicineIndex}`;

    console.log('[DocumentDetail] Dismissing medication at index:', medicineIndex);

    setDismissedMedicationIds(prev => {
      const updated = new Set(prev);
      updated.add(dismissId);
      saveDismissedToStorage(updated);
      return updated;
    });
  };

  // Handle restoring a dismissed medication
  const handleRestoreMedication = (medicineIndex: number) => {
    const dismissId = `${document.id}_${medicineIndex}`;

    console.log('[DocumentDetail] Restoring medication at index:', medicineIndex);

    setDismissedMedicationIds(prev => {
      const updated = new Set(prev);
      updated.delete(dismissId);
      saveDismissedToStorage(updated);
      return updated;
    });
  };

  // Handle verify and add medication from AI extraction
  const handleVerifyAndAddMedication = async (parsedMed: import('../src/types/medicationVerification').ParsedMedication, startDate: string) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add medications');
      return;
    }

    try {
      // Check for duplicates in active medications
      const activeMeds = getActiveMedications();
      const duplicate = detectDuplicateMedication(
        parsedMed.name,
        parsedMed.dosage,
        activeMeds
      );

      if (duplicate) {
        // Show duplicate alert with options
        return new Promise<void>((resolve, reject) => {
          Alert.alert(
            'Duplicate Medication Detected',
            `"${parsedMed.name}" is similar to "${duplicate.name}" which is already in your tracker.\n\nWhat would you like to do? `,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => reject(new Error('User cancelled')),
              },
              {
                text: 'Replace Existing',
                onPress: async () => {
                  try {
                    await addMedicationFromAI(
                      parsedMed,
                      user.id,
                      document.id,
                      displayTitle,
                      startDate,
                      document.family_member_id!
                    );

                    // Mark old as inactive (set end_date to yesterday)
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    await useMedicationsStore.getState().updateMedication(duplicate.id, {
                      end_date: yesterday.toISOString().split('T')[0],
                    });

                    // Mark as verified
                    setVerifiedMedications(prev => new Set(prev).add(parsedMed.name));

                    resolve();
                  } catch (error) {
                    reject(error);
                  }
                },
              },
              {
                text: 'Add Both',
                onPress: async () => {
                  try {
                    await addMedicationFromAI(
                      parsedMed,
                      user.id,
                      document.id,
                      displayTitle,
                      startDate,
                      document.family_member_id!
                    );

                    // Mark as verified
                    setVerifiedMedications(prev => new Set(prev).add(parsedMed.name));

                    resolve();
                  } catch (error) {
                    reject(error);
                  }
                },
              },
            ],
            { cancelable: true }
          );
        });
      }

      // No duplicate, add directly
      await addMedicationFromAI(
        parsedMed,
        user.id,
        document.id,
        displayTitle,
        startDate,
        document.family_member_id!
      );

      // Mark as verified
      setVerifiedMedications(prev => new Set(prev).add(parsedMed.name));
    } catch (error) {
      console.error('[DocumentDetail] Error adding medication:', error);
      throw error; // Let the card component handle the error
    }
  };

  // Helper to get summary from new schema
  const getSummary = (result?: DocumentAnalysisResult): string | undefined => {
    return result?.summary ?? undefined;
  };

  // Helper to format document type
  const formatDocumentType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };

  // Toggle category expansion (accordion behavior - only one open at a time)
  const toggleCategory = (categoryName: string) => {
    if (expandedCategories.has(categoryName)) {
      // If clicking already open category, close it
      setExpandedCategories(new Set());
    } else {
      // If clicking closed category, open ONLY that one (close all others)
      setExpandedCategories(new Set([categoryName]));
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onBack}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        {/* Smart Header Title */}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {titleText}
          </Text>
          {subtitleText ? (
            <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitleText}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.headerButtonRight}
            onPress={handleShare}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="share-2" size={22} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButtonRight}
            onPress={() => setShowOptionsModal(true)}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="more-horizontal" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Document Preview Card */}
        <DocumentPreviewCard
          isPdf={!!isPdf}
          imageUri={imageUri}
          fileNotFound={fileNotFound}
          downloading={downloading}
          onViewFullScreen={handleViewFullDocument}
          onDownload={handleDownload}
        />



        {/* Detailed Medical Report Analysis - Always show for medical reports */}
        {document.ai_analysis_status === 'completed' &&
          document.ai_analysis_result?.document_type === 'medical_report' &&
          (() => {
            const reportData = document.ai_analysis_result as MedicalReportAnalysis;
            return reportData.report_data?.grouped_metrics && (
              <View style={styles.detailedReportContainer}>
                {/* Section Title */}
                <View style={styles.reportAnalysisSectionHeader}>
                  <Feather name="activity" size={22} color={Colors.primary} />
                  <Text style={styles.reportAnalysisSectionTitle}>Report Analysis</Text>
                </View>

                {/* Patient Summary Card */}
                {reportData.patient_info && (
                  <View style={styles.medicalReportPatientCard}>
                    <View style={styles.medicalReportPatientIconContainer}>
                      <MaterialCommunityIcons name="account" size={32} color={Colors.primary} />
                    </View>
                    <Text style={styles.medicalReportPatientName}>
                      {reportData.patient_info.name || 'Unknown Patient'}
                    </Text>
                    {(reportData.patient_info.age || reportData.patient_info.gender) && (
                      <View style={styles.medicalReportPatientDetailsRow}>
                        {reportData.patient_info.age && (
                          <View style={styles.medicalReportPatientDetailBadge}>
                            <Text style={styles.medicalReportPatientDetailText}>{reportData.patient_info.age}</Text>
                          </View>
                        )}
                        {reportData.patient_info.gender && (
                          <View style={styles.medicalReportPatientDetailBadge}>
                            <Text style={styles.medicalReportPatientDetailText}>{reportData.patient_info.gender}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <View style={styles.medicalReportDivider} />

                    {reportData.common_data?.visit_date && (
                      <InfoRow
                        icon="calendar"
                        label="Visit Date"
                        value={formatReportDate(reportData.common_data.visit_date)}
                      />
                    )}

                    {reportData.report_data?.report_date && (
                      <InfoRow
                        icon="clipboard"
                        label="Report Date"
                        value={formatReportDate(reportData.report_data.report_date)}
                      />
                    )}

                    {/* Lab Name - NEW (only shows if lab_name exists) */}
                    {reportData.report_data?.lab_name && (
                      <InfoRow
                        icon="activity"
                        label="Lab"
                        value={reportData.report_data.lab_name}
                      />
                    )}

                    {/* Doctor Name - NEW (only shows if doctor_name exists) */}
                    {reportData.prescription_data?.doctor_name && (
                      <InfoRow
                        icon="user"
                        label="Doctor"
                        value={reportData.prescription_data.doctor_name}
                      />
                    )}

                    {/* Hospital Name - NEW (only shows if hospital_name exists) */}
                    {reportData.prescription_data?.hospital_name && (
                      <InfoRow
                        icon="home"
                        label="Hospital"
                        value={reportData.prescription_data.hospital_name}
                      />
                    )}
                  </View>
                )}

                {/* AI Summary Card - NEW EXPANDABLE CARD */}
                {reportData.common_data?.summary && (
                  <View style={styles.aiSummaryCard}>
                    <View style={styles.aiSummaryHeader}>
                      <Feather name="file-text" size={20} color={Colors.primary} />
                      <Text style={styles.aiSummaryTitle}>AI Summary</Text>
                    </View>

                    <Text
                      style={styles.aiSummaryText}
                      numberOfLines={isSummaryExpanded ? undefined : 4}
                    >
                      {reportData.common_data.summary}
                    </Text>

                    {reportData.common_data.summary.length > 200 && (
                      <TouchableOpacity
                        onPress={() => setIsSummaryExpanded(!isSummaryExpanded)}
                        style={styles.expandButton}
                      >
                        <Text style={styles.expandButtonText}>
                          {isSummaryExpanded ? 'Show Less' : 'View Full Summary'}
                        </Text>
                        <Feather
                          name={isSummaryExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={Colors.primary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Status Summary Card */}
                {(() => {
                  const summary = calculateReportSummary(reportData);
                  return summary && (
                    <View style={styles.medicalReportStatusCard}>
                      <Text style={styles.medicalReportStatusTitle}>Test Overview</Text>

                      {/* Total Tests Count */}
                      <View style={styles.medicalReportTotalTestsRow}>
                        <Text style={styles.medicalReportTotalTestsLabel}>Total Tests:</Text>
                        <Text style={styles.medicalReportTotalTestsValue}>{summary.totalMetrics}</Text>
                      </View>

                      <View style={styles.medicalReportStatusPillsContainer}>
                        {summary.normalCount > 0 && (
                          <View style={[styles.medicalReportStatusPill, { backgroundColor: METRIC_STATUS_COLORS.normal.light }]}>
                            <View style={[styles.medicalReportStatusDot, { backgroundColor: METRIC_STATUS_COLORS.normal.primary }]} />
                            <Text style={[styles.medicalReportStatusPillText, { color: METRIC_STATUS_COLORS.normal.dark }]}>
                              {summary.normalCount} Normal
                            </Text>
                          </View>
                        )}
                        {summary.abnormalCount > 0 && (
                          <View style={[styles.medicalReportStatusPill, {
                            backgroundColor: METRIC_STATUS_COLORS.abnormal.light,
                            borderWidth: 1,
                            borderColor: METRIC_STATUS_COLORS.abnormal.primary + '40',
                          }]}>
                            <View style={[styles.medicalReportStatusDot, { backgroundColor: METRIC_STATUS_COLORS.abnormal.primary }]} />
                            <Text style={[styles.medicalReportStatusPillText, {
                              color: METRIC_STATUS_COLORS.abnormal.dark,
                              fontSize: 14,
                            }]}>
                              {summary.abnormalCount} Abnormal
                            </Text>
                          </View>
                        )}
                      </View>
                      {reportData.report_data?.lab_name && (
                        <View style={styles.medicalReportLabNameRow}>
                          <MaterialCommunityIcons name="hospital-building" size={20} color={Colors.primary} />
                          <Text style={styles.medicalReportLabNameText}>{reportData.report_data.lab_name}</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* Categories Section */}
                <View style={styles.medicalReportCategoriesContainer}>
                  {reportData.report_data.grouped_metrics.map((category) => {
                    const abnormalCount = getAbnormalCountInCategory(category);
                    const isExpanded = expandedCategories.has(category.category_name);

                    return (
                      <ExpandableSection
                        key={category.category_name}
                        title={category.category_name}
                        subtitle={`${category.metrics.length} tests`}
                        badge={
                          abnormalCount > 0 ? (
                            <View style={styles.medicalReportCategoryAbnormalBadge}>
                              <Text style={styles.medicalReportCategoryAbnormalText}>
                                {abnormalCount} abnormal
                              </Text>
                            </View>
                          ) : undefined
                        }
                        isExpanded={isExpanded}
                        onToggle={() => toggleCategory(category.category_name)}
                      >
                        {category.metrics.map((metric, index) => (
                          <MetricCard key={`${metric.test_name} -${index} `} metric={metric} />
                        ))}
                      </ExpandableSection>
                    );
                  })}
                </View>
              </View>
            );
          })()}



        {/* Consolidated AI Summary, Medications & Action Bar */}
        {(() => {
          const innerMedicines = document.ai_analysis_result?.medicines || [];
          const unverifiedMedsIdx = innerMedicines
            .map((medicine: any, index: number) => ({ medicine, index }))
            .filter(({ medicine }: any) => {
              const parsedMed = parseAIMedication(medicine, document.id, displayTitle, familyMember);
              return !verifiedMedications.has(parsedMed.name);
            });

          const hasUnverifiedMeds = unverifiedMedsIdx.length > 0;
          const summary = getSummary(document.ai_analysis_result);

          return (
            <>
              {/* AI Summary Section - Hidden if all verified */}
              {document.ai_analysis_status === 'completed' &&
                document.ai_analysis_result?.document_type !== 'medical_report' &&
                summary &&
                hasUnverifiedMeds && (
                  <PrescriptionSummary
                    summary={summary}
                    recommendedTests={document.ai_analysis_result?.advised_tests}
                    style={{ marginBottom: 0 }}
                  />
                )}

              {/* Medications Section */}
              {document.ai_analysis_status === 'completed' &&
                innerMedicines.length > 0 && (
                  <View style={[styles.medicationsCard, !hasUnverifiedMeds && { paddingTop: 16 }]}>
                    {hasUnverifiedMeds && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          paddingHorizontal: 16,
                          paddingVertical: 16,
                          borderRadius: 0,
                          marginBottom: 0,
                          backgroundColor: 'transparent',
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{
                            fontSize: 18,
                            fontWeight: '900',
                            color: Colors.gray900,
                            letterSpacing: 0.8,
                            marginBottom: 2,
                          }}>MEDS DETECTED</Text>
                          <Text style={{
                            fontSize: 12,
                            color: Colors.gray500,
                            fontWeight: '500',
                            lineHeight: 16,
                            opacity: 0.8,
                          }}>{innerMedicines.length} {innerMedicines.length === 1 ? 'medication is' : 'medications are'} identified from your prescription</Text>
                        </View>
                        <View style={{
                          backgroundColor: Colors.primary,
                          minWidth: 34,
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          borderRadius: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 2,
                          ...Platform.select({
                            ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
                            android: { elevation: 2 },
                          }),
                        }}>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.white }}>
                            {innerMedicines.length - Array.from(dismissedMedicationIds).filter(id => id.startsWith(`${document.id}_`)).length}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Verified Group */}
                    {(() => {
                      const verifiedNames = innerMedicines
                        .map((m: any) => parseAIMedication(m, document.id, displayTitle, familyMember))
                        .filter((m: any) => verifiedMedications.has(m.name))
                        .map((m: any) => m.name);

                      return verifiedNames.length > 0 ? (
                        <VerifiedMedicationsGroup
                          medicationNames={verifiedNames}
                          onViewInTracker={() => router.push('/medications')}
                        />
                      ) : null;
                    })()}

                    {/* Unverified Individual Cards */}
                    {unverifiedMedsIdx.map(({ medicine, index }: any, arrayIndex: number) => {
                      const parsedMed = parseAIMedication(medicine, document.id, displayTitle, familyMember);
                      const suggestedStartDate = (document.visit_date || document.ai_analyzed_at || new Date().toISOString()).split('T')[0];
                      const activeMeds = getActiveMedications();
                      const duplicateOf = detectDuplicateMedication(parsedMed.name, parsedMed.dosage, activeMeds);

                      return (
                        <View key={index}>
                          <MedicationVerificationCard
                            medication={parsedMed}
                            documentId={document.id}
                            documentTitle={displayTitle}
                            suggestedStartDate={suggestedStartDate}
                            onVerifyAndAdd={handleVerifyAndAddMedication}
                            duplicateOf={duplicateOf || undefined}
                            medicineIndex={index}
                            onLiveUpdate={(updates: { current_reminder_times?: string[] }) => {
                              setMedicationLiveUpdates(prev => ({
                                ...prev,
                                ...updates
                              }));
                            }}
                            onDismiss={() => handleDismissMedication(index)}
                            isDismissed={dismissedMedicationIds.has(`${document.id}_${index}`)}
                            onRestore={() => handleRestoreMedication(index)}
                            isFirstItem={arrayIndex === 0}
                            isVerified={false}
                            familyMember={familyMember}
                          />
                          {arrayIndex < unverifiedMedsIdx.length - 1 && (
                            <View style={[styles.medicationDivider, { marginHorizontal: 16 }]} />
                          )}
                        </View>
                      );
                    })}

                    {/* Verify & Add All Button */}
                    {hasUnverifiedMeds && (
                      <View style={{ padding: 16 }}>
                        <TouchableOpacity
                          style={[styles.verifyAllButton, isVerifyingAll && styles.verifyAllButtonDisabled]}
                          onPress={async () => {
                            if (!user) {
                              Alert.alert('Error', 'You must be logged in to add medications');
                              return;
                            }

                            setIsVerifyingAll(true);
                            try {
                              const medsToVerify = unverifiedMedsIdx.map(({ medicine }: any) =>
                                parseAIMedication(medicine, document.id, displayTitle, familyMember)
                              );
                              const startDate = (document.visit_date || document.ai_analyzed_at || new Date().toISOString()).split('T')[0];

                              await useMedicationsStore.getState().addMedicationsBatchFromAI(
                                medsToVerify,
                                user.id,
                                document.id,
                                displayTitle,
                                startDate,
                                document.family_member_id!
                              );

                              setVerifiedMedications(prev => {
                                const next = new Set(prev);
                                medsToVerify.forEach((m: any) => next.add(m.name));
                                return next;
                              });
                            } catch (err) {
                              console.error('[DocumentDetail] Verify All Error:', err);
                              Alert.alert('Error', 'Failed to add all medications.');
                            } finally {
                              setIsVerifyingAll(false);
                            }
                          }}
                          disabled={isVerifyingAll}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={['#3B82F6', '#60A5FA', '#93C5FD']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.verifyAllGradient}
                          >
                            {isVerifyingAll ? (
                              <ActivityIndicator color={Colors.white} size="small" />
                            ) : (
                              <>
                                <Feather name="check-circle" size={18} color={Colors.white} />
                                <Text style={styles.verifyAllButtonText}>
                                  Confirm & Add {unverifiedMedsIdx.length > 1 ? `All (${unverifiedMedsIdx.length})` : ''}
                                </Text>
                              </>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
            </>
          );
        })()}

        {/* Advised Tests Section */}
        {document.ai_analysis_status === 'completed' &&
          document.ai_analysis_result?.advised_tests &&
          document.ai_analysis_result.advised_tests.length > 0 && (
            <View style={styles.card}>
              <View style={[styles.cardHeader, { marginBottom: 4 }]}>
                <Text style={styles.cardTitle}>Advised Tests</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Recommended lab tests and investigations
              </Text>

              <View style={{ gap: 12, marginTop: 12 }}>

                <GroupedTestsCard
                  tests={document.ai_analysis_result.advised_tests}
                />
              </View>
            </View>
          )}

      </ScrollView>

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentType={documentType}
        onShareDocument={handleShareDocument}
        onShareAnalysis={handleShareAnalysis}
      />

      <LoadingOverlay visible={isGeneratingAnalysis} message="Preparing your health analysis..." />

      {/* Document Options Modal */}
      <DocumentOptionsModal
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        onDelete={confirmDelete}
      />

      {/* Full Screen Image Modal */}
      {
        imageUri && (
          <FullScreenImageModal
            visible={showFullScreenImage}
            imageUri={imageUri}
            onClose={() => setShowFullScreenImage(false)}
          />
        )
      }
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonRight: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
    textAlign: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0, // Full width cards - no horizontal padding
    paddingTop: 0, // No top padding - image starts right after header
    paddingBottom: 40,
  },

  // Hero Preview Card (2026 Style)
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 0, // No border radius for edge-to-edge design
    marginBottom: 0, // Minimal spacing - reduced from 12
    // Deep Premium Shadow
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
    width: '100%',
    marginHorizontal: 0,
    overflow: 'hidden', // Essential for hero image
  },
  heroImage: {
    width: '100%',
    height: 208, // Reduced from 260 (20% reduction for more vertical space)
    backgroundColor: Colors.gray50,
  },

  pdfIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pdfPreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  pdfPreviewSubtitle: {
    fontSize: 14,
    color: Colors.gray500,
  },
  // PDF Preview styles for react-native-pdf-jsi
  pdfPreviewWrapper: {
    width: '100%',
    height: 208, // Reduced from 260 (20% reduction)
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  pdfPreview: {
    flex: 1,
    width: '100%',
    height: 208, // Reduced from 260 (20% reduction)
    backgroundColor: Colors.white,
  },
  // New professional PDF preview card styles
  pdfPreviewCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  pdfPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pdfIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  pdfPreviewInfo: {
    flex: 1,
  },
  pdfPreviewType: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  pdfPreviewHint: {
    fontSize: 14,
    color: Colors.gray500,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.02)', // Subtle overlay
  },
  heroBadgeContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 10,
  },
  pageCountBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageCountText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '600',
  },
  zoomHintContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', // Dark blur
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewButtonContainer: {
    padding: 18,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  previewIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 40, // Super soft
    backgroundColor: '#F0F9FF', // Lightest Blue
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  previewText: {
    fontSize: 16,
    color: Colors.gray500,
    marginBottom: 24,
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    gap: 8,
    width: '100%', // Full width button
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // 2026 Floating Action Buttons - Overlay Design
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent', // Transparent container - buttons have their own backgrounds
    borderRadius: 14,
    padding: 10,
  },

  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10, // Reduced from 12 for compact look
    paddingHorizontal: 12, // Reduced from 14 for compact look
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray200,
    gap: 6, // Reduced from 8 for tighter spacing
    shadowColor: Colors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 44, // iOS minimum touch target
  },
  actionIconCircle: {
    width: 32, // Reduced from 36 for compact look
    height: 32, // Reduced from 36 for compact look
    borderRadius: 16,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },



  // Cards
  card: {
    backgroundColor: Colors.white,
    // Removed: borderRadius, shadow*, elevation
    padding: 16, // MD3: Reduced from 20
    marginBottom: 12, // Minimal spacing
    // Flat design - no shadows
  },
  medicationsCard: {
    backgroundColor: Colors.white,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12, // Improved spacing for better hierarchy
    letterSpacing: -0.5,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16, // MD3: Reduced from 20
    marginBottom: 20,
    // Flat design - removed shadow, elevation, border
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  viewMedicalReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.sm,
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  viewMedicalReportButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },

  // Details
  detailsGrid: {
    gap: Sizes.md,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Sizes.xs,
  },
  detailLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 12,
    gap: Sizes.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Sizes.sm,
  },
  tag: {
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 20,
  },
  tagBlue: {
    backgroundColor: '#EFF6FF',
  },
  tagGreen: {
    backgroundColor: '#ECFDF5',
  },
  tagPurple: {
    backgroundColor: '#F5F3FF',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tagTextBlue: {
    color: '#3B82F6',
  },
  tagTextGreen: {
    color: '#10B981',
  },
  tagTextPurple: {
    color: '#7C3AED',
  },

  // Notes
  notesInput: {
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 12,
    padding: Sizes.md,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 120,
    lineHeight: 22,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: Sizes.lg,
    gap: Sizes.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Sizes.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.gray200,
    backgroundColor: Colors.white,
    gap: Sizes.xs,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray700,
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Sizes.md,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    gap: Sizes.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },

  // Image Preview
  previewImage: {
    width: '100%',
    height: 200, // Reduced from 250 (20% reduction for more vertical space)
    borderRadius: 12,
    marginBottom: Sizes.md,
  },

  // Error State
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Sizes.sm,
  },

  // Disabled States
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonTextDisabled: {
    color: Colors.gray400,
  },

  // Analysis Card
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  statusBadgeSuccess: {
    backgroundColor: Colors.successLight,
  },
  statusBadgeProcessing: {
    backgroundColor: Colors.primaryLight + '20',
  },
  statusBadgeError: {
    backgroundColor: Colors.errorLight,
  },
  statusTextSuccess: {
    color: Colors.success,
  },
  statusTextProcessing: {
    color: Colors.primary,
  },
  statusTextError: {
    color: Colors.error,
  },
  progressContainer: {
    marginBottom: Sizes.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Sizes.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  analysisContent: {
    gap: Sizes.md,
  },
  analysisSection: {
    paddingVertical: Sizes.xs,
  },
  analysisSectionTitle: {
    fontSize: 16, // Unified section titles for symmetry
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Sizes.xs,
  },
  analysisText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  analysisGrid: {
    flexDirection: 'row',
    gap: Sizes.md,
  },
  analysisGridItem: {
    flex: 1,
  },
  analysisLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  analysisValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  criticalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    marginBottom: Sizes.xs,
  },
  criticalTitle: {
    color: Colors.error,
    marginBottom: 0,
  },
  criticalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Sizes.xs,
    paddingLeft: Sizes.sm,
    gap: Sizes.sm,
  },
  criticalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.error,
    marginTop: Sizes.sm,
  },
  criticalText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  medicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizes.xs,
    gap: Sizes.sm,
  },
  medicationText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  vitalSignsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Sizes.sm,
  },
  vitalSignItem: {
    backgroundColor: Colors.gray50,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 8,
    minWidth: '45%',
  },
  vitalSignLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  vitalSignValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  labResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Sizes.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  labResultName: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  labResultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  diagnosisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizes.xs,
    gap: Sizes.sm,
  },
  diagnosisText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: Sizes.lg,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Sizes.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.sm,
    gap: Sizes.xs,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  pendingContainer: {
    alignItems: 'center',
    paddingVertical: Sizes.xl,
  },
  pendingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Sizes.sm,
  },

  // New Analysis Display Styles - Modern Grid (MD3 8dp spacing)
  patientInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // MD3 standard: 8dp between cards
  },
  patientInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    // Removed: backgroundColor, borderWidth, borderColor, shadow*, elevation
    paddingVertical: 10, // Reduced from 12
    paddingHorizontal: 0, // Removed horizontal padding since no box
    // borderRadius irrelevant without background
    gap: 8, // MD3 standard: 8dp internal spacing
    minWidth: '45%',
    flex: 1,
  },
  patientIconBadge: {
    width: 32, // Reduced from 36
    height: 32, // Reduced from 36
    borderRadius: 8, // Smaller radius
    backgroundColor: Colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInfoLabel: {
    fontSize: 11, // MD3/iOS minimum for accessibility
    color: Colors.gray500,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  patientInfoValue: {
    fontSize: 13, // Reduced from 14 for better fit
    color: Colors.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
    lineHeight: 18, // Better readability and prevents overflow
  },
  // Legacy row support (removed but keeping placeholder if needed)
  patientInfoRow: {
    display: 'none',
  },

  // Medication Card Styles
  // Medication Card Styles
  medicationCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12, // MD3: Reduced from 16 for tighter layout
    marginBottom: 8, // MD3: 8dp between cards
    borderWidth: 1,
    borderColor: Colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  medIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicationName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  medicationScientific: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: Sizes.lg,
    marginBottom: Sizes.sm,
  },
  medicationDetails: {
    marginTop: Sizes.xs,
    gap: Sizes.xs,
  },
  medicationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicationDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingLeft: Sizes.sm,
  },

  // NEW: Drug Interaction Warning
  drugInteractionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '10',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  drugInteractionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
    fontWeight: '500',
  },

  // NEW: Strength Text
  strengthText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.gray500,
  },

  // NEW: Confidence Badge
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // NEW: Medication Subtitle Row
  medicationSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 40,
    marginBottom: 8,
  },

  // NEW: Medicine Type Badge
  medicineTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  medicineTypeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // NEW: Purpose Banner
  purposeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '08',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  purposeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },

  // NEW: Details Grid
  medicationDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  detailGridItem: {
    minWidth: 70,
    padding: 8,
    backgroundColor: Colors.gray50,
    borderRadius: 8,
  },
  detailGridLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  detailGridValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  // NEW: Time Dots Container
  timeDotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  timeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.4,
  },
  timeDotActive: {
    backgroundColor: Colors.primary + '20',
    opacity: 1,
  },
  timeDotIcon: {
    fontSize: 12,
  },

  // NEW: Duration Progress
  durationProgressContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  durationProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  durationText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  durationProgressBar: {
    height: 4,
    backgroundColor: Colors.gray100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  durationProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  // NEW: Other Information Section
  otherInfoSection: {
    marginTop: 16,
  },
  otherInfoChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  otherInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  otherInfoChipText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  otherInfoCategory: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // NEW: Follow-up Section
  followUpSection: {
    backgroundColor: Colors.info + '10',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  followUpText: {
    flex: 1,
    fontSize: 14,
    color: Colors.info,
    fontWeight: '500',
  },
  followUpNotes: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // NEW: Diagnosis Source Badge
  diagnosisSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
    gap: 4,
  },
  diagnosisSourceText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // NEW: Handwriting Badge
  handwritingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  handwritingText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '500',
  },

  testItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Sizes.sm,
    paddingVertical: Sizes.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  testContent: {
    flex: 1,
  },
  testName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  testReason: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Sizes.xs,
  },

  // Lab Results Styles
  labName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Sizes.xs,
  },
  labResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Sizes.xs,
  },
  viewLabAnalysisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.sm,
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  viewLabAnalysisButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  viewLabAnalysisButtonDisabled: {
    backgroundColor: Colors.gray400,
    opacity: 0.6,
  },
  labGroup: {
    marginTop: Sizes.sm,
  },
  labGroupName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Sizes.xs,
    paddingBottom: Sizes.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '30',
  },
  labMetricItem: {
    paddingVertical: Sizes.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  labMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labMetricName: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
  labMetricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  labMetricReference: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Sizes.xs,
  },
  metricStatusBadge: {
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 4,
    marginLeft: Sizes.sm,
  },
  metricStatusCritical: {
    backgroundColor: Colors.errorLight,
  },
  metricStatusHigh: {
    backgroundColor: '#FEF3C7',
  },
  metricStatusLow: {
    backgroundColor: '#DBEAFE',
  },
  metricStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.error,
  },

  // Confidence Meter Styles
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
    paddingTop: Sizes.md,
    marginTop: Sizes.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  confidenceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.gray100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
    minWidth: 35,
    textAlign: 'right',
  },

  // Medications Section Styles
  cardBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 12,
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  medicationsContainer: {
    gap: Sizes.md,
    paddingHorizontal: Sizes.md,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    backgroundColor: Colors.successLight,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 12,
    marginBottom: Sizes.md,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  medicationDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 0,
    marginHorizontal: 0,
  },

  // Dismissed Medication Banner Styles
  dismissedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray50,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm + 4,
    borderRadius: 12,
    marginBottom: Sizes.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  dismissedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Sizes.sm,
  },
  dismissedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissedTextContainer: {
    flex: 1,
  },
  dismissedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    marginBottom: 2,
  },
  dismissedMedicineName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gray500,
    maxWidth: '60%',
  },
  dismissedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dismissedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.success,
    textTransform: 'uppercase',
  },
  dismissedSubtext: {
    fontSize: 12,
    color: Colors.gray400,
  },
  restoreButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Error UI styles (errorContainer and errorMessage already defined above)
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Sizes.md,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Sizes.xl,
    paddingVertical: Sizes.md,
    borderRadius: 12,
    gap: Sizes.sm,
    marginTop: Sizes.md,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },

  // Detailed Medical Report Inline Styles
  detailedReportContainer: {
    marginTop: 0,
    marginBottom: Sizes.lg,
  },
  reportAnalysisSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
    paddingHorizontal: Sizes.lg,
    marginBottom: Sizes.lg,
    paddingBottom: Sizes.md,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary + '20',
  },
  reportAnalysisSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  medicalReportPatientCard: {
    marginBottom: 12,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.md,
  },
  medicalReportPatientIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  medicalReportPatientName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Sizes.sm,
    lineHeight: 26,
  },
  medicalReportPatientDetailsRow: {
    flexDirection: 'row',
    gap: Sizes.sm,
    marginBottom: Sizes.md,
  },
  medicalReportPatientDetailBadge: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 16,
  },
  medicalReportPatientDetailText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  medicalReportDivider: {
    height: 1,
    backgroundColor: Colors.gray200,
    marginVertical: Sizes.lg,
  },
  medicalReportStatusCard: {
    marginBottom: 12,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.md,
  },
  medicalReportStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Sizes.md,
  },
  medicalReportStatusPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Sizes.sm,
    marginBottom: Sizes.md,
  },
  medicalReportStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 20,
    gap: Sizes.sm,
  },
  medicalReportStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  medicalReportStatusPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  medicalReportTotalTestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Sizes.md,
    paddingVertical: Sizes.sm,
    paddingHorizontal: Sizes.md,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    gap: Sizes.sm,
  },
  medicalReportTotalTestsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  medicalReportTotalTestsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  medicalReportLabNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.sm,
    paddingTop: Sizes.sm,
  },
  medicalReportLabNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  medicalReportCategoriesContainer: {
    gap: Sizes.sm,
  },
  medicalReportCategoryAbnormalBadge: {
    backgroundColor: METRIC_STATUS_COLORS.abnormal.light,
    paddingHorizontal: Sizes.sm,
    paddingVertical: Sizes.xs,
    borderRadius: 12,
  },
  medicalReportCategoryAbnormalText: {
    fontSize: 12,
    fontWeight: '700',
    color: METRIC_STATUS_COLORS.abnormal.dark,
  },

  // AI Summary Card Styles
  aiSummaryCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 16,
    marginBottom: 0,
    padding: 16,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  aiSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  aiSummaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.gray700,
    fontWeight: '400',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Sizes.xs,
    marginTop: Sizes.md,
    alignSelf: 'flex-start',
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  verifyAllButton: {
    width: 300,
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 16,
    borderRadius: 16,
    // Shadow for iOS
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 4,
    overflow: 'hidden',
  },
  verifyAllGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  verifyAllButtonText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  verifyAllButtonDisabled: {
    opacity: 0.6,
  },
});

