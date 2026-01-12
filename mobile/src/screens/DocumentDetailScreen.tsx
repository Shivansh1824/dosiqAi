import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image, Alert, ActivityIndicator, FlatList, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Sizes, Typography } from '../constants';
import { Document, DocumentAnalysisResult } from '../types/document';
import { fileExists, getAbsolutePath, deleteLocalFile } from '../utils/fileStorage';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { useDocumentsStore } from '../store/documentsStore';
import { RootStackParamList } from '../../App';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import Pdf from 'react-native-pdf-jsi';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import FullScreenImageModal from '../components/FullScreenImageModal';
import MedicationVerificationCard from '../components/MedicationVerificationCard';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAuthStore } from '../store/authStore';
import { parseAIMedication, detectDuplicateMedication } from '../utils/medicationParser';
import { supabase } from '../services/supabaseClient';
import {
  MedicalReportAnalysis,
  calculateReportSummary,
  formatReportDate,
  getAbnormalCountInCategory,
  METRIC_STATUS_COLORS,
} from '../types/medicalReport';
import { InfoRow, MetricCard, ExpandableSection } from '../components/medicalReport';
import { generateAndSharePDF, generateAnalysisPDF, sharePDF, PDFGenerationResult } from '../services/pdfGenerationService';
import ShareModal from '../components/ShareModal';
import AnalysisLoading from '../components/AnalysisLoading';
import DocumentOptionsModal from '../components/DocumentOptionsModal';
import { PrescriptionSummary, MedicationsSection, DocumentPreview } from '../components/prescription';
import { GroupedTestsCard } from '../components/prescription/GroupedTestsCard';

type DocumentDetailNavigationProp = StackNavigationProp<RootStackParamList, 'Document'>;

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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  // Instant Share: Store pre-generated PDF path
  const [preGeneratedPdfPath, setPreGeneratedPdfPath] = useState<string | null>(null);
  const generationPromise = React.useRef<Promise<string | undefined> | null>(null);
  const [verifiedMedications, setVerifiedMedications] = useState<Set<string>>(new Set());
  const [dismissedMedicationIds, setDismissedMedicationIds] = useState<Set<string>>(new Set());
  // Live updates for medication reminders (index -> updates)
  const [medicationLiveUpdates, setMedicationLiveUpdates] = useState<Record<number, { current_reminder_times?: string[] }>>({});
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [loading, setLoading] = useState(false);
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
  const DISMISSED_MEDS_STORAGE_KEY = `dismissed_medications_${document.id}`;

  // Get analysis progress for this document
  const documentProgress = analysisProgress[document.id] || 0;

  // Get family member name
  const familyMember = familyMembers.find(m => m.id === document.family_member_id);


  // Get display title - prefer AI-generated filename from analysis result, fallback to document title
  // Smart Header Logic
  const analysis = document.ai_analysis_result;

  const { titleText, subtitleText } = useMemo(() => {
    let title = document.title;
    let subtitle = '';

    if (analysis) {
      // 1. Construct Smart Title
      if (analysis.document_type === 'prescription' && analysis.prescription_data?.medical_issue_diagnosis) {
        title = `${analysis.prescription_data.medical_issue_diagnosis} Prescription`;
      } else if (analysis.document_type) {
        // Capitalize (e.g., "lab_report" -> "Lab Report")
        title = analysis.document_type
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      } else if (analysis.file_name) {
        // Fallback to filename if no specific type data
        title = analysis.file_name;
      }

      // 2. Construct Subtitle (Patient • Date)
      const parts = [];
      if (analysis.patient_info?.name) parts.push(analysis.patient_info.name);

      if (analysis.common_data?.visit_date) {
        // Format date if possible (YYYY-MM-DD -> DD MMM YYYY) roughly, or just use raw
        // For 10/10, let's keep it clean. 
        parts.push(analysis.common_data.visit_date);
      }
      subtitle = parts.join(' • ');
    }

    return { titleText: title, subtitleText: subtitle };
  }, [document.title, analysis]);

  // Keep displayTitle for shared PDF viewer
  const displayTitle = titleText;

  // Check if file exists locally; if not, sync from R2
  useEffect(() => {
    const checkAndSyncFile = async () => {
      if (document.local_file_path) {
        try {
          console.log('[DocumentDetail] Original relative path:', document.local_file_path);

          // Convert relative path to absolute path at runtime
          const absolutePath = getAbsolutePath(document.local_file_path);

          console.log('[DocumentDetail] Converted to absolute path:', absolutePath);
          console.log('[DocumentDetail] Path has file:// protocol:', absolutePath.startsWith('file://'));

          // First check if file exists locally
          const exists = await fileExists(absolutePath);

          if (exists) {
            setImageUri(absolutePath);
            setFileNotFound(false);
            console.log('[DocumentDetail] File found and URI set successfully');
          } else {
            // File not found locally - try to sync from R2
            console.log('[DocumentDetail] File not found locally, attempting R2 sync...');

            if (document.cloud_file_key) {
              try {
                setDownloading(true);
                console.log('[DocumentDetail] Cloud file key available:', document.cloud_file_key);

                // Import and use the file sync utility
                const { getFileWithSync, extractFilename } = await import('../utils/fileSync');
                const filename = extractFilename(document.local_file_path);

                console.log('[DocumentDetail] Starting file sync for:', filename);
                const { localPath, wasDownloaded } = await getFileWithSync(filename, document.cloud_file_key);

                if (wasDownloaded) {
                  console.log('[DocumentDetail] ✅ File downloaded from R2:', localPath);
                } else {
                  console.log('[DocumentDetail] File was already available locally:', localPath);
                }

                setImageUri(localPath);
                setFileNotFound(false);
                setDownloading(false);
              } catch (syncError) {
                console.error('[DocumentDetail] R2 sync failed:', syncError);
                setFileNotFound(true);
                setDownloading(false);
              }
            } else {
              // No cloud key available
              setFileNotFound(true);
              console.error('[DocumentDetail] File not found at path and no cloud_file_key available:', absolutePath);
            }
          }
        } catch (error) {
          setFileNotFound(true);
          console.error('[DocumentDetail] Error checking file:', error);
          console.error('[DocumentDetail] Error details:', JSON.stringify(error, null, 2));
        }
      } else {
        setFileNotFound(true);
        console.warn('[DocumentDetail] No local_file_path provided for document:', document.id);
      }
    };

    checkAndSyncFile();
  }, [document.local_file_path, document.cloud_file_key]);


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

  // Determine if file is PDF
  const isPdf = document.local_file_path?.toLowerCase().endsWith('.pdf');

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
      navigation.navigate('PdfViewer', {
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

  // Handle delete document
  const confirmDelete = () => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
  };

  const performDelete = async () => {
    try {
      setLoading(true);

      // 1. Delete from Supabase
      await deleteDocument(document.id);

      // 2. Delete from local storage
      if (document.local_file_path) {
        try {
          const absolutePath = getAbsolutePath(document.local_file_path);
          await deleteLocalFile(absolutePath);
          console.log('[DocumentDetail] Deleted local file:', absolutePath);
        } catch (e) {
          console.warn('[DocumentDetail] Failed to delete local file:', e);
        }
      }

      // 3. Navigate back
      onBack();
    } catch (error) {
      console.error('Error deleting document:', error);
      Alert.alert('Error', 'Failed to delete document');
    } finally {
      setLoading(false);
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

  /* 
   * Pre-generate PDF for Instant Sharing
   */
  const preparePdfInBackground = useCallback(async () => {
    if (!document?.ai_analysis_result) return;

    // meaningful key to prevent re-generation if doc hasn't changed
    // simple check: if we already have a path or promise, skip.
    if (preGeneratedPdfPath || generationPromise.current) return;

    const task = async (): Promise<string | undefined> => {
      try {
        console.log('[InstantShare] Starting background generation...');
        let documentImageBase64: string | undefined = undefined;

        // Convert document image to base64 for preview if available
        if (imageUri) {
          try {
            if (imageUri.startsWith('file://')) {
              documentImageBase64 = await FileSystem.readAsStringAsync(imageUri, {
                encoding: 'base64'
              });
            }
          } catch (e) {
            console.log('[InstantShare] Failed to load image for preview:', e);
          }
        }

        const patientName = document.ai_analysis_result?.patient_info?.name || 'Patient';

        const result = await generateAnalysisPDF(
          document.ai_analysis_result!,
          documentType,
          patientName,
          undefined,
          documentImageBase64
        );

        if (result.success && result.localPath) {
          console.log('[InstantShare] PDF Ready:', result.localPath);
          setPreGeneratedPdfPath(result.localPath || null);
          return result.localPath;
        }
      } catch (e) {
        console.error('[InstantShare] Background generation failed:', e);
      }
      return undefined;
    };

    generationPromise.current = task();
    await generationPromise.current;
  }, [document, imageUri, preGeneratedPdfPath, documentType]);

  // Trigger background generation when dependencies are ready
  useEffect(() => {
    if (document?.ai_analysis_result && imageUri !== undefined) {
      preparePdfInBackground();
    }
  }, [document, imageUri, preparePdfInBackground]);

  /* 
   * Handle Share Analysis - Instant or Wait
   */
  const handleShareAnalysis = async () => {
    if (!document?.ai_analysis_result) {
      Alert.alert('Error', 'No analysis available to share');
      return;
    }

    try {
      let pdfPath = preGeneratedPdfPath;

      // If not ready yet, wait for the background task
      if (!pdfPath && generationPromise.current) {
        // Show a non-intrusive indicator via state if needed, or just await
        // User requested "fast", so we just block the async flow briefly
        console.log('[InstantShare] PDF not fully ready, waiting for background task...');
        pdfPath = (await generationPromise.current) || null;
      }

      // If still not ready (failed or didn't start), try one last specific generation (fallback)
      if (!pdfPath) {
        console.log('[InstantShare] Fallback generation triggered');
        await preparePdfInBackground();
        pdfPath = (await generationPromise.current) || null;
      }

      if (pdfPath) {
        await sharePDF(pdfPath);
      } else {
        Alert.alert('Error', 'Could not generate PDF');
      }

    } catch (error) {
      console.error('Error sharing analysis:', error);
      Alert.alert('Error', 'Failed to share analysis');
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'Document file not found');
      return;
    }

    try {
      setDownloading(true);

      // For PDFs, use sharing since media library doesn't support PDFs
      if (isPdf) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(imageUri, {
            UTI: 'com.adobe.pdf',
            mimeType: 'application/pdf',
            dialogTitle: 'Save PDF Document'
          });
          setDownloading(false);
        } else {
          setDownloading(false);
          Alert.alert('Error', 'Sharing is not available on this device');
        }
        return;
      }

      // For images, use media library
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to save images to your photo library.'
        );
        setDownloading(false);
        return;
      }

      // Create a File object from the URI to verify it exists
      const file = new File(imageUri);
      // Synchronous check in new API, or await check if needed? fileStorage uses .exists property.
      if (!file.exists) {
        Alert.alert('Error', 'File not found on device');
        setDownloading(false);
        return;
      }

      // Save image to media library (Photos)
      const asset = await MediaLibrary.createAssetAsync(imageUri);

      // Optionally create an album for better organization
      const albumName = 'FamilyCareHealth';
      const album = await MediaLibrary.getAlbumAsync(albumName);

      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }

      setDownloading(false);

      Alert.alert(
        'Download Complete',
        `Image saved to Photos in ${albumName} album`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error downloading:', error);
      setDownloading(false);
      Alert.alert('Error', 'Failed to download document. Please try again.');
    }
  };

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

  // Handle verify and add medication from AI extraction
  const handleVerifyAndAddMedication = async (parsedMed: import('../types/medicationVerification').ParsedMedication, startDate: string) => {
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
            `"${parsedMed.name}" is similar to "${duplicate.name}" which is already in your tracker.\n\nWhat would you like to do?`,
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
                      startDate
                    );

                    // Mark old as inactive
                    await useMedicationsStore.getState().updateMedication(duplicate.id, {
                      is_active: false,
                    });

                    // Mark as verified
                    setVerifiedMedications(prev => new Set(prev).add(parsedMed.name));

                    Alert.alert('Success', 'Medication updated in tracker!');
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
                      startDate
                    );

                    // Mark as verified
                    setVerifiedMedications(prev => new Set(prev).add(parsedMed.name));

                    Alert.alert('Success', 'Medication added to tracker!');
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
        startDate
      );

      // Mark as verified
      setVerifiedMedications(prev => new Set(prev).add(parsedMed.name));

      Alert.alert('Success', 'Medication added to tracker!', [
        {
          text: 'View in Tracker',
          onPress: () => navigation.navigate('Medications'),
        },
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('[DocumentDetail] Error adding medication:', error);
      throw error; // Let the card component handle the error
    }
  };

  // Helper to get summary from new or legacy structure
  const getSummary = (result: DocumentAnalysisResult): string | undefined => {
    return result.common_data?.summary || result.summary;
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

  // Component for displaying analysis results
  const AnalysisResultsDisplay = ({ result }: { result: DocumentAnalysisResult }) => {
    const summary = getSummary(result);
    const patientInfo = result.patient_info;
    const commonData = result.common_data;
    const prescriptionData = result.prescription_data;
    const reportData = result.report_data;
    const analysisMetadata = result.analysis_metadata;

    return (
      <View style={styles.analysisContent}>
        {/* Summary - Primary display */}
        {summary && (
          <PrescriptionSummary
            summary={summary}
            otherInformation={prescriptionData?.other_information}
            recommendedTests={prescriptionData?.recommended_tests}
          />
        )}

        {/* Document Type & Visit Date */}
        {(result.document_type || commonData?.visit_date) && (
          <View style={styles.analysisGrid}>
            {result.document_type && (
              <View style={styles.analysisGridItem}>
                <Text style={styles.analysisLabel}>Type</Text>
                <Text style={styles.analysisValue}>{formatDocumentType(result.document_type)}</Text>
              </View>
            )}
            {commonData?.visit_date && (
              <View style={styles.analysisGridItem}>
                <Text style={styles.analysisLabel}>Visit Date</Text>
                <Text style={styles.analysisValue}>{commonData.visit_date}</Text>
              </View>
            )}
          </View>
        )}

        {/* Patient Info */}
        {patientInfo && (patientInfo.name || patientInfo.age || patientInfo.gender) && (
          <View style={styles.analysisSection}>
            <Text style={styles.analysisSectionTitle}>Patient Information</Text>
            <View style={styles.patientInfoContainer}>
              {patientInfo.name && (
                <View style={styles.patientInfoChip}>
                  <View style={styles.patientIconBadge}>
                    <Feather name="user" size={14} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.patientInfoLabel}>PATIENT</Text>
                    <Text style={styles.patientInfoValue}>{patientInfo.name}</Text>
                  </View>
                </View>
              )}
              {patientInfo.age && (
                <View style={styles.patientInfoChip}>
                  <View style={styles.patientIconBadge}>
                    <Feather name="calendar" size={14} color={Colors.secondary} />
                  </View>
                  <View>
                    <Text style={styles.patientInfoLabel}>AGE</Text>
                    <Text style={styles.patientInfoValue}>{patientInfo.age}</Text>
                  </View>
                </View>
              )}
              {patientInfo.gender && (
                <View style={styles.patientInfoChip}>
                  <View style={styles.patientIconBadge}>
                    <Feather name="users" size={14} color={Colors.info} />
                  </View>
                  <View>
                    <Text style={styles.patientInfoLabel}>GENDER</Text>
                    <Text style={styles.patientInfoValue}>{patientInfo.gender}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Doctor & Hospital Info */}
        {prescriptionData && (prescriptionData.doctor_name || prescriptionData.hospital_name) && (
          <View style={styles.analysisSection}>
            <Text style={styles.analysisSectionTitle}>Healthcare Provider</Text>
            <View style={styles.patientInfoContainer}>
              {prescriptionData.doctor_name && (
                <View style={styles.patientInfoChip}>
                  <View style={styles.patientIconBadge}>
                    <Feather name="user-plus" size={14} color={Colors.success} />
                  </View>
                  <View>
                    <Text style={styles.patientInfoLabel}>DOCTOR</Text>
                    <Text style={styles.patientInfoValue}>{prescriptionData.doctor_name}</Text>
                  </View>
                </View>
              )}
              {prescriptionData.hospital_name && (
                <View style={styles.patientInfoChip}>
                  <View style={styles.patientIconBadge}>
                    <MaterialCommunityIcons name="hospital-building" size={14} color={Colors.warning} />
                  </View>
                  <View>
                    <Text style={styles.patientInfoLabel}>HOSPITAL</Text>
                    <Text style={styles.patientInfoValue}>{prescriptionData.hospital_name}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}


        {/* Diagnosis - Enhanced with source badge */}
        {prescriptionData?.medical_issue_diagnosis && (
          <View style={styles.analysisSection}>
            <View style={styles.criticalHeader}>
              <Feather name="activity" size={18} color={Colors.primary} />
              <Text style={[styles.analysisSectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
                Diagnosis
              </Text>
              {/* Diagnosis Source Badge - NEW */}
              {prescriptionData.diagnosis_source && (
                <View style={[
                  styles.diagnosisSourceBadge,
                  { backgroundColor: prescriptionData.diagnosis_source === 'explicit' ? Colors.success + '15' : Colors.warning + '15' }
                ]}>
                  <Feather
                    name={prescriptionData.diagnosis_source === 'explicit' ? 'check-circle' : 'help-circle'}
                    size={10}
                    color={prescriptionData.diagnosis_source === 'explicit' ? Colors.success : Colors.warning}
                  />
                  <Text style={[
                    styles.diagnosisSourceText,
                    { color: prescriptionData.diagnosis_source === 'explicit' ? Colors.success : Colors.warning }
                  ]}>
                    {prescriptionData.diagnosis_source === 'explicit' ? 'Explicit' : 'AI Inferred'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.analysisText, { marginTop: 12 }]}>
              {prescriptionData.medical_issue_diagnosis}
            </Text>
          </View>
        )}


        {/* Medications */}
        {prescriptionData?.medicines && prescriptionData.medicines.length > 0 && (
          <View style={styles.analysisSection}>
            {/* Drug Interaction Warning - NEW */}
            {prescriptionData.drug_interactions?.potential_interactions_flag && (
              <View style={styles.drugInteractionWarning}>
                <Feather name="alert-triangle" size={18} color={Colors.error} />
                <Text style={styles.drugInteractionText}>
                  {prescriptionData.drug_interactions.interaction_note || 'Potential drug interaction detected'}
                </Text>
              </View>
            )}

            <Text style={styles.analysisSectionTitle}>Medications</Text>
            {prescriptionData.medicines.map((med, index) => {
              // Helper to get form icon
              const getFormIcon = (form?: string | null) => {
                switch (form) {
                  case 'Syrup': return '🧴';
                  case 'Tablet': return '💊';
                  case 'Capsule': return '💊';
                  case 'Injection': return '💉';
                  case 'Drops': return '💧';
                  case 'Cream': return '🧴';
                  case 'Inhaler': return '🌬️';
                  default: return '💊';
                }
              };

              // Helper to parse time_of_day "1-0-1" format
              const parseTimeOfDay = (timeStr?: string) => {
                if (!timeStr) return { morning: false, afternoon: false, night: false };
                const parts = timeStr.split('-').map(p => p === '1');
                return {
                  morning: parts[0] || false,
                  afternoon: parts[1] || false,
                  night: parts[2] || false,
                };
              };

              // Helper to get meal timing text
              const getMealText = (relation?: string | null) => {
                switch (relation) {
                  case 'before_food': return 'Before food';
                  case 'after_food': return 'After food';
                  case 'with_food': return 'With food';
                  case 'empty_stomach': return 'Empty stomach';
                  case 'any': return 'Any time';
                  default: return null;
                }
              };

              // Helper to get interval text
              const getIntervalText = (days?: number) => {
                switch (days) {
                  case 0: return 'As needed';
                  case 1: return 'Daily';
                  case 2: return 'Alternate days';
                  case 7: return 'Weekly';
                  default: return days ? `Every ${days} days` : null;
                }
              };

              // Helper for confidence color
              const getConfidenceColor = (conf?: number) => {
                if (!conf) return Colors.gray400;
                if (conf >= 0.9) return Colors.success;
                if (conf >= 0.7) return Colors.warning;
                return Colors.error;
              };

              // Helper for medicine type color
              const getTypeColor = (type?: string) => {
                switch (type?.toLowerCase()) {
                  case 'antibiotic': return '#2563EB';
                  case 'analgesic': return '#059669';
                  case 'antacid/ppi': return '#7C3AED';
                  case 'antihistamine': return '#DB2777';
                  case 'vitamin/supplement': return '#F59E0B';
                  default: return Colors.gray500;
                }
              };

              const timing = parseTimeOfDay(med.timing?.dosage);
              const confidence = med.assumed_enriched_data?.confidence;

              return (
                <View key={index} style={styles.medicationCard}>
                  {/* Header: Name + Form + Confidence */}
                  <View style={styles.medicationHeader}>
                    <View style={styles.medIconBadge}>
                      <Text style={{ fontSize: 16 }}>{getFormIcon(med.form)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medicationName} numberOfLines={2}>
                        {med.exact_written_name}
                        {med.strength && <Text style={styles.strengthText}> {med.strength}</Text>}
                      </Text>
                    </View>
                    {confidence && (
                      <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(confidence) + '20' }]}>
                        <Text style={[styles.confidenceBadgeText, { color: getConfidenceColor(confidence) }]}>
                          {Math.round(confidence * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Scientific Name + Type */}
                  <View style={styles.medicationSubtitleRow}>
                    {med.assumed_enriched_data?.scientific_name && (
                      <Text style={styles.medicationScientific}>
                        {med.assumed_enriched_data.scientific_name}
                      </Text>
                    )}
                    {med.assumed_enriched_data?.medicine_type && (
                      <View style={[styles.medicineTypeBadge, { backgroundColor: getTypeColor(med.assumed_enriched_data.medicine_type) + '15' }]}>
                        <Text style={[styles.medicineTypeText, { color: getTypeColor(med.assumed_enriched_data.medicine_type) }]}>
                          {med.assumed_enriched_data.medicine_type}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Purpose Banner - NEW */}
                  {med.assumed_enriched_data?.medicine_purpose && (
                    <View style={styles.purposeBanner}>
                      <Feather name="target" size={12} color={Colors.primary} />
                      <Text style={styles.purposeText}>{med.assumed_enriched_data.medicine_purpose}</Text>
                    </View>
                  )}

                  {/* Details Grid */}
                  <View style={styles.medicationDetailsGrid}>
                    {/* Dosage */}
                    {med.dosage_instruction && (
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailGridLabel}>DOSAGE</Text>
                        <Text style={styles.detailGridValue}>{med.dosage_instruction}</Text>
                      </View>
                    )}

                    {/* Schedule (Time of Day Visual) - NEW */}
                    {med.timing?.dosage && (
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailGridLabel}>SCHEDULE</Text>
                        <View style={styles.timeDotsContainer}>
                          <View style={[styles.timeDot, timing.morning && styles.timeDotActive]}>
                            <Text style={styles.timeDotIcon}>🌅</Text>
                          </View>
                          <View style={[styles.timeDot, timing.afternoon && styles.timeDotActive]}>
                            <Text style={styles.timeDotIcon}>☀️</Text>
                          </View>
                          <View style={[styles.timeDot, timing.night && styles.timeDotActive]}>
                            <Text style={styles.timeDotIcon}>🌙</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Meal Timing - NEW */}
                    {getMealText(med.timing?.relation_to_meal) && (
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailGridLabel}>MEAL</Text>
                        <Text style={styles.detailGridValue}>{getMealText(med.timing?.relation_to_meal)}</Text>
                      </View>
                    )}

                    {/* Interval - NEW */}
                    {getIntervalText(med.interval_days) && (
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailGridLabel}>FREQUENCY</Text>
                        <Text style={styles.detailGridValue}>{getIntervalText(med.interval_days)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Duration with Progress - NEW */}
                  {med.duration_days && (
                    <View style={styles.durationProgressContainer}>
                      <View style={styles.durationProgressHeader}>
                        <Feather name="calendar" size={12} color={Colors.textSecondary} />
                        <Text style={styles.durationText}>{med.duration_days} days</Text>
                      </View>
                      <View style={styles.durationProgressBar}>
                        <View style={[styles.durationProgressFill, { width: '100%' }]} />
                      </View>
                    </View>
                  )}

                  {/* Legacy fallbacks */}
                  {!med.timing?.dosage && med.frequency && (
                    <View style={styles.medicationDetailRow}>
                      <Feather name="clock" size={12} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.medicationDetail}>{med.frequency}</Text>
                    </View>
                  )}
                  {!med.duration_days && med.duration && (
                    <View style={styles.medicationDetailRow}>
                      <Feather name="calendar" size={12} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.medicationDetail}>{med.duration}</Text>
                    </View>
                  )}
                  {med.special_instructions && (
                    <View style={styles.medicationDetailRow}>
                      <Feather name="info" size={12} color={Colors.warning} style={{ marginRight: 6 }} />
                      <Text style={[styles.medicationDetail, { color: Colors.warning }]}>{med.special_instructions}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Advised Tests */}
        {prescriptionData?.recommended_tests && prescriptionData.recommended_tests.length > 0 && (
          <View style={styles.analysisSection}>
            <Text style={styles.analysisSectionTitle}>Advised Tests</Text>
            <GroupedTestsCard
              tests={prescriptionData.recommended_tests}
            />
          </View>
        )}

        {/* Follow-up Section - NEW */}
        {prescriptionData?.follow_up?.follow_up_date && (
          <View style={styles.followUpSection}>
            <Feather name="calendar" size={20} color={Colors.info} />
            <View style={{ flex: 1 }}>
              <Text style={styles.followUpText}>
                Follow-up: {new Date(prescriptionData.follow_up.follow_up_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              {prescriptionData.follow_up.follow_up_notes && (
                <Text style={styles.followUpNotes}>{prescriptionData.follow_up.follow_up_notes}</Text>
              )}
            </View>
          </View>
        )}

        {/* Other Information Section - NEW */}
        {prescriptionData?.other_information && prescriptionData.other_information.length > 0 && (
          <View style={styles.otherInfoSection}>
            <Text style={styles.analysisSectionTitle}>Other Information</Text>
            <View style={styles.otherInfoChipsContainer}>
              {prescriptionData.other_information.map((info, index) => {
                // Get category icon
                const getCategoryIcon = (category: string) => {
                  switch (category) {
                    case 'Vitals': return '⚖️';
                    case 'Lifestyle': return '🏃';
                    case 'Diet': return '🥗';
                    case 'Allergy': return '⚠️';
                    case 'Notes': return '📝';
                    default: return '📋';
                  }
                };

                return (
                  <View key={index} style={styles.otherInfoChip}>
                    <Text style={{ fontSize: 14 }}>{getCategoryIcon(info.category)}</Text>
                    <View>
                      <Text style={styles.otherInfoCategory}>{info.category}</Text>
                      <Text style={styles.otherInfoChipText}>{info.value}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Lab Results (from report_data) */}
        {reportData?.grouped_metrics && reportData.grouped_metrics.length > 0 && (
          <View style={styles.analysisSection}>
            {reportData.lab_name && (
              <Text style={styles.labName}>{reportData.lab_name}</Text>
            )}
            <View style={styles.labResultsHeader}>
              <Text style={styles.analysisSectionTitle}>Lab Results</Text>
              <TouchableOpacity
                style={[
                  styles.viewLabAnalysisButton,
                  !labReportId && styles.viewLabAnalysisButtonDisabled,
                ]}
                onPress={() => {
                  if (labReportId) {
                    navigation.navigate('LabReportDetail', { labReportId });
                  } else {
                    Alert.alert(
                      'Lab Analysis Not Available',
                      'Interactive lab report data is being processed. Please check back in a moment.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
                activeOpacity={0.7}
                disabled={!labReportId}
              >
                <Feather name="trending-up" size={16} color={Colors.white} />
                <Text style={styles.viewLabAnalysisButtonText}>View Lab Analysis</Text>
              </TouchableOpacity>
            </View>
            {reportData.grouped_metrics.map((group, groupIndex) => (
              <View key={groupIndex} style={styles.labGroup}>
                <Text style={styles.labGroupName}>{group.group_name}</Text>
                {group.metrics.map((metric, metricIndex) => (
                  <View key={metricIndex} style={styles.labMetricItem}>
                    <View style={styles.labMetricHeader}>
                      <Text style={styles.labMetricName}>{metric.metric_name}</Text>
                      {metric.status && metric.status !== 'normal' && (
                        <View style={[
                          styles.metricStatusBadge,
                          metric.status === 'critical' && styles.metricStatusCritical,
                          metric.status === 'high' && styles.metricStatusHigh,
                          metric.status === 'low' && styles.metricStatusLow,
                        ]}>
                          <Text style={styles.metricStatusText}>
                            {metric.status.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.labMetricValue}>
                      {metric.value} {metric.unit || ''}
                    </Text>
                    {metric.reference_range && (
                      <Text style={styles.labMetricReference}>
                        Ref: {metric.reference_range}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Confidence Score */}
        {analysisMetadata?.confidence_score && (
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>Analysis Confidence</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${analysisMetadata.confidence_score * 100}%` }
                ]}
              />
            </View>
            <Text style={styles.confidenceValue}>
              {Math.round(analysisMetadata.confidence_score * 100)}%
            </Text>
          </View>
        )}

        {/* Raw Text Fallback */}
        {result.rawText && !summary && (
          <View style={styles.analysisSection}>
            <Text style={styles.analysisSectionTitle}>Analysis</Text>
            <Text style={styles.analysisText}>{result.rawText}</Text>
          </View>
        )}
      </View>
    );
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
        <View style={styles.previewCard}>
          {fileNotFound ? (
            <>
              <View style={styles.previewIconContainer}>
                <Feather name="alert-circle" size={64} color={Colors.error} />
              </View>
              <Text style={styles.previewText}>File Not Found</Text>
              <Text style={styles.errorText}>
                The document file could not be found on this device.
              </Text>
            </>
          ) : isPdf && imageUri ? (
            <>
              {/* PDF Preview - First Page using react-native-pdf-jsi */}
              <View style={styles.pdfPreviewWrapper}>
                <Pdf
                  source={{ uri: imageUri, cache: true }}
                  page={1}
                  scale={1.0}
                  minScale={1.0}
                  maxScale={1.0}
                  spacing={0}
                  fitPolicy={0}
                  enablePaging={false}
                  enableRTL={false}
                  enableAnnotationRendering={false}
                  style={styles.pdfPreview}
                  onLoadComplete={(numberOfPages) => {
                    console.log(`[DocumentDetail] PDF Loaded: ${numberOfPages} pages`);
                  }}
                  onError={(error) => {
                    console.error('[DocumentDetail] PDF Error:', error);
                  }}
                />

                {/* Floating Action Buttons - Overlay on PDF */}
                <View style={styles.floatingButtonContainer}>
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={handleViewFullDocument}
                    activeOpacity={0.7}
                  >
                    <View style={styles.actionIconCircle}>
                      <Feather name="eye" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.actionCardLabel}>View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={handleDownload}
                    activeOpacity={0.7}
                    disabled={downloading}
                  >
                    <View style={styles.actionIconCircle}>
                      {downloading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Feather name="download" size={20} color={Colors.primary} />
                      )}
                    </View>
                    <Text style={styles.actionCardLabel}>
                      {downloading ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : imageUri ? (
            <>
              <View>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
                <View style={styles.heroOverlay} />

                {/* Floating Action Buttons - Overlay on Image */}
                <View style={styles.floatingButtonContainer}>
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={handleViewFullDocument}
                    activeOpacity={0.7}
                  >
                    <View style={styles.actionIconCircle}>
                      <Feather name="eye" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.actionCardLabel}>View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={handleDownload}
                    activeOpacity={0.7}
                    disabled={downloading}
                  >
                    <View style={styles.actionIconCircle}>
                      {downloading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Feather name="download" size={20} color={Colors.primary} />
                      )}
                    </View>
                    <Text style={styles.actionCardLabel}>
                      {downloading ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>


            </>
          ) : (
            <>
              <View style={styles.previewIconContainer}>
                <Feather name="file-text" size={64} color={Colors.primary} />
              </View>
              <Text style={styles.previewText}>Document Preview</Text>
            </>
          )}
        </View>



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
                          <MetricCard key={`${metric.test_name}-${index}`} metric={metric} />
                        ))}
                      </ExpandableSection>
                    );
                  })}
                </View>
              </View>
            );
          })()}

        {/* AI Summary Card - Prescriptions */}
        {document.ai_analysis_status === 'completed' &&
          document.ai_analysis_result &&
          document.ai_analysis_result.document_type !== 'medical_report' &&
          getSummary(document.ai_analysis_result) && (
            <PrescriptionSummary
              summary={getSummary(document.ai_analysis_result)!}
              otherInformation={document.ai_analysis_result.prescription_data?.other_information}
              recommendedTests={document.ai_analysis_result.prescription_data?.recommended_tests}
            />
          )}

        {/* Medications Section - Only for prescriptions with medicines */}
        {document.ai_analysis_status === 'completed' &&
          document.ai_analysis_result?.prescription_data?.medicines &&
          document.ai_analysis_result.prescription_data.medicines.length > 0 && (
            <View style={styles.card}>
              <View style={[styles.cardHeader, { marginBottom: 4 }]}>
                <Text style={styles.cardTitle}>Medications</Text>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>
                    {document.ai_analysis_result.prescription_data.medicines.length - dismissedMedicationIds.size}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>
                Review and add medications to your tracker
              </Text>

              {/* Medication Verification Cards - Single Column */}
              {document.ai_analysis_result.prescription_data.medicines
                .map((medicine, index) => ({ medicine, index }))
                .filter(({ index }) => {
                  const dismissId = `${document.id}_${index}`;
                  return !dismissedMedicationIds.has(dismissId);
                })
                .map(({ medicine, index }, arrayIndex, filteredArray) => {
                  const parsedMed = parseAIMedication(
                    medicine,
                    document.id,
                    displayTitle
                  );
                  const suggestedStartDate = document.created_at.split('T')[0]; // Use upload date only
                  const activeMeds = getActiveMedications();
                  const duplicateOf = detectDuplicateMedication(
                    parsedMed.name,
                    parsedMed.dosage,
                    activeMeds
                  );
                  const isVerified = verifiedMedications.has(parsedMed.name);
                  const isLastItem = arrayIndex === filteredArray.length - 1;

                  if (isVerified) {
                    return (
                      <View key={index}>
                        <View style={styles.verifiedBanner}>
                          <Feather name="check-circle" size={16} color={Colors.success} />
                          <Text style={styles.verifiedText}>Added to tracker</Text>
                        </View>
                        {!isLastItem && <View style={styles.medicationDivider} />}
                      </View>
                    );
                  }

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
                            [index]: { ...prev[index], ...updates }
                          }));
                        }}
                        onDismiss={() => handleDismissMedication(index)}
                      />
                      {!isLastItem && <View style={styles.medicationDivider} />}
                    </View>
                  );
                })}



              {/* Verify & Add All Button */}
              {(() => {
                const medicines = document.ai_analysis_result?.prescription_data?.medicines || [];
                const unverifiedMeds = medicines
                  .map((medicine, index) => ({ medicine, index }))
                  .filter(({ index }) => !dismissedMedicationIds.has(`${document.id}_${index}`))
                  .filter(({ medicine }) => {
                    const parsedMed = parseAIMedication(medicine, document.id, displayTitle);
                    return !verifiedMedications.has(parsedMed.name);
                  });

                if (unverifiedMeds.length === 0) return null;

                const handleVerifyAll = async () => {
                  setIsVerifyingAll(true);
                  try {
                    for (const { medicine } of unverifiedMeds) {
                      const parsedMed = parseAIMedication(medicine, document.id, displayTitle);
                      const suggestedStartDate = document.created_at.split('T')[0];
                      await handleVerifyAndAddMedication(parsedMed, suggestedStartDate);
                    }
                  } catch (error) {
                    console.error('[DocumentDetail] Error verifying all medications:', error);
                  } finally {
                    setIsVerifyingAll(false);
                  }
                };

                return (
                  <TouchableOpacity
                    style={[styles.verifyAllButton, isVerifyingAll && styles.verifyAllButtonDisabled]}
                    onPress={handleVerifyAll}
                    disabled={isVerifyingAll}
                    activeOpacity={0.7}
                  >
                    {isVerifyingAll ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <>
                        <Feather name="check" size={18} color={Colors.white} />
                        <Text style={styles.verifyAllButtonText}>
                          Verify & Add {unverifiedMeds.length > 1 ? `All (${unverifiedMeds.length})` : ''}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}

        {/* Advised Tests Section */}
        {document.ai_analysis_status === 'completed' &&
          document.ai_analysis_result?.prescription_data?.recommended_tests &&
          document.ai_analysis_result.prescription_data.recommended_tests.length > 0 && (
            <View style={styles.card}>
              <View style={[styles.cardHeader, { marginBottom: 4 }]}>
                <Text style={styles.cardTitle}>Advised Tests</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Recommended lab tests and investigations
              </Text>

              <View style={{ gap: 12, marginTop: 12 }}>

                <GroupedTestsCard
                  tests={document.ai_analysis_result.prescription_data.recommended_tests}
                />
              </View>
            </View>
          )}

        {/* Extra padding */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        documentType={documentType}
        onShareDocument={handleShareDocument}
        onShareAnalysis={handleShareAnalysis}
      />

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
    </SafeAreaView>
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
    paddingBottom: 100,
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
    padding: 20,
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
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16, // Adequate spacing before medication cards
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
    marginHorizontal: 16, // Match the padding of detailsGrid
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
    marginTop: 0, // Removed top margin (was Sizes.md)
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
    // Removed: backgroundColor, shadow*, elevation
    marginBottom: 12, // Reduced from Sizes.lg (24)
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
    // Removed: backgroundColor, shadow*, elevation
    marginBottom: 12, // Reduced from Sizes.lg
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
  // AI Summary Card Styles
  aiSummaryCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)', // Subtle Blue Tint
    borderRadius: 16,
    marginBottom: 12,
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
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 16,
    marginHorizontal: 4,
  },
  verifyAllButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  verifyAllButtonDisabled: {
    backgroundColor: Colors.gray300,
  },
});
