import { useMemo } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";

export function NetworkQualityBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const quality = useNetworkQuality();

  const bannerConfig = useMemo(() => {
    if (quality === "offline") {
      return {
        text: t("network.offline"),
        icon: "cloud-offline-outline" as const,
        bgClass: "bg-[#9E2A2B]",
      };
    }
    if (quality === "unstable") {
      return {
        text: t("network.unstable"),
        icon: "wifi-outline" as const,
        bgClass: "bg-[#6D5D0E]",
      };
    }
    return null;
  }, [quality, t]);

  if (!bannerConfig) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute left-4 right-4 z-[999] items-center"
      style={{ top: insets.top + 8 }}
    >
      <View
        className={`w-full max-w-[520px] rounded-2xl px-4 py-2.5 ${bannerConfig.bgClass}`}
      >
        <View className="flex-row items-center justify-center gap-2">
          <Ionicons name={bannerConfig.icon} size={15} color="#FFFFFF" />
          <Text className="text-center text-xs text-white">{bannerConfig.text}</Text>
        </View>
      </View>
    </View>
  );
}

