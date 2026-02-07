import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-flikk-dark px-6">
      <View className="flex-1 items-center justify-center">
        <View className="w-full max-w-sm rounded-2xl bg-flikk-card p-6">
          <Text className="text-sm uppercase tracking-widest text-flikk-purple">
            {t("brand")}
          </Text>
          <Text className="mt-2 text-3xl font-semibold text-flikk-text">
            {t("heroTitle")}
          </Text>
          <Text className="mt-2 text-base text-flikk-text-muted">
            {t("heroSubtitle")}
          </Text>
          <View className="mt-6 flex-row items-center gap-3">
            <View className="h-2 flex-1 rounded-full bg-flikk-dark">
              <View className="h-2 w-2/3 rounded-full bg-flikk-lime" />
            </View>
            <Text className="text-sm text-flikk-text-muted">68%</Text>
          </View>
          <View className="mt-5 rounded-full bg-flikk-lime px-4 py-2">
            <Text className="text-center text-base font-semibold text-black">
              {t("ctaExplore")}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
