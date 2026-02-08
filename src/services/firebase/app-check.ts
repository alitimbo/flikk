import { getApp } from "@react-native-firebase/app";
import { initializeAppCheck } from "@react-native-firebase/app-check";

let initialized = false;

export async function initAppCheck() {
  if (initialized) return;

  const shouldUseDebug = process.env.EXPO_PUBLIC_FORCE_DEBUG === "true";

  await initializeAppCheck(getApp(), {
    provider: {
      providerOptions: {
        android: {
          provider: shouldUseDebug ? "debug" : "playIntegrity",
          ...(shouldUseDebug
            ? { debugToken: "AA9E1281-93F5-4203-86E4-71305627FBBA" }
            : {}),
        },
        apple: {
          provider: shouldUseDebug ? "debug" : "deviceCheck",
          ...(shouldUseDebug ? { debugToken: "" } : {}),
        },
      },
    },
    isTokenAutoRefreshEnabled: true,
  });

  initialized = true;
}
