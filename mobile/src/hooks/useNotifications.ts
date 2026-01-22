/**
 * Hook for using notifications in components
 * Provides easy access to notification functions
 */

import { useCallback } from 'react';
import {
  scheduleMedicineReminder,
  scheduleRepeatingReminder,
  scheduleAllRemindersForMedication,
  cancelReminder,
  cancelAllReminders,
  displayTestNotification,
  getPendingReminders,
  checkPermissions,
  MedicineReminderData,
} from '../services/notificationService';

export function useNotifications() {
  /**
   * Schedule a one-time medicine reminder
   */
  const scheduleReminder = useCallback(
    async (data: MedicineReminderData) => {
      return await scheduleMedicineReminder(data);
    },
    []
  );

  /**
   * Schedule a repeating daily reminder
   */
  const scheduleDailyReminder = useCallback(
    async (data: MedicineReminderData) => {
      return await scheduleRepeatingReminder(data, 'daily');
    },
    []
  );

  /**
   * Schedule a repeating weekly reminder
   */
  const scheduleWeeklyReminder = useCallback(
    async (data: MedicineReminderData) => {
      return await scheduleRepeatingReminder(data, 'weekly');
    },
    []
  );

  /**
   * Cancel a specific reminder by ID
   */
  const cancel = useCallback(async (scheduleId: string) => {
    await cancelReminder(scheduleId);
  }, []);

  /**
   * Cancel all reminders
   */
  const cancelAll = useCallback(async () => {
    await cancelAllReminders();
  }, []);

  /**
   * Display a test notification (for development)
   */
  const testNotification = useCallback(
    async (medicationName?: string, dosage?: string) => {
      return await displayTestNotification(medicationName, dosage);
    },
    []
  );

  /**
   * Get all pending/scheduled reminders
   */
  const getPending = useCallback(async () => {
    return await getPendingReminders();
  }, []);

  /**
   * Check if notifications are permitted
   */
  const checkNotificationPermissions = useCallback(async () => {
    return await checkPermissions();
  }, []);

  /**
   * Schedule all reminders for a full medication object
   */
  const scheduleAllForMedication = useCallback(
    async (medication: any) => {
      return await scheduleAllRemindersForMedication(medication);
    },
    []
  );

  return {
    scheduleReminder,
    scheduleDailyReminder,
    scheduleWeeklyReminder,
    scheduleAllForMedication,
    cancel,
    cancelAll,
    testNotification,
    getPending,
    checkNotificationPermissions,
  };
}
