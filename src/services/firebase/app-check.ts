import { getApp } from "@react-native-firebase/app";
import appCheck, { initializeAppCheck } from "@react-native-firebase/app-check";

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
        },
      },
    },
    isTokenAutoRefreshEnabled: true,
  });

  // 🔥 AJOUTE ÇA ICI
  try {
    const tokenResult = await appCheck().getToken(true);
    //console.log("🔥 AppCheck token:", tokenResult?.token);
  } catch (e) {
    console.log("❌ AppCheck token error:", e);
  }

  initialized = true;
}
