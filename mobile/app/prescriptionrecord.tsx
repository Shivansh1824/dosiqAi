import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Typography } from '../src/constants';
import { Document, DocumentAnalysisResult } from '../src/types/document';
import { fileExists, getAbsolutePath } from '../src/utils/fileStorage';
import { useFamilyMembersStore } from '../src/store/familyMembersStore';
import { useDocumentsStore } from '../src/store/documentsStore';
import { useMedicationsStore } from '../src/store/medicationsStore';
import { useAuthStore } from '../src/store/authStore';
import { parseAIMedication } from '../src/utils/medicationParser';
import { useAnalysisPDF } from '../src/hooks/useAnalysisPDF';
import LoadingOverlay from '../src/components/LoadingOverlay';
import ShareModal from '../src/components/ShareModal';
import DocumentOptionsModal from '../src/components/DocumentOptionsModal';
import { PrescriptionRecordSummary, MedicationRecordCard, RecordMetadataCard, RecordGroupedTestsCard, RecordDocumentPreviewLoading } from '../src/components/record';

import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import Pdf from 'react-native-pdf';
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import FullScreenImageModal from '../src/components/FullScreenImageModal';

type PrescriptionRecordNavigationProp = StackNavigationProp<any, 'PrescriptionRecord'>;

interface PrescriptionRecordScreenProps {
  onBack: () => void;
  document?: Document;
  documentId?: string;
  navigation: PrescriptionRecordNavigationProp;
}

export default function PrescriptionRecordScreen({ onBack, document: documentProp, documentId, navigation }: PrescriptionRecordScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paramDocumentId = params.documentId as string;

  const { familyMembers } = useFamilyMembersStore();
  const { documents, deleteDocument } = useDocumentsStore();
  const { medications } = useMedicationsStore();
  const { user } = useAuthStore();

  console.log('🐞 [DIAGNOSTICS] PrescriptionRecordScreen Params:', { documentIdProp: documentId, paramDocumentId, hasDocumentProp: !!documentProp, documentsInStore: documents.length });

  const handleBack = onBack || (() => { router.back(); });

  // Resolve document
  const document = useMemo(() => {
    if (documentProp) return documentProp;
    const effectiveDocumentId = documentId || paramDocumentId;
    let foundDoc = undefined;
    if (effectiveDocumentId) {
      foundDoc = documents.find(d => d.id === effectiveDocumentId);
    }
    console.log('🐞 [DIAGNOSTICS] Resolved initialDocument Record:', { effectiveDocumentId, foundDocExists: !!foundDoc });
    return foundDoc;
  }, [documentProp, documentId, paramDocumentId, documents]);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);


  // Detect document type
  const documentType = useMemo(() => {
    const type = document?.ai_analysis_result?.document_type?.toLowerCase();
    if (type === 'prescription') return 'prescription';
    return 'other';
  }, [document?.ai_analysis_result]);

  // Family member
  const familyMember = useMemo(() => {
    return (document && familyMembers.find(m => m.id === document.family_member_id)) || undefined;
  }, [document?.family_member_id, familyMembers]);

  // Title Logic
  const analysis = document?.ai_analysis_result;
  const { titleText, subtitleText } = useMemo(() => {
    if (!document) return { titleText: 'Medical Document', subtitleText: '' };

    let title = document.local_file_path?.split('/').pop() || 'Medical Document';
    let subtitle = '';

    if (analysis) {
      if (analysis.document_type === 'prescription' && analysis.diagnosis?.condition) {
        title = `${analysis.diagnosis?.condition} Prescription`;
      } else if (analysis.document_type) {
        title = (analysis.document_type === 'invalid' ? 'Unrecognized Document' : analysis.document_type)
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      } else if (analysis.file_name) {
        title = analysis.file_name;
      }

      const parts = [];
      if (analysis.patient?.name) parts.push(analysis.patient.name);
      if (analysis.visit_date) parts.push(analysis.visit_date);
      subtitle = parts.join(' • ');
    }

    return { titleText: title, subtitleText: subtitle };
  }, [document, analysis]);

  const displayTitle = titleText;

  // File sync logic
  useEffect(() => {
    const checkFile = async () => {

      if (!document?.local_file_path) {
        setFileNotFound(true);
        return;
      }

      try {
        const absolutePath = getAbsolutePath(document.local_file_path);
        const exists = await fileExists(absolutePath);

        if (exists) {
          setImageUri(absolutePath);
          setFileNotFound(false);
        } else if (document.cloud_file_key) {
          try {
            setDownloading(true);
            const { getFileWithSync, extractFilename } = await import('../src/utils/fileSync');
            const filename = extractFilename(document.local_file_path);
            const { localPath } = await getFileWithSync(filename, document.cloud_file_key);
            setImageUri(localPath);
            setFileNotFound(false);
            setDownloading(false);
          } catch (err) {
            console.error('[PrescriptionRecord] Sync failed:', err);
            setFileNotFound(true);
            setDownloading(false);
          }
        } else {
          setFileNotFound(true);
        }
      } catch (err) {
        setFileNotFound(true);
        console.error('[PrescriptionRecord] Error checking file:', err);
      }
    };

    checkFile();
  }, [document]);



  // PDF share helper
  const { isGenerating: isGeneratingAnalysis, generateAndShare: handleShareAnalysis } = useAnalysisPDF({
    analysis: document?.ai_analysis_result,
    documentType,
    imageUri,
    displayTitle
  });

  if (!document) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document Error</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>Document Not Found</Text>
          <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isPdf = document.local_file_path?.toLowerCase().endsWith('.pdf');

  const handleViewFullDocument = () => {
    if (!imageUri) return;
    if (isPdf) {
      router.push({ pathname: '/pdfviewer', params: { uri: imageUri, title: displayTitle } });
    } else {
      setShowFullScreenImage(true);
    }
  };

  const handleDownload = async () => {
    if (!imageUri) return;
    try {
      setDownloading(true);
      if (isPdf) {
        await Sharing.shareAsync(imageUri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(imageUri);
          const album = await MediaLibrary.getAlbumAsync('dosiqAi');
          if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          else await MediaLibrary.createAlbumAsync('dosiqAi', asset, false);
          Alert.alert('Download Complete', 'Image saved to Photos');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const performDelete = async () => {
    try {
      setLoading(true);
      await deleteDocument(document.id);
      handleBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to delete document');
    } finally {
      setLoading(false);
    }
  };

  const handleShareDocument = async () => {
    if (!imageUri) return;
    try {
      await Sharing.shareAsync(imageUri);
    } catch (err) {
      console.error(err);
    }
  };

  const innerMedicines = analysis?.medicines || [];
  const getSummary = (res?: DocumentAnalysisResult) => res?.summary;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#EFF6FF', '#F1F5F9', '#F1F5F9']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.container} edges={['top']}>

        {/* Modern Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack} activeOpacity={0.6}>
            <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{titleText}</Text>
            {subtitleText ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitleText}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={styles.headerButton} onPress={() => setShowShareModal(true)} activeOpacity={0.6}>
              <Feather name="share-2" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => setShowOptionsModal(true)} activeOpacity={0.6}>
              <Feather name="more-horizontal" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Document Preview (Standard UI) */}
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
                />
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
            ) : imageUri ? (
              <View>
                <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
                <View style={styles.heroOverlay} />
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
            ) : (
              <RecordDocumentPreviewLoading />
            )}
          </View>

          {/* AI Analysis Sections */}
          {document.ai_analysis_status === 'completed' && (
            <>
              {/* Prescription Metadata Card */}
              {analysis && (
                <RecordMetadataCard
                  patientName={analysis.patient?.name ?? undefined}
                  patientAge={analysis.patient?.age ?? undefined}
                  patientGender={analysis.patient?.gender ?? undefined}
                  doctorName={analysis.doctor?.name ?? undefined}
                  hospitalName={analysis.doctor?.hospital_name ?? undefined}
                  visitDate={analysis.visit_date ?? undefined}
                  followUpDate={undefined}
                  followUpDays={analysis.follow_up_days ?? undefined}
                  diagnosis={analysis.diagnosis?.condition ?? undefined}
                />
              )}

              {/* AI Summary Section */}
              {getSummary(analysis) && (
                <PrescriptionRecordSummary
                  summary={getSummary(analysis)!}
                  recommendedTests={analysis?.advised_tests}
                  otherInformation={analysis?.additional_notes?.map(note => ({ value: note.text, category: note.type }))}
                  style={{ marginBottom: 0 }}
                  defaultExpanded={true}
                  followUp={{ follow_up_days: analysis?.follow_up_days ?? undefined }}
                />
              )}

              {/* Medications Section (using original card in read-only mode) */}
              {innerMedicines.length > 0 && (
                <View style={styles.medicationsCard}>
                  <View style={styles.medsHeader}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.medsSectionTitle}>MEDS DETECTED</Text>
                      <Text style={styles.medsSectionSubtitle}>
                        {innerMedicines.length} {innerMedicines.length === 1 ? 'medication is' : 'medications are'} identified from your prescription
                      </Text>
                    </View>
                    <View style={styles.medsCountBadge}>
                      <Text style={styles.medsCountText}>{innerMedicines.length}</Text>
                    </View>
                  </View>

                  <View>
                    {innerMedicines.map((medicine: any, index: number) => {
                      const parsedMed = parseAIMedication(medicine, document.id, displayTitle, familyMember);
                      return (
                        <MedicationRecordCard
                          key={index}
                          medication={parsedMed}
                          documentId={document.id}
                          documentTitle={displayTitle}
                          suggestedStartDate={document.visit_date || document.ai_analyzed_at || new Date().toISOString()}
                          familyMember={familyMember}
                          confidenceScore={analysis?.metadata?.confidence_score}
                          index={index}
                        />
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Advised Tests Section */}
              {(analysis?.advised_tests?.[0]) && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Advised Tests</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    Recommended lab tests and investigations
                  </Text>
                  <View style={{ gap: 12, marginTop: 12 }}>
                    <RecordGroupedTestsCard tests={analysis?.advised_tests || []} />
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Modals */}
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          documentType={documentType}
          onShareDocument={handleShareDocument}
          onShareAnalysis={handleShareAnalysis}
        />

        <DocumentOptionsModal
          visible={showOptionsModal}
          onClose={() => setShowOptionsModal(false)}
          onDelete={() => Alert.alert('Delete', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Delete', onPress: performDelete, style: 'destructive' }])}
        />

        {imageUri && (
          <FullScreenImageModal
            visible={showFullScreenImage}
            imageUri={imageUri}
            onClose={() => setShowFullScreenImage(false)}
          />
        )}

        <LoadingOverlay visible={isGeneratingAnalysis} message="Preparing health analysis..." />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
  headerButton: {
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
    paddingHorizontal: 0,
    paddingTop: 0,
  },

  // Hero Preview Card
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 0,
    marginBottom: 0,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
    width: '100%',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 208,
    backgroundColor: Colors.gray50,
  },
  pdfPreviewWrapper: {
    width: '100%',
    height: 208,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  pdfPreview: {
    flex: 1,
  },
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray200,
    gap: 6,
    shadowColor: Colors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 44,
  },
  actionIconCircle: {
    width: 32,
    height: 32,
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
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.02)', // Subtle overlay
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
  errorText: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // Cards
  card: {
    backgroundColor: Colors.bgSecondary,
    padding: 16,
    marginBottom: 0,
  },
  cardHeader: {
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.gray500,
  },
  medicationsCard: {
    backgroundColor: 'transparent',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  medsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  medsSectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.gray900,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  medsSectionSubtitle: {
    fontSize: 14,
    color: Colors.gray500,
    lineHeight: 20,
    marginTop: 4,
  },
  medsCountBadge: {
    backgroundColor: Colors.primary,
    minWidth: 34,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  medsCountText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.white,

  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginVertical: 16,
  },
  errorButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
});
