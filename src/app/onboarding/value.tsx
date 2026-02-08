import { View, Text, Pressable, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { OnboardingShell } from "@/components/features/onboarding-shell";
import { OnboardingSwipe } from "@/components/features/onboarding-swipe";

const IMAGE_URL =
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80";

export default function ValueScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <OnboardingShell backgroundClassName="bg-flikk-dark">
      <OnboardingSwipe
        onSwipeLeft={() => router.push("/onboarding/engage")}
        onSwipeRight={() => router.push("/onboarding/language")}
      >
        <View className="flex-1 overflow-hidden rounded-3xl bg-black/40">
        <ImageBackground
          source={{ uri: IMAGE_URL }}
          resizeMode="cover"
          className="absolute inset-0"
        />
        <View className="absolute inset-0 bg-black/45" />

        <View className="flex-1 justify-between px-6 py-10">
          <View className="items-center">
            <Text className="font-display text-4xl text-flikk-text text-center">
              {t("onboarding.valueTitle")}
            </Text>
          </View>

          <View className="gap-6">
            <Text className="font-body text-base text-flikk-text-muted text-center">
              {t("onboarding.valueBody")}
            </Text>
            <Pressable
              onPress={() => router.push("/onboarding/engage")}
              className="mx-auto w-full rounded-full bg-flikk-purple py-4"
            >
              <Text className="text-center font-display text-base text-black">
                {t("onboarding.next")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      </OnboardingSwipe>
    </OnboardingShell>
  );
}
