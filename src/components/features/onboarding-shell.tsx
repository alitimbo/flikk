import { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";

type OnboardingShellProps = {
  children: ReactNode;
  backgroundClassName?: string;
};

export function OnboardingShell({
  children,
  backgroundClassName = "bg-flikk-dark",
}: OnboardingShellProps) {
  return (
    <SafeAreaView className={`flex-1 ${backgroundClassName}`}>
      <View className="flex-1 px-6">{children}</View>
    </SafeAreaView>
  );
}
