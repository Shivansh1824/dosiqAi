import { File, Directory, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { uploadFileToR2 } from '../services/storageService';
import { useAuthStore } from '../store/authStore';

/**
 * Local file storage utility for offline-first document management
 * Files are stored in: {DocumentDirectory}/dosiqAi/documents/
 * All files use UUID-based filenames for uniqueness and consistency
 */

const APP_FOLDER_NAME = 'dosiqAi';
const DOCUMENTS_FOLDER_NAME = 'documents';

/**
 * Get the base dosiqAi directory path
 */
export const getAppDirectory = async (): Promise<string> => {
    // Use Paths.document for the document directory in new API
    if (!Paths.document) {
        throw new Error('Document directory is not available');
    }

    // Create Directory object for app folder
    const appDir = new Directory(Paths.document, APP_FOLDER_NAME);

    // Check existence and create if needed (synchronous property access)
    if (!appDir.exists) {
        await appDir.create();
        console.log('[FileStorage] Created app directory:', appDir.uri);
    }

    return appDir.uri;
};

/**
 * Get the flat documents directory path (dosiqAi/documents/)
 * This is the new storage location for all documents using UUID filenames
 */
export const getDocumentsDirectory = async (): Promise<string> => {
    const appDirPath = await getAppDirectory();
    const docsDir = new Directory(appDirPath, DOCUMENTS_FOLDER_NAME);

    if (!docsDir.exists) {
        await docsDir.create();
        console.log('[FileStorage] Created documents directory:', docsDir.uri);
    }

    return docsDir.uri;
};

/**
 * Generate a unique filename using UUID v4
 * @param extension - File extension (e.g., 'pdf', 'jpg')
 * @returns UUID-based filename (e.g., '0a83ce65-ac2d-46c5-ac40-53b030987bc6.pdf')
 */
export const generateUniqueFilename = (extension: string): string => {
    const uuid = Crypto.randomUUID();
    const cleanExtension = extension.replace(/^\./, '').toLowerCase();
    return `${uuid}.${cleanExtension}`;
};

/**
 * Log R2 upload status to a debug file
 * @param success - Whether upload was successful
 * @param fileName - Name of the file
 * @param message - Additional details
 */
export const logR2Status = async (success: boolean, fileName: string, message: string) => {
    try {
        const docsDirPath = await getDocumentsDirectory();
        const destinationUri = docsDirPath.endsWith('/') ? `${docsDirPath}r2_debug_log.txt` : `${docsDirPath}/r2_debug_log.txt`;
        const logFile = new File(destinationUri);

        const timestamp = new Date().toISOString();
        const status = success ? 'SUCCESS' : 'FAILURE';
        const logEntry = `[${timestamp}] ${status} - File: ${fileName} - ${message}\n`;

        if (logFile.exists) {
            const currentContent = await logFile.text();
            await logFile.write(currentContent + logEntry);
        } else {
            await logFile.create();
            await logFile.write(logEntry);
        }

        console.log(`[R2Storage] Debug log updated: ${status} - ${fileName}`);
    } catch (error) {
        console.error('[R2Storage] Failed to write debug log:', error);
    }
};



/**
 * Save a file to local storage using UUID-based filename in flat documents folder
 * This is the PRIMARY function for new document uploads
 * @param sourceUri - URI of the file to save (from camera/picker)
 * @param extension - File extension (e.g., 'pdf', 'jpg')
 * @returns Object with filename (UUID), absolute path, relative path, file size, and R2 upload promise
 */
export const saveFileLocallyWithUUID = async (
    sourceUri: string,
    extension: string
): Promise<{
    filename: string;
    absolutePath: string;
    relativePath: string;
    fileSize: number;
    startR2Upload: () => Promise<string | null>;
}> => {
    try {
        const docsDirPath = await getDocumentsDirectory();

        // Generate UUID-based filename
        const filename = generateUniqueFilename(extension);

        // Create File objects for source and destination
        const sourceFile = new File(sourceUri);
        const destinationUri = docsDirPath.endsWith('/') ? docsDirPath + filename : `${docsDirPath}/${filename}`;
        const destinationFile = new File(destinationUri);

        // Copy file using new API
        await sourceFile.copy(destinationFile);

        // Get file size using synchronous property
        const fileSize = destinationFile.size || 0;

        // Get both absolute and relative paths
        const absolutePath = destinationFile.uri;
        const relativePath = getRelativePath(absolutePath);

        console.log(`[FileStorage] Saved file with UUID: ${filename} (${(fileSize / 1024).toFixed(2)} KB)`);
        console.log(`[FileStorage] Relative path: ${relativePath}`);

        // R2 Upload Integration - Returns a deferred function (NOT an IIFE)
        // The caller controls when the upload starts to avoid network contention
        // with concurrent Database operations.
        const startR2Upload = (): Promise<string | null> => {
            return (async (): Promise<string | null> => {
                try {
                    // Get current user ID
                    const user = useAuthStore.getState().user;
                    const userId = user?.id;

                    if (userId) {
                        console.log('[FileStorage] Triggering R2 upload for:', filename);
                        const cloudFileKey = await uploadFileToR2(absolutePath, filename, userId);
                        await logR2Status(true, filename, `Uploaded successfully for user ${userId}`);
                        console.log('[FileStorage] R2 upload complete, cloud key:', cloudFileKey);
                        return cloudFileKey;
                    } else {
                        console.warn('[FileStorage] User not logged in, skipping R2 upload');
                        await logR2Status(false, filename, 'Skipped - User not logged in');
                        return null;
                    }
                } catch (error) {
                    console.error('[FileStorage] R2 Background Upload Failed:', error);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    await logR2Status(false, filename, `Upload failed: ${errorMessage}`);
                    return null;
                }
            })();
        };

        return {
            filename,
            absolutePath,
            relativePath,
            fileSize,
            startR2Upload
        };
    } catch (error) {
        console.error('[FileStorage] Error saving file with UUID:', error);
        throw new Error('Failed to save file locally');
    }
};


/**
 * Delete a file from local storage
 * @param localPath - Local file path to delete
 */
export const deleteLocalFile = async (localPath: string): Promise<void> => {
    try {
        const file = new File(localPath);
        if (file.exists) {
            await file.delete();
            console.log('[FileStorage] Deleted file:', localPath);
        }
    } catch (error) {
        console.error('[FileStorage] Error deleting file:', error);
        throw new Error('Failed to delete file');
    }
};

/**
 * Check if a file exists at the given path
 * @param localPath - Local file path to check
 */
export const fileExists = async (localPath: string): Promise<boolean> => {
    try {
        const file = new File(localPath);
        return file.exists; // Synchronous property access
    } catch (error) {
        console.error('[FileStorage] Error checking file existence:', error);
        return false;
    }
};

/**
 * Get file size in bytes
 * @param localPath - Local file path
 */
export const getFileSize = async (localPath: string): Promise<number> => {
    try {
        const file = new File(localPath);
        return file.size || 0; // Synchronous property access
    } catch (error) {
        console.error('[FileStorage] Error getting file size:', error);
        return 0;
    }
};

/**
 * Convert absolute file URI to relative path (from Documents directory)
 * This ensures paths remain valid across app rebuilds when container IDs change
 * @param absoluteUri - Absolute file URI (e.g., file:///path/to/Documents/dosiqAi/...)
 * @returns Relative path from Documents directory (e.g., dosiqAi/...)
 */
export const getRelativePath = (absoluteUri: string): string => {
    if (!Paths.document) {
        throw new Error('Document directory is not available');
    }

    // Remove the document directory prefix to get relative path
    const docPath = Paths.document.uri;
    if (absoluteUri.startsWith(docPath)) {
        return absoluteUri.substring(docPath.length).replace(/^\//, '');
    }

    // If it's already a relative path, return as is
    return absoluteUri;
};

/**
 * Convert relative path to absolute file URI
 * This reconstructs the full path at runtime using the current container location
 * @param relativePath - Relative path from Documents directory (e.g., dosiqAi/...)
 * @returns Absolute file URI (e.g., file:///current/path/to/Documents/dosiqAi/...)
 */
export const getAbsolutePath = (relativePath: string): string => {
    if (!Paths.document) {
        throw new Error('Document directory is not available');
    }

    // If it's already an absolute path (starts with file://), return as is
    if (relativePath.startsWith('file://')) {
        console.log('[FileStorage] Path already absolute:', relativePath);
        return relativePath;
    }

    // Get the document directory URI (should already include file://)
    const docPath = Paths.document.uri;

    // Log for debugging
    console.log('[FileStorage] Document base path:', docPath);
    console.log('[FileStorage] Relative path:', relativePath);

    // Validate docPath has file:// protocol
    if (!docPath.startsWith('file://')) {
        console.error('[FileStorage] WARNING: Document path missing file:// protocol:', docPath);
        // If missing, we'll try to construct it anyway and validate at the end
    }

    // Construct absolute path with proper slash handling
    const docPathWithSlash = docPath.endsWith('/') ? docPath : `${docPath}/`;
    const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    const absolutePath = `${docPathWithSlash}${cleanRelativePath}`;

    // Validate the result has file:// protocol
    if (!absolutePath.startsWith('file://')) {
        console.error('[FileStorage] ERROR: Generated path missing file:// protocol:', absolutePath);
        throw new Error(`Invalid file URI generated: ${absolutePath}. Expected file:// protocol prefix.`);
    }

    console.log('[FileStorage] Generated absolute path:', absolutePath);
    return absolutePath;
};


