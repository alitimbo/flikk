import { View, Text, Pressable, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { OnboardingShell } from "@/components/features/onboarding-shell";
import { OnboardingSwipe } from "@/components/features/onboarding-swipe";

const IMAGE_URL =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80";

export default function EngageScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <OnboardingShell backgroundClassName="bg-flikk-dark">
      <OnboardingSwipe
        onSwipeLeft={() => {}}
        onSwipeRight={() => router.push("/onboarding/value")}
      >
        <View className="flex-1 overflow-hidden rounded-3xl">
        <ImageBackground
          source={{ uri: IMAGE_URL }}
          resizeMode="cover"
          className="absolute inset-0"
        />
        <View className="absolute inset-0 bg-black/55" />

        <View className="flex-1 justify-between px-6 py-10">
          <View className="items-center">
            <Text className="font-display text-4xl text-flikk-text text-center">
              {t("onboarding.engageTitle")}
            </Text>
          </View>

          <View className="gap-6">
            <Text className="font-body text-base text-flikk-text-muted text-center">
              {t("onboarding.engageBody")}
            </Text>
            <Pressable
              onPress={() => router.replace("/feed")}
              className="mx-auto w-full rounded-full bg-flikk-lime py-4"
            >
              <Text className="text-center font-display text-base text-black">
                {t("onboarding.start")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      </OnboardingSwipe>
    </OnboardingShell>
  );
}
