import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Flikk",
  slug: "Flikk",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "flikk",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.flikk.app",
    icon: "./assets/expo.icon",
    googleServicesFile: "./GoogleService-Info.plist",
    infoPlist: {
      NSPhotoLibraryUsageDescription: "Allow Flikk to access your photos.",
      NSPhotoLibraryAddUsageDescription: "Allow Flikk to add photos.",
    },
  },
  android: {
    package: "com.flikk.app",
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: false,
        data: [
          {
            scheme: "flikk",
            host: "firebaseauth",
            pathPrefix: "/link",
          },
          {
            scheme: "com.flikk.app",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: false,
        data: [
          {
            scheme:
              "com.googleusercontent.apps.958811154492-g1a16llqom5bhalnscncnjp6alee6m5l",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "flikk-3c3a0.web.app",
          },
          {
            scheme: "https",
            host: "flikk-3c3a0.firebaseapp.com",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    adaptiveIcon: {
      backgroundColor: "#2B2B2B",
      foregroundImage: "./assets/images/android/android-icon-foreground.png",
      backgroundImage: "./assets/images/android/android-icon-background.png",
      monochromeImage: "./assets/images/android/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    googleServicesFile: "./google-services.json",
    permissions: [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "WAKE_LOCK",
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
      "POST_NOTIFICATIONS",
    ],
  },
  web: {
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    "@react-native-firebase/app",
    "@react-native-firebase/auth", // Recommandé pour l'auth native
    "@react-native-firebase/messaging", // Indispensable pour les notifications
    [
      "@react-native-firebase/app-check",
      {
        // Nécessaire pour iOS (partage le token entre l'app et les extensions)
        appleTokenSharing: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#2B2B2B",
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        android: {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          adaptiveIconBackgroundColor: "#2B2B2B",
        },
        ios: {
          image: "./assets/images/splash-icon.png",
        },
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: "Allow Flikk to access your photos.",
        isAccessMediaLocationEnabled: true,
        granularPermissions: ["photo", "video"],
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Flikk to access your photos.",
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
        },
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "c2aa0072-52d2-4d08-8b7e-6c4a0414328d",
    },
  },
  updates: {
    url: "https://u.expo.dev/c2aa0072-52d2-4d08-8b7e-6c4a0414328d",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
});
