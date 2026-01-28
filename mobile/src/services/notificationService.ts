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
import { logDebug } from './debugLogger';
import { useFamilyMembersStore } from '../store/familyMembersStore';

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
  // New fields for advanced logic
  reminderStyle?: 'standard' | 'assurance';
  alertMode?: 'temporary' | 'alert';
  snoozeDuration?: number;
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
 * Check if full-screen notifications are allowed (Android 14+)
 * On Android 14+, the USE_FULL_SCREEN_INTENT permission is not automatically granted
 */
export async function checkFullScreenIntentPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  
  try {
    const settings = await notifee.getNotificationSettings();
    // Check if full-screen intents are allowed
    // @ts-ignore - canDisplayFullScreenIntent may not be in older type definitions
    return settings.android?.canDisplayFullScreenIntent !== false;
  } catch (error) {
    console.error('[Notifications] Error checking full-screen intent permission:', error);
    return false;
  }
}

/**
 * Request full-screen intent permission (opens system settings on Android 14+)
 */
export async function requestFullScreenIntentPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  
  try {
    // @ts-ignore - openFullScreenIntentSettings may not be in older type definitions
    await notifee.openFullScreenIntentSettings();
  } catch (error) {
    console.error('[Notifications] Error opening full-screen intent settings:', error);
  }
}

/**
 * Schedule a medicine reminder notification
 */
export async function scheduleMedicineReminder(
  reminder: MedicineReminderData
): Promise<string | null> {
  try {
    const { 
      reminderStyle = 'standard', 
      alertMode = 'temporary', 
      snoozeDuration = 10 
    } = reminder;

    const isAlarmMode = alertMode === 'alert';

    console.log('='.repeat(60));
    console.log(`[Notifications] 📋 SCHEDULING MEDICATION REMINDER (${reminderStyle}/${alertMode})`);
    console.log('[Notifications] Medication:', reminder.medicationName);
    console.log('[Notifications] Schedule ID:', reminder.scheduleId);
    console.log('[Notifications] Scheduled Time:', reminder.scheduledTime.toLocaleString());
    console.log('='.repeat(60));

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: reminder.scheduledTime.getTime(),
      alarmManager: {
        allowWhileIdle: true,
      },
    };

    const notificationId = await notifee.createTriggerNotification(
      {
        id: reminder.scheduleId,
        title: isAlarmMode ? '💊 Medication Alarm' : '💊 Medication Reminder',
        body: `Time to take ${reminder.medicationName} ${reminder.dosage}`,
        data: {
          ...reminder,
          type: 'medication_reminder',
          scheduledTime: reminder.scheduledTime.toISOString(),
          // Add follow-up metadata for Live Activity triggering (only in standard mode)
          ...(reminderStyle === 'standard' ? {
            followUpDuration: snoozeDuration,
            followUpTime: new Date(reminder.scheduledTime.getTime() + (snoozeDuration * 60000)).toISOString(),
          } : {}),
        },
        
        // Android configuration
        android: {
          channelId: MEDICATION_CHANNEL_ID,
          category: isAlarmMode ? AndroidCategory.ALARM : AndroidCategory.REMINDER,
          importance: isAlarmMode ? AndroidImportance.HIGH : AndroidImportance.DEFAULT,
          visibility: AndroidVisibility.PUBLIC,
          lightUpScreen: true,
          pressAction: {
            id: 'default',
          },
          
          tag: reminder.scheduleId, // Use scheduleId as tag to group/replace on Android
          
          // Full-screen alarm UI - Always enabled to handle "Locked Screen" state on Android
          fullScreenAction: {
            id: 'default',
            mainComponent: 'MedicineAlarmScreen',
          },
          
          // Mode-specific persistence settings
          ...(isAlarmMode ? {
            autoCancel: false,
            ongoing: true,
            asForegroundService: true,
          } : {
            autoCancel: true,
            ongoing: false,
            // Auto-cancel the primary notification when the follow-up is scheduled to arrive
            // This prevents "clustering" on Android by removing the old one automatically
            timeoutAfter: snoozeDuration * 60 * 1000, 
          }),
          
          actions: [
            { title: '✓ Taken', pressAction: { id: 'taken' } },
            { title: '⏰ Snooze', pressAction: { id: 'snooze' } },
            { title: '✕ Skip', pressAction: { id: 'skip' } },
          ],
          
          showTimestamp: true,
          timestamp: reminder.scheduledTime.getTime(),
        },
        
        // iOS configuration
        ios: {
          categoryId: MEDICATION_CATEGORY_ID,
          // ALWAYS use timeSensitive for medication reminders to ensure they stay prominent on lock screen
          interruptionLevel: 'timeSensitive', 
          sound: 'default',
          threadId: reminder.scheduleId, // Use threadId to group on iOS
        },
      },
      trigger
    );

    await logDebug(`[NotificationService] Primary scheduled: ${notificationId} for ${reminder.scheduledTime.toISOString()}`);

    // --- STANDARD MODE: Store follow-up metadata for Live Activity ---
    if (reminderStyle === 'standard') {
      const followUpTime = new Date(reminder.scheduledTime.getTime() + (snoozeDuration * 60000));
      await logDebug(`[NotificationService] Follow-up will trigger Live Activity at: ${followUpTime.toISOString()}`);
      // Note: Follow-up is now handled via Live Activity trigger in event handler
      // No separate notification is scheduled
    }

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

    const { familyMembers } = useFamilyMembersStore.getState();
    const familyMember = familyMembers.find(m => m.id === medication.family_member_id);

    await logDebug(`[NotificationService] Scheduling reminders for ${medication.name}. Member: ${familyMember?.name || 'Unknown'}`);

    const settings = {
      reminderStyle: familyMember?.reminder_style || 'standard',
      alertMode: familyMember?.alert_display_mode || 'temporary',
      snoozeDuration: familyMember?.snooze_duration || 10,
    };

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
        ...settings, // Pass the fetched settings!
      };

      // For daily reminders (interval_days = 1), use repeating
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
 * Schedule repeating daily reminder
 */
export async function scheduleRepeatingReminder(
  reminder: MedicineReminderData,
  repeatFrequency: 'daily' | 'weekly' = 'daily'
): Promise<string | null> {
  try {
    const { 
      reminderStyle = 'standard', 
      alertMode = 'temporary', 
    } = reminder;

    const isAlarmMode = alertMode === 'alert';

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
        title: isAlarmMode ? '💊 Medication Alarm' : '💊 Medication Reminder',
        body: `Time to take ${reminder.medicationName} ${reminder.dosage}`,
        data: {
          ...reminder,
          type: 'medication_reminder',
          scheduledTime: reminder.scheduledTime.toISOString(),
          // Add follow-up metadata for Live Activity triggering (only in standard mode)
          ...(reminderStyle === 'standard' ? {
            followUpDuration: reminder.snoozeDuration || 10,
            followUpTime: new Date(reminder.scheduledTime.getTime() + ((reminder.snoozeDuration || 10) * 60000)).toISOString(),
          } : {}),
        },
        
        android: {
          channelId: MEDICATION_CHANNEL_ID,
          category: isAlarmMode ? AndroidCategory.ALARM : AndroidCategory.REMINDER,
          importance: isAlarmMode ? AndroidImportance.HIGH : AndroidImportance.DEFAULT,
          visibility: AndroidVisibility.PUBLIC,
          lightUpScreen: true,
          pressAction: { id: 'default' },
          tag: reminder.scheduleId,
          
          fullScreenAction: {
            id: 'default',
            mainComponent: 'MedicineAlarmScreen',
          },
          
          actions: [
            { title: '✓ Taken', pressAction: { id: 'taken' } },
            { title: '⏰ Snooze', pressAction: { id: 'snooze' } },
            { title: '✕ Skip', pressAction: { id: 'skip' } },
          ],
          
          ...(isAlarmMode ? {
            autoCancel: false,
            ongoing: true,
            asForegroundService: true,
          } : {
            autoCancel: true,
            ongoing: false,
          }),
        },
        
        ios: {
          categoryId: MEDICATION_CATEGORY_ID,
          interruptionLevel: 'timeSensitive',
          sound: 'default',
          threadId: reminder.scheduleId,
        },
      },
      trigger
    );

    await logDebug(`[NotificationService] Repeating (${repeatFrequency}) scheduled: ${notificationId}`);

    // --- STANDARD MODE: Store follow-up metadata for Live Activity ---
    if (reminderStyle === 'standard') {
      const snoozeDuration = reminder.snoozeDuration || 10;
      const followUpTime = new Date(reminder.scheduledTime.getTime() + (snoozeDuration * 60000));
      await logDebug(`[NotificationService] Repeating follow-up will trigger Live Activity at T + ${snoozeDuration}m`);
      // Note: Follow-up is now handled via Live Activity trigger in event handler
    }

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
    
    // Use a predictable ID for manual snooze to avoid cluttering the OS
    const manualSnoozeId = `${scheduleId}_manual`;
    
    return await scheduleMedicineReminder({
      ...medicationData,
      scheduleId: manualSnoozeId,
      scheduledTime: snoozeTime,
      reminderStyle: 'assurance', // Bypass 'standard' auto-followup logic for manual snoozes
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

/**
 * Dump debug logs to console (for development)
 */
/**
 * Generate a comprehensive debug report
 * Lists all permissions, channels, and pending notifications (triggers)
 */
export async function generateDebugReport(): Promise<string> {
    const { getLogs, LOG_FILE_PATH } = require('./debugLogger');
    
    const settings = await notifee.getNotificationSettings();
    const channels = Platform.OS === 'android' ? await notifee.getChannels() : [];
    const pending = await notifee.getTriggerNotifications();
    const logs = await getLogs();

    const report = {
        generatedAt: new Date().toISOString(),
        device: {
            os: Platform.OS,
            version: Platform.Version,
        },
        permissions: {
            authorized: settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED,
            settings,
        },
        androidChannels: channels,
        pendingTriggersCount: pending.length,
        pendingTriggers: pending.map(p => ({
            id: p.notification.id,
            title: p.notification.title,
            body: p.notification.body,
            nextTrigger: p.trigger.type === TriggerType.TIMESTAMP ? new Date(p.trigger.timestamp).toISOString() : 'Interval',
            repeatFrequency: p.trigger.type === TriggerType.TIMESTAMP ? (p.trigger as TimestampTrigger).repeatFrequency : undefined,
            data: p.notification.data,
            androidTag: p.notification.android?.tag,
        })),
        recentLogs: logs.split('\n').slice(-100), // Last 100 logs
    };

    const reportBlob = JSON.stringify(report, null, 2);
    console.log('--- NOTIFICATION DEBUG REPORT ---');
    console.log(reportBlob);
    console.log('--- END REPORT ---');
    
    return reportBlob;
}

/**
 * Reconcile notifications with active medications
 * - Cancels ALL existing reminders
 * - Reschedules reminders for all active medications
 * - Safe to call on app startup to flush "ghost" reminders
 */
export async function reconcileReminders(medications: Medication[]): Promise<void> {
  console.log('='.repeat(60));
  console.log(`[Notifications] 🔄 STARTING RECONCILIATION for ${medications.length} medications`);
  
  try {
    // 1. Cancel everything (Nuclear option to ensure no ghosts remain)
    await notifee.cancelAllNotifications();
    console.log('[Notifications] 🗑️  Cancelled ALL existing notifications');

    // 2. Filter for active only
    const activeMeds = medications.filter(m => m.is_active);
    console.log(`[Notifications] Found ${activeMeds.length} active medications to schedule`);

    // 3. Reschedule one by one
    let scheduledCount = 0;
    for (const med of activeMeds) {
      const success = await scheduleAllRemindersForMedication(med);
      if (success) scheduledCount++;
    }

    console.log(`[Notifications] ✅ RECONCILIATION COMPLETE. Scheduled for ${scheduledCount} meds.`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('[Notifications] ❌ Reconciliation failed:', error);
  }
}

/**
 * Dump debug logs to console (for development)
 */
export async function dumpLogs(): Promise<void> {
  await generateDebugReport();
}
