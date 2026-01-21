import { useState } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { DocumentAnalysisResult } from '../types/document';
import { generateAnalysisPDF, sharePDF } from '../services/pdfGenerationService';

interface UseAnalysisPDFProps {
  analysis: DocumentAnalysisResult | undefined;
  documentType: string;
  imageUri: string | null;
  displayTitle: string;
}

export function useAnalysisPDF({ 
  analysis, 
  documentType, 
  imageUri, 
  displayTitle 
}: UseAnalysisPDFProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndShare = async () => {
    if (!analysis) {
      Alert.alert('Error', 'No analysis available to share');
      return;
    }

    try {
      setIsGenerating(true);
      console.log('[useAnalysisPDF] Starting on-demand generation...');

      let documentImageBase64: string | undefined = undefined;

      // Convert document image to base64 for preview if available
      if (imageUri) {
        try {
          if (imageUri.startsWith('file://')) {
            documentImageBase64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: 'base64'
            });
          }
        } catch (e) {
          console.log('[useAnalysisPDF] Failed to load image for preview:', e);
        }
      }

      const patientName = analysis.patient_info?.name || 'Patient';

      const result = await generateAnalysisPDF(
        analysis,
        documentType,
        patientName,
        undefined,
        documentImageBase64
      );

      if (result.success && result.localPath) {
        console.log('[useAnalysisPDF] PDF Ready for sharing:', result.localPath);
        // Hide loading animation FIRST so it doesn't stay behind the share sheet
        setIsGenerating(false);
        
        // Give UI a moment to hide the modal before native share sheet blocks
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await sharePDF(result.localPath);
      } else {
        throw new Error(result.error || 'Failed to generate PDF');
      }
    } catch (error) {
      setIsGenerating(false); // Ensure hidden on error
      console.error('[useAnalysisPDF] Generation failed:', error);
      Alert.alert('Error', 'Failed to generate analysis PDF. Please try again.');
    } finally {
      // already handled successful case by setting to false early
      // but keeping finally for total safety
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generateAndShare
  };
}
