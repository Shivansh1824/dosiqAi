import { useState } from 'react';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { useDocumentsStore } from '../store/documentsStore';
import { deleteLocalFile, getAbsolutePath } from '../utils/fileStorage';
import { Document } from '../types/document';

export function useDocumentActions(document: Document | null | undefined, imageUri: string | null, onBack: () => void) {
    const [showShareModal, setShowShareModal] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const deleteDocument = useDocumentsStore(state => state.deleteDocument);
    const [isDeleting, setIsDeleting] = useState(false);

    const confirmDelete = () => {
        Alert.alert(
            'Delete Document',
            'Are you sure you want to delete this document? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: performDelete },
            ]
        );
    };

    const performDelete = async () => {
        try {
            setIsDeleting(true);

            // 1. Delete from Supabase
            if (document) {
                await deleteDocument(document.id);
            }

            // 2. Delete from local storage
            if (document?.local_file_path) {
                try {
                    const absolutePath = getAbsolutePath(document.local_file_path);
                    await deleteLocalFile(absolutePath);
                    console.log('[useDocumentActions] Deleted local file:', absolutePath);
                } catch (e) {
                    console.warn('[useDocumentActions] Failed to delete local file:', e);
                }
            }

            // 3. Navigate back
            onBack();
        } catch (error) {
            console.error('Error deleting document:', error);
            Alert.alert('Error', 'Failed to delete document');
        } finally {
            setIsDeleting(false);
        }
    };

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

    return {
        showShareModal,
        setShowShareModal,
        showOptionsModal,
        setShowOptionsModal,
        isDeleting,
        confirmDelete,
        handleShare,
        handleShareDocument,
    };
}
