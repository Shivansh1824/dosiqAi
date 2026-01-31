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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Medication } from '../types/medication';
import { logDebug } from './debugLogger';
import { useFamilyMembersStore } from '../store/familyMembersStore';
import { useMedicationsStore } from '../store/medicationsStore';
import {
  initializeAndroidNotifications,
  scheduleNotificationSequence as scheduleAndroidSequence,
  generateNotificationId,
} from './androidNotificationService';

// iOS category ID for action buttons
const MEDICATION_CATEGORY_ID = 'medication-actions';

/**
 * Helper to resolve the correct sound filename for iOS
 * Maps internal app tune defaults (MP3) to iOS native resources (CAF/WAV)
 */
function resolveIOSSoundName(notificationTune: string | undefined): string | undefined {
  if (!notificationTune || notificationTune.trim() === '') {
    return undefined; // Silent
  }

  // System default
  if (notificationTune === 'default') {
    return 'default';
  }

  // Map App Tunes (MP3) -> iOS Native Resources (CAF)
  // These files MUST exist in the 'ios/Resources' folder or 'Build Phases -> Copy Bundle Resources'
  // Map App Tunes (MP3) -> iOS Native Resources (CAF)
  // These files MUST exist in the 'ios/Resources' folder or 'Build Phases -> Copy Bundle Resources'
  const mapping: Record<string, string> = {
    'dosiqai_alert_3s.mp3': 'notification_3sec.caf',
    'dosiqai_alert_6s.mp3': 'notification_6sec.caf',
    'dosiqai_alert_12s.mp3': 'notification_12sec.caf',
    // Legacy support for raw names
    'notification_3sec': 'notification_3sec.caf',
    'notification_6sec': 'notification_6sec.caf',
    'notification_12sec': 'notification_12sec.caf',
  };

  if (mapping[notificationTune]) {
    return mapping[notificationTune];
  }

  // STRICT SAFEGUARD:
  // If we receive an Android URI (e.g. "content://...") or any unknown filename,
  // we MUST fallback to 'default' for iOS to prevent silence or errors.
  // We do NOT try to guess extensions (wav/mp3) anymore.
  console.log(`[NotificationService] Tune '${notificationTune}' not found in iOS mapping. Fallback to 'default'.`);
  return 'default';
}

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
  // iOS Follow-up count (0-3)
  iosFollowUpCount?: number;
}

// Key generator for iOS notification storage
const getIOSFollowUpStorageKey = (scheduleId: string) => `ios_followups_${scheduleId}`;

/**
 * Store iOS follow-up notification IDs for later cancellation
 */
async function storeIOSFollowUpIds(scheduleId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(getIOSFollowUpStorageKey(scheduleId), JSON.stringify(ids));
    await logDebug(`[NotificationService] Stored ${ids.length} iOS follow-up IDs for: ${scheduleId}`);
  } catch (error) {
    console.error('[NotificationService] Failed to store iOS follow-up IDs:', error);
  }
}

/**
 * Retrieve and clear iOS follow-up notification IDs
 */
async function getAndClearIOSFollowUpIds(scheduleId: string): Promise<string[]> {
  try {
    const key = getIOSFollowUpStorageKey(scheduleId);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      await AsyncStorage.removeItem(key);
      const ids = JSON.parse(stored) as string[];
      await logDebug(`[NotificationService] Retrieved ${ids.length} iOS follow-up IDs for: ${scheduleId}`);
      return ids;
    }
  } catch (error) {
    console.error('[NotificationService] Failed to retrieve iOS follow-up IDs:', error);
  }
  return [];
}

/**
 * Cancel all iOS follow-up notifications for a given schedule
 * Call this when user taps Taken, Skip, or Snooze
 */
/**
 * Cancel all iOS follow-up notifications for a given schedule (Cluster Kill)
 * Scans a 3-day window (Yesterday, Today, Tomorrow) and uses deterministic IDs.
 * Call this when user taps Taken, Skip, or Snooze.
 */
export async function cancelIOSFollowUps(scheduleId: string): Promise<void> {
  // 1. Get base schedule ID (remove any _followup suffixes)
  const baseId = scheduleId.replace(/_followup_\d+(_\d{4}-\d{2}-\d{2})?$/, '');

  // 2. Identify the 3-day window to scan (Yesterday, Today, Tomorrow)
  // This allows for clearing "leaked" follow-ups even if the system clock drifts
  // or the user acts on a notification across the midnight boundary.
  const today = new Date();
  const datesToCheck = [
    new Date(today.getTime() - 24 * 60 * 60 * 1000), // Yesterday
    today,                                           // Today
    new Date(today.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
  ];

  const followUpSlotsToCheck = [1, 2, 3]; // Scan the max supported slots

  for (const checkDate of datesToCheck) {
    // Standardize Local Date String (YYYY-MM-DD)
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

    for (const i of followUpSlotsToCheck) {
      const followUpId = `${baseId}_followup_${i}_${dateStr}`;
      try {
        // cancelNotification removes BOTH pending triggers and delivered alerts (Native: removePending & removeDelivered)
        await notifee.cancelNotification(followUpId);
      } catch (error) {
        // Silent fail
      }
    }
  }

  // 3. Clear the Primary ID from the Notification Tray (Native: removeDelivered)
  // We use cancelDisplayedNotifications to hide the banner WITHOUT killing the infinite daily cycle.
  try {
    await notifee.cancelDisplayedNotifications([baseId]);
  } catch (error) {
    // Silent fail
  }

  await logDebug(`[NotificationService] Cluster Kill completed for: ${baseId}`);
}

/**
 * Schedule iOS follow-ups from DELIVERED event
 * Called by event handler when primary notification fires (for repeating notifications)
 */
export async function scheduleIOSFollowUpsFromEvent(
  primaryId: string,
  medicationName: string,
  dosage: string,
  snoozeDuration: number,
  followUpCount: number,
  notificationTune?: string
): Promise<void> {
  try {
    // Determine iOS sound
    const iosSound = resolveIOSSoundName(notificationTune);

    const followUpIds: string[] = [];
    const now = Date.now();

    for (let i = 1; i <= followUpCount; i++) {
      const followUpTime = new Date(now + (snoozeDuration * i * 60000));
      const followUpId = `${primaryId}_followup_${i}`;

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: followUpTime.getTime(),
        alarmManager: { allowWhileIdle: true },
      };

      await notifee.createTriggerNotification(
        {
          id: followUpId,
          title: `💊 Follow-up Reminder (${i}/${followUpCount})`,
          body: `Did you take ${medicationName} ${dosage}?`,
          data: {
            type: 'medication_reminder',
            medicationName,
            dosage,
            scheduleId: primaryId,
            isFollowUp: 'true',
            followUpNumber: i,
          },
          ios: {
            categoryId: MEDICATION_CATEGORY_ID,
            interruptionLevel: 'timeSensitive',
            sound: iosSound,
            threadId: primaryId,
          },
          android: {
            channelId: 'medication-notifications-default',
            importance: AndroidImportance.HIGH,
            pressAction: { id: 'default', launchActivity: 'default' },
            sound: 'default',
            autoCancel: true,
          },
        },
        trigger
      );

      followUpIds.push(followUpId);
      await logDebug(`[NotificationService] iOS follow-up ${i} scheduled: ${followUpId} at ${followUpTime.toISOString()}`);
    }

    await storeIOSFollowUpIds(primaryId, followUpIds);
    await logDebug(`[NotificationService] Event: Stored ${followUpIds.length} follow-up IDs for ${primaryId}`);
  } catch (error) {
    console.error('[NotificationService] Error scheduling follow-ups from event:', error);
  }
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
      snoozeDuration = 5,
      notificationTune,
      iosFollowUpCount = 0,
    } = reminder;

    console.log('='.repeat(60));
    console.log(`[Notifications] 📋 SCHEDULING MEDICATION REMINDER (${reminderStyle})`);
    console.log('[Notifications] Medication:', reminder.medicationName);
    console.log('[Notifications] Schedule ID:', reminder.scheduleId);
    console.log('[Notifications] Scheduled Time:', reminder.scheduledTime.toLocaleString());
    console.log('[Notifications] Platform:', Platform.OS);
    console.log('[Notifications] familyMemberId:', reminder.familyMemberId);
    console.log('[Notifications] Tune:', notificationTune || 'Default');
    console.log('[Notifications] iOS Follow-up Count:', iosFollowUpCount);
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
    // - Custom: Mapped via resolveIOSSoundName (e.g. .mp3 -> .caf)

    const iosSound = resolveIOSSoundName(notificationTune);
    console.log(`[Notifications] iOS Sound Resolution: Input='${notificationTune}' -> Resolved='${iosSound}'`);

    const notificationId = await notifee.createTriggerNotification(
      {
        id: reminder.scheduleId,
        title: '💊 Medication Reminder',
        body: `Time to take ${reminder.medicationName} ${reminder.dosage}`,
        data: {
          ...reminder,
          type: 'medication_reminder',
          scheduledTime: reminder.scheduledTime.toISOString(),
          // Explicitly include iOS follow-up count for DELIVERED handler
          iosFollowUpCount: iosFollowUpCount,
          snoozeDuration: snoozeDuration,
          notificationTune: notificationTune || 'default',
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

    // --- iOS FOLLOW-UP SCHEDULING ---
    // Schedule additional follow-up notifications based on iosFollowUpCount (0-3)
    if (Platform.OS === 'ios' && iosFollowUpCount > 0) {
      const followUpIds: string[] = [];

      for (let i = 1; i <= iosFollowUpCount; i++) {
        const followUpTime = new Date(reminder.scheduledTime.getTime() + (snoozeDuration * i * 60000));
        const followUpId = `${reminder.scheduleId}_followup_${i}`;

        const followUpTrigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: followUpTime.getTime(),
          alarmManager: {
            allowWhileIdle: true,
          },
        };

        await notifee.createTriggerNotification(
          {
            id: followUpId,
            title: `💊 Follow-up Reminder (${i}/${iosFollowUpCount})`,
            body: `Did you take ${reminder.medicationName} ${reminder.dosage}?`,
            data: {
              ...reminder,
              type: 'medication_reminder',
              scheduledTime: followUpTime.toISOString(),
              isFollowUp: 'true', // String for notification data compatibility
              followUpNumber: i,
              originalScheduleId: reminder.scheduleId,
            },
            ios: {
              categoryId: MEDICATION_CATEGORY_ID,
              interruptionLevel: 'timeSensitive',
              sound: iosSound,
              threadId: reminder.scheduleId, // Group with primary notification
            },
            android: {
              channelId: 'medication-notifications-default',
              importance: AndroidImportance.HIGH,
              pressAction: { id: 'default', launchActivity: 'default' },
              sound: 'default',
              autoCancel: true,
            },
          },
          followUpTrigger
        );

        followUpIds.push(followUpId);
        await logDebug(`[NotificationService] iOS follow-up ${i} scheduled: ${followUpId} at ${followUpTime.toISOString()}`);
      }

      // Store follow-up IDs for later cancellation
      await storeIOSFollowUpIds(reminder.scheduleId, followUpIds);
      await logDebug(`[NotificationService] Stored ${followUpIds.length} iOS follow-up IDs for cancellation`);
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

    // Determine effective tune based on Platform using Split-Field Strategy
    const effectiveTune = Platform.OS === 'ios'
        ? familyMember?.ios_notification_tune
        : familyMember?.android_notification_tune;

    await logDebug(`[NotificationService] Scheduling reminders for ${medication.name}. Member: ${familyMember?.name || 'Unknown'}, Tune: ${effectiveTune}`);

    const settings = {
      reminderStyle: familyMember?.reminder_style || 'standard',
      alertMode: familyMember?.alert_display_mode || 'temporary',
      snoozeDuration: familyMember?.snooze_duration || 10,
      notificationTune: effectiveTune,
      iosFollowUpCount: familyMember?.ios_followup_count ?? 2, // Default: 2 follow-ups
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
      notificationTune,
      iosFollowUpCount = 0,
      snoozeDuration = 5,
    } = reminder;

    console.log('='.repeat(60));
    console.log(`[Notifications] 📋 SCHEDULING REPEATING REMINDER (${repeatFrequency})`);
    console.log('[Notifications] Medication:', reminder.medicationName);
    console.log('[Notifications] Platform:', Platform.OS);
    console.log('[Notifications] Tune:', notificationTune || 'Default');
    console.log('='.repeat(60));

    // --- ANDROID: For repeating reminders, schedule the escalation sequence ---
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

    // --- iOS HYBRID STRATEGY: Shield + Rolling Window ---
    console.log('[Notifications] 🛡️ Deploying Hybrid Architecture (Shield + Rolling Window)');
    console.log('[Notifications] iOS Follow-up Count:', iosFollowUpCount);
    await logDebug(`[NotificationService] Scheduling Repeating: ${reminder.scheduleId}, FollowUps: ${iosFollowUpCount}, Tune: ${notificationTune}`);

    // Determine iOS sound
    const iosSound = resolveIOSSoundName(notificationTune);

    // A. SCHEDULE THE SHIELD (Primary Native Repeating Trigger)
    // This ensures that even if the app dies or slots full, the main alarm RINGS.
    const primaryTrigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: reminder.scheduledTime.getTime(), // First occurrence
      repeatFrequency: RepeatFrequency.DAILY,      // <--- THE SHIELD (Infinite)
      alarmManager: { allowWhileIdle: true },
    };

    await notifee.createTriggerNotification(
      {
        id: reminder.scheduleId, // The Primary ID (e.g. med_123)
        title: '💊 Medication Reminder',
        body: `Time to take ${reminder.medicationName} ${reminder.dosage}`,
        data: {
          ...reminder, // Contains scheduleId, medicationName, etc.
          type: 'medication_reminder',
          scheduledTime: reminder.scheduledTime.toISOString(),
          iosFollowUpCount: iosFollowUpCount,
          snoozeDuration: snoozeDuration,
          notificationTune: notificationTune || 'default',
        },
        ios: {
          categoryId: MEDICATION_CATEGORY_ID,
          interruptionLevel: 'timeSensitive',
          sound: iosSound,
          threadId: reminder.scheduleId,
        },
        android: {
          channelId: 'medication-notifications-default',
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default', launchActivity: 'default' },
          sound: 'default',
          autoCancel: true,
        },
      },
      primaryTrigger
    );
    console.log(`[Notifications] ✅ Shield Deployed: Native Daily Trigger for ${reminder.scheduleId}`);
    await logDebug(`[NotificationService] Shield Deployed: ${reminder.scheduleId}`);

    // B. SCHEDULE THE SMART LAYER (Rolling Follow-ups)
    // We only schedule follow-ups for the next 3 days to save slots.
    // The "Refill Engine" will add more days as time passes.

    // If NO follow-ups needed, we are done!
    if (iosFollowUpCount <= 0) {
      console.log('[Notifications] No follow-ups requested, skipping smart layer.');
      return reminder.scheduleId;
    }

    const DAYS_TO_SCHEDULE = 3;
    console.log(`[Notifications] Scheduling follow-ups for next ${DAYS_TO_SCHEDULE} days. SnoozeDuration: ${snoozeDuration}m`);

    for (let dayOffset = 0; dayOffset < DAYS_TO_SCHEDULE; dayOffset++) {
      // Calculate the base time for this day's instance
      const dayTime = new Date(reminder.scheduledTime);
      dayTime.setDate(dayTime.getDate() + dayOffset);

      // If time passed (> 24h ago), skip
      // We allow "today" even if slightly passed, but check individual follow-ups
      if (dayTime.getTime() < Date.now() - (24 * 60 * 60 * 1000)) {
        console.log(`[Notifications] Skipping day ${dayOffset} (Date: ${dayTime.toLocaleDateString()}) - too old`);
        continue;
      }

      // Check Safety Valve
      const pendingIds = await notifee.getTriggerNotificationIds();
      if (pendingIds.length >= 60) {
        console.log('[Notifications] 🛑 Safety Valve triggered! Approaching 64 limit. Stopping scheduling.');
        await logDebug('[NotificationService] Safety Valve Triggered (60+ notifications)');
        break;
      }

      // Derived ID for grouping (Local date - avoids UTC boundary issues)
      const dateStr = `${dayTime.getFullYear()}-${String(dayTime.getMonth() + 1).padStart(2, '0')}-${String(dayTime.getDate()).padStart(2, '0')}`;
      const dayScheduleId = `${reminder.scheduleId}_${dateStr}`; // Virtual ID needed for linking
      
      console.log(`[Notifications] Day ${dayOffset}: ${dateStr} (Base: ${dayTime.toLocaleTimeString()})`);

      // Schedule FOLLOW-UP notifications for this day
      const followUpIds: string[] = [];

      for (let i = 1; i <= iosFollowUpCount; i++) {
        const followUpTime = new Date(dayTime.getTime() + (snoozeDuration * i * 60000));
        const followUpId = `${reminder.scheduleId}_followup_${i}_${dateStr}`; // e.g. med_123_followup_1_2023-10-27

        // Skip if this follow-up time has already passed
        // Strict check: follow-up must be in the future
        if (followUpTime.getTime() <= Date.now()) {
            console.log(`[Notifications] ⏭️ Skipping past follow-up: ${followUpId} at ${followUpTime.toLocaleTimeString()}`);
            continue;
        }

        const followUpTrigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: followUpTime.getTime(),
          alarmManager: { allowWhileIdle: true },
        };

        await notifee.createTriggerNotification(
          {
            id: followUpId,
            title: `💊 Follow-up Reminder (${i}/${iosFollowUpCount})`,
            body: `Did you take ${reminder.medicationName} ${reminder.dosage}?`,
            data: {
              type: 'medication_reminder',
              medicationId: reminder.medicationId,
              medicationName: reminder.medicationName,
              dosage: reminder.dosage,
              scheduleId: reminder.scheduleId, // Link to Primary
              isFollowUp: 'true',
              followUpNumber: i,
              originalScheduleId: reminder.scheduleId,
            },
            ios: {
              categoryId: MEDICATION_CATEGORY_ID,
              interruptionLevel: 'timeSensitive',
              sound: iosSound,
              threadId: reminder.scheduleId,
            },
            android: {
              channelId: 'medication-notifications-default',
              importance: AndroidImportance.HIGH,
              pressAction: { id: 'default', launchActivity: 'default' },
              sound: 'default',
              autoCancel: true,
            },
          },
          followUpTrigger
        );

        followUpIds.push(followUpId);
        console.log(`[Notifications] ✅ Follow-up ${i} scheduled: ${followUpId} at ${followUpTime.toLocaleTimeString()}`);
        await logDebug(`[NotificationService] Scheduled Follow-up: ${followUpId} @ ${followUpTime.toISOString()}`);
      }
    }

    return reminder.scheduleId;

  } catch (error) {
    console.error('[Notifications] Repeating schedule error:', error);
    await logDebug('[NotificationService] Error scheduling repeating:', error);
    return null;
  }
}

/**
 * Refill Follow-ups (The Engine)
 * Checks all active schedules and ensures next 3 days of follow-ups are present.
 * To be called on App Open & Background Action.
 */
export async function refillFollowUps(): Promise<void> {
  console.log('[Notifications] 🔄 Refill Engine Started...');
  // In a real app, we would fetch all active medications from DB/Store.
  // Since we don't have direct access to the store here (it's a hook), 
  // we might need to rely on the caller to pass data or use a persistent store accessor.
  // For now, let's assume this is called where we have access to medication data.

  // Implementation Note: exact refill logic requires iterating over all meds.
  // We will rely on `scheduleAllRemindersForMedication` to be safe and idempotent.
  // Calling `scheduleAllRemindersForMedication` again effectively acts as a refill 
  // because it recalculates dates and overwrites/adds triggers.
  console.log('[Notifications] 🔄 Refill via rescehduling all... (Requires integration)');
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

/**
 * Reschedule all notifications for a specific family member
 * Used when preferences (sound, snooze, etc.) change
 */
export async function rescheduleAllNotificationsForMember(familyMemberId: string): Promise<void> {
  console.log(`[Notifications] 🔄 Rescheduling all for member: ${familyMemberId}`);
  try {
    const { medications } = useMedicationsStore.getState();
    
    // Filter for active medications belonging to this member
    const memberMedications = medications.filter(
      med => med.family_member_id === familyMemberId && med.is_active
    );

    console.log(`[Notifications] Found ${memberMedications.length} active medications to reschedule.`);

    // Re-schedule each medication
    // This will overwrite existing notification IDs with the new preferences (e.g. sound)
    for (const med of memberMedications) {
      await scheduleAllRemindersForMedication(med);
    }
    
    console.log(`[Notifications] ✅ Reschedule complete for member: ${familyMemberId}`);
  } catch (error) {
    console.error('[Notifications] Error rescheduling for member:', error);
  }
}
