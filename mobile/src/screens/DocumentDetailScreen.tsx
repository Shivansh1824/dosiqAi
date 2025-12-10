import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image, Alert, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Sizes, Typography } from '../constants';
import { Document, DocumentAnalysisResult } from '../types/document';
import { fileExists, getAbsolutePath } from '../utils/fileStorage';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { useDocumentsStore } from '../store/documentsStore';
import { RootStackParamList } from '../../App';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { File } from 'expo-file-system';
import FullScreenImageModal from '../components/FullScreenImageModal';
import MedicationVerificationCard from '../components/MedicationVerificationCard';
import { useMedicationsStore } from '../store/medicationsStore';
import { useAuthStore } from '../store/authStore';
import { parseAIMedication, detectDuplicateMedication } from '../utils/medicationParser';

type DocumentDetailNavigationProp = StackNavigationProp<RootStackParamList, 'Document'>;

interface DocumentDetailScreenProps {
  onBack: () => void;
  document: Document | undefined;
  navigation: DocumentDetailNavigationProp;
}

export default function DocumentDetailScreen({ onBack, document: documentProp, navigation }: DocumentDetailScreenProps) {
  const { familyMembers } = useFamilyMembersStore();
  const { documents, analysisProgress, retryAnalysis } = useDocumentsStore();
  const { addMedicationFromAI, getActiveMedications } = useMedicationsStore();
  const { user } = useAuthStore();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [verifiedMedications, setVerifiedMedications] = useState<Set<string>>(new Set());
  const [dismissedMedicationIds, setDismissedMedicationIds] = useState<Set<string>>(new Set());

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
  const patientName = familyMember?.name || 'Unknown';

  // Get display title - prefer AI-generated filename from analysis result, fallback to document title
  const displayTitle = document.ai_analysis_result?.file_name || document.title;

  // Check if file exists and set image URI
  useEffect(() => {
    const checkFile = async () => {
      if (document.local_file_path) {
        try {
          console.log('[DocumentDetail] Original relative path:', document.local_file_path);

          // Convert relative path to absolute path at runtime
          const absolutePath = getAbsolutePath(document.local_file_path);

          console.log('[DocumentDetail] Converted to absolute path:', absolutePath);
          console.log('[DocumentDetail] Path has file:// protocol:', absolutePath.startsWith('file://'));

          const exists = await fileExists(absolutePath);

          if (exists) {
            setImageUri(absolutePath);
            setFileNotFound(false);
            console.log('[DocumentDetail] File found and URI set successfully');
          } else {
            setFileNotFound(true);
            console.error('[DocumentDetail] File not found at path:', absolutePath);
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

    checkFile();
  }, [document.local_file_path]);

  // Load dismissed medications from AsyncStorage on mount
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

  // Handle share
  const handleShare = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'Document file not found');
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(imageUri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing:', error);
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
          <View style={styles.analysisSection}>
            <Text style={styles.analysisSectionTitle}>Summary</Text>
            <Text style={styles.analysisText}>{summary}</Text>
          </View>
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
                <View style={styles.patientInfoRow}>
                  <Text style={styles.analysisLabel}>Name</Text>
                  <Text style={styles.analysisValue}>{patientInfo.name}</Text>
                </View>
              )}
              {patientInfo.age && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.analysisLabel}>Age</Text>
                  <Text style={styles.analysisValue}>{patientInfo.age}</Text>
                </View>
              )}
              {patientInfo.gender && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.analysisLabel}>Gender</Text>
                  <Text style={styles.analysisValue}>{patientInfo.gender}</Text>
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
                <View style={styles.patientInfoRow}>
                  <Text style={styles.analysisLabel}>Doctor</Text>
                  <Text style={styles.analysisValue}>{prescriptionData.doctor_name}</Text>
                </View>
              )}
              {prescriptionData.hospital_name && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.analysisLabel}>Hospital</Text>
                  <Text style={styles.analysisValue}>{prescriptionData.hospital_name}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Diagnosis */}
        {prescriptionData?.medical_issue_diagnosis && (
          <View style={styles.analysisSection}>
            <View style={styles.criticalHeader}>
              <Feather name="activity" size={18} color={Colors.primary} />
              <Text style={[styles.analysisSectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
                Diagnosis
              </Text>
            </View>
            <Text style={[styles.analysisText, { marginTop: 8 }]}>
              {prescriptionData.medical_issue_diagnosis}
            </Text>
          </View>
        )}

        {/* Medications */}
        {prescriptionData?.medicines && prescriptionData.medicines.length > 0 && (
          <View style={styles.analysisSection}>
            <Text style={styles.analysisSectionTitle}>Medications</Text>
            {prescriptionData.medicines.map((med, index) => (
              <View key={index} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <Feather name="package" size={16} color={Colors.primary} />
                  <Text style={styles.medicationName}>{med.exact_written_name}</Text>
                </View>
                {med.assumed_enriched_data?.scientific_name && (
                  <Text style={styles.medicationScientific}>
                    ({med.assumed_enriched_data.scientific_name})
                  </Text>
                )}
                <View style={styles.medicationDetails}>
                  {med.dosage_instruction && (
                    <Text style={styles.medicationDetail}>
                      💊 {med.dosage_instruction}
                    </Text>
                  )}
                  {med.frequency && (
                    <Text style={styles.medicationDetail}>
                      🕐 {med.frequency}
                    </Text>
                  )}
                  {med.duration && (
                    <Text style={styles.medicationDetail}>
                      📅 {med.duration}
                    </Text>
                  )}
                  {med.special_instructions && (
                    <Text style={styles.medicationDetail}>
                      ⚠️ {med.special_instructions}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recommended Tests */}
        {prescriptionData?.recommended_tests && prescriptionData.recommended_tests.length > 0 && (
          <View style={styles.analysisSection}>
            <Text style={styles.analysisSectionTitle}>Recommended Tests</Text>
            {prescriptionData.recommended_tests.map((test, index) => (
              <View key={index} style={styles.testItem}>
                <Feather name="clipboard" size={14} color={Colors.primary} />
                <View style={styles.testContent}>
                  <Text style={styles.testName}>{test.test_name}</Text>
                  {test.reason && (
                    <Text style={styles.testReason}>{test.reason}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Lab Results (from report_data) */}
        {reportData?.grouped_metrics && reportData.grouped_metrics.length > 0 && (
          <View style={styles.analysisSection}>
            {reportData.lab_name && (
              <Text style={styles.labName}>{reportData.lab_name}</Text>
            )}
            <Text style={styles.analysisSectionTitle}>Lab Results</Text>
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
        <Text style={styles.headerTitle}>{displayTitle}</Text>
        <TouchableOpacity
          style={styles.headerButtonRight}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="more-vertical" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
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
          ) : isPdf ? (
            <>
              <View style={styles.previewIconContainer}>
                <Feather name="file-text" size={64} color={Colors.primary} />
              </View>
              <Text style={styles.previewText}>PDF Document</Text>
              <TouchableOpacity style={styles.viewButton} onPress={handleViewFullDocument}>
                <Feather name="eye" size={18} color={Colors.primary} />
                <Text style={styles.viewButtonText}>View Full Document</Text>
              </TouchableOpacity>
            </>
          ) : imageUri ? (
            <>
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <TouchableOpacity style={styles.viewButton} onPress={handleViewFullDocument}>
                <Feather name="eye" size={18} color={Colors.primary} />
                <Text style={styles.viewButtonText}>View Full Document</Text>
              </TouchableOpacity>
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

        {/* Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDate(document.created_at)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>
                {document.ai_analysis_result?.document_type
                  ? formatDocumentType(document.ai_analysis_result.document_type)
                  : document.type}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Patient</Text>
              <Text style={styles.detailValue}>
                {document.ai_analysis_result?.patient_info?.name || patientName}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Analysis</Text>
              {document.ai_analysis_status === 'processing' ? (
                <View style={[styles.statusBadge, styles.statusBadgeProcessing]}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[styles.statusText, styles.statusTextProcessing]}>Processing</Text>
                </View>
              ) : document.ai_analysis_status === 'completed' ? (
                <View style={[styles.statusBadge, styles.statusBadgeSuccess]}>
                  <Feather name="check-circle" size={12} color={Colors.success} />
                  <Text style={[styles.statusText, styles.statusTextSuccess]}>Completed</Text>
                </View>
              ) : document.ai_analysis_status === 'failed' ? (
                <View style={[styles.statusBadge, styles.statusBadgeError]}>
                  <Feather name="alert-circle" size={12} color={Colors.error} />
                  <Text style={[styles.statusText, styles.statusTextError]}>Failed</Text>
                </View>
              ) : (
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Pending</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Summary Card - Only show when analysis is completed with summary */}
        {document.ai_analysis_status === 'completed' &&
          document.ai_analysis_result &&
          getSummary(document.ai_analysis_result) && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <Text style={styles.analysisText}>
                {getSummary(document.ai_analysis_result)}
              </Text>
            </View>
          )}

        {/* Medications Section - Only for prescriptions with medicines */}
        {document.ai_analysis_status === 'completed' &&
          document.ai_analysis_result?.prescription_data?.medicines &&
          document.ai_analysis_result.prescription_data.medicines.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
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
                .map(({ medicine, index }) => {
                  const parsedMed = parseAIMedication(
                    medicine,
                    document.id,
                    displayTitle
                  );
                  const suggestedStartDate =
                    document.ai_analysis_result?.common_data?.visit_date ||
                    document.created_at.split('T')[0];
                  const activeMeds = getActiveMedications();
                  const duplicateOf = detectDuplicateMedication(
                    parsedMed.name,
                    parsedMed.dosage,
                    activeMeds
                  );
                  const isVerified = verifiedMedications.has(parsedMed.name);

                  if (isVerified) {
                    return (
                      <View key={index} style={styles.verifiedBanner}>
                        <Feather name="check-circle" size={16} color={Colors.success} />
                        <Text style={styles.verifiedText}>Added to tracker</Text>
                      </View>
                    );
                  }

                  return (
                    <MedicationVerificationCard
                      key={index}
                      medication={parsedMed}
                      documentId={document.id}
                      documentTitle={displayTitle}
                      suggestedStartDate={suggestedStartDate}
                      onVerifyAndAdd={handleVerifyAndAddMedication}
                      duplicateOf={duplicateOf || undefined}
                      medicineIndex={index}
                      onDismiss={() => handleDismissMedication(index)}
                    />
                  );
                })}
            </View>
          )}

        {/* Extra padding */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.8}
          onPress={handleDownload}
          disabled={fileNotFound || downloading}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={Colors.gray700} />
          ) : (
            <Feather name="download" size={20} color={fileNotFound ? Colors.gray400 : Colors.gray700} />
          )}
          <Text style={[styles.actionButtonText, (fileNotFound || downloading) && styles.actionButtonTextDisabled]}>
            {downloading ? 'Downloading...' : 'Download'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButtonPrimary, (fileNotFound || downloading) && styles.actionButtonDisabled]}
          activeOpacity={0.8}
          onPress={handleShare}
          disabled={fileNotFound || downloading}
        >
          <Feather name="share-2" size={20} color={Colors.white} />
          <Text style={styles.actionButtonTextPrimary}>Share</Text>
        </TouchableOpacity>
      </View>

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
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Sizes.lg,
    paddingBottom: 100,
  },

  // Preview Card
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Sizes.xl,
    alignItems: 'center',
    marginBottom: Sizes.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  previewIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  previewText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: Sizes.lg,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.sm,
    gap: Sizes.xs,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Cards
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Sizes.lg,
    marginBottom: Sizes.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Sizes.md,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Sizes.lg,
    marginBottom: Sizes.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Sizes.sm,
    letterSpacing: 0.5,
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
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
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
    height: 250,
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
    fontSize: 15,
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
    gap: 6,
    marginBottom: Sizes.xs,
  },
  criticalTitle: {
    color: Colors.error,
    marginBottom: 0,
  },
  criticalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    paddingLeft: Sizes.sm,
    gap: 8,
  },
  criticalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.error,
    marginTop: 7,
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
    paddingVertical: 4,
    gap: 8,
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
    paddingVertical: 6,
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
    paddingVertical: 4,
    gap: 8,
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
    gap: 6,
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

  // New Analysis Display Styles
  patientInfoContainer: {
    gap: Sizes.sm,
  },
  patientInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },

  // Medication Card Styles
  medicationCard: {
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    padding: Sizes.md,
    marginBottom: Sizes.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  medicationName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  medicationScientific: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 24,
    marginBottom: 8,
  },
  medicationDetails: {
    marginTop: 4,
    gap: 4,
  },
  medicationDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingLeft: 8,
  },

  // Test Styles
  testItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
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
    marginTop: 2,
  },

  // Lab Results Styles
  labName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  labGroup: {
    marginTop: Sizes.sm,
  },
  labGroupName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Sizes.xs,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '30',
  },
  labMetricItem: {
    paddingVertical: 8,
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
    marginTop: 2,
  },
  metricStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    marginBottom: Sizes.lg,
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

  // Error UI styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Sizes.xl,
    gap: Sizes.lg,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Sizes.md,
  },
  errorMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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
});
