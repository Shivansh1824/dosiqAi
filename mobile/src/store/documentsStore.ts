import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Document, DocumentsStore, getDocumentColor } from '../types/document';
import { saveToCache, loadFromCache, CacheKeys } from '../services/cacheService';
import { analyzeDocument, checkUploadLimit, incrementUploadCount, UploadLimitInfo } from '../services/documentAnalysisService';
import { processLabReport } from '../services/labAnalyticsService';
import { deleteFileFromR2 } from '../services/storageService';

/**
 * Zustand store for documents state
 * Integrates with Supabase to fetch user documents
 *
 * Color Management Strategy:
 * - Colors calculated on-the-fly, NOT stored in database
 * - When fetching: colors calculated from document type
 * - When adding: colors NOT sent to database, calculated after insert
 * - See getDocumentColor() in types/document.ts for logic
 */
export const useDocumentsStore = create<DocumentsStore>((set, get) => ({
  // Initial state
  documents: [],
  isLoading: false,
  error: null,

  // AI Analysis state
  isAnalyzing: false,
  analysisProgress: {},
  uploadLimit: null,

  // Actions
  setError: (error: string | null) => set({ error }),

  clearDocuments: () => set({ documents: [], error: null }),

  /**
   * Load documents from cache
   * @returns true if cache was found and loaded, false otherwise
   */
  loadFromCache: async (userId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const cached = await loadFromCache<Document[]>(CacheKeys.documents(userId));
      if (cached && cached.length > 0) {
        console.log('[DocumentsStore] Loaded', cached.length, 'documents from cache');
        set({ documents: cached, isLoading: false });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[DocumentsStore] Error loading from cache:', error);
      return false;
    }
  },

  /**
   * Fetch documents for a specific user from Supabase
   * @param userId - User ID
   * @param silent - If true, don't show loading spinner (for background refresh)
   */
  fetchDocuments: async (userId: string, silent = false) => {
    if (!userId) {
      console.warn('[DocumentsStore] No user ID provided');
      set({ documents: [], isLoading: false });
      return;
    }

    // Only show loading spinner if not a silent refresh
    if (!silent) {
      set({ isLoading: true, error: null });
    }

    try {
      if (!isSupabaseConfigured()) {
        console.warn('[DocumentsStore] Supabase not configured, using empty documents');
        set({ documents: [], isLoading: false });
        return;
      }

      console.log(`[DocumentsStore] Fetching documents for user: ${userId} (silent: ${silent})`);

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DocumentsStore] Fetch error:', error);
        set({ error: error.message, isLoading: false });
        return;
      }

      // Calculate color for each document based on type (not stored in database)
      const documentsWithColor: Document[] = (data || []).map((doc) => ({
        ...doc,
        color: getDocumentColor(doc.type), // Always calculate from type (database optimization)
      }));

      // Save to cache for next time
      await saveToCache(CacheKeys.documents(userId), documentsWithColor);

      console.log('[DocumentsStore] Fetched', documentsWithColor.length, 'documents');
      set({ documents: documentsWithColor, isLoading: false });
    } catch (error) {
      console.error('[DocumentsStore] Unexpected error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch documents',
        isLoading: false,
      });
    }
  },

  /**
   * Add a new document to Supabase
   */
  addDocument: async (doc) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      // Exclude color field - it will be calculated when fetched, not stored in DB
      const { color, ...newDoc } = doc;

      const { data, error } = await supabase
        .from('documents')
        .insert(newDoc)
        .select()
        .single();

      console.log('[DocumentsStore] Inserting Payload to DB:', JSON.stringify(newDoc, null, 2));

      if (error) {
        throw error;
      }

      // Add to local state with calculated color
      const documents = get().documents;
      const documentWithColor = {
        ...data,
        color: getDocumentColor(data.type),
      };
      set({
        documents: [documentWithColor, ...documents],
        isLoading: false,
      });

      console.log('[DocumentsStore] Document added:', data.id);

      // Return the saved document with its UUID and calculated color
      return documentWithColor;
    } catch (error) {
      console.error('[DocumentsStore] Add document error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add document',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Update the cloud_file_key for a document
   * Called after R2 upload completes to store the cloud path
   */
  updateCloudFileKey: async (documentId: string, cloudFileKey: string): Promise<boolean> => {
    try {
      if (!isSupabaseConfigured()) {
        console.warn('[DocumentsStore] Supabase not configured');
        return false;
      }

      console.log('[DocumentsStore] Updating cloud_file_key for document:', documentId);
      console.log('[DocumentsStore] Cloud key:', cloudFileKey);

      const { data, error } = await supabase
        .from('documents')
        .update({ cloud_file_key: cloudFileKey })
        .eq('id', documentId)
        .select();

      if (error) {
        console.error('[DocumentsStore] Error updating cloud_file_key:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.error('[DocumentsStore] ⚠️ cloud_file_key update returned no rows');
        return false;
      }

      console.log('[DocumentsStore] ✅ cloud_file_key updated successfully');
      return true;
    } catch (error) {
      console.error('[DocumentsStore] Exception updating cloud_file_key:', error);
      return false;
    }
  },

  /**
   * Delete a document from Supabase
   */

  deleteDocument: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      // 1. Get the document first to check for R2 key
      const docToDelete = get().documents.find((d) => d.id === id);

      // 2. Delete from R2 if key exists
      if (docToDelete?.cloud_file_key) {
        try {
          console.log('[DocumentsStore] Deleting R2 file:', docToDelete.cloud_file_key);
          await deleteFileFromR2(docToDelete.cloud_file_key);
          console.log('[DocumentsStore] R2 file deleted successfully');
        } catch (r2Error) {
          console.error('[DocumentsStore] Failed to delete R2 file (proceeding with DB delete):', r2Error);
          // We continue with DB delete even if R2 fails prevents "zombie" entries in DB
        }
      }

      // 3. Delete from Supabase
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Remove from local state
      const documents = get().documents.filter((doc) => doc.id !== id);
      set({ documents, isLoading: false });

      console.log('[DocumentsStore] Document deleted:', id);
    } catch (error) {
      console.error('[DocumentsStore] Delete document error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to delete document',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Sync local documents with remote database
   * Removes orphaned documents (exist locally but not remotely)
   */
  syncDocuments: async (userId: string) => {
    if (!userId) {
      console.warn('[DocumentsStore] syncDocuments: No user ID provided');
      return;
    }

    try {
      if (!isSupabaseConfigured()) {
        console.warn('[DocumentsStore] syncDocuments: Supabase not configured');
        return;
      }

      // Fetch only document IDs from Supabase (efficient query)
      const { data: remoteDocuments, error } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId);

      if (error) {
        console.error('[DocumentsStore] syncDocuments error:', error);
        return; // Don't clear local data on error
      }

      // Get local document IDs
      const localDocuments = get().documents;
      const remoteIds = new Set((remoteDocuments || []).map((doc) => doc.id));

      // Find orphaned documents (exist locally but not remotely)
      const orphanedDocuments = localDocuments.filter((doc) => !remoteIds.has(doc.id));

      if (orphanedDocuments.length > 0) {
        console.log('[DocumentsStore] Removing', orphanedDocuments.length, 'orphaned documents');

        // Remove orphaned documents from local state
        const syncedDocuments = localDocuments.filter((doc) => remoteIds.has(doc.id));
        set({ documents: syncedDocuments });

        console.log('[DocumentsStore] Sync complete:', syncedDocuments.length, 'documents remaining');
      } else {
        console.log('[DocumentsStore] Sync complete: No orphaned documents found');
      }
    } catch (error) {
      console.error('[DocumentsStore] syncDocuments unexpected error:', error);
      // Don't clear local data on unexpected errors
    }
  },

  /**
   * Trigger AI analysis for a document
   * Shows progress updates and handles the complete analysis flow
   */
  triggerAnalysis: async (documentId: string, localFilePath: string, customPrompt?: string) => {
    try {
      console.log('[DocumentsStore] Triggering analysis for:', documentId);

      // Set analyzing state
      set((state) => ({
        isAnalyzing: true,
        analysisProgress: { ...state.analysisProgress, [documentId]: 10 },
      }));

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        set((state) => ({
          analysisProgress: {
            ...state.analysisProgress,
            [documentId]: Math.min((state.analysisProgress[documentId] || 10) + 15, 90),
          },
        }));
      }, 500);

      // Call analysis service
      const result = await analyzeDocument({
        documentId,
        localFilePath,
        customPrompt,
      });

      // Clear progress interval
      clearInterval(progressInterval);

      // Update progress to 100%
      set((state) => ({
        analysisProgress: { ...state.analysisProgress, [documentId]: 100 },
      }));

      // Wait a bit to show completion
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get document info for user_id
      const localDocuments = get().documents;
      const document = localDocuments.find((doc) => doc.id === documentId);

      // Use analysis result directly from the API response (more reliable than refetching)
      // The Edge Function returns the parsed analysis in result.analysis
      console.log('[DocumentsStore] Full result from Edge Function:', JSON.stringify(result, null, 2));

      const analysisResult = result.analysis;
      console.log('[DocumentsStore] Analysis result object:', analysisResult);
      console.log('[DocumentsStore] Analysis result type:', typeof analysisResult);

      const aiGeneratedFilename = analysisResult?.file_name;
      const aiDocumentType = analysisResult?.document_type;

      console.log('[DocumentsStore] Extracted values - aiGeneratedFilename:', aiGeneratedFilename, ', aiDocumentType:', aiDocumentType);

      // Process lab reports - save to lab_reports and test_results tables
      if (analysisResult && aiDocumentType && (aiDocumentType.toLowerCase() === 'lab_report' || aiDocumentType.toLowerCase() === 'lab report')) {
        console.log('[DocumentsStore] Detected lab report, processing to database...');
        try {
          const labReportResult = await processLabReport(
            documentId,
            analysisResult,
            document?.user_id || '',
            document?.family_member_id || ''
          );

          if (labReportResult) {
            console.log('[DocumentsStore] Lab report processed successfully:', labReportResult.labReportId);
            console.log('[DocumentsStore] Created', labReportResult.testResultIds.length, 'test results');
          } else {
            console.log('[DocumentsStore] Lab report processing returned null (may not be a valid lab report)');
          }
        } catch (error) {
          console.error('[DocumentsStore] Error processing lab report:', error);
          // Don't throw - this is not critical, document is still saved
        }
      }

      if (document?.user_id) {

        if ((aiDocumentType) && isSupabaseConfigured()) {
          try {
            const updateFields: { type?: string } = {};

            // NOTE: Title is NOT updated - we keep the UUID filename permanently
            // The AI-generated filename is stored in ai_analysis_result.file_name for display purposes


            // Map AI document type to DocumentType enum
            if (aiDocumentType) {
              const typeMapping: { [key: string]: string } = {
                'prescription': 'Prescription',
                'lab_report': 'Lab Report',
                'lab report': 'Lab Report',
                'imaging': 'Imaging',
                'report': 'Report',
                'record': 'Record',
                'other': 'Other',
              };
              const mappedType = typeMapping[aiDocumentType.toLowerCase()] || 'Other';
              updateFields.type = mappedType;
            }

            // Update document type in Supabase (title remains as UUID)
            if (Object.keys(updateFields).length > 0) {
              console.log('[DocumentsStore] Updating document type:', updateFields);
              const { error: updateError } = await supabase
                .from('documents')
                .update(updateFields)
                .eq('id', documentId);

              if (updateError) {
                console.error('[DocumentsStore] Error updating document type:', updateError);
              } else {
                console.log('[DocumentsStore] Successfully updated document type');
              }
            }

          } catch (error) {
            console.error('[DocumentsStore] Error updating document:', error);
            // Don't throw - update is not critical
          }
        }

        // Always refresh documents after analysis to get the latest state (including ai_analysis_result)
        await get().fetchDocuments(document.user_id, true);
      }

      // Clear analyzing state
      set((state) => {
        const newProgress = { ...state.analysisProgress };
        delete newProgress[documentId];
        return {
          isAnalyzing: false,
          analysisProgress: newProgress,
        };
      });

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      console.log('[DocumentsStore] Analysis completed successfully');
    } catch (error) {
      console.error('[DocumentsStore] Analysis error:', error);

      // Clear analyzing state
      set((state) => {
        const newProgress = { ...state.analysisProgress };
        delete newProgress[documentId];
        return {
          isAnalyzing: false,
          analysisProgress: newProgress,
          error: error instanceof Error ? error.message : 'Analysis failed',
        };
      });

      throw error;
    }
  },

  /**
   * Refresh upload limit for current user
   */
  refreshUploadLimit: async (userId: string) => {
    try {
      const limit = await checkUploadLimit(userId);
      set({ uploadLimit: limit });
      console.log('[DocumentsStore] Upload limit refreshed:', limit);
    } catch (error) {
      console.error('[DocumentsStore] Error refreshing upload limit:', error);
    }
  },

  /**
   * Clear analysis error for a document
   */
  clearAnalysisError: async (documentId: string) => {
    try {
      if (!isSupabaseConfigured()) {
        console.warn('[DocumentsStore] Supabase not configured');
        return;
      }

      const { error } = await supabase
        .from('documents')
        .update({
          ai_analysis_status: 'pending',
          ai_analysis_error: null,
        })
        .eq('id', documentId);

      if (error) throw error;

      // Refresh documents
      const localDocuments = get().documents;
      const document = localDocuments.find((doc) => doc.id === documentId);
      if (document?.user_id) {
        await get().fetchDocuments(document.user_id, true);
      }

      console.log('[DocumentsStore] Analysis error cleared for:', documentId);
    } catch (error) {
      console.error('[DocumentsStore] Error clearing analysis error:', error);
    }
  },

  /**
   * Retry analysis for a failed document
   */
  retryAnalysis: async (documentId: string, localFilePath: string) => {
    await get().clearAnalysisError(documentId);
    await get().triggerAnalysis(documentId, localFilePath);
  },

  /**
   * Clear all local documents (AsyncStorage cache + file storage)
   * WARNING: This only clears local data. Database records remain untouched.
   * @param userId - User ID for cache clearing
   */
  clearAllLocalDocuments: async (userId?: string) => {
    try {
      console.log('[DocumentsStore] Clearing all local documents...');

      // 1. Clear in-memory documents
      set({ documents: [], error: null });
      console.log('[DocumentsStore] ✓ Cleared in-memory documents');

      // 2. Clear AsyncStorage cache
      if (userId) {
        const { clearCache } = await import('../services/cacheService');
        await clearCache(CacheKeys.documents(userId));
        console.log('[DocumentsStore] ✓ Cleared AsyncStorage cache for user:', userId);
      }

      // 3. Delete all files from FamilyCareHealth directory
      const { Directory, Paths } = await import('expo-file-system');

      if (Paths.document) {
        const APP_FOLDER_NAME = 'FamilyCareHealth';
        const appDir = new Directory(Paths.document, APP_FOLDER_NAME);

        if (appDir.exists) {
          console.log('[DocumentsStore] Deleting FamilyCareHealth directory...');
          await appDir.delete();
          console.log('[DocumentsStore] ✓ Deleted all local document files');
        } else {
          console.log('[DocumentsStore] FamilyCareHealth directory does not exist');
        }
      }

      console.log('[DocumentsStore] ✅ All local documents cleared successfully');
      console.log('[DocumentsStore] Note: Database records remain unchanged (manual cleanup required)');
    } catch (error) {
      console.error('[DocumentsStore] Error clearing local documents:', error);
      throw error;
    }
  },

  /**
   * Clear all cloud documents for a user
   * THIS IS A DESTRUCTIVE ACTION
   */
  clearAllCloudDocuments: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      console.log('[DocumentsStore] Clearing ALL cloud documents for user:', userId);

      // 1. Fetch all documents for this user to get R2 keys
      const { data: userDocs, error: fetchError } = await supabase
        .from('documents')
        .select('id, cloud_file_key')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      // 2. Delete from R2 (best effort)
      if (userDocs && userDocs.length > 0) {
        console.log(`[DocumentsStore] Found ${userDocs.length} documents to delete`);
        const deletionPromises = userDocs
          .filter(doc => doc.cloud_file_key)
          .map(doc => deleteFileFromR2(doc.cloud_file_key!));

        // Wait for all R2 deletions (parallel)
        await Promise.allSettled(deletionPromises);
        console.log('[DocumentsStore] R2 cleanup completed');
      }

      // 3. Delete from Supabase - Order matters for Foreign Keys
      // Delete test_results first (child of lab_reports)
      const { error: testResultsError } = await supabase
        .from('test_results')
        .delete()
        .eq('user_id', userId);

      if (testResultsError) {
        console.error('[DocumentsStore] Error deleting test_results:', testResultsError);
        // Continue to try deleting other data
      }

      // Delete lab_reports (child of documents)
      const { error: labReportsError } = await supabase
        .from('lab_reports')
        .delete()
        .eq('user_id', userId);

      if (labReportsError) {
        console.error('[DocumentsStore] Error deleting lab_reports:', labReportsError);
      }

      // Delete documents (parent)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 4. Clear local state and cache to prevent ghost data on reload
      set({ documents: [], isLoading: false });
      await saveToCache(CacheKeys.documents(userId), []);

      console.log('[DocumentsStore] ✅ All cloud documents cleared successfully');
    } catch (error) {
      console.error('[DocumentsStore] Error clearing cloud documents:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to clear cloud documents',
        isLoading: false,
      });
      throw error;
    }
  },
}));
