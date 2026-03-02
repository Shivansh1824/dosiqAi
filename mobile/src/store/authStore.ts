import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthStore, User, STORAGE_KEYS } from '../types/auth';
import { auth, checkUserExists } from '../lib/apiClient';
import * as Linking from 'expo-linking';

/**
 * Zustand store for authentication state
 * Integrates with the VPS authentication
 * Persists to AsyncStorage for offline access
 */
export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  hasSeenOnboarding: false,
  isInitialized: false,
  isLoading: true,
  user: null,

  // Actions
  setAuthenticated: (value: boolean) =>
    set({ isAuthenticated: value }),

  setHasSeenOnboarding: (value: boolean) =>
    set({ hasSeenOnboarding: value }),

  setUser: (user: User | null) =>
    set({ user }),

  setLoading: (value: boolean) =>
    set({ isLoading: value }),

  /**
   * Initialize store from AsyncStorage and Supabase session
   * Call this on app start
   */
  initialize: async () => {
    // PREVENT redundant parallel calls during boot
    if (get().isInitialized || get().isLoading) return;

    try {
      console.log('[DEBUG] [AuthStore] initialize() called');
      set({ isLoading: true });

      // Load onboarding state from AsyncStorage
      const hasSeenOnboardingStr = await AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING);
      const hasSeenOnboarding = hasSeenOnboardingStr === 'true';
      console.log('[DEBUG] [AuthStore] hasSeenOnboarding:', hasSeenOnboarding);

      // Check for existing VPS session
      console.log('[DEBUG] [AuthStore] Getting VPS session...');
      const { data: { session }, error } = await auth.getSession();
      console.log('[DEBUG] [AuthStore] VPS session result:', { hasSession: !!session, error: (error as any)?.message });

      if (error) {
        console.error('[AuthStore] Get session error:', error);
      }

      if (session?.user) {
        // User is authenticated — VALID SESSION
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.full_name || session.user.email?.split('@')[0] || 'User',
          createdAt: session.user.created_at,
        };

        // Persist user data to AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, session.access_token);

        set({
          isAuthenticated: true,
          hasSeenOnboarding,
          user,
          isLoading: false,
        });

        console.log('[AuthStore] Initialized with valid VPS session:', user.email);

        // Ensure primary family member exists
        try {
          const { useFamilyMembersStore } = await import('./familyMembersStore');
          const member = await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name);
          if (member) {
            console.log('[AuthStore] Primary family member ready:', member.id);
          } else {
            console.warn('[AuthStore] Could not create family member');
          }
        } catch (error) {
          console.error('[AuthStore] Failed to create primary family member:', error);
        }

        return;
      }

      // No active session
      set({
        isAuthenticated: false,
        hasSeenOnboarding,
        user: null,
        isLoading: false,
        isInitialized: true,
      });

      console.log('[DEBUG] [AuthStore] No active session, user needs to log in.');
    } catch (error) {
      console.error('[DEBUG] [AuthStore] ❌ Initialize error:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Login with email and password
   * Uses Supabase if configured, otherwise demo mode
   */
  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true });

      // Use VPS authentication
      const { data, error } = await auth.signInWithPassword(email, password);

      if (error) {
        console.error('[AuthStore] VPS login error:', error);
        throw new Error(error.message || 'Login failed');
      }

      if (data?.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.name || data.user.full_name || data.user.email?.split('@')[0] || 'User',
          createdAt: data.user.created_at,
        };

        // Persist to AsyncStorage
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.session?.access_token || ''),
          AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user)),
        ]);

        set({
          isAuthenticated: true,
          user,
          isLoading: false,
        });

        console.log('[AuthStore] VPS login successful:', user.email);

        // Ensure primary family member exists
        try {
          const { useFamilyMembersStore } = await import('./familyMembersStore');
          await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name);
        } catch (error) {
          console.error('[AuthStore] Failed to create primary family member:', error);
        }

        return;
      }
    } catch (error) {
      console.error('[AuthStore] Login error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Logout
   * Signs out from Supabase if configured
   */
  logout: async () => {
    try {
      set({ isLoading: true });

      // Sign out from VPS (also clears AsyncStorage tokens)
      await auth.signOut();

      // Clear legacy AsyncStorage keys too
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
      ]);

      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });

      console.log('[AuthStore] Logout successful');
    } catch (error) {
      console.error('[AuthStore] Logout error:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Login with Google OAuth
   * Requires Supabase configuration and Google OAuth setup
   */
  loginWithGoogle: async () => {
    try {
      set({ isLoading: true });

      const googleUrl = auth.getGoogleOAuthUrl();
      await Linking.openURL(googleUrl);
      // The VPS will redirect to: dosiqai://auth?access_token=...&refresh_token=...&user=...
      // Tokens are handled in App.tsx deep link handler
      console.log('[AuthStore] Google OAuth initiated');
      set({ isLoading: false });
    } catch (error) {
      console.error('[AuthStore] Google login error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Login with Apple OAuth
   * Requires Supabase configuration and Apple OAuth setup
   */
  loginWithApple: async () => {
    try {
      set({ isLoading: true });
      // Apple OAuth not yet supported on VPS
      set({ isLoading: false });
      throw new Error('Apple Sign-In coming soon. Please use email or Google.');
    } catch (error) {
      console.error('[AuthStore] Apple login error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Send OTP to phone number
   * Requires Supabase configuration
   */
  sendPhoneOTP: async (phoneNumber: string) => {
    try {
      const { data, error } = await auth.sendOtp(phoneNumber);

      if (error) {
        console.error('[AuthStore] Phone OTP error:', error);
        throw new Error(error.message || 'Failed to send OTP');
      }

      console.log('[AuthStore] OTP sent successfully to', phoneNumber);
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      console.error('[AuthStore] Send phone OTP error:', error);
      throw error;
    }
  },

  /**
   * Verify OTP and login
   * Requires Supabase configuration
   */
  verifyPhoneOTP: async (phoneNumber: string, otp: string) => {
    try {
      set({ isLoading: true });

      const { data, error } = await auth.verifyOtp(phoneNumber, otp);

      if (error) {
        console.error('[AuthStore] Phone OTP verification error:', error);
        throw new Error(error.message || 'Invalid OTP');
      }

      if (data?.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || phoneNumber + '@phone.user',
          name: data.user.user_metadata?.name || data.user.full_name || phoneNumber,
          createdAt: data.user.created_at,
        };

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.session?.access_token || ''),
          AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user)),
        ]);

        set({
          isAuthenticated: true,
          user,
          isLoading: false,
        });

        console.log('[AuthStore] Phone login successful:', phoneNumber);

        // Ensure primary family member exists
        try {
          const { useFamilyMembersStore } = await import('./familyMembersStore');
          await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name);
        } catch (error) {
          console.error('[AuthStore] Failed to create primary family member:', error);
        }
      }
    } catch (error) {
      console.error('[AuthStore] Verify phone OTP error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Mark onboarding as complete
   */
  completeOnboarding: async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, 'true');
      set({ hasSeenOnboarding: true });
      console.log('[AuthStore] Onboarding completed');
    } catch (error) {
      console.error('[AuthStore] Complete onboarding error:', error);
    }
  },

  /**
   * Check if user exists by email
   */
  checkUserExists: async (email: string): Promise<boolean> => {
    try {
      const exists = await checkUserExists(email);
      return exists;
    } catch (error) {
      console.error('[AuthStore] Check user exists error:', error);
      return false;
    }
  },

  /**
   * Check if phone number exists
   */
  checkPhoneExists: async (phoneNumber: string): Promise<boolean> => {
    try {
      // For phone, we can try sending OTP and check if user exists
      // In production use an admin API endpoint
      return false;
    } catch (error) {
      console.error('[AuthStore] Check phone exists error:', error);
      return false;
    }
  },

  /**
   * Sign up with email and password
   */
  signup: async (email: string, password: string, name: string) => {
    try {
      set({ isLoading: true });

      // Use VPS to create account
      const { data, error } = await auth.signUp(email, password, name);

      if (error) {
        console.error('[AuthStore] VPS signup error:', error);
        throw new Error(error.message || 'Signup failed');
      }

      if (data?.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          name: name || data.user.email?.split('@')[0] || 'User',
          createdAt: data.user.created_at,
        };

        // Persist to AsyncStorage
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.session?.access_token || ''),
          AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user)),
        ]);

        set({
          isAuthenticated: true,
          user,
          isLoading: false,
        });

        console.log('[AuthStore] VPS signup successful:', user.email);

        // Ensure primary family member exists
        try {
          const { useFamilyMembersStore } = await import('./familyMembersStore');
          await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name);
        } catch (error) {
          console.error('[AuthStore] Failed to create primary family member:', error);
        }

        return;
      }
    } catch (error) {
      console.error('[AuthStore] Signup error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Sign up with phone number
   */
  signupWithPhone: async (phoneNumber: string, name: string, otp: string) => {
    try {
      set({ isLoading: true });

      // Verify OTP and create account via VPS
      const { data, error } = await auth.verifyOtp(phoneNumber, otp);

      if (error) {
        console.error('[AuthStore] Phone signup verification error:', error);
        throw new Error(error.message || 'Invalid OTP');
      }

      if (data?.user) {
        // Update user metadata with name
        if (name) await auth.updateUser({ data: { name } });

        const user: User = {
          id: data.user.id,
          email: data.user.email || phoneNumber + '@phone.user',
          name: name || phoneNumber,
          createdAt: data.user.created_at,
        };

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.session?.access_token || ''),
          AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user)),
        ]);

        set({
          isAuthenticated: true,
          user,
          isLoading: false,
        });

        console.log('[AuthStore] Phone signup successful:', phoneNumber);

        // Ensure primary family member exists
        try {
          const { useFamilyMembersStore } = await import('./familyMembersStore');
          await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name);
        } catch (error) {
          console.error('[AuthStore] Failed to create primary family member:', error);
        }

        return;
      }
    } catch (error) {
      console.error('[AuthStore] Phone signup error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Reset store (for development/testing)
   */
  reset: () => {
    set({
      isAuthenticated: false,
      hasSeenOnboarding: false,
      isLoading: false,
      user: null,
    });
  },
}));

/**
 * Helper function to reset all stored data (for development)
 */
export const resetAuthStorage = async () => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING),
      AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
    ]);
    console.log('[AuthStore] Storage reset complete');
  } catch (error) {
    console.error('[AuthStore] Reset storage error:', error);
  }
};
