import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from "@react-native-firebase/auth";
import { useRouter } from "expo-router";
import { ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Publication } from "@/types";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMerchantPublications } from "@/hooks/useMerchantPublications";
import { PublicationService } from "@/services/firebase/publication-service";
import { SkeletonBlock } from "@/components/ui/Skeleton";

type EditFormState = {
  id: string;
  productName: string;
  title: string;
  price: string;
  hashtags: string;
};

export function MerchantPublications() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const uid = getAuth().currentUser?.uid;
  const { data: profile, isLoading: isProfileLoading } = useUserProfile(uid);
  const { publications, isLoading } = useMerchantPublications(uid);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canManage = !!profile?.isMerchant;
  const isSkeleton = isLoading && publications.length === 0;

  const openEdit = useCallback((pub: Publication) => {
    setEditForm({
      id: pub.id!,
      productName: pub.productName,
      title: pub.title,
      price: String(pub.price ?? ""),
      hashtags: pub.hashtags?.join(" ") ?? "",
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editForm) return;
    const priceValue = parseInt(editForm.price, 10);
    if (!editForm.productName || !editForm.title || !priceValue) return;

    setIsSaving(true);
    try {
      await PublicationService.updatePublication(editForm.id, {
        productName: editForm.productName.trim(),
        title: editForm.title.trim(),
        price: priceValue,
        hashtags: editForm.hashtags
          .split(" ")
          .filter((h) => h.startsWith("#"))
          .map((h) => h.trim()),
      });
      await queryClient.invalidateQueries({
        queryKey: ["merchantPublications", uid],
      });
      setEditForm(null);
    } finally {
      setIsSaving(false);
    }
  }, [editForm, queryClient, uid]);

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    setIsSaving(true);
    try {
      await PublicationService.deletePublication(deleteId);
      await queryClient.invalidateQueries({
        queryKey: ["merchantPublications", uid],
      });
      setDeleteId(null);
    } finally {
      setIsSaving(false);
    }
  }, [deleteId, queryClient, uid]);

  const renderItem = useCallback(
    ({ item }: { item: Publication }) => (
      <View className="px-4 py-3">
        <View className="flex-row items-center rounded-2xl border border-white/10 bg-flikk-card p-3">
          <View className="h-16 w-16 overflow-hidden rounded-xl bg-white/5">
            <Image
              source={{ uri: item.imageUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-flikk-text font-display text-base" numberOfLines={1}>
              {item.productName}
            </Text>
            <Text className="text-flikk-text-muted text-xs mt-1" numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="text-flikk-lime font-medium mt-1">
              {item.price.toLocaleString()} FCFA
            </Text>
          </View>
          <View className="items-end gap-2">
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full bg-white/10"
              onPress={() => openEdit(item)}
            >
              <Ionicons name="create-outline" size={18} color="#CCFF00" />
            </Pressable>
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full bg-white/10"
              onPress={() => setDeleteId(item.id!)}
            >
              <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
            </Pressable>
          </View>
        </View>
      </View>
    ),
    [openEdit],
  );

  const Header = (
    <View className="px-6 py-4 flex-row items-center">
      <Pressable onPress={() => router.back()} className="p-1">
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </Pressable>
      <Text className="ml-3 font-display text-xl text-flikk-text">
        {t("merchantPublications.title")}
      </Text>
    </View>
  );

  if (!uid) {
    return (
      <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
        {Header}
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-flikk-card p-6">
            <Text className="font-display text-lg text-flikk-text">
              {t("merchantPublications.auth")}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (!isProfileLoading && !canManage) {
    return (
      <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
        {Header}
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-flikk-card p-6">
            <Text className="font-display text-lg text-flikk-text">
              {t("merchantPublications.notMerchant")}
            </Text>
            <Text className="mt-2 text-sm text-flikk-text-muted">
              {t("action.merchantGate.subtitle")}
            </Text>
            <Pressable
              className="mt-6 h-12 items-center justify-center rounded-full bg-flikk-lime"
              onPress={() => router.push("/(tabs)/profil")}
            >
              <Text className="font-display text-base text-flikk-dark">
                {t("action.merchantGate.cta")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
      {Header}

      {isSkeleton ? (
        <View className="px-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={`sk-${index}`} className="py-3">
              <View className="flex-row items-center rounded-2xl border border-white/10 bg-flikk-card p-3">
                <SkeletonBlock height={64} width={64} radius={12} />
                <View className="ml-3 flex-1 gap-2">
                  <SkeletonBlock height={14} width="80%" radius={8} />
                  <SkeletonBlock height={12} width="60%" radius={8} />
                  <SkeletonBlock height={12} width="40%" radius={8} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          data={publications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id!}
          estimatedItemSize={96}
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <Text className="text-flikk-text-muted">
                {t("merchantPublications.empty")}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!editForm}
        transparent
        animationType="fade"
        onRequestClose={() => setEditForm(null)}
      >
        <Pressable className="flex-1 bg-black/60" onPress={() => setEditForm(null)} />
        <View className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-flikk-card p-6">
          <Text className="font-display text-lg text-flikk-text">
            {t("merchantPublications.editTitle")}
          </Text>

          <View className="mt-4 gap-3">
            <TextInput
              className="h-12 w-full rounded-2xl border border-white/10 bg-flikk-dark px-4 text-flikk-text"
              placeholder={t("merchantPublications.productName")}
              placeholderTextColor="#666666"
              value={editForm?.productName ?? ""}
              onChangeText={(value) =>
                setEditForm((prev) => (prev ? { ...prev, productName: value } : prev))
              }
            />
            <TextInput
              className="h-12 w-full rounded-2xl border border-white/10 bg-flikk-dark px-4 text-flikk-text"
              placeholder={t("merchantPublications.publicationTitle")}
              placeholderTextColor="#666666"
              value={editForm?.title ?? ""}
              onChangeText={(value) =>
                setEditForm((prev) => (prev ? { ...prev, title: value } : prev))
              }
            />
            <TextInput
              className="h-12 w-full rounded-2xl border border-white/10 bg-flikk-dark px-4 text-flikk-text"
              placeholder={t("merchantPublications.price")}
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={editForm?.price ?? ""}
              onChangeText={(value) =>
                setEditForm((prev) => (prev ? { ...prev, price: value } : prev))
              }
            />
            <TextInput
              className="h-12 w-full rounded-2xl border border-white/10 bg-flikk-dark px-4 text-flikk-text"
              placeholder={t("merchantPublications.hashtags")}
              placeholderTextColor="#666666"
              value={editForm?.hashtags ?? ""}
              onChangeText={(value) =>
                setEditForm((prev) => (prev ? { ...prev, hashtags: value } : prev))
              }
            />
          </View>

          <Pressable
            className={`mt-6 h-12 items-center justify-center rounded-full bg-flikk-lime ${
              isSaving ? "opacity-70" : "active:scale-[0.98]"
            }`}
            onPress={saveEdit}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#121212" />
            ) : (
              <Text className="font-display text-base text-flikk-dark">
                {t("merchantPublications.save")}
              </Text>
            )}
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={!!deleteId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteId(null)}
      >
        <Pressable className="flex-1 bg-black/60" onPress={() => setDeleteId(null)} />
        <View className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-flikk-card p-6">
          <Text className="font-display text-lg text-flikk-text">
            {t("merchantPublications.deleteTitle")}
          </Text>
          <Text className="mt-2 text-sm text-flikk-text-muted">
            {t("merchantPublications.deleteSubtitle")}
          </Text>

          <View className="mt-6 flex-row gap-3">
            <Pressable
              className="flex-1 h-12 items-center justify-center rounded-full bg-white/10"
              onPress={() => setDeleteId(null)}
              disabled={isSaving}
            >
              <Text className="font-display text-sm text-flikk-text">
                {t("merchantPublications.cancel")}
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 h-12 items-center justify-center rounded-full bg-[#FF4D6D]"
              onPress={confirmDelete}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-display text-sm text-white">
                  {t("merchantPublications.delete")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
