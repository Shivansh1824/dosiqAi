import { create } from 'zustand';
import { from } from '../lib/apiClient';
import { Medication, MedicationsStore, medicationColors } from '../types/medication';
import { saveToCache, loadFromCache, CacheKeys } from '../services/cacheService';
import { ParsedMedication } from '../types/medicationVerification';
import { calculateEndDate } from '../utils/medicationParser';
import { sanitizeErrorMessage, withRetry } from '../utils/apiUtils';

/**
 * Zustand store for medications state
 * Integrates with the API to fetch user medications
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
  isInitialized: false,
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
    // PREVENT redundant fetches
    if (!userId || (get().isLoading && !silent) || (get().isInitialized && !silent)) {
      if (!userId) console.warn('[MedicationsStore] No user ID provided');
      return;
    }

    if (!silent) {
      set({ isLoading: true, error: null });
    }

    try {
      console.log(`[MedicationsStore] Fetching schedules for user: ${userId} (silent: ${silent})`);

      const data = await withRetry(async () => {
        const { data: result, error } = await from('medication_schedules')
          .select(`
            *,
            source_document:source_document_id (
               id
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return result;
      }, 2, 1000, 'fetchMedications');

      const medications: Medication[] = (data || []).map((row: any, index: number) => {
        const rawStart = row.start_date;
        const normalizedStart = row.start_date ? row.start_date.substring(0, 10) : row.start_date;
        
        if (index === 0) {
          console.log(`[Store] 🗓️ Date Normalization: ${rawStart} -> ${normalizedStart}`);
          console.log(`[Store] 🌍 Medication Timezone: ${row.timezone || 'Not set'}`);
        }
        // Map interval_days + times_per_day to frequency enum
        let frequency: any = 'once_daily';
        if (row.interval_days === 0) frequency = 'as_needed';
        else if (row.interval_days === 7) frequency = 'weekly';
        else if (row.interval_days === 30) frequency = 'monthly';
        else if (row.interval_days === 1) {
          if (row.times_per_day === 2) frequency = 'twice_daily';
          else if (row.times_per_day === 3) frequency = 'three_times_daily';
          else if (row.times_per_day === 4) frequency = 'four_times_daily';
        }

        return {
          id: row.id,
          user_id: row.user_id,
          family_member_id: row.family_member_id,
          name: row.name,
          generic_name: row.generic_name,
          medicine_type: row.medicine_type,
          medicine_purpose: row.medicine_purpose,
          form: row.form,
          strength: row.strength,

          dosage: row.dosage_instruction || '',
          global_frequency: frequency, // Avoid naming collision if needed, but 'frequency' is in interface
          frequency: frequency,

          time_of_day: (typeof row.reminder_times === 'string' ? JSON.parse(row.reminder_times) : row.reminder_times) || [],
          interval_days: row.interval_days,
          timing_dosage: row.timing_dosage,
          times_per_day: row.times_per_day,

          start_date: row.start_date ? row.start_date.substring(0, 10) : row.start_date,
          end_date: row.end_date ? row.end_date.substring(0, 10) : row.end_date,
          duration_days: row.duration_days,

          notes: row.notes,
          color: medicationColors[index % medicationColors.length],

          created_at: row.created_at,
          updated_at: row.updated_at,

          source_document_id: row.source_document_id,

          // source_document_title not joined, can be fetched if really needed
          ai_extracted: !!row.source_document_id,
          verified_by_user: true, // If it's in this table, it's verified
          ai_confidence: row.ai_confidence,
          food_relationship: row.food_relationship as any,
          timezone: row.timezone,
        };
      });

      // Save to cache
      await saveToCache(CacheKeys.medications(userId), medications);
      set({ medications, isLoading: false, isInitialized: true });
    } catch (error) {
      console.error('[MedicationsStore] Unexpected error:', error);
      set({
        error: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Failed to fetch medications',
        isLoading: false,
      });
    }
  },

  /**
   * Add a new medication to Supabase
   */
  addMedication: async (med): Promise<Medication | null> => {
    set({ isLoading: true, error: null });

    try {
      if (!med.family_member_id) throw new Error('Family member ID is required');

      // Map UI fields to DB fields
      const newSchedule = {
        user_id: med.user_id,
        family_member_id: med.family_member_id,
        name: med.name,
        dosage_instruction: med.dosage,
        reminder_times: med.time_of_day?.length ? JSON.stringify(med.time_of_day) : null,
        interval_days: med.interval_days || 1, // Default to daily if missing
        start_date: med.start_date,
        end_date: med.end_date,
        duration_days: med.duration_days,
        notes: med.notes,

        food_relationship: med.food_relationship,
        // Optional fields
        generic_name: med.generic_name,
        medicine_type: med.medicine_type,
        medicine_purpose: med.medicine_purpose,
        form: med.form,
        strength: med.strength,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      
      console.log(`[Store] ➕ Adding Medication with Timezone: ${newSchedule.timezone}`);

      const data = await withRetry(async () => {
        const { data: result, error } = await from('medication_schedules')
          .insert(newSchedule)
          .select()
          .single();

        if (error) throw error;
        return result;
      }, 2, 1000, 'addMedication');

      // Optimistic update - actually we should probably refetch or reconstruct the full object
      // For now, let's trigger a silent refetch to be safe and accurate
      await get().fetchMedications(med.user_id, true);

      set({ isLoading: false });
      console.log('[MedicationsStore] Schedule added:', data.id);
      return data as Medication;
    } catch (error) {
      console.error('[MedicationsStore] Add error:', error);
      set({ error: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Failed to add', isLoading: false });
      throw error;
    }
  },

  /**
   * Update a medication in Supabase
   */
  updateMedication: async (id: string, updates: Partial<Medication>): Promise<Medication | null> => {
    set({ isLoading: true, error: null });

    try {
      // Map updates to DB columns
      const dbUpdates: any = { ...updates, updated_at: new Date().toISOString() };

      // Remap specific fields if present
      if (updates.dosage !== undefined) {
        dbUpdates.dosage_instruction = updates.dosage;
        delete dbUpdates.dosage;
      }
      if (updates.time_of_day !== undefined) {
        dbUpdates.reminder_times = updates.time_of_day?.length ? JSON.stringify(updates.time_of_day) : null;
        delete dbUpdates.time_of_day;
      }
      // Note: mapping frequency back to interval_days is tricky here without more logic.
      // Ideally we update interval_days directly if changed.

      const data = await withRetry(async () => {
        const { data: result, error } = await from('medication_schedules')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return result;
      }, 2, 1000, 'updateMedication');

      // Refetch to sync state perfectly
      await get().fetchMedications(data.user_id, true);


      console.log('[MedicationsStore] Updated:', id);
      return data as Medication;
    } catch (error) {
      console.error('[MedicationsStore] Update error:', error);
      set({ error: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Failed', isLoading: false });
      throw error;
    }
  },

  /**
   * Delete a medication from Supabase
   */
  deleteMedication: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await withRetry(async () => {
        const { error } = await from('medication_schedules')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }, 2, 1000, 'deleteMedication');

      // Update local state
      const medications = get().medications.filter((med) => med.id !== id);
      set({ medications, isLoading: false });

      // Update cache to prevent zombie items on reload
      const userId = medications.length > 0 ? medications[0].user_id : null;
      if (userId) {
        saveToCache(CacheKeys.medications(userId), medications);
      }
    } catch (error) {
      set({ error: 'Failed to delete', isLoading: false });
      throw error;
    }
  },

  /**
   * Delete ALL medications for a user
   */
  deleteAllMedications: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      await withRetry(async () => {
        const { error } = await from('medication_schedules')
          .delete()
          .eq('user_id', userId);

        if (error) throw error;
      }, 2, 1000, 'deleteAllMedications');

      // Update local state by clearing all medications
      set({ medications: [], isLoading: false });

      // Update cache
      saveToCache(CacheKeys.medications(userId), []);
    } catch (error) {
      set({ error: 'Failed to delete all medications', isLoading: false });
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
    familyMemberId: string,
    color?: string
  ): Promise<Medication> => {
    set({ isLoading: true, error: null });

    try {
      if (!familyMemberId) throw new Error('Family member ID required for AI medication');

      const medStartDate = parsedMed.start_date || startDate;
      let endDate: string | undefined;
      if (parsedMed.duration_days) {
        endDate = calculateEndDate(medStartDate, parsedMed.duration_days);
      }

      const newSchedule = {
        user_id: userId,
        family_member_id: familyMemberId,
        name: parsedMed.name,

        // Detailed info
        generic_name: parsedMed.generic_name,
        medicine_type: parsedMed.medicine_type,
        medicine_purpose: parsedMed.medicine_purpose,
        form: parsedMed.form,
        strength: parsedMed.strength,

        // Scheduling
        dosage_instruction: parsedMed.dosage,
        timing_dosage: parsedMed.timing_dosage,
        times_per_day: parsedMed.total_times_per_day,
        reminder_times: parsedMed.time_of_day?.length ? JSON.stringify(parsedMed.time_of_day) : null,
        food_relationship: parsedMed.food_relationship,
        interval_days: parsedMed.interval_days !== null ? parsedMed.interval_days : 1,

        start_date: medStartDate,
        duration_days: parsedMed.duration_days,
        end_date: endDate,

        notes: parsedMed.notes,

        // Metadata
        source_document_id: documentId,
        ai_confidence: 0.95,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const data = await withRetry(async () => {
        const { data: result, error } = await from('medication_schedules')
          .insert(newSchedule)
          .select()
          .single();

        if (error) throw error;
        return result;
      }, 2, 1000, 'addMedicationFromAI');

      console.log('[MedicationsStore] AI Schedule added:', data.id);

      // Refresh to get the full list with correct colors
      await get().fetchMedications(userId, true);

      // Return a dummy object or the last added one from state. 
      // Since we just refetched, we can find it in the new state.
      const freshMeds = get().medications;
      const addedMed = freshMeds.find(m => m.id === data.id) || freshMeds[0]; // Fallback
      return addedMed;

    } catch (error) {
      console.error('[MedicationsStore] Add AI error:', error);
      set({ error: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Failed', isLoading: false });
      throw error;
    }
  },

  /**
   * Add multiple medications from AI extraction in one batch
   */
  addMedicationsBatchFromAI: async (
    parsedMeds: ParsedMedication[],
    userId: string,
    documentId: string,
    documentTitle: string,
    startDate: string,
    familyMemberId: string
  ): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      if (!familyMemberId) throw new Error('Family member ID required for AI medication');

      const newSchedules = parsedMeds.map(parsedMed => {
        const medStartDate = parsedMed.start_date || startDate;
        let endDate: string | undefined;
        if (parsedMed.duration_days) {
          endDate = calculateEndDate(medStartDate, parsedMed.duration_days);
        }

        return {
          user_id: userId,
          family_member_id: familyMemberId,
          name: parsedMed.name,

          // Detailed info
          generic_name: parsedMed.generic_name,
          medicine_type: parsedMed.medicine_type,
          medicine_purpose: parsedMed.medicine_purpose,
          form: parsedMed.form,
          strength: parsedMed.strength,

          // Scheduling
          dosage_instruction: parsedMed.dosage,
          timing_dosage: parsedMed.timing_dosage,
          times_per_day: parsedMed.total_times_per_day,
          reminder_times: parsedMed.time_of_day?.length ? JSON.stringify(parsedMed.time_of_day) : null,
          food_relationship: parsedMed.food_relationship,
          interval_days: parsedMed.interval_days !== null ? parsedMed.interval_days : 1,

          start_date: medStartDate,
          duration_days: parsedMed.duration_days,
          end_date: endDate,

          notes: parsedMed.notes,

          // Metadata
          source_document_id: documentId,
          ai_confidence: 0.95,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      });

      await withRetry(async () => {
        const { error } = await from('medication_schedules')
          .insert(newSchedules);

        if (error) throw error;
      }, 2, 1000, 'addMedicationsBatchFromAI');

      console.log('[MedicationsStore] Batch AI schedules added:', newSchedules.length);

      // Refresh to get the full list with correct colors
      await get().fetchMedications(userId, true);

      set({ isLoading: false });
    } catch (error) {
      console.error('[MedicationsStore] Batch Add AI error:', error);
      set({ error: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Failed', isLoading: false });
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
      // Check if started
      if (med.start_date) {
        const startDate = new Date(med.start_date);
        if (startDate > today) return false;
      }

      // Check if expired / ended
      if (med.end_date) {
        const endDate = new Date(med.end_date);
        endDate.setHours(0, 0, 0, 0); // Normalize end date too
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
      // Mark old medication as inactive (soft delete by setting end date to yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await get().updateMedication(oldMedicationId, {
        end_date: yesterday.toISOString(),
        updated_at: new Date().toISOString(),
      });


      // Add new medication
      const data = await withRetry(async () => {
        const { data: result, error } = await from('medication_schedules')
          .insert(newMedicationData)
          .select()
          .single();

        if (error) throw error;
        return result;
      }, 2, 1000, 'replaceMedication');

      const medications = get().medications.map(med =>
        med.id === oldMedicationId ? { ...med, end_date: new Date(Date.now() - 86400000).toISOString() } : med
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
        error: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Failed to replace medication',
        isLoading: false,
      });
      throw error;
    }
  },
}));
