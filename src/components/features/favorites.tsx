import { useMemo } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from "@react-native-firebase/auth";
import { useRouter } from "expo-router";
import { useFavoritePublications } from "@/hooks/useFavoritePublications";
import { Publication } from "@/types";
import { SkeletonGridCard } from "@/components/ui/Skeleton";

export function Favorites() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = getAuth().currentUser?.uid;
  const { publications, isLoading, refetch, isRefetching } =
    useFavoritePublications(uid);

  const Header = (
    <View className="px-6 py-4 flex-row items-center">
      <Pressable onPress={() => router.back()} className="p-1">
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </Pressable>
      <Text className="ml-3 font-display text-xl text-flikk-text">
        {t("favorites.title")}
      </Text>
    </View>
  );

  const isSkeleton = isLoading && publications.length === 0;
  const skeletonData = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, index) => ({
        id: `skeleton-${index}`,
      })),
    [],
  );

  const renderItem = useMemo(
    () => ({ item }: { item: Publication }) => (
      <Pressable
        className="flex-1 p-2"
        onPress={() =>
          router.push({
            pathname: "/(tabs)/home",
            params: { focusId: item.id, ts: Date.now().toString() },
          })
        }
      >
        <View className="overflow-hidden rounded-2xl bg-flikk-card border border-white/10">
          <View className="aspect-square w-full bg-black/30">
            <Image
              source={{ uri: item.imageUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          </View>
          <View className="p-3">
            <Text
              className="text-flikk-text font-display text-sm"
              numberOfLines={1}
            >
              {item.productName}
            </Text>
            <Text className="text-flikk-lime font-medium text-sm mt-1">
              {item.price.toLocaleString()} FCFA
            </Text>
          </View>
        </View>
      </Pressable>
    ),
    [router],
  );

  if (!uid) {
    return (
      <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
        {Header}
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-flikk-card p-6">
            <Text className="font-display text-lg text-flikk-text">
              {t("favorites.auth")}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
      {Header}
      <FlashList
        data={isSkeleton ? skeletonData : publications}
        renderItem={({ item }) =>
          isSkeleton ? (
            <SkeletonGridCard />
          ) : (
            renderItem({ item: item as Publication })
          )
        }
        keyExtractor={(item: Publication | { id: string }) => item.id!}
        numColumns={2}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
        estimatedItemSize={240}
        ListEmptyComponent={
          !isSkeleton ? (
            <View className="items-center justify-center py-12">
              <Text className="text-flikk-text-muted">
                {t("favorites.empty")}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
