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
    adaptiveIcon: {
      backgroundColor: "#2B2B2B",
      foregroundImage: "./assets/images/android/android-icon-foreground.png",
      backgroundImage: "./assets/images/android/android-icon-background.png",
      monochromeImage: "./assets/images/android/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    googleServicesFile: "./google-services.json",
    permissions: [
      "READ_EXTERNAL_STORAGE",
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
    ],
  },
  web: {
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    "@react-native-firebase/app",
    "@livekit/react-native-expo-plugin",
    "@config-plugins/react-native-webrtc",
    [
      "react-native-video",
      {
        enableCacheExtension: true,
        androidExtensions: {
          useExoplayerHls: true,
        },
      },
    ],
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "Flikk needs access to your Camera.",
        enableMicrophonePermission: true,
        microphonePermissionText: "Flikk needs access to your Microphone.",
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
        granularPermissions: ["photo"],
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
