import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Pressable, InteractionManager, Platform } from 'react-native';
import { Image } from 'expo-image';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../src/constants';
import { Document } from '../src/types/document';
import { useFamilyMembersStore } from '../src/store/familyMembersStore';
import { useDocumentsStore } from '../src/store/documentsStore';
import { useMedicationsStore } from '../src/store/medicationsStore';
import { useAuthStore } from '../src/store/authStore';
import { parseAIMedication, isAsNeededFrequency, parseDateOnly } from '../src/utils/medicationParser';

import { auth } from '../src/lib/apiClient';

import { useAnalysisPDF } from '../src/hooks/useAnalysisPDF';
import LoadingOverlay from '../src/components/LoadingOverlay';
import ShareModal from '../src/components/ShareModal';
import DocumentOptionsModal from '../src/components/DocumentOptionsModal';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '../src/hooks/useNotifications';
import { useDocumentActions } from '../src/hooks/useDocumentActions';
import MedicationVerificationCard from '../src/components/MedicationVerificationCard';
import { VerifiedMedicationsGroup } from '../src/components/prescription/VerifiedMedicationsGroup';

import { PrescriptionSummary } from '../src/components/prescription';
import { GroupedTestsCard } from '../src/components/prescription/GroupedTestsCard';
import { AnimatedTooltip } from '../src/components/AnimatedTooltip';

import FullScreenImageModal from '../src/components/FullScreenImageModal';
import { DuplicateMedicationModal } from '../src/components/medication/DuplicateMedicationModal';
import AddMedicationModal from '../src/components/medication/AddMedicationModal';
import { StatusBar } from 'expo-status-bar';

import { styles } from '../src/screens/PrescriptionSummaryScreen.styles';
import { IconGlow } from '../src/components/common/IconGlow';
import { DocumentPreviewCard } from '../src/components/prescription/DocumentPreviewCard';
import { useDocumentFile } from '../src/hooks/useDocumentFile';
import { useDocumentMedications } from '../src/hooks/useDocumentMedications';

interface PrescriptionSummaryScreenProps {
  onBack: () => void;
  document?: Document;
  documentId?: string;
}

export default function PrescriptionSummaryScreen({ onBack, document: documentProp, documentId }: PrescriptionSummaryScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paramDocumentId = params.documentId as string;

  const insets = useSafeAreaInsets();
  const { familyMembers } = useFamilyMembersStore();
  const { documents, analysisProgress, retryAnalysis, deleteDocument } = useDocumentsStore();


  const handleBack = onBack || (() => { router.back(); });

  // Resolve document: either passed directly or found in store by ID
  const initialDocument = useMemo(() => {
    if (documentProp) return documentProp;
    const effectiveDocumentId = documentId || paramDocumentId;
    let foundDoc = undefined;
    if (effectiveDocumentId) {
      foundDoc = documents.find(d => d.id === effectiveDocumentId);
    }
    return foundDoc;
  }, [documentProp, documentId, paramDocumentId, documents]);

  const { addMedicationFromAI, medications } = useMedicationsStore();
  const { user } = useAuthStore();
  const { scheduleAllForMedication } = useNotifications();
  const [isReady, setIsReady] = useState(false);

  // OPTIMIZATION: Defer heavy rendering until navigation transition finishes
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Initialize summary expansion state based on document type
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(() => {
    // Check if we have document available initially (optimization)
    const doc = documentProp || (documents.find(d => d.id === documentId));
    return doc?.ai_analysis_result?.document_type?.toLowerCase() === 'invalid';
  });

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [tooltipContent, setTooltipContent] = useState('');
  const [showAddMedicationModal, setShowAddMedicationModal] = useState(false);



  const handleTooltipPress = (event: any, content: string) => {
    const { pageX, pageY } = event.nativeEvent;
    setTooltipPosition({ x: pageX, y: pageY });
    setTooltipContent(content);
    setTooltipVisible(true);
  };

  // Detect document type for share modal
  const documentType = useMemo(() => {
    const type = initialDocument?.ai_analysis_result?.document_type?.toLowerCase();
    if (type === 'prescription') return 'prescription';
    return 'other';
  }, [initialDocument?.ai_analysis_result]);

  // SAFE: initialDocument is guaranteed to exist after this point
  // Get LIVE document from store (updates when AI analysis completes and updates title)
  // Falls back to initialDocument (prop/id lookup) if not found in store (e.g., during weird state)
  const document = useMemo(() => {
    if (!initialDocument) return undefined;
    return documents.find(d => d.id === initialDocument.id) || initialDocument;
  }, [initialDocument, documents]);

  // AsyncStorage key for dismissed medications (NOW SAFE)
  const DISMISSED_MEDS_STORAGE_KEY = useMemo(() => {
    return document ? `dismissed_medications_${document.id}` : '';
  }, [document?.id]);

  // Get analysis progress for this document
  const documentProgress = useMemo(() => {
    return (document && analysisProgress[document.id]) || 0;
  }, [document?.id, analysisProgress]);

  // Get family member name
  const familyMember = useMemo(() => {
    return (document && familyMembers.find(m => m.id === document.family_member_id)) || undefined;
  }, [document?.family_member_id, familyMembers]);

  // Smart Header Logic
  const analysis = document?.ai_analysis_result;

  const { headerTitleData } = useMemo(() => {
    if (!document) return { headerTitleData: { title: 'Medical Document' } };

    const isAnalyzing = document.ai_analysis_status === 'processing' || document.ai_analysis_status === 'pending';
    
    if (isAnalyzing) {
      return { 
        headerTitleData: { 
          title: "dosiq Ai", 
          subtitle: "Analyzing..." 
        } 
      };
    }

    let title = analysis?.patient?.name || (document.local_file_path?.split('/').pop() || 'Medical Document');
    let subtitle = '';

    if (analysis) {
      const condition = analysis.diagnosis?.condition;
      const date = analysis.visit_date;
      const docType = analysis.document_type ? analysis.document_type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') : '';

      if (condition && date) {
        subtitle = `${condition} • ${date}`;
      } else if (condition) {
        subtitle = condition;
      } else if (date) {
        subtitle = date;
      } else if (docType && !analysis.patient?.name) {
        // If no patient name, use Doc Type as title and filename as subtitle
        title = docType;
        subtitle = document.local_file_path?.split('/').pop() || '';
      } else {
        subtitle = docType || 'Medical Record';
      }
    }

    return { headerTitleData: { title, subtitle } };
  }, [document?.ai_analysis_status, document?.local_file_path, analysis]);

  const displayTitle = headerTitleData.title;

  const HeaderTitle = () => (
    <View style={{ gap: 2, alignItems: 'center' }}>
      <Text 
        numberOfLines={1} 
        style={{ 
          fontSize: 16, 
          fontFamily: 'PlusJakartaSans-Bold', 
          color: Colors.textPrimary 
        }}
      >
        {headerTitleData.title}
      </Text>
      {headerTitleData.subtitle ? (
        <Text 
          numberOfLines={1} 
          style={{ 
            fontSize: 12, 
            fontFamily: 'PlusJakartaSans-Medium', 
            color: Colors.textSecondary 
          }}
        >
          {headerTitleData.subtitle}
        </Text>
      ) : null}
    </View>
  );

  const HeaderLeft = () => (
    <TouchableOpacity 
      onPress={handleBack} 
      activeOpacity={0.7}
      style={{ 
        width: 36, 
        height: 36, 
        borderRadius: 18, 
        backgroundColor: Colors.white, 
        justifyContent: 'center', 
        alignItems: 'center',
        marginLeft: process.env.EXPO_OS === 'android' ? 4 : 0,
        ...Platform.select({
          ios: {
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)"
          },
          android: {
            elevation: 4,
            // Ensure no clipping for the shadow
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          }
        })
      }}
    >
      <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
    </TouchableOpacity>
  );

  const HeaderIcon = ({ iosName, androidName, onPress, color }: { iosName: string, androidName: any, onPress: () => void, color: string }) => (
    <TouchableOpacity onPress={onPress} hitSlop={10} activeOpacity={0.7}>
      {process.env.EXPO_OS === 'ios' ? (
        <Image 
          source={`sf:${iosName}`} 
          style={{ width: 22, height: 22 }} 
          tintColor={color} 
        />
      ) : (
        <Feather name={androidName} size={22} color={color} />
      )}
    </TouchableOpacity>
  );

  const {
    imageUri,
    fileNotFound,
    downloading,
    isPdf,
    showFullScreenImage,
    setShowFullScreenImage,
    handleViewFullDocument,
    handleDownload,
  } = useDocumentFile(document, displayTitle);

  const {
    showShareModal,
    setShowShareModal,
    showOptionsModal,
    setShowOptionsModal,
    isDeleting,
    confirmDelete,
    handleShare,
    handleShareDocument,
  } = useDocumentActions(document, imageUri, handleBack);

  const {
    verifiedMedications,
    setVerifiedMedications,
    dismissedMedicationIds,
    medicationLiveUpdates,
    setMedicationLiveUpdates,
    duplicateModalVisible,
    setDuplicateModalVisible,
    pendingDuplicateData,
    isAlreadyAdded,
    innerMedicines,
    allUnverifiedMedsIdx,
    activeMedsForBatch,
    duplicateMedicationsMap,
    hasUnverifiedMeds,
    aiMedicinesCount,
    onLiveUpdate,
    handleDismissMedication,
    handleRestoreMedication,
    handleResolveDuplicate,
    handleCancelDuplicate,
    handleVerifyAndAddMedication,
    handleAddManualMedication,
  } = useDocumentMedications(document, initialDocument, displayTitle, familyMember);




  // Removed redundant loadDismissedMedications useEffect as it is handled in useDocumentMedications.



  const { isGenerating: isGeneratingAnalysis, generateAndShare: handleShareAnalysis } = useAnalysisPDF({
    analysis: document?.ai_analysis_result,
    documentType,
    imageUri,
    displayTitle
  });

  if (!initialDocument || !document) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {isAlreadyAdded && (
          <View style={styles.verifiedHeaderBanner}>
            <Image source="sf:checkmark.circle.fill" style={{ width: 16, height: 16 }} tintColor={Colors.white} />
            <Text style={styles.verifiedHeaderText}>
              Prescription Verified & Added to Tracker
            </Text>
          </View>
        )}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Image source="sf:arrow.left" style={{ width: 24, height: 24 }} tintColor={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document Error</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Image source="sf:exclamationmark.circle.fill" style={{ width: 48, height: 48 }} tintColor={Colors.error} />
          <Text style={styles.errorTitle}>Document Not Found</Text>
          <Text style={styles.errorMessage}>
            The document you're trying to view could not be loaded. Please go back and try again.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={handleBack} activeOpacity={0.8}>
            <Image source="sf:arrow.left" style={{ width: 20, height: 20 }} tintColor={Colors.white} />
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  // Handlers deleted, moved to useDocumentActions
  // Utility functions moved to prescriptionHelpers

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
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#EFF6FF', '#F1F5F9', '#F1F5F9']}
        style={StyleSheet.absoluteFill}
      />
      {/* Native Stack header — title & actions injected here, back button provided by navigator */}
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitle />,
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderLeft />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <HeaderIcon 
                iosName="square.and.arrow.up" 
                androidName="share-2" 
                onPress={handleShare} 
                color={Colors.primary} 
              />
              <HeaderIcon 
                iosName="ellipsis" 
                androidName="more-vertical" 
                onPress={() => setShowOptionsModal(true)} 
                color={Colors.textPrimary} 
              />
            </View>
          ),
          headerBackground: () => process.env.EXPO_OS === 'android' ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.85)' }]} />
          ) : undefined
        }}
      />

      {/* Scrollable Content — contentInsetAdjustmentBehavior handles safe area under native header */}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingBottom: 70,
            paddingTop: process.env.EXPO_OS === 'android' ? insets.top + (process.env.EXPO_OS === 'android' ? 64 : 0) : 12 
          }
        ]}
        showsVerticalScrollIndicator={false}
      >

          {!isReady ? (
            <View style={{ padding: 20, paddingTop: 40, alignItems: 'center', gap: 16 }}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ color: Colors.gray500, fontSize: 13, fontFamily: 'PlusJakartaSans-Medium' }}>Loading analysis...</Text>
            </View>
          ) : (
            <>
              {/* Document Preview Card */}
              <DocumentPreviewCard
                fileNotFound={fileNotFound}
                isPdf={!!isPdf}
                imageUri={imageUri}
                handleViewFullDocument={handleViewFullDocument}
                handleDownload={handleDownload}
                downloading={downloading}
              />

              {/* Consolidated AI Summary, Medications & Action Bar */}
              {(() => {
                const summary = document?.ai_analysis_result?.summary;

                // Safely format additional_notes to handle arrays AND object key-value pairs
                const rawNotes = document?.ai_analysis_result?.additional_notes;
                let normalizedNotes: any[] | undefined = undefined;

                if (Array.isArray(rawNotes)) {
                  // Handle Array structure: [{"text": "...", "type": "..."}] or [{"key": "...", "value": "..."}]
                  normalizedNotes = rawNotes.map((note: any) => {
                    if (typeof note === 'string') return { value: note, category: 'Note' };
                    return {
                      value: note.text || note.value || '',
                      category: note.type || note.category || note.key || 'Note'
                    };
                  }).filter(n => n.value !== '');
                } else if (rawNotes && typeof rawNotes === 'object') {
                  // Handle direct Object structure: {"Vitals": "120/80", "Warning": "Avoid alcohol..."}
                  normalizedNotes = Object.entries(rawNotes).map(([key, val]) => ({
                    category: key,
                    value: String(val)
                  })).filter(n => n.value !== '');
                }

                return (
                  <Animated.View layout={LinearTransition.duration(300)} style={{ gap: 12 }}>
                    {/* Verification Prompt — subtle inline note for handwritten prescriptions */}
                    {document?.ai_analysis_result?.metadata?.handwriting_detected && (
                      <View style={styles.verificationPrompt}>
                        <Text style={styles.verificationPromptText}>
                          Handwritten prescription — AI accuracy may vary. Please review the details below.
                        </Text>
                      </View>
                    )}

                    {/* AI Summary Section - Show greyed-out when already added, hidden only during session verification */}
                    {document?.ai_analysis_status === 'completed' &&
                      summary &&
                      (hasUnverifiedMeds || (isAlreadyAdded && verifiedMedications.size === 0)) && (
                        <PrescriptionSummary
                          summary={summary}
                          recommendedTests={document?.ai_analysis_result?.advised_tests}
                          otherInformation={normalizedNotes && normalizedNotes.length > 0 ? normalizedNotes : undefined}
                          followUp={document?.ai_analysis_result?.follow_up_days ? { follow_up_days: document.ai_analysis_result.follow_up_days } : undefined}
                          defaultExpanded={document?.ai_analysis_result?.document_type?.toLowerCase() === 'invalid'}
                        />
                      )}

                    {/* Medications Section */}
                    {document?.ai_analysis_status === 'completed' &&
                      innerMedicines.length > 0 && (
                        <Animated.View
                          layout={LinearTransition.duration(250)}
                          style={{ gap: 12 }}
                        >
                          {/* MEDS DETECTED Header - Styled like AI Summary (standalone collapsible card) */}
                          {(hasUnverifiedMeds || (isAlreadyAdded && verifiedMedications.size === 0)) && (() => {
                            const count = aiMedicinesCount;
                            if (count === 0) return null;
                            return (
                              <View style={styles.medicationsHeaderCard}>
                                <IconGlow />
                                <View style={styles.medicationsHeaderRow}>
                                  <View style={styles.medicationsHeaderLeft}>
                                    <Text style={styles.medicationsCountText}>{count}</Text>
                                    <View style={{ gap: 2, flex: 1, justifyContent: 'center' }}>
                                      <Text style={styles.medicationsHeaderTitle}>MEDICATIONS DETECTED</Text>
                                      <Text style={styles.medicationsHeaderSubtitle}>
                                        dosiq Ai found {count}{' '}
                                        {count === 1 ? 'medication' : 'medications'} in your prescription. Verify details and schedule reminders below.
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              </View>
                            );
                          })()}
                          {/* Verified Group - ONLY show when meds were verified in current session (not when just reopening) */}
                          {verifiedMedications.size > 0 && (() => {
                            const verifiedNames = innerMedicines
                              .map((m: any) => parseAIMedication(m, document!.id, displayTitle, familyMember))
                              .filter((m: any) => verifiedMedications.has(m.name))
                              .map((m: any) => m.name);

                            return verifiedNames.length > 0 ? (
                              <VerifiedMedicationsGroup
                                medicationNames={verifiedNames}
                                onViewInTracker={() => router.push('/medications')}
                              />
                            ) : null;
                          })()}

                          {/* Divider Line - Only show if we have verified items above in CURRENT session */}


                          {/* Unverified/All Medications List - Each card is a standalone main card */}
                          {((!isAlreadyAdded && allUnverifiedMedsIdx.length > 0) || (isAlreadyAdded && verifiedMedications.size === 0)) && (
                            <View style={{ gap: 12 }}>
                              {(() => {
                                const allMeds = isAlreadyAdded ? innerMedicines.map((medicine: any, index: number) => ({ medicine, index })) : allUnverifiedMedsIdx;
                                const aiMeds = allMeds.filter((m: any) => m.index < aiMedicinesCount);
                                const manualMeds = allMeds.filter((m: any) => m.index >= aiMedicinesCount);

                                const renderMed = ({ medicine, index }: any, arrayIndex: number) => {
                                  const parsedMed = parseAIMedication(medicine, document!.id, displayTitle, familyMember);
                                  const suggestedStartDate = parseDateOnly(new Date().toISOString());
                                  // Pass full medications list for history check (parser handles filtering)
                                  const duplicateOf = duplicateMedicationsMap.get(index);

                                  return (
                                    <MedicationVerificationCard
                                      key={index}
                                      medication={parsedMed}
                                      documentId={document!.id}
                                      documentTitle={displayTitle}
                                      suggestedStartDate={suggestedStartDate}
                                      onVerifyAndAdd={handleVerifyAndAddMedication}
                                      duplicateOf={duplicateOf || undefined}
                                      medicineIndex={index}
                                      confidenceScore={document.ai_analysis_result?.metadata?.confidence_score}
                                      onLiveUpdate={(updates: {
                                        current_reminder_times?: string[];
                                        start_date?: string;
                                        end_date?: string;
                                        duration_days?: number;
                                      }) => {
                                        setMedicationLiveUpdates(prev => ({
                                          ...prev,
                                          [index]: { ...prev[index], ...updates }
                                        }));
                                      }}
                                      onDismiss={() => handleDismissMedication(index)}
                                      isDismissed={dismissedMedicationIds.has(`${document.id}_${index}`)}
                                      onRestore={() => handleRestoreMedication(index)}
                                      isFirstItem={arrayIndex === 0}
                                      cardIndex={arrayIndex + 1}
                                      isVerified={isAlreadyAdded}
                                      familyMember={familyMember}
                                      followUpDays={document?.ai_analysis_result?.follow_up_days ?? undefined}
                                    />
                                  );
                                };

                                return (
                                  <>
                                    {aiMeds.map(renderMed)}

                                    {manualMeds.length > 0 && (
                                      <>
                                        {/* MANUALLY ADDED Header */}
                                        <View style={styles.medicationsHeaderCard}>
                                          <View style={styles.medicationsHeaderRow}>
                                            <View style={styles.medicationsHeaderLeft}>
                                              <Text style={[styles.medicationsCountText, { color: Colors.primary }]}>{manualMeds.length}</Text>
                                              <View style={{ gap: 2, flex: 1, justifyContent: 'center' }}>
                                                <Text style={styles.medicationsHeaderTitle}>MANUALLY ADDED</Text>
                                                <Text style={styles.medicationsHeaderSubtitle}>
                                                  You have added {manualMeds.length}{' '}
                                                  {manualMeds.length === 1 ? 'medication' : 'medications'} manually.
                                                </Text>
                                              </View>
                                            </View>
                                          </View>
                                        </View>
                                        {manualMeds.map((item: any, idx: number) => renderMed(item, idx))}
                                      </>
                                    )}
                                  </>
                                );
                              })()}

                              {/* Add Medication Manually Button - Always Visible */}
                              <View style={styles.addManuallyButtonContainer}>
                                <TouchableOpacity
                                  style={styles.addManuallyButton}
                                  onPress={() => setShowAddMedicationModal(true)}
                                  activeOpacity={0.7}
                                >
                                  <Image source="sf:plus" style={{ width: 16, height: 16 }} tintColor={Colors.textSecondary} />
                                  <Text style={styles.addManuallyButtonText}>Add missing medication</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}

                          {/* Action Button - "Confirm & Add" when not added, "View in Tracker" when already added */}
                          {(hasUnverifiedMeds || (isAlreadyAdded && verifiedMedications.size === 0)) && (
                            <View>
                              <TouchableOpacity
                                style={[styles.verifyAllButton, isVerifyingAll && styles.verifyAllButtonDisabled]}
                                onPress={async () => {
                                  // If already added, just navigate to tracker
                                  if (isAlreadyAdded) {
                                    router.push('/medications');
                                    return;
                                  }

                                  setIsVerifyingAll(true);
                                  try {
                                    const currentUser = (await auth.getUser()).data.user;
                                    if (!currentUser || !document) return;

                                    const suggestedStartDate = parseDateOnly(new Date().toISOString());
                                    const medsToVerify = activeMedsForBatch.map(({ medicine, index }: { medicine: any, index: number }) => {
                                      const parsedMed = parseAIMedication(medicine, document.id, displayTitle, familyMember);
                                      // Merge user edits from live updates
                                      const liveUpdates = medicationLiveUpdates[index];
                                      if (liveUpdates) {
                                        if (liveUpdates.current_reminder_times) {
                                          parsedMed.time_of_day = liveUpdates.current_reminder_times;
                                        }
                                        parsedMed.start_date = liveUpdates.start_date || suggestedStartDate;
                                        if (liveUpdates.duration_days !== undefined) {
                                          parsedMed.duration_days = liveUpdates.duration_days;
                                        }
                                      } else {
                                        // No live updates, apply matching defaults from UI card (Simple Sync)
                                        parsedMed.start_date = suggestedStartDate;
                                        if (parsedMed.duration_days === null || parsedMed.duration_days === undefined) {
                                          const isAsNeeded = isAsNeededFrequency(parsedMed.timing_dosage || parsedMed.dosage, parsedMed.total_times_per_day);
                                          if (!isAsNeeded) {
                                            parsedMed.duration_days = 5; // Matching UI's 5-day default
                                          }
                                        }
                                      }
                                      return parsedMed;
                                    });

                                    await useMedicationsStore.getState().addMedicationsBatchFromAI(
                                      medsToVerify,
                                      currentUser.id,
                                      document?.id,
                                      displayTitle,
                                      suggestedStartDate,
                                      document?.family_member_id!
                                    );

                                    // Schedule reminders for all batch-added meds
                                    const updatedMeds = useMedicationsStore.getState().medications;
                                    const batchMeds = updatedMeds.filter(m => m.source_document_id === document?.id);

                                    for (const med of batchMeds) {
                                      await scheduleAllForMedication(med);
                                    }

                                    setVerifiedMedications(prev => {
                                      const next = new Set(prev);
                                      medsToVerify.forEach((m: any) => next.add(m.name));
                                      return next;
                                    });
                                  } catch (err) {
                                    console.error('[PrescriptionSummary] Verify All Error:', err);
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
                                    <Fragment>
                                      <Image
                                        source={isAlreadyAdded ? 'sf:eye' : 'sf:checkmark.circle'}
                                        style={{ width: 18, height: 18 }}
                                        tintColor={Colors.white}
                                      />
                                      <Text style={styles.verifyAllButtonText}>
                                        {isAlreadyAdded
                                          ? "View in Tracker"
                                          : `Confirm & Add ${activeMedsForBatch.length > 1 ? `All (${activeMedsForBatch.length})` : ''}`
                                        }
                                      </Text>
                                    </Fragment>
                                  )}
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          )}
                        </Animated.View>
                      )}
                  </Animated.View>
                );
              })()}

              {/* Advised Tests Section */}
              {document?.ai_analysis_status === 'completed' &&
                document?.ai_analysis_result?.advised_tests &&
                document?.ai_analysis_result?.advised_tests.length > 0 && (
                  <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: Colors.primary + '40' }]}>
                    <View style={[styles.cardHeader, { marginBottom: 4 }]}>
                      <Text style={styles.cardTitle}>Advised Tests</Text>
                    </View>
                    <Text style={[styles.cardSubtitle, { marginBottom: 0 }]}>
                      Recommended lab tests and investigations
                    </Text>

                    <View style={{ gap: 12, marginTop: 14 }}>

                      <GroupedTestsCard
                        tests={document?.ai_analysis_result?.advised_tests || []}
                      />
                    </View>
                  </View>
                )}
            </>
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
      {imageUri && (
        <FullScreenImageModal
          visible={showFullScreenImage}
          imageUri={imageUri}
          onClose={() => setShowFullScreenImage(false)}
        />
      )}

      {/* Floating Tooltip specifically for dismissed medications */}
      <AnimatedTooltip
        visible={tooltipVisible}
        content={tooltipContent}
        targetPosition={tooltipPosition}
        onClose={() => setTooltipVisible(false)}
      />

      {/* Duplicate Medication Modal */}
      <DuplicateMedicationModal
        visible={duplicateModalVisible}
        onClose={handleCancelDuplicate}
        newMedication={pendingDuplicateData?.newMed || null}
        existingMedication={pendingDuplicateData?.existingMed || null}
        onReplace={() => handleResolveDuplicate('replace')}
        onAddBoth={() => handleResolveDuplicate('add')}
      />

      {/* Add Medication Modal */}
      <AddMedicationModal
        visible={showAddMedicationModal}
        onClose={() => setShowAddMedicationModal(false)}
        onAdd={handleAddManualMedication}
      />
    </View>
  );
}



