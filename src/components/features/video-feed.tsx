import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  ViewToken,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Publication } from "@/types";
import { FeedItem } from "@/components/feed/FeedItem";
import { useFeed } from "@/hooks/useFeed";
import { useFocusEffect } from "expo-router";

const TAB_BAR_HEIGHT = 72;
const AUTO_ADVANCE_IDLE_MS = 3000;

export default function VideoFeed() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const {
    publications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useFeed();
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const listRef = useRef<FlashList<Publication>>(null);
  const lastInteractionRef = useRef(0);
  const pendingAdvanceIndexRef = useRef<number | null>(null);

  const ITEM_HEIGHT = screenHeight - TAB_BAR_HEIGHT - insets.bottom;

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const setActiveIdSafe = useCallback((nextId: string | null) => {
    if (nextId && activeIdRef.current !== nextId) {
      activeIdRef.current = nextId;
      setActiveId(nextId);
    }
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;

      const mostVisible = [...viewableItems]
        .filter((item) => item.isViewable && item.item?.id)
        .sort(
          (a, b) => (b.percentVisible ?? 0) - (a.percentVisible ?? 0),
        )[0];

      if (mostVisible?.item?.id) {
        setActiveIdSafe(mostVisible.item.id);
        if (__DEV__) {
          console.log("Viewable change", {
            id: mostVisible.item.id,
            index: mostVisible.index,
          });
        }
      }
    },
    [setActiveIdSafe],
  );

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 80,
    }),
    [],
  );

  const viewabilityConfigCallbackPairs = useMemo(
    () => [{ viewabilityConfig, onViewableItemsChanged }],
    [viewabilityConfig, onViewableItemsChanged],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Publication; index: number }) => (
      <View style={{ height: ITEM_HEIGHT }}>
        <FeedItem
          publication={item}
          isActive={item.id === activeId}
          index={index}
          onUserAction={() => {
            lastInteractionRef.current = Date.now();
          }}
          onRequestNext={(currentIndex) => {
            const idleFor =
              Date.now() - (lastInteractionRef.current || 0);
            if (idleFor < AUTO_ADVANCE_IDLE_MS) return;

            const nextIndex = currentIndex + 1;
            if (nextIndex < publications.length) {
              listRef.current?.scrollToIndex({
                index: nextIndex,
                animated: true,
              });
              return;
            }

            if (hasNextPage && !isFetchingNextPage) {
              pendingAdvanceIndexRef.current = nextIndex;
              void fetchNextPage();
            }
          }}
        />
      </View>
    ),
    [
      ITEM_HEIGHT,
      activeId,
      publications.length,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
    ],
  );

  useEffect(() => {
    if (!activeIdRef.current && publications.length > 0) {
      setActiveIdSafe(publications[0].id ?? null);
    }
  }, [publications, setActiveIdSafe]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        activeIdRef.current = null;
        setActiveId(null);
      };
    }, []),
  );

  useEffect(() => {
    if (pendingAdvanceIndexRef.current === null) return;
    const target = pendingAdvanceIndexRef.current;
    if (target < publications.length) {
      listRef.current?.scrollToIndex({ index: target, animated: true });
      pendingAdvanceIndexRef.current = null;
    }
  }, [publications.length]);

  return (
    <View className="flex-1 bg-flikk-dark">
      <FlashList
        ref={listRef}
        data={publications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id!}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        onRefresh={onRefresh}
        refreshing={isRefetching && !isFetchingNextPage}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={5}
        estimatedItemSize={ITEM_HEIGHT}
        disableRecycling={false}
        ListFooterComponent={() =>
          (isFetchingNextPage || isLoading) && !isRefetching ? (
            <View className="py-10">
              <ActivityIndicator color="#CCFF00" size="large" />
            </View>
          ) : null
        }
      />
    </View>
  );
}
