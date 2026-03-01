/**
 * Notification Event Handler
 * Handles user interactions with medication reminders
 */

import notifee, { EventType } from '@notifee/react-native';
import { snoozeReminder, cancelReminder, cancelIOSFollowUps, MedicineReminderData, refillFollowUps } from './notificationService';
import { logDebug } from './debugLogger';
import { Platform } from 'react-native';
import {
  handleAndroidSnooze,
  cancelPendingSequence,
  NotificationSequenceData,
} from './androidNotificationService';

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
    await handleNotificationEvent(type, detail);
  });
}

/**
 * Handle background notification events
 * Register this in index.ts
 */
export function setupBackgroundEventHandler() {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    await logDebug('[BackgroundEvent] Received', { type: EventType[type], id: detail.notification?.id });
    await handleNotificationEvent(type, detail);
  });
}

/**
 * Core event handler for all notification actions
 */
async function handleNotificationEvent(type: EventType, detail: any) {
  const { notification, pressAction } = detail;


  await logDebug('[NotificationHandler] Event Received', { type: EventType[type], action: pressAction?.id, id: notification?.id });


  // --- ANDROID STEP REPLACEMENT LOGIC ---
  // When Step N is delivered, cancel Step N-1 to simulate "replacement" behavior
  // This is required because we use unique notification IDs for reliability
  if (Platform.OS === 'android' &&
    type === EventType.DELIVERED &&
    notification?.data?.type === 'medication_reminder' &&
    notification?.data?.step) {

    const currentStep = Number(notification.data.step);
    if (currentStep > 1) {
      const baseId = notification.data.scheduleId; // This is the base ID
      const prevStepId = `${baseId}-step${currentStep - 1}`;

      await logDebug(`[NotificationHandler] Step ${currentStep} delivered. Cancelling previous step: ${prevStepId}`);
      await notifee.cancelNotification(prevStepId);
    }
    return;
  }

  // NOTE: iOS follow-ups are now PRE-SCHEDULED at medication creation time
  // (in scheduleRepeatingReminder), not dynamically here. The DELIVERED event
  // doesn't reliably fire in the background on iOS for trigger notifications.

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
        navigationCallback('/medicinealarm', medicationData);
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

  // Cancel all remaining notifications in the sequence
  if (Platform.OS === 'android' && data.familyMemberId) {
    // Android: Cancel the entire pending sequence
    const totalSteps = Number(data.totalSteps || 4);
    await cancelPendingSequence(data.scheduleId, totalSteps);
    await logDebug(`[NotificationHandler] Android: Cancelled pending sequence for ${data.scheduleId}`);
  } else if (Platform.OS === 'ios') {
    // iOS: Hybrid Architecture Cancellation (Cluster Kill)
    console.log(`[NotificationHandler] 🛑 TAKEN Action detected. Initiating Cluster Kill for: ${data.scheduleId}`);
    await cancelIOSFollowUps(data.scheduleId);
    await logDebug(`[NotificationHandler] iOS: Cluster Kill completed for ${data.scheduleId}`);

    // 3. Trigger Refill Logic
    await refillFollowUps();
  }

  // Show confirmation notification
  const baseScheduleId = data.scheduleId || Date.now();
  const confirmationId = `confirmed-taken-${baseScheduleId}`.replace('_followup', '');
  console.log('[DEBUG] [NotificationHandler] Displaying confirmation notification:', confirmationId);

  await notifee.displayNotification({
    id: confirmationId,
    title: '✓ Medication Taken',
    body: `Great job! You took ${data.medicationName}`,
    ios: {
      sound: 'default',
    },
    android: {
      channelId: 'medication-reminders',
      importance: 3, // HIGH
      autoCancel: true,
    },
  });
  console.log('[DEBUG] [NotificationHandler] handleTakenAction complete');
}

/**
 * Handle "Snooze" action (Default 10 mins for Banner)
 * Android: Continues from current step in the escalation sequence
 * iOS: Reschedules with snoozeReminder
 */
async function handleSnoozeAction(data: any) {
  console.log('[DEBUG] [NotificationHandler] Executing handleSnoozeAction for:', data.medicationName);

  // Get snooze duration from notification data or fallback to 10 minutes
  const snoozeDuration = Number(data.snoozeDuration || 10);

  // Android: Use Android-specific snooze that continues from current step
  if (Platform.OS === 'android' && data.familyMemberId) {
    const sequenceData: NotificationSequenceData = {
      medicationId: data.medicationId,
      medicationName: data.medicationName,
      dosage: data.dosage,
      instructions: data.instructions,
      scheduleId: data.scheduleId,
      familyMemberId: data.familyMemberId,
      step: Number(data.step || 1),
      totalSteps: Number(data.totalSteps || 2),
      reminderStyle: data.reminderStyle || 'standard',
      snoozeDuration: snoozeDuration,
      scheduledTime: new Date().toISOString(),
    };

    await handleAndroidSnooze(sequenceData);
    console.log(`[DEBUG] [NotificationHandler] Android snooze: continuing from step ${sequenceData.step}`);
  } else {
    // iOS: Use existing snooze logic
    const reminderData: MedicineReminderData = {
      medicationId: data.medicationId,
      medicationName: data.medicationName,
      dosage: data.dosage,
      scheduleId: data.scheduleId,
      instructions: data.instructions,
      scheduledTime: new Date(), // This will be overwritten by snoozeReminder
      notificationTune: data.notificationTune || data.notification_tune, // Handle both iOS (camel) and Android (snake) payload keys
      // Phase 3 Fix: Preserve Cluster Payload so the Snooze Alarm wakes up with the checklist!
      activeMedicationIds: data.activeMedicationIds ? JSON.parse(data.activeMedicationIds) : undefined,
    };

    console.log('[DEBUG] [NotificationHandler] Snoozing reminder (10min)...Payload:', reminderData.activeMedicationIds);
    const snoozedId = await snoozeReminder(
      data.scheduleId,
      reminderData,
      10 // Snooze for 10 minutes (Default for banner action)
    );

    console.log('[DEBUG] [NotificationHandler] Snoozed reminder ID:', snoozedId);
  }

  // iOS: Cancel remaining follow-ups (snooze starts fresh)
  if (Platform.OS === 'ios') {
    await cancelIOSFollowUps(data.scheduleId);
    await logDebug(`[NotificationHandler] iOS: Cluster Kill (Snooze) for ${data.scheduleId}`);
  }

  // Show snooze confirmation
  const baseScheduleId = data.scheduleId || Date.now();
  const confirmationId = `confirmed-snooze-${baseScheduleId}`.replace('_followup', '');
  console.log('[DEBUG] [NotificationHandler] Displaying confirmation notification:', confirmationId);

  await notifee.displayNotification({
    id: confirmationId,
    title: '⏰ Snoozed',
    body: `Reminder for ${data.medicationName} in ${snoozeDuration} minutes`,
    ios: {
      sound: 'default',
    },
    android: {
      channelId: 'medication-reminders',
      importance: 3, // HIGH
      autoCancel: true,
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

  // Cancel all remaining notifications in the sequence
  if (Platform.OS === 'android' && data.familyMemberId) {
    // Android: Cancel the entire pending sequence
    const totalSteps = Number(data.totalSteps || 4);
    await cancelPendingSequence(data.scheduleId, totalSteps);
    await logDebug(`[NotificationHandler] Android: Cancelled pending sequence on skip for ${data.scheduleId}`);
  } else if (Platform.OS === 'ios') {
    // iOS: Hybrid Architecture Cancellation (Cluster Kill)
    await cancelIOSFollowUps(data.scheduleId);
    await logDebug(`[NotificationHandler] iOS: Cluster Kill/Skip completed for ${data.scheduleId}`);
    await refillFollowUps();
  }

  console.log('[DEBUG] [NotificationHandler] handleSkipAction complete');
}
