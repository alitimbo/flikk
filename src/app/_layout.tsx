import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import { registerGlobals } from "@livekit/react-native";
import "../global.css";
import "../i18n";
import { useAppTheme } from "@/hooks/use-app-theme";
import { FirebaseService } from "@/services/firebase/firebase-service";
import { CustomSplash } from "@/components/features/custom-splash";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

registerGlobals();

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    "Inter-Variable": require("@/assets/fonts/Inter-VariableFont_opsz,wght.ttf"),
    "Syne-Variable": require("@/assets/fonts/Syne-VariableFont_wght.ttf"),
  });

  useAppTheme();
  useEffect(() => {
    void FirebaseService.init();
  }, []);
  useEffect(() => {
    void SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View className="flex-1">
          <Stack screenOptions={{ headerShown: false }} />
          {showSplash && <CustomSplash onFinish={() => setShowSplash(false)} />}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
