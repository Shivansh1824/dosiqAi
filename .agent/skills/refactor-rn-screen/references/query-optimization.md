# Query Optimization Patterns

Reference for DB call optimization in the dosiq Ai project. All examples use `api.from()` from `src/lib/apiClient.ts`.

## Table of Contents
1. [Parallel fetch pattern](#1-parallel-fetch-pattern)
2. [Two-wave fetch (dependent queries)](#2-two-wave-fetch-dependent-queries)
3. [Lazy loading pattern](#3-lazy-loading-pattern)
4. [Silent background refresh](#4-silent-background-refresh)
5. [Anti-patterns to avoid](#5-anti-patterns-to-avoid)

---

## 1. Parallel Fetch Pattern

When two or more queries have no dependency on each other, run them in a single `Promise.all()`.

```typescript
// BEFORE — sequential (Q2 waits unnecessarily for Q1 to finish)
const { data: results } = await api.from('test_results').select('*').eq('document_id', docId);
const { data: biomarkers } = await api.from('biomarkers_mastertable').select('*').in('biomarker_id', ids);

// AFTER — parallel
const [{ data: results }, { data: biomarkers }] = await Promise.all([
  api.from('test_results').select('*').eq('document_id', docId),
  api.from('biomarkers_mastertable').select('*').in('biomarker_id', ids),
]);
```

Time cost drops from `Q1 + Q2` to `max(Q1, Q2)`.

---

## 2. Two-Wave Fetch (Dependent Queries)

When later queries need IDs from an earlier query, use two waves. Within each wave, run all independent calls in parallel.

This is the correct pattern for `useLabReport`:

```typescript
const fetchData = async (silent = false) => {
  if (!documentId || !user) return;
  if (!silent) setIsLoading(true);

  try {
    // Wave 1: must run first — we need biomarker IDs from this result
    const { data: resultsData, error: resultsError } = await api
      .from('test_results')
      .select('*')
      .eq('document_id', documentId);

    if (resultsError || !resultsData) {
      setError(resultsError?.message ?? 'Failed to load results');
      return;
    }

    const biomarkerIds = [
      ...new Set(resultsData.map((r: any) => r.biomarker_id).filter(Boolean)),
    ];

    // Wave 2: both depend on biomarkerIds but are independent of each other → parallel
    const [{ data: biomarkerData }, { data: pastData }] = await Promise.all([
      biomarkerIds.length > 0
        ? api
            .from('biomarkers_mastertable')
            .select(
              'biomarker_id,category,description,interpretation_normal,interpretation_low,' +
              'interpretation_high,interpretation_borderline,interpretation_critical,' +
              'interpretation_abnormal,good_to_eat_veg,bad_to_eat_veg,' +
              'good_to_eat_nonveg,bad_to_eat_nonveg'
            )
            .in('biomarker_id', biomarkerIds)
        : Promise.resolve({ data: [], error: null }),

      biomarkerIds.length > 0
        ? api
            .from('test_results')
            .select('*')
            .in('biomarker_id', biomarkerIds)
            .neq('document_id', documentId)
            .order('report_date', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    // ... process and set state
  } catch (err: any) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};
```

Time cost: `Q1 + max(Q2, Q3)` instead of `Q1 + Q2 + Q3`.

---

## 3. Lazy Loading Pattern

Use when data is only needed after a user interaction (tap, expand). Don't fetch upfront.

**In the hook** — keep a result map and a loading map:

```typescript
// In useLabReport (or equivalent hook)
const [pastValues, setPastValues] = useState<Record<string, TestResult[]>>({});
const [loadingPastValues, setLoadingPastValues] = useState<Record<string, boolean>>({});

const fetchPastValues = async (biomarkerId: string) => {
  // Guard: already loaded or currently loading — do nothing
  if (pastValues[biomarkerId] !== undefined || loadingPastValues[biomarkerId]) return;

  setLoadingPastValues(prev => ({ ...prev, [biomarkerId]: true }));

  const { data } = await api
    .from('test_results')
    .select('*')
    .eq('biomarker_id', biomarkerId)
    .neq('document_id', documentId)
    .order('report_date', { ascending: false });

  setPastValues(prev => ({ ...prev, [biomarkerId]: data ?? [] }));
  setLoadingPastValues(prev => ({ ...prev, [biomarkerId]: false }));
};

// Expose from hook
return { ..., pastValues, loadingPastValues, fetchPastValues };
```

**In the screen** — call `fetchPastValues` from the toggle handler:

```typescript
const toggleExpand = (testId: string, biomarkerId: string | null) => {
  // Trigger lazy fetch on first expand (guard in hook prevents duplicate calls)
  if (biomarkerId) {
    fetchPastValues(biomarkerId);
  }
  setExpandedCards(prev => {
    const next = new Set(prev);
    next.has(testId) ? next.delete(testId) : next.add(testId);
    return next;
  });
};
```

**In the card component** — show inline loading while history loads:

```typescript
// Inside BiomarkerExpandedContent or equivalent
const isLoadingHistory = loadingPastValues[test.biomarker_id ?? ''] ?? false;
const history = pastValues[test.biomarker_id ?? ''] ?? EMPTY_ARRAY;

{isLoadingHistory ? (
  <ActivityIndicator size="small" color={Colors.primary} />
) : history.length > 0 ? (
  <BiomarkerTrendChart data={history} />
) : null}
```

**Define `EMPTY_ARRAY` as a module-level constant** — never inline `[]` as a default:

```typescript
// At module level, outside any component
const EMPTY_ARRAY: TestResult[] = [];
```

---

## 4. Silent Background Refresh

The `silent=true` flag suppresses the loading spinner so the user sees cached data while a background refresh runs.

Pattern from `home.tsx` and `health.tsx`:

```typescript
// Step 1: show cache instantly (no spinner)
await Promise.all([
  useDocumentsStore.getState().loadFromCache(user.id),
  useHealthVitalsStore.getState().loadFromCache(user.id),
]);

// Step 2: refresh in background — state updates when data arrives
await Promise.all([
  fetchDocuments(user.id, true),   // true = silent
  fetchVitals(user.id, true),
]);
```

For hooks that manage their own fetch:

```typescript
const fetchData = async (silent = false) => {
  if (!silent) setIsLoading(true);
  // ... fetch and update state ...
  setIsLoading(false); // always clear loading, even in silent mode
};

// On screen focus: silent refresh — no spinner, data updates in background
useFocusEffect(
  useCallback(() => {
    if (documentId) fetchData(true);
  }, [documentId])
);
```

---

## 5. Anti-Patterns to Avoid

**Fetching all history upfront for all biomarkers:**
```typescript
// BAD — fetches N biomarkers' history even if user never expands any card
const { data: pastData } = await api
  .from('test_results')
  .in('biomarker_id', allBiomarkerIds) // could be 20+ IDs
  .neq('document_id', documentId);
```
Replace with the lazy pattern from section 3.

**Running independent queries sequentially:**
```typescript
// BAD — Q2 waits for Q1 even though it doesn't use Q1's result
const { data: a } = await api.from('table_a').eq('id', x);
const { data: b } = await api.from('table_b').eq('id', y); // no dependency on 'a'
```

**Refetching on every focus without a guard:**
```typescript
// BAD — fetches every time user navigates back to the screen, even seconds later
useFocusEffect(useCallback(() => {
  fetchData(); // no silent flag, shows spinner every time
}, []));

// GOOD — use silent=true so it refreshes in background without visible flash
useFocusEffect(useCallback(() => {
  if (documentId) fetchData(true);
}, [documentId]));
```

**Using `.in()` with an empty array:**
```typescript
// BAD — this may cause a query error or fetch everything
api.from('table').in('id', []); // empty array is undefined behavior in PostgREST

// GOOD — guard before calling
if (ids.length > 0) {
  const { data } = await api.from('table').in('id', ids);
}
// Or use Promise.resolve short-circuit as shown in the two-wave pattern above
```
