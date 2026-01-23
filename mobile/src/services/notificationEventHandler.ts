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
  
  const medicationData = notification.data;
  const actionId = pressAction?.id || 'default';
  
  console.log('[Notifications] Handling action:', actionId, 'for medication:', medicationData.medicationName);
  
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
      // User just tapped the notification - open app
      console.log('[Notifications] Notification tapped, opening app');
      
      // Navigate to MedicineAlarmScreen if we have data
      if (navigationCallback) {
        console.log('[Notifications] Triggering navigation callback to MedicineAlarm');
        navigationCallback('MedicineAlarm', medicationData);
      } else {
        console.log('[Notifications] No navigation callback registered');
      }
      break;
  }
  
  // Cancel the notification after action (except snooze - it creates a new one)
  if (notification?.id && actionId !== 'snooze') {
    await cancelReminder(notification.id);
  }
}

/**
 * Handle "Taken" action
 */
async function handleTakenAction(data: any) {
  console.log('[Notifications] Medication marked as taken:', data.medicationName);
  
  if (logMedicationCallback) {
    try {
      await logMedicationCallback({
        medication_id: data.medicationId,
        schedule_id: data.scheduleId,
        status: 'taken',
        scheduled_time: data.scheduledTime || new Date().toISOString(),
        action_time: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Notifications] Error logging taken action:', error);
    }
  }
  
  // Show confirmation notification
  await notifee.displayNotification({
    title: '✓ Medication Taken',
    body: `Great job! You took ${data.medicationName}`,
    android: {
      channelId: 'medication-reminders',
      autoCancel: true,
      timeoutAfter: 5000, // Auto-dismiss after 5 seconds
      pressAction: { id: 'default' },
    },
    ios: {
      sound: 'default',
    },
  });
}

/**
 * Handle "Snooze" action
 */
async function handleSnoozeAction(data: any) {
  console.log('[Notifications] Medication snoozed:', data.medicationName);
  
  const reminderData: MedicineReminderData = {
    medicationId: data.medicationId,
    medicationName: data.medicationName,
    dosage: data.dosage,
    scheduleId: data.scheduleId,
    instructions: data.instructions,
    scheduledTime: new Date(), // This will be overwritten by snoozeReminder
  };
  
  const snoozedId = await snoozeReminder(
    data.scheduleId,
    reminderData,
    10 // Snooze for 10 minutes
  );
  
  if (logMedicationCallback) {
    try {
      await logMedicationCallback({
        medication_id: data.medicationId,
        schedule_id: data.scheduleId,
        status: 'snoozed',
        scheduled_time: data.scheduledTime || new Date().toISOString(),
        action_time: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Notifications] Error logging snooze action:', error);
    }
  }
  
  console.log('[Notifications] Snoozed reminder ID:', snoozedId);
  
  // Show snooze confirmation
  await notifee.displayNotification({
    title: '⏰ Snoozed',
    body: `Reminder for ${data.medicationName} in 10 minutes`,
    android: {
      channelId: 'medication-reminders',
      autoCancel: true,
      timeoutAfter: 3000,
      pressAction: { id: 'default' },
    },
    ios: {
      sound: 'default',
    },
  });
}

/**
 * Handle "Skip" action
 */
async function handleSkipAction(data: any) {
  console.log('[Notifications] Medication skipped:', data.medicationName);
  
  if (logMedicationCallback) {
    try {
      await logMedicationCallback({
        medication_id: data.medicationId,
        schedule_id: data.scheduleId,
        status: 'skipped',
        scheduled_time: data.scheduledTime || new Date().toISOString(),
        action_time: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Notifications] Error logging skip action:', error);
    }
  }
}
