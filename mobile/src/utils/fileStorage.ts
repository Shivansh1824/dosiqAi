import { File, Directory, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

/**
 * Local file storage utility for offline-first document management
 * Files are stored in: {DocumentDirectory}/FamilyCareHealth/documents/
 * All files use UUID-based filenames for uniqueness and consistency
 */

const APP_FOLDER_NAME = 'FamilyCareHealth';
const DOCUMENTS_FOLDER_NAME = 'documents';

/**
 * Get the base FamilyCareHealth directory path
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
 * Get the flat documents directory path (FamilyCareHealth/documents/)
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
 * Get or create a user-specific directory
 * @param userName - Name of the user/family member
 */
export const getUserDirectory = async (userName: string): Promise<string> => {
    const appDirPath = await getAppDirectory();
    const sanitizedName = sanitizeFileName(userName);

    // Create Directory object for user folder
    const userDir = new Directory(appDirPath, sanitizedName);

    // Check if it already exists as a directory
    if (userDir.exists) {
        return userDir.uri;
    }

    // Check if a FILE exists with the same name (conflict)
    // NOTE: On case-insensitive file systems (macOS), we need to check for
    // case-insensitive matches that might block directory creation
    try {
        // Construct full file URI manually (most reliable method)
        const fileUri = appDirPath.endsWith('/')
            ? `${appDirPath}${sanitizedName}`
            : `${appDirPath}/${sanitizedName}`;

        const conflictingFile = new File(fileUri);

        console.log('[FileStorage] Checking for conflicting file at:', conflictingFile.uri);
        console.log('[FileStorage] File exists check:', conflictingFile.exists);

        if (conflictingFile.exists) {
            console.warn(`[FileStorage] ⚠️  File "${sanitizedName}" exists where directory should be. Size: ${conflictingFile.size} bytes`);
            console.log('[FileStorage] Deleting conflicting file...');
            await conflictingFile.delete();
            console.log('[FileStorage] ✓ Deleted conflicting file successfully');
        }
    } catch (error) {
        console.error('[FileStorage] Error checking/deleting conflicting file:', error);
    }

    // Now create the directory
    try {
        await userDir.create();
        console.log('[FileStorage] ✓ Created user directory:', userDir.uri);
    } catch (createError: any) {
        console.error('[FileStorage] ❌ Error creating user directory:', createError);

        // If create fails due to existing file/directory, try to force delete and retry
        if (createError.message?.includes('already exists') || createError.message?.includes('same name')) {
            console.log('[FileStorage] Attempting forced cleanup of existing item...');
            try {
                // Construct file URI
                const fileUri = appDirPath.endsWith('/')
                    ? `${appDirPath}${sanitizedName}`
                    : `${appDirPath}/${sanitizedName}`;

                // AGGRESSIVE CLEANUP: Try deleting as File (WITHOUT checking exists first)
                // The .exists property may be buggy/unreliable for corrupted files
                try {
                    const fileToDelete = new File(fileUri);
                    await fileToDelete.delete();
                    console.log('[FileStorage] ✓ Deleted as File (forced)');
                } catch (e: unknown) {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    console.log('[FileStorage] Delete as File failed (might not be a file):', errorMessage);
                }

                // Try deleting as Directory (WITHOUT checking exists first)
                try {
                    const dirToDelete = new Directory(appDirPath, sanitizedName);
                    await dirToDelete.delete();
                    console.log('[FileStorage] ✓ Deleted as Directory (forced)');
                } catch (e: unknown) {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    console.log('[FileStorage] Delete as Directory failed (might not be a directory):', errorMessage);
                }

                // Give the file system a moment to process deletions
                await new Promise(resolve => setTimeout(resolve, 100));

                // Retry creation
                try {
                    await userDir.create();
                    console.log('[FileStorage] ✓ Created user directory after cleanup:', userDir.uri);
                } catch (finalError) {
                    // Last resort: The file system item exists but API can't delete it
                    console.error('[FileStorage] All cleanup attempts failed. The blocking item exists but cannot be deleted via API.');
                    console.error('[FileStorage] This requires manual intervention or app data reset.');
                    throw new Error(
                        `Cannot create directory for ${userName}. ` +
                        `A file or directory exists at "${sanitizedName}" but cannot be accessed. ` +
                        `Please clear app data and try again.`
                    );
                }
            } catch (retryError: unknown) {
                console.error('[FileStorage] Failed to cleanup and retry:', retryError);
                const errorMessage = retryError instanceof Error ? retryError.message : String(retryError);
                throw new Error(`Failed to create user directory for ${userName}. Error: ${errorMessage}`);
            }
        } else {
            throw new Error(`Failed to create user directory for ${userName}: ${createError.message}`);
        }
    }

    return userDir.uri;
};

/**
 * Sanitize filename to remove invalid characters
 */
export const sanitizeFileName = (name: string): string => {
    return name
        .replace(/[^a-zA-Z0-9_\-. ]/g, '_') // Replace invalid chars with underscore
        .replace(/\s+/g, '_') // Replace spaces with underscore
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .trim();
};

/**
 * Save a file to local storage (LEGACY - kept for backward compatibility)
 * @param sourceUri - URI of the file to save (from camera/picker)
 * @param userName - Name of the user/family member
 * @param documentId - Unique document ID
 * @param originalFileName - Original filename
 * @returns Object with absolute path (for immediate use), relative path (for storage), and file size
 * @deprecated Use saveFileLocallyWithUUID for new uploads
 */
export const saveFileLocally = async (
    sourceUri: string,
    userName: string,
    documentId: string,
    originalFileName: string
): Promise<{ absolutePath: string; relativePath: string; fileSize: number }> => {
    try {
        const userDirPath = await getUserDirectory(userName);

        // Extract extension from original filename
        const extension = originalFileName.split('.').pop() || 'jpg';
        const sanitizedTitle = sanitizeFileName(originalFileName.replace(/\.[^/.]+$/, ''));

        // Create filename: doc_{id}_{title}.{ext}
        const fileName = `doc_${documentId}_${sanitizedTitle}.${extension}`;

        // Create File objects for source and destination
        const sourceFile = new File(sourceUri);
        const userDirectory = new Directory(userDirPath);
        const destinationFile = new File(userDirectory, fileName);

        // Copy file using new API
        await sourceFile.copy(destinationFile);

        // Get file size using synchronous property
        const fileSize = destinationFile.size || 0;

        // Get both absolute and relative paths
        const absolutePath = destinationFile.uri;
        const relativePath = getRelativePath(absolutePath);

        console.log(`[FileStorage] Saved file: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);
        console.log(`[FileStorage] Relative path: ${relativePath}`);

        return {
            absolutePath,
            relativePath,
            fileSize
        };
    } catch (error) {
        console.error('[FileStorage] Error saving file:', error);
        throw new Error('Failed to save file locally');
    }
};

/**
 * Save a file to local storage using UUID-based filename in flat documents folder
 * This is the PRIMARY function for new document uploads
 * @param sourceUri - URI of the file to save (from camera/picker)
 * @param extension - File extension (e.g., 'pdf', 'jpg')
 * @returns Object with filename (UUID), absolute path, relative path, and file size
 */
export const saveFileLocallyWithUUID = async (
    sourceUri: string,
    extension: string
): Promise<{ filename: string; absolutePath: string; relativePath: string; fileSize: number }> => {
    try {
        const docsDirPath = await getDocumentsDirectory();

        // Generate UUID-based filename
        const filename = generateUniqueFilename(extension);

        // Create File objects for source and destination
        const sourceFile = new File(sourceUri);
        const docsDirectory = new Directory(docsDirPath);
        const destinationFile = new File(docsDirectory, filename);

        // Copy file using new API
        await sourceFile.copy(destinationFile);

        // Get file size using synchronous property
        const fileSize = destinationFile.size || 0;

        // Get both absolute and relative paths
        const absolutePath = destinationFile.uri;
        const relativePath = getRelativePath(absolutePath);

        console.log(`[FileStorage] Saved file with UUID: ${filename} (${(fileSize / 1024).toFixed(2)} KB)`);
        console.log(`[FileStorage] Relative path: ${relativePath}`);

        return {
            filename,
            absolutePath,
            relativePath,
            fileSize
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
 * @param absoluteUri - Absolute file URI (e.g., file:///path/to/Documents/FamilyCareHealth/...)
 * @returns Relative path from Documents directory (e.g., FamilyCareHealth/...)
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
 * @param relativePath - Relative path from Documents directory (e.g., FamilyCareHealth/...)
 * @returns Absolute file URI (e.g., file:///current/path/to/Documents/FamilyCareHealth/...)
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

/**
 * Get local file path for a document
 * @param userName - Name of the user/family member
 * @param documentId - Document ID
 * @param fileName - File name
 */
export const getLocalFilePath = async (
    userName: string,
    documentId: string,
    fileName: string
): Promise<string> => {
    const userDir = await getUserDirectory(userName);
    const sanitizedTitle = sanitizeFileName(fileName.replace(/\.[^/.]+$/, ''));
    const extension = fileName.split('.').pop() || 'jpg';
    return `${userDir}doc_${documentId}_${sanitizedTitle}.${extension}`;
};

/**
 * List all files in a user's directory
 * @param userName - Name of the user/family member
 */
export const listUserFiles = async (userName: string): Promise<string[]> => {
    try {
        const userDirPath = await getUserDirectory(userName);
        const userDir = new Directory(userDirPath);

        // List returns File and Directory objects
        const items = userDir.list();

        // Filter only files (not subdirectories) and return names
        return items
            .filter(item => item instanceof File)
            .map(item => item.name);
    } catch (error) {
        console.error('[FileStorage] Error listing files:', error);
        return [];
    }
};
