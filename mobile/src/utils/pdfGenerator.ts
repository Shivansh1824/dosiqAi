import { PDFDocument } from 'pdf-lib';
import { File as ExpoFile, Paths } from 'expo-file-system';
import { compressImage } from './imageCompression';

export interface PdfSourceFile {
  uri: string;
  type: 'image' | 'document';
  name: string;
}

/**
 * Creates a single PDF document from an array of image URIs.
 * The images are compressed before being added to the PDF to optimize file size.
 * Uses pdf-lib for New Architecture/Fabric compatibility.
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

    console.log(`[pdfGenerator] Starting PDF generation for ${imageUris.length} images using pdf-lib...`);

    // 1. Create a new PDF Document
    const pdfDoc = await PDFDocument.create();

    // 2. Process each image
    for (const uri of imageUris) {
      try {
        console.log(`[pdfGenerator] Processing image: ${uri}`);

        // Compress image first
        const compressedUri = await compressImage(uri);
        const imagePath = compressedUri || uri;

        // Read file as base64 using New API
        // Read file as base64 using New API (ExpoFile)
        const base64Data = await new ExpoFile(imagePath).base64();

        // Embed the image (supporting both JPG and PNG)
        let embeddedImage;
        const isPng = imagePath.toLowerCase().endsWith('.png');

        if (isPng) {
          embeddedImage = await pdfDoc.embedPng(base64Data);
        } else {
          embeddedImage = await pdfDoc.embedJpg(base64Data);
        }

        // Add a page with the image dimensions (or fit to A4)
        const dims = embeddedImage.scale(1);
        const page = pdfDoc.addPage([dims.width, dims.height]);

        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: dims.width,
          height: dims.height,
        });

      } catch (err) {
        console.warn(`[pdfGenerator] Failed to process image ${uri}`, err);
        // Continue with other images if one fails
      }
    }

    // 3. Save the PDF
    const pdfBytes = await pdfDoc.saveAsBase64();

    // 4. Write to file system using New API (ExpoFile)
    const timestamp = Date.now();
    const cleanFilename = filename.replace('.pdf', '');
    const newPdfFile = new ExpoFile(Paths.document, `${cleanFilename}_${timestamp}.pdf`);

    await newPdfFile.write(pdfBytes, { encoding: 'base64' });

    console.log(`[pdfGenerator] PDF successfully created at: ${newPdfFile.uri}`);

    return newPdfFile.uri;
  } catch (error) {
    console.error('[pdfGenerator] Error creating PDF:', error);
    throw error;
  }
};


