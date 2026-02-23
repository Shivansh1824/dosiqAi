---
name: react-native-refactor
description: "Expert guidelines and workflows for refactoring React Native code, extracting reusable components/hooks, and eliminating duplicate code to improve robustness, maintainability, and performance. Use when the user asks to refactor React Native code, remove code duplication, optimize components, or improve overall code quality."
---

# React Native Refactoring

This skill provides strategies, workflows, and best practices for refactoring React Native code to eliminate duplication—not just visually, but also at the logic and TypeScript level—to improve robustness.

## Core Principles

1. **Strict Type Safety over Duplication**: Prevent duplicating similar TypeScript interfaces by using generics and utility types. Avoid `any`.
2. **Extract Reusable UI Components**: Identify duplicated UI patterns across your application and extract them into shared components (e.g., in `components/common/`).
3. **Extract Stateful Logic (Hooks)**: Move complex, duplicated stateful logic, API calls, or side effects from views into custom React hooks (e.g., `useFetch`, `useAuth`).
4. **Pure Utility Functions**: Move pure, reusable business logic, data formatting, or transformations into a shared `utils/` directory.
5. **Optimize Renders**: Use `useMemo`, `useCallback`, and `React.memo` where appropriate to prevent unnecessary re-renders in extracted components.

## Identifying Duplicate Logic Flow

Beyond identical blocks of code, "duplicate logic" often hides in:
*   **Repetitive Conditionals**: Multiple components checking the exact same `if/else` chains or `switch` statements to render or format differently.
*   **Similar API Wrappers**: Defining the same loading/error state mechanisms across multiple API calls natively instead of centralizing them.
*   **Array Manipulation**: Repeating `.map` or `.reduce` transformations that shape data exactly the same way across multiple files.
*   **"Almost Same" Types**: Having multiple interfaces that share 90% of their keys but are maintained independently.

## Refactoring Workflow

### 1. Refactor TypeScript Types
- **Use Utility Types**: If an interface shares fields with another, use `Partial<T>`, `Omit<T, K>`, or `Pick<T, K>` rather than repeating the properties.
- **Discriminated Unions**: When state can take multiple shapes, avoid adding disparate boolean flags (e.g., `isSuccess`, `isError`). Instead, use discriminated unions: `type State = { status: 'loading' } | { status: 'success', data: Data } | { status: 'error', error: string }`.
- **Generics**: Build generic functions and components when handling different data models that share the exact same UI or logic structures.

### 2. Consolidate Stateful Logic Flows
- **Extract Custom Hooks**: If multiple components fetch similar data, manage timers, or handle identical lifecycle events, extract those into generic custom hooks (e.g., `useDebounce`, `useApiQuery`, `useFormValidation`).
- **Context + Reducer**: For widely duplicated local state patterns (like multi-step wizards or broad application settings), consolidate the logic into a `useReducer` combined with the React Context API.

### 3. Abstract Business Rules & Utilities
- **Extract to Pure Functions**: Move common array deduplication (e.g. using `Set`), date parsing, or data formatting logic from within components into generic helper functions inside a `/utils` folder.
- **Service Layer**: Move raw `fetch` or `axios` calls out of components and into a dedicated `/services` or `/api` folder. Return typed results to components to separate UI from data fetching entirely.
- **Strategy Pattern (Polymorphism)**: If logic handles multiple conditions differently (e.g., varied discount calculations), abstract the logic using the Strategy Pattern via simple configuration maps rather than giant `switch` statements.

### 4. Component Parameterization
- Build components that accept just enough props to handle needed variations, but avoid "prop drilling" and over-parameterization.
- Use **Render Props** or **Compound Components** if the inner content requires too much configuration via standard props.

## Best Practices

- **Avoid Premature Abstraction**: Only extract code when it appears multiple times, or if extracting it drastically simplifies a massive, unwieldy component (Rule of Three).
- **Single Responsibility Principle**: Keep components small and focused on one specific job.
- **Consolidate Styles**: Extract shared colors, paddings, typography out of individual `StyleSheet.create` blocks and into a global `theme.ts` file. 
