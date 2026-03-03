import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Comment, CommentSort } from "@/types";
import { CommentService } from "@/services/firebase/comment-service";
import { usePublicationComments } from "@/hooks/usePublicationComments";
import { useCommentReplies } from "@/hooks/useCommentReplies";
import { useUserProfile } from "@/hooks/useUserProfile";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useRouter } from "expo-router";
import { useAuthUser } from "@/hooks/useAuthUser";

type CommentsModalProps = {
  publicationId: string;
  onClose: () => void;
  totalCount?: number;
  onCountChange?: (delta: number) => void;
};

type ReplyTarget = {
  commentId: string;
  authorName?: string;
};

export function CommentsModal({
  publicationId,
  onClose,
  totalCount,
  onCountChange,
}: CommentsModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const inputRef = useRef<TextInput | null>(null);
  const [sort, setSort] = useState<CommentSort>("top");
  const [message, setMessage] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthRequiredOpen, setIsAuthRequiredOpen] = useState(false);
  const [composerHeight, setComposerHeight] = useState(116);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const authUser = useAuthUser();
  const { data: userProfile } = useUserProfile(authUser?.uid);

  const commentsQuery = usePublicationComments(publicationId, sort, true);
  const refetchComments = commentsQuery.refetch;
  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.comments) ?? [],
    [commentsQuery.data],
  );

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
    if (publicationId) {
      void refetchComments();
    }
  }, [publicationId, refetchComments]);

  useEffect(() => {
    if (commentsQuery.isError && commentsQuery.error) {
      console.log("[Comments] Firestore error:", commentsQuery.error);
    }
  }, [commentsQuery.error, commentsQuery.isError]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      const windowHeight = Dimensions.get("window").height;
      const frameKeyboardHeight = Math.max(
        0,
        windowHeight - event.endCoordinates.screenY,
      );
      const effectiveKeyboardHeight = Math.max(
        event.endCoordinates.height,
        frameKeyboardHeight,
      );
      setKeyboardHeight(effectiveKeyboardHeight);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleReplyTarget = useCallback((target: ReplyTarget) => {
    setReplyTarget(target);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
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

  const renderItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentCard
        comment={item}
        onReply={handleReplyTarget}
      />
    ),
    [handleReplyTarget],
  );

  const androidExtraBottomGap = Platform.OS === "android" ? 12 : 0;
  const baseComposerBottomInset =
    Platform.OS === "android" ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 12);
  const androidKeyboardInset =
    Platform.OS === "android" ? Math.max(0, keyboardHeight - insets.bottom) : 0;
  const androidKeyboardLift =
    Platform.OS === "android" && keyboardHeight > 0
      ? Math.max(10, Math.min(28, Math.round(keyboardHeight * 0.08)))
      : 0;
  const composerBottomInset =
    baseComposerBottomInset +
    androidExtraBottomGap +
    androidKeyboardInset +
    androidKeyboardLift;
  const listBottomInset =
    composerHeight + baseComposerBottomInset + androidExtraBottomGap + 20;

  return (
    <>
      <View className="flex-1 bg-flikk-dark">
        <View
          className="border-b border-white/10 px-6 pb-3"
          style={{ paddingTop: insets.top + 10 }}
        >
          <View className="mb-2 flex-row items-center justify-between">
            <View>
              <Text className="font-display text-lg text-flikk-text">
                {t("comments.title")}
              </Text>
              <Text className="mt-1 text-xs text-flikk-text-muted">
                {(totalCount ?? 0).toLocaleString()} {t("comments.countLabel")}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-white/10"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <View className="mt-2 flex-row gap-3">
            {(["top", "new"] as CommentSort[]).map((option) => {
              const selected = sort === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSort(option)}
                  className={`rounded-full border px-4 py-2 ${
                    selected
                      ? "border-flikk-lime/40 bg-flikk-lime/20"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <Text
                    className={`font-display text-xs ${
                      selected ? "text-flikk-lime" : "text-flikk-text-muted"
                    }`}
                  >
                    {option === "top" ? t("comments.sortTop") : t("comments.sortNew")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-1">
          {commentsQuery.isLoading ? (
            <View className="px-6 pt-4">
              <CommentsSkeleton />
            </View>
          ) : commentsQuery.isError ? (
            <View className="items-center justify-center px-6 py-10">
              <Text className="text-center text-sm text-flikk-text-muted">
                {t("comments.error")}
              </Text>
              {__DEV__ && (
                <Text className="mt-2 text-center text-[11px] text-[#FF4D6D]">
                  {String(commentsQuery.error)}
                </Text>
              )}
            </View>
          ) : comments.length === 0 ? (
            <View className="items-center justify-center px-6 py-10">
              <Text className="text-sm text-flikk-text-muted">{t("comments.empty")}</Text>
            </View>
          ) : (
            <FlashList
              data={comments}
              renderItem={renderItem}
              keyExtractor={(item: Comment) => item.id ?? ""}
              removeClippedSubviews
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: 16,
                paddingHorizontal: 24,
                paddingBottom: listBottomInset,
              }}
              onEndReached={() => {
                if (commentsQuery.hasNextPage) {
                  commentsQuery.fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.6}
              ListFooterComponent={
                commentsQuery.isFetchingNextPage ? (
                  <View className="items-center py-4">
                    <ActivityIndicator color="#CCFF00" />
                  </View>
                ) : null
              }
            />
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 16}
        >
          <View
            className="border-t border-white/10 bg-[#121212] px-6 pt-4"
            style={{ paddingBottom: composerBottomInset }}
          >
            <View
              onLayout={(event) => {
                const nextHeight = Math.ceil(event.nativeEvent.layout.height);
                setComposerHeight((prev) => (prev === nextHeight ? prev : nextHeight));
              }}
            >
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
                    ref={inputRef}
                    placeholder={t("comments.placeholder")}
                    placeholderTextColor="#666666"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    editable={!isSubmitting}
                    textAlignVertical="top"
                    blurOnSubmit={false}
                    style={{
                      minHeight: 20,
                      maxHeight: 120,
                      padding: 0,
                      color: "#FFFFFF",
                      fontSize: 16,
                    }}
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
      </View>

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
  onReply: (target: ReplyTarget) => void;
};

function CommentCard({
  comment,
  onReply,
}: CommentCardProps) {
  const { t } = useTranslation();
  const [showReplies, setShowReplies] = useState(false);

  const repliesQuery = useCommentReplies(comment.id ?? "", showReplies);
  const replies = useMemo(
    () => repliesQuery.data?.pages.flatMap((page) => page.comments) ?? [],
    [repliesQuery.data],
  );

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
              <ReplyCard key={reply.id} reply={reply} />
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
};

function ReplyCard({ reply }: ReplyCardProps) {
  const { t } = useTranslation();

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


