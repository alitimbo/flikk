import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  View,
  ActivityIndicator,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Publication } from "@/types";
import { PublicationService } from "@/services/firebase/publication-service";
import { FeedItem } from "@/components/feed/FeedItem";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const TAB_BAR_HEIGHT = 72;

export default function VideoFeed() {
  const insets = useSafeAreaInsets();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [lastDoc, setLastDoc] =
    useState<FirebaseFirestoreTypes.QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const ITEM_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT - insets.bottom;

  const fetchFeed = useCallback(
    async (isRefresh = false) => {
      if (loading) return;
      setLoading(true);

      try {
        const res = await PublicationService.getFeed(
          isRefresh ? undefined : lastDoc || undefined,
        );

        if (isRefresh) {
          setPublications(res.publications);
        } else {
          setPublications((prev) => [...prev, ...res.publications]);
        }

        setLastDoc(res.lastDoc);

        if (
          res.publications.length > 0 &&
          (isRefresh || publications.length === 0)
        ) {
          setActiveId(res.publications[0].id!);
        }
      } catch (error) {
        console.error("Flikk Feed Error:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [lastDoc, loading, publications.length],
  );

  useEffect(() => {
    fetchFeed(true);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFeed(true);
  }, [fetchFeed]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const firstVisible = viewableItems[0];
        if (firstVisible.item && firstVisible.index !== null) {
          setActiveId(firstVisible.item.id);
        }
      }
    },
  ).current;

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 80,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: Publication }) => (
      <View style={{ height: ITEM_HEIGHT }}>
        <FeedItem publication={item} isActive={item.id === activeId} />
      </View>
    ),
    [ITEM_HEIGHT, activeId],
  );

  return (
    <View className="flex-1 bg-black">
      <FlatList
        data={publications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id!}
        pagingEnabled
        vertical
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onEndReached={() => fetchFeed()}
        onEndReachedThreshold={0.5}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
        ListFooterComponent={() =>
          loading && !refreshing ? (
            <View className="py-10">
              <ActivityIndicator color="#CCFF00" size="large" />
            </View>
          ) : null
        }
      />
    </View>
  );
}
