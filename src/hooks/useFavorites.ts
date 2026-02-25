import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FavoriteService } from "@/services/firebase/favorite-service";
import { PublicationService } from "@/services/firebase/publication-service";

type FavoriteQueryResult = {
  ids: string[];
};

function parseFirestoreError(error: unknown) {
  const fallback = {
    code: "unknown",
    message: "Unknown error",
    indexUrl: null as string | null,
    looksLikeIndexIssue: false,
  };

  if (!(error instanceof Error)) {
    return fallback;
  }

  const maybeCode =
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "unknown";

  const maybeMessage = error.message ?? "Unknown error";
  const indexUrlMatch = maybeMessage.match(/https:\/\/console\.firebase\.google\.com\/\S+/);
  const looksLikeIndexIssue =
    maybeCode === "failed-precondition" ||
    maybeMessage.toLowerCase().includes("requires an index") ||
    maybeMessage.toLowerCase().includes("create index");

  return {
    code: maybeCode,
    message: maybeMessage,
    indexUrl: indexUrlMatch?.[0] ?? null,
    looksLikeIndexIssue,
  };
}

function logFavoritesError(
  scope: string,
  error: unknown,
  context: Record<string, unknown>,
) {
  if (!__DEV__) return;

  const parsed = parseFirestoreError(error);
  console.error(`[useFavorites] ${scope} failed`, {
    ...context,
    code: parsed.code,
    message: parsed.message,
    indexUrl: parsed.indexUrl,
    looksLikeIndexIssue: parsed.looksLikeIndexIssue,
    rawError: error,
  });

  if (parsed.looksLikeIndexIssue) {
    console.error("[useFavorites] Firestore index probablement manquant", {
      scope,
      indexUrl: parsed.indexUrl,
    });
  }
}

export function useFavorites(uid: string | undefined, publicationIds: string[]) {
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const query = useQuery<FavoriteQueryResult>({
    queryKey: ["favorites", uid, publicationIds],
    queryFn: async () => {
      if (!uid || publicationIds.length === 0) return { ids: [] };
      try {
        const ids = await FavoriteService.getFavoritesByPublicationIds(
          uid,
          publicationIds,
        );
        return { ids };
      } catch (error) {
        logFavoritesError("queryFn:getFavoritesByPublicationIds", error, {
          uid,
          publicationCount: publicationIds.length,
        });
        throw error;
      }
    },
    enabled: !!uid && publicationIds.length > 0,
  });

  const toggleMutation = useMutation({
    mutationFn: async (input: { publicationId: string; isFavorited: boolean }) => {
      if (!uid) return;
      try {
        if (input.isFavorited) {
          const removed = await FavoriteService.removeFavorite(uid, input.publicationId);
          if (removed) {
            await PublicationService.adjustLikeCount(input.publicationId, -1);
          }
        } else {
          const added = await FavoriteService.addFavorite(uid, input.publicationId);
          if (added) {
            await PublicationService.adjustLikeCount(input.publicationId, 1);
          }
        }
      } catch (error) {
        logFavoritesError("mutationFn:toggleFavorite", error, {
          uid,
          publicationId: input.publicationId,
          targetState: input.isFavorited ? "unfavorite" : "favorite",
        });
        throw error;
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
        : Array.from(new Set([...prev.ids, input.publicationId]));
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
    onError: (err, input, context) => {
      logFavoritesError("onError:toggleFavorite", err, {
        uid,
        publicationId: input.publicationId,
        targetState: input.isFavorited ? "unfavorite" : "favorite",
      });

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

  const favoriteIds = useMemo(() => query.data?.ids ?? [], [query.data?.ids]);
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
