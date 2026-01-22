/**
 * Notification Service for Medicine Reminders
 * 
 * Features:
 * - Full-screen alarm UI for Android
 * - Time-Sensitive notifications for iOS  
 * - Action buttons: Taken, Snooze, Skip
 * - Background event handling
 */

import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  TimestampTrigger,
  TriggerType,
  RepeatFrequency,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { Medication } from '../types/medication';

// Notification channel ID for Android
const MEDICATION_CHANNEL_ID = 'medication-reminders';

// iOS category ID for action buttons
const MEDICATION_CATEGORY_ID = 'medication-actions';

// Types
export interface MedicineReminderData {
  medicationId: string;
  medicationName: string;
  dosage: string;
  instructions?: string;
  scheduleId: string;
  scheduledTime: Date;
}

/**
 * Initialize notification service
 * Call this on app startup
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    // Request permissions
    const settings = await notifee.requestPermission({
      sound: true,
      alert: true,
      badge: true,
      criticalAlert: true, // Request Critical Alerts (requires Apple approval)
    });

    if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
      console.log('[Notifications] Permission denied');
      return false;
    }

    // Create Android notification channel
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: MEDICATION_CHANNEL_ID,
        name: 'Medication Reminders',
        description: 'Reminders to take your medications',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
        lights: true,
        lightColor: '#4F46E5',
      });
    }

    // Set up iOS notification categories with actions
    await notifee.setNotificationCategories([
      {
        id: MEDICATION_CATEGORY_ID,
        actions: [
          {
            id: 'taken',
            title: '✓ Taken',
            foreground: true,
          },
          {
            id: 'snooze',
            title: '⏰ Snooze',
          },
          {
            id: 'skip',
            title: '✕ Skip',
            destructive: true,
          },
        ],
      },
    ]);

    console.log('[Notifications] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[Notifications] Initialization error:', error);
    return false;
  }
}

/**
 * Schedule a medicine reminder notification
 */
export async function scheduleMedicineReminder(
  reminder: MedicineReminderData
): Promise<string | null> {
  try {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: reminder.scheduledTime.getTime(),
      alarmManager: {
        allowWhileIdle: true, // Fire even in Doze mode
      },
    };

    const notificationId = await notifee.createTriggerNotification(
      {
        id: reminder.scheduleId,
        title: '💊 Medication Reminder',
        body: `Time to take ${reminder.medicationName} ${reminder.dosage}`,
        data: {
          medicationId: reminder.medicationId,
          medicationName: reminder.medicationName,
          dosage: reminder.dosage,
          scheduleId: reminder.scheduleId,
          instructions: reminder.instructions || '',
          type: 'medication_reminder',
        },
        
        // Android configuration
        android: {
          channelId: MEDICATION_CHANNEL_ID,
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: {
            id: 'default',
          },
          
          // Full-screen alarm UI - launches MedicineAlarmScreen
          fullScreenAction: {
            id: 'default',
            mainComponent: 'MedicineAlarmScreen',
          },
          
          // Action buttons
          actions: [
            {
              title: '✓ Taken',
              pressAction: { id: 'taken' },
            },
            {
              title: '⏰ Snooze',
              pressAction: { id: 'snooze' },
            },
            {
              title: '✕ Skip',
              pressAction: { id: 'skip' },
            },
          ],
          
          // Alarm-style notification
          autoCancel: false,
          ongoing: true,
          showTimestamp: true,
          timestamp: reminder.scheduledTime.getTime(),
        },
        
        // iOS configuration
        ios: {
          categoryId: MEDICATION_CATEGORY_ID,
          interruptionLevel: 'timeSensitive', // Breaks through Focus mode
          sound: 'default',
          // critical: true, // Enable after Apple approval
          // criticalVolume: 1.0,
        },
      },
      trigger
    );

    return notificationId;
  } catch (error) {
    console.error('[Notifications] Schedule error:', error);
    return null;
  }
}

/**
 * Schedule all doses for a medication
 */
export async function scheduleAllRemindersForMedication(
  medication: Medication
): Promise<boolean> {
  try {
    if (!medication.time_of_day || medication.time_of_day.length === 0) {
      console.log('[Notifications] No times set for medication:', medication.name);
      return false;
    }

    console.log(`[Notifications] Scheduling ${medication.time_of_day.length} doses for ${medication.name}`);

    for (let i = 0; i < medication.time_of_day.length; i++) {
      const timeStr = medication.time_of_day[i];
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      // If time has already passed today, schedule for tomorrow
      if (scheduledTime.getTime() < Date.now()) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const reminderData: MedicineReminderData = {
        medicationId: medication.id,
        medicationName: medication.name,
        dosage: medication.dosage || '',
        instructions: medication.notes || '',
        scheduleId: `${medication.id}_dose_${i}`,
        scheduledTime,
      };

      // For daily reminders (interval_days = 1), use repeating
      // For others, we schedule a single trigger (app will refresh/reschedule on launch or when taken)
      if (medication.interval_days === 1) {
        await scheduleRepeatingReminder(reminderData, 'daily');
      } else {
        await scheduleMedicineReminder(reminderData);
      }
    }

    return true;
  } catch (error) {
    console.error('[Notifications] Error scheduling all reminders:', error);
    return false;
  }
}

/**
 * Display immediate notification (for testing)
 */
export async function displayTestNotification(
  medicationName: string = 'Test Medication',
  dosage: string = '500mg'
): Promise<string | null> {
  try {
    const notificationId = await notifee.displayNotification({
      id: `test-${Date.now()}`,
      title: '💊 Medication Reminder',
      body: `Time to take ${medicationName} ${dosage}`,
      data: {
        medicationId: 'test-id',
        medicationName,
        dosage,
        scheduleId: `test-${Date.now()}`,
        type: 'medication_reminder',
      },
      
      // Android configuration
      android: {
        channelId: MEDICATION_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        pressAction: {
          id: 'default',
        },
        
        // Full-screen alarm UI
        fullScreenAction: {
          id: 'default',
          mainComponent: 'MedicineAlarmScreen',
        },
        
        // Action buttons
        actions: [
          {
            title: '✓ Taken',
            pressAction: { id: 'taken' },
          },
          {
            title: '⏰ Snooze',
            pressAction: { id: 'snooze' },
          },
          {
            title: '✕ Skip',
            pressAction: { id: 'skip' },
          },
        ],
        
        autoCancel: false,
        ongoing: true,
      },
      
      // iOS configuration
      ios: {
        categoryId: MEDICATION_CATEGORY_ID,
        interruptionLevel: 'timeSensitive',
        sound: 'default',
      },
    });

    console.log('[Notifications] Test notification displayed:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[Notifications] Display error:', error);
    return null;
  }
}

/**
 * Schedule repeating daily reminder
 */
export async function scheduleRepeatingReminder(
  reminder: MedicineReminderData,
  repeatFrequency: 'daily' | 'weekly' = 'daily'
): Promise<string | null> {
  try {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: reminder.scheduledTime.getTime(),
      repeatFrequency: repeatFrequency === 'daily' 
        ? RepeatFrequency.DAILY 
        : RepeatFrequency.WEEKLY,
      alarmManager: {
        allowWhileIdle: true,
      },
    };

    const notificationId = await notifee.createTriggerNotification(
      {
        id: reminder.scheduleId,
        title: '💊 Medication Reminder',
        body: `Time to take ${reminder.medicationName} ${reminder.dosage}`,
        data: {
          medicationId: reminder.medicationId,
          medicationName: reminder.medicationName,
          dosage: reminder.dosage,
          scheduleId: reminder.scheduleId,
          instructions: reminder.instructions || '',
          type: 'medication_reminder',
        },
        
        android: {
          channelId: MEDICATION_CHANNEL_ID,
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: { id: 'default' },
          fullScreenAction: {
            id: 'default',
            mainComponent: 'MedicineAlarmScreen',
          },
          actions: [
            { title: '✓ Taken', pressAction: { id: 'taken' } },
            { title: '⏰ Snooze', pressAction: { id: 'snooze' } },
            { title: '✕ Skip', pressAction: { id: 'skip' } },
          ],
          autoCancel: false,
          ongoing: true,
        },
        
        ios: {
          categoryId: MEDICATION_CATEGORY_ID,
          interruptionLevel: 'timeSensitive',
          sound: 'default',
        },
      },
      trigger
    );

    console.log('[Notifications] Scheduled repeating reminder:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[Notifications] Repeating schedule error:', error);
    return null;
  }
}

/**
 * Cancel a specific reminder
 */
export async function cancelReminder(scheduleId: string): Promise<void> {
  try {
    await notifee.cancelNotification(scheduleId);
    console.log('[Notifications] Cancelled reminder:', scheduleId);
  } catch (error) {
    console.error('[Notifications] Cancel error:', error);
  }
}

/**
 * Cancel all medication reminders
 */
export async function cancelAllReminders(): Promise<void> {
  try {
    await notifee.cancelAllNotifications();
    console.log('[Notifications] Cancelled all reminders');
  } catch (error) {
    console.error('[Notifications] Cancel all error:', error);
  }
}

/**
 * Snooze a reminder for specified minutes
 */
export async function snoozeReminder(
  scheduleId: string,
  medicationData: MedicineReminderData,
  snoozeMinutes: number = 10
): Promise<string | null> {
  try {
    // Cancel current notification
    await cancelReminder(scheduleId);
    
    // Schedule new notification after snooze duration
    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);
    
    return await scheduleMedicineReminder({
      ...medicationData,
      scheduleId: `${scheduleId}_snoozed_${Date.now()}`,
      scheduledTime: snoozeTime,
    });
  } catch (error) {
    console.error('[Notifications] Snooze error:', error);
    return null;
  }
}

/**
 * Get all pending notifications
 */
export async function getPendingReminders() {
  try {
    return await notifee.getTriggerNotifications();
  } catch (error) {
    console.error('[Notifications] Get pending error:', error);
    return [];
  }
}

/**
 * Check notification permissions status
 */
export async function checkPermissions() {
  const settings = await notifee.getNotificationSettings();
  return {
    authorized: settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED,
    criticalAlertEnabled: settings.ios?.criticalAlert === 1,
    settings,
  };
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await notifee.getBadgeCount();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await notifee.setBadgeCount(count);
}

/**
 * Increment badge count
 */
export async function incrementBadgeCount(): Promise<void> {
  await notifee.incrementBadgeCount();
}

/**
 * Decrement badge count
 */
export async function decrementBadgeCount(): Promise<void> {
  await notifee.decrementBadgeCount();
}
