import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function FirebasePhoneAuthRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log("[Firebase Redirect] Params:", params); // ← utile pour debug

    // Redirige vers ton écran où l'utilisateur entre le code SMS
    // Ou vers la page profil/login si tu veux être safe
    router.replace("/profil"); // ← ou '/(auth)/verify' / '/' / ton chemin login réel

    // Alternative : si tu veux garder l'utilisateur sur la même page
    // router.back();  // mais replace est plus fiable
  }, [router, params]);

  // Pendant la milli-seconde de redirect, affiche un loader ou rien
  return (
    <View className="flex-1 items-center justify-center bg-flikk-dark">
      <ActivityIndicator size="large" color="#CCFF00" />
      <Text className="mt-4 text-flikk-text">Vérification en cours...</Text>
    </View>
  );
}
