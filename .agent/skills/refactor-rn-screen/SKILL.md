---
name: refactor-rn-screen
description: Refactor React Native screens in the dosiq Ai project for better load speed, DB call efficiency, and code structure. Use when the user asks to optimize a screen's performance, speed up data loading, fix slow screen open times, eliminate sequential DB calls, add caching to a screen, lazy-load content behind expandable sections, reduce re-fetching on focus, split a large screen into smaller pieces, or improve how a hook fetches and manages data. Also trigger when the user says a screen feels slow, flickers on re-focus, fetches too much data, or keeps re-fetching data it already has.
---

# Refactor RN Screen

A skill for refactoring screens in the dosiq Ai project. The three most common problems this skill addresses are:

1. **Sequential DB calls** that could run in parallel
2. **Missing cache-first loading** causing a blank screen on open
3. **Eager loading** of data the user hasn't asked to see yet (e.g., historical values behind a collapsed card)

Fixing all three together is what turns a screen that feels sluggish into one that feels instant.

## Project Context

- **Expo SDK**: 55, React 19.2, React Native 0.83
- **React Compiler**: enabled (`reactCompiler: true`) — manual `useMemo`/`useCallback` largely unnecessary
- **DB layer**: `api.from('table').select().eq().order()...` via `src/lib/apiClient.ts`
- **Cache layer**: `loadFromCache` / `saveToCache` via `src/services/cacheService.ts`
- **State**: Zustand stores in `src/store/`, local `useState` for UI state
- **Navigation**: Expo Router, `useFocusEffect` for focus-based refresh

---

## Step 1 — Audit the Screen

Before touching any code, map out what the screen currently does. Read the screen file and its hook(s), then answer these questions:

**DB call inventory:**
- List every `api.from(...)` call and which table it hits
- Note which calls depend on data from a prior call (sequential — unavoidable)
- Note which calls are independent of each other (parallel candidates)
- Note which calls only matter when the user expands or taps something (lazy candidates)

**Cache inventory:**
- Does the hook call `loadFromCache` before fetching?
- Does it call `saveToCache` after fetching?
- Are cache keys scoped per user and per entity (e.g., `userId + documentId`)?

**Render inventory:**
- Are there manual `useMemo` / `useCallback` calls? (React Compiler handles these — candidates for removal)
- Is data filtered/sorted inline on every render without any stable reference?
- Are new array or object literals used as default prop values? (creates new reference each render)

Document your findings. The audit output drives every decision below.

---

## Step 2 — Plan the Data Loading Order

Draw the dependency graph for the screen's queries:

```
Query A (no deps) ──┐
                    ├── both done → Query C (depends on A+B results)
Query B (no deps) ──┘
```

Rules:
- Queries with no dependencies → first `Promise.all()`
- Queries that depend on results from the first wave → second `await` after first wave resolves, but run them in parallel with each other if they're independent of each other
- Queries that only matter when the user taps/expands something → lazy, don't fetch until that interaction

**For `lab-report/[id].tsx` specifically:**
- Query 1 (`test_results` by `document_id`) — fetches first, no deps
- Query 2 (`biomarkers_mastertable` by biomarker IDs) and Query 3 (historical `test_results` by biomarker IDs) — both depend on biomarker IDs from Query 1, but they don't depend on each other → run them in `Promise.all()` as the second wave
- Historical values (Query 3) could be further deferred: only fetch for a specific `biomarker_id` when the user expands that card

See `references/query-optimization.md` for the concrete code pattern.

---

## Step 3 — Add Cache-First Loading

For any hook that fetches data that should survive screen re-mounts:

1. Define a cache key — include `userId` and any entity ID that scopes the data (e.g., `documentId` for lab report data). Add it to the `CacheKeys` object in `cacheService.ts`.
2. At the start of `fetchData`, call `loadFromCache(key)` and `setState` with the result immediately if it exists. This shows data without a spinner.
3. After the API fetch succeeds, call `saveToCache(key, data)` before returning.
4. Never block the UI on cache — it's a "show while we refresh" layer, not a source of truth. Always run the API fetch regardless of whether cache hit.

See `references/cache-first-patterns.md` for the exact pattern with code examples.

---

## Step 4 — Apply Lazy Loading

If a screen has expandable cards or sections that show extra data when opened:

- Move the fetch for that data into the toggle handler (or a dedicated function exposed from the hook)
- Keep a `Record<id, Data[]>` map in the hook's state, keyed by item ID, filled on demand
- Guard with "already loaded or currently loading" check to fetch each item's data exactly once
- Pass a `loadingMap` down to the component so it can show an inline `ActivityIndicator` while loading

For `lab-report/[id].tsx`: past values are only shown in expanded cards. The correct approach is to fetch `pastValues` for a `biomarker_id` only when `toggleExpand` is called for a test that hasn't had its history loaded yet.

See `references/query-optimization.md` — "Lazy Loading Pattern" section.

---

## Step 5 — Split at the Right Boundaries

Do not over-split. The goal is to remove cognitive load, not maximize file count.

**Extract to a hook when:**
- The fetch/cache/state logic is more than ~20 lines and could be reused, or is obscuring the render logic
- The hook would be independently understandable (one clear purpose)

**Extract to a component when:**
- The same JSX block appears more than once
- A visual unit has its own local state (e.g., a collapsible section)
- It's a self-contained block over ~60 lines with a clear conceptual boundary

**Keep inline when:**
- It's a one-liner derivation used in exactly one place
- Extracting it would require threading back more than 2–3 values

**What not to do:**
- Don't split a single screen's data into 3 separate hooks (`useTestResults`, `useBiomarkers`, `usePastValues`) — one hook owns one screen's data
- Don't extract a component to its own file if it's only used in one screen — co-location at the bottom of the screen file is correct

See `references/modularity-guide.md` for the project's existing 3-layer pattern and applied guidance for `[id].tsx`.

---

## Step 6 — Remove Unnecessary Memoization

React Compiler is enabled. It automatically inserts `useMemo`, `useCallback`, and `React.memo` equivalents. Manual additions create double-wrapping with no benefit.

**Remove these unless there's a specific semantic reason to keep them:**
- `useMemo(() => expensiveCompute(data), [data])` — write inline, compiler handles it
- `useCallback(() => fn(), [dep])` — write inline
- `React.memo(Component)` — remove unless profiling confirms a real re-render problem

**Still required manually:**
- Stable empty-array constants as default prop values: `const EMPTY: T[] = []`
- Flat state shape — nested state objects force unnecessary diffing
- Exhaustive `useEffect` dependencies — React 19 is stricter about this

See `references/react-compiler-guide.md` for the full list of dos and don'ts.

---

## Step 7 — Verify

After making changes:

1. Confirm the screen shows something on open before the API response arrives (cache hit)
2. Confirm queries that were sequential now fire in parallel (add a `console.log(Date.now())` before each fetch call temporarily to verify timing)
3. Confirm expanding a card triggers a past-values fetch exactly once — not on every subsequent toggle
4. Confirm there are no new TypeScript errors introduced
5. Summarize using the format from `CLAUDE.md`:

   > **Root Cause:** [what was wrong]
   > **Fix:** [what changed and why it helps]

---

## Quick Reference

| Topic | Where to look |
|---|---|
| Parallel + two-wave fetch, lazy loading, silent refresh | `references/query-optimization.md` |
| Cache keys, hook-level cache pattern, scoping rules | `references/cache-first-patterns.md` |
| Hook vs component vs utility decisions | `references/modularity-guide.md` |
| React Compiler: what not to add, what still matters | `references/react-compiler-guide.md` |

**Key project files:**
- `src/lib/apiClient.ts` — QueryBuilder (`api.from(...).select().eq().order()`)
- `src/services/cacheService.ts` — `loadFromCache`, `saveToCache`, `CacheKeys`
- `src/store/documentsStore.ts` — canonical store-level cache pattern
- `app/home.tsx` — canonical two-wave `Promise.all()` + `silent=true` + `useFocusEffect`
