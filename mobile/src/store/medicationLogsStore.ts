import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { MedicationLog, MedicationStatus } from '../types/medicationSchedule';
import { toLocalDateString } from '../utils/dateUtils';

interface MedicationLogsStore {
  logs: MedicationLog[];
  isLoading: boolean;
  error: string | null;

  // Fetch logs for a specific date
  fetchLogsForDate: (userId: string, date: Date) => Promise<void>;

  // Mark medication as taken
  markAsTaken: (
    userId: string,
    medicationId: string,
    scheduledDate: string,
    scheduledTime: string
  ) => Promise<MedicationLog>;

  // Mark medication as skipped
  markAsSkipped: (
    userId: string,
    medicationId: string,
    scheduledDate: string,
    scheduledTime: string
  ) => Promise<MedicationLog>;

  // Undo taken (mark back as pending)
  undoTaken: (logId: string) => Promise<void>;

  // Get log for specific medication/date/time
  getLog: (medicationId: string, scheduledDate: string, scheduledTime: string) => MedicationLog | undefined;

  // Clear logs (for logout)
  clearLogs: () => void;
}

export const useMedicationLogsStore = create<MedicationLogsStore>((set, get) => ({
  logs: [],
  isLoading: false,
  error: null,

  clearLogs: () => set({ logs: [], error: null }),

  fetchLogsForDate: async (userId: string, date: Date) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        set({ logs: [], isLoading: false });
        return;
      }

      const dateStr = toLocalDateString(date);

      const { data, error } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', dateStr);

      if (error) throw error;

      console.log('[MedicationLogsStore] Fetched', (data || []).length, 'logs for', dateStr);
      set({ logs: data || [], isLoading: false });
    } catch (error) {
      console.error('[MedicationLogsStore] Fetch error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
        isLoading: false,
      });
    }
  },

  markAsTaken: async (userId, medicationId, scheduledDate, scheduledTime) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      const now = new Date().toISOString();

      // Upsert: create if doesn't exist, update if exists
      const { data, error } = await supabase
        .from('medication_logs')
        .upsert({
          medication_id: medicationId,
          user_id: userId,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          taken_at: now,
          status: 'taken' as MedicationStatus,
          updated_at: now,
        }, {
          onConflict: 'medication_id,scheduled_date,scheduled_time',
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      const logs = get().logs;
      const existingIndex = logs.findIndex(
        log => log.medication_id === medicationId &&
               log.scheduled_date === scheduledDate &&
               log.scheduled_time === scheduledTime
      );

      if (existingIndex >= 0) {
        logs[existingIndex] = data;
      } else {
        logs.push(data);
      }

      set({ logs: [...logs] });

      console.log('[MedicationLogsStore] Medication marked as taken:', medicationId);
      return data;
    } catch (error) {
      console.error('[MedicationLogsStore] Mark as taken error:', error);
      throw error;
    }
  },

  markAsSkipped: async (userId, medicationId, scheduledDate, scheduledTime) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      const now = new Date().toISOString();

      // Upsert: create if doesn't exist, update if exists
      const { data, error } = await supabase
        .from('medication_logs')
        .upsert({
          medication_id: medicationId,
          user_id: userId,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          taken_at: null, // Not taken
          status: 'skipped' as MedicationStatus,
          updated_at: now,
        }, {
          onConflict: 'medication_id,scheduled_date,scheduled_time',
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      const logs = get().logs;
      const existingIndex = logs.findIndex(
        log => log.medication_id === medicationId &&
               log.scheduled_date === scheduledDate &&
               log.scheduled_time === scheduledTime
      );

      if (existingIndex >= 0) {
        logs[existingIndex] = data;
      } else {
        logs.push(data);
      }

      set({ logs: [...logs] });

      console.log('[MedicationLogsStore] Medication marked as skipped:', medicationId);
      return data;
    } catch (error) {
      console.error('[MedicationLogsStore] Mark as skipped error:', error);
      throw error;
    }
  },

  undoTaken: async (logId: string) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      // Delete the log entry (revert to pending)
      const { error } = await supabase
        .from('medication_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      // Remove from local state
      const logs = get().logs.filter(log => log.id !== logId);
      set({ logs });

      console.log('[MedicationLogsStore] Medication log undone:', logId);
    } catch (error) {
      console.error('[MedicationLogsStore] Undo taken error:', error);
      throw error;
    }
  },

  getLog: (medicationId, scheduledDate, scheduledTime) => {
    return get().logs.find(
      log => log.medication_id === medicationId &&
             log.scheduled_date === scheduledDate &&
             log.scheduled_time === scheduledTime
    );
  },
}));
