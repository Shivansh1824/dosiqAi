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
import { 
  initializeAndroidNotifications, 
  scheduleNotificationSequence as scheduleAndroidSequence,
  generateNotificationId,
} from './androidNotificationService';

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
  // Family member ID for fetching preferences
  familyMemberId?: string;
  // Fields for advanced notification logic
  reminderStyle?: 'standard' | 'assurance';
  alertMode?: 'temporary' | 'alert';
  snoozeDuration?: number;
  notificationTune?: string;
  // Step tracking for Android escalation
  step?: number;
  totalSteps?: number;
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

    // Initialize Android-specific channels and permissions
    if (Platform.OS === 'android') {
      await initializeAndroidNotifications();
      console.log('[Notifications] Android channels initialized');
    }

    // Set up iOS notification categories with actions
    if (Platform.OS === 'ios') {
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
    }

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
    const { 
      reminderStyle = 'standard', 
      alertMode = 'temporary', 
      snoozeDuration = 10,
      notificationTune 
    } = reminder;

    console.log('='.repeat(60));
    console.log(`[Notifications] 📋 SCHEDULING MEDICATION REMINDER (${reminderStyle})`);
    console.log('[Notifications] Medication:', reminder.medicationName);
    console.log('[Notifications] Schedule ID:', reminder.scheduleId);
    console.log('[Notifications] Scheduled Time:', reminder.scheduledTime.toLocaleString());
    console.log('[Notifications] Platform:', Platform.OS);
    console.log('[Notifications] familyMemberId:', reminder.familyMemberId);
    console.log('[Notifications] Tune:', notificationTune || 'Default');
    console.log('='.repeat(60));

    // --- ANDROID: Delegate to Android notification service with escalation logic ---
    if (Platform.OS === 'android' && reminder.familyMemberId) {
      console.log('[Notifications] ✅ Using ANDROID notification service with escalation');
      const notificationId = await scheduleAndroidSequence(
        reminder.medicationId,
        reminder.medicationName,
        reminder.dosage,
        reminder.familyMemberId,
        reminder.scheduledTime,
        reminder.instructions,
        reminder.step || 1
      );
      console.log('[Notifications] ✅ Android escalation sequence scheduled:', notificationId);
      await logDebug(`[NotificationService] Android sequence scheduled: ${notificationId}`);
      return notificationId;
    }

    console.log('[Notifications] ⚠️ Using iOS/fallback notification path (familyMemberId missing or not Android)');

    // --- iOS/FALLBACK: Use existing time-sensitive notification + Live Activity logic ---
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: reminder.scheduledTime.getTime(),
      alarmManager: {
        allowWhileIdle: true,
      },
    };

    // Determine sound configuration for iOS
    // - Silent: no sound prop
    // - Default: 'default'
    // - Custom: filename.wav (iOS requires extension, Android does not)
    
    let iosSound: string | undefined = 'default';
    
    // Case 1: Silent (Empty or null tune) - User requested silent if no tune is set
    if (!notificationTune || notificationTune.trim() === '') {
        iosSound = undefined; // No sound property = silent
        console.log('[Notifications] iOS: Configuring as SILENT');
    }
    // Case 2: Custom Tune
    else if (notificationTune !== 'default') {
        const baseName = notificationTune.replace(/\.(mp3|wav)$/, '');
        iosSound = `${baseName}.wav`; // Force .wav extension for iOS resources
    }

    const notificationId = await notifee.createTriggerNotification(
      {
        id: reminder.scheduleId,
        title: '💊 Medication Reminder',
        body: `Time to take ${reminder.medicationName} ${reminder.dosage}`,
        data: {
          ...reminder,
          type: 'medication_reminder',
          scheduledTime: reminder.scheduledTime.toISOString(),
          // Add follow-up metadata for Live Activity triggering (only in standard mode on iOS)
          ...(Platform.OS === 'ios' && reminderStyle === 'standard' ? {
            followUpDuration: snoozeDuration.toString(),
            followUpTime: new Date(reminder.scheduledTime.getTime() + (snoozeDuration * 60000)).toISOString(),
          } : {}),
        },
        
        // iOS configuration
        ios: {
          categoryId: MEDICATION_CATEGORY_ID,
          // ALWAYS use timeSensitive for medication reminders to ensure they stay prominent on lock screen
          interruptionLevel: 'timeSensitive', 
          sound: iosSound,
          threadId: reminder.scheduleId, // Use threadId to group on iOS
        },
        
        // Android configuration (fallback when familyMemberId is missing)
        android: {
          channelId: 'medication-notifications-default',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          sound: 'default',
          autoCancel: true,
        },
      },
      trigger
    );

    await logDebug(`[NotificationService] iOS notification scheduled: ${notificationId} for ${reminder.scheduledTime.toISOString()}`);

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
      notificationTune: familyMember?.notification_tune,
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
        familyMemberId: medication.family_member_id, // Required for Android notification service
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
      notificationTune
    } = reminder;

    console.log('='.repeat(60));
    console.log(`[Notifications] 📋 SCHEDULING REPEATING REMINDER (${repeatFrequency})`);
    console.log('[Notifications] Medication:', reminder.medicationName);
    console.log('[Notifications] Platform:', Platform.OS);
    console.log('[Notifications] familyMemberId:', reminder.familyMemberId);
    console.log('[Notifications] Tune:', notificationTune || 'Default');
    console.log('='.repeat(60));

    // --- ANDROID: For repeating reminders, schedule the escalation sequence ---
    // Note: Android doesn't support native repeating triggers with our escalation logic,
    // so we schedule a single sequence. The app will reschedule when it reopens.
    if (Platform.OS === 'android' && reminder.familyMemberId) {
      console.log('[Notifications] ✅ Using ANDROID notification service for repeating reminder');
      const notificationId = await scheduleAndroidSequence(
        reminder.medicationId,
        reminder.medicationName,
        reminder.dosage,
        reminder.familyMemberId,
        reminder.scheduledTime,
        reminder.instructions,
        reminder.step || 1
      );
      console.log('[Notifications] ✅ Android repeating sequence scheduled:', notificationId);
      await logDebug(`[NotificationService] Android repeating sequence scheduled: ${notificationId}`);
      return notificationId;
    }

    console.log('[Notifications] ⚠️ Using iOS/fallback repeating notification path');

    // --- iOS/FALLBACK: Use native repeating trigger ---
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

    // Determine sound configuration for iOS
    let iosSound: string | undefined = 'default';
        
    // Case 1: Silent
    if (!notificationTune || notificationTune.trim() === '') {
        iosSound = undefined;
    }
    // Case 2: Custom
    else if (notificationTune !== 'default') {
        const baseName = notificationTune.replace(/\.(mp3|wav)$/, '');
        iosSound = `${baseName}.wav`;
    }

    const notificationId = await notifee.createTriggerNotification(
      {
        id: reminder.scheduleId,
        title: isAlarmMode ? '💊 Medication Alarm' : '💊 Medication Reminder',
        body: `Time to take ${reminder.medicationName} ${reminder.dosage}`,
        data: {
          ...reminder,
          type: 'medication_reminder',
          scheduledTime: reminder.scheduledTime.toISOString(),
          // Add follow-up metadata for Live Activity triggering (only in standard mode on iOS)
          ...(Platform.OS === 'ios' && reminderStyle === 'standard' ? {
            followUpDuration: (reminder.snoozeDuration || 10).toString(),
            followUpTime: new Date(reminder.scheduledTime.getTime() + ((reminder.snoozeDuration || 10) * 60000)).toISOString(),
          } : {}),
        },
        
        ios: {
          categoryId: MEDICATION_CATEGORY_ID,
          interruptionLevel: 'timeSensitive',
          sound: iosSound,
          threadId: reminder.scheduleId,
        },
        
        // Android configuration (fallback when familyMemberId is missing)
        android: {
          channelId: 'medication-notifications-default',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          sound: 'default',
          autoCancel: true,
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
    const channels: any[] = [];
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
