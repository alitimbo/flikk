import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getAuth } from "@react-native-firebase/auth";
import { useOrderById } from "@/hooks/useOrderById";
import { resolveOrderStatus } from "@/utils/order-status";

export default function PurchaseDetailsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const authUser = getAuth().currentUser;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrderById(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-flikk-dark">
        <Text className="text-sm text-flikk-text-muted">
          {t("orders.loading")}
        </Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-flikk-dark px-6">
        <Text className="text-sm text-flikk-text-muted">
          {t("orders.notFound")}
        </Text>
      </View>
    );
  }

  const status = resolveOrderStatus(order);
  const statusLabel =
    status === "paid"
      ? t("orders.statusPaid")
      : status === "delivered" || status === "shipped" || status === "shipping"
        ? t("orders.statusDelivered")
      : status === "failed"
        ? t("orders.statusFailed")
        : t("orders.statusPending");

  const isMerchantViewer =
    !!authUser?.uid &&
    !!order.merchantId &&
    authUser.uid === order.merchantId &&
    authUser.uid !== order.customerId;

  return (
    <View
      className="flex-1 bg-flikk-dark"
      style={{ paddingTop: insets.top }}
    >
      <View className="px-6 py-4 flex-row items-center">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text className="ml-3 font-display text-xl text-flikk-text">
          {t("orders.detailsTitle")}
        </Text>
      </View>

      <View className="mx-6 rounded-3xl border border-white/10 bg-flikk-card p-5">
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 overflow-hidden rounded-xl bg-white/5">
            {order.productImageUrl ? (
              <Image
                source={{ uri: order.productImageUrl }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : null}
          </View>
          <View className="flex-1">
            <Text className="font-display text-base text-flikk-text" numberOfLines={1}>
              {order.productName || t("orders.unknown")}
            </Text>
            <Text className="mt-1 text-sm text-flikk-lime">
              {(order.amount ?? 0).toLocaleString()} {order.currency ?? "XOF"}
            </Text>
            <Text className="mt-1 text-xs text-flikk-text-muted" numberOfLines={1}>
              {order.merchantName || ""}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
          <Text className="text-sm text-flikk-text-muted">
            {t("orders.statusLabel")}
          </Text>
          <Text className="text-sm text-flikk-lime">{statusLabel}</Text>
        </View>
      </View>

      <View className="mx-6 mt-6 gap-3">
        <DetailRow label={t("orders.orderNumber")} value={order.orderNumber ?? "-"} />
        <DetailRow label={t("orders.detailReference")} value={order.paymentReference} />
        <DetailRow label={t("orders.detailExternal")} value={order.externalReference ?? "-"} />
        <DetailRow label={t("orders.detailCustomer")} value={order.customerName ?? "-"} />
        {!isMerchantViewer ? (
          <DetailRow label={t("orders.detailPhone")} value={order.msisdn ?? "-"} />
        ) : null}
        <DetailRow label={t("orders.detailMerchant")} value={order.merchantName ?? "-"} />
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start rounded-2xl border border-white/10 bg-flikk-card px-4 py-3">
      <Text className="w-28 text-xs text-flikk-text-muted">{label}</Text>
      <Text className="ml-3 flex-1 text-xs text-flikk-text">
        {value}
      </Text>
    </View>
  );
}
