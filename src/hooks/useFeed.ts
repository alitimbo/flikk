import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PublicationService } from "@/services/firebase/publication-service";
import { Publication } from "@/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

type FeedPage = {
  publications: Publication[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

export function useFeed() {
  const query = useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: null as FirebaseFirestoreTypes.QueryDocumentSnapshot | null,
    queryFn: ({ pageParam }) =>
      PublicationService.getFeed(pageParam ?? undefined),
    getNextPageParam: (lastPage: FeedPage) =>
      lastPage.lastDoc ?? undefined,
  });

  const publications = useMemo(
    () => query.data?.pages.flatMap((page) => page.publications) ?? [],
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
