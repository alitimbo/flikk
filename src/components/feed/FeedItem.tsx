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
  ScrollView,
  Animated,
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
import Toast from "react-native-toast-message";

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
  onAddToCart?: () => Promise<void> | void;
  isInCart?: boolean;
  isAddToCartPending?: boolean;
  cartCount?: number;
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
  onAddToCart,
  isInCart,
  isAddToCartPending,
  cartCount = 0,
}: FeedItemProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [viewTracked, setViewTracked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const wasPlayingRef = useRef(false);
  const barWidthRef = useRef(1);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isGuaranteeOpen, setIsGuaranteeOpen] = useState(false);
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const guaranteeOpacity = useRef(new Animated.Value(0)).current;
  const guaranteeTranslateY = useRef(new Animated.Value(24)).current;
  const deliveryOpacity = useRef(new Animated.Value(0)).current;
  const deliveryTranslateY = useRef(new Animated.Value(24)).current;
  const [isLaunchSuccessOpen, setIsLaunchSuccessOpen] = useState(false);
  const [isAuthRequiredOpen, setIsAuthRequiredOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(
    publication.commentCount || 0,
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
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
    const playingSub = player.addListener("playingChange", (payload) => {
      setIsPlaying(payload.isPlaying);
    });

    return () => {
      timeSub.remove();
      sourceSub.remove();
      endSub.remove();
      playingSub.remove();
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
    if (!isGuaranteeOpen) return;
    guaranteeOpacity.setValue(0);
    guaranteeTranslateY.setValue(24);
    Animated.parallel([
      Animated.timing(guaranteeOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(guaranteeTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isGuaranteeOpen, guaranteeOpacity, guaranteeTranslateY]);

  useEffect(() => {
    if (!isDeliveryOpen) return;
    deliveryOpacity.setValue(0);
    deliveryTranslateY.setValue(24);
    Animated.parallel([
      Animated.timing(deliveryOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(deliveryTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isDeliveryOpen, deliveryOpacity, deliveryTranslateY]);

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
        setIsUserPaused(false);
      } catch (error) {
        console.error("Flikk Video Error:", error);
      }
    };

    updateSource();
  }, [videoUri, player]);

  useEffect(() => {
    const isInfoOpen = isGuaranteeOpen || isDeliveryOpen;
    if (
      isActive &&
      !isCommentsOpen &&
      !isPaymentOpen &&
      !isInfoOpen &&
      !isImagePreviewOpen
    ) {
      player.play();
      setIsUserPaused(false);
    } else {
      player.pause();
    }
  }, [
    isActive,
    isCommentsOpen,
    isPaymentOpen,
    isGuaranteeOpen,
    isDeliveryOpen,
    isImagePreviewOpen,
    player,
  ]);

  const togglePlayback = useCallback(() => {
    onUserAction?.();
    if (player.playing) {
      player.pause();
      setIsUserPaused(true);
    } else {
      player.play();
      setIsUserPaused(false);
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
  const openAuthRequired = useCallback(() => {
    setIsAuthRequiredOpen(true);
  }, []);

  const openPaymentSheet = useCallback(() => {
    const user = getAuth().currentUser;
    if (!user) {
      openAuthRequired();
      return;
    }
    setPhoneNumber((user.phoneNumber ?? "").replace(/\D/g, ""));
    setPhoneError(null);
    setPaymentReference(null);
    setPaymentStatus(null);
    setOrderNumber(null);
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

  const handleAddToCart = useCallback(async () => {
    const user = getAuth().currentUser;
    if (!user) {
      openAuthRequired();
      return;
    }
    try {
      await onAddToCart?.();
      Toast.show({
        type: "success",
        position: "top",
        text1: t("cart.addedTitle"),
        text2: t("cart.addedBody"),
        visibilityTime: 1800,
        topOffset: 52,
      });
    } catch (error) {
      console.log("[FeedItem] addToCart error:", {
        publicationId: publication.id,
        uid: user.uid,
        error,
      });
      const message = String((error as { message?: string })?.message ?? "");
      if (message.includes("AUTH_REQUIRED")) {
        openAuthRequired();
        return;
      }
      Toast.show({
        type: "error",
        position: "top",
        text1: t("cart.addErrorTitle"),
        text2: t("cart.addErrorBody"),
        visibilityTime: 2000,
        topOffset: 52,
      });
    }
  }, [onAddToCart, openAuthRequired, publication.id, t]);

  const openCartScreen = useCallback(() => {
    const user = getAuth().currentUser;
    if (!user) {
      openAuthRequired();
      return;
    }
    try {
      router.push("/(tabs)/purchase/cart");
    } catch (error) {
      console.log("[FeedItem] openCart primary route error:", error);
      try {
        router.push("/purchase/cart");
      } catch (fallbackError) {
        console.log("[FeedItem] openCart fallback route error:", fallbackError);
      }
    }
  }, [openAuthRequired, router]);

  const closePaymentSheet = useCallback(() => {
    setIsPaymentOpen(false);
    setSheetTranslateY(0);
    setKeyboardHeight(0);
    setPhoneError(null);
    setIsPaymentSubmitting(false);
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

  const handleLaunchOrderValidate = useCallback(async () => {
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
      [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(" ") ||
      user.phoneNumber ||
      "Client Flikk";

    try {
      setIsPaymentSubmitting(true);
      const result = await PaymentService.requestManualOrder({
        publicationId: publication.id ?? "",
        msisdn: normalizedMsisdn,
        customerName,
        country: "NE",
        currency: "XOF",
      });
      setPaymentReference(result.reference);
      setPaymentStatus(result.status);
      setOrderNumber(result.orderNumber ?? null);
      setPhoneNumber(normalizedMsisdn);
      closePaymentSheet();
      setIsLaunchSuccessOpen(true);
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
  }, [phoneNumber, t, userProfile, publication.id, openAuthRequired, closePaymentSheet]);

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

      {isActive && isUserPaused && !isPlaying && !isCommentsOpen && !isPaymentOpen ? (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center"
        >
          <View className="h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/45">
            <Ionicons name="play" size={28} color="#CCFF00" />
          </View>
        </View>
      ) : null}

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

      <Pressable
        className="absolute left-4 h-10 w-10 items-center justify-center rounded-full bg-black/45 border border-white/15"
        style={{ top: insets.top + 10, zIndex: 30, elevation: 30 }}
        onPress={openCartScreen}
      >
        <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
        {cartCount > 0 ? (
          <View className="absolute -right-1 -top-1 min-w-[16px] h-4 rounded-full bg-flikk-lime items-center justify-center px-1">
            <Text className="text-[9px] font-semibold text-flikk-dark">
              {cartCount > 99 ? "99+" : cartCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* OVERLAY GRADIENTS */}
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={styles.bottomGradient}
      />

      <LinearGradient
        pointerEvents="none"
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
              <Pressable
                className="h-14 w-14 rounded-xl overflow-hidden bg-white/5"
                onPress={() => {
                  onUserAction?.();
                  setIsImagePreviewOpen(true);
                }}
              >
                <Image
                  source={{ uri: publication.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              </Pressable>
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

            <View className="flex-row items-center gap-2">
              <Pressable
                className="h-11 flex-1 bg-flikk-lime rounded-full flex-row items-center justify-center active:scale-[0.98]"
                onPress={openPaymentSheet}
              >
                <Text className="text-flikk-dark font-display text-[15px] font-medium">
                  {t("feed.buyNow")}
                </Text>
              </Pressable>
              <Pressable
                className={`h-11 w-11 rounded-full border items-center justify-center ${
                  isInCart ? "bg-flikk-lime/20 border-flikk-lime" : "bg-white/10 border-white/20"
                } ${isAddToCartPending ? "opacity-50" : ""}`}
                onPress={handleAddToCart}
                disabled={isAddToCartPending}
              >
                <Ionicons
                  name={isInCart ? "checkmark" : "cart-outline"}
                  size={18}
                  color={isInCart ? "#CCFF00" : "#FFFFFF"}
                />
              </Pressable>
            </View>

            <View className="mt-3 flex-row items-center justify-center">
              <Pressable
                onPress={() => {
                  onUserAction?.();
                  setIsGuaranteeOpen(true);
                }}
              >
                <Text className="text-[11px] text-flikk-text-muted underline">
                  {t("payment.guaranteeLink")}
                </Text>
              </Pressable>
              <Text className="mx-2 text-[11px] text-flikk-text-muted">.</Text>
              <Pressable
                onPress={() => {
                  onUserAction?.();
                  setIsDeliveryOpen(true);
                }}
              >
                <Text className="text-[11px] text-flikk-text-muted underline">
                  {t("payment.deliveryLink")}
                </Text>
              </Pressable>
            </View>
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
        onRequestClose={closePaymentSheet}
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
              {t("payment.contactTitle")}
            </Text>
            <Text className="mt-1 font-body text-sm text-flikk-text-muted">
              {t("payment.contactSubtitle")}
            </Text>

            <View className="mt-6">
              <Text className="mb-2 font-body text-xs text-flikk-text-muted">
                {t("payment.contactPhoneLabel")}
              </Text>
              <TextInput
                className="h-12 w-full rounded-2xl border border-white/10 bg-flikk-dark px-4 font-body text-base text-flikk-text"
                placeholder={t("payment.contactPhonePlaceholder")}
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
              onPress={handleLaunchOrderValidate}
            >
              {isPaymentSubmitting ? (
                <ActivityIndicator color="#121212" />
              ) : (
                <Text className="font-display text-base text-flikk-dark">
                  {t("payment.validateOrder")}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isLaunchSuccessOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLaunchSuccessOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/60"
          onPress={() => setIsLaunchSuccessOpen(false)}
        />
        <View className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-flikk-card p-6">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-flikk-lime/10">
            <Ionicons name="checkmark-circle" size={24} color="#CCFF00" />
          </View>
          <Text className="font-display text-lg text-flikk-text">
            {t("payment.launchThanksTitle")}
          </Text>
          <Text className="mt-2 font-body text-sm text-flikk-text-muted">
            {t("payment.launchThanksMessage")}
          </Text>
          {!!orderNumber && (
            <View className="mt-3 rounded-2xl bg-white/5 px-3 py-2">
              <Text className="text-xs text-flikk-text-muted">
                {t("payment.orderNumberLabel")}
              </Text>
              <Text className="mt-1 font-display text-sm text-flikk-lime">
                {orderNumber}
              </Text>
            </View>
          )}
          <Pressable
            className="mt-6 h-12 items-center justify-center rounded-full bg-flikk-lime"
            onPress={() => setIsLaunchSuccessOpen(false)}
          >
            <Text className="font-display text-base text-flikk-dark">
              {t("payment.close")}
            </Text>
          </Pressable>
        </View>
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

      <Modal
        visible={isGuaranteeOpen}
        transparent
        animationType="none"
        onRequestClose={() => setIsGuaranteeOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/60"
          onPress={() => setIsGuaranteeOpen(false)}
        />
        <View className="absolute inset-0 items-center justify-center px-5">
          <Animated.View
            className="w-full max-w-[360px] max-h-[62%] rounded-3xl border border-white/10 bg-flikk-card p-5"
            style={{
              opacity: guaranteeOpacity,
              transform: [{ translateY: guaranteeTranslateY }],
            }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-display text-lg text-flikk-text">
                {t("payment.guaranteeTitle")}
              </Text>
              <Pressable onPress={() => setIsGuaranteeOpen(false)} className="p-1">
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-sm leading-6 text-flikk-text-muted">
                {t("payment.guaranteeBody")}
              </Text>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={isDeliveryOpen}
        transparent
        animationType="none"
        onRequestClose={() => setIsDeliveryOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/60"
          onPress={() => setIsDeliveryOpen(false)}
        />
        <View className="absolute inset-0 items-center justify-center px-5">
          <Animated.View
            className="w-full max-w-[360px] max-h-[62%] rounded-3xl border border-white/10 bg-flikk-card p-5"
            style={{
              opacity: deliveryOpacity,
              transform: [{ translateY: deliveryTranslateY }],
            }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-display text-lg text-flikk-text">
                {t("payment.deliveryTitle")}
              </Text>
              <Pressable onPress={() => setIsDeliveryOpen(false)} className="p-1">
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-sm leading-6 text-flikk-text-muted">
                {t("payment.deliveryBody")}
              </Text>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={isImagePreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImagePreviewOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/90"
          onPress={() => setIsImagePreviewOpen(false)}
        >
          <View className="absolute right-5 top-14 z-10">
            <Pressable
              onPress={() => setIsImagePreviewOpen(false)}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          <View className="flex-1 items-center justify-center px-4">
            <Image
              source={{ uri: publication.imageUrl }}
              className="h-[72%] w-full"
              resizeMode="contain"
            />
          </View>
        </Pressable>
      </Modal>
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
