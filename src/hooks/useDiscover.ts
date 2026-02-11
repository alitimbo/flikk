import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PublicationService } from "@/services/firebase/publication-service";
import { Publication } from "@/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import {
  buildSearchTokens,
  getSearchTokenVariants,
  matchesSearchTokens,
} from "@/utils/search";

type DiscoverPage = {
  publications: Publication[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

export function useDiscover(searchText: string) {
  const tokens = useMemo(
    () => buildSearchTokens([searchText]),
    [searchText],
  );
  const primaryToken = tokens[0] ?? "";
  const tokenVariants = useMemo(
    () => getSearchTokenVariants(searchText),
    [searchText],
  );

  const query = useInfiniteQuery({
    queryKey: ["discover", primaryToken],
    initialPageParam: null as FirebaseFirestoreTypes.QueryDocumentSnapshot | null,
    queryFn: ({ pageParam }) =>
      PublicationService.getDiscover({
        lastDoc: pageParam ?? undefined,
        limit: 12,
        search: primaryToken,
        searchVariants: tokenVariants,
      }),
    getNextPageParam: (lastPage: DiscoverPage) =>
      lastPage.lastDoc ?? undefined,
  });

  useEffect(() => {
    if (query.error) {
      console.log("[useDiscover] error:", {
        search: primaryToken,
        variants: tokenVariants,
        error: query.error,
      });
    }
  }, [query.error, primaryToken, tokenVariants]);

  const publications = useMemo(() => {
    const items = query.data?.pages.flatMap((page) => page.publications) ?? [];
    if (tokens.length === 0) return items;
    return items.filter((pub) =>
      matchesSearchTokens(
        [
          pub.title,
          pub.productName,
          pub.hashtags?.join(" "),
          pub.merchantName ?? "",
        ]
          .filter(Boolean)
          .join(" "),
        tokens,
      ),
    );
  }, [query.data, tokens]);

  return useMemo(
    () => ({
      ...query,
      publications,
    }),
    [query, publications],
  );
}
