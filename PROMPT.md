# FamilyHealth App - AI Agent Setup Prompt

## 📱 What is This App?

**FamilyHealth App** (also known as **FamilyCare Health**) is a comprehensive family health management mobile application that helps families digitize, organize, and gain intelligent insights from medical records.

### Core Purpose
The app allows users to:
1. **Scan health documents** (prescriptions, lab reports, medical records) using OCR technology
2. **Extract health metrics** (blood sugar, blood pressure, medications, etc.) automatically
3. **Visualize health trends** through charts and dashboards
4. **Get AI-generated summaries** of complex medical reports in plain language
5. **Query health data** via an intelligent chatbot (e.g., "What was my blood sugar last month?")
6. **Manage medications** with intelligent alarm system that works even when app is closed
7. **Track multiple family members** (parents, children, elderly) with separate health profiles

### Target Users
- Parents managing health records for children and elderly parents
- Caregivers tracking medications and appointments for dependents
- Chronic condition patients (diabetes, hypertension) monitoring their health
- Families who want organized, accessible health history during emergencies

---

## 🎯 Development Goals on New Mac

This project needs to be set up on a **new Mac** for continued development and testing. Your task as an AI agent is to:

### 1. **Setup the Development Environment**
   - Ensure Node.js (v18+) and npm are installed
   - Install project dependencies in both root and `mobile/` directories
   - Install Xcode (for iOS development)
   - Install CocoaPods (if not already present)

### 2. **Target Platform: iOS Simulator (NOT Physical Device)**
   ⚠️ **IMPORTANT**: All testing and development should be done on the **iOS Simulator**, not on a physical iPhone.
   
   **iOS Version Target**: **iOS 18.7+**
   - The app is being developed and tested specifically for **iOS 18.7 and above**
   - When running the simulator, use an **iPhone 15 Plus** or similar device running **iOS 18.7**
   - This ensures compatibility with all iOS versions >= 18.7

### 3. **Generate Native iOS Project**
   Since the `ios/` folder is NOT included in this transfer, you must regenerate it:
   ```bash
   cd mobile
   npx expo prebuild
   ```
   This creates a fresh iOS project with all necessary configurations for the new Mac.

### 4. **Run the App on iOS Simulator**
   After setup, test the app by launching it in the iOS Simulator:
   ```bash
   cd mobile
   npx expo run:ios
   ```
   
   **Expected Behavior**:
   - The app should launch in the iOS Simulator
   - You should see the Welcome Screen with the FamilyHealth logo
   - You can navigate through onboarding screens
   - Login screen with Google, Apple, and Phone login options
   - Home screen with health dashboard (UI only, no backend yet)

### 5. **Verify Core Functionality**
   Test these screens (they are UI-only, no backend integration yet):
   - ✅ Welcome Screen (logo, tagline, "Get Started" button)
   - ✅ Onboarding Screens (3 screens explaining features)
   - ✅ Login Screen (Google, Apple, Phone login buttons)
   - ✅ Home Screen (dashboard, recent documents, profile switcher)
   - ✅ Scan Document Screen (camera UI - actual camera not yet integrated)
   - ✅ Document Detail Screen (view document metadata, tags, notes)

---

## 🏗️ Technical Architecture

### Platform & Stack
- **Mobile**: React Native with Expo SDK 54
- **Language**: TypeScript
- **UI Components**: Custom components built with React Native StyleSheet API
- **Icons**: @expo/vector-icons (Feather icons)
- **Navigation**: React Navigation (Stack Navigator)
- **State Management**: Zustand (for authentication and app state)
- **Animations**: React Native Reanimated

### Backend (Not Yet Integrated)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Firebase Auth (Google, Apple, Phone OTP)
- **Storage**: Supabase Storage (for document images)
- **OCR**: Google Cloud Vision API (planned)
- **AI Summarization**: OpenAI GPT-4 or Anthropic Claude (planned)
- **Chatbot**: LangChain + OpenAI (planned)

### Current State
- **Completed**: All UI screens (Welcome, Onboarding, Login, Home, Scan, Document Detail)
- **Pending**: Backend integration, real camera functionality, OCR, AI features, medication alarms

---

## 📂 Project Structure

```
Copy/
├── mobile/                          # React Native mobile app (PRIMARY FOCUS)
│   ├── src/
│   │   ├── screens/                 # All app screens
│   │   │   ├── WelcomeScreen.tsx
│   │   │   ├── Onboarding1-3Screen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── ScanDocumentScreen.tsx
│   │   │   └── DocumentDetailScreen.tsx
│   │   ├── components/              # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Logo.tsx
│   │   │   └── ProfileSwitcherModal.tsx
│   │   ├── constants/               # Design tokens (Colors, Typography, Sizes)
│   │   ├── store/                   # Zustand stores (authStore.ts)
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── types/                   # TypeScript type definitions
│   │   └── utils/                   # Utility functions and animations
│   ├── App.tsx                      # Root component
│   ├── app.config.js                # Expo configuration (Firebase keys)
│   ├── package.json                 # Dependencies
│   └── .env                         # Environment variables (Firebase credentials)
│
├── src/                             # Web dashboard (React + Vite)
├── package.json                     # Root dependencies
├── vite.config.ts                   # Web build config
└── SETUP_INSTRUCTIONS.md            # Setup guide (read this first!)
```

---

## 🚀 Step-by-Step Setup Instructions

Follow these steps **in order** when setting up on the new Mac:

### Step 1: Verify Prerequisites
```bash
# Check Node.js version (should be v18+)
node -v

# Check npm version
npm -v

# Check if Xcode is installed
xcode-select -p

# If Xcode is not installed, download from Mac App Store
```

### Step 2: Install Dependencies
```bash
# Navigate to the project root
cd /path/to/Copy

# Install root dependencies (for web dashboard)
npm install

# Navigate to mobile folder
cd mobile

# Install mobile dependencies
npm install
```

### Step 3: Regenerate iOS Native Project
```bash
# Make sure you're in the mobile/ directory
npx expo prebuild

# This will create the ios/ and android/ folders
# It will also install CocoaPods dependencies automatically
```

**If you encounter CocoaPods errors:**
```bash
cd ios
pod install
cd ..
```

### Step 4: Launch on iOS Simulator (iOS 18.7+)
```bash
# From mobile/ directory
npx expo run:ios

# To specify a specific device:
npx expo run:ios --device "iPhone 15 Plus"
```

**Alternative Method (using Xcode):**
```bash
# Open the workspace in Xcode
open ios/FamilyCareHealth.xcworkspace

# In Xcode:
# 1. Select "iPhone 15 Plus (iOS 18.7)" as the simulator
# 2. Click the "Play" button to build and run
```

### Step 5: Test the App
Once the simulator launches:
1. ✅ Verify Welcome Screen appears with logo
2. ✅ Tap "Get Started" → Navigate to Onboarding 1
3. ✅ Swipe through 3 onboarding screens
4. ✅ Click "Get Started" → Navigate to Login Screen
5. ✅ See Google, Apple, Phone login buttons (they won't work yet - no backend)
6. ✅ (For testing) Manually navigate to Home Screen
7. ✅ Test Profile Switcher Modal (tap profile icon)
8. ✅ Test bottom navigation (Home, Scan, Documents, More)

---

## 🎨 Design System

The app follows a consistent design system:

### Colors
- **Primary Blue**: `#4A90E2` (Medical trust, reliability)
- **Secondary Green**: `#66BB6A` (Health, wellness)
- **Orange**: `#FB8C00` (Alerts, warnings)
- **Red**: `#EF5350` (Critical values, errors)
- **Gray Scale**: gray50 - gray900

### Typography
- **Headings**: Bold (700), 24-36pt
- **Body**: Regular (400), 16pt
- **Captions**: Medium (500), 14pt

### Spacing
- 8px-based spacing scale: `xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px`

---

## ⚠️ Important Notes

### Environment Variables
- The `.env` file contains **Firebase API keys and secrets**
- **DO NOT commit this file to version control**
- Keep it secure and private

### iOS Simulator Selection
- Always test on **iOS 18.7+** simulators
- Recommended device: **iPhone 15 Plus (iOS 18.7)**
- This ensures compatibility with latest iOS features and APIs

### Known Limitations (Current State)
- **No Real Camera**: Scan Document screen has UI but doesn't open camera yet
- **No Backend**: Login buttons are placeholders, no actual authentication
- **No OCR**: Document scanning UI exists but doesn't extract text
- **No AI Features**: Summarization and chatbot features not yet integrated
- **No Medication Alarms**: Planned feature, not yet implemented

### Next Development Steps
1. Integrate Firebase Authentication (Google, Apple, Phone OTP)
2. Connect Supabase database for health records
3. Implement real camera functionality with `expo-camera`
4. Integrate OCR API (Google Cloud Vision or Tesseract)
5. Build AI summarization with OpenAI/Claude API
6. Create medication alarm system with Expo Notifications
7. Build health dashboard with charts (Recharts)
8. Implement chatbot interface with LangChain

---

## 🐛 Troubleshooting

### If `npx expo prebuild` Fails:
```bash
# Clear Expo cache
npx expo prebuild --clean

# Or manually delete and regenerate
rm -rf ios android
npx expo prebuild
```

### If iOS Build Fails:
```bash
# Clean build folder
cd ios
rm -rf build
xcodebuild clean

# Reinstall pods
pod deintegrate
pod install
cd ..

# Try building again
npx expo run:ios
```

### If Metro Bundler Has Issues:
```bash
# Clear Metro cache
npx expo start -c

# Or manually clear
rm -rf node_modules/.cache
```

### If Simulator Doesn't Launch:
```bash
# List available simulators
xcrun simctl list devices

# Boot a specific simulator manually
xcrun simctl boot "iPhone 15 Plus"

# Then run the app
npx expo run:ios
```

---

## 📝 Quick Commands Reference

```bash
# Start development server with cache clear
npx expo start -c

# Run on iOS Simulator (default device)
npx expo run:ios

# Run on specific iOS Simulator
npx expo run:ios --device "iPhone 15 Plus"

# Open iOS project in Xcode
open ios/FamilyCareHealth.xcworkspace

# Rebuild native folders from scratch
npx expo prebuild --clean

# Install iOS dependencies
cd ios && pod install && cd ..

# View logs
npx react-native log-ios
```

---

## 🎯 Your Mission as an AI Agent

When working on this project, you should:

1. **Understand the Context**: This is a family health management app with OCR, AI, and multi-profile support
2. **Focus on Mobile**: The React Native app (`mobile/`) is the primary platform
3. **Test on iOS 18.7+ Simulator**: Always use iPhone 15 Plus or similar with iOS 18.7+
4. **Maintain Design Consistency**: Follow the established color palette, typography, and spacing
5. **Prepare for Backend Integration**: UI is ready, next step is connecting real services
6. **Prioritize User Experience**: Medical apps need to be simple, accessible, and reliable

### Key Principles
- **User-Friendly**: Simplify medical terminology for non-experts
- **Visual**: Use charts, icons, color coding for quick comprehension
- **Accessible**: Support for elderly users and limited tech literacy
- **Secure**: Health data is sensitive - encryption and privacy are paramount
- **Offline-Capable**: Core features should work without internet

---

## 📞 Questions or Issues?

If you encounter setup issues or have questions about the app's functionality, refer to:
- `SETUP_INSTRUCTIONS.md` - Detailed setup guide
- `PRODUCT_OVERVIEW.md` - (Create this later with full feature spec)
- Mobile app's `README.md` - Quick reference for mobile app

---

**Good luck with the setup! 🚀**
