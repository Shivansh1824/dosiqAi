# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dosiq Ai** is a React Native + Expo health management mobile app. Core features: medication reminders (with native notifications), health document scanning/AI analysis, lab report viewing, family member profiles, and health vitals tracking.

## Development Commands

All commands run from the `mobile/` directory:

```bash
cd mobile

# Start dev server
npx expo start

# Run on specific platform
npx expo run:ios
npx expo run:android
npx expo start --web

# Clear cache (use when adding env vars or after dependency changes)
npx expo start --clear
```

No test suite is currently configured.

## Architecture

### Directory Layout

```
mobile/
├── app/               # Expo Router file-based screens
├── src/
│   ├── store/         # Zustand state stores
│   ├── hooks/         # Custom React hooks
│   ├── services/      # Business logic services
│   ├── components/    # UI components
│   ├── types/         # TypeScript type definitions
│   ├── constants/     # Colors, Typography, Sizes
│   ├── utils/         # Pure utility functions
│   └── lib/           # Low-level infrastructure (apiClient.ts)
└── assets/
```

Path alias `@/*` maps to `src/*`.

### Navigation

Uses **Expo Router** (file-based routing). Root layout and auth guard are in [app/_layout.tsx](mobile/app/_layout.tsx). Auth flow: check AsyncStorage tokens on init → unauthenticated users go to `/welcome` → authenticated users go to `/home`. Notifications can deep-link directly to `/medicinealarm`.

### State Management

**Zustand** stores in `src/store/`:

| Store | Responsibility |
|---|---|
| `authStore` | Session tokens, user profile, onboarding state |
| `documentsStore` | Health documents, AI analysis progress, upload limits |
| `medicationsStore` | Medication records (colors are computed by index, not stored) |
| `medicationLogsStore` | Intake logs (taken/skipped/snoozed) |
| `appointmentsStore` | Appointment scheduling |
| `familyMembersStore` | Multi-user family profiles, active member switching |
| `healthVitalsStore` | Weight, BP, glucose, and other vitals |

**Caching pattern:** Load from AsyncStorage cache first, fetch fresh data in background, then update the store. Cache keys are defined in `src/services/cacheService.ts`.

### API Client

`src/lib/apiClient.ts` wraps `fetch` with:
- Base URL from `EXPO_PUBLIC_API_BASE_URL` (currently `https://api.dosiqai.com`)
- Bearer token injection from AsyncStorage
- Automatic token refresh on 401

### Notification System

Uses **@notifee/react-native** (not Expo notifications). Medication reminders support rich actions (Taken/Skip/Snooze). Platform-specific services: `notificationService.ts` (cross-platform), `androidNotificationService.ts` (Android full-screen alarm UI with custom tunes). Background event handling in `notificationEventHandler.ts`.

### Document Storage

Files are uploaded to **Cloudflare R2** (S3-compatible) via `@aws-sdk/client-s3`. Credentials come from env vars. Local file operations use `expo-file-system` and `react-native-blob-util`. PDF generation uses `pdf-lib`.

## Environment Variables

Copy `.env.example` to `.env` in the `mobile/` directory:

```
EXPO_PUBLIC_API_BASE_URL=https://api.dosiqai.com
EXPO_PUBLIC_R2_ACCESS_KEY_ID=
EXPO_PUBLIC_R2_SECRET_ACCESS_KEY=
EXPO_PUBLIC_R2_ENDPOINT=
EXPO_PUBLIC_R2_BUCKET_NAME=
```

## Interaction Style

When in doubt, ask before assuming intent on ambiguous requirements — don't guess and proceed. Ask clarifying questions to gain better clarity of what is being sought.

**Be direct and honest.** Quality output over comfortable replies:
- Tell me when I am wrong — don't hedge or sugarcoat
- Propose better alternatives when my approach is suboptimal
- Prioritize accuracy and best practices over agreement

## After Every Fix or Edit

After completing any fix or code change, always provide a brief **"Root Cause & Fix"** summary using this format:

> **Root Cause:** [1–2 plain-English sentences on what was actually wrong]
> **Fix:** [1–2 plain-English sentences on what was changed and why it solves the problem]

Keep it concise — no jargon, no lengthy explanations. Just the core insight.

## Code Quality

- Prefer simple, readable code over clever one-liners
- Don't leave dead code, commented-out blocks, or unused variables behind
- Follow the existing code style and conventions in the project — don't introduce new patterns inconsistently
- When refactoring, change one thing at a time; don't rewrite what isn't broken

## Planning & Changes

- For non-trivial tasks, propose a brief plan first before making edits
- Highlight any breaking changes, side effects, or risks before proceeding
- Don't silently change behaviour — call it out explicitly if a fix changes how something works

## Verification

- After changes, confirm the fix actually addresses the root cause — don't just assume it works
- If a change could break something else, call it out proactively
- Suggest what the user should test or verify when relevant

---

## Platform Targets

### Android
- **minSdkVersion: 33 (Android 13)** — intentional decision for a paid app; ~70% active device coverage is acceptable
- **targetSdkVersion: 35 (Android 15)** — required by Google Play for all new/updated apps
- Do NOT add `Build.VERSION.SDK_INT` version guards for APIs below 33 — assume Android 13+ everywhere
- Do NOT use `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, or `requestLegacyExternalStorage` — these are legacy and removed from the project
- Media access uses granular permissions: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`
- Notification permission (`POST_NOTIFICATIONS`) must be requested at runtime via `notifee.requestPermission()`
- Exact alarm permission (`SCHEDULE_EXACT_ALARMS`) is checked in `src/services/androidNotificationService.ts`

### iOS
- **Deployment target: 18.6**

---

## Key Conventions

- **Document colors** are computed on-the-fly by array index (cycling through 7 colors defined in the store) — never stored in the database.
- **Multi-user data** is scoped per family member; always use the active family member ID when fetching/caching.
- **Per-user cache keys** are generated in `cacheService.ts` and must include the user/member ID.
- All screens are TypeScript with Expo Router typed routes enabled (`typedRoutes: true` in app.config.js).
