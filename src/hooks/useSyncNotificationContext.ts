import { useEffect, useMemo } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import {
  AuthorizationStatus,
  hasPermission,
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from "@react-native-firebase/messaging";
import { DeviceService } from "@/services/device/device-service";
import { UserService } from "@/services/firebase/user-service";
import type { AppLanguage } from "@/types";
import { MMKVStorage } from "@/storage/mmkv";

const NOTIFICATIONS_ENABLED_KEY = "notifications_enabled";

export function useSyncNotificationContext(
  uid?: string,
  language?: string,
) {
  const normalizedLanguage: AppLanguage = useMemo(
    () => (language?.startsWith("en") ? "en" : "fr"),
    [language],
  );

  const deviceId = useMemo(() => DeviceService.getDeviceId(), []);

  useEffect(() => {
    if (!uid) return;
    const messaging = getMessaging();

    const syncDeviceContext = async (forcedToken?: string) => {
      try {
        if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
          const androidPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          if (androidPermission !== PermissionsAndroid.RESULTS.GRANTED) {
            MMKVStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
            await UserService.upsertNotificationDevice(uid, deviceId, {
              fcmToken: null,
              language: normalizedLanguage,
            });
            return;
          }
        }

        if (!isDeviceRegisteredForRemoteMessages(messaging)) {
          await registerDeviceForRemoteMessages(messaging);
        }

        let permission = await hasPermission(messaging);
        if (
          permission !== AuthorizationStatus.AUTHORIZED &&
          permission !== AuthorizationStatus.PROVISIONAL
        ) {
          permission = await requestPermission(messaging);
        }
        const isAuthorized =
          permission === AuthorizationStatus.AUTHORIZED ||
          permission === AuthorizationStatus.PROVISIONAL;
        MMKVStorage.setItem(
          NOTIFICATIONS_ENABLED_KEY,
          isAuthorized ? "true" : "false",
        );

        let token: string | null | undefined;
        if (isAuthorized) {
          token = forcedToken ?? (await getToken(messaging));
        }

        await UserService.upsertNotificationDevice(uid, deviceId, {
          fcmToken: token,
          language: normalizedLanguage,
        });
      } catch (error) {
        MMKVStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
        console.log("[PushSync] permission/token sync error:", error);
      }
    };

    void syncDeviceContext();

    const unsubscribeTokenRefresh = onTokenRefresh(messaging, (nextToken) => {
      MMKVStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "true");
      void UserService.upsertNotificationDevice(uid, deviceId, {
        fcmToken: nextToken,
        language: normalizedLanguage,
      }).catch(() => {});
    });

    return () => {
      unsubscribeTokenRefresh();
    };
  }, [uid, deviceId, normalizedLanguage]);
}
