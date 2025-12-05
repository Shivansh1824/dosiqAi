# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Note**: Please ask questions to gain better clarity of what I am seeking. Don't hesitate to ask for clarification - it improves the output.

## Project Overview

**FamilyCareHealth** is a dual-platform family health management application:
- **Web Dashboard**: React + Vite + Radix UI + Tailwind CSS (root directory)
- **Mobile App**: React Native + Expo SDK 54 + TypeScript (mobile/ directory) - **PRIMARY FOCUS**
- **Backend**: Supabase (PostgreSQL database + authentication)

The app helps families digitize medical records, extract health metrics via OCR, track medications, manage appointments, and visualize health trends across multiple family member profiles.

## Build & Development Commands

### Web Dashboard (Root)
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build for production
npm run build
```

### Mobile App (mobile/ directory)

**Initial Setup (Required after fresh clone):**
```bash
cd mobile
npm install

# Generate ios/ and android/ native folders (not committed to repo)
npx expo prebuild

# Install iOS CocoaPods dependencies (if needed)
cd ios && pod install && cd ..
```

**Running the App:**
```bash
# Start Expo dev server
npm start

# Run on iOS Simulator (recommended: iPhone 15 Plus, iOS 18.6+)
npx expo run:ios

# Run on Android
npx expo run:android

# Clear Metro cache
npx expo start -c

# Clean rebuild (regenerate native folders)
npx expo prebuild --clean
```

**iOS Simulator Management:**
```bash
# List available simulators
xcrun simctl list devices

# Boot specific simulator
xcrun simctl boot "iPhone 15 Plus"

# Open project in Xcode
open mobile/ios/FamilyCareHealth.xcworkspace
```

## Architecture

### Mobile App State Management (Zustand)

The mobile app uses Zustand for state management with 5 separate stores in [mobile/src/store/](mobile/src/store/):

- **[authStore.ts](mobile/src/store/authStore.ts)** - Authentication, session handling, Supabase integration
- **[documentsStore.ts](mobile/src/store/documentsStore.ts)** - Scanned health documents and OCR data
- **[familyMembersStore.ts](mobile/src/store/familyMembersStore.ts)** - Multi-user family profiles
- **[medicationsStore.ts](mobile/src/store/medicationsStore.ts)** - Medication tracking and reminders
- **[appointmentsStore.ts](mobile/src/store/appointmentsStore.ts)** - Health appointments scheduling

All stores persist state to AsyncStorage for offline support.

### Navigation

**Mobile (React Navigation):**
- Stack Navigator + Bottom Tabs Navigator
- Flow: Welcome → Onboarding (3 screens) → Login/Signup → Home → Document/Health screens
- Root component: [mobile/App.tsx](mobile/App.tsx)

**Entry Points:**
- Web: [src/main.tsx](src/main.tsx) → [src/App.tsx](src/App.tsx)
- Mobile: [mobile/index.ts](mobile/index.ts) → [mobile/App.tsx](mobile/App.tsx)
  - **Critical**: [mobile/index.ts](mobile/index.ts) imports `react-native-reanimated` first (required for proper initialization)

### Backend Integration

- **Supabase Client**: [mobile/src/services/supabaseClient.ts](mobile/src/services/supabaseClient.ts)
- **Environment Variables**: [mobile/.env](mobile/.env) (Supabase URL and anon key)
- **Config**: [mobile/app.config.js](mobile/app.config.js) exposes env vars via `expo-constants`

#### AI Document Analysis (OpenRouter API)

The app uses OpenRouter API (Google Gemini 2.5 Flash) to analyze medical documents.

**Edge Function**: [mobile/supabase/functions/analyze-document/index.ts](mobile/supabase/functions/analyze-document/index.ts)

**Required Edge Function Secrets** (configured in Supabase Dashboard → Edge Functions → Secrets):
- `OPENROUTER_API_KEY` - OpenRouter API key for authentication
- `DOCUMENT_ANALYSIS_PROMPT` - Analysis prompt sent to the AI model (**required**)

**Updating the Analysis Prompt:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Find `DOCUMENT_ANALYSIS_PROMPT`
3. Click edit icon → Update prompt text
4. Click "Save"
5. Redeploy edge function:
   ```bash
   cd mobile
   npx supabase functions deploy analyze-document
   ```

**Prompt Guidelines:**
- Maximum size: 10 KB (10,240 characters)
- Should request JSON-formatted output
- Include medical fields to extract (vital signs, medications, diagnoses, etc.)
- Current model: Google Gemini 2.5 Flash via OpenRouter

### Component Structure

**Mobile:**
- Screens: [mobile/src/screens/](mobile/src/screens/) (12 screens: Welcome, Onboarding, Login, Signup, Home, Scan, Documents, Health, Profile, etc.)
- Components: [mobile/src/components/](mobile/src/components/) (Button, Input, Logo, Modals, etc.)
- Design tokens: [mobile/src/constants/](mobile/src/constants/) (Colors, Typography, Sizes)

**Web:**
- Components: [src/components/](src/components/) (includes 50+ Radix UI component wrappers in ui/ subdirectory)
- Screens: [src/components/](src/components/) (WelcomeScreen, HomeScreen, ScanDocumentScreen, etc.)

### TypeScript Types

All TypeScript interfaces are in [mobile/src/types/](mobile/src/types/):
- [auth.ts](mobile/src/types/auth.ts) - Authentication types
- [document.ts](mobile/src/types/document.ts) - Document scanning types
- [medication.ts](mobile/src/types/medication.ts) - Medication tracking
- [familyMember.ts](mobile/src/types/familyMember.ts) - Family member profiles
- [appointment.ts](mobile/src/types/appointment.ts) - Appointment scheduling

### Utilities

- [mobile/src/utils/fileStorage.ts](mobile/src/utils/fileStorage.ts) - File handling and storage
- [mobile/src/utils/imageCompression.ts](mobile/src/utils/imageCompression.ts) - Image processing and compression
- [mobile/src/utils/animations.ts](mobile/src/utils/animations.ts) - Reanimated animation helpers
- [mobile/src/utils/debugLogger.ts](mobile/src/utils/debugLogger.ts) - Debug logging utilities

## Technical Configuration

### iOS (Target: 18.6+)
- **Deployment Target**: iOS 18.6+ (specified in [mobile/app.config.js](mobile/app.config.js))
- **Bundle ID**: `com.shivanshrana.familycare.health`
- **New Architecture**: Enabled (`newArchEnabled: true`)
- **Testing**: Use iOS Simulator (iPhone 15 Plus recommended), NOT physical device

### Android (Target: SDK 34+)
- **Min SDK**: 34 (Android 14+)
- **Package**: `com.familycare.health`
- **Edge-to-Edge**: Enabled

### Path Aliases
- **Mobile**: `@/` → `src/` (configured in [mobile/tsconfig.json](mobile/tsconfig.json))
- **Web**: Extensive Radix UI component aliases in [vite.config.ts](vite.config.ts)

## Current Development State

**Completed:**
- All UI screens for mobile app (Welcome, Onboarding, Login, Home, Scan, Documents, Health, Profile)
- Web dashboard UI with Radix UI components
- Supabase backend configured
- Zustand state management
- React Navigation setup

**In Progress/Pending:**
- Backend integration (Supabase authentication and database operations)
- Real camera functionality (expo-camera integration)
- OCR implementation (Google Cloud Vision API or Tesseract)
- AI-powered health report summarization (OpenAI/Claude API)
- Medication alarm system with push notifications
- Health metrics charts and visualizations

## Design System (Mobile)

**Colors:**
- Primary: `#4A90E2` (medical blue - trust, reliability)
- Secondary: `#66BB6A` (health green - wellness)
- Orange: `#FB8C00` (alerts, warnings)
- Red: `#EF5350` (critical values, errors)
- Gray scale: gray50 - gray900

**Typography:**
- Headings: Bold (700), 24-36pt
- Body: Regular (400), 16pt
- Captions: Medium (500), 14pt

**Spacing:**
- 8px-based scale: `xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px`

All design tokens are centralized in [mobile/src/constants/](mobile/src/constants/).

## Key Development Principles

From [PROMPT.md](PROMPT.md):

1. **User-Friendly**: Simplify medical terminology for non-expert users
2. **Visual**: Use charts, icons, and color coding for quick comprehension
3. **Accessible**: Support for elderly users and limited tech literacy
4. **Secure**: Health data is sensitive - encryption and privacy are paramount
5. **Offline-Capable**: Core features should work without internet connection

## Common Troubleshooting

### If `npx expo prebuild` Fails
```bash
# Clear Expo cache and regenerate
npx expo prebuild --clean

# Or manually delete and regenerate
rm -rf mobile/ios mobile/android
npx expo prebuild
```

### If iOS Build Fails
```bash
cd mobile/ios
rm -rf build
xcodebuild clean

# Reinstall CocoaPods
pod deintegrate
pod install
cd ../..

npx expo run:ios
```

### If Metro Bundler Has Issues
```bash
# Clear Metro cache
npx expo start -c

# Or manually clear
rm -rf mobile/node_modules/.cache
```

### If Simulator Doesn't Launch
```bash
# List available simulators
xcrun simctl list devices

# Boot simulator manually
xcrun simctl boot "iPhone 15 Plus"

# Then run the app
cd mobile && npx expo run:ios
```

## Important Files

- [PROMPT.md](PROMPT.md) - Comprehensive project brief, goals, and AI agent setup instructions
- [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) - Step-by-step setup guide for new Mac
- [mobile/app.config.js](mobile/app.config.js) - Expo configuration (iOS deployment target, bundle ID, EAS project ID)
- [mobile/.env](mobile/.env) - Environment variables (Supabase credentials) - **DO NOT COMMIT**

## Additional Notes

- The `ios/` and `android/` folders are generated by `npx expo prebuild` and should NOT be committed to version control
- [mobile/index.ts](mobile/index.ts) must import `react-native-reanimated` before anything else (critical for animations)
- Always test on iOS 18.6+ simulators to ensure compatibility
- Supabase environment variables must be set in [mobile/.env](mobile/.env) before running the app
- CocoaPods installation is required for iOS builds
