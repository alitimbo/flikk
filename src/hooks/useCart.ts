import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CartService } from "@/services/firebase/cart-service";
import type { CartItem, CartResolvedItem, Publication, UserProfile } from "@/types";

type ResolvedCart = {
  items: CartResolvedItem[];
  count: number;
  total: number;
  validForCheckout: { cart: CartItem; publication: Publication }[];
};

export function useCart(uid?: string | null) {
  const queryClient = useQueryClient();

  const cartQuery = useQuery({
    queryKey: ["cart", uid],
    queryFn: () => (uid ? CartService.getCartItems(uid) : Promise.resolve([])),
    enabled: !!uid,
  });

  const resolvedQuery = useQuery({
    queryKey: ["cartResolved", uid, cartQuery.data?.map((i) => i.publicationId).join(",")],
    queryFn: async (): Promise<ResolvedCart> => {
      const rawItems = cartQuery.data ?? [];
      const ids = rawItems.map((i) => i.publicationId);
      const pubMap = await CartService.getPublicationMap(ids);

      const items: CartResolvedItem[] = rawItems.map((cart) => {
        const live = pubMap.get(cart.publicationId);
        const isUnavailable = !live || live.status !== "ready";
        const livePrice = Number(live?.price ?? cart.priceAtAdd ?? 0);
        const liveProductName = live?.productName ?? cart.productName;
        const liveImageUrl = live?.imageUrl ?? cart.imageUrl;
        return {
          ...cart,
          livePrice,
          liveProductName,
          liveImageUrl,
          isUnavailable,
          isPriceChanged: !isUnavailable && livePrice !== Number(cart.priceAtAdd ?? 0),
        };
      });

      const count = items.reduce((acc, i) => acc + Math.max(1, i.quantity), 0);
      const total = items
        .filter((i) => !i.isUnavailable)
        .reduce((acc, i) => acc + i.livePrice * Math.max(1, i.quantity), 0);

      const validForCheckout = rawItems
        .map((cart) => ({
          cart,
          publication: pubMap.get(cart.publicationId),
        }))
        .filter((x): x is { cart: CartItem; publication: Publication } =>
          Boolean(x.publication && x.publication.status === "ready"),
        );

      return { items, count, total, validForCheckout };
    },
    enabled: !!uid && !!cartQuery.data,
  });

  useEffect(() => {
    if (cartQuery.error) {
      console.log("[useCart] cartQuery error:", cartQuery.error);
    }
  }, [cartQuery.error]);

  useEffect(() => {
    if (resolvedQuery.error) {
      console.log("[useCart] resolvedQuery error:", resolvedQuery.error);
    }
  }, [resolvedQuery.error]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cart", uid] });
    await queryClient.invalidateQueries({ queryKey: ["cartResolved", uid] });
  };

  const addMutation = useMutation({
    mutationFn: async (publication: Publication) => {
      if (!uid) throw new Error("Auth required");
      await CartService.upsertItem(uid, publication, 1);
    },
    onSuccess: invalidate,
    onError: (error) => {
      console.log("[useCart] addToCart error:", error);
    },
  });

  const setQtyMutation = useMutation({
    mutationFn: async ({
      publicationId,
      quantity,
    }: {
      publicationId: string;
      quantity: number;
    }) => {
      if (!uid) throw new Error("Auth required");
      await CartService.setQuantity(uid, publicationId, quantity);
    },
    onMutate: async ({ publicationId, quantity }) => {
      if (!uid) return { previousCart: undefined as CartItem[] | undefined };
      await queryClient.cancelQueries({ queryKey: ["cart", uid] });
      const previousCart = queryClient.getQueryData<CartItem[]>(["cart", uid]);
      queryClient.setQueryData<CartItem[]>(["cart", uid], (current) => {
        const source = current ?? [];
        if (quantity <= 0) {
          return source.filter((item) => item.publicationId !== publicationId);
        }
        let found = false;
        const next = source.map((item) => {
          if (item.publicationId !== publicationId) return item;
          found = true;
          return { ...item, quantity: Math.max(1, quantity) };
        });
        if (!found) return source;
        return next;
      });
      return { previousCart };
    },
    onError: (error, _variables, context) => {
      if (uid && context?.previousCart) {
        queryClient.setQueryData(["cart", uid], context.previousCart);
      }
      console.log("[useCart] setQuantity error:", error);
    },
    onSettled: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (publicationId: string) => {
      if (!uid) throw new Error("Auth required");
      await CartService.removeItem(uid, publicationId);
    },
    onMutate: async (publicationId: string) => {
      if (!uid) return { previousCart: undefined as CartItem[] | undefined };
      await queryClient.cancelQueries({ queryKey: ["cart", uid] });
      const previousCart = queryClient.getQueryData<CartItem[]>(["cart", uid]);
      queryClient.setQueryData<CartItem[]>(["cart", uid], (current) =>
        (current ?? []).filter((item) => item.publicationId !== publicationId),
      );
      return { previousCart };
    },
    onError: (error, _variables, context) => {
      if (uid && context?.previousCart) {
        queryClient.setQueryData(["cart", uid], context.previousCart);
      }
      console.log("[useCart] removeItem error:", error);
    },
    onSettled: invalidate,
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({
      userProfile,
      phoneNumber,
    }: {
      userProfile: UserProfile | null;
      phoneNumber?: string | null;
    }) => {
      if (!uid) throw new Error("Auth required");
      const payload = resolvedQuery.data?.validForCheckout ?? [];
      if (payload.length === 0) throw new Error("Cart empty");
      return CartService.checkoutManual(uid, userProfile, phoneNumber, payload);
    },
    onSuccess: invalidate,
    onError: (error) => {
      console.log("[useCart] checkout error:", error);
    },
  });

  const inCartSet = useMemo(
    () => new Set((cartQuery.data ?? []).map((i) => i.publicationId)),
    [cartQuery.data],
  );

  return {
    items: resolvedQuery.data?.items ?? [],
    count: resolvedQuery.data?.count ?? 0,
    total: resolvedQuery.data?.total ?? 0,
    inCartSet,
    isLoading: cartQuery.isLoading || resolvedQuery.isLoading,
    isRefreshing: cartQuery.isRefetching || resolvedQuery.isRefetching,
    refetch: async () => {
      await cartQuery.refetch();
      await resolvedQuery.refetch();
    },
    addToCart: addMutation.mutateAsync,
    setQuantity: setQtyMutation.mutateAsync,
    removeItem: removeMutation.mutateAsync,
    checkout: checkoutMutation.mutateAsync,
    isCheckoutPending: checkoutMutation.isPending,
    isItemMutating:
      addMutation.isPending ||
      setQtyMutation.isPending ||
      removeMutation.isPending,
    isMutating:
      addMutation.isPending ||
      setQtyMutation.isPending ||
      removeMutation.isPending ||
      checkoutMutation.isPending,
    checkoutResult: checkoutMutation.data,
  };
}
