import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import "../global.css";
import "../i18n";
import { useAppTheme } from "@/hooks/use-app-theme";
import { FirebaseService } from "@/services/firebase/firebase-service";
import { CustomSplash } from "@/components/features/custom-splash";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { useNotificationToast } from "@/hooks/useNotificationToast";

const queryClient = new QueryClient();

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [firebaseInitError, setFirebaseInitError] = useState<Error | null>(null);
  const [fontsLoaded] = useFonts({
    "Inter-Variable": require("@/assets/fonts/Inter-VariableFont_opsz,wght.ttf"),
    "Syne-Variable": require("@/assets/fonts/Syne-VariableFont_wght.ttf"),
  });

  useAppTheme();
  useNotificationToast();

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
        await FirebaseService.init();
        setIsFirebaseReady(true);
      } catch (error) {
        console.log("[RootLayout] Firebase init error:", error);
        setFirebaseInitError(error as Error);
      }
    }
    void prepare();
  }, []);

  useEffect(() => {
    if (fontsLoaded && (isFirebaseReady || firebaseInitError)) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isFirebaseReady, firebaseInitError]);

  if (!fontsLoaded || (!isFirebaseReady && !firebaseInitError)) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <View className="flex-1">
            <Stack screenOptions={{ headerShown: false }} />
            <Toast />
            {showSplash && (
              <CustomSplash onFinish={() => setShowSplash(false)} />
            )}
          </View>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
