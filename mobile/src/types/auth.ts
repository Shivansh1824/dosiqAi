/**
 * Authentication and user types
 * These will be used with the VPS API in the future
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  isLoading: boolean;
  user: User | null;
}

export interface AuthActions {
  setAuthenticated: (value: boolean) => void;
  setHasSeenOnboarding: (value: boolean) => void;
  setUser: (user: User | null) => void;
  setLoading: (value: boolean) => void;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  sendPhoneOTP: (phoneNumber: string) => Promise<{ success: boolean; message: string }>;
  verifyPhoneOTP: (phoneNumber: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  reset: () => void;
  // User verification methods
  checkUserExists: (email: string) => Promise<boolean>;
  checkPhoneExists: (phoneNumber: string) => Promise<boolean>;
  // Signup methods
  signup: (email: string, password: string, name: string) => Promise<void>;
  signupWithPhone: (phoneNumber: string, name: string, otp: string) => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

// AsyncStorage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@dosiqai_auth_token',
  HAS_SEEN_ONBOARDING: '@dosiqai_has_seen_onboarding',
  USER_DATA: '@dosiqai_user_data',
} as const;
