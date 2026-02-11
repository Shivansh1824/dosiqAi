/**
 * Supabase Client Configuration
 *
 * Environment variables are loaded via expo-constants
 * - Local development: Uses .env file
 * - EAS builds: Uses secrets from eas.json
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Load environment variables from expo-constants
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl;
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey;

// Use placeholder values if not configured (for build/development)
const EFFECTIVE_SUPABASE_URL = SUPABASE_URL || 'https://placeholder.supabase.co';
const EFFECTIVE_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY || 'placeholder-anon-key-for-build';

// Validate environment variables (warn but don't throw)
const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isConfigured) {
  console.warn(
    '⚠️ [Supabase] Configuration missing! Using placeholder values.\n' +
    'To enable Supabase:\n' +
    '1. Create a .env file (copy from .env.example)\n' +
    '2. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
    '3. Restart the Expo dev server\n' +
    'Get credentials from: https://supabase.com/dashboard > Settings > API'
  );
}

/**
 * Supabase client instance
 * Configured with AsyncStorage for session persistence
 *
 * Note: If env vars are missing, this uses placeholder values.
 * Auth operations will fail gracefully at runtime.
 */
export const supabase = createClient(EFFECTIVE_SUPABASE_URL, EFFECTIVE_SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    // Increase fetch timeout to 120s to prevent premature timeouts on slow networks or long AI tasks
    fetch: (url, options) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 120000);
      
      // Merge signals if one was provided in options
      if (options?.signal) {
          options.signal.addEventListener('abort', () => {
              controller.abort();
              clearTimeout(id);
          });
      }

      return fetch(url, { ...options, signal: controller.signal })
        .then(response => {
            clearTimeout(id);
            return response;
        })
        .catch(error => {
            clearTimeout(id);
            throw error;
        });
    },
  },
});

// Test connectivity immediately
fetch(EFFECTIVE_SUPABASE_URL)
  .then(res => console.log('[DEBUG] [Supabase] Connectivity Check: Status', res.status))
  .catch(err => console.error('[DEBUG] [Supabase] Connectivity Check: FAILED', err.message));

/**
 * Helper function to check if Supabase is properly configured
 */
export const isSupabaseConfigured = (): boolean => {
  return isConfigured;
};

// Log configuration status (always log for debugging)
console.log('[DEBUG] [Supabase] Client initialization URL:', EFFECTIVE_SUPABASE_URL); 
console.log('[DEBUG] [Supabase] Client initialization:', {
  hasUrl: !!SUPABASE_URL,
  hasAnonKey: !!SUPABASE_ANON_KEY,
  configured: isConfigured,
  effectiveUrl: EFFECTIVE_SUPABASE_URL,
  timestamp: new Date().toISOString(),
});
