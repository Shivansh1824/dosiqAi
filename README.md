# Dosiq AI - Intelligent Family Health & Medication Assistant

[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare R2](https://img.shields.io/badge/Storage-Cloudflare_R2-F38020?logo=cloudflare&logoColor=white)](https://www.cloudflare.com/products/r2/)
[![AI Engine](https://img.shields.io/badge/AI_Vision-Gemini_2.5_Flash-4285F4?logo=google-gemini&logoColor=white)](https://openrouter.ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Dosiq AI** is an AI-powered personal and family healthcare management platform. It digitizes physical prescriptions and diagnostic lab reports, provides automated multimodal AI extraction, tracks medications with iOS Live Activities and high-priority alarms, monitors health vitals and lab metrics over time, and secures family health records with end-to-end user isolation.

The project features a **React Native (Expo SDK 54)** mobile app (primary client) alongside a **React 18 + Vite + Radix UI** web companion, backed by Supabase Edge Functions and Cloudflare R2 storage.

---

## 🌟 Key Features

### 1. 🤖 Multimodal AI Medical Document Analysis
- **Prescription & Lab Extraction**: Upload camera photos or PDFs of medical documents. The backend extracts patient info, doctor information, medications, dosages, lab tests, reference intervals, and clinical notes.
- **Multimodal LLM Pipeline**: Powered by Google Gemini 2.5 Flash via OpenRouter, orchestrated through secure Supabase Edge Functions (`analyze-document`).
- **Structured Normalization**: Strict JSON schemas normalize messy handwritten doctor notes, medicine names, dosage frequencies (e.g., `1-0-1`, `OD`, `BD`), meal relations, and duration.
- **Server-Side Safety & Quotas**: Built-in rate limiting (e.g., 5 analyses per day per user) and ownership checks.

### 2. 💊 Smart Medication Management & Live Activities
- **Active Regimen Tracking**: View daily medication schedules segmented by morning, afternoon, evening, and night.
- **Time-Sensitive Alarms**: High-priority notifications via `@notifee/react-native` with customizable reminders and follow-up alerts.
- **iOS Live Activities & Dynamic Island**: Real-time medication reminders and lock screen countdowns using `expo-live-activity`.
- **Adherence Logging**: Log doses as taken, skipped, or postponed to keep an audit trail of treatment adherence.

### 3. 📊 Lab Metric Trends & Vitals Analytics
- **Historical Biomarker Charts**: Visual trends for biomarkers (e.g., Blood Sugar, Blood Pressure, Cholesterol, HbA1c, Liver Function) rendered with `victory-native`.
- **Status Classification**: Automatic range categorization into `Normal`, `Warning`, or `Critical` with visual indicators and alert banners.
- **Lab Report Detail View**: Dedicated breakdown per lab document with test parameters, standard reference ranges, and flagged outliers.

### 4. 👨‍👩‍👧‍👦 Multi-Member Family Profiles
- **Centralized Profiles**: Manage individual medical records for children, spouses, or elderly parents under a single account.
- **Member-Specific Data**: Track allergies, blood groups, chronic medical conditions, and emergency details per profile.
- **Instant Profile Switching**: One-tap switching between family member views across all tabs and stores.

### 5. ⚡ Offline-First & Hybrid Cloud Storage
- **Cache-First Architecture**: Powered by Zustand stores and `@react-native-async-storage/async-storage` for instant zero-latency UI rendering.
- **Silent Background Sync**: Background synchronization with Supabase PostgreSQL without blocking user interaction.
- **Hybrid Storage**: Document images and PDFs stored with presigned URLs via Cloudflare R2 (S3-compatible) or Supabase Storage.
- **Security & Privacy**: Row Level Security (RLS) on all Supabase tables ensuring strict isolation between user accounts.

---

## 🏗️ Architecture & Tech Stack

```
dosiqAi/
├── mobile/                   # React Native (Expo) Mobile Application (Primary)
│   ├── src/
│   │   ├── components/       # Reusable UI, modals, charts, prescription & lab cards
│   │   ├── constants/        # Design system tokens (Colors, Typography, Sizes)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── screens/          # 20+ mobile screens (Home, Scan, Docs, Health, Alarms, etc.)
│   │   ├── services/         # API, Supabase, Cloudflare R2, AI analysis, Notifications
│   │   ├── store/            # 8 Zustand state stores with AsyncStorage persistence
│   │   ├── types/            # TypeScript data contracts & schemas
│   │   └── utils/            # Image compression, animations, PDF generation
│   ├── supabase/             # Edge Functions & SQL migrations
│   │   ├── functions/        # Deno edge functions (analyze-document)
│   │   └── migrations/       # Schema definitions and RLS policies
│   └── app.config.js         # Expo configuration (iOS deployment target, plugins, EAS)
├── src/                      # React + Vite Web Dashboard Companion
│   ├── components/           # Radix UI primitives & dashboard views
│   └── App.tsx               # Web application entry point
└── docs/                     # Technical specifications and debug guides
```

### Technology Matrix

| Layer | Technologies |
|---|---|
| **Mobile App** | React Native 0.81, Expo SDK 54 (New Architecture), TypeScript 5.9, React Navigation 7 |
| **Mobile State** | Zustand 5 with AsyncStorage cache-first hydration |
| **Mobile UI & Visuals** | Reanimated 4, Victory Native, React Native SVG, Expo Blur, Expo Linear Gradient |
| **Notifications & System** | Notifee 9, Expo Live Activity, Expo Haptics, Expo Image Picker / Crop Picker |
| **Web Dashboard** | React 18, Vite 6, Tailwind CSS, Radix UI Primitives, Lucide React, Recharts |
| **Backend & Auth** | Supabase (PostgreSQL, Supabase Auth, Row-Level Security, Edge Functions) |
| **Cloud Storage** | Cloudflare R2 (`@aws-sdk/client-s3`) & Supabase Storage |
| **AI Extraction Engine** | Google Gemini 2.5 Flash via OpenRouter API |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- **Node.js** (v18.0.0 or later, v20+ recommended)
- **npm** or **yarn**
- **macOS with Xcode 15+** (required for iOS Simulator & native builds)
- **CocoaPods** (for iOS native dependency management)
- **Supabase CLI** (optional, for edge function deployments)

---

### Mobile App Setup (`mobile/`)

1. **Navigate to the mobile directory**:
   ```bash
   cd mobile
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in `mobile/`:
   ```env
   # Supabase
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # Cloudflare R2 Object Storage
   EXPO_PUBLIC_R2_ACCESS_KEY_ID=your-r2-access-key-id
   EXPO_PUBLIC_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
   EXPO_PUBLIC_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
   EXPO_PUBLIC_R2_BUCKET_NAME=your-bucket-name
   ```

4. **Generate native projects (Expo Prebuild)**:
   ```bash
   npx expo prebuild
   ```

5. **Run on iOS Simulator**:
   ```bash
   # Recommended simulator: iPhone 15 Plus (iOS 18.6+)
   npx expo run:ios
   ```

6. **Run on Android**:
   ```bash
   npx expo run:android
   ```

---

### Web Dashboard Setup (Root `/`)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the Vite development server**:
   ```bash
   npm run dev
   ```

3. **Build production bundle**:
   ```bash
   npm run build
   ```

---

## ⚙️ Backend & Supabase Configuration

### 1. Database Migrations
Apply the migrations located in `mobile/supabase/migrations/` via the Supabase Dashboard SQL Editor or Supabase CLI:
- `create_family_members.sql`: Family member profiles table.
- `add_document_analysis.sql`: Document storage metadata and AI analysis status columns.
- `create_upload_limits.sql`: User daily upload tracking and quotas.
- `20251225_create_lab_reports_schema.sql` & `20251226_enhance_lab_reports_schema.sql`: Structured lab reports & metric tracking.
- `20260108_add_documents_rls_policies.sql`: Row-Level Security policies.
- `20260121_recreate_medication_logs.sql`: Medication intake and adherence logging.

### 2. Edge Function Setup (`analyze-document`)
The edge function handles multimodal document processing.

Configure the required secrets in **Supabase Dashboard → Edge Functions → Secrets**:
- `OPENROUTER_API_KEY`: OpenRouter API key.
- `DOCUMENT_ANALYSIS_PROMPT`: Standardized system prompt defining extraction rules.

To deploy or update the function:
```bash
cd mobile
npx supabase functions deploy analyze-document
```

---

## 🗄️ State Management Architecture

The mobile application utilizes 8 specialized Zustand stores with persistence:

| Store | File | Purpose |
|---|---|---|
| `authStore` | `mobile/src/store/authStore.ts` | Session handling, user credentials, login/signup |
| `documentsStore` | `mobile/src/store/documentsStore.ts` | Medical document uploads, AI processing triggers, quotas |
| `familyMembersStore`| `mobile/src/store/familyMembersStore.ts`| Multi-profile management, active member selection |
| `medicationsStore` | `mobile/src/store/medicationsStore.ts` | Regimens, dosages, scheduling, alarm synchronization |
| `medicationLogsStore`| `mobile/src/store/medicationLogsStore.ts`| Daily intake tracking and adherence history |
| `labReportsStore` | `mobile/src/store/labReportsStore.ts` | Diagnostic lab test results and extracted parameters |
| `healthVitalsStore` | `mobile/src/store/healthVitalsStore.ts` | Biomarker metrics (BP, glucose, heart rate) |
| `appointmentsStore` | `mobile/src/store/appointmentsStore.ts` | Doctor appointments and consultations |

---

## 🛠️ Troubleshooting & Tips

- **Reset Metro Bundler Cache**:
  ```bash
  npx expo start -c
  ```
- **Clean Native iOS Rebuild**:
  ```bash
  cd mobile
  rm -rf ios android
  npx expo prebuild --clean
  cd ios && pod install && cd ..
  npx expo run:ios
  ```
- **iOS Live Activity & Background Notifications**:
  Ensure notifications permissions and time-sensitive notification entitlements are accepted in the iOS simulator settings.

---

## 🔒 Security & Privacy

- **Data Isolation**: Supabase Row-Level Security (RLS) ensures users can only access records associated with their authenticated `auth.uid()`.
- **API Protection**: Third-party LLM keys (OpenRouter) are never exposed to the client; all inference runs through authenticated Supabase Edge Functions.
- **HIPAA & Health Privacy Considerations**: Storage paths and file keys are securely presigned, expiring after access.

---

## License

Open Source under the [MIT License](LICENSE).