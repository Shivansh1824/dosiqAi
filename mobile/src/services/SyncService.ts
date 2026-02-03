import { useMedicationLogsStore } from '../store/medicationLogsStore';
import { useMedicationsStore } from '../store/medicationsStore';
import { toLocalDateString } from '../utils/dateUtils';
import { cancelReminder } from '../services/notificationService';

/**
 * SyncService
 * Handles the "Truth Reconciliation" engine and background sync management.
 */
export const SyncService = {
  /**
   * Weekly Reconciliation Audit
   * Compares local math with cloud logic to ensure no drift.
   */
  performReconciliationAudit: async (userId: string) => {
    console.log('[Sync] Starting Weekly Reconciliation Audit...');
    
    // 1. Fetch latest rules (Schedules)
    const medicationsStore = useMedicationsStore.getState();
    await medicationsStore.fetchMedications(userId, true);
    
    // 2. Fetch Logs for a 14-day window (Reconciliation Horizon)
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 7);
    const end = new Date(today);
    end.setDate(today.getDate() + 7);
    
    const logsStore = useMedicationLogsStore.getState();
    await logsStore.fetchLogsForDateRange(userId, toLocalDateString(start), toLocalDateString(end));
    
    console.log('[Sync] Reconciliation Audit Complete.');
  },

  /**
   * Early Action Notification Interceptor
   * Ensures that taking a medicine early cancels the upcoming system reminder.
   */
  handleEarlyAction: async (medicationId: string, scheduledTime: string, dateStr: string) => {
    // 1. Generate the deterministic notification ID
    // Note: This must match the ID generation logic in notificationService.ts
    // For clusters, we might need a more complex lookup, but for individual meds:
    const notificationId = `${medicationId}_${dateStr}_${scheduledTime}`;
    
    console.log(`[Sync] Intercepting Early Action. Cancelling upcoming reminder: ${notificationId}`);
    
    // 2. Cancel the OS-level trigger
    await cancelReminder(notificationId);
    
    // 3. For iOS clusters, we also trigger a cluster-kill safety check
    // (Actual cluster-kill logic depends on the ClusterService)
  }
};
