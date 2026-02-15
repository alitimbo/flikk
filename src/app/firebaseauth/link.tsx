import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function FirebasePhoneAuthRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log("[Firebase Redirect] Params:", params);
    router.replace("/(tabs)/profil");
  }, [router, params]);

  return (
    <View className="flex-1 items-center justify-center bg-flikk-dark">
      <ActivityIndicator size="large" color="#CCFF00" />
      <Text className="mt-4 text-flikk-text">Verification en cours...</Text>
    </View>
  );
}
