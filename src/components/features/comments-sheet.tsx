import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { getAuth } from "@react-native-firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Comment, CommentSort } from "@/types";
import { CommentService } from "@/services/firebase/comment-service";
import { usePublicationComments } from "@/hooks/usePublicationComments";
import { useCommentReplies } from "@/hooks/useCommentReplies";
import { usePublicationCommentLikes } from "@/hooks/usePublicationCommentLikes";
import { useUserProfile } from "@/hooks/useUserProfile";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useRouter } from "expo-router";

type CommentsSheetProps = {
  publicationId: string;
  isVisible: boolean;
  onClose: () => void;
  totalCount?: number;
  onCountChange?: (delta: number) => void;
};

type ReplyTarget = {
  commentId: string;
  authorName?: string;
};

export function CommentsSheet({
  publicationId,
  isVisible,
  onClose,
  totalCount,
  onCountChange,
}: CommentsSheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<CommentSort>("top");
  const [message, setMessage] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sheetTranslateY, setSheetTranslateY] = useState(0);
  const [isAuthRequiredOpen, setIsAuthRequiredOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const authUser = getAuth().currentUser;
  const { data: userProfile } = useUserProfile(authUser?.uid);

  const commentsQuery = usePublicationComments(publicationId, sort, isVisible);
  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.comments) ?? [],
    [commentsQuery.data],
  );

  const likesQuery = usePublicationCommentLikes(publicationId, authUser?.uid);
  const likedTargets = likesQuery.data ?? new Set<string>();

  const authorName = useMemo(() => {
    if (userProfile?.isMerchant) {
      return userProfile.merchantInfo?.businessName || userProfile.firstName;
    }
    const name = [userProfile?.firstName, userProfile?.lastName]
      .filter(Boolean)
      .join(" ");
    return name || userProfile?.phoneNumber || authUser?.phoneNumber || "";
  }, [authUser?.phoneNumber, userProfile]);

  const authorAvatarUrl = useMemo(() => {
    return userProfile?.merchantInfo?.logoUrl || "";
  }, [userProfile]);

  const openAuthRequired = useCallback(() => {
    setIsAuthRequiredOpen(true);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setSheetTranslateY(0);
      setReplyTarget(null);
      return;
    }
    if (publicationId) {
      void commentsQuery.refetch();
    }
  }, [isVisible, publicationId, commentsQuery]);

  useEffect(() => {
    if (commentsQuery.isError && commentsQuery.error) {
      console.log("[Comments] Firestore error:", commentsQuery.error);
    }
  }, [commentsQuery.isError, commentsQuery.error]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const closeAuthRequired = useCallback(() => {
    setIsAuthRequiredOpen(false);
  }, []);

  const handleSend = useCallback(async () => {
    if (!authUser) {
      openAuthRequired();
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) return;

    try {
      setIsSubmitting(true);
      const now = new Date();
      // ✅ Vider l'input immédiatement (avant les appels Firestore)
      const currentReplyTarget = replyTarget;
      setMessage("");
      setReplyTarget(null);

      const optimisticComment: Comment = {
        id: `temp-${now.getTime()}`,
        publicationId,
        userId: authUser.uid,
        text: trimmed,
        likeCount: 0,
        replyCount: 0,
        parentId: currentReplyTarget ? currentReplyTarget.commentId : null,
        authorName,
        authorAvatarUrl,
        authorIsMerchant: userProfile?.isMerchant ?? false,
        createdAt: { toDate: () => now },
        updatedAt: { toDate: () => now },
      };

      if (currentReplyTarget) {
        queryClient.setQueryData(
          ["commentReplies", currentReplyTarget.commentId],
          (oldData: any) => {
            if (!oldData?.pages?.length) {
              return {
                pages: [{ comments: [optimisticComment], lastDoc: null }],
                pageParams: [null],
              };
            }
            const [first, ...rest] = oldData.pages;
            return {
              ...oldData,
              pages: [
                {
                  ...first,
                  comments: [optimisticComment, ...(first.comments ?? [])],
                },
                ...rest,
              ],
            };
          },
        );

        queryClient.setQueryData(
          ["comments", publicationId],
          (oldData: any) => {
            if (!oldData?.pages?.length) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                comments: (page.comments ?? []).map((item: Comment) =>
                  item.id === currentReplyTarget.commentId
                    ? {
                        ...item,
                        replyCount: Math.max(0, (item.replyCount ?? 0) + 1),
                      }
                    : item,
                ),
              })),
            };
          },
        );
      } else {
        queryClient.setQueryData(
          ["comments", publicationId, sort],
          (oldData: any) => {
            if (!oldData?.pages?.length) {
              return {
                pages: [{ comments: [optimisticComment], lastDoc: null }],
                pageParams: [null],
              };
            }
            const [first, ...rest] = oldData.pages;
            return {
              ...oldData,
              pages: [
                {
                  ...first,
                  comments: [optimisticComment, ...(first.comments ?? [])],
                },
                ...rest,
              ],
            };
          },
        );
      }

      if (currentReplyTarget) {
        await CommentService.createReply(currentReplyTarget.commentId, {
          publicationId,
          userId: authUser.uid,
          text: trimmed,
          authorName,
          authorAvatarUrl,
          authorIsMerchant: userProfile?.isMerchant ?? false,
        });
        await queryClient.invalidateQueries({
          queryKey: ["commentReplies", currentReplyTarget.commentId],
        });
      } else {
        await CommentService.createComment({
          publicationId,
          userId: authUser.uid,
          text: trimmed,
          authorName,
          authorAvatarUrl,
          authorIsMerchant: userProfile?.isMerchant ?? false,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["comments", publicationId],
        exact: false,
      });
      onCountChange?.(1);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    authUser,
    message,
    replyTarget,
    publicationId,
    authorName,
    authorAvatarUrl,
    userProfile?.isMerchant,
    queryClient,
    onCountChange,
    openAuthRequired,
    sort,
  ]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            setSheetTranslateY(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80) {
            onClose();
          } else {
            setSheetTranslateY(0);
          }
        },
        onPanResponderTerminate: () => {
          setSheetTranslateY(0);
        },
      }),
    [onClose],
  );

  const renderItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentCard
        comment={item}
        likedTargets={likedTargets}
        publicationId={publicationId}
        onReply={(target) => setReplyTarget(target)}
        onRequireAuth={openAuthRequired}
      />
    ),
    [likedTargets, publicationId, openAuthRequired],
  );

  return (
    <>
      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <Pressable className="flex-1 bg-black/60" onPress={onClose} />
        <KeyboardAvoidingView
          className="absolute inset-x-0 bottom-0"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <View
            className="w-full rounded-t-3xl border border-white/10 bg-flikk-card"
            style={{
              paddingBottom: insets.bottom + 12,
              transform: [{ translateY: sheetTranslateY - keyboardHeight }],
              maxHeight: "88%",
            }}
            {...sheetPanResponder.panHandlers}
          >
            <View className="px-6 pt-4">
              <View className="mb-3 h-1.5 w-12 self-center rounded-full bg-white/20" />
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="font-display text-lg text-flikk-text">
                    {t("comments.title")}
                  </Text>
                  <Text className="text-xs text-flikk-text-muted mt-1">
                    {(totalCount ?? 0).toLocaleString()}{" "}
                    {t("comments.countLabel")}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  className="h-8 w-8 items-center justify-center rounded-full bg-white/10"
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              <View className="mt-4 flex-row gap-3">
                {(["top", "new"] as CommentSort[]).map((option) => {
                  const selected = sort === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setSort(option)}
                      className={`rounded-full px-4 py-2 ${
                        selected
                          ? "bg-flikk-lime/20 border border-flikk-lime/40"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      <Text
                        className={`font-display text-xs ${
                          selected ? "text-flikk-lime" : "text-flikk-text-muted"
                        }`}
                      >
                        {option === "top"
                          ? t("comments.sortTop")
                          : t("comments.sortNew")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mt-4 flex-1">
              {commentsQuery.isLoading ? (
                <View className="px-6">
                  <CommentsSkeleton />
                </View>
              ) : commentsQuery.isError ? (
                <View className="items-center justify-center px-6 py-10">
                  <Text className="text-sm text-flikk-text-muted text-center">
                    {t("comments.error")}
                  </Text>
                  {__DEV__ && (
                    <Text className="mt-2 text-[11px] text-[#FF4D6D] text-center">
                      {String(commentsQuery.error)}
                    </Text>
                  )}
                </View>
              ) : comments.length === 0 ? (
                <View className="items-center justify-center px-6 py-10">
                  <Text className="text-sm text-flikk-text-muted">
                    {t("comments.empty")}
                  </Text>
                </View>
              ) : (
                <FlashList
                  data={comments}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id ?? ""}
                  estimatedItemSize={120}
                  contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingBottom: 140,
                  }}
                  onEndReached={() => {
                    if (commentsQuery.hasNextPage) {
                      commentsQuery.fetchNextPage();
                    }
                  }}
                  onEndReachedThreshold={0.6}
                  ListFooterComponent={
                    commentsQuery.isFetchingNextPage ? (
                      <View className="py-4 items-center">
                        <ActivityIndicator color="#CCFF00" />
                      </View>
                    ) : null
                  }
                />
              )}
            </View>

            <View className="border-t border-white/10 px-6 pt-4">
              {replyTarget && (
                <View className="mb-3 flex-row items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
                  <Text className="text-xs text-flikk-text-muted">
                    {t("comments.replyingTo")} {replyTarget.authorName || ""}
                  </Text>
                  <Pressable onPress={() => setReplyTarget(null)}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

              <View className="flex-row items-center gap-3">
                <View className="flex-1 rounded-2xl border border-white/10 bg-flikk-dark px-4 py-3">
                  <TextInput
                    placeholder={t("comments.placeholder")}
                    placeholderTextColor="#666666"
                    className="font-body text-base text-flikk-text"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    editable={!isSubmitting}
                    onFocus={() => setSheetTranslateY(0)}
                  />
                </View>
                <Pressable
                  onPress={handleSend}
                  className={`h-11 w-11 items-center justify-center rounded-full ${
                    message.trim() ? "bg-flikk-lime" : "bg-white/10"
                  }`}
                  disabled={isSubmitting || !message.trim()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#121212" />
                  ) : (
                    <Ionicons
                      name="send"
                      size={18}
                      color={message.trim() ? "#121212" : "#666666"}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isAuthRequiredOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAuthRequired}
      >
        <Pressable className="flex-1 bg-black/60" onPress={closeAuthRequired} />
        <View className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-flikk-card p-6">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-flikk-lime/10">
            <Ionicons name="lock-closed" size={22} color="#CCFF00" />
          </View>
          <Text className="font-display text-lg text-flikk-text">
            {t("comments.auth.title")}
          </Text>
          <Text className="mt-2 font-body text-sm text-flikk-text-muted">
            {t("comments.auth.subtitle")}
          </Text>

          <Pressable
            className="mt-6 h-12 items-center justify-center rounded-full bg-flikk-lime"
            onPress={() => {
              closeAuthRequired();
              router.push("/(tabs)/profil");
            }}
          >
            <Text className="font-display text-base text-flikk-dark">
              {t("comments.auth.cta")}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

type CommentCardProps = {
  comment: Comment;
  publicationId: string;
  likedTargets: Set<string>;
  onReply: (target: ReplyTarget) => void;
  onRequireAuth: () => void;
};

function CommentCard({
  comment,
  publicationId,
  likedTargets,
  onReply,
  onRequireAuth,
}: CommentCardProps) {
  const { t } = useTranslation();
  const authUser = getAuth().currentUser;
  const [showReplies, setShowReplies] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);
  const [localLiked, setLocalLiked] = useState<boolean>(
    likedTargets.has(comment.id ?? ""),
  );
  const [likeCount, setLikeCount] = useState<number>(
    Math.max(0, comment.likeCount ?? 0),
  );

  const repliesQuery = useCommentReplies(comment.id ?? "", showReplies);
  const replies = useMemo(
    () => repliesQuery.data?.pages.flatMap((page) => page.comments) ?? [],
    [repliesQuery.data],
  );

  const handleLike = useCallback(async () => {
    if (!authUser || !comment.id) {
      onRequireAuth();
      return;
    }
    try {
      setIsLikePending(true);
      if (localLiked) {
        await CommentService.unlikeTarget(
          publicationId,
          authUser.uid,
          comment.id,
        );
        setLocalLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        await CommentService.likeTarget(
          publicationId,
          authUser.uid,
          comment.id,
        );
        setLocalLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } finally {
      setIsLikePending(false);
    }
  }, [authUser, comment.id, localLiked, publicationId, onRequireAuth]);

  useEffect(() => {
    if (comment.id) {
      setLocalLiked(likedTargets.has(comment.id));
    }
  }, [comment.id, likedTargets]);

  return (
    <View className="mb-5">
      <View className="flex-row gap-3">
        <AvatarBubble
          uri={comment.authorAvatarUrl}
          isMerchant={comment.authorIsMerchant}
          name={comment.authorName}
        />
        <View className="flex-1 rounded-2xl border border-white/10 bg-[#151515] p-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-display text-sm text-flikk-text">
              {comment.authorName || t("comments.unknown")}
            </Text>
            <Text className="text-[10px] text-flikk-text-muted">
              {formatRelativeTime(comment.createdAt)}
            </Text>
          </View>
          <Text className="mt-1 text-sm text-flikk-text-muted">
            {comment.text}
          </Text>
          <View className="mt-3 flex-row items-center gap-4">
            {/*
            <Pressable
              className="flex-row items-center gap-1"
              onPress={handleLike}
              disabled={isLikePending}
            >
              <Ionicons
                name={localLiked ? "heart" : "heart-outline"}
                size={14}
                color={localLiked ? "#FF4D6D" : "#B3B3B3"}
              />
              <Text className="text-xs text-flikk-text-muted">
                {likeCount}
              </Text>
            </Pressable>
            */}
            <Pressable
              className="flex-row items-center gap-1"
              onPress={() =>
                onReply({
                  commentId: comment.id ?? "",
                  authorName: comment.authorName,
                })
              }
            >
              <Ionicons
                name="return-down-forward-outline"
                size={14}
                color="#B3B3B3"
              />
              <Text className="text-xs text-flikk-text-muted">
                {t("comments.reply")}
              </Text>
            </Pressable>
            <Text className="text-xs text-flikk-text-muted">
              {comment.replyCount ?? 0} {t("comments.replies")}
            </Text>
          </View>
        </View>
      </View>

      {comment.replyCount > 0 && (
        <Pressable
          className="ml-12 mt-2"
          onPress={() => setShowReplies((prev) => !prev)}
        >
          <Text className="text-xs text-flikk-lime">
            {showReplies
              ? t("comments.hideReplies")
              : t("comments.showReplies", { count: comment.replyCount })}
          </Text>
        </Pressable>
      )}

      {showReplies && (
        <View className="ml-12 mt-3 border-l border-white/10 pl-3">
          {repliesQuery.isLoading ? (
            <RepliesSkeleton />
          ) : (
            replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                publicationId={publicationId}
                likedTargets={likedTargets}
                parentId={comment.id ?? ""}
                onRequireAuth={onRequireAuth}
              />
            ))
          )}
          {repliesQuery.hasNextPage && (
            <Pressable
              className="mt-2"
              onPress={() => repliesQuery.fetchNextPage()}
            >
              <Text className="text-xs text-flikk-text-muted">
                {t("comments.loadMoreReplies")}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

type ReplyCardProps = {
  reply: Comment;
  publicationId: string;
  likedTargets: Set<string>;
  parentId: string;
  onRequireAuth: () => void;
};

function ReplyCard({
  reply,
  publicationId,
  likedTargets,
  parentId,
  onRequireAuth,
}: ReplyCardProps) {
  const { t } = useTranslation();
  const authUser = getAuth().currentUser;
  const [isLikePending, setIsLikePending] = useState(false);
  const [localLiked, setLocalLiked] = useState<boolean>(
    likedTargets.has(reply.id ?? ""),
  );
  const [likeCount, setLikeCount] = useState<number>(
    Math.max(0, reply.likeCount ?? 0),
  );

  const handleLike = useCallback(async () => {
    if (!authUser || !reply.id) {
      onRequireAuth();
      return;
    }
    try {
      setIsLikePending(true);
      if (localLiked) {
        await CommentService.unlikeTarget(
          publicationId,
          authUser.uid,
          reply.id,
          parentId,
        );
        setLocalLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        await CommentService.likeTarget(
          publicationId,
          authUser.uid,
          reply.id,
          parentId,
        );
        setLocalLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } finally {
      setIsLikePending(false);
    }
  }, [authUser, reply.id, localLiked, publicationId, parentId, onRequireAuth]);

  useEffect(() => {
    if (reply.id) {
      setLocalLiked(likedTargets.has(reply.id));
    }
  }, [reply.id, likedTargets]);

  return (
    <View className="mb-4 flex-row gap-3">
      <AvatarBubble
        uri={reply.authorAvatarUrl}
        isMerchant={reply.authorIsMerchant}
        size="sm"
        name={reply.authorName}
      />
      <View className="flex-1 rounded-2xl border border-white/10 bg-[#151515] p-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-xs text-flikk-text">
            {reply.authorName || t("comments.unknown")}
          </Text>
          <Text className="text-[10px] text-flikk-text-muted">
            {formatRelativeTime(reply.createdAt)}
          </Text>
        </View>
        <Text className="mt-1 text-xs text-flikk-text-muted">{reply.text}</Text>
        <Pressable className="mt-2 flex-row items-center gap-1">
          {/*
          <Pressable
            className="flex-row items-center gap-1"
            onPress={handleLike}
            disabled={isLikePending}
          >
            <Ionicons
              name={localLiked ? "heart" : "heart-outline"}
              size={12}
              color={localLiked ? "#FF4D6D" : "#B3B3B3"}
            />
            <Text className="text-[10px] text-flikk-text-muted">
              {likeCount}
            </Text>
          </Pressable>
          */}
        </Pressable>
      </View>
    </View>
  );
}

function AvatarBubble({
  uri,
  isMerchant,
  size = "md",
  name,
}: {
  uri?: string;
  isMerchant?: boolean;
  size?: "sm" | "md";
  name?: string;
}) {
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const initials = useMemo(() => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + second).toUpperCase();
  }, [name]);
  return (
    <View
      className={`${sizeClass} items-center justify-center rounded-full border ${
        isMerchant ? "border-flikk-lime/40" : "border-white/20"
      } bg-black/40`}
    >
      {uri ? (
        <Image
          source={{ uri }}
          className="h-full w-full rounded-full"
          resizeMode="cover"
        />
      ) : initials ? (
        <Text className="font-display text-xs text-flikk-text">{initials}</Text>
      ) : (
        <Ionicons
          name="person"
          size={size === "sm" ? 14 : 18}
          color="#666666"
        />
      )}
    </View>
  );
}

function CommentsSkeleton() {
  return (
    <View className="gap-5">
      {[0, 1, 2].map((key) => (
        <View key={key} className="flex-row gap-3">
          <SkeletonBlock height={40} width={40} radius={20} />
          <View className="flex-1 gap-2">
            <SkeletonBlock height={12} width="35%" radius={6} />
            <SkeletonBlock height={14} width="90%" radius={6} />
            <SkeletonBlock height={12} width="70%" radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

function RepliesSkeleton() {
  return (
    <View className="gap-3">
      {[0, 1].map((key) => (
        <View key={key} className="flex-row gap-3">
          <SkeletonBlock height={32} width={32} radius={16} />
          <View className="flex-1 gap-2">
            <SkeletonBlock height={10} width="40%" radius={6} />
            <SkeletonBlock height={12} width="90%" radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

function formatRelativeTime(value?: any) {
  if (!value?.toDate) return "";
  const date = value.toDate() as Date;
  const diff = Date.now() - date.getTime();
  const seconds = Math.max(1, Math.floor(diff / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}j`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
