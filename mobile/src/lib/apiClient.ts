// src/lib/apiClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../types/auth';
import { Buffer } from 'buffer';

const BASE_URL = 'https://api.dosiqai.com';

const KEYS = {
  ACCESS_TOKEN: STORAGE_KEYS.AUTH_TOKEN,
  REFRESH_TOKEN: STORAGE_KEYS.REFRESH_TOKEN,
  USER_DATA: STORAGE_KEYS.USER_DATA,
};

// ─── Token helpers ────────────────────────────────────────────────────────────
export async function getStoredTokens() {
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(KEYS.ACCESS_TOKEN),
    AsyncStorage.getItem(KEYS.REFRESH_TOKEN),
  ]);
  return { accessToken: access, refreshToken: refresh };
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    [KEYS.ACCESS_TOKEN, accessToken],
    [KEYS.REFRESH_TOKEN, refreshToken],
  ]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER_DATA]);
}

export async function saveUser(user: any) {
  await AsyncStorage.setItem(KEYS.USER_DATA, JSON.stringify(user));
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(KEYS.USER_DATA);
  return raw ? JSON.parse(raw) : null;
}

// ─── Core fetch with auto-refresh ────────────────────────────────────────────
async function _fetch(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const { accessToken, refreshToken } = await getStoredTokens();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Auto-refresh on TOKEN_EXPIRED
  if (res.status === 401 && retry && refreshToken) {
    try {
      const body = await res.clone().json();
      if (body.code === 'TOKEN_EXPIRED') {
        const refreshRes = await fetch(`${BASE_URL}/auth/v1/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const tokens = await refreshRes.json();
          await saveTokens(tokens.access_token, tokens.refresh_token);
          return _fetch(path, options, false);
        }
      }
    } catch (_) {}
    // Refresh failed — clear session
    await clearTokens();
    throw new Error('SESSION_EXPIRED');
  }

  return res;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const auth = {
  async signUp(email: string, password: string, name?: string) {
    const res = await fetch(`${BASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: name }),
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: { message: data.error } };
    await saveTokens(data.access_token, data.refresh_token);
    await saveUser(data.user);
    return { data: { user: data.user, session: { access_token: data.access_token, refresh_token: data.refresh_token } }, error: null };
  },

  async signInWithPassword(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: { message: data.error } };
    await saveTokens(data.access_token, data.refresh_token);
    await saveUser(data.user);
    return { data: { user: data.user, session: { access_token: data.access_token, refresh_token: data.refresh_token } }, error: null };
  },

  async signOut() {
    const { refreshToken } = await getStoredTokens();
    try {
      await _fetch('/auth/v1/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
    } catch (_) {}
    await clearTokens();
    return { error: null };
  },

  async getSession() {
    const { accessToken, refreshToken } = await getStoredTokens();
    if (!accessToken) return { data: { session: null }, error: null };
    // Decode JWT to check expiry without a library
    try {
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString('utf8'));
      if (payload.exp * 1000 < Date.now()) {
        // Try refresh
        if (!refreshToken) { await clearTokens(); return { data: { session: null }, error: null }; }
        const res = await fetch(`${BASE_URL}/auth/v1/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) { await clearTokens(); return { data: { session: null }, error: null }; }
        const tokens = await res.json();
        await saveTokens(tokens.access_token, tokens.refresh_token);
        const user = await getStoredUser();
        return { data: { session: { access_token: tokens.access_token, refresh_token: tokens.refresh_token, user } }, error: null };
      }
      const user = await getStoredUser();
      return { data: { session: { access_token: accessToken, refresh_token: refreshToken, user } }, error: null };
    } catch (_) {
      await clearTokens();
      return { data: { session: null }, error: null };
    }
  },

  async getUser() {
    try {
      const res = await _fetch('/auth/v1/me');
      const data = await res.json();
      if (!res.ok) return { data: { user: null }, error: { message: data.error } };
      return { data: { user: data.user }, error: null };
    } catch (_) {
      return { data: { user: null }, error: { message: 'Failed to get user' } };
    }
  },

  async sendOtp(identifier: string) {
    const isEmail = identifier.includes('@');
    const res = await fetch(`${BASE_URL}/auth/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEmail ? { email: identifier } : { phone: identifier }),
    });
    const data = await res.json();
    return res.ok ? { data, error: null } : { data: null, error: { message: data.error } };
  },

  async verifyOtp(identifier: string, token: string) {
    const isEmail = identifier.includes('@');
    const res = await fetch(`${BASE_URL}/auth/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEmail ? { email: identifier, code: token } : { phone: identifier, code: token }),
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: { message: data.error } };
    await saveTokens(data.access_token, data.refresh_token);
    await saveUser(data.user);
    return { data: { user: data.user, session: { access_token: data.access_token } }, error: null };
  },

  async updateUser(updates: { data?: { name?: string } }) {
    const res = await _fetch('/auth/v1/me', {
      method: 'PATCH',
      body: JSON.stringify({ full_name: updates?.data?.name }),
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: { message: data.error } };
    await saveUser(data.user);
    return { data: { user: data.user }, error: null };
  },

  // Google OAuth — returns a URL to open in the browser
  getGoogleOAuthUrl() {
    return `${BASE_URL}/auth/v1/google`;
  },
};

// ─── Check user exists (used by authStore.checkUserExists) ───────────────────
// The app uses a dummy signInWithPassword to detect if a user exists.
// Replace with a dedicated endpoint check.
export async function checkUserExists(email: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/auth/v1/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.ok) {
    const data = await res.json();
    return data.exists === true;
  }
  return false;
}

// ─── DB query builder ────────────────────────────────────────────────────────
// Returns { data, error } in standardized shape.
export function from(table: string) {
  return new QueryBuilder(table);
}

class QueryBuilder {
  private _table: string;
  private _method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private _body: any = null;
  private _filters: string[] = [];
  private _select: string = '*';
  private _order: string[] = [];
  private _limit: number | null = null;
  private _single = false;
  private _maybeSingle = false;
  private _upsertConflict: string | null = null;

  constructor(table: string) { this._table = table; }

  select(columns = '*') { this._select = columns; return this; }
  eq(col: string, val: any) { this._filters.push(`${col}=eq.${encodeURIComponent(val)}`); return this; }
  neq(col: string, val: any) { this._filters.push(`${col}=neq.${encodeURIComponent(val)}`); return this; }
  gt(col: string, val: any) { this._filters.push(`${col}=gt.${encodeURIComponent(val)}`); return this; }
  gte(col: string, val: any) { this._filters.push(`${col}=gte.${encodeURIComponent(val)}`); return this; }
  lt(col: string, val: any) { this._filters.push(`${col}=lt.${encodeURIComponent(val)}`); return this; }
  lte(col: string, val: any) { this._filters.push(`${col}=lte.${encodeURIComponent(val)}`); return this; }
  is(col: string, val: any) { this._filters.push(`${col}=is.${encodeURIComponent(val)}`); return this; }
  not(col: string, op: string, val: any) { this._filters.push(`${col}=not.${op}.${encodeURIComponent(val)}`); return this; }
  in(col: string, vals: any[]) { this._filters.push(`${col}=in.(${vals.map(encodeURIComponent).join(',')})`); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this._order.push(`${col}:${opts?.ascending === false ? 'desc' : 'asc'}`);
    return this;
  }
  limit(n: number) { this._limit = n; return this; }
  single() { this._single = true; this._limit = 1; return this; }
  maybeSingle() { this._maybeSingle = true; this._limit = 1; return this; }

  insert(data: any) {
    this._method = 'POST'; this._body = data; return this;
  }
  update(data: any) {
    this._method = 'PATCH'; this._body = data; return this;
  }
  upsert(data: any, opts?: { onConflict?: string }) {
    this._method = 'POST'; this._body = data; this._upsertConflict = opts?.onConflict || null;
    return this;
  }
  delete() { this._method = 'DELETE'; return this; }

  async then(resolve: (val: any) => any, reject?: (err: any) => any) {
    return this._execute().then(resolve, reject);
  }

  private async _execute(): Promise<{ data: any; error: any }> {
    try {
      let path = `/api/${this._table}`;
      const params = new URLSearchParams();

      if (this._method === 'GET') {
        if (this._select !== '*') params.set('select', this._select);
        this._filters.forEach(f => { const [k, v] = f.split('='); params.append(k, v); });
        if (this._order.length) params.set('order', this._order.join(','));
        if (this._limit !== null) params.set('limit', String(this._limit));
        const qs = params.toString();
        if (qs) path += `?${qs}`;
      } else if (this._method === 'PATCH' || this._method === 'DELETE') {
        this._filters.forEach(f => { const [k, v] = f.split('='); params.append(k, v); });
        const qs = params.toString();
        if (qs) path += `?${qs}`;
      } else if (this._upsertConflict) {
        params.set('upsert', 'true');
        params.set('on_conflict', this._upsertConflict);
        const qs = params.toString();
        if (qs) path += `?${qs}`;
      }

      const res = await _fetch(path, {
        method: this._method,
        ...(this._body ? { body: JSON.stringify(this._body) } : {}),
      });

      if (res.status === 204) return { data: null, error: null };

      const json = await res.json();
      if (!res.ok) return { data: null, error: { message: json.error || 'Request failed', code: json.code } };

      let data = json.data ?? json;
      if (this._single && Array.isArray(data)) data = data[0] ?? null;
      if (this._maybeSingle && Array.isArray(data)) data = data[0] ?? null;

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }
}

// ─── Backend Functions ────────────────────────────────────────────────────────
export const functions = {
  async invoke(name: string, options?: { body?: any; headers?: Record<string, string> }) {
    try {
      const res = await _fetch(`/functions/v1/${name}`, {
        method: 'POST',
        body: JSON.stringify(options?.body),
        headers: options?.headers,
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error || 'Function call failed' } };
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  },
};

// ─── RPC calls ────────────────────────────────────────────────────────────────
export const rpc = {
  async call(fnName: string, params: Record<string, any> = {}) {
    try {
      const res = await _fetch(`/rpc/${fnName}`, {
        method: 'POST',
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error } };
      return { data: data.result ?? data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  },
};

// ─── Convenience export ───────────────────────────────────────────────────────
export const api = { auth, from, functions, rpc };
export default api;
