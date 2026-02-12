import { useState, useCallback, useEffect } from "react";
import {
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
} from "react-native";
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

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const PUBLISH_SUCCESS_SOUND = require("@/assets/sounds/publish-success.mp3");

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

  // --- ÉTATS DU PICKER ---
  const [pickerMode, setPickerMode] = useState<"photo" | "video" | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
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
          .map((h) => h.trim()),
        imageUrl: photoRes.downloadUrl,
        videoUrl: videoRes.downloadUrl,
        merchantName,
        merchantLogoUrl,
        status: "pending",
      });

      console.log("Publication created with ID:", pubId);

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
        successSoundPlayer.replay();
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

  if (!authUser) {
    return (
      <View
        className="flex-1 bg-flikk-dark"
        style={{ paddingTop: insets.top }}
      >
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
      <View
        className="flex-1 bg-flikk-dark"
        style={{ paddingTop: insets.top }}
      >
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
            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <Ionicons name="ellipsis-horizontal" size={20} color="white" />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
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
                    <Ionicons name="image-outline" size={32} color="#666666" />
                    <Text className="text-[10px] uppercase font-bold text-flikk-text-muted mt-2 tracking-widest text-center px-2">
                      {t("action.pickPhoto")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>
                  </View>
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
                    <Ionicons name="videocam-outline" size={32} color="#666666" />
                    <Text className="text-[10px] uppercase font-bold mt-2 tracking-widest text-center px-2 text-flikk-text-muted">
                      {t("action.pickVideo")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>
                  </View>
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
                  <Text className="text-flikk-lime font-bold ml-2">CFA</Text>
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

            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* MEDIA PICKER MODAL */}
      <MediaPicker
        isVisible={!!pickerMode}
        onClose={() => setPickerMode(null)}
        mediaTypes={pickerMode === "photo" ? ["photo"] : ["video"]}
        onSelect={async (uri, type, meta) => {
          if (pickerMode === "photo") {
            setItemPhoto(uri);
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

