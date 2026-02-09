import { useQuery } from "@tanstack/react-query";
import { CommentService } from "@/services/firebase/comment-service";

export function usePublicationCommentLikes(
  publicationId: string,
  userId?: string | null,
) {
  return useQuery({
    queryKey: ["commentLikes", publicationId, userId],
    queryFn: () =>
      CommentService.getUserLikesForPublication(publicationId, userId!),
    enabled: !!userId,
    staleTime: 1000 * 60,
  });
}
