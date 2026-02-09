import { Redirect } from "expo-router";
import { MMKVStorage } from "@/storage/mmkv";

const ONBOARDING_KEY = "flikk:onboarding:seen";

export default function HomeScreen() {
  const hasSeenOnboarding = MMKVStorage.getItem(ONBOARDING_KEY) === "1";
  return (
    <Redirect href={hasSeenOnboarding ? "/(tabs)/home" : "/onboarding/language"} />
  );
}
