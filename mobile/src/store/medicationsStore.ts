import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Medication, MedicationsStore, medicationColors } from '../types/medication';
import { saveToCache, loadFromCache, CacheKeys } from '../services/cacheService';

/**
 * Zustand store for medications state
 * Integrates with Supabase to fetch user medications
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

      // Add color if not present
      const medicationsWithColor: Medication[] = (data || []).map((med, index) => ({
        ...med,
        color: med.color || medicationColors[index % medicationColors.length],
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
        color: med.color || medicationColors[medications.length % medicationColors.length],
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
}));
