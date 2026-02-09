import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  Dimensions,
  Pressable,
  StyleSheet,
  Image,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Publication } from "@/types";
import { PublicationService } from "@/services/firebase/publication-service";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FeedItemProps {
  publication: Publication;
  isActive: boolean;
  index: number;
  onRequestNext?: (index: number) => void;
  onUserAction?: () => void;
}

const { height } = Dimensions.get("window");

export function FeedItem({
  publication,
  isActive,
  index,
  onRequestNext,
  onUserAction,
}: FeedItemProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [viewTracked, setViewTracked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const wasPlayingRef = useRef(false);
  const barWidthRef = useRef(1);

  const videoUri = useMemo(
    () => publication.hlsUrl || publication.videoUrl,
    [publication.hlsUrl, publication.videoUrl],
  );

  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = false;
    p.timeUpdateEventInterval = 0.5;
  });

  useEffect(() => {
    const timeSub = player.addListener("timeUpdate", (payload) => {
      if (!isScrubbing) {
        setCurrentTime(payload.currentTime);
      }
    });
    const sourceSub = player.addListener("sourceLoad", (payload) => {
      setDuration(payload.duration ?? 0);
      setCurrentTime(0);
    });
    const endSub = player.addListener("playToEnd", () => {
      if (isActive) {
        onRequestNext?.(index);
      }
    });

    return () => {
      timeSub.remove();
      sourceSub.remove();
      endSub.remove();
    };
  }, [player, isScrubbing, isActive, index, onRequestNext]);

  useEffect(() => {
    setViewTracked(false);
  }, [publication.id]);

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

  useEffect(() => {
    if (!videoUri) return;

    const updateSource = async () => {
      try {
        await player.replaceAsync(videoUri);
      } catch (error) {
        console.error("Flikk Video Error:", error);
      }
    };

    updateSource();
  }, [videoUri, player]);

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  const togglePlayback = useCallback(() => {
    onUserAction?.();
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, onUserAction]);

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const seekToX = useCallback(
    (x: number) => {
      if (!duration) return;
      const width = barWidthRef.current || 1;
      const ratio = clamp(x / width, 0, 1);
      const nextTime = ratio * duration;
      player.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration, player],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          onUserAction?.();
          setIsScrubbing(true);
          wasPlayingRef.current = player.playing;
          player.pause();
          seekToX(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          onUserAction?.();
          seekToX(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: (evt) => {
          onUserAction?.();
          seekToX(evt.nativeEvent.locationX);
          setIsScrubbing(false);
          if (wasPlayingRef.current) {
            player.play();
          }
        },
        onPanResponderTerminate: () => {
          onUserAction?.();
          setIsScrubbing(false);
          if (wasPlayingRef.current) {
            player.play();
          }
        },
      }),
    [player, seekToX, onUserAction],
  );

  const viewCountValue =
    publication.viewCount >= 1000
      ? `${(publication.viewCount / 1000).toFixed(1)}k`
      : publication.viewCount;
  const viewCountLabel = t("feed.viewsLabel", { count: viewCountValue });
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={{ width: "100%", height: "100%" }} className="bg-flikk-dark">
      {/* VIDEO BACKGROUND */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      <Pressable onPress={togglePlayback} className="absolute inset-0" />

      {/* VIEW COUNT BADGE (Top Right) */}
      <View
        className="absolute right-4 bg-black/40 px-3 py-1.5 rounded-full flex-row items-center gap-1.5"
        style={{ top: insets.top + 10 }}
      >
        <Ionicons name="eye-outline" size={16} color="white" />
        <Text className="text-white text-[12px] font-semibold">
          {viewCountLabel}
        </Text>
      </View>

      {/* OVERLAY GRADIENTS */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={styles.bottomGradient}
      />

      <LinearGradient
        colors={["rgba(0,0,0,0.4)", "transparent"]}
        style={styles.topGradient}
      />

      {/* BOTTOM INFO */}
      <View className="absolute bottom-6 left-4 right-4 flex-row items-end">
        {/* LEFT BLOCK (80%) */}
        <View className="w-[80%] pr-1">
          {/* CUSTOM SCRUB BAR */}
          <View
            className="mb-3"
            onLayout={(event) => {
              barWidthRef.current = event.nativeEvent.layout.width || 1;
            }}
            {...panResponder.panHandlers}
          >
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <View
                className="h-full rounded-full bg-flikk-lime"
                style={{ width: `${progress * 100}%` }}
              />
            </View>
            <View
              className="absolute -top-1.5 h-4 w-4 rounded-full bg-flikk-lime"
              style={{ left: `${progress * 100}%`, marginLeft: -8 }}
            />
          </View>

          {/* DESCRIPTION & HASHTAGS */}
          <View className="mb-4 pr-16 text-left">
            <Text
              className="text-white font-display text-base mb-1 leading-tight font-normal"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {publication.title}
            </Text>
            {publication.hashtags && publication.hashtags.length > 0 && (
              <Text
                className="text-[#a87ff3] font-medium text-sm"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {publication.hashtags
                  .map((tag) => `#${tag.replace("#", "")}`)
                  .join(" ")}
              </Text>
            )}
          </View>

          {/* PRODUCT CARD */}
          <View className="bg-flikk-card border border-white/10 rounded-2xl p-4 shadow-2xl overflow-hidden">
            <View className="flex-row items-center gap-4 mb-3">
              <View className="h-14 w-14 rounded-xl overflow-hidden bg-white/5">
                <Image
                  source={{ uri: publication.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-white font-display text-base mb-0.5 font-normal"
                  numberOfLines={1}
                >
                  {publication.productName}
                </Text>
                <Text className="text-flikk-lime font-medium text-base">
                  {publication.price.toLocaleString()} FCFA
                </Text>
              </View>
            </View>

            <Pressable className="h-11 bg-flikk-lime rounded-full flex-row items-center justify-center active:scale-[0.98]">
              <Text className="text-flikk-dark font-display text-[15px] font-medium">
                {t("feed.buyNow")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* RIGHT BLOCK (20%) */}
        <View className="w-[20%] items-end">
          <View className="items-end gap-5">
            <View className="items-center mb-2">
              <View className="h-12 w-12 rounded-full border border-flikk-purple p-0.5 bg-black">
                <View className="flex-1 rounded-full overflow-hidden bg-flikk-card items-center justify-center">
                  <Ionicons name="person" size={22} color="#CCFF00" />
                </View>
              </View>
              {/*
              <View className="absolute bottom-3 left-1/2 -translate-x-1/2 -ml-1 bg-flikk-lime rounded-full p-0.5 border-2 border-black">
                <Ionicons name="add" size={14} color="black" />
              </View>
              */}
              <Text className="text-white font-medium text-[10px] mt-2">
                {publication.likeCount >= 1000
                  ? `${(publication.likeCount / 1000).toFixed(0)}k`
                  : publication.likeCount}
              </Text>
            </View>

            <Pressable className="items-center mr-2">
              <Ionicons name="heart-outline" size={24} color="white" />
              <Text className="text-white font-medium text-[10px] mt-1">0</Text>
            </Pressable>

            <Pressable className="items-center mr-2">
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color="white"
              />
              <Text className="text-white font-medium text-[10px] mt-1">
                {publication.commentCount || 0}
              </Text>
            </Pressable>

            {/*
              <Pressable className="items-center mr-2">
                <Ionicons name="paper-plane-outline" size={22} color="white" />
                <Text className="text-white font-medium text-[10px] mt-1">
                  {t("feed.share")}
                </Text>
              </Pressable>
            */}
          </View>
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
