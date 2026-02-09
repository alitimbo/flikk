import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ViewToken, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Publication } from "@/types";
import { FeedItem } from "@/components/feed/FeedItem";
import { useFeed } from "@/hooks/useFeed";
import { useFocusEffect } from "expo-router";
import { SkeletonFeedItem } from "@/components/ui/Skeleton";

const TAB_BAR_HEIGHT = 72;
const AUTO_ADVANCE_IDLE_MS = 3000;

type VideoFeedProps = {
  initialId?: string;
};

export default function VideoFeed({ initialId }: VideoFeedProps) {
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
  const initialTargetRef = useRef<string | null>(initialId ?? null);
  const initialScrollDoneRef = useRef(false);

  useEffect(() => {
    if (initialId) {
      initialTargetRef.current = initialId;
      initialScrollDoneRef.current = false;
      activeIdRef.current = null;
      setActiveId(null);
    }
  }, [initialId]);

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

  const attemptInitialScroll = useCallback(() => {
    if (publications.length === 0) return;
    if (initialScrollDoneRef.current) return;

    const targetId = initialTargetRef.current;
    if (targetId) {
      const targetIndex = publications.findIndex((item) => item.id === targetId);
      if (targetIndex >= 0) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({
            index: targetIndex,
            animated: false,
          });
          setActiveIdSafe(publications[targetIndex].id ?? null);
          initialScrollDoneRef.current = true;
        });
        return;
      }
      if (hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
      return;
    }

    if (!activeIdRef.current) {
      setActiveIdSafe(publications[0].id ?? null);
      initialScrollDoneRef.current = true;
    }
  }, [
    publications,
    setActiveIdSafe,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  useEffect(() => {
    attemptInitialScroll();
  }, [attemptInitialScroll, publications.length]);

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
      {isLoading && publications.length === 0 ? (
        <SkeletonFeedItem height={ITEM_HEIGHT} />
      ) : (
        <FlashList
          ref={listRef}
          data={publications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id!}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index,
                animated: false,
              });
            }, 120);
          }}
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
            isFetchingNextPage ? (
              <SkeletonFeedItem height={ITEM_HEIGHT} />
            ) : null
          }
        />
      )}
    </View>
  );
}
