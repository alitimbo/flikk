import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PurchaseIndex() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-flikk-dark"
      style={{ paddingTop: insets.top }}
    >
      <Text className="font-display text-2xl text-flikk-text">
        {t("tabs.purchases")}
      </Text>
    </View>
  );
}
