import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Aegis",
  slug: "aegis",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#14342b",
  },
  android: {
    package: "com.aegis.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#14342b",
    },
    permissions: [
      "android.permission.CAMERA",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
      "android.permission.POST_NOTIFICATIONS",
    ],
  },
  ios: {
    bundleIdentifier: "com.aegis.app",
    supportsTablet: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-local-authentication",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#0d9488",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "Allow Aegis to access your camera for scanning barcodes and taking photos.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Aegis to access your photos to attach them to assets and entries.",
      },
    ],
  ],
  scheme: "aegis",
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_AEGIS_API_BASE_URL ?? "http://127.0.0.1:4000",
    devUserId: process.env.EXPO_PUBLIC_AEGIS_DEV_USER_ID ?? "",
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? "",
    },
  },
  updates: {
    fallbackToCacheTimeout: 0,
    url: "https://u.expo.dev/aegis",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
});
