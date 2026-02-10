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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Publication } from "@/types";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAuth } from "@react-native-firebase/auth";
import { useRouter } from "expo-router";
import { CommentsSheet } from "@/components/features/comments-sheet";
import { DeviceService } from "@/services/device/device-service";
import { ViewService } from "@/services/firebase/view-service";
import { PaymentService } from "@/services/firebase/payment-service";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { PaymentStatus } from "@/types";

interface FeedItemProps {
  publication: Publication;
  isActive: boolean;
  index: number;
  isFavorited?: boolean;
  isLikePending?: boolean;
  onToggleFavorite?: () => void;
  onRequestNext?: (index: number) => void;
  onUserAction?: () => void;
  onCommentsOpenChange?: (isOpen: boolean) => void;
  onPaymentOpenChange?: (isOpen: boolean) => void;
}

const { height } = Dimensions.get("window");

export function FeedItem({
  publication,
  isActive,
  index,
  isFavorited,
  isLikePending,
  onToggleFavorite,
  onRequestNext,
  onUserAction,
  onCommentsOpenChange,
  onPaymentOpenChange,
}: FeedItemProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [viewTracked, setViewTracked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const wasPlayingRef = useRef(false);
  const barWidthRef = useRef(1);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAuthRequiredOpen, setIsAuthRequiredOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(
    publication.commentCount || 0,
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "airtel" | "moov" | "zamani"
  >("airtel");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sheetTranslateY, setSheetTranslateY] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const deviceId = useMemo(() => DeviceService.getDeviceId(), []);

  const videoUri = useMemo(
    () => publication.hlsUrl || publication.videoUrl,
    [publication.hlsUrl, publication.videoUrl],
  );

  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = false;
    p.timeUpdateEventInterval = 0.5;
    p.staysActiveInBackground = false;
    p.keepScreenOnWhilePlaying = false;
    p.bufferOptions = {
      preferredForwardBufferDuration: 5,
      minBufferForPlayback: 1,
      maxBufferBytes: 5 * 1024 * 1024,
    };
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
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    setViewTracked(false);
  }, [publication.id]);

  useEffect(() => {
    setCommentCount(publication.commentCount || 0);
  }, [publication.id, publication.commentCount]);

  // Handle Play/Pause and View Tracking
  useEffect(() => {
    if (isActive) {
      // Start 3s timer for view increment
      if (!viewTracked) {
        timerRef.current = setTimeout(() => {
          ViewService.incrementViewOnce(publication.id!, deviceId).catch(
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
    if (isActive && !isCommentsOpen && !isPaymentOpen) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isCommentsOpen, isPaymentOpen, player]);

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
  const paymentOptions = useMemo(
    () => [
      { key: "airtel", label: t("payment.airtel") },
      { key: "moov", label: t("payment.moov") },
      { key: "zamani", label: t("payment.zamani") },
    ],
    [t],
  );

  const openAuthRequired = useCallback(() => {
    setIsAuthRequiredOpen(true);
  }, []);

  const openPaymentSheet = useCallback(() => {
    const user = getAuth().currentUser;
    if (!user) {
      openAuthRequired();
      return;
    }
    setPhoneNumber(user.phoneNumber ?? "");
    setPhoneError(null);
    setPaymentMethod("airtel");
    setPaymentReference(null);
    setPaymentStatus(null);
    setIsPaymentOpen(true);
    onPaymentOpenChange?.(true);
  }, [openAuthRequired]);

  const handleLikePress = useCallback(() => {
    const user = getAuth().currentUser;
    if (!user) {
      openAuthRequired();
      return;
    }
    onToggleFavorite?.();
  }, [openAuthRequired, onToggleFavorite]);

  const handleCommentPress = useCallback(() => {
    onUserAction?.();
    setIsCommentsOpen(true);
    onCommentsOpenChange?.(true);
  }, [onUserAction, onCommentsOpenChange]);

  const closePaymentSheet = useCallback(() => {
    setIsPaymentOpen(false);
    setSheetTranslateY(0);
    setKeyboardHeight(0);
    setPaymentReference(null);
    setPaymentStatus(null);
    setIsPaymentSubmitting(false);
    setPhoneError(null);
    onPaymentOpenChange?.(false);
  }, []);

  const authUser = getAuth().currentUser;
  const { data: userProfile } = useUserProfile(authUser?.uid);
  const statusQuery = usePaymentStatus(
    paymentReference,
    isPaymentOpen && paymentStatus === "pending",
  );

  useEffect(() => {
    if (!statusQuery.data?.status) return;
    setPaymentStatus(statusQuery.data.status);
  }, [statusQuery.data?.status]);

  const handleConfirmPayment = useCallback(async () => {
    if (!phoneNumber.trim()) return;
    const user = getAuth().currentUser;
    if (!user) {
      openAuthRequired();
      return;
    }

    const sanitizeMsisdn = (value: string) =>
      value.replace(/\D/g, "");
    const normalizedMsisdn = sanitizeMsisdn(phoneNumber);
    if (normalizedMsisdn.length < 8) {
      setPhoneError(t("payment.phoneInvalid"));
      return;
    }
    setPhoneError(null);

    const customerName =
      userProfile?.merchantInfo?.businessName ||
      [userProfile?.firstName, userProfile?.lastName]
        .filter(Boolean)
        .join(" ") ||
      user.phoneNumber ||
      "Client Flikk";

    try {
      setIsPaymentSubmitting(true);
      const token = await user.getIdToken(true);
      console.log("Payment debug uid:", user.uid);
      console.log("Payment debug token:", token?.slice(0, 12));
      const result = await PaymentService.requestPayment({
        publicationId: publication.id ?? "",
        msisdn: normalizedMsisdn,
        customerName,
        country: "NE",
        currency: "XOF",
      });
      setPaymentReference(result.reference);
      setPaymentStatus(result.status);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? "";
      if (code.includes("unauthenticated")) {
        openAuthRequired();
      } else {
        setPaymentStatus("failed");
      }
      console.error("Payment error", error);
    } finally {
      setIsPaymentSubmitting(false);
    }
  }, [phoneNumber, publication.id, userProfile, openAuthRequired]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 8,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            setSheetTranslateY(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80) {
            closePaymentSheet();
          } else {
            setSheetTranslateY(0);
          }
        },
        onPanResponderTerminate: () => {
          setSheetTranslateY(0);
        },
      }),
    [closePaymentSheet],
  );

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

            <Pressable
              className="h-11 bg-flikk-lime rounded-full flex-row items-center justify-center active:scale-[0.98]"
              onPress={openPaymentSheet}
            >
              <Text className="text-flikk-dark font-display text-[15px] font-medium">
                {t("feed.buyNow")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* RIGHT BLOCK (20%) */}
        <View className="w-[20%] items-end">
          <View className="items-end gap-5">
            <Pressable
              className="items-center mb-2"
              onPress={() => {
                if (publication.userId) {
                  router.push({
                    pathname: "/(tabs)/home/merchant/[id]",
                    params: { id: publication.userId },
                  });
                }
              }}
            >
              <View className="h-12 w-12 rounded-full border border-flikk-purple p-0.5 bg-black">
                <View className="flex-1 rounded-full overflow-hidden bg-flikk-card items-center justify-center">
                  {publication.merchantLogoUrl ? (
                    <Image
                      source={{ uri: publication.merchantLogoUrl }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={22} color="#CCFF00" />
                  )}
                </View>
              </View>
              {/*
              <View className="absolute bottom-3 left-1/2 -translate-x-1/2 -ml-1 bg-flikk-lime rounded-full p-0.5 border-2 border-black">
                <Ionicons name="add" size={14} color="black" />
              </View>
              */}
              {/* Intentionally no count here (followers will be added later). */}
            </Pressable>

            <Pressable
              className="items-center mr-2"
              onPress={handleLikePress}
              disabled={isLikePending}
            >
              <Ionicons
                name={isFavorited ? "heart" : "heart-outline"}
                size={24}
                color={isFavorited ? "#FF4D6D" : "white"}
              />
              <Text className="text-white font-medium text-[10px] mt-1">
                {Math.max(0, publication.likeCount) >= 1000
                  ? `${(Math.max(0, publication.likeCount) / 1000).toFixed(0)}k`
                  : Math.max(0, publication.likeCount)}
              </Text>
            </Pressable>

            <Pressable
              className="items-center mr-2"
              onPress={handleCommentPress}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color="white"
              />
              <Text className="text-white font-medium text-[10px] mt-1">
                {commentCount}
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

      <Modal
        visible={isPaymentOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPaymentOpen(false)}
      >
        <Pressable className="flex-1 bg-black/50" onPress={closePaymentSheet} />
        <KeyboardAvoidingView
          className="absolute inset-x-0 bottom-0"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
        >
          <View
            className="w-full rounded-t-3xl border border-white/10 bg-flikk-card p-6"
            style={{
              paddingBottom: insets.bottom + 16,
              transform: [
                { translateY: sheetTranslateY - keyboardHeight },
              ],
            }}
            {...sheetPanResponder.panHandlers}
          >
            <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-white/20" />
            <Text className="font-display text-lg text-flikk-text">
              {t("payment.title")}
            </Text>
            <Text className="mt-1 font-body text-sm text-flikk-text-muted">
              {t("payment.subtitle")}
            </Text>

            <View className="mt-5 gap-3">
              {paymentOptions.map((option) => {
                const selected = paymentMethod === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() =>
                      setPaymentMethod(
                        option.key as "airtel" | "moov" | "zamani",
                      )
                    }
                    className={`flex-row items-center justify-between rounded-2xl border p-4 ${
                      selected
                        ? "border-flikk-lime bg-flikk-lime/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <Text className="font-display text-base text-flikk-text">
                      {option.label}
                    </Text>
                    <View
                      className={`h-5 w-5 rounded-full border ${
                        selected ? "border-flikk-lime" : "border-white/30"
                      } items-center justify-center`}
                    >
                      {selected && (
                        <View className="h-2.5 w-2.5 rounded-full bg-flikk-lime" />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-6">
              <Text className="mb-2 font-body text-xs text-flikk-text-muted">
                {t("payment.phoneLabel")}
              </Text>
              <TextInput
                className="h-12 w-full rounded-2xl border border-white/10 bg-flikk-dark px-4 font-body text-base text-flikk-text"
                placeholder={t("payment.phonePlaceholder")}
                placeholderTextColor="#666666"
                value={phoneNumber}
                onChangeText={(value) => {
                  setPhoneNumber(value);
                  if (phoneError) setPhoneError(null);
                }}
                keyboardType="phone-pad"
                selectionColor="#CCFF00"
              />
              {phoneError && (
                <Text className="mt-2 text-xs text-[#FF4D6D]">
                  {phoneError}
                </Text>
              )}
            </View>

            <Pressable
              className={`mt-6 h-12 items-center justify-center rounded-full bg-flikk-lime ${
                !phoneNumber.trim() || isPaymentSubmitting
                  ? "opacity-50"
                  : "active:scale-[0.98]"
              }`}
              disabled={!phoneNumber.trim() || isPaymentSubmitting}
              onPress={handleConfirmPayment}
            >
              {isPaymentSubmitting ? (
                <ActivityIndicator color="#121212" />
              ) : (
                <Text className="font-display text-base text-flikk-dark">
                  {t("payment.confirm")}
                </Text>
              )}
            </Pressable>

            {paymentStatus && (
              <View className="mt-4 items-center">
                <Text className="text-sm text-flikk-text-muted">
                  {paymentStatus === "succeeded"
                    ? t("payment.statusSuccess")
                    : paymentStatus === "pending"
                      ? t("payment.statusPending")
                      : t("payment.statusFailed")}
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isAuthRequiredOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAuthRequiredOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/60"
          onPress={() => setIsAuthRequiredOpen(false)}
        />
        <View className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-flikk-card p-6">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-flikk-lime/10">
            <Ionicons name="lock-closed" size={22} color="#CCFF00" />
          </View>
          <Text className="font-display text-lg text-flikk-text">
            {t("payment.auth.title")}
          </Text>
          <Text className="mt-2 font-body text-sm text-flikk-text-muted">
            {t("payment.auth.subtitle")}
          </Text>

          <Pressable
            className="mt-6 h-12 items-center justify-center rounded-full bg-flikk-lime"
            onPress={() => {
              setIsAuthRequiredOpen(false);
              router.push("/(tabs)/profil");
            }}
          >
            <Text className="font-display text-base text-flikk-dark">
              {t("payment.auth.cta")}
            </Text>
          </Pressable>
        </View>
      </Modal>

      <CommentsSheet
        publicationId={publication.id ?? ""}
        isVisible={isCommentsOpen}
        onClose={() => {
          setIsCommentsOpen(false);
          onCommentsOpenChange?.(false);
        }}
        totalCount={commentCount}
        onCountChange={(delta) =>
          setCommentCount((prev) => Math.max(0, prev + delta))
        }
      />
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
