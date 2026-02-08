import { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, FontAwesome, Ionicons } from "@expo/vector-icons";

type Seller = {
  id: string;
  name: string;
  avatarUrl: string;
  followers: string;
};

type Product = {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
};

type VideoItem = {
  id: string;
  title: string;
  hashtags: string[];
  views: string;
  seller: Seller;
  product: Product;
};

const MOCK_VIDEOS: VideoItem[] = [
  {
    id: "video-1",
    title: "Destockage massif baskets Nike",
    hashtags: ["#sneakers", "#promo", "#nike"],
    views: "1.2k",
    seller: {
      id: "seller-1",
      name: "Aya Sports",
      avatarUrl:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=60",
      followers: "88k",
    },
    product: {
      id: "prod-1",
      name: "Nike Air Max Pulse",
      price: "79.000 FCFA",
      imageUrl:
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=60",
    },
  },
  {
    id: "video-2",
    title: "Showroom bijoux artisanaux",
    hashtags: ["#gold", "#handmade", "#dakar"],
    views: "860",
    seller: {
      id: "seller-2",
      name: "Noura Atelier",
      avatarUrl:
        "https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?w=200&auto=format&fit=crop&q=60",
      followers: "41k",
    },
    product: {
      id: "prod-2",
      name: "Collier Rania",
      price: "45.000 FCFA",
      imageUrl:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=60",
    },
  },
  {
    id: "video-3",
    title: "Parfums exclusifs en promo",
    hashtags: ["#parfum", "#nouveaute", "#livraison"],
    views: "2.6k",
    seller: {
      id: "seller-3",
      name: "Maison Scent",
      avatarUrl:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=60",
      followers: "102k",
    },
    product: {
      id: "prod-3",
      name: "Essence Noir",
      price: "32.500 FCFA",
      imageUrl:
        "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=300&auto=format&fit=crop&q=60",
    },
  },
];

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const TAB_BAR_HEIGHT = 72;

export default function VideoFeed() {
  const insets = useSafeAreaInsets();
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const sheetDragY = useRef(new Animated.Value(0)).current;

  const ITEM_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT - insets.bottom;

  const openSheet = useCallback(() => {
    setIsSheetOpen(true);
    sheetDragY.setValue(0);
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [sheetDragY, sheetTranslateY]);

  const closeSheet = useCallback(() => {
    sheetDragY.setValue(0);
    Animated.timing(sheetTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setIsSheetOpen(false));
  }, [sheetDragY, sheetTranslateY]);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > Math.abs(gesture.dx) && gesture.dy > 2,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          sheetDragY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldClose = gesture.dy > 120 || gesture.vy > 1;
        if (shouldClose) {
          closeSheet();
        } else {
          Animated.spring(sheetDragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const toggleLike = useCallback((videoId: string) => {
    setLikes((prev) => ({
      ...prev,
      [videoId]: (prev[videoId] ?? 0) + 1,
    }));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: VideoItem }) => {
      const likeCount = likes[item.id] ?? 0;

      return (
        <View style={{ height: ITEM_HEIGHT }} className="w-full bg-flikk-dark">
          <View className="absolute inset-0 items-center justify-center bg-[#1a1a1a]">
            <Ionicons
              name="play-circle-outline"
              size={64}
              color="rgba(255,255,255,0.5)"
            />
            <Text className="mt-4 px-8 text-center font-body text-sm text-flikk-text-muted">
              {item.title}
            </Text>
          </View>

          <View className="absolute left-0 right-0 top-0 h-28" pointerEvents="none">
            <View
              className="flex-1"
              style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
            />
          </View>

          <View className="absolute bottom-0 left-0 right-0 h-[45%]" pointerEvents="none">
            <View
              className="flex-1"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            />
          </View>

          <View
            className="absolute inset-0 justify-between px-4"
            style={{ paddingTop: insets.top + 12, paddingBottom: 16 }}
          >
            <View className="flex-row items-center justify-end">
              <View className="flex-row items-center rounded-full bg-black/50 px-3 py-1.5">
                <Feather name="eye" size={14} color="#FFFFFF" />
                <Text className="ml-1.5 font-body text-xs text-flikk-text">
                  {item.views} vues
                </Text>
              </View>
            </View>

            <View className="flex-1 flex-row items-end justify-between">
              <View className="max-w-[70%]">
                <Text className="font-display text-lg text-flikk-text">
                  {item.title}
                </Text>
                <Text className="mt-2 font-body text-[13px] text-flikk-purple">
                  {item.hashtags.join(" ")}
                </Text>
              </View>

              <View className="items-center">
                <View className="items-center">
                  <View className="relative items-center">
                    <Image
                      source={{ uri: item.seller.avatarUrl }}
                      className="h-[52px] w-[52px] rounded-full border-2 border-flikk-purple"
                    />
                    <Pressable className="absolute -bottom-2 rounded-full bg-flikk-lime p-1">
                      <Feather name="plus" size={12} color="#121212" />
                    </Pressable>
                  </View>
                  <Text className="mt-1.5 font-body text-[11px] text-flikk-text">
                    {item.seller.followers}
                  </Text>
                </View>

                <Pressable
                  className="mt-5 items-center"
                  onPress={() => toggleLike(item.id)}
                >
                  <FontAwesome
                    name={likeCount > 0 ? "heart" : "heart-o"}
                    size={26}
                    color={likeCount > 0 ? "#FF4D6D" : "#FFFFFF"}
                  />
                  <Text className="mt-1.5 font-body text-[11px] text-flikk-text">
                    {likeCount}
                  </Text>
                </Pressable>

                <Pressable className="mt-5 items-center">
                  <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
                  <Text className="mt-1.5 font-body text-[11px] text-flikk-text">
                    23
                  </Text>
                </Pressable>

                <Pressable className="mt-5 items-center">
                  <Feather name="send" size={22} color="#FFFFFF" />
                  <Text className="mt-1.5 font-body text-[11px] text-flikk-text">
                    Partager
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="mt-6">
              <View className="rounded-2xl border border-white/10 bg-flikk-card/90 p-4">
                <View className="flex-row items-center">
                  <Image
                    source={{ uri: item.product.imageUrl }}
                    className="h-14 w-14 rounded-xl"
                  />
                  <View className="ml-3.5 flex-1">
                    <Text className="font-body text-sm text-flikk-text">
                      {item.product.name}
                    </Text>
                    <Text className="mt-1 font-display text-base text-flikk-lime">
                      {item.product.price}
                    </Text>
                  </View>
                </View>
                <Pressable
                  className="mt-3.5 items-center rounded-full bg-flikk-lime py-3"
                  onPress={openSheet}
                >
                  <Text className="font-display text-sm text-flikk-dark">
                    Acheter maintenant
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [ITEM_HEIGHT, insets.top, likes, openSheet, toggleLike]
  );

  const keyExtractor = useCallback((item: VideoItem) => item.id, []);

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 80 }),
    []
  );

  return (
    <View className="flex-1 bg-flikk-dark">
      <FlashList
        data={MOCK_VIDEOS}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        estimatedItemSize={ITEM_HEIGHT}
        viewabilityConfig={viewabilityConfig}
        getItemType={() => "video"}
      />

      {isSheetOpen ? (
        <Pressable
          className="absolute inset-0 bg-black/40"
          onPress={closeSheet}
        />
      ) : null}

      <Animated.View
        className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-flikk-card px-5 pt-4"
        style={{
          transform: [
            { translateY: Animated.add(sheetTranslateY, sheetDragY) },
          ],
          paddingBottom: insets.bottom + 24,
        }}
        {...sheetPanResponder.panHandlers}
      >
        <View className="mx-auto h-1 w-12 rounded-full bg-white/20" />
        <Text className="mt-4 font-display text-lg text-flikk-text">
          Acheter ce produit
        </Text>
        <Text className="mt-2 font-body text-[13px] text-flikk-text-muted">
          Finalisez votre achat rapidement.
        </Text>
        <View className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <Text className="font-body text-sm text-flikk-text">
            Mobile Money - Livraison 24h
          </Text>
          <Text className="mt-1 font-body text-xs text-flikk-text-muted">
            Total estime: 82.500 FCFA
          </Text>
        </View>
        <Pressable className="mt-4 items-center rounded-full bg-flikk-lime py-3.5">
          <Text className="font-display text-sm text-flikk-dark">
            Confirmer le paiement
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
