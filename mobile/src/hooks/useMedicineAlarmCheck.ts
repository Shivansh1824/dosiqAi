import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import notifee from '@notifee/react-native';
import { NavigationContainerRef } from '@react-navigation/native';

/**
 * Hook to check for active full-screen alarms and navigate to the alarm screen.
 * This handles the case where a Full Screen Intent launches the app (or brings it to foreground)
 * but the React Navigation state is still on the last screen.
 */
export function useMedicineAlarmCheck(navigationRef: NavigationContainerRef<any>) {
  // Use a ref to track the last checked state to avoid potential loops, 
  // though getDisplayedNotifications is relatively cheap.
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const checkActiveAlarm = async () => {
      try {
        // Only proceed if navigation is ready
        if (!navigationRef.isReady()) {
          console.log('[useMedicineAlarmCheck] Navigation not ready yet');
          return;
        }

        const notifications = await notifee.getDisplayedNotifications();

        // Find a notification that is marked as full screen
        const alarm = notifications.find(n => n.notification.data?.isFullScreen === 'true');

        if (alarm) {
          console.log('[useMedicineAlarmCheck] 🚨 Full screen alarm detected:', alarm.notification.id);
          const data = alarm.notification.data;

          // Check if we are already on the MedicineAlarm screen to avoid redundant navigation
          const currentRoute = navigationRef.getCurrentRoute();
          if (currentRoute?.name === 'medicinealarm') {
            console.log('[useMedicineAlarmCheck] Already on medicinealarm screen, skipping navigation');
            // Optional: Update params if needed, but usually a new screen push is safer for alarms
            return;
          }

          console.log('[useMedicineAlarmCheck] Navigating to medicinealarm...');
          // Navigate to MedicineAlarm with data
          // @ts-ignore - Expo router handles this but types might complain
          navigationRef.navigate('/medicinealarm', data);
        }
      } catch (error) {
        console.error('[useMedicineAlarmCheck] Error checking alarms:', error);
      }
    };

    // Check immediately on mount (or when nav ref becomes available)
    checkActiveAlarm();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[useMedicineAlarmCheck] App came to foreground, checking for alarms');
        checkActiveAlarm();
      }

      // Also check if we just transitioned to active (e.g. from a cold start state)
      if (nextAppState === 'active') {
        checkActiveAlarm();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [navigationRef]); // Re-run if ref changes, though it usually is stable
}
