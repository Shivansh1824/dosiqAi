/**
 * Android Notification Service
 * 
 * Handles medicine reminder notification scheduling with escalation logic:
 * - Standard Mode: 2-step (Normal → Full-screen)
 * - Aggressive Mode: 4-step (Normal → Normal → Normal → Full-screen)
 * 
 * Features:
 * - Same notification ID for all steps (no pile-up)
 * - TimestampTrigger with allowWhileIdle for reliability
 * - Full-screen intent for persistent escalated notifications
 * - Snooze continues from current step (doesn't restart sequence)
 */

import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  TimestampTrigger,
  TriggerType,
  TriggerNotification,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { logDebug } from './debugLogger';

// Channel IDs
const CHANNEL_REMINDERS = 'medication-reminders';
const CHANNEL_ALARMS = 'medication-alarms';

// Types
export interface NotificationSequenceData {
  medicationId: string;
  medicationName: string;
  dosage: string;
  instructions?: string;
  scheduleId: string;
  familyMemberId: string;
  step: number;
  totalSteps: number;
  reminderStyle: 'standard' | 'assurance';
  snoozeDuration: number;
  scheduledTime: string; // ISO string
}

/**
 * Initialize Android notification channels
 * Call this on app startup (Android only)
 */
export async function initializeAndroidNotifications(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // Channel for normal reminders (high importance, auto-dismissible)
    await notifee.createChannel({
      id: CHANNEL_REMINDERS,
      name: 'Medication Reminders',
      description: 'Regular medication reminder notifications',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      lights: true,
    });

    // Channel for alarm-level notifications (full-screen capable)
    await notifee.createChannel({
      id: CHANNEL_ALARMS,
      name: 'Medication Alarms',
      description: 'Persistent medication alarms that require attention',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      lights: true,
    });

    console.log('[AndroidNotification] Channels created successfully');
  } catch (error) {
    console.error('[AndroidNotification] Error creating channels:', error);
  }
}

/**
 * Request Android-specific permissions for notifications
 */
export async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    // Check and request exact alarm permission (Android 12+)
    const alarmPermission = await notifee.getNotificationSettings();
    
    if (alarmPermission.android.alarm !== 1) {
      // Guide user to enable exact alarms in settings
      await notifee.openAlarmPermissionSettings();
    }

    console.log('[AndroidNotification] Permissions checked');
    return true;
  } catch (error) {
    console.error('[AndroidNotification] Permission error:', error);
    return false;
  }
}

/**
 * Generate consistent notification ID for a reminder
 */
export function generateNotificationId(medicationId: string, familyMemberId: string): string {
  return `medicine-${medicationId}-${familyMemberId}`;
}

/**
 * Generate trigger ID for a specific step in the sequence
 */
function generateTriggerId(baseId: string, step: number): string {
  return `${baseId}_step${step}`;
}

/**
 * Fetch user preferences from the family members store
 */
function getUserPreferences(familyMemberId: string): { 
  reminderStyle: 'standard' | 'assurance'; 
  snoozeDuration: number 
} {
  const { familyMembers } = useFamilyMembersStore.getState();
  const member = familyMembers.find(m => m.id === familyMemberId);

  return {
    reminderStyle: member?.reminder_style || 'standard',
    snoozeDuration: member?.snooze_duration || 10,
  };
}

/**
 * Schedule a complete notification sequence for a medication reminder
 * 
 * @param medicationId - The medication ID
 * @param medicationName - Display name of the medication
 * @param dosage - Dosage string
 * @param familyMemberId - Family member ID for fetching preferences
 * @param reminderTime - When the first notification should fire
 * @param instructions - Optional instructions text
 * @param startStep - Starting step (default 1, used for snooze continuation)
 */
export async function scheduleNotificationSequence(
  medicationId: string,
  medicationName: string,
  dosage: string,
  familyMemberId: string,
  reminderTime: Date,
  instructions?: string,
  startStep: number = 1
): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const { reminderStyle, snoozeDuration } = getUserPreferences(familyMemberId);
    const baseNotificationId = generateNotificationId(medicationId, familyMemberId);
    
    // Determine total steps based on mode
    const totalSteps = reminderStyle === 'standard' ? 2 : 4;
    
    console.log('='.repeat(60));
    console.log(`[AndroidNotification] 📋 SCHEDULING SEQUENCE`);
    console.log(`[AndroidNotification] Mode: ${reminderStyle} (${totalSteps} steps)`);
    console.log(`[AndroidNotification] Medication: ${medicationName}`);
    console.log(`[AndroidNotification] Starting from step: ${startStep}`);
    console.log(`[AndroidNotification] Snooze duration: ${snoozeDuration} minutes`);
    console.log(`[AndroidNotification] First notification at: ${reminderTime.toLocaleString()}`);
    console.log('='.repeat(60));

    // Cancel any existing sequence for this medication
    await cancelPendingSequence(baseNotificationId, totalSteps);

    // Schedule remaining steps
    for (let step = startStep; step <= totalSteps; step++) {
      const isFullScreen = (reminderStyle === 'standard' && step === 2) ||
                          (reminderStyle === 'assurance' && step === 4);
      
      // Calculate trigger time for this step
      // Step 1 fires at reminderTime, subsequent steps add snooze intervals
      const stepDelay = (step - startStep) * snoozeDuration * 60 * 1000;
      const triggerTime = new Date(reminderTime.getTime() + stepDelay);

      const stepNotificationId = `${baseNotificationId}-step${step}`;

      const sequenceData: NotificationSequenceData = {
        medicationId,
        medicationName,
        dosage,
        instructions,
        scheduleId: baseNotificationId, // Keep original ID for grouping/tracking
        familyMemberId,
        step,
        totalSteps,
        reminderStyle,
        snoozeDuration,
        scheduledTime: triggerTime.toISOString(),
      };

      if (isFullScreen) {
        await scheduleFullScreenNotification(stepNotificationId, sequenceData, triggerTime);
      } else {
        await scheduleNormalNotification(stepNotificationId, sequenceData, triggerTime, step);
      }

      await logDebug(`[AndroidNotification] Step ${step}/${totalSteps} scheduled for ${triggerTime.toISOString()}`);
    }

    return baseNotificationId;
  } catch (error) {
    console.error('[AndroidNotification] Error scheduling sequence:', error);
    return null;
  }
}

/**
 * Schedule a normal (auto-dismissible) notification
 */
async function scheduleNormalNotification(
  notificationId: string,
  data: NotificationSequenceData,
  triggerTime: Date,
  step: number
): Promise<void> {
  const triggerId = generateTriggerId(notificationId, step);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerTime.getTime(),
    alarmManager: {
      allowWhileIdle: true,
    },
  };

  await notifee.createTriggerNotification(
    {
      id: notificationId, // Same ID for all steps - replaces previous
      title: '💊 Medication Reminder',
      body: `Time to take ${data.medicationName} ${data.dosage}`,
      data: {
        ...data,
        type: 'medication_reminder',
        triggerId,
        step: data.step.toString(),
        totalSteps: data.totalSteps.toString(),
        snoozeDuration: data.snoozeDuration.toString(),
      } as any,
      android: {
        channelId: CHANNEL_REMINDERS,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.REMINDER,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
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
        autoCancel: true,
        showTimestamp: true,
        timestamp: triggerTime.getTime(),
        sound: 'default',
      },
    },
    trigger
  );
}

/**
 * Schedule a full-screen (persistent) notification
 */
async function scheduleFullScreenNotification(
  notificationId: string,
  data: NotificationSequenceData,
  triggerTime: Date
): Promise<void> {
  const triggerId = generateTriggerId(notificationId, data.step);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerTime.getTime(),
    alarmManager: {
      allowWhileIdle: true,
    },
  };

  await notifee.createTriggerNotification(
    {
      id: notificationId, // Same ID - replaces normal notification
      title: '💊 Medication Alarm',
      body: `Time to take ${data.medicationName} ${data.dosage}`,
      data: {
        ...data,
        type: 'medication_reminder',
        isFullScreen: 'true',
        triggerId,
        step: data.step.toString(),
        totalSteps: data.totalSteps.toString(),
        snoozeDuration: data.snoozeDuration.toString(),
      } as any,
      android: {
        channelId: CHANNEL_ALARMS,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.ALARM,
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
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
        ongoing: true,
        autoCancel: false,
        showTimestamp: true,
        timestamp: triggerTime.getTime(),
        sound: 'default',
      },
    },
    trigger
  );
}

/**
 * Cancel all pending notifications for a sequence
 */
export async function cancelPendingSequence(
  notificationId: string,
  totalSteps: number = 4
): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // Cancel the potential displayed notifications for all steps
    // We loop through all potential steps to ensure we catch any active notification
    for (let i = 1; i <= totalSteps; i++) {
        const stepId = `${notificationId}-step${i}`;
        await notifee.cancelNotification(stepId);
        await notifee.cancelTriggerNotification(stepId);
    }
    
    // Also cancel the base ID just in case
    await notifee.cancelNotification(notificationId);
    await notifee.cancelTriggerNotification(notificationId);

    // Cancel all pending triggers via lookup (failsafe)
    const pendingTriggers = await notifee.getTriggerNotifications();
    
    for (const trigger of pendingTriggers) {
      if (trigger.notification.id?.startsWith(notificationId)) {
        await notifee.cancelTriggerNotification(trigger.notification.id!);
      }
    }

    console.log(`[AndroidNotification] Cancelled sequence for: ${notificationId}`);
  } catch (error) {
    console.error('[AndroidNotification] Error cancelling sequence:', error);
  }
}

/**
 * Handle snooze action - continues from current step
 * 
 * @param data - The notification data from the snoozed notification
 */
export async function handleAndroidSnooze(data: NotificationSequenceData): Promise<void> {
  if (Platform.OS !== 'android') return;

  const { 
    medicationId, 
    medicationName, 
    dosage, 
    familyMemberId, 
    instructions,
    step, 
    totalSteps,
    snoozeDuration 
  } = data;

  // Cancel current sequence
  const notificationId = generateNotificationId(medicationId, familyMemberId);
  await cancelPendingSequence(notificationId, totalSteps);

  // If already on last step, just reschedule the same step
  const nextStep = step >= totalSteps ? step : step;
  
  // Schedule snooze time from NOW (not from original scheduled time)
  const snoozeTime = new Date();
  snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeDuration);

  console.log(`[AndroidNotification] Snooze: Rescheduling from step ${step} at ${snoozeTime.toLocaleString()}`);

  // Reschedule remaining sequence starting from current step
  await scheduleNotificationSequence(
    medicationId,
    medicationName,
    dosage,
    familyMemberId,
    snoozeTime,
    instructions,
    nextStep // Continue from current step
  );
}

/**
 * Display an immediate notification (for testing or instant alerts)
 */
export async function displayImmediateNotification(
  medicationId: string,
  medicationName: string,
  dosage: string,
  familyMemberId: string,
  isFullScreen: boolean = false
): Promise<void> {
  if (Platform.OS !== 'android') return;

  const notificationId = generateNotificationId(medicationId, familyMemberId);
  const { reminderStyle, snoozeDuration } = getUserPreferences(familyMemberId);
  const totalSteps = reminderStyle === 'standard' ? 2 : 4;

  const data: NotificationSequenceData = {
    medicationId,
    medicationName,
    dosage,
    scheduleId: notificationId,
    familyMemberId,
    step: isFullScreen ? totalSteps : 1,
    totalSteps,
    reminderStyle,
    snoozeDuration,
    scheduledTime: new Date().toISOString(),
  };

  await notifee.displayNotification({
    id: notificationId,
    title: isFullScreen ? '💊 Medication Alarm' : '💊 Medication Reminder',
    body: `Time to take ${medicationName} ${dosage}`,
    data: {
      ...data,
      type: 'medication_reminder',
      isFullScreen: isFullScreen ? 'true' : 'false',
      step: data.step.toString(),
      totalSteps: data.totalSteps.toString(),
      snoozeDuration: data.snoozeDuration.toString(),
    } as any,
    android: {
      channelId: isFullScreen ? CHANNEL_ALARMS : CHANNEL_REMINDERS,
      importance: AndroidImportance.HIGH,
      category: isFullScreen ? AndroidCategory.ALARM : AndroidCategory.REMINDER,
      ...(isFullScreen && {
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        ongoing: true,
        autoCancel: false,
      }),
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
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
      sound: 'default',
    },
  });
}
