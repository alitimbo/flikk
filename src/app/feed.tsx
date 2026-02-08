import { View, Text } from "react-native";
import { OnboardingShell } from "@/components/features/onboarding-shell";

export default function FeedScreen() {
  return (
    <OnboardingShell backgroundClassName="bg-flikk-dark">
      <View className="flex-1 items-center justify-center">
        <Text className="font-display text-2xl text-flikk-text">
          Feed
        </Text>
      </View>
    </OnboardingShell>
  );
}
