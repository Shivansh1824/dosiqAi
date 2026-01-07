/**
 * PDF Generation Service (react-native-html-to-pdf version)
 * 
 * Using react-native-html-to-pdf instead of expo-print
 * for better New Architecture compatibility
 */

import { generatePDF } from 'react-native-html-to-pdf';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { DocumentAnalysisResult } from '../types/document';
import { generatePrescriptionHTML, generateLabReportHTML } from '../utils/pdfTemplates';

/**
 * Result of PDF generation operation
 */
export interface PDFGenerationResult {
    success: boolean;
    localPath?: string;
    error?: string;
    fileSize?: number;
    generationTimeMs?: number;
}

/**
 * Result of share operation
 */
export interface ShareResult {
    success: boolean;
    shared: boolean;
    dismissed?: boolean;
    error?: string;
}

/**
 * Generate PDF from analysis result using react-native-html-to-pdf
 */
export async function generateAnalysisPDF(
    analysisResult: DocumentAnalysisResult,
    documentType: string,
    patientName: string,
    appLogoBase64?: string,
    documentImageBase64?: string
): Promise<PDFGenerationResult> {
    const startTime = Date.now();

    try {
        console.log('[PDFGeneration] Starting PDF generation for:', documentType);

        // Select template based on document type
        let html: string;
        if (documentType.toLowerCase() === 'prescription' || analysisResult.prescription_data) {
            html = generatePrescriptionHTML(analysisResult, appLogoBase64, documentImageBase64);
        } else if (
            documentType.toLowerCase().includes('report') ||
            documentType.toLowerCase().includes('lab') ||
            analysisResult.report_data
        ) {
            html = generateLabReportHTML(analysisResult, appLogoBase64, documentImageBase64);
        } else {
            html = generatePrescriptionHTML(analysisResult, appLogoBase64, documentImageBase64);
        }

        console.log('[PDFGeneration] HTML template generated, size:', html.length, 'chars');

        // Generate filename
        const timestamp = Date.now();
        const safePatientName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${safePatientName}_Analysis_${timestamp}`;

        // Generate PDF using react-native-html-to-pdf
        const options = {
            html,
            fileName: filename,
            directory: 'Documents',
        };

        console.log('[PDFGeneration] Calling generatePDF...');
        const result = await generatePDF(options);

        console.log('[PDFGeneration] PDF generated successfully');
        console.log('[PDFGeneration] File path:', result.filePath);

        const generationTimeMs = Date.now() - startTime;

        // Get file size
        let fileSize = 0;
        try {
            if (result.filePath) {
                const file = new File(result.filePath);
                fileSize = file.size || 0;
            }
        } catch (e) {
            console.log('[PDFGeneration] Could not get file size:', e);
        }

        console.log('[PDFGeneration] Success! File size:', fileSize, 'bytes, Time:', generationTimeMs, 'ms');

        return {
            success: true,
            localPath: result.filePath || undefined,
            fileSize,
            generationTimeMs,
        };
    } catch (error) {
        console.error('[PDFGeneration] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate PDF',
        };
    }
}

/**
 * Share a PDF file using native share sheet
 */
export async function sharePDF(pdfPath: string, message?: string): Promise<ShareResult> {
    try {
        console.log('[PDFShare] Sharing PDF from:', pdfPath);

        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            console.error('[PDFShare] Sharing not available on this device');
            return {
                success: false,
                shared: false,
                error: 'Sharing is not available on this device',
            };
        }

        // Ensure file path has file:// protocol
        const uri = pdfPath.startsWith('file://') ? pdfPath : `file://${pdfPath}`;

        // Verify file exists
        const file = new File(uri);
        if (!file.exists) {
            console.error('[PDFShare] File not found:', uri);
            return {
                success: false,
                shared: false,
                error: 'PDF file not found',
            };
        }

        console.log('[PDFShare] File verified, size:', file.size, 'bytes');

        // Share using native share sheet
        await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: message || 'Share Health Analysis',
            UTI: 'com.adobe.pdf',
        });

        console.log('[PDFShare] Share sheet opened successfully');

        return {
            success: true,
            shared: true,
        };
    } catch (error) {
        if (error instanceof Error && error.message.includes('cancel')) {
            console.log('[PDFShare] User cancelled share');
            return {
                success: true,
                shared: false,
                dismissed: true,
            };
        }

        console.error('[PDFShare] Error:', error);
        return {
            success: false,
            shared: false,
            error: error instanceof Error ? error.message : 'Failed to share PDF',
        };
    }
}

/**
 * Generate and share PDF in one step
 */
export async function generateAndSharePDF(
    analysisResult: DocumentAnalysisResult,
    documentType: string,
    patientName: string,
    appLogoBase64?: string,
    shareMessage?: string,
    documentImageBase64?: string
): Promise<{
    generated: PDFGenerationResult;
    shared?: ShareResult;
}> {
    console.log('[PDFGeneration] Generate and share flow started');

    // Step 1: Generate PDF
    const generationResult = await generateAnalysisPDF(
        analysisResult,
        documentType,
        patientName,
        appLogoBase64,
        documentImageBase64
    );

    if (!generationResult.success || !generationResult.localPath) {
        console.error('[PDFGeneration] Generation failed, aborting share');
        return {
            generated: generationResult,
        };
    }

    // Step 2: Share PDF
    const shareResult = await sharePDF(generationResult.localPath, shareMessage);

    return {
        generated: generationResult,
        shared: shareResult,
    };
}
