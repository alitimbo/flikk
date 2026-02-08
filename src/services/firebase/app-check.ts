import { getApp } from "@react-native-firebase/app";
import { initializeAppCheck } from "@react-native-firebase/app-check";

let initialized = false;

export async function initAppCheck() {
  if (initialized) return;

  const shouldUseDebug = process.env.EXPO_PUBLIC_FORCE_DEBUG === "true";
  const debugToken = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;

  await initializeAppCheck(getApp(), {
    provider: {
      providerOptions: {
        android: {
          provider: shouldUseDebug ? "debug" : "playIntegrity",
          ...(shouldUseDebug && debugToken ? { debugToken } : {}),
        },
        apple: {
          provider: shouldUseDebug ? "debug" : "deviceCheck",
          ...(shouldUseDebug && debugToken ? { debugToken } : {}),
        },
      },
    },
    isTokenAutoRefreshEnabled: true,
  });

  initialized = true;
}
