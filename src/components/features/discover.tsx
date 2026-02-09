import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDiscover } from "@/hooks/useDiscover";
import { Publication } from "@/types";
import { SkeletonGridCard } from "@/components/ui/Skeleton";

export function Discover() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const router = useRouter();
  const debouncedSearch = useDebouncedValue(search, 300);
  const {
    publications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useDiscover(debouncedSearch);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Publication }) => {
      return (
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
      );
    },
    [router],
  );

  const keyExtractor = useCallback((item: Publication) => item.id!, []);

  const listEmpty = useMemo(
    () => (
      <View className="items-center justify-center py-10">
        <Text className="text-flikk-text-muted font-body text-sm">
          {t("discover.empty")}
        </Text>
      </View>
    ),
    [t],
  );

  const isSkeleton = isLoading && publications.length === 0;
  const skeletonData = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, index) => ({
        id: `skeleton-${index}`,
      })),
    [],
  );

  return (
    <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top + 12 }}>
      <View className="px-5 pb-4">
        <Text className="font-display text-2xl text-flikk-text">
          {t("tabs.discover")}
        </Text>
        <View className="mt-4 flex-row items-center rounded-2xl border border-white/10 bg-flikk-card px-3">
          <Ionicons name="search-outline" size={18} color="#B3B3B3" />
          <TextInput
            className="flex-1 px-2 py-3 font-body text-base text-flikk-text"
            placeholder={t("discover.searchPlaceholder")}
            placeholderTextColor="#666666"
            value={search}
            onChangeText={(text) => setSearch(text.toLowerCase())}
            returnKeyType="search"
            selectionColor="#CCFF00"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")} className="p-2">
              <Ionicons name="close" size={18} color="#B3B3B3" />
            </Pressable>
          )}
        </View>
      </View>

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
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshing={isRefetching && !isFetchingNextPage}
        onRefresh={() => void refetch()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
        estimatedItemSize={240}
        ListEmptyComponent={!isLoading ? listEmpty : null}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="px-2 pb-6">
              <View className="flex-row">
                <SkeletonGridCard />
                <SkeletonGridCard />
              </View>
            </View>
          ) : null
        }
      />
    </View>
  );
}
