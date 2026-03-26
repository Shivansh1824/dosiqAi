---
description: Use when adding or modifying any Android-specific feature, permission, or notification behavior in dosiq Ai
---

1. Confirm the feature is scoped to Android 13+ (API 33) — do not add version guards for anything below API 33
2. Check if a new Android permission is needed. If so, add it to `mobile/android/app/src/main/AndroidManifest.xml` using the modern granular permission (never READ_EXTERNAL_STORAGE or WRITE_EXTERNAL_STORAGE)
3. If the feature involves notifications, check `mobile/src/services/androidNotificationService.ts` — verify POST_NOTIFICATIONS authorization status before scheduling
4. If the feature involves exact alarms or medication reminders, verify SCHEDULE_EXACT_ALARMS is enabled via `notifee.getNotificationSettings()` and call `notifee.openAlarmPermissionSettings()` if not
5. If the feature involves file storage, use `Paths.document` (app-scoped directory via expo-file-system) — never write to arbitrary external storage paths
6. If the feature involves media access (photos, documents), use `expo-image-picker` or `expo-media-library` — they automatically request the correct granular media permissions on Android 13+
7. Run `npx expo run:android` from `mobile/` and verify on an Android 13 emulator or device
