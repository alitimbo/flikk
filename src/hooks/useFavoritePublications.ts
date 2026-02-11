import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FavoriteService } from "@/services/firebase/favorite-service";
import { PublicationService } from "@/services/firebase/publication-service";
import { Publication } from "@/types";

type FavoritesResult = {
  publications: Publication[];
};

export function useFavoritePublications(uid: string | undefined) {
  const query = useQuery<FavoritesResult>({
    queryKey: ["favoritePublications", uid],
    queryFn: async () => {
      if (!uid) return { publications: [] };
      const ids = await FavoriteService.getFavoriteIds(uid);
      const publications = await PublicationService.getByIds(ids);
      return { publications };
    },
    enabled: !!uid,
  });

  useEffect(() => {
    if (query.error) {
      console.log("[useFavoritePublications] error:", { uid, error: query.error });
    }
  }, [query.error, uid]);

  const publications = useMemo(
    () => query.data?.publications ?? [],
    [query.data],
  );

  return useMemo(
    () => ({
      ...query,
      publications,
    }),
    [query, publications],
  );
}
