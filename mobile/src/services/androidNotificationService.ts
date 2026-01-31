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
 * - Custom sounds via specific Channels (Android 8.0+)
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

// Channel IDs Base
// Channel IDs Base
// Unified channel for both alarms and reminders (differentiated by notification payload)
const CHANNEL_MEDICATION = 'medication-notifications';

// Old Legacy IDs (for cleanup)
const LEGACY_CHANNEL_REMINDERS = 'medication-reminders';
const LEGACY_CHANNEL_ALARMS = 'medication-alarms';

// Channel Group IDs
const GROUP_MEDICATION = 'group-medication-notifications';

// Defined Tunes (DB Value -> Android Raw Resource Name)
const TUNE_MAPPING: Record<string, string> = {
  'dosiqai_alert_3s': 'notification_3sec',
  'dosiqai_alert_6s': 'notification_6sec',
  'dosiqai_alert_12s': 'notification_12sec',
  // Keep legacy mappings just in case
  'notification_3sec': 'notification_3sec',
  'notification_6sec': 'notification_6sec',
  'notification_12sec': 'notification_12sec',
};

const APP_TUNE_KEYS = Object.keys(TUNE_MAPPING);

/**
 * Simple string hash for generating unique channel IDs from URIs
 */
function fastHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'c' + Math.abs(hash).toString();
}

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
  notification_tune?: string;
}

/**
 * Initialize Android notification channels
 * Call this on app startup (Android only)
 */
export async function initializeAndroidNotifications(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // 0. Cleanup Old Consolidated/Split Channels (To fix "duplicacy")
    const oldPrefixes = [LEGACY_CHANNEL_REMINDERS, LEGACY_CHANNEL_ALARMS];
    const oldSuffixes = ['default', 'silent', 'notification_3sec', 'notification_6sec', 'notification_12sec'];

    // Delete base legacy channels
    await notifee.deleteChannel(LEGACY_CHANNEL_REMINDERS);
    await notifee.deleteChannel(LEGACY_CHANNEL_ALARMS);

    // Delete the split channels created in previous steps
    for (const prefix of oldPrefixes) {
      for (const suffix of oldSuffixes) {
        await notifee.deleteChannel(`${prefix}-${suffix}`);
      }
    }
    
    // Delete old groups if possible (Notifee might not expose deleteChannelGroup, but deleting channels is key)
    // await notifee.deleteChannelGroup('group-medication-reminders'); 
    // await notifee.deleteChannelGroup('group-medication-alarms');

    // 1. Create Unified Channel Group
    await notifee.createChannelGroup({
      id: GROUP_MEDICATION,
      name: 'Medication Notifications',
      description: 'All medication reminders and alarms',
    });

    const channels = [];

    // 2. Default Channel
    channels.push({
      id: `${CHANNEL_MEDICATION}-default`,
      name: 'Default Sound',
      description: 'Medication notifications using system default sound',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      lights: true,
      groupId: GROUP_MEDICATION,
    });

    // 3. Silent Channel
    channels.push({
      id: `${CHANNEL_MEDICATION}-silent`,
      name: 'Silent (No Sound)',
      description: 'Silent medication notifications',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: undefined,
      vibration: true,
      lights: true,
      groupId: GROUP_MEDICATION,
    });

    // 4. Custom Sound Channels (from Mapping)
    // We iterate over unique resource names to create the standard channels
    const uniqueResources = Array.from(new Set(Object.values(TUNE_MAPPING)));
    
    for (const resourceName of uniqueResources) {
      channels.push({
        id: `${CHANNEL_MEDICATION}-${resourceName}`,
        name: `${formatTuneName(resourceName)} Sound`,
        description: `Medication notifications with ${formatTuneName(resourceName)} sound`,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: resourceName, // This MUST match the file in res/raw
        vibration: true,
        lights: true,
        groupId: GROUP_MEDICATION,
      });
    }

    await notifee.createChannels(channels);

    console.log('[AndroidNotification] Unified channels created and legacy channels cleaned up');
  } catch (error) {
    console.error('[AndroidNotification] Error creating/cleaning channels:', error);
  }
}

/**
 * Helper to format tune name for channel display
 */
function formatTuneName(tune: string): string {
  if (tune.includes('3sec')) return 'Short';
  if (tune.includes('6sec')) return 'Medium';
  if (tune.includes('12sec')) return 'Long';
  return tune;
}

/**
 * Get (and create if needed) the correct channel ID for a tune
 * Handles: Silent, Default, App Tunes (Bundled), and System Tunes (Dynamic)
 */
async function prepareChannelForTune(tune?: string): Promise<string> {
    // 1. Base Channel Group
    const groupId = GROUP_MEDICATION;

    // 2. Handle Empty/Silent
    if (!tune || tune.trim() === '' || tune === 'none') {
        return `${CHANNEL_MEDICATION}-silent`;
    }

    // 3. Handle Default
    if (tune === 'default') {
        return `${CHANNEL_MEDICATION}-default`;
    }

    // 4. Handle App Bundled Tunes
    const cleanTune = tune.replace(/\.(mp3|wav)$/, '');
    
    // Check if this is one of our mapped app tunes
    if (TUNE_MAPPING[cleanTune]) {
        // Use the mapped resource name for the channel ID to keep it clean/consistent
        // Or stick to the DB name. Let's start using the Resource Name for the channel suffix
        // to match the legacy behavior if possible, OR just use the resource name.
        // Actually, existing channels were likely `medication-reminders-notification_3sec`.
        // So we should return `${CHANNEL_MEDICATION}-${TUNE_MAPPING[cleanTune]}`
        return `${CHANNEL_MEDICATION}-${TUNE_MAPPING[cleanTune]}`; 
    }

    // 5. Handle System Tunes (Dynamic Creation)
    // If we are here, 'tune' is likely a URI (content://...) or a raw ID
    // We generate a unique Channel ID for this specific sound
    const safeId = fastHash(tune);
    const customChannelId = `${CHANNEL_MEDICATION}-custom-${safeId}`;

    // Create (or update) this specific channel
    // Note: createChannel is safe to call repeatedly (idempotent updates)
    await notifee.createChannel({
        id: customChannelId,
        name: 'Custom Reminder Sound', 
        description: 'Medication notifications with custom system sound',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: tune, // Pass the URI directly
        vibration: true,
        lights: true,
        groupId: groupId,
    });

    console.log(`[AndroidNotification] Created/Ensured custom channel: ${customChannelId} for sound: ${tune}`);
    return customChannelId;
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
  snoozeDuration: number;
  notificationTune: string;
} {
  const { familyMembers } = useFamilyMembersStore.getState();
  const member = familyMembers.find(m => m.id === familyMemberId);

  return {
    reminderStyle: member?.reminder_style || 'standard',
    snoozeDuration: member?.snooze_duration || 10,
    notificationTune: member?.android_notification_tune || 'notification_6sec',
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
    const { reminderStyle, snoozeDuration, notificationTune } = getUserPreferences(familyMemberId);
    const baseNotificationId = generateNotificationId(medicationId, familyMemberId);
    
    // Determine total steps based on mode
    const totalSteps = reminderStyle === 'standard' ? 2 : 4;
    
    console.log('='.repeat(60));
    console.log(`[AndroidNotification] 📋 SCHEDULING SEQUENCE`);
    console.log(`[AndroidNotification] Mode: ${reminderStyle} (${totalSteps} steps)`);
    console.log(`[AndroidNotification] Medication: ${medicationName}`);
    console.log(`[AndroidNotification] Starting from step: ${startStep}`);
    console.log(`[AndroidNotification] Snooze duration: ${snoozeDuration} minutes`);
    console.log(`[AndroidNotification] Tune: ${notificationTune || 'Default'}`);
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
        notification_tune: notificationTune,
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
  // Use unified channel (no base channel arg needed anymore)
  const channelId = await prepareChannelForTune(data.notification_tune);

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
        notification_tune: data.notification_tune,
      } as any,
      android: {
        channelId: channelId,
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
        sound: data.notification_tune || 'default', // Redundant for channels, but safe to keep
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
  // Use unified channel
  const channelId = await prepareChannelForTune(data.notification_tune);

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
        notification_tune: data.notification_tune,
      } as any,
      android: {
        channelId: channelId,
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
        sound: data.notification_tune || 'default',

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
  const { reminderStyle, snoozeDuration, notificationTune } = getUserPreferences(familyMemberId);
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
    notification_tune: notificationTune,
  };

  const channelId = await prepareChannelForTune(notificationTune);

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
      notification_tune: data.notification_tune,
    } as any,
    android: {
      channelId: channelId,
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
      sound: data.notification_tune || 'default',
    },
  });
}
