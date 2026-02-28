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

// Load environment variables directly via process.env (Expo SDK 49+ recommended)
// Fallback to expo-constants for backward compatibility
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;


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
  // NOTE: No custom fetch wrapper. The previous AbortController-based wrapper
  // conflicted with the whatwg-fetch polyfill (used by cross-fetch inside
  // @supabase/supabase-js), causing POST requests to fail with
  // "Network request failed" on React Native.
  // React Native's default fetch timeout is sufficient for all operations.
});

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
