# React Compiler Guide

Reference for writing components and hooks under React Compiler, which is enabled project-wide (`reactCompiler: true` in `app.config.js`) with Expo SDK 55, React 19.2, and React Native 0.83.

## Table of Contents
1. [What the compiler does](#1-what-the-compiler-does)
2. [What you should NOT add](#2-what-you-should-not-add)
3. [What you still must handle manually](#3-what-you-still-must-handle-manually)
4. [Common mistakes that break optimization](#4-common-mistakes-that-break-optimization)
5. [Reanimated v4 coexistence](#5-reanimated-v4-coexistence)

---

## 1. What the Compiler Does

React Compiler reads your component and hook code at build time and automatically inserts memoization equivalents:

- Computed values derived from props or state → `useMemo` equivalent
- Callback functions → `useCallback` equivalent
- Components that don't need to re-render when parent state changes → `React.memo` equivalent

The compiler's analysis is more precise than manual memoization — it knows exactly which expressions depend on which values. Manual additions on top of this create double-wrapping that the compiler has to work around and that adds overhead without benefit.

---

## 2. What You Should NOT Add

**Do NOT add `useMemo` for performance:**
```typescript
// BAD — compiler already memoizes this derivation
const filtered = useMemo(
  () => tests.filter(t => t.status !== 'NORMAL'),
  [tests]
);

// GOOD — write it directly
const filtered = tests.filter(t => t.status !== 'NORMAL');
```

**Do NOT add `useCallback` for performance:**
```typescript
// BAD — compiler already stabilizes this function reference
const handleToggle = useCallback((id: string) => {
  setExpandedCards(prev => { ... });
}, []);

// GOOD — write it directly
const handleToggle = (id: string) => {
  setExpandedCards(prev => { ... });
};
```

**Do NOT wrap components in `React.memo` by default:**
```typescript
// BAD — pre-emptive, no measured need
const ResultRow = React.memo(({ test, onToggle }: ResultRowProps) => { ... });

// GOOD — define normally, compiler decides
const ResultRow = ({ test, onToggle }: ResultRowProps) => { ... };
```

**Exception:** `useMemo` and `useCallback` are still valid for *semantic* reasons — specifically when you need explicit control over when a `useEffect` dependency changes. Don't add them for performance; only add them when their presence changes the *meaning* of the code.

---

## 3. What You Still Must Handle Manually

The compiler optimizes memoization. It does not fix bad data patterns. These still require manual attention:

### Stable empty-array / empty-object constants for default props

Creating a new `[]` or `{}` literal inline as a prop value produces a new reference on every render. The compiler cannot deduplicate object literals across renders.

```typescript
// BAD — new array reference every render, breaks memoization of child
<ResultRow pastTests={test.biomarker_id ? pastValues[test.biomarker_id] : []} />

// GOOD — stable reference
const EMPTY_ARRAY: TestResult[] = []; // at module level, outside any component

<ResultRow pastTests={test.biomarker_id ? (pastValues[test.biomarker_id] ?? EMPTY_ARRAY) : EMPTY_ARRAY} />
```

### Flat state shape

Updating a nested state object creates a new top-level reference on every update, forcing a full re-render of anything subscribed to that state:

```typescript
// BAD — updating results forces BiomarkersMap and PastValues to re-evaluate too
const [data, setData] = useState({
  results: [],
  biomarkersMap: {},
  pastValues: {},
});
setData(prev => ({ ...prev, results: newResults }));

// GOOD — separate state slices, independent updates
const [results, setResults] = useState<TestResult[]>([]);
const [biomarkersMap, setBiomarkersMap] = useState<Record<string, Biomarker>>({});
const [pastValues, setPastValues] = useState<Record<string, TestResult[]>>({});
```

### Exhaustive `useEffect` dependencies

React 19 enforces exhaustive deps more strictly. The compiler will warn if a `useEffect` accesses values not in its dependency array. Write effects to include all their dependencies — don't suppress the warning.

```typescript
// BAD — documentId used inside but not listed
useEffect(() => {
  fetchData(documentId); // documentId not in deps
}, []);

// GOOD
useEffect(() => {
  fetchData(documentId);
}, [documentId, fetchData]); // fetchData is stable because compiler memoizes it
```

---

## 4. Common Mistakes That Break Optimization

**Mutating state directly:**
```typescript
// BAD — mutation, compiler can't track this
results.push(newItem);
setResults(results);

// GOOD
setResults(prev => [...prev, newItem]);
```

**Using a ref value as a hook dependency:**
```typescript
// BAD — ref.current is not reactive, useEffect won't re-run when it changes
useEffect(() => {
  doSomething(myRef.current);
}, [myRef.current]); // doesn't work as intended

// Use state if you need reactivity; use refs only for values that must not trigger re-renders
```

**Conditional hook calls (still a React rule, compiler enforces strictly):**
```typescript
// BAD
if (isLoggedIn) {
  const data = useLabReport(id); // illegal
}

// GOOD — always call hooks, pass null/undefined to disable
const data = useLabReport(isLoggedIn ? id : undefined);
```

**Calling a hook's result inline as input to another hook:**
```typescript
// POTENTIALLY PROBLEMATIC — if hook A returns a new object reference each render
const { config } = useConfig();
const result = useProcessed(config); // if config is a new {} each render, this never stabilizes

// GOOD — destructure primitive values when possible
const { endpoint, timeout } = useConfig();
const result = useProcessed(endpoint, timeout);
```

---

## 5. Reanimated v4 Coexistence

Reanimated v4 (used in `[id].tsx` for `entering`, `exiting`, `layout` animations) has its own compilation pass that runs separately from React Compiler. They coexist correctly, but follow these rules:

**Worklet functions must not use React state directly:**
```typescript
// BAD
const animate = () => {
  'worklet';
  runOnUI(() => sharedValue.value = reactState); // reactState from useState
};

// GOOD — pass the value explicitly
const animate = (value: number) => {
  'worklet';
  runOnUI(() => sharedValue.value = value);
};
```

**Animation config instances are already stable — don't wrap them:**
```typescript
// BAD — wrapping stable objects in useMemo is redundant and compiler-interfering
const transition = useMemo(() => LinearTransition.duration(300), []);

// GOOD — use directly as JSX prop
<Animated.View layout={LinearTransition.duration(300)}>
```

For configs reused across multiple components, define them at module level:
```typescript
// At module level
const LAYOUT_TRANSITION = LinearTransition.duration(300);
const FADE_IN = FadeIn.duration(200);
const FADE_OUT = FadeOut.duration(150);

// In component
<Animated.View layout={LAYOUT_TRANSITION} entering={FADE_IN} exiting={FADE_OUT}>
```

**`useAnimatedStyle` is compatible with React Compiler.** Write it normally — the compiler knows not to memoize worklet code paths:
```typescript
const animatedStyle = useAnimatedStyle(() => ({
  opacity: withTiming(isVisible ? 1 : 0),
}));
```
