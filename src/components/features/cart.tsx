import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAuth } from "@react-native-firebase/auth";
import Toast from "react-native-toast-message";
import { useCart } from "@/hooks/useCart";
import { useUserProfile } from "@/hooks/useUserProfile";

export function CartScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = getAuth().currentUser?.uid;
  const { data: userProfile } = useUserProfile(uid);
  const {
    items,
    total,
    count,
    isLoading,
    isRefreshing,
    isCheckoutPending,
    isItemMutating,
    refetch,
    setQuantity,
    removeItem,
    checkout,
  } = useCart(uid);
  const [contactPhone, setContactPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isCheckoutDone, setIsCheckoutDone] = useState(false);
  const [lastOrderCount, setLastOrderCount] = useState(0);

  useEffect(() => {
    if (!uid) return;
    if (!contactPhone.trim()) {
      setContactPhone((userProfile?.phoneNumber ?? "").replace(/\D/g, ""));
    }
  }, [uid, userProfile?.phoneNumber, contactPhone]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.merchantId || "unknown";
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }
    return Array.from(map.entries()).map(([merchantId, merchantItems]) => ({
      merchantId,
      merchantName:
        merchantItems.find((i) => i.merchantName)?.merchantName ||
        t("cart.unknownMerchant"),
      items: merchantItems,
    }));
  }, [items, t]);

  const unavailableCount = useMemo(
    () => items.filter((item) => item.isUnavailable).length,
    [items],
  );

  const hasCheckoutItems = useMemo(
    () => items.some((item) => !item.isUnavailable),
    [items],
  );

  const handleCheckout = async () => {
    if (!uid) {
      router.push("/(tabs)/profil");
      return;
    }
    const msisdn = contactPhone.replace(/\D/g, "");
    if (msisdn.length < 8) {
      setPhoneError(t("payment.phoneInvalid"));
      return;
    }
    setPhoneError(null);

    try {
      const result = await checkout({
        userProfile: userProfile ?? null,
        phoneNumber: msisdn,
      });
      setLastOrderCount(result.orderIds.length);
      setIsCheckoutDone(true);
      Toast.show({
        type: "success",
        position: "top",
        text1: t("cart.checkoutSuccessTitle"),
        text2: t("cart.checkoutSuccessBody", { count: result.orderIds.length }),
        visibilityTime: 2200,
        topOffset: 52,
      });
    } catch {
      Toast.show({
        type: "error",
        position: "top",
        text1: t("cart.checkoutErrorTitle"),
        text2: t("cart.checkoutErrorBody"),
        visibilityTime: 2200,
        topOffset: 52,
      });
    }
  };

  const handleQuantityChange = (publicationId: string, nextQuantity: number) => {
    Keyboard.dismiss();
    void setQuantity({
      publicationId,
      quantity: Math.max(1, nextQuantity),
    });
  };

  if (!uid) {
    return (
      <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
        <Header title={t("cart.title")} onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-display text-lg text-flikk-text">
            {t("cart.auth")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
      <Header title={t("cart.title")} onBack={() => router.replace("/(tabs)/purchase")} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#CCFF00" />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-flikk-text-muted">
            {t("cart.empty")}
          </Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 190 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refetch()}
              tintColor="#CCFF00"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {grouped.map((group) => (
            <View key={group.merchantId} className="mb-5">
              <Text className="mb-2 px-2 text-xs text-flikk-text-muted">
                {group.merchantName}
              </Text>
              <View className="gap-3">
                {group.items.map((item) => (
                  <View
                    key={item.publicationId}
                    className="rounded-2xl border border-white/10 bg-flikk-card p-3"
                  >
                    <View className="flex-row items-center">
                      <View className="h-16 w-16 overflow-hidden rounded-xl bg-black/30">
                        <Image
                          source={{ uri: item.liveImageUrl || item.imageUrl }}
                          className="h-full w-full"
                          resizeMode="cover"
                        />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text
                          numberOfLines={1}
                          className="font-display text-sm text-flikk-text"
                        >
                          {item.liveProductName || item.productName}
                        </Text>
                        <Text className="mt-1 text-sm text-flikk-lime">
                          {item.livePrice.toLocaleString()} {item.currency || "XOF"}
                        </Text>
                        {item.isPriceChanged ? (
                          <Text className="mt-1 text-[11px] text-flikk-text-muted line-through">
                            {(item.priceAtAdd ?? 0).toLocaleString()} {item.currency || "XOF"}
                          </Text>
                        ) : null}
                        {item.isUnavailable ? (
                          <Text className="mt-1 text-[11px] text-[#FF6B6B]">
                            {t("cart.unavailable")}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                      <View className="flex-row items-center rounded-full border border-white/10 bg-black/30 px-1 py-1">
                        <Pressable
                          className="h-8 w-8 items-center justify-center"
                          onPressIn={() =>
                            handleQuantityChange(item.publicationId, item.quantity - 1)
                          }
                          disabled={isItemMutating || item.isUnavailable}
                        >
                          <Ionicons name="remove" size={16} color="#FFFFFF" />
                        </Pressable>
                        <Text className="mx-2 min-w-6 text-center text-sm text-flikk-text">
                          {Math.max(1, item.quantity)}
                        </Text>
                        <Pressable
                          className="h-8 w-8 items-center justify-center"
                          onPressIn={() =>
                            handleQuantityChange(item.publicationId, item.quantity + 1)
                          }
                          disabled={isItemMutating || item.isUnavailable}
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </Pressable>
                      </View>

                      <Pressable
                        className="h-9 items-center justify-center rounded-full bg-white/10 px-4"
                        onPress={() => void removeItem(item.publicationId)}
                        disabled={isItemMutating}
                      >
                        <Text className="text-xs text-flikk-text-muted">
                          {t("cart.remove")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {items.length > 0 ? (
        <View
          className="absolute inset-x-0 border-t border-white/10 bg-flikk-card px-4 pt-4"
          style={{ bottom: 0, paddingBottom: insets.bottom + 12 }}
        >
          <Text className="mb-2 text-xs text-flikk-text-muted">
            {t("payment.contactPhoneLabel")}
          </Text>
          <TextInput
            className="h-12 rounded-2xl border border-white/10 bg-flikk-dark px-4 text-flikk-text"
            placeholder={t("payment.contactPhonePlaceholder")}
            placeholderTextColor="#666666"
            keyboardType="phone-pad"
            value={contactPhone}
            onChangeText={(value) => {
              setContactPhone(value);
              if (phoneError) setPhoneError(null);
            }}
            selectionColor="#CCFF00"
          />
          {phoneError ? (
            <Text className="mt-2 text-xs text-[#FF4D6D]">{phoneError}</Text>
          ) : null}
          {unavailableCount > 0 ? (
            <Text className="mt-2 text-xs text-flikk-text-muted">
              {t("cart.unavailableCount", { count: unavailableCount })}
            </Text>
          ) : null}

          <View className="mt-3 flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-flikk-text-muted">
                {t("cart.totalItems", { count })}
              </Text>
              <Text className="mt-1 font-display text-base text-flikk-lime">
                {total.toLocaleString()} XOF
              </Text>
            </View>
            <Pressable
              className={`h-12 rounded-full bg-flikk-lime px-6 items-center justify-center ${
                !hasCheckoutItems || isCheckoutPending ? "opacity-50" : "active:scale-[0.98]"
              }`}
              disabled={!hasCheckoutItems || isCheckoutPending}
              onPress={() => void handleCheckout()}
            >
              {isCheckoutPending ? (
                <ActivityIndicator color="#121212" />
              ) : (
                <Text className="font-display text-sm text-flikk-dark">
                  {t("cart.checkout")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {isCheckoutDone ? (
        <View className="absolute inset-0 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-[360px] rounded-3xl border border-white/10 bg-flikk-card p-6">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-flikk-lime/10">
              <Ionicons name="checkmark-circle" size={24} color="#CCFF00" />
            </View>
            <Text className="font-display text-lg text-flikk-text">
              {t("cart.checkoutSuccessTitle")}
            </Text>
            <Text className="mt-2 text-sm text-flikk-text-muted">
              {t("cart.checkoutSuccessBody", { count: lastOrderCount })}
            </Text>
            <Pressable
              className="mt-6 h-12 items-center justify-center rounded-full bg-flikk-lime"
              onPress={() => {
                setIsCheckoutDone(false);
                router.replace("/(tabs)/purchase");
              }}
            >
              <Text className="font-display text-sm text-flikk-dark">
                {t("cart.goToOrders")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="px-6 py-4 flex-row items-center">
      <Pressable onPress={onBack} className="p-1">
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </Pressable>
      <Text className="ml-3 font-display text-xl text-flikk-text">{title}</Text>
    </View>
  );
}
