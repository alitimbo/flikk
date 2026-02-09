import { useInfiniteQuery } from "@tanstack/react-query";
import { CommentService } from "@/services/firebase/comment-service";
import { Comment } from "@/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

type RepliesPage = {
  comments: Comment[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

export function useCommentReplies(commentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["commentReplies", commentId],
    initialPageParam: null as FirebaseFirestoreTypes.QueryDocumentSnapshot | null,
    queryFn: ({ pageParam }) =>
      CommentService.getReplies(commentId, pageParam ?? undefined),
    getNextPageParam: (lastPage: RepliesPage) =>
      lastPage.lastDoc ?? undefined,
    enabled,
  });
}
