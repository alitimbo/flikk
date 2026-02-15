import { useState, useCallback, useEffect } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { StorageService } from "@/services/storage/storage-service";
import { PublicationService } from "@/services/firebase/publication-service";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { FirebaseService } from "@/services/firebase/firebase-service";
import { useRouter } from "expo-router";
import { useUserProfile } from "@/hooks/useUserProfile";
import Toast from "react-native-toast-message";
import { useVideoPlayer, VideoView } from "expo-video";
import { AiVideoOrderService } from "@/services/firebase/ai-video-order-service";
import type { AiVideoFormat, AiVideoReceptionMethod } from "@/types";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const PUBLISH_SUCCESS_SOUND = require("@/assets/sounds/publish-success.mp3");
const AI_VIDEO_BASE_PRICE = 8000;
const FREE_VIDEO_LIMIT = 2;

export default function ActionIndex() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<FirebaseAuthTypes.User | null>(null);

  // --- ÉTATS DU FORMULAIRE ---
  const [productName, setProductName] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [itemPhoto, setItemPhoto] = useState<string | null>(null);
  const [commercialVideo, setCommercialVideo] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"publish" | "ai-order">(
    "publish",
  );

  // --- ÉTATS DU PICKER ---
  const [pickerMode, setPickerMode] = useState<
    "photo" | "video" | "ai-photo-1" | "ai-photo-2" | null
  >(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAiSubmitting, setIsAiSubmitting] = useState(false);
  const aiPulse = useState(new Animated.Value(0))[0];
  const [aiImageOne, setAiImageOne] = useState<string | null>(null);
  const [aiImageTwo, setAiImageTwo] = useState<string | null>(null);
  const [aiExpectedContent, setAiExpectedContent] = useState("");
  const [aiFormat, setAiFormat] = useState<AiVideoFormat>("9:16");
  const [aiReceptionMethod, setAiReceptionMethod] =
    useState<AiVideoReceptionMethod>("whatsapp");
  const [aiWhatsapp, setAiWhatsapp] = useState("");
  const [aiEmail, setAiEmail] = useState("");
  const successSoundPlayer = useVideoPlayer(PUBLISH_SUCCESS_SOUND, (p) => {
    p.loop = false;
    p.muted = false;
    p.audioMixingMode = "auto";
    p.staysActiveInBackground = false;
  });
  const draftVideoPlayer = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = true;
    p.staysActiveInBackground = false;
  });

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(aiPulse, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [aiPulse]);

  useEffect(() => {
    let isMounted = true;

    const syncDraftPreview = async () => {
      if (!commercialVideo) {
        draftVideoPlayer.pause();
        return;
      }
      try {
        await draftVideoPlayer.replaceAsync(commercialVideo);
        if (isMounted) {
          draftVideoPlayer.play();
        }
      } catch (error) {
        console.log("[Action] draft preview error:", error);
      }
    };

    void syncDraftPreview();

    return () => {
      isMounted = false;
    };
  }, [commercialVideo, draftVideoPlayer]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(FirebaseService.auth, (user) => {
      setAuthUser(user);
    });
    return unsubscribe;
  }, []);

  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(
    authUser?.uid,
  );
  const freeUsageCount = Number(userProfile?.freeUsageCount ?? 0);
  const freeVideosLeft = Math.max(0, FREE_VIDEO_LIMIT - freeUsageCount);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(aiPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(aiPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [aiPulse]);

  useEffect(() => {
    if (!authUser) return;
    if (!aiWhatsapp) {
      setAiWhatsapp(
        (userProfile?.phoneNumber ?? authUser.phoneNumber ?? "").replace(
          /\D/g,
          "",
        ),
      );
    }
    if (!aiEmail) {
      setAiEmail(userProfile?.email ?? "");
    }
  }, [
    authUser,
    userProfile?.phoneNumber,
    userProfile?.email,
    aiWhatsapp,
    aiEmail,
  ]);

  const handlePublish = useCallback(async () => {
    const user = getAuth().currentUser;
    if (!user) return;

    if (!productName || !title || !price || !itemPhoto || !commercialVideo)
      return;

    setIsPublishing(true);

    try {
      const merchantName =
        userProfile?.merchantInfo?.businessName ||
        [userProfile?.firstName, userProfile?.lastName]
          .filter(Boolean)
          .join(" ") ||
        "";
      const merchantLogoUrl = userProfile?.merchantInfo?.logoUrl;

      // 1. Upload Photo
      const photoRes = await StorageService.uploadOne({
        uri: itemPhoto,
        kind: "image",
        pathPrefix: `publications/${user.uid}/photos`,
      });

      // 2. Upload Video (for HLS processing)
      const videoRes = await StorageService.uploadForProcessing({
        uri: commercialVideo,
        kind: "video",
        pathPrefix: `uploads/raw/videos/${user.uid}`,
      });

      // 3. Create Publication doc
      const pubId = await PublicationService.createPublication({
        userId: user.uid,
        productName,
        title,
        price: parseInt(price),
        hashtags: hashtags
          .split(" ")
          .filter((h) => h.startsWith("#"))
          .map((h) => h.trim().replace("#", "")),
        imageUrl: photoRes.downloadUrl,
        videoUrl: videoRes.downloadUrl,
        merchantName,
        merchantLogoUrl,
        status: "pending",
      });

      // 4. Update Video with Publication ID to trigger HLS link
      await StorageService.updateMetadata(videoRes.path, {
        "flikk:publicationId": pubId,
      });

      // Success!
      setProductName("");
      setTitle("");
      setPrice("");
      setHashtags("");
      setItemPhoto(null);
      setCommercialVideo(null);
      Toast.show({
        type: "success",
        position: "top",
        text1: t("action.publishSuccessTitle"),
        text2: t("action.publishSuccessBody"),
        visibilityTime: 2800,
        topOffset: 52,
      });
      try {
        successSoundPlayer.seekBy(-successSoundPlayer.currentTime);
        successSoundPlayer.play();
      } catch {
        // No-op if sound cannot play on this device/session.
      }
    } catch (error) {
      console.error("Error publishing:", error);
      Toast.show({
        type: "error",
        position: "top",
        text1: t("action.publishErrorTitle"),
        text2: t("action.publishErrorBody"),
        visibilityTime: 3000,
        topOffset: 52,
      });
    } finally {
      setIsPublishing(false);
    }
  }, [
    productName,
    title,
    price,
    hashtags,
    itemPhoto,
    commercialVideo,
    userProfile,
    t,
    successSoundPlayer,
  ]);

  const handleAiSubmit = useCallback(async () => {
    const user = getAuth().currentUser;
    if (!user) return;

    if (!aiImageOne || !aiImageTwo || !aiExpectedContent) return;

    setIsAiSubmitting(true);

    try {
      // 1. Upload Photos
      const [res1, res2] = await Promise.all([
        StorageService.uploadOne({
          uri: aiImageOne,
          kind: "image",
          pathPrefix: `ai-video-orders/${user.uid}`,
        }),
        StorageService.uploadOne({
          uri: aiImageTwo,
          kind: "image",
          pathPrefix: `ai-video-orders/${user.uid}`,
        }),
      ]);

      // 2. Create Order
      const contact = aiReceptionMethod === "whatsapp" ? aiWhatsapp : aiEmail;

      await AiVideoOrderService.createOrder({
        uid: user.uid,
        userProfile: userProfile || null,
        expectedContent: aiExpectedContent,
        format: aiFormat,
        productImage1Url: res1.downloadUrl,
        productImage2Url: res2.downloadUrl,
        receptionMethod: aiReceptionMethod,
        receptionContact: contact,
      });

      // Success!
      setAiExpectedContent("");
      setAiImageOne(null);
      setAiImageTwo(null);

      Toast.show({
        type: "success",
        position: "top",
        text1: t("action.aiOrder.successTitle"),
        text2: t("action.aiOrder.successBody"),
        visibilityTime: 3000,
        topOffset: 52,
      });

      // Si on veut repasser en mode publish après succès
      setActionMode("publish");
    } catch (error) {
      console.error("Error creating AI order:", error);
      Toast.show({
        type: "error",
        position: "top",
        text1: t("action.publishErrorTitle"),
        text2: t("action.publishErrorBody"),
        visibilityTime: 3000,
        topOffset: 52,
      });
    } finally {
      setIsAiSubmitting(false);
    }
  }, [
    aiImageOne,
    aiImageTwo,
    aiExpectedContent,
    aiFormat,
    aiReceptionMethod,
    aiWhatsapp,
    aiEmail,
    userProfile,
    t,
  ]);

  if (!authUser) {
    return (
      <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-flikk-card p-6">
            <View className="mb-6 h-14 w-14 items-center justify-center rounded-2xl bg-flikk-lime/10">
              <Ionicons name="lock-closed" size={26} color="#CCFF00" />
            </View>
            <Text className="font-display text-2xl text-flikk-text">
              {t("action.auth.title")}
            </Text>
            <Text className="mt-2 font-body text-sm leading-5 text-flikk-text-muted">
              {t("action.auth.subtitle")}
            </Text>

            <Pressable
              className="mt-8 h-14 items-center justify-center rounded-full bg-flikk-lime"
              onPress={() => router.push("/(tabs)/profil")}
            >
              <Text className="font-display text-base text-flikk-dark">
                {t("action.auth.ctaProfile")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (authUser && !isProfileLoading && userProfile && !userProfile.isMerchant) {
    return (
      <View className="flex-1 bg-flikk-dark" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-flikk-card p-6">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-flikk-lime/10">
              <Ionicons name="storefront" size={22} color="#CCFF00" />
            </View>
            <Text className="font-display text-lg text-flikk-text">
              {t("action.merchantGate.title")}
            </Text>
            <Text className="mt-2 font-body text-sm text-flikk-text-muted">
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
    <KeyboardAvoidingView
      className="flex-1 bg-flikk-dark"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1" style={{ paddingTop: insets.top }}>
          {/* HEADER */}
          <View className="px-6 py-4 flex-row justify-between items-center border-b border-white/10">
            <Text className="font-display text-2xl text-flikk-text">
              {t("action.title")}
            </Text>
            <Pressable
              onPress={() => setActionMode("ai-order")}
              className="h-9 px-4 items-center justify-center rounded-xl overflow-hidden relative bg-[#CCFF00]"
            >
              {/* Wave Animation Overlay */}
              <Animated.View
                style={{
                  position: "absolute",
                  width: "300%",
                  height: "100%",
                  transform: [
                    {
                      translateX: aiPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-200, 50],
                      }),
                    },
                  ],
                }}
              >
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255,255,255,0.4)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="w-full h-full"
                />
              </Animated.View>

              <View className="flex-row items-center gap-1.5 z-10">
                <Text className="font-display text-xs font-black text-flikk-dark">
                  IA
                </Text>
                <Ionicons name="sparkles" size={12} color="#121212" />
              </View>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* MODE SWITCHER */}
            <View className="flex-row bg-white/5 rounded-2xl p-1 mb-8">
              <Pressable
                onPress={() => setActionMode("publish")}
                className={`flex-1 h-12 rounded-xl items-center justify-center ${
                  actionMode === "publish" ? "bg-white/10" : ""
                }`}
              >
                <Text
                  className={`font-bold text-sm ${
                    actionMode === "publish"
                      ? "text-flikk-lime"
                      : "text-flikk-text-muted"
                  }`}
                >
                  {t("action.aiOrder.standardTitle")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActionMode("ai-order")}
                className={`flex-1 h-12 rounded-xl items-center justify-center ${
                  actionMode === "ai-order" ? "bg-white/10" : ""
                }`}
              >
                <View className="flex-row items-center">
                  <Text
                    className={`font-bold text-sm ${
                      actionMode === "ai-order"
                        ? "text-flikk-lime"
                        : "text-flikk-text-muted"
                    }`}
                  >
                    {t("action.aiOrder.menuTitle")}
                  </Text>
                  {actionMode !== "ai-order" && (
                    <Animated.View
                      style={{
                        transform: [
                          {
                            scale: aiPulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.2],
                            }),
                          },
                        ],
                      }}
                      className="ml-2 h-2 w-2 rounded-full bg-flikk-lime"
                    />
                  )}
                </View>
              </Pressable>
            </View>

            {actionMode === "publish" ? (
              <>
                {/* MEDIA SECTION */}
                <View className="flex-row gap-4 mb-8">
                  {/* PHOTO ARTICLE */}
                  <Pressable
                    onPress={() => setPickerMode("photo")}
                    className="flex-1 aspect-square rounded-3xl border border-dashed border-white/20 bg-white/5 overflow-hidden items-center justify-center"
                  >
                    {itemPhoto ? (
                      <Image
                        source={{ uri: itemPhoto }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="items-center">
                        <Ionicons
                          name="image-outline"
                          size={32}
                          color="#666666"
                        />
                        <Text className="text-[10px] uppercase font-bold text-flikk-text-muted mt-2 tracking-widest text-center px-2">
                          {t("action.pickPhoto")}
                          <Text className="text-[#FF4D6D]"> *</Text>
                        </Text>
                      </View>
                    )}
                    {itemPhoto && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setItemPhoto(null);
                        }}
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                      >
                        <Ionicons name="trash" size={12} color="#FF4D6D" />
                      </Pressable>
                    )}
                    {itemPhoto && (
                      <View className="absolute bottom-2 right-2 bg-flikk-lime rounded-full p-1">
                        <Ionicons name="checkmark" size={12} color="black" />
                      </View>
                    )}
                  </Pressable>

                  {/* VIDEO COMMERCIALE */}
                  <Pressable
                    onPress={() => setPickerMode("video")}
                    className="flex-1 aspect-square rounded-3xl border border-dashed border-white/20 bg-white/5 overflow-hidden items-center justify-center"
                  >
                    {commercialVideo ? (
                      <View className="h-full w-full items-center justify-center bg-black">
                        <View className="h-full w-[56.25%] overflow-hidden bg-black">
                          <VideoView
                            player={draftVideoPlayer}
                            contentFit="cover"
                            nativeControls={false}
                            style={{ width: "100%", height: "100%" }}
                          />
                        </View>
                      </View>
                    ) : (
                      <View className="items-center">
                        <Ionicons
                          name="videocam-outline"
                          size={32}
                          color="#666666"
                        />
                        <Text className="text-[10px] uppercase font-bold mt-2 tracking-widest text-center px-2 text-flikk-text-muted">
                          {t("action.pickVideo")}
                          <Text className="text-[#FF4D6D]"> *</Text>
                        </Text>
                      </View>
                    )}
                    {commercialVideo && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setCommercialVideo(null);
                        }}
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                      >
                        <Ionicons name="trash" size={12} color="#FF4D6D" />
                      </Pressable>
                    )}
                    {commercialVideo && (
                      <View className="absolute bottom-2 right-2 bg-flikk-lime rounded-full p-1">
                        <Ionicons name="play" size={12} color="black" />
                      </View>
                    )}
                  </Pressable>
                </View>

                {/* INPUTS SECTION */}
                <View className="gap-6">
                  {/* NOM DU PRODUIT */}
                  <View>
                    <Text className="text-sm font-bold text-flikk-text-muted mb-3 uppercase tracking-widest pl-1">
                      {t("action.inputProductName")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>
                    <TextInput
                      className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                      placeholder={t("action.placeholders.productName")}
                      placeholderTextColor="#666666"
                      value={productName}
                      onChangeText={setProductName}
                      selectionColor="#CCFF00"
                    />
                  </View>

                  {/* TITRE */}
                  <View>
                    <Text className="text-sm font-bold text-flikk-text-muted mb-3 uppercase tracking-widest pl-1">
                      {t("action.inputTitle")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>
                    <TextInput
                      className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                      placeholder={t("action.placeholders.title")}
                      placeholderTextColor="#666666"
                      value={title}
                      onChangeText={setTitle}
                      selectionColor="#CCFF00"
                    />
                  </View>

                  {/* PRIX */}
                  <View>
                    <Text className="text-sm font-bold text-flikk-text-muted mb-3 uppercase tracking-widest pl-1">
                      {t("action.inputPrice")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>
                    <View className="flex-row items-center h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4">
                      <TextInput
                        className="flex-1 font-body text-base text-flikk-text"
                        placeholder={t("action.placeholders.price")}
                        placeholderTextColor="#666666"
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="numeric"
                        selectionColor="#CCFF00"
                      />
                      <Text className="text-flikk-lime font-bold ml-2">
                        CFA
                      </Text>
                    </View>
                  </View>

                  {/* HASHTAGS */}
                  <View>
                    <Text className="text-sm font-bold text-flikk-text-muted mb-3 uppercase tracking-widest pl-1">
                      {t("action.inputHashtags")}
                    </Text>
                    <TextInput
                      className="h-24 w-full rounded-2xl border border-white/10 bg-flikk-card p-4 font-body text-base text-flikk-text"
                      placeholder={t("action.placeholders.hashtags")}
                      placeholderTextColor="#666666"
                      value={hashtags}
                      onChangeText={setHashtags}
                      multiline
                      textAlignVertical="top"
                      selectionColor="#CCFF00"
                    />
                  </View>
                </View>

                {/* BOUTON PUBLIER */}
                <Pressable
                  className={`mt-10 h-16 items-center justify-center rounded-full bg-flikk-lime shadow-lg shadow-flikk-lime/20 ${
                    !productName ||
                    !title ||
                    !price ||
                    !itemPhoto ||
                    !commercialVideo
                      ? "opacity-30"
                      : "active:scale-[0.98]"
                  }`}
                  onPress={handlePublish}
                  disabled={
                    !productName ||
                    !title ||
                    !price ||
                    !itemPhoto ||
                    !commercialVideo ||
                    isPublishing
                  }
                >
                  {isPublishing ? (
                    <ActivityIndicator color="#121212" />
                  ) : (
                    <View className="flex-row items-center">
                      <Text className="font-display text-lg text-flikk-dark mr-2">
                        {t("action.publish")}
                      </Text>
                      <Feather name="send" size={20} color="#121212" />
                    </View>
                  )}
                </Pressable>
              </>
            ) : (
              <View>
                {/* AI VIDEO FORM */}
                <Text className="font-display text-2xl text-flikk-text mb-2">
                  {t("action.aiOrder.formTitle")}
                </Text>
                <Text className="font-body text-sm text-flikk-text-muted mb-8 leading-5">
                  {t("action.aiOrder.formSubtitle")}
                </Text>

                {/* PHOTOS FOR AI */}
                <View className="flex-row gap-4 mb-8">
                  <Pressable
                    onPress={() => setPickerMode("ai-photo-1")}
                    className="flex-1 aspect-square rounded-3xl border border-dashed border-white/20 bg-white/5 overflow-hidden items-center justify-center"
                  >
                    {aiImageOne ? (
                      <Image
                        source={{ uri: aiImageOne }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="items-center">
                        <Ionicons
                          name="camera-outline"
                          size={32}
                          color="#666666"
                        />
                        <Text className="text-[10px] uppercase font-bold text-flikk-text-muted mt-2 tracking-widest text-center px-1">
                          {t("action.aiOrder.photo1")}
                        </Text>
                      </View>
                    )}
                    {aiImageOne && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setAiImageOne(null);
                        }}
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                      >
                        <Ionicons name="trash" size={12} color="#FF4D6D" />
                      </Pressable>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => setPickerMode("ai-photo-2")}
                    className="flex-1 aspect-square rounded-3xl border border-dashed border-white/20 bg-white/5 overflow-hidden items-center justify-center"
                  >
                    {aiImageTwo ? (
                      <Image
                        source={{ uri: aiImageTwo }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="items-center">
                        <Ionicons
                          name="camera-outline"
                          size={32}
                          color="#666666"
                        />
                        <Text className="text-[10px] uppercase font-bold text-flikk-text-muted mt-2 tracking-widest text-center px-1">
                          {t("action.aiOrder.photo2")}
                        </Text>
                      </View>
                    )}
                    {aiImageTwo && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setAiImageTwo(null);
                        }}
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                      >
                        <Ionicons name="trash" size={12} color="#FF4D6D" />
                      </Pressable>
                    )}
                  </Pressable>
                </View>

                {/* EXPECTED CONTENT */}
                <View className="mb-6">
                  <Text className="text-sm font-bold text-flikk-text-muted mb-3 uppercase tracking-widest pl-1">
                    {t("action.aiOrder.contentLabel")}
                  </Text>
                  <TextInput
                    className="h-32 w-full rounded-2xl border border-white/10 bg-flikk-card p-4 font-body text-base text-flikk-text"
                    placeholder={t("action.aiOrder.contentPlaceholder")}
                    placeholderTextColor="#666666"
                    value={aiExpectedContent}
                    onChangeText={setAiExpectedContent}
                    multiline
                    textAlignVertical="top"
                    selectionColor="#CCFF00"
                  />
                </View>

                {/* FORMAT SELECTOR */}
                <View className="mb-6">
                  <Text className="text-sm font-bold text-flikk-text-muted mb-3 uppercase tracking-widest pl-1">
                    {t("action.aiOrder.formatLabel")}
                  </Text>
                  <View className="flex-row gap-3">
                    {(["9:16", "16:9"] as AiVideoFormat[]).map((fmt) => (
                      <Pressable
                        key={fmt}
                        onPress={() => setAiFormat(fmt)}
                        className={`flex-1 h-14 rounded-2xl border items-center justify-center ${
                          aiFormat === fmt
                            ? "border-flikk-lime bg-flikk-lime/5"
                            : "border-white/10 bg-flikk-card"
                        }`}
                      >
                        <View className="flex-row items-center gap-2">
                          <Ionicons
                            name="phone-portrait-outline"
                            size={16}
                            color={aiFormat === fmt ? "#CCFF00" : "#FFFFFF"}
                            style={
                              fmt === "16:9"
                                ? { transform: [{ rotate: "90deg" }] }
                                : {}
                            }
                          />
                          <Text
                            className={`font-bold ${
                              aiFormat === fmt
                                ? "text-flikk-lime"
                                : "text-flikk-text"
                            }`}
                          >
                            {fmt}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* RECEPTION METHOD */}
                <View className="mb-8">
                  <Text className="text-sm font-bold text-flikk-text-muted mb-3 uppercase tracking-widest pl-1">
                    {t("action.aiOrder.receptionLabel")}
                  </Text>
                  <View className="flex-row gap-3 mb-4">
                    {(["whatsapp", "email"] as const).map((method) => (
                      <Pressable
                        key={method}
                        onPress={() => setAiReceptionMethod(method)}
                        className={`flex-1 h-14 rounded-2xl border items-center justify-center ${
                          aiReceptionMethod === method
                            ? "border-flikk-lime bg-flikk-lime/5"
                            : "border-white/10 bg-flikk-card"
                        }`}
                      >
                        <Text
                          className={`font-bold ${
                            aiReceptionMethod === method
                              ? "text-flikk-lime"
                              : "text-flikk-text"
                          }`}
                        >
                          {t(`action.aiOrder.${method}`)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {aiReceptionMethod === "whatsapp" ? (
                    <TextInput
                      className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                      placeholder="90 00 00 00"
                      placeholderTextColor="#666666"
                      value={aiWhatsapp}
                      onChangeText={setAiWhatsapp}
                      keyboardType="phone-pad"
                      selectionColor="#CCFF00"
                    />
                  ) : (
                    <TextInput
                      className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                      placeholder="email@example.com"
                      placeholderTextColor="#666666"
                      value={aiEmail}
                      onChangeText={setAiEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      selectionColor="#CCFF00"
                    />
                  )}
                </View>

                {/* INFO PRIX */}
                <View className="bg-white/5 rounded-2xl p-4 mb-8 border border-white/5">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="font-bold text-flikk-text">
                      {freeVideosLeft > 0
                        ? t("action.aiOrder.priceFree")
                        : t("action.aiOrder.pricePaid", {
                            price: AI_VIDEO_BASE_PRICE,
                          })}
                    </Text>
                    <Ionicons
                      name={freeVideosLeft > 0 ? "gift" : "card-outline"}
                      size={18}
                      color={freeVideosLeft > 0 ? "#CCFF00" : "#A87FF3"}
                    />
                  </View>
                  <Text className="text-xs text-flikk-text-muted">
                    {freeVideosLeft > 0
                      ? t("action.aiOrder.freeRemaining", {
                          count: freeVideosLeft,
                        })
                      : t("action.aiOrder.limitReached")}
                  </Text>
                </View>

                {/* SUBMIT AI */}
                <Pressable
                  className={`h-16 items-center justify-center rounded-full bg-flikk-lime shadow-lg shadow-flikk-lime/20 ${
                    !aiImageOne ||
                    !aiImageTwo ||
                    !aiExpectedContent ||
                    isAiSubmitting
                      ? "opacity-30"
                      : "active:scale-[0.98]"
                  }`}
                  onPress={handleAiSubmit}
                  disabled={
                    !aiImageOne ||
                    !aiImageTwo ||
                    !aiExpectedContent ||
                    isAiSubmitting
                  }
                >
                  {isAiSubmitting ? (
                    <ActivityIndicator color="#121212" />
                  ) : (
                    <View className="flex-row items-center">
                      <Text className="font-display text-lg text-flikk-dark mr-2">
                        {t("action.aiOrder.submit")}
                      </Text>
                      <Ionicons name="sparkles" size={20} color="#121212" />
                    </View>
                  )}
                </Pressable>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* MEDIA PICKER MODAL */}
      <MediaPicker
        isVisible={!!pickerMode}
        onClose={() => setPickerMode(null)}
        mediaTypes={
          pickerMode === "photo" ||
          pickerMode === "ai-photo-1" ||
          pickerMode === "ai-photo-2"
            ? ["photo"]
            : ["video"]
        }
        onSelect={async (uri, type, meta) => {
          if (pickerMode === "photo") {
            setItemPhoto(uri);
          } else if (pickerMode === "ai-photo-1") {
            setAiImageOne(uri);
          } else if (pickerMode === "ai-photo-2") {
            setAiImageTwo(uri);
          } else {
            const videoSize = meta?.fileSize ?? 0;
            if (videoSize > MAX_VIDEO_BYTES) {
              Toast.show({
                type: "error",
                position: "top",
                text1: t("action.videoTooLargeTitle"),
                text2: t("action.videoTooLargeBody"),
                visibilityTime: 3000,
                topOffset: 52,
              });
              setPickerMode(null);
              return;
            }

            setCommercialVideo(uri);
          }
          setPickerMode(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}
