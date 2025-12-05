import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
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

type DocumentDetailNavigationProp = StackNavigationProp<RootStackParamList, 'Document'>;

interface DocumentDetailScreenProps {
  onBack: () => void;
  document: Document;
  navigation: DocumentDetailNavigationProp;
}

export default function DocumentDetailScreen({ onBack, document, navigation }: DocumentDetailScreenProps) {
  const { familyMembers } = useFamilyMembersStore();
  const { analysisProgress, retryAnalysis } = useDocumentsStore();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Get analysis progress for this document
  const documentProgress = analysisProgress[document.id] || 0;

  // Get family member name
  const familyMember = familyMembers.find(m => m.id === document.family_member_id);
  const patientName = familyMember?.name || 'Unknown';

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
        title: document.title
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

  // Component for displaying analysis results
  const AnalysisResultsDisplay = ({ result }: { result: DocumentAnalysisResult }) => (
    <View style={styles.analysisContent}>
      {/* Summary */}
      {result.summary && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Summary</Text>
          <Text style={styles.analysisText}>{result.summary}</Text>
        </View>
      )}

      {/* Document Type & Date */}
      {(result.documentType || result.documentDate) && (
        <View style={styles.analysisGrid}>
          {result.documentType && (
            <View style={styles.analysisGridItem}>
              <Text style={styles.analysisLabel}>Type</Text>
              <Text style={styles.analysisValue}>{result.documentType}</Text>
            </View>
          )}
          {result.documentDate && (
            <View style={styles.analysisGridItem}>
              <Text style={styles.analysisLabel}>Date</Text>
              <Text style={styles.analysisValue}>{result.documentDate}</Text>
            </View>
          )}
        </View>
      )}

      {/* Critical Findings */}
      {result.criticalFindings && result.criticalFindings.length > 0 && (
        <View style={styles.analysisSection}>
          <View style={styles.criticalHeader}>
            <Feather name="alert-triangle" size={18} color={Colors.error} />
            <Text style={[styles.analysisSectionTitle, styles.criticalTitle]}>
              Critical Findings
            </Text>
          </View>
          {result.criticalFindings.map((finding, index) => (
            <View key={index} style={styles.criticalItem}>
              <View style={styles.criticalDot} />
              <Text style={styles.criticalText}>{finding}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Medications */}
      {result.medications && result.medications.length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Medications</Text>
          {result.medications.map((med: any, index: number) => (
            <View key={index} style={styles.medicationItem}>
              <Feather name="circle" size={6} color={Colors.primary} />
              <Text style={styles.medicationText}>
                {typeof med === 'string' ? med : `${med.name} - ${med.dosage}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Vital Signs */}
      {result.vitalSigns && Object.keys(result.vitalSigns).length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Vital Signs</Text>
          <View style={styles.vitalSignsGrid}>
            {Object.entries(result.vitalSigns).map(([key, value]) => (
              <View key={key} style={styles.vitalSignItem}>
                <Text style={styles.vitalSignLabel}>{key}</Text>
                <Text style={styles.vitalSignValue}>{String(value)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Lab Results */}
      {result.labResults && result.labResults.length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Lab Results</Text>
          {result.labResults.map((lab: any, index: number) => (
            <View key={index} style={styles.labResultItem}>
              <Text style={styles.labResultName}>
                {typeof lab === 'string' ? lab : lab.name}
              </Text>
              {typeof lab === 'object' && lab.value && (
                <Text style={styles.labResultValue}>
                  {lab.value} {lab.unit || ''}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Diagnoses */}
      {result.diagnoses && result.diagnoses.length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Diagnoses</Text>
          {result.diagnoses.map((diagnosis, index) => (
            <View key={index} style={styles.diagnosisItem}>
              <Feather name="circle" size={6} color={Colors.primary} />
              <Text style={styles.diagnosisText}>{diagnosis}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Raw Text Fallback */}
      {result.rawText && !result.summary && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisSectionTitle}>Analysis</Text>
          <Text style={styles.analysisText}>{result.rawText}</Text>
        </View>
      )}
    </View>
  );

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
        <Text style={styles.headerTitle}>{document.title}</Text>
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
              <Text style={styles.detailValue}>{document.type}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Patient</Text>
              <Text style={styles.detailValue}>{patientName}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>File Size</Text>
              <Text style={styles.detailValue}>{formatFileSize(document.file_size)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Storage</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Local</Text>
              </View>
            </View>
          </View>
        </View>

        {/* AI Analysis Card */}
        {document.ai_analysis_status && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>AI Analysis</Text>
              {document.ai_analysis_status === 'completed' && (
                <View style={[styles.statusBadge, styles.statusBadgeSuccess]}>
                  <Feather name="check-circle" size={14} color={Colors.success} />
                  <Text style={[styles.statusText, styles.statusTextSuccess]}>Completed</Text>
                </View>
              )}
              {document.ai_analysis_status === 'processing' && (
                <View style={[styles.statusBadge, styles.statusBadgeProcessing]}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[styles.statusText, styles.statusTextProcessing]}>Processing...</Text>
                </View>
              )}
              {document.ai_analysis_status === 'failed' && (
                <View style={[styles.statusBadge, styles.statusBadgeError]}>
                  <Feather name="alert-circle" size={14} color={Colors.error} />
                  <Text style={[styles.statusText, styles.statusTextError]}>Failed</Text>
                </View>
              )}
            </View>

            {/* Processing Progress */}
            {document.ai_analysis_status === 'processing' && documentProgress > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${documentProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>{documentProgress}%</Text>
              </View>
            )}

            {/* Analysis Results */}
            {document.ai_analysis_status === 'completed' && document.ai_analysis_result && (
              <AnalysisResultsDisplay result={document.ai_analysis_result} />
            )}

            {/* Error State */}
            {document.ai_analysis_status === 'failed' && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorMessage}>
                  {document.ai_analysis_error || 'Analysis failed'}
                </Text>
                {imageUri && (
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => retryAnalysis(document.id, imageUri)}
                  >
                    <Feather name="refresh-cw" size={18} color={Colors.primary} />
                    <Text style={styles.retryButtonText}>Retry Analysis</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Pending State */}
            {document.ai_analysis_status === 'pending' && (
              <View style={styles.pendingContainer}>
                <Feather name="clock" size={32} color={Colors.gray400} />
                <Text style={styles.pendingText}>Analysis pending</Text>
              </View>
            )}
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
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
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
});
