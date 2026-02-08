import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, Dimensions, Pressable, StyleSheet } from "react-native";
import Video, { ResizeMode } from "react-native-video";
import convertToCacheUri from "react-native-video-cache";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Publication } from "@/types";
import { PublicationService } from "@/services/firebase/publication-service";
import { LinearGradient } from "expo-linear-gradient";

interface FeedItemProps {
  publication: Publication;
  isActive: boolean;
}

const { width, height } = Dimensions.get("window");

export function FeedItem({ publication, isActive }: FeedItemProps) {
  const { t } = useTranslation();
  const [viewTracked, setViewTracked] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<any>(null);

  // Convert to cache URI for HLS segments persistence
  const videoSource = useMemo(() => {
    const url = publication.hlsUrl || publication.videoUrl;
    return { uri: convertToCacheUri(url) };
  }, [publication.hlsUrl, publication.videoUrl]);

  // Handle Play/Pause and View Tracking
  useEffect(() => {
    if (isActive) {
      // Start 3s timer for view increment
      if (!viewTracked) {
        timerRef.current = setTimeout(() => {
          PublicationService.incrementViewCount(publication.id!).catch(
            console.error,
          );
          setViewTracked(true);
        }, 3000);
      }
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isActive, publication.id, viewTracked]);

  return (
    <View style={{ width, height, backgroundColor: "black" }}>
      {/* VIDEO BACKGROUND */}
      <Video
        ref={videoRef}
        source={videoSource}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        paused={!isActive}
        repeat={true}
        muted={false}
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        // Optimizations for HLS
        bufferConfig={{
          minBufferMs: 1500,
          maxBufferMs: 3000,
          bufferForPlaybackMs: 1000,
          bufferForPlaybackAfterRebufferMs: 1500,
        }}
      />

      {/* OVERLAY GRADIENTS */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={styles.bottomGradient}
      />

      <LinearGradient
        colors={["rgba(0,0,0,0.4)", "transparent"]}
        style={styles.topGradient}
      />

      {/* RIGHT ACTIONS */}
      <View className="absolute right-4 bottom-32 items-center gap-6">
        <Pressable className="mb-4">
          <View className="h-14 w-14 rounded-full border-2 border-flikk-lime overflow-hidden bg-flikk-card items-center justify-center">
            <Ionicons name="person" size={24} color="#CCFF00" />
          </View>
          <View className="absolute -bottom-2 left-4 bg-flikk-lime rounded-full p-0.5">
            <Ionicons name="add" size={14} color="black" />
          </View>
        </Pressable>

        <Pressable className="items-center">
          <Ionicons name="heart" size={38} color="white" />
          <Text className="text-white font-bold text-xs mt-1">
            {publication.likeCount || 0}
          </Text>
        </Pressable>

        <Pressable className="items-center">
          <Ionicons name="chatbubble-ellipses" size={34} color="white" />
          <Text className="text-white font-bold text-xs mt-1">
            {publication.commentCount || 0}
          </Text>
        </Pressable>

        <Pressable className="items-center">
          <Ionicons name="share-social" size={34} color="white" />
          <Text className="text-white font-bold text-xs mt-1">
            {t("feed.share")}
          </Text>
        </Pressable>
      </View>

      {/* BOTTOM INFO */}
      <View className="absolute bottom-10 left-4 right-20">
        <View className="flex-row items-center mb-3">
          <Text className="text-flikk-lime font-display text-lg">
            @{publication.productName}
          </Text>
          {publication.orderCount > 10 && (
            <View className="ml-3 bg-red-600 px-2 py-0.5 rounded-full flex-row items-center">
              <Text className="text-white text-[10px] font-bold uppercase">
                🔥 {t("feed.hot", { count: publication.orderCount })}
              </Text>
            </View>
          )}
        </View>

        <Text className="text-white font-body text-base mb-2" numberOfLines={2}>
          {publication.title}
        </Text>

        <View className="flex-row gap-2 flex-wrap mb-4">
          {publication.hashtags.map((tag, i) => (
            <Text key={i} className="text-flikk-lime font-bold text-sm">
              {tag}
            </Text>
          ))}
        </View>

        {/* PRICE & BUY */}
        <View className="flex-row items-center gap-4">
          <View className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20">
            <Text className="text-flikk-lime font-display text-xl">
              {publication.price} CFA
            </Text>
          </View>

          <Pressable className="flex-1 h-14 bg-flikk-lime rounded-2xl flex-row items-center justify-center shadow-lg shadow-flikk-lime/30 active:scale-95">
            <Text className="text-flikk-dark font-display text-lg mr-2 uppercase">
              {t("feed.buyNow")}
            </Text>
            <Feather name="shopping-bag" size={20} color="#121212" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: height * 0.4,
  },
  topGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: height * 0.2,
  },
});
