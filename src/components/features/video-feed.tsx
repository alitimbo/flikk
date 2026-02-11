import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ViewToken, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Publication } from "@/types";
import { FeedItem } from "@/components/feed/FeedItem";
import { useFeed } from "@/hooks/useFeed";
import { useFocusEffect } from "expo-router";
import { SkeletonFeedItem } from "@/components/ui/Skeleton";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { useFavorites } from "@/hooks/useFavorites";
import { useCart } from "@/hooks/useCart";

const TAB_BAR_HEIGHT = 72;
const AUTO_ADVANCE_IDLE_MS = 3000;

type VideoFeedProps = {
  initialId?: string;
};

export default function VideoFeed({ initialId }: VideoFeedProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [authUid, setAuthUid] = useState<string | undefined>(
    getAuth().currentUser?.uid,
  );
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
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  const listRef = useRef<FlashList<Publication>>(null);
  const lastInteractionRef = useRef(0);
  const pendingAdvanceIndexRef = useRef<number | null>(null);
  const initialTargetRef = useRef<string | null>(initialId ?? null);
  const initialScrollDoneRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setAuthUid(user?.uid);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initialId) {
      initialTargetRef.current = initialId;
      initialScrollDoneRef.current = false;
      activeIdRef.current = null;
      setActiveId(null);
    }
  }, [initialId]);

  const ITEM_HEIGHT = screenHeight - TAB_BAR_HEIGHT - insets.bottom;
  const publicationIds = useMemo(
    () => publications.map((item) => item.id!).filter(Boolean),
    [publications],
  );
  const { favoriteSet, toggleFavorite, isPending } = useFavorites(
    authUid,
    publicationIds,
  );
  const {
    count: cartCount,
    inCartSet,
    addToCart,
    isMutating: isCartMutating,
  } = useCart(authUid);

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
          isFavorited={favoriteSet.has(item.id ?? "")}
          isLikePending={isPending(item.id ?? "")}
          onToggleFavorite={() => toggleFavorite(item.id!)}
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
          onCommentsOpenChange={(isOpen) => setIsScrollLocked(isOpen)}
          onPaymentOpenChange={(isOpen) => setIsScrollLocked(isOpen)}
          cartCount={cartCount}
          isInCart={inCartSet.has(item.id ?? "")}
          isAddToCartPending={isCartMutating}
          onAddToCart={() => addToCart(item)}
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
      setIsScrollLocked,
      cartCount,
      inCartSet,
      isCartMutating,
      addToCart,
    ],
  );

  const attemptInitialScroll = useCallback(() => {
    if (publications.length === 0) return;
    if (initialScrollDoneRef.current) return;

    const targetId = initialTargetRef.current;
    if (targetId) {
      const targetIndex = publications.findIndex(
        (item) => item.id === targetId,
      );
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
    if (isWaitingForInitialTarget && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    } else {
      attemptInitialScroll();
    }
  }, [
    attemptInitialScroll,
    publications.length,
    isWaitingForInitialTarget,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  useEffect(() => {
    if (!initialId) return;
    if (initialScrollDoneRef.current) return;
    const index = publications.findIndex((item) => item.id === initialId);
    if (index >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index, animated: false });
        setActiveIdSafe(publications[index].id ?? null);
        initialScrollDoneRef.current = true;
      }, 80);
    }
  }, [initialId, publications, setActiveIdSafe]);

  const initialTargetIndex = useMemo(() => {
    if (!initialId) return -1;
    return publications.findIndex((item) => item.id === initialId);
  }, [initialId, publications]);

  const isWaitingForInitialTarget =
    !!initialId && !initialScrollDoneRef.current && initialTargetIndex < 0;

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
      {isWaitingForInitialTarget || (isLoading && publications.length === 0) ? (
        <SkeletonFeedItem height={ITEM_HEIGHT} />
      ) : (
        <FlashList
          ref={listRef}
          data={publications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id!}
          onContentSizeChange={() => {
            attemptInitialScroll();
          }}
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
          scrollEnabled={!isScrollLocked}
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
        maxToRenderPerBatch={1}
        windowSize={3}
        initialNumToRender={1}
        updateCellsBatchingPeriod={50}
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
