import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Medication, MedicationsStore, medicationColors } from '../types/medication';
import { saveToCache, loadFromCache, CacheKeys } from '../services/cacheService';
import { ParsedMedication } from '../types/medicationVerification';
import { calculateEndDate } from '../utils/medicationParser';

/**
 * Zustand store for medications state
 * Integrates with Supabase to fetch user medications
 *
 * Color Management Strategy:
 * - Colors calculated on-the-fly, NOT stored in database
 * - Uses index-based cycling through 7 professional colors
 * - When fetching: colors calculated from medication index
 * - When adding: colors NOT sent to database, calculated after insert
 */
export const useMedicationsStore = create<MedicationsStore>((set, get) => ({
  // Initial state
  medications: [],
  isLoading: false,
  error: null,

  clearMedications: () => set({ medications: [], error: null }),

  /**
   * Load medications from cache
   * @returns true if cache was found and loaded, false otherwise
   */
  loadFromCache: async (userId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const cached = await loadFromCache<Medication[]>(CacheKeys.medications(userId));
      if (cached && cached.length > 0) {
        console.log('[MedicationsStore] Loaded', cached.length, 'medications from cache');
        set({ medications: cached, isLoading: false });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[MedicationsStore] Error loading from cache:', error);
      return false;
    }
  },

  /**
   * Fetch medications for a specific user from Supabase
   * @param userId - User ID
   * @param silent - If true, don't show loading spinner (for background refresh)
   */
  fetchMedications: async (userId: string, silent = false) => {
    if (!userId) {
      console.warn('[MedicationsStore] No user ID provided');
      set({ medications: [], isLoading: false });
      return;
    }

    // Only show loading spinner if not a silent refresh
    if (!silent) {
      set({ isLoading: true, error: null });
    }

    try {
      if (!isSupabaseConfigured()) {
        console.warn('[MedicationsStore] Supabase not configured');
        set({ medications: [], isLoading: false });
        return;
      }

      console.log(`[MedicationsStore] Fetching medications for user: ${userId} (silent: ${silent})`);

      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MedicationsStore] Fetch error:', error);
        set({ error: error.message, isLoading: false });
        return;
      }

      // Calculate color from index (7 colors cycling)
      const medicationsWithColor: Medication[] = (data || []).map((med, index) => ({
        ...med,
        color: medicationColors[index % medicationColors.length], // Always calculate from index
      }));

      // Save to cache for next time
      await saveToCache(CacheKeys.medications(userId), medicationsWithColor);

      console.log('[MedicationsStore] Fetched', medicationsWithColor.length, 'medications');
      set({ medications: medicationsWithColor, isLoading: false });
    } catch (error) {
      console.error('[MedicationsStore] Unexpected error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch medications',
        isLoading: false,
      });
    }
  },

  /**
   * Add a new medication to Supabase
   */
  addMedication: async (med) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      const medications = get().medications;
      const newMed = {
        ...med,
        // color will be calculated when fetched, no need to include here
      };

      const { data, error } = await supabase
        .from('medications')
        .insert(newMed)
        .select()
        .single();

      if (error) throw error;

      set({
        medications: [data, ...medications],
        isLoading: false,
      });

      console.log('[MedicationsStore] Medication added:', data.id);
    } catch (error) {
      console.error('[MedicationsStore] Add medication error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add medication',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Update a medication in Supabase
   */
  updateMedication: async (id: string, updates: Partial<Medication>) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      const { data, error } = await supabase
        .from('medications')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const medications = get().medications.map((med) =>
        med.id === id ? data : med
      );
      set({ medications, isLoading: false });

      console.log('[MedicationsStore] Medication updated:', id);
    } catch (error) {
      console.error('[MedicationsStore] Update medication error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to update medication',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Delete a medication from Supabase
   */
  deleteMedication: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const medications = get().medications.filter((med) => med.id !== id);
      set({ medications, isLoading: false });

      console.log('[MedicationsStore] Medication deleted:', id);
    } catch (error) {
      console.error('[MedicationsStore] Delete medication error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to delete medication',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Add medication from AI extraction with source tracking
   * Specialized version of addMedication for AI-extracted medications
   */
  addMedicationFromAI: async (
    parsedMed: ParsedMedication,
    userId: string,
    documentId: string,
    documentTitle: string,
    startDate: string,
    color?: string
  ): Promise<Medication> => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      const medications = get().medications;

      // Calculate end date if duration is provided
      let endDate: string | undefined;
      if (parsedMed.duration_days) {
        endDate = calculateEndDate(startDate, parsedMed.duration_days);
      }

      const newMed: Omit<Medication, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        name: parsedMed.name,
        dosage: parsedMed.dosage,
        frequency: parsedMed.frequency,
        time_of_day: parsedMed.time_of_day,
        start_date: startDate,
        end_date: endDate,
        notes: parsedMed.notes,
        // color removed - will be calculated from index when fetched
        is_active: true,

        // Source tracking fields
        source_document_id: documentId,
        source_document_title: documentTitle,
        ai_extracted: parsedMed.ai_extracted,
        verified_by_user: parsedMed.verified_by_user,
        original_frequency_code: parsedMed.original_frequency_code,
        scientific_name: parsedMed.scientific_name,
      };

      const { data, error } = await supabase
        .from('medications')
        .insert(newMed)
        .select()
        .single();

      if (error) throw error;

      set({
        medications: [data, ...medications],
        isLoading: false,
      });

      console.log('[MedicationsStore] AI medication added:', data.id);

      // Refresh cache
      await saveToCache(CacheKeys.medications(userId), [data, ...medications]);

      return data;
    } catch (error) {
      console.error('[MedicationsStore] Add AI medication error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add medication',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Get all active medications (not expired)
   * Used for duplicate detection
   */
  getActiveMedications: (): Medication[] => {
    const medications = get().medications;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison

    return medications.filter(med => {
      if (!med.is_active) return false;

      // Check if expired
      if (med.end_date) {
        const endDate = new Date(med.end_date);
        if (endDate < today) return false;
      }

      return true;
    });
  },

  /**
   * Replace an existing medication with a new one from AI extraction
   * Used when user chooses "Replace" for duplicate
   */
  replaceMedication: async (oldMedicationId: string, newMedicationData: Omit<Medication, 'id' | 'created_at' | 'updated_at'>): Promise<Medication> => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      // Mark old medication as inactive (soft delete)
      await get().updateMedication(oldMedicationId, {
        is_active: false,
        updated_at: new Date().toISOString(),
      });

      // Add new medication
      const { data, error } = await supabase
        .from('medications')
        .insert(newMedicationData)
        .select()
        .single();

      if (error) throw error;

      const medications = get().medications.map(med =>
        med.id === oldMedicationId ? { ...med, is_active: false } : med
      );

      set({
        medications: [data, ...medications],
        isLoading: false,
      });

      console.log('[MedicationsStore] Medication replaced:', oldMedicationId, '->', data.id);

      return data;
    } catch (error) {
      console.error('[MedicationsStore] Replace medication error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to replace medication',
        isLoading: false,
      });
      throw error;
    }
  },
}));
