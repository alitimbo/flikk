import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { Stack } from "expo-router";
import { View, Text } from "react-native";
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

SplashScreen.preventAutoHideAsync(); // ← Appel global, très tôt

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Inter-Variable": require("@/assets/fonts/Inter-VariableFont_opsz,wght.ttf"),
    "Syne-Variable": require("@/assets/fonts/Syne-VariableFont_wght.ttf"),
  });

  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<Error | null>(null);

  const [appIsReady, setAppIsReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useAppTheme();
  useNotificationToast();

  const prepareApp = useCallback(async () => {
    try {
      // 1. Init Firebase (inclut App Check)
      await FirebaseService.init();
      setFirebaseReady(true);
    } catch (err) {
      console.error("[RootLayout] Firebase init failed", err);
      setFirebaseError(
        err instanceof Error ? err : new Error("Firebase init failed"),
      );
      // Option : ici tu peux décider de continuer ou bloquer
    }
  }, []);

  useEffect(() => {
    prepareApp();
  }, [prepareApp]);

  // Cache le splash natif quand tout est vraiment prêt
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      // On attend que Firebase soit OK ou en erreur connue
      if (firebaseReady || firebaseError) {
        await SplashScreen.hideAsync();
        setAppIsReady(true);
      }
    }
  }, [fontsLoaded, fontError, firebaseReady, firebaseError]);

  // Si erreur font OU firebase → on affiche quand même après un moment (fallback)
  useEffect(() => {
    if ((fontsLoaded || fontError) && (firebaseReady || firebaseError)) {
      // Sécurité : si Firebase prend trop longtemps → timeout 8s max
      const timeout = setTimeout(() => {
        setAppIsReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }, 8000);

      return () => clearTimeout(timeout);
    }
  }, [fontsLoaded, fontError, firebaseReady, firebaseError]);

  if (!appIsReady) {
    return null; // garde le splash natif visible
  }

  // ────────────────────────────────────────────────
  // À partir d'ici → splash natif caché, on rend l'UI
  // ────────────────────────────────────────────────

  if (firebaseError) {
    return (
      <View className="flex-1 items-center justify-center bg-red-50 p-6">
        <Text className="text-red-600 text-center text-lg mb-4">
          Erreur d'initialisation Firebase
        </Text>
        <Text className="text-gray-700 text-center">
          {firebaseError.message || "Veuillez réessayer plus tard."}
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <View className="flex-1">
            <Stack screenOptions={{ headerShown: false }} />

            <Toast />

            {showCustomSplash && (
              <CustomSplash
                onFinish={() => setShowCustomSplash(false)}
                // Option : passer firebaseReady si tu veux conditionner l'animation
              />
            )}
          </View>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
