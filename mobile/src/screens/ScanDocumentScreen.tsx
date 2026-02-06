import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, ActionSheetIOS, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Sizes, Typography } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useDocumentsStore } from '../store/documentsStore';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { DocumentType } from '../types/document';
import { compressImage } from '../utils/imageCompression';
import { saveFileLocallyWithUUID, getAbsolutePath } from '../utils/fileStorage';
import { incrementUploadCount } from '../services/documentAnalysisService';
import FilePreviewModal from '../components/FilePreviewModal';

interface ScanDocumentScreenProps {
  onBack: () => void;
}

const { width } = Dimensions.get('window');
const FRAME_WIDTH = width - Sizes.xl * 2;
const FRAME_HEIGHT = FRAME_WIDTH * (4 / 3);

// Removed: No longer uploading to Supabase Storage

export default function ScanDocumentScreen({ onBack }: ScanDocumentScreenProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const { user } = useAuthStore();
  const { addDocument, fetchDocuments, uploadLimit, refreshUploadLimit, triggerAnalysis } = useDocumentsStore();
  const { activeMember, isInitialized } = useFamilyMembersStore();

  // New State for Preview Modal
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; type: 'image' | 'document'; name: string } | null>(null);

  // Load upload limit on mount
  useEffect(() => {
    if (user?.id) {
      refreshUploadLimit(user.id);
    }
  }, [user?.id, refreshUploadLimit]);



  // Request permissions for image picker
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload images.'
      );
      return false;
    }
    return true;
  };

  // Pick image from photo library
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1.0, // Use max quality, we'll compress it ourselves
      });

      if (!result.canceled && result.assets[0]) {
        // Show Preview instead of uploading directly
        setSelectedFile({
          uri: result.assets[0].uri,
          type: 'image',
          name: result.assets[0].fileName || 'Selected Image',
        });
        setPreviewModalVisible(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your camera to take photos.'
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1.0, // Use max quality, we'll compress it ourselves
      });

      if (!result.canceled && result.assets[0]) {
        // Show Preview instead of uploading directly
        setSelectedFile({
          uri: result.assets[0].uri,
          type: 'image',
          name: 'Captured Photo',
        });
        setPreviewModalVisible(true);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Pick document file
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const fileName = result.assets[0].name;

        // Check if it's an image (compress) or PDF (skip compression)
        const isImage = fileName?.toLowerCase().match(/\.(jpg|jpeg|png|heic|webp)$/i);

        // Show Preview instead of uploading directly
        setSelectedFile({
          uri: uri,
          type: isImage ? 'image' : 'document',
          name: fileName,
        });
        setPreviewModalVisible(true);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    const { uri, type, name } = selectedFile;
    const isImage = type === 'image';

    try {
      if (isImage) {
        setIsCompressing(true);
        const compressedUri = await compressImage(uri);
        setIsCompressing(false);

        if (compressedUri) {
          await uploadFile(compressedUri, 'image', name);
        }
      } else {
        await uploadFile(uri, 'document', name);
      }
    } catch (error) {
      console.error('Error in confirm upload:', error);
      setIsCompressing(false);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    } finally {
      setPreviewModalVisible(false);
      setSelectedFile(null);
    }
  };

  // Upload file - saves locally and stores metadata in Supabase
  const uploadFile = async (uri: string, type: 'image' | 'document', fileName?: string, isReportOverride?: boolean) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to upload documents.');
      return;
    }

    if (!isSupabaseConfigured()) {
      Alert.alert('Error', 'Database service not configured.');
      return;
    }

    // DEFENSIVE CHECK: If no active member, auto-create the primary "Self" member
    // This ensures the main user can ALWAYS upload their documents
    let memberForUpload = activeMember;
    if (!memberForUpload) {
      console.log('[ScanDocumentScreen] No active member found, auto-creating primary member...');
      try {
        memberForUpload = await useFamilyMembersStore.getState().ensurePrimaryMemberExists(
          user.id,
          user.name || 'Me'
        );
        console.log('[ScanDocumentScreen] Primary member auto-created:', memberForUpload?.id);
      } catch (error) {
        console.error('[ScanDocumentScreen] Failed to auto-create primary member:', error);
        Alert.alert('Error', 'Failed to set up your profile. Please try again.');
        return;
      }
    }

    // TypeScript type guard - at this point memberForUpload is guaranteed to exist
    if (!memberForUpload) {
      Alert.alert('Error', 'Unable to determine family member for upload.');
      return;
    }

    // Check upload limit
    if (uploadLimit && !uploadLimit.allowed) {
      Alert.alert(
        'Upload Limit Reached',
        `You've reached your daily limit of ${uploadLimit.limit} document uploads. The limit will reset tomorrow.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsUploading(true);

    try {
      // Get file extension from source URI or fileName
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';

      // Save file locally with UUID filename to flat documents folder
      const { filename, relativePath, fileSize, absolutePath, r2UploadPromise } = await saveFileLocallyWithUUID(
        uri,
        extension
      );

      // Determine document type based on extension
      let docType: DocumentType = extension.toLowerCase() === 'pdf' ? 'Report' : 'Imaging';
      
      // If we have an override or if fileName contains "Report"
      const isReport = isReportOverride || fileName?.toLowerCase().includes('report') || extension.toLowerCase() === 'pdf';
      if (isReport) {
        docType = 'Lab Report';
      }

      // Save document metadata to database
      const savedDocument = await addDocument({
        user_id: user.id,
        type: docType,
        local_file_path: relativePath, // "documents/0a83ce65-ac2d.pdf"
        family_member_id: memberForUpload.id,
        color: '', // Will be calculated by store from document type
      });

      // Get the actual document ID from Supabase (UUID)
      const actualDocumentId = savedDocument?.id || filename;
      console.log('[ScanDocument] Document saved with ID:', actualDocumentId);

      // Await R2 upload and save cloud_file_key to database (non-blocking for UI)
      console.log('[ScanDocument] Setting up R2 upload promise handler...');
      console.log('[ScanDocument] Document ID for cloud key update:', actualDocumentId);

      r2UploadPromise
        .then(async (cloudFileKey) => {
          console.log('[ScanDocument] R2 upload promise resolved with key:', cloudFileKey);

          if (cloudFileKey && actualDocumentId) {
            // Use DocumentsStore function which has the correct Supabase context
            const { updateCloudFileKey } = useDocumentsStore.getState();
            const success = await updateCloudFileKey(actualDocumentId, cloudFileKey);

            if (success) {
              console.log('[ScanDocument] ✅ Cloud file key saved via store!');
            } else {
              console.error('[ScanDocument] ❌ Failed to save cloud file key via store');
            }
          } else {
            console.warn('[ScanDocument] Skipping cloud key update - cloudFileKey:', cloudFileKey, 'documentId:', actualDocumentId);
          }
        })
        .catch((error) => {
          console.error('[ScanDocument] R2 upload promise rejected:', error);
        });


      // Increment upload count

      await incrementUploadCount(user.id);

      // Refresh upload limit
      await refreshUploadLimit(user.id);

      // Refresh documents list
      await fetchDocuments(user.id);

      // Get absolute path for analysis
      const analysisPath = absolutePath || getAbsolutePath(relativePath);

      // Show success alert and navigate back
      Alert.alert(
        'Success',
        'Document uploaded successfully! Analyzing...',
        [
          {
            text: 'OK',
            onPress: () => {
              onBack();

              // Trigger analysis in background (non-blocking) with correct document ID
              console.log('[ScanDocument] Triggering analysis for document:', actualDocumentId, 'isReport:', isReport);
              console.log('[ScanDocument] Analysis path:', analysisPath);
              
              triggerAnalysis(actualDocumentId, analysisPath, undefined, isReport).catch((error) => {
                console.error('[ScanDocument] Background analysis failed:', error);
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to save document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Show iOS action sheet for upload options
  const showUploadOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo Library', 'Take Photo or Video', 'Choose Files'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 1:
              pickImage();
              break;
            case 2:
              takePhoto();
              break;
            case 3:
              pickDocument();
              break;
          }
        }
      );
    } else {
      // Android - show Alert with options
      Alert.alert(
        'Upload Document',
        'Choose an option',
        [
          { text: 'Photo Library', onPress: pickImage },
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose Files', onPress: pickDocument },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera Viewfinder (Simulated) */}
      <View style={styles.cameraBackground}>
        <Feather name="camera" size={80} color={Colors.gray700} />
        <Text style={styles.simulationText}>Camera Preview</Text>
      </View>

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onBack}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={24} color={Colors.white} />
          </TouchableOpacity>

          <View style={styles.flashButtonContainer}>
            <TouchableOpacity style={styles.flashButton} activeOpacity={0.6}>
              <Feather name="zap-off" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.6}
          >
            <Feather name="help-circle" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Upload Limit Indicator */}
        {uploadLimit && (
          <View style={styles.uploadLimitContainer}>
            <View style={styles.uploadLimitBadge}>
              <Feather
                name={uploadLimit.allowed ? "check-circle" : "alert-circle"}
                size={16}
                color={uploadLimit.allowed ? Colors.success : Colors.error}
              />
              <Text
                style={[
                  styles.uploadLimitText,
                  !uploadLimit.allowed && styles.uploadLimitTextError,
                ]}
              >
                {uploadLimit.count}/{uploadLimit.limit} uploads today
              </Text>
            </View>
          </View>
        )}

        {/* Frame Guide */}
        <View style={styles.frameContainer}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.helperText}>
            Position document within the frame
          </Text>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.galleryButton}
              activeOpacity={0.7}
              onPress={showUploadOptions}
              disabled={isUploading || isCompressing}
            >
              <Feather name="image" size={24} color={Colors.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureButton}
              activeOpacity={0.8}
              onPress={takePhoto}
              disabled={isUploading || isCompressing}
            >
              <View style={styles.captureOuter}>
                <View style={styles.captureInner} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.galleryButton} activeOpacity={0.7}>
              <View style={styles.docCountBadge}>
                <Text style={styles.docCountText}>0</Text>
              </View>
              <Feather name="layers" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Loading Overlay */}
      {(isUploading || isCompressing) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>
              {isCompressing ? 'Optimizing image...' : 'Uploading document...'}
            </Text>
          </View>
        </View>
      )}

      {/* Preview Modal */}
      <FilePreviewModal
        visible={previewModalVisible}
        fileUri={selectedFile?.uri || null}
        fileType={selectedFile?.type || 'image'}
        fileName={selectedFile?.name || ''}
        onConfirm={handleConfirmUpload}
        onCancel={() => {
          setPreviewModalVisible(false);
          setSelectedFile(null);
        }}
        isUploading={isUploading || isCompressing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  cameraBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1F2937', // Dark gray simulation
    justifyContent: 'center',
    alignItems: 'center',
  },
  simulationText: {
    color: Colors.gray500,
    marginTop: Sizes.md,
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingTop: Sizes.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashButtonContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 4,
  },
  flashButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Upload Limit Indicator
  uploadLimitContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  uploadLimitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: 20,
    gap: 6,
  },
  uploadLimitText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadLimitTextError: {
    color: Colors.error,
  },

  // Frame
  frameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.white,
    borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 24 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 24 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 24 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 24 },

  helperText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
    marginTop: Sizes.xl,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Bottom Controls
  bottomControls: {
    paddingBottom: Sizes.xl,
    paddingHorizontal: Sizes.xl,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  galleryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 84,
    height: 84,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.white,
  },
  docCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.black,
  },
  docCountText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Sizes.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    marginTop: Sizes.md,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
});
