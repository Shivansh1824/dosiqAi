/**
 * Notification Event Handler
 * Handles user interactions with medication reminders
 */

import notifee, { EventType } from '@notifee/react-native';
import { snoozeReminder, cancelReminder, MedicineReminderData } from './notificationService';
import { logDebug } from './debugLogger';
import { LiveActivityService } from './LiveActivityService';

// Type for medication log entry
export interface MedicationLogEntry {
  medication_id: string;
  schedule_id: string;
  status: 'taken' | 'skipped' | 'snoozed' | 'missed';
  scheduled_time: string;
  action_time: string;
}

// Callback type for logging
type LogMedicationCallback = (entry: MedicationLogEntry) => Promise<void>;

let logMedicationCallback: LogMedicationCallback | null = null;
let navigationCallback: ((screen: string, params: any) => void) | null = null;

/**
 * Set the callback for navigation
 * This allows the service to navigate even when app is in background/quit state
 */
export function setNavigationCallback(callback: (screen: string, params: any) => void) {
  navigationCallback = callback;
}

/**
 * Set the callback for logging medication actions
 * This connects to the medicationLogsStore
 */
export function setLogMedicationCallback(callback: LogMedicationCallback) {
  logMedicationCallback = callback;
}

/**
 * Handle foreground notification events
 * Call this in your App component
 */
export function setupForegroundEventHandler() {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    console.log('='.repeat(60));
    console.log('[Notifications] 📱 FOREGROUND EVENT RECEIVED');
    console.log('[Notifications] Event Type:', EventType[type]);
    console.log('[Notifications] Notification ID:', detail.notification?.id);
    console.log('[Notifications] Has fullScreenAction:', !!detail.notification?.android?.fullScreenAction);
    console.log('[Notifications] Full Details:', JSON.stringify(detail, null, 2));
    console.log('='.repeat(60));
    await handleNotificationEvent(type, detail);
  });
}

/**
 * Handle background notification events
 * Register this in index.ts
 */
export function setupBackgroundEventHandler() {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    console.log('='.repeat(60));
    console.log('[Notifications] 🔔 BACKGROUND EVENT RECEIVED');
    console.log('[Notifications] Event Type:', EventType[type]);
    console.log('[Notifications] Notification ID:', detail.notification?.id);
    
    // Explicitly log for debugging
    await logDebug('[BackgroundEvent] Received', { type: EventType[type], id: detail.notification?.id });

    console.log('[Notifications] Has fullScreenAction:', !!detail.notification?.android?.fullScreenAction);
    console.log('[Notifications] Press Action:', detail.pressAction?.id);
    console.log('='.repeat(60));
    await handleNotificationEvent(type, detail);
  });
}

/**
 * Core event handler for all notification actions
 */
/**
 * Core event handler for all notification actions
 */
async function handleNotificationEvent(type: EventType, detail: any) {
  const { notification, pressAction } = detail;
  
  await logDebug('[NotificationHandler] Event Received', { type: EventType[type], action: pressAction?.id, id: notification?.id });

  // --- ACTIVE CLEANUP STRATEGY ---
  // If a Follow-up is delivered, immediately search for and remove the Primary notification
  // to create a "Replacement" effect on iOS and Android.
  if (type === EventType.DELIVERED) {
      logDebug(`[NotificationHandler] Delivered event for ID: ${notification?.id}`);
  }

  if (type === EventType.DELIVERED && notification?.id?.endsWith('_followup')) {
      const followUpId = notification.id;
      const baseId = followUpId.replace('_followup', '');
      
      await logDebug(`[NotificationHandler] Follow-up arrived (${followUpId}). Attempting to replace primary: ${baseId}`);
      
      try {
          // Get all currently visible notifications
          const displayed = await notifee.getDisplayedNotifications();
          await logDebug(`[NotificationHandler] Currently displayed notifications: ${displayed.map(n => n.id).join(', ')}`);
          
          // Find the primary one
          const primaryExists = displayed.find(n => n.id === baseId);
          
          if (primaryExists) {
              await logDebug(`[NotificationHandler] Found primary '${baseId}' in tray. Removing it to stack properly.`);
              // Force remove the old one
              await notifee.cancelDisplayedNotification(baseId);
          } else {
              await logDebug(`[NotificationHandler] Primary '${baseId}' not found in tray. No cleanup needed.`);
          }
      } catch (error) {
          console.error('[NotificationHandler] Active Cleanup Failed:', error);
          await logDebug(`[NotificationHandler] Active Cleanup Failed: ${error}`);
      }
      return; 
  }

  // --- LIVE ACTIVITY TRIGGER ---
  // If a follow-up notification is delivered (foreground or background), start the Live Activity
  if (type === EventType.DELIVERED && notification?.data?.isFollowUp === true) {
      await logDebug(`[NotificationHandler] Follow-up delivered. Starting Live Activity for ${notification.data.medicationName}`);
      
      const { medicationName, dosage, scheduleId } = notification.data;
      
      await LiveActivityService.startMedicationActivity(
          medicationName, 
          dosage, 
          scheduleId
      );
      
      // We continue processing to allow standard notification handling if needed
      // But typically DELIVERED doesn't do more.
      return; 
  }

  // Ignore non-press events (like DELIVERED for non-replacements)
  if (type !== EventType.ACTION_PRESS && type !== EventType.PRESS) {
    return;
  }
  
  // Check if this is a medication reminder
  if (notification?.data?.type !== 'medication_reminder') {
    return;
  }
  
  const medicationData = notification.data || {};
  const actionId = pressAction?.id || 'default';
  
  const primaryId = notification?.id || medicationData.scheduleId;
  const followUpId = primaryId.endsWith('_followup') ? primaryId : `${primaryId}_followup`;
  const baseId = primaryId.replace('_followup', '');

  await logDebug('[NotificationHandler] Processing Action', { actionId, baseId, isFollowUp: medicationData.isFollowUp });

  // Consolidate cancellation logic: 
  if (actionId !== 'default') {
    await logDebug(`[NotificationHandler] Global cancel for: ${baseId}`);
    await cancelReminder(baseId);
    await cancelReminder(`${baseId}_followup`);
  }

  switch (actionId) {
    case 'taken':
      await handleTakenAction(medicationData);
      break;
    case 'snooze':
      await handleSnoozeAction(medicationData);
      break;
    case 'skip':
      await handleSkipAction(medicationData);
      break;
    case 'default':
      if (navigationCallback) {
        navigationCallback('MedicineAlarm', medicationData);
      }
      break;
  }
}

/**
 * Handle "Taken" action
 */
async function handleTakenAction(data: any) {
  console.log('[DEBUG] [NotificationHandler] Executing handleTakenAction for:', data.medicationName);
  
  if (logMedicationCallback) {
    try {
      console.log('[DEBUG] [NotificationHandler] Logging to store...');
      await logMedicationCallback({
        medication_id: data.medicationId,
        schedule_id: data.scheduleId,
        status: 'taken',
        scheduled_time: data.scheduledTime || new Date().toISOString(),
        action_time: new Date().toISOString(),
      });
      console.log('[DEBUG] [NotificationHandler] Store logged successfully');
    } catch (error) {
      console.error('[DEBUG] [NotificationHandler] Error logging taken action:', error);
    }
  }

  // Show confirmation notification
  const baseScheduleId = data.scheduleId || Date.now();
  const confirmationId = `confirmed-taken-${baseScheduleId}`.replace('_followup', '');
  console.log('[DEBUG] [NotificationHandler] Displaying confirmation notification:', confirmationId);
  
  await notifee.displayNotification({
    id: confirmationId,
    title: '✓ Medication Taken',
    body: `Great job! You took ${data.medicationName}`,
    android: {
      channelId: 'medication-reminders',
      autoCancel: true,
      // timeoutAfter removed to ensure persistence until manual dismissal
      pressAction: { id: 'default' },
    },
    ios: {
      sound: 'default',
    },
  });
  console.log('[DEBUG] [NotificationHandler] handleTakenAction complete');
}

/**
 * Handle "Snooze" action (Default 10 mins for Banner)
 */
async function handleSnoozeAction(data: any) {
  console.log('[DEBUG] [NotificationHandler] Executing handleSnoozeAction for:', data.medicationName);
  
  const reminderData: MedicineReminderData = {
    medicationId: data.medicationId,
    medicationName: data.medicationName,
    dosage: data.dosage,
    scheduleId: data.scheduleId,
    instructions: data.instructions,
    scheduledTime: new Date(), // This will be overwritten by snoozeReminder
  };
  
  console.log('[DEBUG] [NotificationHandler] Snoozing reminder (10min)...');
  const snoozedId = await snoozeReminder(
    data.scheduleId,
    reminderData,
    10 // Snooze for 10 minutes (Default for banner action)
  );
  
  console.log('[DEBUG] [NotificationHandler] Snoozed reminder ID:', snoozedId);
  
  // Show snooze confirmation
  const baseScheduleId = data.scheduleId || Date.now();
  const confirmationId = `confirmed-snooze-${baseScheduleId}`.replace('_followup', '');
  console.log('[DEBUG] [NotificationHandler] Displaying confirmation notification:', confirmationId);

  await notifee.displayNotification({
    id: confirmationId,
    title: '⏰ Snoozed',
    body: `Reminder for ${data.medicationName} in 10 minutes`,
    android: {
      channelId: 'medication-reminders',
      autoCancel: true,
      // timeoutAfter removed for persistence
      pressAction: { id: 'default' },
    },
    ios: {
      sound: 'default',
    },
  });
  console.log('[DEBUG] [NotificationHandler] handleSnoozeAction complete');
}

/**
 * Handle "Skip" action
 */
async function handleSkipAction(data: any) {
  console.log('[DEBUG] [NotificationHandler] Executing handleSkipAction for:', data.medicationName);
  
  if (logMedicationCallback) {
    try {
      console.log('[DEBUG] [NotificationHandler] Logging skip to store...');
      await logMedicationCallback({
        medication_id: data.medicationId,
        schedule_id: data.scheduleId,
        status: 'skipped',
        scheduled_time: data.scheduledTime || new Date().toISOString(),
        action_time: new Date().toISOString(),
      });
      console.log('[DEBUG] [NotificationHandler] Skip logged successfully');
    } catch (error) {
      console.error('[DEBUG] [NotificationHandler] Error logging skip action:', error);
    }
  }
  console.log('[DEBUG] [NotificationHandler] handleSkipAction complete');
}
