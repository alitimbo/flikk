import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  View,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// On suit ton guide : types centralisés normalement, mais ici pour le fix :
interface MediaPickerProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (uri: string) => void;
  mediaTypes?: MediaLibrary.MediaTypeValue[];
}

const { width } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

export function MediaPicker({
  isVisible,
  onClose,
  onSelect,
  mediaTypes = ["photo", "video"],
}: MediaPickerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // États
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<MediaLibrary.Album | null>(
    null,
  );
  const [selectedAsset, setSelectedAsset] = useState<MediaLibrary.Asset | null>(
    null,
  );

  // Refs pour éviter la boucle infinie
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);

  // 1. Charger les albums (une seule fois au montage/permission)
  const loadAlbums = useCallback(async () => {
    if (permissionResponse?.status !== "granted") return;
    const allAlbums = await MediaLibrary.getAlbumsAsync({
      includeSmartAlbums: true,
    });
    setAlbums(allAlbums);
  }, [permissionResponse?.status]);

  // 2. Charger les assets (Logique robuste)
  const loadAssets = useCallback(
    async (refresh = false) => {
      // Si déjà en train de charger ou fini, on stoppe
      if (loadingRef.current || (!hasNextPage && !refresh)) return;

      loadingRef.current = true;
      setIsLoading(true);

      try {
        const options: MediaLibrary.AssetsOptions = {
          first: 30,
          mediaType: mediaTypes,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        };

        if (!refresh && endCursor) options.after = endCursor;
        if (selectedAlbum) options.album = selectedAlbum;

        const page = await MediaLibrary.getAssetsAsync(options);

        setAssets((prev) =>
          refresh ? page.assets : [...prev, ...page.assets],
        );
        setEndCursor(page.endCursor);
        setHasNextPage(page.hasNextPage);
      } catch (err) {
        console.error("Flikk MediaPicker Error:", err);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [endCursor, hasNextPage, selectedAlbum, mediaTypes],
  ); // isLoading retiré d'ici !

  // 3. Effet unique pour l'ouverture
  useEffect(() => {
    if (isVisible) {
      if (permissionResponse?.status !== "granted") {
        requestPermission();
      } else {
        loadAlbums();
        loadAssets(true);
      }
    } else {
      // Reset total à la fermeture
      setAssets([]);
      setEndCursor(undefined);
      setSelectedAlbum(null);
    }
  }, [
    isVisible,
    permissionResponse?.status,
    requestPermission,
    loadAlbums,
    loadAssets,
  ]);

  // 4. Effet pour le changement d'album
  useEffect(() => {
    if (isVisible && permissionResponse?.granted) {
      loadAssets(true);
    }
  }, [selectedAlbum, isVisible, permissionResponse?.granted, loadAssets]);

  const renderItem = ({ item }: { item: MediaLibrary.Asset }) => (
    <Pressable
      onPress={() => setSelectedAsset(item)}
      style={{ width: ITEM_SIZE, height: ITEM_SIZE, padding: 1 }}
    >
      <Image
        source={{ uri: item.uri }}
        style={{ width: "100%", height: "100%", borderRadius: 2 }}
      />
      {item.mediaType === "video" && (
        <View className="absolute bottom-1 right-1 bg-black/50 px-1 rounded">
          <Ionicons name="play" size={10} color="#CCFF00" />
        </View>
      )}
    </Pressable>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#121212]">
        {/* Header avec ton style Lime */}
        <View
          style={{ paddingTop: insets.top }}
          className="border-b border-white/10 pb-2"
        >
          <View className="flex-row justify-between items-center px-4 py-2">
            <Text className="text-white font-bold text-xl">Galerie</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={28} color="white" />
            </Pressable>
          </View>

          {/* Horizonal Albums */}
          <FlatList
            horizontal
            data={[{ id: "all", title: "Récents" }, ...albums]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  setSelectedAlbum(
                    item.id === "all" ? null : (item as MediaLibrary.Album),
                  )
                }
                className={`ml-4 px-4 py-1 rounded-full ${(!selectedAlbum && item.id === "all") || selectedAlbum?.id === item.id ? "bg-[#CCFF00]" : "bg-white/10"}`}
              >
                <Text
                  className={
                    (!selectedAlbum && item.id === "all") ||
                    selectedAlbum?.id === item.id
                      ? "text-black"
                      : "text-white"
                  }
                >
                  {item.title}
                </Text>
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>

        {/* Grid Media */}
        <FlatList
          data={assets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={COLUMN_COUNT}
          onEndReached={() => loadAssets()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            isLoading ? (
              <ActivityIndicator color="#CCFF00" className="my-4" />
            ) : null
          }
        />

        {selectedAsset && (
          <View className="absolute inset-0 bg-black z-50">
            {/* Custom Header for Preview */}
            <View
              style={{ paddingTop: insets.top }}
              className="absolute top-0 w-full z-10 bg-black/60"
            >
              <View className="flex-row justify-between items-center px-4 py-3">
                <Pressable
                  onPress={() => setSelectedAsset(null)}
                  className="flex-row items-center gap-2"
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                  <Text className="text-white font-medium">
                    {t("mediaPicker.cancel")}
                  </Text>
                </Pressable>

                <Text className="text-white font-bold text-lg">
                  {t("mediaPicker.preview")}
                </Text>

                <Pressable
                  onPress={() => {
                    onSelect(selectedAsset.uri);
                    onClose();
                  }}
                  className="flex-row items-center gap-1 bg-[#CCFF00] px-4 py-2 rounded-full"
                >
                  <Ionicons name="checkmark-circle" size={20} color="black" />
                  <Text className="text-black font-bold">
                    {t("mediaPicker.select")}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Image
              source={{ uri: selectedAsset.uri }}
              className="flex-1"
              resizeMode="contain"
            />
          </View>
        )}
      </View>
    </Modal>
  );
}
