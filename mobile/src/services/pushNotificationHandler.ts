import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { LiveActivityService } from './LiveActivityService';
import { logDebug } from './debugLogger';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  if (error) {
    await logDebug('[PushHandler] Background task error:', error);
    return;
  }
  
  await logDebug('[PushHandler] Background notification received', { data });

  if (data) {
    // Expo Notifications structure: data might be nested in `notification.data` or just `data`
    // depending on the exact payload structure verify.
    // Usually: { notification: { data: { ... } } }
    const notificationData = (data as any).notification?.data || data;
    
    await logDebug('[PushHandler] Parsed data:', notificationData);

    const isFollowUp = notificationData.isFollowUp === true || notificationData.isFollowUp === 'true';

    if (isFollowUp) {
      const scheduleId = notificationData.scheduleId;
      const medicationName = notificationData.medicationName || 'Medication';
      const dosage = notificationData.dosage || '';

      if (scheduleId) {
         await logDebug(`[PushHandler] Triggering Live Activity for: ${medicationName}`);
         try {
             await LiveActivityService.startMedicationActivity(
                 medicationName,
                 dosage,
                 scheduleId
             );
             await logDebug('[PushHandler] Live Activity start requested successfully');
         } catch (err) {
             await logDebug('[PushHandler] Failed to start Live Activity:', err);
         }
      }
    }
  }
});

export function registerBackgroundPushHandler() {
  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK)
    .then(() => logDebug('[PushHandler] Task registered successfully'))
    .catch((err) => logDebug('[PushHandler] Task registration failed:', err));
}
