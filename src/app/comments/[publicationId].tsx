import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CommentsModal } from "@/components/features/comments-sheet";

export default function CommentsModalRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    publicationId?: string | string[];
    totalCount?: string | string[];
  }>();

  const publicationId = useMemo(() => {
    const value = params.publicationId;
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  }, [params.publicationId]);

  const totalCount = useMemo(() => {
    const value = params.totalCount;
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = Number(raw ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }, [params.totalCount]);

  return (
    <CommentsModal
      publicationId={publicationId}
      totalCount={totalCount}
      onClose={() => router.back()}
    />
  );
}
