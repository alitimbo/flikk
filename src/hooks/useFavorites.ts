import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FavoriteService } from "@/services/firebase/favorite-service";
import { PublicationService } from "@/services/firebase/publication-service";

type FavoriteQueryResult = {
  ids: string[];
};

export function useFavorites(uid: string | undefined, publicationIds: string[]) {
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const query = useQuery<FavoriteQueryResult>({
    queryKey: ["favorites", uid, publicationIds],
    queryFn: async () => {
      if (!uid || publicationIds.length === 0) return { ids: [] };
      const ids = await FavoriteService.getFavoritesByPublicationIds(
        uid,
        publicationIds,
      );
      return { ids };
    },
    enabled: !!uid && publicationIds.length > 0,
  });

  const toggleMutation = useMutation({
    mutationFn: async (input: { publicationId: string; isFavorited: boolean }) => {
      if (!uid) return;
      if (input.isFavorited) {
        await Promise.all([
          FavoriteService.removeFavorite(uid, input.publicationId),
          PublicationService.adjustLikeCount(input.publicationId, -1),
        ]);
      } else {
        await Promise.all([
          FavoriteService.addFavorite(uid, input.publicationId),
          PublicationService.adjustLikeCount(input.publicationId, 1),
        ]);
      }
    },
    onMutate: async (input) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.add(input.publicationId);
        return next;
      });
      await queryClient.cancelQueries({ queryKey: ["favorites", uid, publicationIds] });
      const prev = queryClient.getQueryData<FavoriteQueryResult>([
        "favorites",
        uid,
        publicationIds,
      ]);
      if (!prev) return { prev };
      const nextIds = input.isFavorited
        ? prev.ids.filter((id) => id !== input.publicationId)
        : [...prev.ids, input.publicationId];
      queryClient.setQueryData<FavoriteQueryResult>(
        ["favorites", uid, publicationIds],
        { ids: nextIds },
      );
      const prevFeed = queryClient.getQueryData<any>(["feed"]);
      if (prevFeed?.pages) {
        const nextPages = prevFeed.pages.map((page: any) => ({
          ...page,
          publications: page.publications.map((pub: any) => {
            if (pub.id !== input.publicationId) return pub;
            const delta = input.isFavorited ? -1 : 1;
            return {
              ...pub,
              likeCount: Math.max(0, (pub.likeCount ?? 0) + delta),
            };
          }),
        }));
        queryClient.setQueryData(["feed"], { ...prevFeed, pages: nextPages });
      }
      return { prev, prevFeed };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) {
        queryClient.setQueryData(
          ["favorites", uid, publicationIds],
          context.prev,
        );
      }
      if (context?.prevFeed) {
        queryClient.setQueryData(["feed"], context.prevFeed);
      }
    },
    onSettled: (_data, _err, vars) => {
      if (vars?.publicationId) {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(vars.publicationId);
          return next;
        });
      }
      queryClient.invalidateQueries({
        queryKey: ["favorites", uid, publicationIds],
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const favoriteIds = query.data?.ids ?? [];
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  return {
    favoriteIds,
    favoriteSet,
    isLoading: query.isLoading,
    isPending: (id: string) => pendingIds.has(id),
    toggleFavorite: (publicationId: string) =>
      toggleMutation.mutate({ publicationId, isFavorited: favoriteSet.has(publicationId) }),
  };
}
