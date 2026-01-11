/**
 * Cloudflare R2 Storage Service
 * 
 * Handles file uploads, downloads, and URL generation for Cloudflare R2 (S3-compatible storage).
 * Uses the AWS SDK v3 for S3 operations.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { Buffer } from 'buffer';

// R2 Configuration from environment variables
const R2_CONFIG = {
    accessKeyId: Constants.expoConfig?.extra?.R2_ACCESS_KEY_ID || '',
    secretAccessKey: Constants.expoConfig?.extra?.R2_SECRET_ACCESS_KEY || '',
    endpoint: Constants.expoConfig?.extra?.R2_ENDPOINT || '',
    bucketName: Constants.expoConfig?.extra?.R2_BUCKET_NAME || '',
};

// Debug: Log R2 configuration on module load
console.log('[R2Storage] Module loaded, config:', {
    hasAccessKey: !!R2_CONFIG.accessKeyId,
    hasSecretKey: !!R2_CONFIG.secretAccessKey,
    hasEndpoint: !!R2_CONFIG.endpoint,
    hasBucket: !!R2_CONFIG.bucketName,
    endpoint: R2_CONFIG.endpoint.substring(0, 30) + '...',
    bucket: R2_CONFIG.bucketName,
});

// Initialize S3 client for R2
const s3Client = new S3Client({
    region: 'auto', // R2 uses 'auto' as the region
    endpoint: R2_CONFIG.endpoint,
    credentials: {
        accessKeyId: R2_CONFIG.accessKeyId,
        secretAccessKey: R2_CONFIG.secretAccessKey,
    },
});

/**
 * Check if R2 is properly configured
 */
export const isR2Configured = (): boolean => {
    const isConfigured = !!(
        R2_CONFIG.accessKeyId &&
        R2_CONFIG.secretAccessKey &&
        R2_CONFIG.endpoint &&
        R2_CONFIG.bucketName
    );

    if (!isConfigured) {
        console.warn('[R2Storage] R2 is not configured. Please check your environment variables.');
    }

    return isConfigured;
};

/**
 * Upload a file to Cloudflare R2
 * 
 * @param localFilePath - Local file path (file:// URI)
 * @param fileName - Desired file name in the bucket
 * @param userId - User ID for organizing files
 * @returns The R2 key (path) of the uploaded file
 */
export const uploadFileToR2 = async (
    localFilePath: string,
    fileName: string,
    userId: string
): Promise<string> => {
    if (!isR2Configured()) {
        throw new Error('R2 storage is not configured');
    }

    try {
        console.log('[R2Storage] Uploading file:', fileName);

        // Ensure path has file:// protocol
        const uri = localFilePath.startsWith('file://') ? localFilePath : `file://${localFilePath}`;

        // Read file as binary using expo-file-system
        const file = new File(uri);

        if (!file.exists) {
            throw new Error(`File not found: ${uri}`);
        }

        // Read file as base64 and convert to buffer
        const base64Content = await file.base64();
        const buffer = Buffer.from(base64Content, 'base64');

        // Determine content type from file extension
        const contentType = getContentType(fileName);

        // Create unique key for the file (organized by user)
        const fileKey = `users/${userId}/documents/${fileName}`;

        // Upload to R2
        const command = new PutObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: fileKey,
            Body: buffer,
            ContentType: contentType,
        });

        await s3Client.send(command);

        console.log('[R2Storage] File uploaded successfully:', fileKey);
        return fileKey;
    } catch (error) {
        console.error('[R2Storage] Upload error:', error);
        throw new Error('Failed to upload file to R2 storage');
    }
};

/**
 * Generate a presigned URL for viewing a file
 * 
 * @param fileKey - The R2 key of the file
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL that can be used to access the file
 */
export const getPresignedUrl = async (
    fileKey: string,
    expiresIn: number = 3600
): Promise<string> => {
    if (!isR2Configured()) {
        throw new Error('R2 storage is not configured');
    }

    try {
        const command = new GetObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: fileKey,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn });
        console.log('[R2Storage] Generated presigned URL for:', fileKey);
        return url;
    } catch (error) {
        console.error('[R2Storage] Error generating presigned URL:', error);
        throw new Error('Failed to generate file URL');
    }
};

/**
 * Delete a file from R2
 * 
 * @param fileKey - The R2 key of the file to delete
 */
export const deleteFileFromR2 = async (fileKey: string): Promise<void> => {
    if (!isR2Configured()) {
        throw new Error('R2 storage is not configured');
    }

    try {
        console.log('[R2Storage] Deleting file:', fileKey);

        const command = new DeleteObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: fileKey,
        });

        await s3Client.send(command);
        console.log('[R2Storage] File deleted successfully:', fileKey);
    } catch (error) {
        console.error('[R2Storage] Delete error:', error);
        throw new Error('Failed to delete file from R2 storage');
    }
};

/**
 * Delete all files for a user from R2 using prefix Listing
 * This ensures even orphaned files are removed.
 * 
 * @param userId - The user ID whose folder users/{userId}/ should be wiped
 */
export const deleteUserFilesFromR2 = async (userId: string): Promise<void> => {
    if (!isR2Configured()) {
        throw new Error('R2 storage is not configured');
    }

    if (!userId || userId.trim() === '') {
        throw new Error('User ID is required for deletion safety.');
    }

    try {
        const userPrefix = `users/${userId}/`;
        console.log('[R2Storage] Deleting all files with prefix:', userPrefix);

        // 1. List all objects with this prefix
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_CONFIG.bucketName,
            Prefix: userPrefix,
        });

        const listResult = await s3Client.send(listCommand);

        if (!listResult.Contents || listResult.Contents.length === 0) {
            console.log('[R2Storage] No files found for user in R2.');
            return;
        }

        console.log(`[R2Storage] Found ${listResult.Contents.length} files to delete.`);

        // 2. Prepare delete objects command
        const objectsToDelete = listResult.Contents.map(obj => ({ Key: obj.Key }));

        const deleteCommand = new DeleteObjectsCommand({
            Bucket: R2_CONFIG.bucketName,
            Delete: {
                Objects: objectsToDelete,
                Quiet: false,
            },
        });

        const deleteResult = await s3Client.send(deleteCommand);
        console.log(`[R2Storage] Successfully deleted ${deleteResult.Deleted?.length || 0} files.`);

        // Check for truncation (if > 1000 files, we need to loop)
        // For individual users, >1000 files is rare, but good to note.
        if (listResult.IsTruncated) {
            console.log('[R2Storage] Warning: More files exist. Recursive deletion recommended for production scaling.');
            // In a robust production environment, you would recursively call this until IsTruncated is false.
            // For now, doing one pass is significantly better than DB-only deletion.
            await deleteUserFilesFromR2(userId);
        }

    } catch (error) {
        console.error('[R2Storage] Bulk delete error:', error);
        throw new Error('Failed to delete user files from R2 storage');
    }
};

/**
 * Determine content type from file extension
 */
const getContentType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();

    switch (extension) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'pdf':
            return 'application/pdf';
        case 'heic':
        case 'heif':
            return 'image/heic';
        default:
            return 'application/octet-stream';
    }
};
