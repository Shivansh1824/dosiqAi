import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image, Alert, ActivityIndicator, FlatList, Share, Platform, InteractionManager } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Sizes, Typography } from '../constants';
import { Document, DocumentAnalysisResult } from '../types/document';
import { fileExists, getAbsolutePath, deleteLocalFile } from '../utils/fileStorage';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { useDocumentsStore } from '../store/documentsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAuthStore } from '../store/authStore';
import { parseAIMedication, detectDuplicateMedication, isAsNeededFrequency, parseDateOnly } from '../utils/medicationParser';
import { supabase } from '../services/supabaseClient';

import { generateAndSharePDF, sharePDF, PDFGenerationResult } from '../services/pdfGenerationService';
import { useAnalysisPDF } from '../hooks/useAnalysisPDF';
import LoadingOverlay from '../components/LoadingOverlay';
import ShareModal from '../components/ShareModal';
import AnalysisLoading from '../components/AnalysisLoading';
import DocumentOptionsModal from '../components/DocumentOptionsModal';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '../hooks/useNotifications';
import MedicationVerificationCard from '../components/MedicationVerificationCard';
import { VerifiedMedicationsGroup } from '../components/prescription/VerifiedMedicationsGroup';

import { PrescriptionSummary, MedicationsSection, DocumentPreview, DocumentPreviewLoading } from '../components/prescription';
import { GroupedTestsCard } from '../components/prescription/GroupedTestsCard';
import { AnimatedTooltip } from '../components/AnimatedTooltip';
import { RootStackParamList } from '../../App';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import Pdf from 'react-native-pdf';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import FullScreenImageModal from '../components/FullScreenImageModal';
import { DuplicateMedicationModal } from '../components/medication/DuplicateMedicationModal';
import { StatusBar } from 'expo-status-bar';

type PrescriptionSummaryNavigationProp = StackNavigationProp<RootStackParamList, 'PrescriptionSummary'>;

interface PrescriptionSummaryScreenProps {
  onBack: () => void;
  document?: Document;
  documentId?: string;
  navigation: PrescriptionSummaryNavigationProp;
}

export default function PrescriptionSummaryScreen({ onBack, document: documentProp, documentId, navigation }: PrescriptionSummaryScreenProps) {
  const { familyMembers } = useFamilyMembersStore();

  const { documents, analysisProgress, retryAnalysis, deleteDocument } = useDocumentsStore();

  // Resolve document: either passed directly or found in store by ID
  // Resolve document: either passed directly or found in store by ID
  const initialDocument = useMemo(() => {
    if (documentProp) return documentProp;
    if (documentId) return documents.find(d => d.id === documentId);
    return undefined; // Or find locally
  }, [documentProp, documentId, documents]);

  const { addMedicationFromAI, medications } = useMedicationsStore();
  const { user } = useAuthStore();
  const { scheduleAllForMedication } = useNotifications();
  const [isReady, setIsReady] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  // OPTIMIZATION: Defer heavy rendering until navigation transition finishes
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [verifiedMedications, setVerifiedMedications] = useState<Set<string>>(new Set());
  const [dismissedMedicationIds, setDismissedMedicationIds] = useState<Set<string>>(new Set());

  // Check if this document has already been processed/added to tracker
  const isAlreadyAdded = useMemo(() => {
    if (!initialDocument?.id || !medications.length) return false;
    // Check if ANY medication in the store comes from this document
    return medications.some(med => med.source_document_id === initialDocument.id);
  }, [initialDocument?.id, medications]);

  // Live updates for medication reminders and dates (index -> updates)
  const [medicationLiveUpdates, setMedicationLiveUpdates] = useState<Record<number, {
    current_reminder_times?: string[];
    start_date?: string;
    end_date?: string;
    duration_days?: number;
  }>>({});

  const onLiveUpdate = (index: number, updates: any) => {
    setMedicationLiveUpdates(prev => ({
      ...prev,
      [index]: { ...(prev[index] || {}), ...updates }
    }));
  };
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Initialize summary expansion state based on document type
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(() => {
    // Check if we have document available initially (optimization)
    const doc = documentProp || (documents.find(d => d.id === documentId));
    return doc?.ai_analysis_result?.document_type?.toLowerCase() === 'invalid';
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  // Tooltip state for dismissed medications
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [tooltipContent, setTooltipContent] = useState('');

  // Duplicate Resolution State
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [pendingDuplicateData, setPendingDuplicateData] = useState<{
    newMed: import('../types/medicationVerification').ParsedMedication;
    existingMed: import('../types/medication').Medication;
    startDate: string;
    resolve: () => void;
    reject: (reason?: any) => void;
  } | null>(null);



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

  // ========== MEDICATION CALCULATIONS (moved to top-level for Rules of Hooks) ==========
  // Inner medicines from document
  const innerMedicines = useMemo(() => {
    return document?.ai_analysis_result?.prescription_data?.medicines || [];
  }, [document?.ai_analysis_result]);

  // Get display title - prefer AI-generated filename from analysis result, fallback to document title
  // Smart Header Logic
  const analysis = document?.ai_analysis_result;

  const { titleText, subtitleText } = useMemo(() => {
    if (!document) return { titleText: 'Medical Document', subtitleText: '' };

    let title = (document.ai_analysis_status === 'processing' || document.ai_analysis_status === 'pending')
      ? "dosiq Ai • Analyzing..."
      : (document.local_file_path?.split('/').pop() || 'Medical Document');
    let subtitle = '';

    if (analysis) {
      // 1. Construct Smart Title
      if (analysis.document_type === 'prescription' && analysis.prescription_data?.medical_issue_diagnosis) {
        title = `${analysis.prescription_data.medical_issue_diagnosis} Prescription`;
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
      if (analysis.patient_info?.name) parts.push(analysis.patient_info.name);

      if (analysis.common_data?.visit_date) {
        parts.push(analysis.common_data.visit_date);
      }
      subtitle = parts.join(' • ');
    }

    return { titleText: title, subtitleText: subtitle };
  }, [document?.ai_analysis_status, document?.local_file_path, analysis]);

  // Keep displayTitle for shared PDF viewer
  const displayTitle = titleText;

  // All unverified medications - Memoized to prevent heavy calculation on every render
  const allUnverifiedMedsIdx = useMemo(() => {
    if (!document) return [];
    return innerMedicines
      .map((medicine, index) => ({ medicine, index }))
      .filter(({ medicine }) => {
        const parsedMed = parseAIMedication(medicine, document.id, displayTitle, familyMember);
        return !verifiedMedications.has(parsedMed.name);
      });
  }, [innerMedicines, document?.id, verifiedMedications, displayTitle, familyMember]);

  // Active unverified medications - Memoized
  const activeMedsForBatch = useMemo(() => {
    if (!document) return [];
    return allUnverifiedMedsIdx.filter(({ index }) => {
      const dismissId = `${document.id}_${index}`;
      return !dismissedMedicationIds.has(dismissId);
    });
  }, [allUnverifiedMedsIdx, document?.id, dismissedMedicationIds]);

  // Pre-calculate duplicates map to avoid O(N*M) in render loop
  const duplicateMedicationsMap = useMemo(() => {
    const map = new Map<number, import('../types/medication').Medication>();
    if (!document || !medications || medications.length === 0) return map;

    allUnverifiedMedsIdx.forEach(({ medicine, index }) => {
      const parsedMed = parseAIMedication(medicine, document.id, displayTitle, familyMember);
      const duplicate = detectDuplicateMedication(parsedMed.name, parsedMed.dosage, medications);
      if (duplicate) {
        map.set(index, duplicate);
      }
    });
    return map;
  }, [allUnverifiedMedsIdx, medications, document?.id, displayTitle, familyMember]);

  const hasUnverifiedMeds = activeMedsForBatch.length > 0;

  // Check if file exists locally; if not, sync from R2
  useEffect(() => {
    const checkAndSyncFile = async () => {
      if (!document || !document.local_file_path) {
        setFileNotFound(true);
        return;
      }

      try {
        console.log('[PrescriptionSummary] Original relative path:', document.local_file_path);

        // Convert relative path to absolute path at runtime
        const absolutePath = getAbsolutePath(document.local_file_path);

        console.log('[PrescriptionSummary] Converted to absolute path:', absolutePath);
        console.log('[PrescriptionSummary] Path has file:// protocol:', absolutePath.startsWith('file://'));

        // First check if file exists locally
        const exists = await fileExists(absolutePath);

        if (exists) {
          setImageUri(absolutePath);
          setFileNotFound(false);
          console.log('[PrescriptionSummary] File found and URI set successfully');
        } else {
          // File not found locally - try to sync from R2
          console.log('[PrescriptionSummary] File not found locally, attempting R2 sync...');

          if (document.cloud_file_key) {
            try {
              setDownloading(true);
              console.log('[PrescriptionSummary] Cloud file key available:', document.cloud_file_key);

              // Import and use the file sync utility
              const { getFileWithSync, extractFilename } = await import('../utils/fileSync');
              const filename = extractFilename(document.local_file_path);

              console.log('[PrescriptionSummary] Starting file sync for:', filename);
              const { localPath, wasDownloaded } = await getFileWithSync(filename, document.cloud_file_key);

              if (wasDownloaded) {
                console.log('[PrescriptionSummary] ✅ File downloaded from R2:', localPath);
              } else {
                console.log('[PrescriptionSummary] File was already available locally:', localPath);
              }

              setImageUri(localPath);
              setFileNotFound(false);
              setDownloading(false);
            } catch (syncError) {
              console.error('[PrescriptionSummary] R2 sync failed:', syncError);
              setFileNotFound(true);
              setDownloading(false);
            }
          } else {
            // No cloud key available
            setFileNotFound(true);
            console.error('[PrescriptionSummary] File not found at path and no cloud_file_key available:', absolutePath);
          }
        }
      } catch (error) {
        setFileNotFound(true);
        console.error('[PrescriptionSummary] Error checking file:', error);
        console.error('[PrescriptionSummary] Error details:', JSON.stringify(error, null, 2));
      }
    };

    checkAndSyncFile();
  }, [document?.local_file_path, document?.cloud_file_key]);


  useEffect(() => {
    const loadDismissedMedications = async () => {
      if (!document || !DISMISSED_MEDS_STORAGE_KEY) return;
      try {
        const stored = await AsyncStorage.getItem(DISMISSED_MEDS_STORAGE_KEY);
        if (stored) {
          const dismissed = JSON.parse(stored);
          setDismissedMedicationIds(new Set(dismissed));
          console.log('[PrescriptionSummary] Loaded dismissed medications:', dismissed);
        }
      } catch (error) {
        console.error('[PrescriptionSummary] Error loading dismissed medications:', error);
      }
    };

    loadDismissedMedications();
  }, [DISMISSED_MEDS_STORAGE_KEY]);



  const { isGenerating: isGeneratingAnalysis, generateAndShare: handleShareAnalysis } = useAnalysisPDF({
    analysis: document?.ai_analysis_result,
    documentType,
    imageUri,
    displayTitle
  });

  if (!initialDocument || !document) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header - Fixed Verification Banner if already added */}
        {isAlreadyAdded && (
          <View style={styles.verifiedHeaderBanner}>
            <Feather name="check-circle" size={16} color={Colors.white} />
            <Text style={styles.verifiedHeaderText}>
              Prescription Verified & Added to Tracker
            </Text>
          </View>
        )}
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

  // Determine if file is PDF
  const isPdf = document?.local_file_path?.toLowerCase().endsWith('.pdf');

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

    console.log('[PrescriptionSummary] Opening document viewer');
    console.log('[PrescriptionSummary] File type is PDF:', isPdf);
    console.log('[PrescriptionSummary] URI being passed:', imageUri);
    console.log('[PrescriptionSummary] URI has file:// protocol:', imageUri.startsWith('file://'));

    if (isPdf) {
      // Navigate to embedded PDF viewer
      navigation.navigate('PdfViewer', {
        uri: imageUri,
        title: displayTitle
      });
      console.log('[PrescriptionSummary] Navigated to PdfViewer with URI:', imageUri);
    } else {
      // For images, open full-screen image viewer
      setShowFullScreenImage(true);
      console.log('[PrescriptionSummary] Opened full-screen image modal');
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
      if (document) {
        await deleteDocument(document.id);
      }

      // 2. Delete from local storage
      if (document?.local_file_path) {
        try {
          const absolutePath = getAbsolutePath(document.local_file_path);
          await deleteLocalFile(absolutePath);
          console.log('[PrescriptionSummary] Deleted local file:', absolutePath);
        } catch (e) {
          console.warn('[PrescriptionSummary] Failed to delete local file:', e);
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
      console.log('[PrescriptionSummary] Saved dismissed medications:', Array.from(dismissedSet));
    } catch (error) {
      console.error('[PrescriptionSummary] Error saving dismissed medications:', error);
    }
  };

  // Handle dismissing a medication from verification list
  const handleDismissMedication = (medicineIndex: number) => {
    if (!document) return;
    const dismissId = `${document.id}_${medicineIndex}`;

    console.log('[PrescriptionSummary] Dismissing medication at index:', medicineIndex);

    setDismissedMedicationIds(prev => {
      const updated = new Set(prev);
      updated.add(dismissId);
      saveDismissedToStorage(updated);
      return updated;
    });
  };

  // Handle restoring a dismissed medication
  const handleRestoreMedication = (medicineIndex: number) => {
    if (!document) return;
    const dismissId = `${document.id}_${medicineIndex}`;

    console.log('[PrescriptionSummary] Restoring medication at index:', medicineIndex);

    setDismissedMedicationIds(prev => {
      const updated = new Set(prev);
      updated.delete(dismissId);
      saveDismissedToStorage(updated);
      return updated;
    });
  };

  // Handle Duplicate Resolution Actions
  const handleResolveDuplicate = async (action: 'replace' | 'add') => {
    if (!pendingDuplicateData || !user) return;
    const { newMed, existingMed, startDate, resolve, reject } = pendingDuplicateData;

    try {
      setDuplicateModalVisible(false);

      const addedMed = await addMedicationFromAI(
        newMed,
        user.id,
        document!.id,
        displayTitle,
        startDate,
        document!.family_member_id!
      );

      if (addedMed) {
        await scheduleAllForMedication(addedMed);
      }

      if (action === 'replace') {
        // Mark old as inactive (set end_date to yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await useMedicationsStore.getState().updateMedication(existingMed.id, {
          end_date: yesterday.toISOString().split('T')[0],
        });
      }

      // Mark as verified
      setVerifiedMedications(prev => new Set(prev).add(newMed.name));
      resolve();
    } catch (error) {
      reject(error);
      Alert.alert('Error', 'Failed to resolve duplicate.');
    } finally {
      setPendingDuplicateData(null);
    }
  };

  const handleCancelDuplicate = () => {
    if (pendingDuplicateData) {
      pendingDuplicateData.reject(new Error('User cancelled'));
      setPendingDuplicateData(null);
    }
    setDuplicateModalVisible(false);
  };

  // Handle verify and add medication from AI extraction
  const handleVerifyAndAddMedication = async (parsedMed: import('../types/medicationVerification').ParsedMedication, startDate: string) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add medications');
      return;
    }

    try {
      // Check for duplicates in active medications (history check)
      // We pass all medications; the parser filters by active status (not expired) and handles fuzzy matching
      const duplicate = detectDuplicateMedication(
        parsedMed.name,
        parsedMed.dosage,
        medications
      );

      if (duplicate) {
        // Show duplicate modal instead of alert
        return new Promise<void>((resolve, reject) => {
          setPendingDuplicateData({
            newMed: parsedMed,
            existingMed: duplicate,
            startDate,
            resolve,
            reject,
          });
          setDuplicateModalVisible(true);
        });
      }

      // No duplicate, add directly
      const addedMed = await addMedicationFromAI(
        parsedMed,
        user.id,
        document!.id,
        displayTitle,
        startDate,
        document!.family_member_id!
      );

      // Schedule reminders
      if (addedMed) {
        await scheduleAllForMedication(addedMed);
      }

      // Mark as verified
      setVerifiedMedications(prev => new Set(prev).add(parsedMed.name));
    } catch (error) {
      console.error('[PrescriptionSummary] Error adding medication:', error);
      throw error; // Let the card component handle the error
    }
  };

  // Helper to get summary from new or legacy structure
  const getSummary = (result?: DocumentAnalysisResult): string | undefined => {
    return result?.common_data?.summary || result?.summary;
  };

  // Helper to format document type
  const formatDocumentType = (type: string): string => {
    if (type.toLowerCase() === 'invalid') return 'Invalid';
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
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#EFF6FF', '#F1F5F9', '#F1F5F9']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
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
              <View style={styles.previewCard}>
                {fileNotFound ? (
                  <Fragment>
                    <View style={styles.previewIconContainer}>
                      <Feather name="alert-circle" size={64} color={Colors.error} />
                    </View>
                    <Text style={styles.previewText}>File Not Found</Text>
                    <Text style={styles.errorText}>
                      The document file could not be found on this device.
                    </Text>
                  </Fragment>
                ) : isPdf && imageUri ? (
                  <Animated.View layout={LinearTransition.duration(300)}>
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
                          console.log(`[PrescriptionSummary] PDF Loaded: ${numberOfPages} pages`);
                        }}
                        onError={(error) => {
                          console.error('[PrescriptionSummary] PDF Error:', error);
                        }}
                      />

                      {/* Floating Action Buttons - Modern Compact Pill */}
                      <View style={styles.floatingButtonContainer}>
                        <View style={styles.compactActionPill}>
                          <TouchableOpacity
                            style={styles.pillAction}
                            onPress={handleViewFullDocument}
                            activeOpacity={0.7}
                          >
                            <Feather name="eye" size={18} color={Colors.primary} />
                            <Text style={styles.pillActionText}>View</Text>
                          </TouchableOpacity>

                          <View style={styles.pillDivider} />

                          <TouchableOpacity
                            style={styles.pillAction}
                            onPress={handleDownload}
                            activeOpacity={0.7}
                            disabled={downloading}
                          >
                            {downloading ? (
                              <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                              <Feather name="download" size={18} color={Colors.primary} />
                            )}
                            <Text style={styles.pillActionText}>
                              {downloading ? 'Saving' : 'Save'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                ) : imageUri ? (
                  <Animated.View layout={LinearTransition.duration(300)}>
                    <View>
                      <Image
                        source={{ uri: imageUri || undefined }}
                        style={styles.heroImage}
                        resizeMode="cover"
                      />
                      <View style={styles.heroOverlay} />

                      {/* Floating Action Buttons - Modern Compact Pill */}
                      <View style={styles.floatingButtonContainer}>
                        <View style={styles.compactActionPill}>
                          <TouchableOpacity
                            style={styles.pillAction}
                            onPress={handleViewFullDocument}
                            activeOpacity={0.7}
                          >
                            <Feather name="eye" size={18} color={Colors.primary} />
                            <Text style={styles.pillActionText}>View</Text>
                          </TouchableOpacity>

                          <View style={styles.pillDivider} />

                          <TouchableOpacity
                            style={styles.pillAction}
                            onPress={handleDownload}
                            activeOpacity={0.7}
                            disabled={downloading}
                          >
                            {downloading ? (
                              <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                              <Feather name="download" size={18} color={Colors.primary} />
                            )}
                            <Text style={styles.pillActionText}>
                              {downloading ? 'Saving' : 'Save'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                ) : (
                  <DocumentPreviewLoading />
                )}
              </View>








              {/* Consolidated AI Summary, Medications & Action Bar */}
              {(() => {
                const summary = document ? getSummary(document.ai_analysis_result) : undefined;

                return (
                  <Animated.View layout={LinearTransition.duration(300)}>
                    {/* AI Summary Section - Show greyed-out when already added, hidden only during session verification */}
                    {document?.ai_analysis_status === 'completed' &&
                      summary &&
                      (hasUnverifiedMeds || (isAlreadyAdded && verifiedMedications.size === 0)) && (
                        <PrescriptionSummary
                          summary={summary}
                          recommendedTests={document?.ai_analysis_result?.prescription_data?.recommended_tests}
                          otherInformation={document?.ai_analysis_result?.prescription_data?.other_information}
                          followUp={document?.ai_analysis_result?.prescription_data?.follow_up}
                          defaultExpanded={document?.ai_analysis_result?.document_type?.toLowerCase() === 'invalid'}
                        />
                      )}

                    {/* Medications Section */}
                    {document?.ai_analysis_status === 'completed' &&
                      innerMedicines.length > 0 && (
                        <Animated.View
                          layout={LinearTransition.duration(250)}
                        >
                          {/* MEDS DETECTED Header - Styled like AI Summary (standalone collapsible card) */}
                          {(hasUnverifiedMeds || (isAlreadyAdded && verifiedMedications.size === 0)) && (() => {
                            const count = innerMedicines.length;
                            return (
                              <View style={styles.medicationsHeaderCard}>
                                <View style={styles.medicationsHeaderRow}>
                                  <View style={styles.medicationsHeaderLeft}>
                                    <Text style={styles.medicationsCountText}>{count}</Text>
                                    <View style={{ gap: 2, flex: 1, justifyContent: 'center' }}>
                                      <Text style={styles.medicationsHeaderTitle}>MEDICATIONS DETECTED</Text>
                                      <Text style={styles.medicationsHeaderSubtitle}>
                                        dosiq Ai found {count}{' '}
                                        {count === 1 ? 'medication' : 'medications'} in your prescription. See details below.
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              </View>
                            );
                          })()}

                          {/* Verification Prompt — encourage user to cross-check */}
                          {document?.ai_analysis_result?.analysis_metadata?.handwriting_detected && (
                            <View style={styles.verificationPrompt}>
                              <Feather name="alert-circle" size={16} color="#3B82F6" style={{ marginTop: 1 }} />
                              <Text style={styles.verificationPromptText}>
                                dosiq Ai may not detect all medications from handwritten prescriptions. Please verify the list below and add any missing ones.
                              </Text>
                            </View>
                          )}

                          {/* Verified Group - ONLY show when meds were verified in current session (not when just reopening) */}
                          {verifiedMedications.size > 0 && (() => {
                            const verifiedNames = innerMedicines
                              .map(m => parseAIMedication(m, document!.id, displayTitle, familyMember))
                              .filter(m => verifiedMedications.has(m.name))
                              .map(m => m.name);

                            return verifiedNames.length > 0 ? (
                              <VerifiedMedicationsGroup
                                medicationNames={verifiedNames}
                                onViewInTracker={() => navigation.navigate('Medications')}
                              />
                            ) : null;
                          })()}

                          {/* Divider Line - Only show if we have verified items above in CURRENT session */}


                          {/* Unverified/All Medications List - Each card is a standalone main card */}
                          {((!isAlreadyAdded && allUnverifiedMedsIdx.length > 0) || (isAlreadyAdded && verifiedMedications.size === 0)) && (
                            <View>
                              {(isAlreadyAdded ? innerMedicines.map((medicine, index) => ({ medicine, index })) : allUnverifiedMedsIdx).map(({ medicine, index }, arrayIndex) => {
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
                                    confidenceScore={document.ai_analysis_result?.analysis_metadata?.confidence_score}
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
                                    followUpDays={document?.ai_analysis_result?.prescription_data?.follow_up?.follow_up_days}
                                  />
                                );
                              })}

                              {/* Add Medication Manually Button - Always Visible */}
                              <TouchableOpacity
                                style={styles.addManuallyButton}
                                onPress={() => navigation.navigate('AddMedication')}
                                activeOpacity={0.7}
                              >
                                <Feather name="plus" size={20} color={Colors.primary} />
                                <Text style={styles.addManuallyButtonText}>Add Medication Manually</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* Action Button - "Confirm & Add" when not added, "View in Tracker" when already added */}
                          {(hasUnverifiedMeds || (isAlreadyAdded && verifiedMedications.size === 0)) && (
                            <View style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 }}>
                              <TouchableOpacity
                                style={[styles.verifyAllButton, isVerifyingAll && styles.verifyAllButtonDisabled]}
                                onPress={async () => {
                                  // If already added, just navigate to tracker
                                  if (isAlreadyAdded) {
                                    navigation.navigate('Medications');
                                    return;
                                  }

                                  setIsVerifyingAll(true);
                                  try {
                                    const currentUser = (await supabase.auth.getUser()).data.user;
                                    if (!currentUser || !document) return;

                                    const suggestedStartDate = parseDateOnly(new Date().toISOString());
                                    const medsToVerify = activeMedsForBatch.map(({ medicine, index }) => {
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
                                      medsToVerify.forEach(m => next.add(m.name));
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
                                      <Feather name={isAlreadyAdded ? "eye" : "check-circle"} size={18} color={Colors.white} />
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
                document?.ai_analysis_result?.prescription_data?.recommended_tests &&
                document?.ai_analysis_result?.prescription_data?.recommended_tests.length > 0 && (
                  <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: Colors.primary + '40' }]}>
                    <View style={[styles.cardHeader, { marginBottom: 4 }]}>
                      <Text style={styles.cardTitle}>Advised Tests</Text>
                    </View>
                    <Text style={[styles.cardSubtitle, { marginBottom: 0 }]}>
                      Recommended lab tests and investigations
                    </Text>

                    <View style={{ gap: 12, marginTop: 14 }}>

                      <GroupedTestsCard
                        tests={document?.ai_analysis_result?.prescription_data?.recommended_tests}
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
        {
          imageUri && (
            <FullScreenImageModal
              visible={showFullScreenImage}
              imageUri={imageUri}
              onClose={() => setShowFullScreenImage(false)}
            />
          )
        }

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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  verifiedHeaderText: {
    ...Typography.styles.body,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: Colors.white,
    marginLeft: 8,
    fontSize: 14,
  },
  verifiedHeaderBanner: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
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
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
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
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Hero Preview Card (2026 Style)
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 4,
    marginHorizontal: 16,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 220,
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
  // PDF Preview styles
  pdfPreviewWrapper: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  pdfPreview: {
    flex: 1,
    width: '100%',
    height: 220,
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
    backgroundColor: 'rgba(0,0,0,0.03)',
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

  // 2026 Floating Action Buttons - Compact Pill Design
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  compactActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 100,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  pillAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
  pillActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pillDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#94A3B8', // Increased visibility (Slate-400 equivalent)
    marginHorizontal: 4,
  },

  // Retain actionCard styles for potential reuse or legacy components if any
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 44,
  },
  actionIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray800,
    letterSpacing: 0.1,
  },




  // Medications Header Card (styled like AI Summary)
  medicationsHeaderCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  medicationsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 16, // Add padding inside the container
    paddingVertical: 12,   // Add vertical padding
    backgroundColor: Colors.white, // Explicit white background
    borderRadius: 16,      // Rounded corners
    borderWidth: 1,
    borderColor: Colors.gray200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 16, // Add margin to float it
  },
  medicationsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  medicationsCountText: {
    fontSize: 56,
    fontWeight: '800',
    color: '#000000',
    includeFontPadding: false,
    lineHeight: 64, // Adjusted for larger font
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: -2,
    paddingHorizontal: 8,
  },
  medicationsHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.2,
  },
  medicationsHeaderSubtitle: {
    fontSize: 13,
    color: Colors.gray500,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Cards
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  medicationsCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingTop: 4,
    paddingBottom: 0,
    paddingHorizontal: 0,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
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
  serialNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
    marginRight: 6,
  },
  serialNumberDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 8,
  },
  dismissedSerialNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.gray300,
    letterSpacing: -0.5,
    marginRight: 6,
  },
  dismissedSerialNumberDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginRight: 8,
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
    flexShrink: 1,
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
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  verifyAllGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
    borderRadius: 16,
  },
  verifyAllButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  verifyAllButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonContainer: {
    padding: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    width: '100%',
  },
  buttonShadow: {
    borderRadius: 16,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 4,
    backgroundColor: 'transparent',
  },

  // Verification Prompt
  verificationPrompt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  verificationPromptText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
    fontWeight: '400',
  },

  // Add Manually Button
  addManuallyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed',
    backgroundColor: Colors.primary + '05',
  },
  addManuallyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: -0.2,
  },
});

