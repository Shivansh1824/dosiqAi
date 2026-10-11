# Setup Instructions for New Mac

This folder contains only the essential **source code** and **configuration files** for the FamilyHealthApp project. You do NOT need `node_modules`, `ios`, or `android` folders - those will be regenerated automatically.

## 📦 What's Included
- Root project configuration files
- Mobile app source code (`mobile/src`)
- Mobile app configuration (`app.config.js`, `eas.json`, etc.)
- Assets (images, fonts)
- Environment variables (`.env` file)
- Web dashboard source code (`src/`)

## 🚀 Setup Steps on New Mac

### 1. Prerequisites
Make sure you have these installed on the new Mac:
- **Node.js** (v18 or later) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Xcode** (for iOS development) - Install from Mac App Store
- **Git** (optional, but recommended)

### 2. Copy This Folder
Transfer the entire "Copy" folder to your new Mac (via AirDrop, USB drive, cloud storage, etc.)

### 3. Install Dependencies

Open Terminal and navigate to the copied folder:

```bash
# Navigate to the project folder
cd /path/to/Copy

# Install root dependencies
npm install

# Navigate to mobile folder
cd mobile

# Install mobile dependencies
npm install
```

### 4. Generate Native Folders

Since we didn't transfer the `ios` and `android` folders, you need to regenerate them:

```bash
# Make sure you're in the mobile folder
npx expo prebuild
```

This will create fresh `ios` and `android` folders configured for your new Mac.

### 5. Run the App

Now you can run the app:

```bash
# For iOS (simulator)
npx expo run:ios

# OR open in Xcode for device deployment
open ios/FamilyCareHealth.xcworkspace
```

## 📝 Important Notes

- **Environment Variables**: Your `.env` file is included and contains sensitive information. Keep it secure.
- **Bundle Identifier**: Make sure your Apple Developer account is set up if you plan to deploy to a physical device.
- **Firebase**: If you need to update Firebase configuration, check `mobile/app.config.js`

## ⚠️ Troubleshooting

If you encounter issues:
1. Run `npm install` again in both root and mobile folders
2. Clear cache: `npx expo start -c`
3. Rebuild native folders: `npx expo prebuild --clean`

## 📊 Folder Size
- This "Copy" folder: ~2.1 MB
- Original with node_modules: ~500+ MB
- You saved 99% of transfer size! 🎉
