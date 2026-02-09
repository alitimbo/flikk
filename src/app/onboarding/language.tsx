import { useCallback, useState } from "react";
import { Pressable, View, Text, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { OnboardingShell } from "@/components/features/onboarding-shell";
import { OnboardingSwipe } from "@/components/features/onboarding-swipe";
import { setLanguage } from "@/i18n";
import * as WebBrowser from "expo-web-browser";

const LANGS = [
  { code: "fr", label: "Francais" },
  { code: "en", label: "English" },
] as const;

const BG_IMAGE = require("@/assets/onboarding/one.png");
const POLICY_URL = "https://belemdev.tech";

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

  const openPolicy = useCallback(async () => {
    await WebBrowser.openBrowserAsync(POLICY_URL);
  }, []);

  return (
    <OnboardingShell backgroundClassName="bg-[#2B2B2B]">
      <OnboardingSwipe
        onSwipeLeft={onContinue}
        onSwipeRight={() => {}}
        allowSwipeRight={false}
      >
        <View className="flex-1 overflow-hidden rounded-3xl">
        <ImageBackground
          source={BG_IMAGE}
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

            <View className="mt-2 flex-row items-center justify-center gap-4">
              <Pressable onPress={openPolicy}>
                <Text className="font-body text-xs text-flikk-text-muted underline">
                  {t("profile.links.privacy")}
                </Text>
              </Pressable>
              <Text className="text-xs text-flikk-text-muted">•</Text>
              <Pressable onPress={openPolicy}>
                <Text className="font-body text-xs text-flikk-text-muted underline">
                  {t("profile.links.terms")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
      </OnboardingSwipe>
    </OnboardingShell>
  );
}
