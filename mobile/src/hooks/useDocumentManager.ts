import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { File } from 'expo-file-system';
import { getAbsolutePath, fileExists, deleteLocalFile } from '../utils/fileStorage';
import { useDocumentsStore } from '../store/documentsStore';
import { Document } from '../types/document';

interface UseDocumentManagerProps {
  document?: Document;
  onDeleteSuccess: () => void;
}

export function useDocumentManager({ document, onDeleteSuccess }: UseDocumentManagerProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Directly access store action to avoid full re-renders based on store state updates
  const deleteDocument = useDocumentsStore(state => state.deleteDocument);

  const isPdf = !!document?.local_file_path?.toLowerCase().endsWith('.pdf');

  // Check if file exists locally; if not, sync from R2
  useEffect(() => {
    const checkAndSyncFile = async () => {
      if (!document) return;

      if (document.local_file_path) {
        try {
          console.log('[DocumentManager] Original relative path:', document.local_file_path);

          // Convert relative path to absolute path at runtime
          const absolutePath = getAbsolutePath(document.local_file_path);

          console.log('[DocumentManager] Converted to absolute path:', absolutePath);

          // First check if file exists locally
          const exists = await fileExists(absolutePath);

          if (exists) {
            setImageUri(absolutePath);
            setFileNotFound(false);
            console.log('[DocumentManager] File found and URI set successfully');
          } else {
            // File not found locally - try to sync from R2
            console.log('[DocumentManager] File not found locally, attempting R2 sync...');

            if (document.cloud_file_key) {
              try {
                setDownloading(true);
                console.log('[DocumentManager] Cloud file key available:', document.cloud_file_key);

                // Import dynamically to break potential circular dependencies
                const { getFileWithSync, extractFilename } = await import('../utils/fileSync');
                const filename = extractFilename(document.local_file_path);

                console.log('[DocumentManager] Starting file sync for:', filename);
                const { localPath, wasDownloaded } = await getFileWithSync(filename, document.cloud_file_key);

                if (wasDownloaded) {
                  console.log('[DocumentManager] ✅ File downloaded from R2:', localPath);
                } else {
                  console.log('[DocumentManager] File was already available locally:', localPath);
                }

                setImageUri(localPath);
                setFileNotFound(false);
                setDownloading(false);
              } catch (syncError) {
                console.error('[DocumentManager] R2 sync failed:', syncError);
                setFileNotFound(true);
                setDownloading(false);
              }
            } else {
              // No cloud key available
              setFileNotFound(true);
              console.error('[DocumentManager] File not found at path and no cloud_file_key available:', absolutePath);
            }
          }
        } catch (error) {
          setFileNotFound(true);
          console.error('[DocumentManager] Error checking file:', error);
        }
      } else {
        setFileNotFound(true);
        console.warn('[DocumentManager] No local_file_path provided for document:', document.id);
      }
    };

    checkAndSyncFile();
  }, [document?.local_file_path, document?.cloud_file_key, document?.id]);

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
    if (!document) return;

    try {
      setIsDeleting(true);

      // 1. Delete from Supabase & API wrapper
      await deleteDocument(document.id);

      // 2. Delete from local storage
      if (document.local_file_path) {
        try {
          const absolutePath = getAbsolutePath(document.local_file_path);
          await deleteLocalFile(absolutePath);
          console.log('[DocumentManager] Deleted local file:', absolutePath);
        } catch (e) {
          console.warn('[DocumentManager] Failed to delete local file:', e);
        }
      }

      // 3. Navigate back via callback
      onDeleteSuccess();
    } catch (error) {
      console.error('Error deleting document:', error);
      Alert.alert('Error', 'Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'Document file not found');
      return;
    }

    try {
      setDownloading(true);

      // For PDFs, use sharing since media library doesn't support PDFs natively often
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

      // Create an album for better organization
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

  return {
    imageUri,
    fileNotFound,
    downloading,
    isDeleting,
    isPdf,
    confirmDelete,
    performDelete,
    handleDownload
  };
}
