# Cache-First Loading Patterns

Reference for adding caching to screens and hooks in the dosiq Ai project.
Uses `src/services/cacheService.ts`.

## Table of Contents
1. [How the cache service works](#1-how-the-cache-service-works)
2. [Adding a new cache key](#2-adding-a-new-cache-key)
3. [Hook-level cache pattern](#3-hook-level-cache-pattern)
4. [Store-level cache pattern (reference)](#4-store-level-cache-pattern-reference)
5. [Cache key scoping rules](#5-cache-key-scoping-rules)
6. [What not to cache](#6-what-not-to-cache)

---

## 1. How the Cache Service Works

`cacheService.ts` wraps AsyncStorage with version-aware JSON storage:

```typescript
import { loadFromCache, saveToCache, clearCache, CacheKeys } from '@/services/cacheService';

await saveToCache(key, data);                 // stores { data, timestamp, version: 'v1' }
const cached = await loadFromCache<T>(key);   // returns T | null (null if missing or version mismatch)
await clearCache(key);                        // removes one entry
```

The cache never expires on its own. It's a "show this while we fetch fresh" layer, not a TTL cache. A fresh API call always runs after showing cache data — the cache only removes the blank-screen moment.

---

## 2. Adding a New Cache Key

Add new keys to the `CacheKeys` object in `src/services/cacheService.ts`:

```typescript
export const CacheKeys = {
  // Existing keys
  documents: (userId: string) => `cache:v1:documents:${userId}`,
  medications: (userId: string) => `cache:v1:medications:${userId}`,

  // Add for lab report data
  labReport: (userId: string, documentId: string) =>
    `cache:v1:labReport:${userId}:${documentId}`,
};
```

Rules:
- Always include `userId` — prevents data leaking between users on a shared device
- For document-scoped data, also include `documentId` — different lab reports must have separate cache entries
- Use the `cache:v1:` prefix — `clearAllCache()` (called on logout) removes everything with this prefix

---

## 3. Hook-Level Cache Pattern

Use this when a hook manages its own fetch (e.g., `useLabReport`). This is the complete pattern to apply.

```typescript
import { loadFromCache, saveToCache, CacheKeys } from '@/services/cacheService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/apiClient';

export type GroupedTestResults = {
  actionRequired: TestResult[];
  optimalResults: TestResult[];
};

export function useLabReport(documentId?: string) {
  const [reportData, setReportData] = useState<GroupedTestResults>({
    actionRequired: [],
    optimalResults: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const fetchData = useCallback(async (silent = false) => {
    if (!documentId || !user) {
      setIsLoading(false);
      return;
    }

    const cacheKey = CacheKeys.labReport(user.id, documentId);

    if (!silent) {
      // Try cache first — show immediately if available
      const cached = await loadFromCache<GroupedTestResults>(cacheKey);
      if (cached) {
        setReportData(cached);
        setIsLoading(false);
        // Don't return — fall through to fetch fresh data in background
      } else {
        setIsLoading(true);
      }
    }

    try {
      // ... fetch fresh data (see query-optimization.md for two-wave pattern) ...
      const grouped: GroupedTestResults = { actionRequired, optimalResults };

      setReportData(grouped);

      // Save to cache after successful fetch
      await saveToCache(cacheKey, grouped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, user]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Silent refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  return { reportData, isLoading, error, refetch: fetchData };
}
```

Key points:
- Cache is checked before the API call and sets state immediately if found
- `setIsLoading(false)` after cache hit means no spinner if data exists
- The API fetch always runs regardless of cache — it will overwrite state when it lands
- `silent=true` skips the cache check and runs in background (used for focus refresh)
- `useFocusEffect` uses `silent=true` so there's no spinner when navigating back

---

## 4. Store-Level Cache Pattern (Reference)

Existing Zustand stores use a two-action approach. You don't need this for hooks, but it's useful as a reference for how the pattern works project-wide.

From `documentsStore.ts`:

```typescript
// Step 1: called first — loads cache and sets state, returns true if cache hit
loadFromCache: async (userId: string): Promise<boolean> => {
  const cached = await loadFromCache<Document[]>(CacheKeys.documents(userId));
  if (cached && cached.length > 0) {
    set({ documents: cached, isLoading: false });
    return true;
  }
  return false;
},

// Step 2: called second — silent=true skips spinner, saves to cache on success
fetchDocuments: async (userId: string, silent = false) => {
  const state = get();
  if (!userId) return;
  if (state.isLoading && !silent) return;  // prevent duplicate non-silent fetches
  if (state.isInitialized && !silent) return;  // already loaded, no need to re-fetch

  if (!silent) set({ isLoading: true });

  const { data } = await api.from('documents').select('*').eq('user_id', userId);
  if (data) {
    await saveToCache(CacheKeys.documents(userId), data);
    set({ documents: data, isLoading: false, isInitialized: true });
  }
},
```

The screen then calls both in sequence:

```typescript
await documentsStore.loadFromCache(user.id);        // instant — from disk
await documentsStore.fetchDocuments(user.id, true); // background — updates state when done
```

The hook-level pattern in section 3 achieves the same result in a more compact form without needing a separate `loadFromCache` action.

---

## 5. Cache Key Scoping Rules

| Data type | Scope | Example key |
|---|---|---|
| User-level data (docs, meds, appointments) | `userId` | `cache:v1:documents:abc123` |
| Document-scoped data (lab results, biomarkers) | `userId + documentId` | `cache:v1:labReport:abc123:doc456` |
| Family member data | `userId + memberId` | see `familyMembersStore.ts` |

**Never use a key without `userId`.** If a user logs out and another logs in on the same device, they would see stale data from the previous user. `clearAllCache()` is called on logout and removes everything prefixed with `cache:` — scoped keys are cleaned up automatically.

---

## 6. What Not to Cache

| Don't cache | Why |
|---|---|
| Per-item lazy data (past values per biomarker) | Fetched on demand, held in component state — not worth AsyncStorage round-trip |
| Authentication tokens | Use `STORAGE_KEYS` from `authStore` |
| Transient UI state (expanded cards, active tab, scroll position) | Use component `useState` |
| Medication intake logs | Stale data here is harmful — always fetch fresh |
| Data that must be real-time | If showing outdated data would cause wrong user action, don't cache it |
