import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File as ExpoFile } from 'expo-file-system';
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
 * Generate PDF from analysis result using expo-print
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
        if (documentType.toLowerCase() === 'prescription' || analysisResult.is_prescription) {
            html = generatePrescriptionHTML(analysisResult, appLogoBase64, documentImageBase64);
        } else if (
            documentType.toLowerCase().includes('report') ||
            documentType.toLowerCase().includes('lab')
        ) {
            html = generateLabReportHTML(analysisResult, appLogoBase64, documentImageBase64);
        } else {
            html = generatePrescriptionHTML(analysisResult, appLogoBase64, documentImageBase64);
        }

        console.log('[PDFGeneration] HTML template generated, size:', html.length, 'chars');

        // Generate PDF using expo-print
        console.log('[PDFGeneration] Calling Print.printToFileAsync...');
        const result = await Print.printToFileAsync({
            html,
            base64: false,
        });

        console.log('[PDFGeneration] PDF generated successfully');
        console.log('[PDFGeneration] File path:', result.uri);

        const generationTimeMs = Date.now() - startTime;

        // Get file size using New API (ExpoFile)
        let fileSize = 0;
        try {
            if (result.uri) {
                const file = new ExpoFile(result.uri);
                if (file.exists) {
                    fileSize = file.size || 0;
                }
            }
        } catch (e) {
            console.log('[PDFGeneration] Could not get file size:', e);
        }

        console.log('[PDFGeneration] Success! File size:', fileSize, 'bytes, Time:', generationTimeMs, 'ms');

        return {
            success: true,
            localPath: result.uri,
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

        // Verify file exists using New API (ExpoFile)
        const file = new ExpoFile(uri);
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
