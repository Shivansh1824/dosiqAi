import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { fileExists, getAbsolutePath } from '../utils/fileStorage';

export const useDocumentFile = (
    document: any | undefined,
    navigation: any,
    titleText: string
) => {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [fileNotFound, setFileNotFound] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [showFullScreenImage, setShowFullScreenImage] = useState(false);

    const isPdf = document?.local_file_path?.toLowerCase().endsWith('.pdf');

    // Check if file exists locally; if not, sync from R2
    useEffect(() => {
        const checkAndSyncFile = async () => {
            if (!document || !document.local_file_path) {
                setFileNotFound(true);
                return;
            }

            try {
                const absolutePath = getAbsolutePath(document.local_file_path);

                const exists = await fileExists(absolutePath);

                if (exists) {
                    setImageUri(absolutePath);
                    setFileNotFound(false);
                } else {
                    if (document.cloud_file_key) {
                        try {
                            setDownloading(true);
                            const { getFileWithSync, extractFilename } = await import('../utils/fileSync');
                            const filename = extractFilename(document.local_file_path);

                            const { localPath } = await getFileWithSync(filename, document.cloud_file_key);

                            setImageUri(localPath);
                            setFileNotFound(false);
                        } catch (syncError) {
                            setFileNotFound(true);
                        } finally {
                            setDownloading(false);
                        }
                    } else {
                        setFileNotFound(true);
                    }
                }
            } catch (error) {
                setFileNotFound(true);
            }
        };

        checkAndSyncFile();
    }, [document?.local_file_path, document?.cloud_file_key]);

    // Handle view full document
    const handleViewFullDocument = () => {
        if (!imageUri) {
            Alert.alert('Error', 'Document file not found');
            return;
        }

        if (isPdf) {
            navigation.navigate('PdfViewer', {
                uri: imageUri,
                title: titleText,
            });
        } else {
            setShowFullScreenImage(true);
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

            if (isPdf) {
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                    await Sharing.shareAsync(imageUri, {
                        UTI: 'com.adobe.pdf',
                        mimeType: 'application/pdf',
                        dialogTitle: 'Save PDF Document',
                    });
                } else {
                    Alert.alert('Error', 'Sharing is not available on this device');
                }
                return;
            }

            const { status } = await MediaLibrary.requestPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Please grant permission to save images to your photo library.'
                );
                return;
            }

            const asset = await MediaLibrary.createAssetAsync(imageUri);
            const albumName = 'FamilyCareHealth';
            const album = await MediaLibrary.getAlbumAsync(albumName);

            if (album) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            } else {
                await MediaLibrary.createAlbumAsync(albumName, asset, false);
            }

            Alert.alert('Success', 'File successfully saved to your photo library.');
        } catch (error) {
            Alert.alert('Error', 'Failed to save document processing the image download');
        } finally {
            setDownloading(false);
        }
    };

    return {
        imageUri,
        fileNotFound,
        downloading,
        isPdf,
        showFullScreenImage,
        setShowFullScreenImage,
        handleViewFullDocument,
        handleDownload,
    };
};
