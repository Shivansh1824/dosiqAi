// @ts-ignore
import RNImageToPdf from 'react-native-image-to-pdf';
import { File, Paths } from 'expo-file-system';
import { PDFDocument } from 'pdf-lib';
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

/**
 * Merges multiple PDFs and images into a single PDF document.
 * Images are compressed and embedded into their own pages.
 * Existing PDFs have all their pages copied into the new document.
 *
 * Uses the new expo-file-system File/Paths API (SDK 54+).
 *
 * @param files - Array of files (images and PDFs)
 * @param filename - Optional custom filename for the output PDF
 * @returns The URI of the generated PDF file
 */
export const mergeFilesToPdf = async (
  files: PdfSourceFile[],
  filename: string = 'scanned_document.pdf'
): Promise<string> => {
  try {
    if (!files || files.length === 0) {
      throw new Error('No files provided for PDF merging');
    }

    console.log(`[pdfGenerator] Starting PDF merging for ${files.length} files...`);

    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        const isPdf = file.type === 'document' && fileExt === 'pdf';

        if (isPdf) {
          console.log(`[pdfGenerator] Loading PDF: ${file.name}`);
          const uri = file.uri.startsWith('file://') ? file.uri : `file://${file.uri}`;

          // Read PDF as base64 using new File API
          const pdfFile = new File(uri);
          if (!pdfFile.exists) {
            console.error(`[pdfGenerator] PDF file not found: ${uri}`);
            continue;
          }
          const base64 = await pdfFile.base64();

          const donorPdf = await PDFDocument.load(base64);
          const donorPages = await mergedPdf.copyPages(donorPdf, donorPdf.getPageIndices());
          donorPages.forEach((page) => mergedPdf.addPage(page));
          console.log(`[pdfGenerator] PDF merged: ${donorPages.length} pages added`);

        } else if (file.type === 'image' || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(fileExt)) {
          console.log(`[pdfGenerator] Processing image: ${file.name}`);

          // 1. Compress image (compressImage always outputs JPEG format)
          const compressedUriStr = await (compressImage(file.uri) as any) || file.uri;
          const uri = compressedUriStr.startsWith('file://') ? compressedUriStr : `file://${compressedUriStr}`;

          // 2. Read as base64 using new File API
          const imgFile = new File(uri);
          if (!imgFile.exists) {
            console.error(`[pdfGenerator] Image file not found: ${uri}`);
            continue;
          }
          const base64 = await imgFile.base64();

          // 3. Determine actual type from the compressed output URI, NOT the original extension.
          //    compressImage() always outputs JPEG (via ImageManipulator SaveFormat.JPEG),
          //    so after compression we should always use embedJpg — regardless of original extension.
          const compressedExt = uri.split('.').pop()?.toLowerCase() || '';
          const isActuallyPng = compressedExt === 'png';

          let image;
          if (isActuallyPng) {
            image = await mergedPdf.embedPng(base64);
          } else {
            // compressImage outputs JPEG, so this is the correct path for all compressed images
            image = await mergedPdf.embedJpg(base64);
          }

          // 4. Create new page matching image dimensions
          const dims = image.scale(1);
          const page = mergedPdf.addPage([dims.width, dims.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: dims.width,
            height: dims.height,
          });
          console.log(`[pdfGenerator] Image page added: ${dims.width}x${dims.height}`);
        }
      } catch (err) {
        console.error(`[pdfGenerator] Failed to process file ${file.name}:`, err);
        // We continue processing the remaining files instead of failing the whole operation
      }
    }

    // Save PDF to base64
    const pdfBytes = await mergedPdf.saveAsBase64();

    // Write to cache directory using new Paths API
    if (!Paths.cache) {
      throw new Error('Cache directory is not available');
    }

    const outputUri = `${Paths.cache.uri}/${filename}`;
    const outputFile = new File(outputUri);

    // Write base64 content to file
    await outputFile.write(pdfBytes, { encoding: 'base64' });

    console.log(`[pdfGenerator] Merged PDF successfully created at: ${outputUri}`);
    return outputUri;
  } catch (error) {
    console.error('[pdfGenerator] Error merging PDF:', error);
    throw error;
  }
};
