import appCheck from "@react-native-firebase/app-check";

let initialized = false;

export async function initAppCheck() {
  if (initialized) return;

  const shouldUseDebug = process.env.EXPO_PUBLIC_FORCE_DEBUG === "true";

  const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
  provider.configure({
    android: {
      provider: shouldUseDebug ? "debug" : "playIntegrity",
      ...(shouldUseDebug
        ? { debugToken: "AA9E1281-93F5-4203-86E4-71305627FBBA" }
        : {}),
    },
    apple: {
      provider: shouldUseDebug ? "debug" : "deviceCheck",
      ...(shouldUseDebug
        ? { debugToken: "AA9E1281-93F5-4203-86E4-71305627FBBA" }
        : {}),
    },
  });

  await appCheck().initializeAppCheck({
    provider,
    isTokenAutoRefreshEnabled: true,
  });

  initialized = true;
}
