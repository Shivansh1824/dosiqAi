process.env.EXPO_ROUTER_APP_ROOT = './app';
export default {
  expo: {
    name: "dosiq Ai",
    slug: "dosiqai",
    scheme: "dosiqai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon-ios.png",
    userInterfaceStyle: "light",
    description: "Your health journey, simplified and secure",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.shivanshrana.dosiqai",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["remote-notification"],
      },
      entitlements: {
        "com.apple.developer.usernotifications.time-sensitive": true,
        "com.apple.security.application-groups": ["group.com.shivanshrana.dosiqai"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icon-android-foreground.png",
        backgroundColor: "#373636"
      },
      statusBar: {
        barStyle: "light-content",
        backgroundColor: "#ffffff",
        translucent: true
      },
      predictiveBackGestureEnabled: false,
      package: "com.dosiqai"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-asset",
      "@config-plugins/react-native-pdf",
      "@config-plugins/react-native-blob-util",
      [
        "expo-media-library",
        {
          "photosPermission": "Allow dosiqAi to save documents and images to your photo library.",
          "savePhotosPermission": "Allow dosiqAi to save documents and images to your photo library.",
          "isAccessMediaLocationEnabled": true
        }
      ],
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "18.6",
            useHermesV1: true,
            buildReactNativeFromSource: true,
            extraBuildSettings: {
              ENABLE_USER_SCRIPT_SANDBOXING: "NO"
            }
          },
          android: {
            minSdkVersion: 24,
            useHermesV1: true,
            buildReactNativeFromSource: true
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "4e25fcb2-a9f4-42c9-8ddd-ace3d3b9d906"
      },
      // Environment variables accessible via expo-constants
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,

      // R2 Storage Configuration
      R2_ACCESS_KEY_ID: process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY,
      R2_ENDPOINT: process.env.EXPO_PUBLIC_R2_ENDPOINT,
      R2_BUCKET_NAME: process.env.EXPO_PUBLIC_R2_BUCKET_NAME,
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    }
  }
};
