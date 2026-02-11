import { useEffect, useMemo } from "react";
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

        let token: string | null | undefined;
        if (isAuthorized) {
          token = forcedToken ?? (await getToken(messaging));
        }

        await UserService.upsertNotificationDevice(uid, deviceId, {
          fcmToken: token,
          language: normalizedLanguage,
        });
      } catch {
        // Intentionally silent to avoid noisy logs in production.
      }
    };

    void syncDeviceContext();

    const unsubscribeTokenRefresh = onTokenRefresh(messaging, (nextToken) => {
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
