import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useDocumentsStore } from '../store/documentsStore';

/**
 * Hook to automatically sync documents with Supabase every 30 minutes
 * Pauses sync when app goes to background to save battery
 *
 * Usage in useAppInitialization.ts:
 * useDocumentSync();
 */
export const useDocumentSync = () => {
  const { user } = useAuthStore();
  const fetchDocuments = useDocumentsStore((state) => state.fetchDocuments);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!user?.id) {
      console.log('[DocumentSync] No user ID, skipping sync');
      return;
    }

    console.log('[DocumentSync] Starting automatic document sync for user:', user.id);

    // Start 30-minute interval
    const startSync = () => {
      console.log('[DocumentSync] Starting sync interval (30min)');

      // Initial sync (silent - no loading spinner)
      fetchDocuments(user.id, true);

      // Set up 30-minute interval
      intervalRef.current = setInterval(() => {
        console.log('[DocumentSync] Running periodic sync...');
        fetchDocuments(user.id, true); // Always silent for background sync
      }, 1800000); // 30 minutes = 1800000ms
    };

    // Stop interval
    const stopSync = () => {
      if (intervalRef.current) {
        console.log('[DocumentSync] Stopping sync interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Handle app state changes (pause in background, resume in foreground)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[DocumentSync] AppState change:', appState.current, '→', nextAppState);

      // App coming to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[DocumentSync] App resumed, restarting sync');
        startSync();
      }

      // App going to background
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('[DocumentSync] App backgrounded, pausing sync');
        stopSync();
      }

      appState.current = nextAppState;
    };

    // Start sync immediately
    startSync();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount
    return () => {
      console.log('[DocumentSync] Cleaning up');
      stopSync();
      subscription.remove();
    };
  }, [user?.id, fetchDocuments]);
};
