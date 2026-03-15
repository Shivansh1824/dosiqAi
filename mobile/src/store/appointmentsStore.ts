import { create } from 'zustand';
import { from } from '../lib/apiClient';
import { Appointment, AppointmentsStore, getAppointmentColor } from '../types/appointment';
import { saveToCache, loadFromCache, CacheKeys } from '../services/cacheService';

/**
 * Zustand store for appointments state
 * Integrates with the API to fetch user appointments
 */
export const useAppointmentsStore = create<AppointmentsStore>((set, get) => ({
  // Initial state
  appointments: [],
  isLoading: false,
  error: null,

  clearAppointments: () => set({ appointments: [], error: null }),

  /**
   * Load appointments from cache
   * @returns true if cache was found and loaded, false otherwise
   */
  loadFromCache: async (userId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const cached = await loadFromCache<Appointment[]>(CacheKeys.appointments(userId));
      if (cached && cached.length > 0) {
        console.log('[AppointmentsStore] Loaded', cached.length, 'appointments from cache');
        set({ appointments: cached, isLoading: false });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[AppointmentsStore] Error loading from cache:', error);
      return false;
    }
  },

  /**
   * Fetch appointments for a specific user from the backend
   * @param userId - User ID
   * @param silent - If true, don't show loading spinner (for background refresh)
   */
  fetchAppointments: async (userId: string, silent = false) => {
    if (!userId) {
      console.warn('[AppointmentsStore] No user ID provided');
      set({ appointments: [], isLoading: false });
      return;
    }

    // Only show loading spinner if not a silent refresh
    if (!silent) {
      set({ isLoading: true, error: null });
    }

    try {
      console.log(`[AppointmentsStore] Fetching appointments for user: ${userId} (silent: ${silent})`);

      // Fetch only upcoming and scheduled appointments
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await from('appointments')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        console.error('[AppointmentsStore] Fetch error:', error);
        set({ error: error.message, isLoading: false });
        return;
      }

      // Add color based on type if not present
      const appointmentsWithColor: Appointment[] = (data || []).map((apt: any) => ({
        ...apt,
        color: apt.color || getAppointmentColor(apt.appointment_type),
      }));

      // Save to cache for next time
      await saveToCache(CacheKeys.appointments(userId), appointmentsWithColor);

      console.log('[AppointmentsStore] Fetched', appointmentsWithColor.length, 'appointments');
      set({ appointments: appointmentsWithColor, isLoading: false });
    } catch (error) {
      console.error('[AppointmentsStore] Unexpected error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch appointments',
        isLoading: false,
      });
    }
  },

  /**
   * Add a new appointment to the backend
   */
  addAppointment: async (apt) => {
    set({ isLoading: true, error: null });

    try {
      const newApt = {
        ...apt,
        color: apt.color || getAppointmentColor(apt.appointment_type),
      };

      const { data, error } = await from('appointments')
        .insert(newApt)
        .select()
        .single();

      if (error) throw error;

      // Insert in sorted order
      const appointments = [...get().appointments, data].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });

      set({ appointments, isLoading: false });

      console.log('[AppointmentsStore] Appointment added:', data.id);
    } catch (error) {
      console.error('[AppointmentsStore] Add appointment error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add appointment',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Update an appointment in the backend
   */
  updateAppointment: async (id: string, updates: Partial<Appointment>) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await from('appointments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const appointments = get().appointments.map((apt) =>
        apt.id === id ? data : apt
      );
      set({ appointments, isLoading: false });

      console.log('[AppointmentsStore] Appointment updated:', id);
    } catch (error) {
      console.error('[AppointmentsStore] Update appointment error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to update appointment',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Delete an appointment from the backend
   */
  deleteAppointment: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const { error } = await from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const appointments = get().appointments.filter((apt) => apt.id !== id);
      set({ appointments, isLoading: false });

      console.log('[AppointmentsStore] Appointment deleted:', id);
    } catch (error) {
      console.error('[AppointmentsStore] Delete appointment error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to delete appointment',
        isLoading: false,
      });
      throw error;
    }
  },
}));
