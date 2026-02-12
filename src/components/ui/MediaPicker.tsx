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
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";

interface MediaPickerProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (
    uri: string,
    type: MediaLibrary.MediaTypeValue,
    meta?: { fileSize?: number },
  ) => void;
  mediaTypes?: MediaLibrary.MediaTypeValue[];
}

const { width, height } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;
const VIDEO_ASPECT_RATIO = 9 / 16;

const DEFAULT_MEDIA_TYPES: MediaLibrary.MediaTypeValue[] = ["photo", "video"];

export function MediaPicker({
  isVisible,
  onClose,
  onSelect,
  mediaTypes = DEFAULT_MEDIA_TYPES,
}: MediaPickerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // --- ÉTATS ---
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<MediaLibrary.Album | null>(
    null,
  );
  const [selectedAsset, setSelectedAsset] = useState<MediaLibrary.Asset | null>(
    null,
  );

  // --- PAGINATION & LOCK ---
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);

  // 1. Initialiser le player
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  // 2. Correction avec replaceAsync
  useEffect(() => {
    let isMounted = true;

    const updateSource = async () => {
      if (selectedAsset?.mediaType === "video") {
        try {
          // replaceAsync ne bloque pas le thread principal (main thread)
          await player.replaceAsync(selectedAsset.uri);
          if (isMounted) player.play();
        } catch (e) {
          console.error("Flikk Video Error:", e);
        }
      } else {
        player.pause();
      }
    };

    updateSource();

    return () => {
      isMounted = false;
    };
  }, [selectedAsset, player]);

  // --- LOGIQUE DE CHARGEMENT ---
  const loadAlbums = useCallback(async () => {
    if (permissionResponse?.status !== "granted") return;
    try {
      const allAlbums = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: true,
      });
      setAlbums(allAlbums);
    } catch (err) {
      console.error("Flikk Error [loadAlbums]:", err);
    }
  }, [permissionResponse?.status]);

  const loadAssets = useCallback(
    async (refresh = false) => {
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
        console.error("Flikk Error [loadAssets]:", err);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [endCursor, hasNextPage, selectedAlbum, mediaTypes],
  );

  // Cycle de vie de la modale
  useEffect(() => {
    if (isVisible) {
      if (permissionResponse?.status !== "granted") {
        requestPermission();
      } else {
        loadAlbums();
        loadAssets(true);
      }
    } else {
      // Nettoyage strict à la fermeture
      setAssets([]);
      setEndCursor(undefined);
      setSelectedAlbum(null);
      setSelectedAsset(null);
      setHasNextPage(true);
    }
  }, [
    isVisible,
    permissionResponse?.status,
    loadAlbums,
    loadAssets,
    requestPermission,
  ]);

  // Trigger reload quand l'album change
  useEffect(() => {
    if (isVisible && permissionResponse?.granted) {
      loadAssets(true);
    }
  }, [selectedAlbum, isVisible, permissionResponse?.granted, loadAssets]);

  const renderItem = ({ item }: { item: MediaLibrary.Asset }) => (
    <Pressable
      onPress={() => setSelectedAsset(item)}
      style={{ width: ITEM_SIZE, height: ITEM_SIZE, padding: 1 }}
      className="active:opacity-70"
    >
      <Image
        source={{ uri: item.uri }}
        style={{ width: "100%", height: "100%", borderRadius: 4 }}
        resizeMode="cover"
      />
      {item.mediaType === "video" && (
        <View className="absolute bottom-2 right-2 bg-black/60 h-6 w-6 items-center justify-center rounded-full border border-white/20">
          <Ionicons name="play" size={12} color="#CCFF00" />
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
        {/* --- HEADER --- */}
        <View
          style={{ paddingTop: insets.top }}
          className="border-b border-white/10 pb-4 bg-[#1E1E1E]"
        >
          <View className="flex-row justify-between items-center px-4 py-3">
            <Text className="text-white font-bold text-xl">
              {t("mediaPicker.gallery")}
            </Text>
            <Pressable
              onPress={onClose}
              className="p-1 bg-white/10 rounded-full"
            >
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
          </View>

          <FlatList
            horizontal
            data={[{ id: "all", title: t("mediaPicker.recents") }, ...albums]}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  setSelectedAlbum(
                    item.id === "all" ? null : (item as MediaLibrary.Album),
                  )
                }
                className={`ml-4 px-5 py-2 rounded-full ${
                  (!selectedAlbum && item.id === "all") ||
                  selectedAlbum?.id === item.id
                    ? "bg-[#CCFF00]"
                    : "bg-white/10"
                }`}
              >
                <Text
                  className={`font-medium ${
                    (!selectedAlbum && item.id === "all") ||
                    selectedAlbum?.id === item.id
                      ? "text-black"
                      : "text-white"
                  }`}
                >
                  {item.title}
                </Text>
              </Pressable>
            )}
          />
        </View>

        {/* --- GRILLE --- */}
        <FlatList
          data={assets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={COLUMN_COUNT}
          onEndReached={() => loadAssets()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            isLoading && hasNextPage ? (
              <ActivityIndicator color="#CCFF00" className="my-6" />
            ) : null
          }
        />

        {/* --- APERÇU FULLSCREEN --- */}
        {selectedAsset && (
          <View className="absolute inset-0 bg-black z-50">
            {/* Header Aperçu */}
            <View
              style={{ paddingTop: insets.top }}
              className="absolute top-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent"
            >
              <View className="flex-row justify-between items-center px-4 py-4">
                <Pressable
                  onPress={() => setSelectedAsset(null)}
                  className="flex-row items-center bg-black/40 px-3 py-2 rounded-full"
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                  <Text className="text-white ml-1">
                    {t("mediaPicker.back")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    let fileSize = selectedAsset.fileSize;
                    if (!fileSize) {
                      try {
                        const info = await MediaLibrary.getAssetInfoAsync(selectedAsset);
                        fileSize =
                          typeof (info as { fileSize?: number }).fileSize === "number"
                            ? (info as { fileSize?: number }).fileSize
                            : undefined;
                      } catch {
                        // Ignore and continue without file size.
                      }
                    }

                    onSelect(selectedAsset.uri, selectedAsset.mediaType, {
                      fileSize,
                    });
                    onClose();
                  }}
                  className="bg-[#CCFF00] px-6 py-2 rounded-full flex-row items-center"
                >
                  <Text className="text-black font-bold mr-2 text-base">
                    {t("mediaPicker.validate")}
                  </Text>
                  <Ionicons name="checkmark-circle" size={20} color="black" />
                </Pressable>
              </View>
            </View>

            {selectedAsset.mediaType === "video" ? (
              <View
                style={{
                  flex: 1,
                  marginTop: insets.top,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "black",
                }}
              >
                <View
                  style={{
                    width: Math.min(width, (height - (insets.top + insets.bottom)) * VIDEO_ASPECT_RATIO),
                    height:
                      Math.min(width, (height - (insets.top + insets.bottom)) * VIDEO_ASPECT_RATIO) /
                      VIDEO_ASPECT_RATIO,
                    backgroundColor: "black",
                    overflow: "hidden",
                  }}
                >
                  <VideoView
                    player={player}
                    contentFit="cover"
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  />
                </View>
              </View>
            ) : (
              <Image
                source={{ uri: selectedAsset.uri }}
                className="flex-1"
                resizeMode="contain"
                style={{
                  width: width,
                  height: height - (insets.top + insets.bottom),
                  marginTop: insets.top,
                }}
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
