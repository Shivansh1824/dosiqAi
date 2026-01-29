import { Platform } from 'react-native';
import { startActivity, updateActivity, stopActivity } from 'expo-live-activity';
import { logDebug } from './debugLogger';

interface MedicationActivityAttributes {
  medicationName: string;
  dosage: string;
  scheduleId: string;
}

interface MedicationActivityState {
  status: 'pending' | 'taken' | 'snoozed';
  timeRemaining?: number;
}

// Track active Live Activities by schedule ID
const activeActivities = new Map<string, string>(); // scheduleId -> activityId

export const LiveActivityService = {
  async startMedicationActivity(
    medicationName: string,
    dosage: string,
    scheduleId: string
  ): Promise<string | null> {

    await logDebug(`[LiveActivityService] ========================================`);
    await logDebug(`[LiveActivityService] START REQUEST`);
    await logDebug(`[LiveActivityService] Platform: ${Platform.OS}`);
    await logDebug(`[LiveActivityService] Medication: ${medicationName}`);
    await logDebug(`[LiveActivityService] Dosage: ${dosage}`);
    await logDebug(`[LiveActivityService] Schedule ID: ${scheduleId}`);

    try {
      if (Platform.OS !== 'ios') {
        await logDebug('[LiveActivityService] Skipping - not iOS');
        return null;
      }

      const contentState = {
        title: medicationName,
        subtitle: dosage,
        // New fields for Rich Design
        medicationName: medicationName,
        doseStrength: dosage,
        doseTime: "Now", // Logic to be refined
        doseNote: "Tap to view details",
        currentDose: 1, 
        totalDoses: 1
      };

      const attributes = {
        name: 'Medication Activity',
        deepLinkUrl: scheduleId,
      };

      await logDebug('[LiveActivityService] Payload:', JSON.stringify({ contentState, attributes }));
      await logDebug('[LiveActivityService] Calling expo-live-activity startActivity()...');

      const activityId = await startActivity(contentState, attributes);

      await logDebug(`[LiveActivityService] ✓ SUCCESS! Activity ID: ${activityId}`);
      await logDebug(`[LiveActivityService] Type: ${typeof activityId}`);
      await logDebug(`[LiveActivityService] ========================================`);
      
      // Store the activity ID for later cleanup
      if (activityId) {
        activeActivities.set(scheduleId, activityId);
        await logDebug(`[LiveActivityService] Stored activity mapping: ${scheduleId} -> ${activityId}`);
      }
      
      return activityId || null;
    } catch (error) {
      await logDebug('[LiveActivityService] ✗ FAILED');
      await logDebug('[LiveActivityService] Error type:', typeof error);
      await logDebug('[LiveActivityService] Error message:', String(error));

      if (error && typeof error === 'object') {
        try {
          await logDebug('[LiveActivityService] Error details:', JSON.stringify(error, null, 2));
        } catch (e) {
          await logDebug('[LiveActivityService] Could not stringify error');
        }
      }

      await logDebug(`[LiveActivityService] ========================================`);
      return null;
    }
  },

  async updateActivity(activityId: string, status: 'taken' | 'snoozed') {
    try {
      // To update, we must match the ContentState structure (title/subtitle)
      // If we just want to update status, we might need to know the original title/subtitle
      // Or if the library allows partial updates. 
      // NOTE: expo-live-activity updateActivity takes (id, state).
      
      // For now, this demo update might need to know the medication name again
      // to keep it visible, or if the view persists old state values not passed.
      // Swift `ContentState` is value type; replacing it usually requires full state.
      
      /* 
         WARNING: Real implementation should store the active medication details 
         so we can re-emit them here. For the Demo, we might not update the text
         or we accept that update might require full payload.
      */
       
       console.log('[LiveActivity] Update requested (Not fully implemented for demo)');
    } catch (error) {
      console.error('[LiveActivity] Error updating activity:', error);
    }
  },

  async endActivity(activityId: string) {
    try {
      // Pass null or empty state if allowed, or last known state
      // expo-live-activity stopActivity(id, state)
      
      // We'll just pass an empty title to signal end, or null
      // @ts-ignore
      await stopActivity(activityId, {
        title: 'Ended' 
      });
      
      // Clean up from tracking map
      for (const [scheduleId, storedActivityId] of activeActivities.entries()) {
        if (storedActivityId === activityId) {
          activeActivities.delete(scheduleId);
          await logDebug(`[LiveActivityService] Removed activity mapping for: ${scheduleId}`);
          break;
        }
      }
      
      console.log('[LiveActivity] Ended:', activityId);
    } catch (error) {
      console.error('[LiveActivity] Error ending activity:', error);
    }
  },

  /**
   * Get the active Live Activity ID for a given schedule ID
   */
  getActivityId(scheduleId: string): string | null {
    return activeActivities.get(scheduleId) || null;
  },

  /**
   * Clear all tracked activities (useful for cleanup)
   */
  clearAllActivities() {
    activeActivities.clear();
  }
};
