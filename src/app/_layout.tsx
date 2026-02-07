import { useEffect } from "react";
import { Stack } from "expo-router";
import { registerGlobals } from "@livekit/react-native";
import "../global.css";
import "../i18n";
import { useAppTheme } from "@/hooks/use-app-theme";
import { FirebaseService } from "@/services/firebase/firebase-service";

registerGlobals();

export default function RootLayout() {
  useAppTheme();
  useEffect(() => {
    void FirebaseService.init();
  }, []);
  return <Stack screenOptions={{ headerShown: false }} />;
}
