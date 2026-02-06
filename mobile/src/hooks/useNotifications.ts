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
  getPendingReminders,
  checkPermissions,
  MedicineReminderData,
} from '../services/notificationService';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { Medication } from '../types/medication';

export function useNotifications() {
  const { activeMember } = useFamilyMembersStore();

  /**
   * Schedule a one-time medicine reminder
   */
  const scheduleReminder = useCallback(
    async (data: MedicineReminderData) => {
      // Inject family member settings if not provided
      const settings = {
        reminderStyle: data.reminderStyle || activeMember?.reminder_style || 'standard',
        alertMode: data.alertMode || activeMember?.alert_display_mode || 'temporary',
        snoozeDuration: data.snoozeDuration || activeMember?.snooze_duration || 10,
      };

      return await scheduleMedicineReminder({
        ...data,
        familyMemberId: data.familyMemberId || activeMember?.id,
        ...settings,
      });
    },
    [activeMember]
  );

  /**
   * Schedule a repeating daily reminder
   */
  const scheduleDailyReminder = useCallback(
    async (data: MedicineReminderData) => {
      const settings = {
        reminderStyle: data.reminderStyle || activeMember?.reminder_style || 'standard',
        alertMode: data.alertMode || activeMember?.alert_display_mode || 'temporary',
        snoozeDuration: data.snoozeDuration || activeMember?.snooze_duration || 10,
      };

      return await scheduleRepeatingReminder({
        ...data,
        familyMemberId: data.familyMemberId || activeMember?.id,
        ...settings,
      }, 'daily');
    },
    [activeMember]
  );

  /**
   * Schedule a repeating weekly reminder
   */
  const scheduleWeeklyReminder = useCallback(
    async (data: MedicineReminderData) => {
      const settings = {
        reminderStyle: data.reminderStyle || activeMember?.reminder_style || 'standard',
        alertMode: data.alertMode || activeMember?.alert_display_mode || 'temporary',
        snoozeDuration: data.snoozeDuration || activeMember?.snooze_duration || 10,
      };

      return await scheduleRepeatingReminder({
        ...data,
        familyMemberId: data.familyMemberId || activeMember?.id,
        ...settings,
      }, 'weekly');
    },
    [activeMember]
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
    getPending,
    checkNotificationPermissions,
  };
}
