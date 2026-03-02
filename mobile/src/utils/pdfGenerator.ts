// @ts-ignore
import RNImageToPdf from 'react-native-image-to-pdf';
import { File, Paths } from 'expo-file-system';
import { compressImage } from './imageCompression';

export interface PdfSourceFile {
  uri: string;
  type: 'image' | 'document';
  name: string;
}

/**
 * Creates a single PDF document from an array of image URIs.
 * The images are compressed before being added to the PDF to optimize file size.
 *
 * @param imageUris - Array of local image URIs
 * @param filename - Optional custom filename for the output PDF
 * @returns The URI of the generated PDF file
 */
export const createPdfFromImages = async (
  imageUris: string[],
  filename: string = 'scanned_document.pdf'
): Promise<string> => {
  try {
    if (!imageUris || imageUris.length === 0) {
      throw new Error('No images provided for PDF generation');
    }

    console.log(`[pdfGenerator] Starting PDF generation for ${imageUris.length} images...`);

    // 1. Compress all images first
    const compressedImages: string[] = [];
    for (const uri of imageUris) {
      try {
        console.log(`[pdfGenerator] Compressing image: ${uri}`);
        const compressedUri = await compressImage(uri);
        if (compressedUri) {
          // react-native-image-to-pdf requires paths without 'file://' prefix on some platforms/versions
          // It's safer to strip it if present for image paths
          const cleanPath = compressedUri.replace('file://', '');
          compressedImages.push(cleanPath);
        } else {
          // Fallback to original if compression fails but returns null
          const cleanPath = uri.replace('file://', '');
          compressedImages.push(cleanPath);
        }
      } catch (err) {
        console.warn(`[pdfGenerator] Failed to compress image ${uri}, using original.`, err);
        const cleanPath = uri.replace('file://', '');
        compressedImages.push(cleanPath);
      }
    }

    // We rely on the library's default behavior for creating the temporary PDF

    console.log(`[pdfGenerator] Combining ${compressedImages.length} compressed images into PDF...`);

    // 3. Generate PDF
    const options = {
      imagePaths: compressedImages,
      name: filename,
      maxSize: { // Optional: A4 size approx max
        width: 794,
        height: 1123
      },
      quality: 0.8, // Optional: image quality in PDF
    };

    const pdfDocument = await RNImageToPdf.createPDFbyImages(options);

    console.log(`[pdfGenerator] PDF successfully created at: ${pdfDocument.filePath}`);

    if (!pdfDocument.filePath) {
      throw new Error('PDF generation returned empty path');
    }

    // Ensure the path has file:// prefix for React Native / Expo to handle correctly
    const finalUri = pdfDocument.filePath.startsWith('file://')
      ? pdfDocument.filePath
      : `file://${pdfDocument.filePath}`;

    return finalUri;
  } catch (error) {
    console.error('[pdfGenerator] Error creating PDF:', error);
    throw error;
  }
};


