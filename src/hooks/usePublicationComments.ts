import { useInfiniteQuery } from "@tanstack/react-query";
import { CommentService } from "@/services/firebase/comment-service";
import { Comment, CommentSort } from "@/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

type CommentsPage = {
  comments: Comment[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

export function usePublicationComments(
  publicationId: string,
  sort: CommentSort,
) {
  return useInfiniteQuery({
    queryKey: ["comments", publicationId, sort],
    initialPageParam: null as FirebaseFirestoreTypes.QueryDocumentSnapshot | null,
    queryFn: ({ pageParam }) =>
      CommentService.getComments(
        publicationId,
        sort,
        pageParam ?? undefined,
      ),
    getNextPageParam: (lastPage: CommentsPage) =>
      lastPage.lastDoc ?? undefined,
  });
}
