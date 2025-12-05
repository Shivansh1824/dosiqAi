import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthStore, User, STORAGE_KEYS } from '../types/auth';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

/**
 * Zustand store for authentication state
 * Integrates with Supabase authentication
 * Persists to AsyncStorage for offline access
 */
export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state
  isAuthenticated: false,
  hasSeenOnboarding: false,
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
    try {
      console.log('[DEBUG] [AuthStore] initialize() called');
      console.log('[DEBUG] [AuthStore] Setting isLoading to true');
      set({ isLoading: true });

      // Load onboarding state from AsyncStorage
      console.log('[DEBUG] [AuthStore] Loading onboarding state from AsyncStorage...');
      const hasSeenOnboardingStr = await AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING);
      const hasSeenOnboarding = hasSeenOnboardingStr === 'true';
      console.log('[DEBUG] [AuthStore] hasSeenOnboarding:', hasSeenOnboarding);

      // Check for existing Supabase session
      console.log('[DEBUG] [AuthStore] Checking Supabase configuration...');
      const supabaseConfigured = isSupabaseConfigured();
      console.log('[DEBUG] [AuthStore] Supabase configured:', supabaseConfigured);

      if (supabaseConfigured) {
        console.log('[DEBUG] [AuthStore] Getting Supabase session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[DEBUG] [AuthStore] Supabase session result:', { hasSession: !!session, error: error?.message });

        if (error) {
          console.error('[AuthStore] Get session error:', error);
        }

        if (session?.user) {
          // User is authenticated with Supabase - VALID SESSION
          const user: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
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

          console.log('[AuthStore] Initialized with valid Supabase session:', user.email);

          // Ensure primary family member exists (session is confirmed valid)
          try {
            const { useFamilyMembersStore } = await import('./familyMembersStore');
            const member = await useFamilyMembersStore.getState().ensurePrimaryMemberExists(user.id, user.name);
            if (member) {
              console.log('[AuthStore] Primary family member ready:', member.id);
            } else {
              console.warn('[AuthStore] Could not create family member - session may have expired');
            }
          } catch (error) {
            console.error('[AuthStore] Failed to create primary family member:', error);
          }

          return;
        } else {
          // No active Supabase session - check if we have cached data
          console.log('[AuthStore] No active Supabase session, checking AsyncStorage cache...');

          const [authToken, userDataStr] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
            AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
          ]);

          if (authToken && userDataStr) {
            // We have cached data but no valid Supabase session - SESSION EXPIRED
            console.warn('[AuthStore] ⚠️ Session expired! Cached user found but Supabase session is invalid.');
            console.warn('[AuthStore] Clearing expired session data...');

            // Clear the expired cache
            await Promise.all([
              AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
              AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
            ]);

            // Set state to unauthenticated
            set({
              isAuthenticated: false,
              hasSeenOnboarding,
              user: null,
              isLoading: false,
            });

            console.log('[AuthStore] Expired session cleared. User needs to log in again.');
            return;
          }
        }
      }

      // Fallback: No Supabase or no session - check AsyncStorage for demo/offline mode
      const [authToken, userDataStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
      ]);

      const isAuthenticated = !!authToken;
      const user = userDataStr ? JSON.parse(userDataStr) : null;

      set({
        isAuthenticated,
        hasSeenOnboarding,
        user,
        isLoading: false,
      });

      console.log('[DEBUG] [AuthStore] Initialized:', {
        isAuthenticated,
        hasSeenOnboarding,
        hasUser: !!user,
        supabaseConfigured: isSupabaseConfigured(),
      });

      // NOTE: Do NOT call ensurePrimaryMemberExists() here
      // This path is for AsyncStorage fallback (offline/cached mode)
      // Family member creation requires an active Supabase session
      // It will be created on next actual login when Supabase session is established
    } catch (error) {
      console.error('[DEBUG] [AuthStore] ❌ Initialize error:', error);
      console.error('[DEBUG] [AuthStore] Error details:', error instanceof Error ? error.message : String(error));
      console.error('[DEBUG] [AuthStore] Error stack:', error instanceof Error ? error.stack : 'No stack');
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

      // Check if Supabase is configured
      const supabaseConfigured = isSupabaseConfigured();

      // Demo credentials for when Supabase is not configured
      const DEMO_CREDENTIALS = [
        { email: 'demo@family.com', password: 'demo123' },
        { email: 'test@family.com', password: 'test123' },
      ];

      // If Supabase is not configured, use demo mode
      if (!supabaseConfigured) {
        console.log('[AuthStore] Supabase not configured, using demo mode');

        // Check if credentials match demo credentials
        const isDemoUser = DEMO_CREDENTIALS.some(
          cred => cred.email.toLowerCase() === email.toLowerCase() && cred.password === password
        );

        if (!isDemoUser) {
          throw new Error('Invalid credentials. Use demo@family.com / demo123 for testing.');
        }

        const demoUser: User = {
          id: 'demo-user-123',
          email,
          name: email.split('@')[0],
          createdAt: new Date().toISOString(),
        };

        const demoToken = 'demo-auth-token-' + Date.now();

        // Persist to AsyncStorage
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, demoToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(demoUser)),
        ]);

        set({
          isAuthenticated: true,
          user: demoUser,
          isLoading: false,
        });

        console.log('[AuthStore] Demo login successful:', demoUser.email);

        // Ensure primary family member exists
        try {
          const { useFamilyMembersStore } = await import('./familyMembersStore');
          await useFamilyMembersStore.getState().ensurePrimaryMemberExists(demoUser.id, demoUser.name);
        } catch (error) {
          console.error('[AuthStore] Failed to create primary family member:', error);
        }

        return;
      }

      // Use Supabase authentication (only when configured)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AuthStore] Supabase login error:', error);
        throw new Error(error.message || 'Login failed');
      }

      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
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

        console.log('[AuthStore] Supabase login successful:', user.email);

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

      // Sign out from Supabase if configured
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('[AuthStore] Supabase logout error:', error);
        }
      }

      // Clear AsyncStorage
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

      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Please add your credentials to supabaseClient.ts');
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'familyhealth://auth/callback', // Deep link for mobile
        },
      });

      if (error) {
        console.error('[AuthStore] Google OAuth error:', error);
        throw new Error(error.message || 'Google login failed');
      }

      // OAuth flow will redirect to the app
      // Session will be handled by the auth state listener
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

      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Please add your credentials to supabaseClient.ts');
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'familyhealth://auth/callback', // Deep link for mobile
        },
      });

      if (error) {
        console.error('[AuthStore] Apple OAuth error:', error);
        throw new Error(error.message || 'Apple login failed');
      }

      // OAuth flow will redirect to the app
      // Session will be handled by the auth state listener
      console.log('[AuthStore] Apple OAuth initiated');
      set({ isLoading: false });
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
      if (!isSupabaseConfigured()) {
        // Demo mode - simulate sending OTP with delay
        console.log('[AuthStore] Demo mode: OTP sent to', phoneNumber);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
        return { success: true, message: 'Demo: Use any 6-digit code (e.g., 123456)' };
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
      });

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

      if (!isSupabaseConfigured()) {
        // Demo mode - accept any 6-digit code
        if (otp.length === 6 && /^\d+$/.test(otp)) {
          const demoUser: User = {
            id: 'demo-phone-user-' + Date.now(),
            email: phoneNumber + '@phone.demo',
            name: phoneNumber,
            createdAt: new Date().toISOString(),
          };

          const demoToken = 'demo-phone-token-' + Date.now();

          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, demoToken),
            AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(demoUser)),
          ]);

          set({
            isAuthenticated: true,
            user: demoUser,
            isLoading: false,
          });

          console.log('[AuthStore] Demo phone login successful:', phoneNumber);

          // Ensure primary family member exists
          try {
            const { useFamilyMembersStore } = await import('./familyMembersStore');
            await useFamilyMembersStore.getState().ensurePrimaryMemberExists(demoUser.id, demoUser.name);
          } catch (error) {
            console.error('[AuthStore] Failed to create primary family member:', error);
          }

          return;
        } else {
          throw new Error('Invalid OTP. Please enter a 6-digit code.');
        }
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: otp,
        type: 'sms',
      });

      if (error) {
        console.error('[AuthStore] Phone OTP verification error:', error);
        throw new Error(error.message || 'Invalid OTP');
      }

      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || phoneNumber + '@phone.user',
          name: data.user.user_metadata?.name || phoneNumber,
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
      if (!isSupabaseConfigured()) {
        // Demo mode - check against demo credentials
        const demoEmails = ['demo@family.com', 'test@family.com'];
        return demoEmails.includes(email.toLowerCase());
      }

      // Query Supabase auth users by email
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'dummy-check-' + Date.now(), // This will fail but we can check the error
      });

      if (error) {
        // If error is "Invalid login credentials", user doesn't exist or wrong password
        // We can't distinguish, so we'll use a different approach
        // Instead, we'll try to sign up with a temporary check
        console.log('[AuthStore] Check user exists - trying alternative method');

        // For now, return false to allow signup flow
        // In production, you'd want to use Supabase admin API or a custom endpoint
        return false;
      }

      return !!data.user;
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
      if (!isSupabaseConfigured()) {
        // Demo mode - check against demo phone numbers
        const demoPhones = ['+15551234567', '+15559876543'];
        return demoPhones.includes(phoneNumber);
      }

      // For phone, we can try sending OTP and check if user exists
      // This is a simplified check - in production use admin API
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

      // Check if Supabase is configured
      const supabaseConfigured = isSupabaseConfigured();

      // If Supabase is not configured, use demo mode
      if (!supabaseConfigured) {
        console.log('[AuthStore] Supabase not configured, using demo mode for signup');

        const demoUser: User = {
          id: 'demo-user-' + Date.now(),
          email,
          name,
          createdAt: new Date().toISOString(),
        };

        const demoToken = 'demo-auth-token-' + Date.now();

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, demoToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(demoUser)),
        ]);

        set({
          isAuthenticated: true,
          user: demoUser,
          isLoading: false,
        });

        console.log('[AuthStore] Demo signup successful:', demoUser.email);

        // Ensure primary family member exists
        try {
          const { useFamilyMembersStore } = await import('./familyMembersStore');
          await useFamilyMembersStore.getState().ensurePrimaryMemberExists(demoUser.id, demoUser.name);
        } catch (error) {
          console.error('[AuthStore] Failed to create primary family member:', error);
        }

        return;
      }

      // Use Supabase to create account (only when configured)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        console.error('[AuthStore] Supabase signup error:', error);
        throw new Error(error.message || 'Signup failed');
      }

      if (data.user) {
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

        console.log('[AuthStore] Supabase signup successful:', user.email);

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

      if (isSupabaseConfigured()) {
        // Verify OTP and create account
        const { data, error } = await supabase.auth.verifyOtp({
          phone: phoneNumber,
          token: otp,
          type: 'sms',
        });

        if (error) {
          console.error('[AuthStore] Phone signup verification error:', error);
          throw new Error(error.message || 'Invalid OTP');
        }

        if (data.user) {
          // Update user metadata with name
          const { error: updateError } = await supabase.auth.updateUser({
            data: { name },
          });

          if (updateError) {
            console.warn('[AuthStore] Failed to update user metadata:', updateError);
          }

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
      }

      // Fallback: Demo mode
      if (otp.length === 6 && /^\d+$/.test(otp)) {
        const demoUser: User = {
          id: 'demo-phone-user-' + Date.now(),
          email: phoneNumber + '@phone.demo',
          name,
          createdAt: new Date().toISOString(),
        };

        const demoToken = 'demo-phone-token-' + Date.now();

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, demoToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(demoUser)),
        ]);

        set({
          isAuthenticated: true,
          user: demoUser,
          isLoading: false,
        });

        console.log('[AuthStore] Demo phone signup successful:', phoneNumber);

        // Ensure primary family member exists
        try {
          const { useFamilyMembersStore } = await import('./familyMembersStore');
          await useFamilyMembersStore.getState().ensurePrimaryMemberExists(demoUser.id, demoUser.name);
        } catch (error) {
          console.error('[AuthStore] Failed to create primary family member:', error);
        }

        return;
      } else {
        throw new Error('Invalid OTP. Please enter a 6-digit code.');
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
