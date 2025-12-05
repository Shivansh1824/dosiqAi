import { Alert } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';

/**
 * Compresses an image for optimal storage and upload.
 * - Resizes to max width 1000px
 * - Compresses to 0.5 quality (JPEG)
 * - Skips PDF files
 * - Logs compression stats in development
 * 
 * @param uri The URI of the file to compress
 * @returns The URI of the compressed file, or null if compression failed
 */
export const compressImage = async (uri: string): Promise<string | null> => {
    console.log('[Image Compression] Starting compression for:', uri);
    try {
        // Check if file is a PDF (skip compression)
        const isPdf = uri.toLowerCase().endsWith('.pdf');
        if (isPdf) {
            if (__DEV__) {
                console.log('[Image Compression] PDF detected, skipping compression');
            }
            return uri;
        }

        // Get original file size
        let originalSize = 0;
        try {
            const file = new File(uri);
            if (file.exists) {
                originalSize = file.size || 0;
            }
        } catch (error) {
            console.warn('Could not get original file size:', error);
        }

        // Compress and resize image (more aggressive compression)
        const manipulatedImage = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1000 } }], // Max width 1000px for smaller file size
            {
                compress: 0.5, // 50% quality - more aggressive compression
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );

        // Get compressed file size
        let compressedSize = 0;
        try {
            const compressedFile = new File(manipulatedImage.uri);
            if (compressedFile.exists) {
                compressedSize = compressedFile.size || 0;
            }
        } catch (error) {
            console.warn('Could not get compressed file size:', error);
        }

        // Log compression results in debug mode
        if (__DEV__ && originalSize > 0 && compressedSize > 0) {
            const originalMB = (originalSize / (1024 * 1024)).toFixed(2);
            const compressedKB = (compressedSize / 1024).toFixed(0);
            const reduction = (((originalSize - compressedSize) / originalSize) * 100).toFixed(0);
            console.log(
                `[Image Compression] Original: ${originalMB} MB → Compressed: ${compressedKB} KB (${reduction}% reduction)`
            );
        }

        return manipulatedImage.uri;
    } catch (error) {
        console.error('Image compression error:', error);
        Alert.alert(
            'Compression Error',
            'Failed to optimize image. Please try again.'
        );
        return null;
    }
};
