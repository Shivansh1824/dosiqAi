import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDocumentSync } from './useDocumentSync';
import { SyncService } from '../services/SyncService';

/**
 * Hook to handle app initialization
 * Loads auth state from AsyncStorage before rendering the app
 *
 * Usage in App.tsx:
 * const { isAppReady } = useAppInitialization();
 * if (!isAppReady) return <SplashScreen />;
 */
export const useAppInitialization = () => {
  console.log('[DEBUG] [useAppInitialization] Hook called');

  const [isAuthReady, setIsAuthReady] = useState(false);
  const initialize = useAuthStore((state) => state.initialize);
  const isInitializing = useRef(false);

  // Start automatic document sync (polling)
  useDocumentSync();

  useEffect(() => {
    // PREVENT redundant initialization if already running or ready
    if (isInitializing.current || isAuthReady) return;

    console.log('[DEBUG] [useAppInitialization] useEffect triggered');

    const initApp = async () => {
      try {
        isInitializing.current = true;
        console.log('[DEBUG] [AppInit] Starting app initialization...');
        console.log('[DEBUG] [AppInit] Timestamp:', new Date().toISOString());

        // Initialize auth store (loads from AsyncStorage)
        console.log('[DEBUG] [AppInit] Calling auth store initialize...');
        await initialize();
        console.log('[DEBUG] [AppInit] Auth store initialized successfully');

        // 2. Initialize Notification Service (Permissions & iOS Categories)
        console.log('[DEBUG] [AppInit] Initializing Notification Service...');
        const { initializeNotifications } = require('../services/notificationService');
        await initializeNotifications();
        console.log('[DEBUG] [AppInit] Notification Service initialized');

        // 3. Perform Data Reconciliation Audit (Truth Sync)
        const user = useAuthStore.getState().user;
        if (user?.id) {
          SyncService.performReconciliationAudit(user.id);
        }

        // Add any other initialization tasks here
        // e.g., load fonts, check for updates, etc.

        console.log('[DEBUG] [AppInit] App initialization complete');
        setIsAuthReady(true);
        console.log('[DEBUG] [AppInit] isAuthReady set to true');
      } catch (error) {
        console.error('[DEBUG] [AppInit] ❌ Initialization error:', error);
        console.error('[DEBUG] [AppInit] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Even if there's an error, we should let the app load
        console.log('[DEBUG] [AppInit] Setting isAuthReady to true despite error');
        setIsAuthReady(true);
      }
    };

    initApp();
  }, [initialize]);

  return { isAppReady: isAuthReady };
};
