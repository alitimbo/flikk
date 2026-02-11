import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FollowService } from "@/services/firebase/follow-service";
import { OrderService } from "@/services/firebase/order-service";

export function useMerchantEngagement(
  merchantId: string | undefined,
  viewerId: string | undefined,
) {
  const queryClient = useQueryClient();

  const followerCountQuery = useQuery({
    queryKey: ["merchantFollowerCount", merchantId],
    queryFn: () =>
      merchantId ? FollowService.getFollowerCount(merchantId) : Promise.resolve(0),
    enabled: !!merchantId,
  });

  const orderCountQuery = useQuery({
    queryKey: ["merchantOrderCount", merchantId],
    queryFn: () =>
      merchantId ? OrderService.getMerchantOrderCount(merchantId) : Promise.resolve(0),
    enabled: !!merchantId,
  });

  const isFollowingQuery = useQuery({
    queryKey: ["merchantIsFollowing", merchantId, viewerId],
    queryFn: () =>
      merchantId && viewerId
        ? FollowService.isFollowing(merchantId, viewerId)
        : Promise.resolve(false),
    enabled: !!merchantId && !!viewerId && merchantId !== viewerId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!merchantId || !viewerId) {
        throw new Error("Missing merchantId or viewerId");
      }
      return FollowService.toggleFollow(merchantId, viewerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["merchantFollowerCount", merchantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["merchantIsFollowing", merchantId, viewerId],
      });
      queryClient.invalidateQueries({ queryKey: ["userProfile", merchantId] });
    },
  });

  const isLoading =
    followerCountQuery.isLoading ||
    orderCountQuery.isLoading ||
    isFollowingQuery.isLoading;

  return useMemo(
    () => ({
      followerCount: followerCountQuery.data ?? 0,
      orderCount: orderCountQuery.data ?? 0,
      isFollowing: isFollowingQuery.data ?? false,
      isLoading,
      followerCountError: followerCountQuery.error,
      orderCountError: orderCountQuery.error,
      isFollowingError: isFollowingQuery.error,
      toggleFollow: followMutation.mutateAsync,
      isToggling: followMutation.isPending,
    }),
    [
      followerCountQuery.data,
      followerCountQuery.error,
      orderCountQuery.data,
      orderCountQuery.error,
      isFollowingQuery.data,
      isFollowingQuery.error,
      isLoading,
      followMutation.mutateAsync,
      followMutation.isPending,
    ],
  );
}
