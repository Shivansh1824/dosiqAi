---
name: cleanup-dead-code
description: "Post-feature cleanup routine that traces through recently modified files (and their related frontend/backend counterparts) to remove dead code, duplicated logic, unused variables, stale commented-out blocks, and conflicting functions. Enforces DRY principles and keeps the codebase lean. Use this skill whenever the user says anything like 'clean up the code', 'remove dead code', 'refactor what we just did', 'check for duplicates', 'tidy up', 'clean up after the feature', 'remove unused code', 'find duplicate logic', or any request that implies post-edit cleanup, code hygiene, or dead code elimination — even if the user doesn't explicitly say 'dead code'. If the user just finished building or modifying a feature and mentions cleanup in any form, trigger this skill."
---

# Cleanup Dead Code

A post-feature cleanup skill that hunts down and safely removes dead code, duplicated logic, and other cruft from files that were recently modified.

The goal is simple: after a feature lands, the codebase should be *leaner* than before — no leftover experiments, no forgotten variables, no copy-pasted logic that could be consolidated.

## Step 1: Identify the Scope

Before touching anything, figure out exactly which files are in play.

- **Ask the user** which feature or files were recently modified, unless this is already clear from the conversation history (e.g., you just finished building the feature together).
- Once the target files are known, **expand the scope** by tracing imports, exports, and shared modules to find related files. For a React Native project, this typically means:
  - The screen/page file and its associated components
  - Custom hooks consumed by those components
  - Utility/helper files imported by any of the above
  - API service files and shared type definitions
  - Style/theme files if relevant
- Present a short list of the files you plan to audit so the user can confirm or adjust the scope.

## Step 2: Analyze for Dead Code & Redundancies

Scan every file in scope for the following categories of waste. Use `grep_search`, `view_file`, and `view_code_item` to inspect thoroughly — don't skim.

### What to look for

| Category | What it looks like |
|---|---|
| **Unused variables & imports** | Declared but never referenced. Imported but never used. |
| **Commented-out code** | Old logic wrapped in `//` or `/* */` that was left behind "just in case". If it's in version control, it's recoverable — delete it. |
| **Duplicate logic** | Two or more places doing the same thing. Could be identical blocks, or near-identical functions that differ only in names or a small parameter. |
| **Conflicting / shadowed functions** | A new function that replaces an old one, but the old one is still defined and possibly still called somewhere. |
| **Dead branches** | `if` conditions that can never be true after the feature change, unreachable `else` blocks, or obsolete feature flags. |
| **Orphaned exports** | Functions, constants, or types that are exported but no longer imported by anything. |
| **Stale TODO/FIXME/HACK comments** | Comments referencing issues that have been resolved or are no longer relevant. |

### How to analyze

1. For each file, read through and mentally (or explicitly) track every declaration and where it's used.
2. Use `grep_search` across the project to verify whether exports are actually consumed elsewhere.
3. When you see near-duplicate logic, note both locations and what a consolidated version could look like.
4. Check for variables that were part of an earlier approach but are now superseded by the new feature code.

## Step 3: Present the Cleanup Plan

Before making any changes, present a **brief checklist** to the user summarizing what you intend to do. Group findings by file and by category.

Use this format:

```
## Cleanup Plan

### `src/components/SomeComponent.tsx`
- [ ] Remove unused import: `OldUtilFunction` (line 3)
- [ ] Delete commented-out block (lines 45-62) — old render logic
- [ ] Consolidate duplicate validation logic with `useFormValidation` hook

### `src/hooks/useSomeHook.ts`
- [ ] Remove unused variable `tempData` (line 22)
- [ ] Remove orphaned export `legacyFetch` — no longer imported anywhere

### `src/utils/helpers.ts`
- [ ] Merge `formatDateV1` and `formatDateV2` into a single `formatDate` function
- [ ] Remove stale FIXME comment on line 14
```

Wait for the user to approve (or adjust) the plan before proceeding. The user might say "skip that one" or "also check this file" — respect their guidance.

## Step 4: Execute the Cleanup

Once approved, make the changes file by file. Follow these safety rules:

1. **One logical change at a time.** Don't batch unrelated removals into a single edit — it makes mistakes harder to spot.
2. **Verify before deleting.** Before removing any function, variable, or export, do a final `grep_search` across the project to confirm it's truly unused. Things that look dead might be referenced dynamically or in a file you haven't checked.
3. **Consolidate, don't just delete.** When you find duplicate logic, write a single clean version and update all call sites — don't just delete one copy and leave the other as-is.
4. **Preserve behavior.** The goal is to remove code that does nothing, not to refactor how features work. If a change could alter runtime behavior, flag it to the user instead of silently making it.
5. **Clean up cascade effects.** After removing a function or variable, check if its removal makes other imports, variables, or type definitions unused — and clean those up too.

## Step 5: Final Verification

After all changes are applied:

- Do a quick scan of the modified files to make sure nothing looks broken (no dangling references, no missing imports).
- If a build or lint command is available, run it to catch any errors introduced by the cleanup.
- Summarize what was removed/consolidated in a short recap for the user.

## Important Mindset

- **Be aggressive but safe.** The whole point of this skill is to *remove* things. Don't be shy about flagging code for deletion — but always verify before pulling the trigger.
- **Commented-out code is dead code.** Version control exists for a reason. If someone needs the old code, they can find it in git history. Don't preserve commented-out blocks "just in case".
- **DRY is the priority.** If the same logic exists in two places, it should exist in one place. Find the right abstraction and consolidate.
- **Don't over-abstract.** Removing duplication doesn't mean creating an overly generic utility for two slightly similar things. If two pieces of code share 60% of their logic but serve genuinely different purposes, consolidating might create more complexity than it removes. Use judgment.
