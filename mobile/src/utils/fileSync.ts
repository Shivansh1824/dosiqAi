/**
 * File Sync Utility for Offline-First Document Access
 * 
 * Provides intelligent file retrieval that:
 * 1. Checks local storage first (fast, works offline)
 * 2. Downloads from R2 if file is missing locally
 * 3. Saves downloaded files locally for future use
 * 
 * This enables seamless sync across devices and recovery after cache clearing.
 */

import { File, Directory, Paths } from 'expo-file-system';
import { getPresignedUrl } from '../services/storageService';
import { Buffer } from 'buffer';

const APP_FOLDER = 'dosiqAi';
const DOCS_FOLDER = 'documents';

export interface FileRetrievalResult {
    localPath: string;
    wasDownloaded: boolean;
}

/**
 * Get the documents directory path
 */
const getDocumentsDirectory = async (): Promise<string> => {
    if (!Paths.document) {
        throw new Error('Document directory is not available');
    }

    const appDir = new Directory(Paths.document, APP_FOLDER);
    if (!appDir.exists) {
        await appDir.create();
    }

    const docsDir = new Directory(appDir.uri, DOCS_FOLDER);
    if (!docsDir.exists) {
        await docsDir.create();
    }

    return docsDir.uri;
};

/**
 * Get a file, downloading from R2 if not available locally
 * 
 * This is the primary function for accessing document files in the app.
 * It implements an offline-first strategy:
 * - If the file exists locally, it returns immediately (no network call)
 * - If the file is missing, it downloads from R2 and saves locally
 * 
 * @param filename - The UUID-based filename (e.g., 'abc-123.pdf')
 * @param cloudFileKey - The full R2 object key (e.g., 'users/id/documents/abc-123.pdf')
 * @returns Object containing localPath and whether file was downloaded
 * @throws Error if file cannot be retrieved from either source
 */
export const getFileWithSync = async (
    filename: string,
    cloudFileKey: string | null
): Promise<FileRetrievalResult> => {
    try {
        // 1. Get the documents directory
        const docsDirPath = await getDocumentsDirectory();

        // 2. Construct local file path
        const localPath = docsDirPath.endsWith('/')
            ? `${docsDirPath}${filename}`
            : `${docsDirPath}/${filename}`;

        const localFile = new File(localPath);

        // 3. Check if file exists locally
        if (localFile.exists) {
            console.log('[FileSync] File found locally:', filename);
            return { localPath, wasDownloaded: false };
        }

        // 4. File not found locally - try to download from R2
        if (!cloudFileKey) {
            throw new Error(`File "${filename}" not available locally and no cloud key provided`);
        }

        console.log('[FileSync] File not found locally, downloading from R2:', cloudFileKey);

        // 5. Get a temporary presigned URL (5 minute expiry)
        const downloadUrl = await getPresignedUrl(cloudFileKey, 300);

        // 6. Download the file
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Failed to download file from R2: HTTP ${response.status}`);
        }

        // 7. Convert response to base64 and save locally
        const arrayBuffer = await response.arrayBuffer();
        const base64Content = Buffer.from(arrayBuffer).toString('base64');

        // 8. Create the file and write content
        await localFile.create();
        await localFile.write(base64Content, { encoding: 'base64' });

        console.log('[FileSync] File downloaded and saved locally:', filename);
        return { localPath, wasDownloaded: true };

    } catch (error) {
        console.error('[FileSync] Error retrieving file:', error);
        throw error;
    }
};

/**
 * Check if a file is available locally (without downloading)
 * 
 * Use this for UI indicators showing sync status.
 * 
 * @param filename - The UUID-based filename
 * @returns true if file exists locally, false otherwise
 */
export const isFileAvailableLocally = async (filename: string): Promise<boolean> => {
    try {
        const docsDirPath = await getDocumentsDirectory();
        const localPath = docsDirPath.endsWith('/')
            ? `${docsDirPath}${filename}`
            : `${docsDirPath}/${filename}`;

        const localFile = new File(localPath);
        return localFile.exists;
    } catch (error) {
        console.error('[FileSync] Error checking file availability:', error);
        return false;
    }
};

/**
 * Extract filename from a local_file_path or cloud_file_key
 * 
 * @param path - Path like "dosiqAi/documents/abc.pdf" or "users/id/documents/abc.pdf"
 * @returns Just the filename: "abc.pdf"
 */
export const extractFilename = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
};

/**
 * Sync a batch of files from R2 to local storage
 * 
 * Use this for background sync operations.
 * 
 * @param files - Array of {filename, cloudFileKey} pairs
 * @returns Object with counts of synced vs already-present files
 */
export const syncFilesFromCloud = async (
    files: Array<{ filename: string; cloudFileKey: string | null }>
): Promise<{ synced: number; skipped: number; failed: number }> => {
    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
        try {
            const result = await getFileWithSync(file.filename, file.cloudFileKey);
            if (result.wasDownloaded) {
                synced++;
            } else {
                skipped++; // Already had locally
            }
        } catch (error) {
            console.error(`[FileSync] Failed to sync ${file.filename}:`, error);
            failed++;
        }
    }

    console.log(`[FileSync] Batch sync complete: ${synced} synced, ${skipped} skipped, ${failed} failed`);
    return { synced, skipped, failed };
};
