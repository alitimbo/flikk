import { useState } from "react";
import { Pressable, View, Text, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { OnboardingShell } from "@/components/features/onboarding-shell";
import { OnboardingSwipe } from "@/components/features/onboarding-swipe";
import { setLanguage } from "@/i18n";

const LANGS = [
  { code: "fr", label: "Francais" },
  { code: "en", label: "English" },
] as const;

const BG_IMAGE =
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80";

export default function LanguageScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<"fr" | "en">(
    i18n.language === "en" ? "en" : "fr",
  );

  const onContinue = () => {
    void setLanguage(selected);
    router.push("/onboarding/value");
  };

  return (
    <OnboardingShell backgroundClassName="bg-[#2B2B2B]">
      <OnboardingSwipe
        onSwipeLeft={() => router.push("/onboarding/value")}
        onSwipeRight={() => {}}
      >
        <View className="flex-1 overflow-hidden rounded-3xl">
        <ImageBackground
          source={{ uri: BG_IMAGE }}
          resizeMode="cover"
          className="absolute inset-0"
        />
        <View className="absolute inset-0 bg-black/55" />

        <View className="flex-1 items-center justify-between py-10">
          <View className="items-center gap-6">
            <Image
              source={require("@/assets/images/splash-icon.png")}
              contentFit="contain"
              className="h-12 w-12"
              width={200}
              height={200}
            />
            <View className="items-center gap-3">
              <Text className="font-display text-2xl text-flikk-text">
                {t("onboarding.welcomeTitle")}
              </Text>
              <Text className="font-body text-base text-flikk-text-muted text-center">
                {t("onboarding.welcomeBody")}
              </Text>
            </View>
          </View>

          <View className="w-full gap-4 px-2">
            <View className="flex-row justify-center gap-4">
              {LANGS.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => setSelected(lang.code)}
                  className={`h-14 w-28 items-center justify-center rounded-full border ${
                    selected === lang.code
                      ? "border-flikk-lime bg-flikk-card"
                      : "border-white/20 bg-black/20"
                  }`}
                >
                  <Text className="font-display text-base text-flikk-text">
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={onContinue}
              className="mt-4 w-full rounded-full border border-white/40 py-4"
            >
              <Text className="text-center font-display text-base text-flikk-text">
                {t("onboarding.continue")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      </OnboardingSwipe>
    </OnboardingShell>
  );
}
