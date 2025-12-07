/**
 * Document Analysis Service
 *
 * Handles AI-powered document analysis using OpenRouter API via Supabase Edge Function
 * Includes base64 conversion, upload limit tracking, and API communication
 */

import { File } from 'expo-file-system';
import { supabase } from './supabaseClient';

export interface AnalyzeDocumentParams {
  documentId: string;
  localFilePath: string;
  customPrompt?: string;
}

export interface AnalysisResponse {
  success: boolean;
  documentId: string;
  analysis?: any;
  tokensUsed?: number;
  duration?: number;
  error?: string;
  code?: string;
}

export interface UploadLimitInfo {
  allowed: boolean;
  count: number;
  limit: number;
}

/**
 * Convert local file to base64 string
 *
 * @param filePath - Absolute or relative path to file
 * @returns Base64 encoded string (without data URI prefix)
 */
export const fileToBase64 = async (filePath: string): Promise<string> => {
  try {
    console.log('[DocumentAnalysis] Converting file to base64:', filePath);

    // Ensure path has file:// protocol
    const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

    // Read file as base64 using new expo-file-system File API
    const file = new File(uri);

    if (!file.exists) {
      throw new Error(`File not found: ${uri}`);
    }

    // Read file content as base64
    const base64 = await file.base64();

    console.log('[DocumentAnalysis] Base64 conversion successful, length:', base64.length);
    return base64;
  } catch (error) {
    console.error('[DocumentAnalysis] Error converting file to base64:', error);
    throw new Error('Failed to read file for analysis');
  }
};

/**
 * Get MIME type from file path
 *
 * @param filePath - File path with extension
 * @returns MIME type string
 */
export const getMimeType = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'pdf':
      return 'application/pdf';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return 'image/jpeg'; // Default fallback
  }
};

/**
 * Call Supabase Edge Function to analyze document
 *
 * @param params - Document ID, file path, and optional custom prompt
 * @returns Analysis response with results or error
 */
export const analyzeDocument = async (params: AnalyzeDocumentParams): Promise<AnalysisResponse> => {
  const { documentId, localFilePath, customPrompt } = params;

  try {
    console.log('[DocumentAnalysis] Starting analysis for document:', documentId);

    // Convert file to base64
    const base64Image = await fileToBase64(localFilePath);
    const fileType = getMimeType(localFilePath);

    console.log('[DocumentAnalysis] File type:', fileType);
    console.log('[DocumentAnalysis] Base64 size:', (base64Image.length * 0.75 / 1024).toFixed(2), 'KB');

    // Get current session token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    // Call Edge Function
    console.log('[DocumentAnalysis] Calling Edge Function...');
    console.log('[DocumentAnalysis] Request body size:', JSON.stringify({ documentId, fileType }).length + base64Image.length, 'bytes');

    try {
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: {
          documentId,
          base64Image,
          fileType,
          prompt: customPrompt,
        },
      });

      if (error) {
        console.error('[DocumentAnalysis] Edge Function error:', error);
        console.error('[DocumentAnalysis] Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('[DocumentAnalysis] Analysis completed successfully');
      console.log('[DocumentAnalysis] Response data:', JSON.stringify(data, null, 2));
      return data as AnalysisResponse;
    } catch (fetchError: any) {
      console.error('[DocumentAnalysis] Fetch error caught:', fetchError);
      console.error('[DocumentAnalysis] Fetch error name:', fetchError?.name);
      console.error('[DocumentAnalysis] Fetch error message:', fetchError?.message);
      console.error('[DocumentAnalysis] Fetch error stack:', fetchError?.stack);
      throw fetchError;
    }

  } catch (error: any) {
    console.error('[DocumentAnalysis] Error:', error);

    return {
      success: false,
      documentId,
      error: error.message || 'Failed to analyze document',
      code: error.code,
    };
  }
};

/**
 * Check if user has reached daily upload limit
 *
 * @param userId - User UUID
 * @returns Upload limit information
 */
export const checkUploadLimit = async (userId: string): Promise<UploadLimitInfo> => {
  try {
    const { data, error } = await supabase.rpc('check_upload_limit', {
      p_user_id: userId,
      p_max_uploads: 5,
    });

    if (error) {
      console.error('[DocumentAnalysis] Error checking upload limit:', error);
      return { allowed: true, count: 0, limit: 5 }; // Fail open
    }

    // Get current count
    const { data: limitData } = await supabase
      .from('upload_limits')
      .select('upload_count')
      .eq('user_id', userId)
      .eq('upload_date', new Date().toISOString().split('T')[0])
      .single();

    return {
      allowed: data === true,
      count: limitData?.upload_count || 0,
      limit: 5,
    };
  } catch (error) {
    console.error('[DocumentAnalysis] Error checking upload limit:', error);
    return { allowed: true, count: 0, limit: 5 }; // Fail open
  }
};

/**
 * Increment upload count for user
 *
 * @param userId - User UUID
 * @returns New upload count for today
 */
export const incrementUploadCount = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('increment_upload_count', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[DocumentAnalysis] Error incrementing upload count:', error);
      return 0;
    }

    console.log('[DocumentAnalysis] Upload count incremented to:', data);
    return data || 0;
  } catch (error) {
    console.error('[DocumentAnalysis] Error incrementing upload count:', error);
    return 0;
  }
};

/**
 * Get current upload count for user today
 *
 * @param userId - User UUID
 * @returns Current upload count
 */
export const getUploadCount = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('get_upload_count', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[DocumentAnalysis] Error getting upload count:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('[DocumentAnalysis] Error getting upload count:', error);
    return 0;
  }
};
