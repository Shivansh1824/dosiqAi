/**
 * Notification Event Handler
 * Handles user interactions with medication reminders
 */

import notifee, { EventType } from '@notifee/react-native';
import { snoozeReminder, cancelReminder, MedicineReminderData } from './notificationService';

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
  
  // Ignore non-press events (like DELIVERED)
  if (type !== EventType.ACTION_PRESS && type !== EventType.PRESS) {
    return;
  }
  
  // Check if this is a medication reminder
  if (notification?.data?.type !== 'medication_reminder') {
    return;
  }
  
  const medicationData = notification.data || {};
  const actionId = pressAction?.id || 'default';
  
  console.log('[DEBUG] [NotificationHandler] Action Received:', actionId);
  console.log('[DEBUG] [NotificationHandler] Medication Name:', medicationData.medicationName || 'Unknown');
  console.log('[DEBUG] [NotificationHandler] Notification ID:', notification?.id);
  console.log('[DEBUG] [NotificationHandler] Schedule ID:', medicationData.scheduleId);
  
  // Consolidate cancellation logic: 
  // We cancel the reminder ONCE for actionable items (taken, skip, snooze)
  // to remove the triggering notification.
  if (actionId !== 'default') {
    const idToCancel = notification?.id || medicationData.scheduleId;
    if (idToCancel) {
      console.log('[DEBUG] [NotificationHandler] One-time cancellation for:', idToCancel);
      await cancelReminder(idToCancel);
    }
  }

  switch (actionId) {
    case 'taken':
      console.log('[DEBUG] [NotificationHandler] Routing to handleTakenAction');
      await handleTakenAction(medicationData);
      break;
      
    case 'snooze':
      console.log('[DEBUG] [NotificationHandler] Routing to handleSnoozeAction');
      await handleSnoozeAction(medicationData);
      break;
      
    case 'skip':
      console.log('[DEBUG] [NotificationHandler] Routing to handleSkipAction');
      await handleSkipAction(medicationData);
      break;
      
    case 'default':
      // User just tapped the notification - open app
      console.log('[DEBUG] [NotificationHandler] User tapped notification (default press)');
      
      // Navigate to MedicineAlarmScreen if we have data
      if (navigationCallback) {
        console.log('[DEBUG] [NotificationHandler] Triggering navigation callback to MedicineAlarm');
        navigationCallback('MedicineAlarm', medicationData);
      } else {
        console.log('[DEBUG] [NotificationHandler] No navigation callback registered');
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
  const confirmationId = `confirmed-taken-${data.scheduleId || Date.now()}`;
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
  const confirmationId = `confirmed-snooze-${data.scheduleId || Date.now()}`;
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
