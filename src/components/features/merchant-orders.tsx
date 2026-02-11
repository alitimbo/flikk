import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  Text,
  View,
  Pressable,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { getAuth } from "@react-native-firebase/auth";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMerchantOrders } from "@/hooks/useMerchantOrders";
import type { Order } from "@/types";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useUserProfile } from "@/hooks/useUserProfile";

export function MerchantOrdersScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const authUser = getAuth().currentUser;
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(
    authUser?.uid,
  );
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error,
  } = useMerchantOrders(authUser?.uid);

  const orders = useMemo(
    () => data?.pages.flatMap((page) => page.orders) ?? [],
    [data],
  );

  if (isError && error) {
    console.log("[MerchantOrders] Firestore error:", error);
  }

  if (!authUser) {
    return (
      <View
        className="flex-1 items-center justify-center bg-flikk-dark px-6"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-center font-display text-lg text-flikk-text">
          {t("orders.auth")}
        </Text>
      </View>
    );
  }

  if (isProfileLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-flikk-dark">
        <ActivityIndicator color="#CCFF00" />
      </View>
    );
  }

  if (!userProfile?.isMerchant) {
    return (
      <View
        className="flex-1 items-center justify-center bg-flikk-dark px-6"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-center font-display text-lg text-flikk-text">
          {t("orders.merchantOnly")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
      <View className="px-6 py-4 flex-row items-center">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text className="ml-3 font-display text-xl text-flikk-text">
          {t("orders.merchantTitle")}
        </Text>
      </View>

      <View className="px-6 pb-4 pt-0">
        <Text className="mt-1 text-sm text-flikk-text-muted">
          {t("orders.merchantSubtitle")}
        </Text>
      </View>

      {isLoading ? (
        <View className="px-6">
          <MerchantOrdersSkeleton />
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm text-flikk-text-muted">
            {t("orders.empty")}
          </Text>
        </View>
      ) : (
        <FlashList
          data={orders}
          renderItem={({ item }) => (
            <MerchantOrderCard
              order={item}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/profil/orders/details",
                  params: { id: item.orderId },
                })
              }
            />
          )}
          keyExtractor={(item) => item.orderId}
          estimatedItemSize={96}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor="#CCFF00"
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#CCFF00" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function MerchantOrderCard({
  order,
  onPress,
}: {
  order: Order;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const status = order.status || order.paymentStatus || "pending";
  const statusLabel =
    status === "paid"
      ? t("orders.statusPaid")
      : status === "delivered" || status === "shipped" || status === "shipping"
        ? t("orders.statusDelivered")
      : status === "failed"
        ? t("orders.statusFailed")
      : t("orders.statusPending");

  return (
    <Pressable
      onPress={onPress}
      className="mb-4 flex-row items-center rounded-2xl border border-white/10 bg-flikk-card p-4"
    >
      <View className="h-16 w-16 overflow-hidden rounded-xl bg-white/5">
        {order.productImageUrl ? (
          <Image
            source={{ uri: order.productImageUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View className="ml-4 flex-1">
        <Text className="font-display text-base text-flikk-text" numberOfLines={1}>
          {order.productName || t("orders.unknown")}
        </Text>
        <Text className="mt-1 text-sm text-flikk-lime">
          {(order.amount ?? 0).toLocaleString()} {order.currency ?? "XOF"}
        </Text>
        <Text className="mt-1 text-xs text-flikk-text-muted" numberOfLines={1}>
          {order.customerName || "-"}
        </Text>
        <Text className="mt-1 text-xs text-flikk-text-muted" numberOfLines={1}>
          {t("orders.orderNumber")}: {order.orderNumber || "-"}
        </Text>
      </View>
      <View className="rounded-full bg-flikk-lime/15 px-3 py-1">
        <Text className="text-[10px] font-semibold text-flikk-lime">
          {statusLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function MerchantOrdersSkeleton() {
  return (
    <View className="gap-4">
      {[0, 1, 2].map((item) => (
        <View
          key={item}
          className="flex-row items-center rounded-2xl border border-white/10 bg-flikk-card p-4"
        >
          <SkeletonBlock height={64} width={64} radius={12} />
          <View className="ml-4 flex-1 gap-2">
            <SkeletonBlock height={14} width="70%" radius={6} />
            <SkeletonBlock height={12} width="40%" radius={6} />
            <SkeletonBlock height={10} width="55%" radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}
