import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { toLocalDateString } from '../utils/dateUtils';
import { SyncService } from '../services/SyncService';

export interface MedicationLog {
  id: string;
  medication_id: string;
  user_id: string;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string; // HH:mm
  taken_at: string | null;
  status: 'taken' | 'skipped' | 'missed' | 'pending';
  sync_status?: 'synced' | 'pending' | 'error';
}

interface MedicationLogsState {
  logs: MedicationLog[];
  isLoading: boolean;
  error: string | null;
  loadedRanges: { start: string; end: string }[];
}

interface MedicationLogsActions {
  fetchLogsForDate: (userId: string, date: Date) => Promise<void>;
  fetchLogsForDateRange: (userId: string, startDate: string, endDate: string) => Promise<void>;
  markAsTaken: (userId: string, medicationId: string, dateStr: string, timeStr: string) => Promise<void>;
  markAsSkipped: (userId: string, medicationId: string, dateStr: string, timeStr: string) => Promise<void>;
  getLog: (medicationId: string, dateStr: string, timeStr: string) => MedicationLog | undefined;
}

export const useMedicationLogsStore = create<MedicationLogsState & MedicationLogsActions>((set, get) => ({
  logs: [],
  isLoading: false,
  error: null,
  loadedRanges: [],

  fetchLogsForDate: async (userId: string, date: Date) => {
    const dateStr = toLocalDateString(date);
    return get().fetchLogsForDateRange(userId, dateStr, dateStr);
  },

  fetchLogsForDateRange: async (userId: string, startDate: string, endDate: string) => {
    const isAlreadyLoaded = get().loadedRanges.some(
      (range: { start: string; end: string }) => range.start <= startDate && range.end >= endDate
    );

    if (isAlreadyLoaded) return;

    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) return;

      const { data, error } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);

      if (error) throw error;

      const newLogs = (data || []) as MedicationLog[];
      
      set((state: MedicationLogsState) => {
        const mergedLogs = [...state.logs];
        newLogs.forEach(newLog => {
          const index = mergedLogs.findIndex(
            (l: MedicationLog) => l.medication_id === newLog.medication_id && 
                                  l.scheduled_date === newLog.scheduled_date && 
                                  l.scheduled_time === newLog.scheduled_time
          );
          
          if (index !== -1) {
            if (mergedLogs[index].sync_status !== 'pending') {
              mergedLogs[index] = { ...newLog, sync_status: 'synced' };
            }
          } else {
            mergedLogs.push({ ...newLog, sync_status: 'synced' });
          }
        });

        return {
          logs: mergedLogs,
          isLoading: false,
          loadedRanges: [...state.loadedRanges, { start: startDate, end: endDate }]
        };
      });
    } catch (error) {
      console.error('[MedicationLogsStore] Fetch range error:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  markAsTaken: async (userId: string, medicationId: string, dateStr: string, timeStr: string) => {
    const now = new Date().toISOString();
    
    // 1. Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticLog: MedicationLog = {
      id: tempId,
      medication_id: medicationId,
      user_id: userId,
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      taken_at: now,
      status: 'taken',
      sync_status: 'pending'
    };

    set((state: MedicationLogsState) => ({
      logs: [
        ...state.logs.filter((l: MedicationLog) => !(l.medication_id === medicationId && l.scheduled_date === dateStr && l.scheduled_time === timeStr)),
        optimisticLog
      ]
    }));

    try {
      // 2. Early Action (Notification suppression)
      await SyncService.handleEarlyAction(medicationId, timeStr, dateStr);

      const { error } = await supabase
        .from('medication_logs')
        .upsert({
          medication_id: medicationId,
          user_id: userId,
          scheduled_date: dateStr,
          scheduled_time: timeStr,
          taken_at: now,
          status: 'taken',
          updated_at: now
        }, {
          onConflict: 'medication_id,scheduled_date,scheduled_time'
        });

      if (error) throw error;

      set((state: MedicationLogsState) => ({
        logs: state.logs.map((l: MedicationLog) => 
          l.id === tempId ? { ...l, sync_status: 'synced' } : l
        )
      }));
    } catch (error) {
      console.error('[MedicationLogsStore] Mark as taken error:', error);
      set((state: MedicationLogsState) => ({
        logs: state.logs.map((l: MedicationLog) => 
          l.id === tempId ? { ...l, sync_status: 'error' } : l
        )
      }));
    }
  },

  markAsSkipped: async (userId: string, medicationId: string, dateStr: string, timeStr: string) => {
    const now = new Date().toISOString();
    
    const tempId = `temp-skip-${Date.now()}`;
    const optimisticLog: MedicationLog = {
      id: tempId,
      medication_id: medicationId,
      user_id: userId,
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      taken_at: null,
      status: 'skipped',
      sync_status: 'pending'
    };

    set((state: MedicationLogsState) => ({
      logs: [
        ...state.logs.filter((l: MedicationLog) => !(l.medication_id === medicationId && l.scheduled_date === dateStr && l.scheduled_time === timeStr)),
        optimisticLog
      ]
    }));

    try {
      // 2. Early Action (Notification suppression)
      await SyncService.handleEarlyAction(medicationId, timeStr, dateStr);

      const { error } = await supabase
        .from('medication_logs')
        .upsert({
          medication_id: medicationId,
          user_id: userId,
          scheduled_date: dateStr,
          scheduled_time: timeStr,
          taken_at: null,
          status: 'skipped',
          updated_at: now
        }, {
          onConflict: 'medication_id,scheduled_date,scheduled_time'
        });

      if (error) throw error;

      set((state: MedicationLogsState) => ({
        logs: state.logs.map((l: MedicationLog) => 
          l.id === tempId ? { ...l, sync_status: 'synced' } : l
        )
      }));
    } catch (error) {
      console.error('[MedicationLogsStore] Mark as skipped error:', error);
      set((state: MedicationLogsState) => ({
        logs: state.logs.map((l: MedicationLog) => 
          l.id === tempId ? { ...l, sync_status: 'error' } : l
        )
      }));
    }
  },

  getLog: (medicationId: string, dateStr: string, timeStr: string) => {
    return get().logs.find(
      (l: MedicationLog) => l.medication_id === medicationId && 
                            l.scheduled_date === dateStr && 
                            l.scheduled_time === timeStr
    );
  }
}));
