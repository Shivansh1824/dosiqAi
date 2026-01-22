export default {
  expo: {
    name: "FamilyCare Health",
    slug: "familycare-health",
    scheme: "familyhealth",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    description: "Your family's health journey, simplified and secure",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.shivanshrana.familycare.health",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["remote-notification"],
      },
      // Enable after Apple Critical Alerts approval:
      // entitlements: {
      //   "com.apple.developer.usernotifications.critical-alerts": true
      // }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.familycare.health"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-font",
      [
        "expo-media-library",
        {
          "photosPermission": "Allow FamilyCare Health to save documents and images to your photo library.",
          "savePhotosPermission": "Allow FamilyCare Health to save documents and images to your photo library.",
          "isAccessMediaLocationEnabled": true
        }
      ],
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "18.6",
            extraBuildSettings: {
              ENABLE_USER_SCRIPT_SANDBOXING: "NO"
            }
          },
          android: {
            minSdkVersion: 24
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "4e25fcb2-a9f4-42c9-8ddd-ace3d3b9d906"
      },
      // Environment variables accessible via expo-constants
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,

      // R2 Storage Configuration
      R2_ACCESS_KEY_ID: process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY,
      R2_ENDPOINT: process.env.EXPO_PUBLIC_R2_ENDPOINT,
      R2_BUCKET_NAME: process.env.EXPO_PUBLIC_R2_BUCKET_NAME,
    }
  }
};
