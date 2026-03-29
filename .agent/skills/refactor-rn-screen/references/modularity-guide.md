# Modularity Guide for dosiq Ai Screens

Reference for deciding where code lives: screen file, hook, component, or utility.

## Table of Contents
1. [The project's existing split pattern](#1-the-projects-existing-split-pattern)
2. [Decision tree](#2-decision-tree)
3. [Hook conventions](#3-hook-conventions)
4. [Component conventions](#4-component-conventions)
5. [Utility conventions](#5-utility-conventions)
6. [Applied to `lab-report/[id].tsx`](#6-applied-to-lab-reportidtsx)

---

## 1. The Project's Existing Split Pattern

The project uses a clean three-layer pattern. Follow it — don't invent new layers.

```
app/lab-report/[id].tsx          ← screen: layout, navigation, state wiring, UI logic
src/hooks/useLabReport.ts        ← data hook: fetch, cache, transform
src/hooks/useDocumentActions.ts  ← action hook: delete, share
src/hooks/useDocumentFile.ts     ← file hook: local URI, R2 download
src/hooks/useAnalysisPDF.ts      ← pdf hook: generate and share
src/components/BiomarkerTrendChart.tsx  ← reusable chart component
```

The screen is a coordinator. It:
- Imports hooks for data and actions
- Holds UI-only state (search query, expanded card set, active tab)
- Passes data down to subcomponents
- Contains no `async/await` or `api.from()` calls directly

The hook is a data manager. It:
- Owns all `api.from()` calls
- Owns all `cacheService` calls
- Owns state that represents remote data (results, biomarkers, loading, error)
- Exposes a clean `return` object — data, loading flags, and action functions

---

## 2. Decision Tree

### Should this be a hook?
- Does it do async work (fetch, cache read/write, AsyncStorage)?
- Does it manage state that represents server data (loading, error, results)?
- Could it reasonably be used by another screen?
- Is it more than ~20 lines of non-render logic?

→ Yes to any of these: extract to a hook.

### Should this be a component?
- Is it a self-contained visual unit (more than ~40–60 lines of JSX)?
- Does it have its own local state (`useState`, `useRef`, `useAnimatedStyle`)?
- Does it appear more than once — even within the same file?
- Does it represent a clear named concept (a card, a row, a chart, a section header)?

→ Yes to any of these: extract to a component. Co-location within the same file is fine if it's screen-specific and not reused elsewhere.

### Should this be a utility function?
- Is it a pure function — same input always gives same output, no side effects?
- Does it operate on data (strings, numbers, arrays), not UI?
- Could it be independently tested?

→ Yes to these: put in `src/utils/`. Examples: `normalizeBiomarkerName`, `formatCategoryName`, date formatters.

### Keep inline when:
- It's a one-liner derivation (`const isEmpty = a.length === 0`)
- It's used in exactly one place
- Extracting it would require passing back more than 2–3 values to satisfy TypeScript

---

## 3. Hook Conventions

**Naming:** `use` prefix, camelCase, named for the data it manages — `useLabReport`, not `useData` or `useScreen`.

**Return shape:** Return a flat object, not a class or nested object:
```typescript
return {
  reportData,           // the primary data
  biomarkersMap,        // supporting lookup data
  pastValues,           // lazy-loaded per-item data
  loadingPastValues,    // per-item loading state
  isLoading,
  error,
  refetch,             // manual refresh
  fetchPastValues,     // expose lazy fetch for use by toggle handler
};
```

**State initialization:** Initialize with the empty/falsy version of the type, not `null`, when you know the shape:
```typescript
// Good — the shape is known upfront
useState<GroupedTestResults>({ actionRequired: [], optimalResults: [] })
useState<Record<string, TestResult[]>>({})

// Avoid
useState<GroupedTestResults | null>(null)  // unless null is semantically meaningful
```

**No UI logic in hooks:** Hooks must not import `StyleSheet`, `Alert`, or any component. UI decisions belong in the screen or component. A hook may call `Haptics` as a side effect of an action.

**Don't consolidate unrelated concerns:** `useDocumentActions` (delete, share) is correctly separate from `useLabReport` (fetch test results). Don't merge them just to reduce import count.

**Don't split one screen's data into multiple hooks:** `useTestResults`, `useBiomarkers`, `usePastValues` as three separate hooks for one screen is over-fragmentation. One hook owns one screen's data. Use lazy functions within the hook to handle deferred loading.

---

## 4. Component Conventions

**Subcomponents in the same file** are the right call for screen-specific UI units. The bottom of `[id].tsx` already does this correctly with `ResultRow`, `HeaderTitle`, `CollapsibleText`, `ActionRequiredSection`. No need to move these to `src/components/`.

**Move to `src/components/` when:**
- The component is or will be used in more than one screen
- It's complex enough to warrant its own file (>100 lines, or has complex internal state)
- It represents a project-wide design pattern (e.g., `BiomarkerTrendChart`, `VitalCard`)

**Props must be typed explicitly.** Never use `any` in a component's props interface:
```typescript
// Good
type ResultRowProps = {
  test: TestResult;
  biomarker: Biomarker | undefined;
  expanded: boolean;
  onToggle: (id: string) => void;
  pastTests: TestResult[];
  isLoadingPast: boolean;
};

// Bad
const ResultRow = ({ test, biomarker, ...props }: any) => { ... }
```

**Avoid prop drilling beyond 2 levels.** If a value needs to pass through 3 or more components, consider whether the consuming component should get it from the hook directly, or whether the hook should be called at a lower level.

---

## 5. Utility Conventions

Utilities live in `src/utils/`. Each file groups related pure functions:

| File | Contents |
|---|---|
| `stringUtils.ts` | `normalizeBiomarkerName`, string formatting |
| `dateUtils.ts` | Date parsing, display formatting |
| `nameFormatting.ts` | Name display helpers |
| `fileStorage.ts` | Local file path helpers |

**Don't put async functions in utils.** Anything with `await` belongs in a hook or service. Utils are synchronous transformations.

**Don't put component logic in utils.** `formatForDisplay(value)` is a util. `renderValueBadge(value)` is not.

---

## 6. Applied to `lab-report/[id].tsx`

### What's already well-structured — don't change:
- `useLabReport` correctly encapsulates all DB calls
- `useDocumentActions`, `useDocumentFile`, `useAnalysisPDF` are correctly separate hooks for distinct concerns
- `ResultRow`, `CollapsibleText`, `ActionRequiredSection` are correctly co-located subcomponents
- `normalizeBiomarkerName` is correctly in `src/utils/stringUtils.ts`
- `BiomarkerTrendChart` is correctly in `src/components/` (reusable)

### What to change:
- Add `fetchPastValues` lazy fetch function inside `useLabReport` — expose it in the return object
- Move all biomarker-related fetching (query 2 + query 3) inside `useLabReport` where it already lives
- Move `pastValues` state from the screen into `useLabReport` — it's server data, not UI state
- Keep `expandedCards` as local `useState` in the screen — it's UI state

### What not to change:
- Don't split `useLabReport` into separate sub-hooks
- Don't move `ResultRow` to `src/components/` (it's only used here)
- Don't extract small derivations like `categoryCounts` into a utility (it's a single one-liner)
- Don't add `React.memo` to subcomponents (React Compiler handles this)
