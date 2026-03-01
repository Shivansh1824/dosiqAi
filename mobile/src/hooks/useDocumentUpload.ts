import { useState } from 'react';
import { from } from '../lib/apiClient';
import { saveFileLocallyWithUUID, getAbsolutePath } from '../utils/fileStorage';

/**
 * NOTE: This hook is currently NOT USED in the app.
 * The actual document upload happens in ScanDocumentScreen.tsx and HomeScreen.tsx
 * This was a planned refactoring that was never completed.
 * Keeping it for future reference.
 */

// Mock function to simulate AI Analysis - REPLACE with actual API call
const mockAnalyzeDocument = async (fileUri: string) => {
    // Simulator delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Return dummy data (Replace with real API response)
    return {
        file_name: `Analyzed_Doc_${Date.now()}`,
        document_type: Math.random() > 0.5 ? 'prescription' : 'report'
    };
};

// Mock function for R2 Upload - REPLACE with actual Presigned URL upload
const uploadToR2 = async (localUri: string, key: string) => {
    // 1. Get Presigned URL from Backend (TODO)
    // const { url } = await getPresignedUrl(key);
    // 2. Upload file via fetch(url, { method: 'PUT', body: blob ... })
    // For now, we simulate success
    console.log(`[Mock R2] Uploading ${localUri} to ${key}`);
    return true;
};

export const useDocumentUpload = () => {
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const processUpload = async (initialUri: string, userId: string) => {
        setIsUploading(true);
        setStatus('Initializing...');

        try {
            // 1. Save to local storage with UUID filename
            setStatus('Saving locally...');
            const extension = initialUri.split('.').pop() || 'jpg';
            const { filename, relativePath, absolutePath } = await saveFileLocallyWithUUID(
                initialUri,
                extension
            );

            // 2. AI Analysis
            setStatus('Analyzing Document...');
            const analysisResult = await mockAnalyzeDocument(absolutePath);

            // 3. Upload to R2 (Using the Final Name)
            setStatus('Syncing to Cloud...');
            const r2Key = `${userId}/${analysisResult.document_type}s/${filename}`;
            await uploadToR2(absolutePath, r2Key);

            // 4. Database Insert (Storing the Relative Path)
            setStatus('Finalizing...');
            const { error } = await from('documents')
                .insert({
                    user_id: userId,
                    title: filename, // UUID filename
                    type: analysisResult.document_type,
                    cloud_file_key: r2Key,
                    local_file_path: relativePath, // Relative path
                    is_local: true,
                    document_date: new Date().toISOString()
                });

            if (error) throw error;

            setStatus('Success!');
            return true;

        } catch (error) {
            console.error("Upload Failed:", error);
            setStatus('Failed');
            return false;
        } finally {
            setIsUploading(false);
        }
    };

    return {
        processUpload,
        isUploading,
        status
    };
};
