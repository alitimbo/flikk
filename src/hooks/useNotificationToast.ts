import { useEffect } from "react";
import {
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  type FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";
import Toast from "react-native-toast-message";

function toText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function showNotificationToast(
  message: FirebaseMessagingTypes.RemoteMessage | null,
) {
  if (!message) return;

  const title =
    toText(message.notification?.title) ??
    toText(message.data?.title);
  const body =
    toText(message.notification?.body) ??
    toText(message.data?.body) ??
    toText(message.data?.message);

  if (!title && !body) return;

  Toast.show({
    type: "info",
    position: "top",
    text1: title || "Notification",
    text2: body,
    visibilityTime: 3500,
    topOffset: 52,
  });
}

export function useNotificationToast() {
  useEffect(() => {
    const messaging = getMessaging();

    const unsubscribeForeground = onMessage(messaging, async (message) => {
      showNotificationToast(message);
    });

    const unsubscribeOpened = onNotificationOpenedApp(messaging, (message) => {
      showNotificationToast(message);
    });

    void getInitialNotification(messaging).then((message) => {
      showNotificationToast(message);
    });

    return () => {
      unsubscribeForeground();
      unsubscribeOpened();
    };
  }, []);
}
