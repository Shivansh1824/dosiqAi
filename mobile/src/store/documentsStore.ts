import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Document, DocumentsStore, getDocumentColor } from '../types/document';
import { saveToCache, loadFromCache, CacheKeys } from '../services/cacheService';
import { analyzeDocument, checkUploadLimit, incrementUploadCount, UploadLimitInfo } from '../services/documentAnalysisService';

/**
 * Zustand store for documents state
 * Integrates with Supabase to fetch user documents
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

      // Add color to each document based on type
      const documentsWithColor: Document[] = (data || []).map((doc) => ({
        ...doc,
        color: doc.color || getDocumentColor(doc.type),
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

      const newDoc = {
        ...doc,
        color: doc.color || getDocumentColor(doc.type),
      };

      const { data, error } = await supabase
        .from('documents')
        .insert(newDoc)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Add to local state
      const documents = get().documents;
      set({
        documents: [data, ...documents],
        isLoading: false,
      });

      console.log('[DocumentsStore] Document added:', data.id);

      // Return the saved document with its UUID
      return data;
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
   * Delete a document from Supabase
   */
  deleteDocument: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

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

      if (document?.user_id) {

        if ((aiGeneratedFilename || aiDocumentType) && isSupabaseConfigured()) {
          try {
            const updateFields: { title?: string; type?: string } = {};

            // Handle filename update with duplicate checking
            if (aiGeneratedFilename) {
              let finalTitle = aiGeneratedFilename;
              const existingDocs = get().documents.filter(
                (doc) => doc.id !== documentId && doc.user_id === document.user_id
              );

              // Find all documents with the same base filename
              const duplicates = existingDocs.filter((doc) => {
                // Check if title matches exactly or has a number suffix
                return doc.title === aiGeneratedFilename ||
                  doc.title.match(new RegExp(`^${aiGeneratedFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(\\d+\\)$`));
              });

              if (duplicates.length > 0) {
                // Find the highest number used
                let maxNumber = 0;
                duplicates.forEach((doc) => {
                  const match = doc.title.match(/\((\d+)\)$/);
                  if (match) {
                    maxNumber = Math.max(maxNumber, parseInt(match[1]));
                  } else if (doc.title === aiGeneratedFilename) {
                    maxNumber = Math.max(maxNumber, 0);
                  }
                });

                // Append next number
                finalTitle = `${aiGeneratedFilename} (${maxNumber + 1})`;
              }

              updateFields.title = finalTitle;
            }

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

            // Update document in Supabase
            if (Object.keys(updateFields).length > 0) {
              console.log('[DocumentsStore] Updating document with fields:', updateFields);
              const { error: updateError } = await supabase
                .from('documents')
                .update(updateFields)
                .eq('id', documentId);

              if (updateError) {
                console.error('[DocumentsStore] Error updating document:', updateError);
              } else {
                console.log('[DocumentsStore] Successfully updated document title/type');
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
}));
