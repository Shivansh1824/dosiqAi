// src/services/supabaseClient.ts
// ⚠️ Supabase replaced with self-hosted VPS API.
// This file re-exports the new API client in the same shape
// so all existing imports continue to work without changes.
export { auth, from, functions, rpc, getStoredTokens, saveTokens, clearTokens, saveUser, getStoredUser } from '../lib/apiClient';

// Legacy compat: files that import `supabase` directly
import api from '../lib/apiClient';
export const supabase = {
  auth: api.auth,
  from: api.from,
  functions: api.functions,
  rpc: api.rpc.call,
} as const;

// Legacy compat: isSupabaseConfigured — always true now (VPS is always configured)
export const isSupabaseConfigured = (): boolean => true;
