import { useMemo, useCallback, useEffect } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMerchantPublications } from "@/hooks/useMerchantPublications";
import { FlashList } from "@shopify/flash-list";
import { Publication } from "@/types";
import { SkeletonGridCard, SkeletonBlock } from "@/components/ui/Skeleton";
import { getAuth } from "@react-native-firebase/auth";
import { useMerchantEngagement } from "@/hooks/useMerchantEngagement";

export default function MerchantProfile() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = typeof id === "string" ? id : "";
  const { data: profile, isLoading } = useUserProfile(uid);
  const viewerId = getAuth().currentUser?.uid;
  const isOwnProfile = viewerId === uid;
  const {
    followerCount,
    orderCount,
    isFollowing,
    isLoading: isEngagementLoading,
    followerCountError,
    orderCountError,
    isFollowingError,
    toggleFollow,
    isToggling,
  } = useMerchantEngagement(uid, viewerId);
  const {
    publications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isPublicationsLoading,
  } = useMerchantPublications(uid);

  const displayName = useMemo(() => {
    if (!profile) return "";
    if (profile.merchantInfo?.businessName) {
      return profile.merchantInfo.businessName;
    }
    return [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  }, [profile]);

  useEffect(() => {
    if (followerCountError) {
      console.log("[MerchantProfile] followerCount error:", followerCountError);
    }
  }, [followerCountError]);

  useEffect(() => {
    if (orderCountError) {
      console.log("[MerchantProfile] orderCount error:", orderCountError);
    }
  }, [orderCountError]);

  useEffect(() => {
    if (isFollowingError) {
      console.log("[MerchantProfile] isFollowing error:", isFollowingError);
    }
  }, [isFollowingError]);

  if (!isLoading && (!profile || !profile.isMerchant)) {
    return (
      <View
        className="flex-1 items-center justify-center bg-flikk-dark px-6"
        style={{ paddingTop: insets.top }}
      >
        <Text className="font-display text-lg text-flikk-text">
          {t("merchant.notFound")}
        </Text>
      </View>
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: Publication }) => {
    return (
      <View className="flex-1 p-2">
        <Pressable
          className="overflow-hidden rounded-2xl bg-flikk-card border border-white/10"
          onPress={() =>
            router.push({
              pathname: "/(tabs)/home",
              params: { focusId: item.id, ts: Date.now().toString() },
            })
          }
        >
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
        </Pressable>
      </View>
    );
    },
    [router],
  );

  const isSkeleton = isPublicationsLoading && publications.length === 0;
  const skeletonData = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, index) => ({
        id: `skeleton-${index}`,
      })),
    [],
  );

  return (
    <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
      <View className="px-6 py-4 flex-row items-center">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>
        <Text className="ml-3 font-display text-xl text-flikk-text">
          {t("merchant.title")}
        </Text>
      </View>

      <View className="items-center mt-2 px-6">
        {isLoading ? (
          <>
            <SkeletonBlock height={96} width={96} radius={24} />
            <View className="mt-4">
              <SkeletonBlock height={18} width={160} radius={10} />
            </View>
            <View className="mt-4 w-full max-w-[220px]">
              <SkeletonBlock height={44} radius={999} />
            </View>
          </>
        ) : (
          <>
            <View className="h-24 w-24 rounded-3xl overflow-hidden bg-flikk-card border border-white/10">
              {profile.merchantInfo?.logoUrl ? (
                <Image
                  source={{ uri: profile.merchantInfo.logoUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="flex-1 items-center justify-center bg-flikk-card">
                  <Ionicons name="storefront" size={28} color="#CCFF00" />
                </View>
              )}
            </View>
            <Text className="mt-4 font-display text-2xl text-flikk-text">
              {displayName}
            </Text>
            <View className="mt-3 flex-row items-center gap-5">
              <View className="items-center">
                <Text className="font-display text-base text-flikk-text">
                  {followerCount}
                </Text>
                <Text className="mt-0.5 text-xs text-flikk-text-muted">
                  {t("merchant.followers")}
                </Text>
              </View>
              <View className="h-5 w-px bg-white/15" />
              <View className="items-center">
                <Text className="font-display text-base text-flikk-text">
                  {orderCount}
                </Text>
                <Text className="mt-0.5 text-xs text-flikk-text-muted">
                  {t("merchant.orders")}
                </Text>
              </View>
            </View>
            <Pressable
              className={`mt-4 h-11 w-full max-w-[220px] items-center justify-center rounded-full ${
                isOwnProfile
                  ? "bg-white/10"
                  : isFollowing
                    ? "bg-white/10"
                    : "bg-flikk-lime"
              }`}
              onPress={async () => {
                if (isOwnProfile || isToggling) return;
                if (!viewerId) {
                  router.push("/(tabs)/profil");
                  return;
                }
                try {
                  await toggleFollow();
                } catch (error) {
                  console.log("[MerchantProfile] Follow error:", error);
                }
              }}
              disabled={isOwnProfile || isToggling || isEngagementLoading}
            >
              <Text
                className={`font-display text-sm ${
                  isOwnProfile || isFollowing
                    ? "text-flikk-text"
                    : "text-flikk-dark"
                }`}
              >
                {isOwnProfile
                  ? t("merchant.self")
                  : isFollowing
                    ? t("merchant.following")
                    : t("merchant.follow")}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View className="mt-6 flex-1">
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
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
          estimatedItemSize={240}
          ListEmptyComponent={
            !isSkeleton ? (
              <View className="items-center justify-center py-10">
                <Text className="text-flikk-text-muted font-body text-sm">
                  {t("merchant.empty")}
                </Text>
              </View>
            ) : null
          }
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
    </View>
  );
}
