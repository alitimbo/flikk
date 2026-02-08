import { Tabs } from "expo-router";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ActionButtonProps = {
  onPress?: () => void;
  accessibilityLabel?: string;
};

function ActionTabButton({ onPress, accessibilityLabel }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="items-center justify-center"
      style={{ width: 72 }}
    >
      <View
        className="h-16 w-16 items-center justify-center rounded-full bg-flikk-lime"
        style={{
          transform: [{ translateY: -18 }],
          shadowColor: "#000000",
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={30} color="#121212" />
      </View>
    </Pressable>
  );
}

export default function HomeLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    backgroundColor: "#121212",
    borderTopColor: "#1E1E1E",
    borderTopWidth: 1,
    height: 72 + insets.bottom,
    paddingBottom: Math.max(12, insets.bottom),
    paddingTop: 8,
  } as const;

  return (
    <Tabs
      initialRouteName="live"
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: "#CCFF00",
        tabBarInactiveTintColor: "#B3B3B3",
        tabBarLabelStyle: {
          fontFamily: "Syne-Variable",
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="live"
        options={{
          title: t("tabs.live"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("tabs.discover"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="action"
        options={{
          title: t("tabs.action"),
          tabBarShowLabel: false,
          tabBarButton: (props) => (
            <ActionTabButton
              onPress={props.onPress}
              accessibilityLabel={t("tabs.action")}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="purchase"
        options={{
          title: t("tabs.purchases"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
