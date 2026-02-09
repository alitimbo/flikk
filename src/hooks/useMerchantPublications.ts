import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PublicationService } from "@/services/firebase/publication-service";
import { Publication } from "@/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

type MerchantPage = {
  publications: Publication[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

export function useMerchantPublications(userId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ["merchantPublications", userId],
    enabled: !!userId,
    initialPageParam: null as FirebaseFirestoreTypes.QueryDocumentSnapshot | null,
    queryFn: ({ pageParam }) =>
      userId
        ? PublicationService.getByMerchant(userId, {
            lastDoc: pageParam ?? undefined,
            limit: 12,
          })
        : Promise.resolve({ publications: [], lastDoc: null }),
    getNextPageParam: (lastPage: MerchantPage) =>
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
