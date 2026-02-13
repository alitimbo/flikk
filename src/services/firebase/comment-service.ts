import { FirebaseService } from "@/services/firebase/firebase-service";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  increment,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { Comment, CommentSort } from "@/types";

type CommentPage = {
  comments: Comment[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

type CommentInput = {
  publicationId: string;
  userId: string;
  text: string;
  authorName?: string;
  authorAvatarUrl?: string;
  authorIsMerchant?: boolean;
};

export class CommentService {
  private static get collection() {
    return collection(FirebaseService.db, "comments");
  }

  static async getComments(
    publicationId: string,
    sort: CommentSort,
    lastDoc?: FirebaseFirestoreTypes.QueryDocumentSnapshot,
    pageSize = 20,
  ): Promise<CommentPage> {
    const base = [
      where("publicationId", "==", publicationId),
      where("parentId", "==", null),
    ];
    const ordering =
      sort === "top"
        ? [orderBy("likeCount", "desc"), orderBy("createdAt", "desc")]
        : [orderBy("createdAt", "desc")];

    let q = query(this.collection, ...base, ...ordering, limit(pageSize));
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const comments = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Comment),
    }));
    const hasMore = snapshot.docs.length === pageSize;

    return {
      comments,
      lastDoc: hasMore ? snapshot.docs[snapshot.docs.length - 1] : null,
    };
  }

  static async getReplies(
    commentId: string,
    lastDoc?: FirebaseFirestoreTypes.QueryDocumentSnapshot,
    pageSize = 10,
  ): Promise<CommentPage> {
    const repliesCollection = collection(
      doc(this.collection, commentId),
      "replies",
    );
    let q = query(
      repliesCollection,
      orderBy("createdAt", "asc"),
      limit(pageSize),
    );
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const comments = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Comment),
    }));
    const hasMore = snapshot.docs.length === pageSize;

    return {
      comments,
      lastDoc: hasMore ? snapshot.docs[snapshot.docs.length - 1] : null,
    };
  }

  static async createComment(input: CommentInput): Promise<string> {
    const commentRef = doc(this.collection);
    const publicationRef = doc(
      FirebaseService.db,
      "publications",
      input.publicationId,
    );

    await runTransaction(FirebaseService.db, async (tx) => {
      tx.set(commentRef, {
        publicationId: input.publicationId,
        userId: input.userId,
        text: input.text,
        likeCount: 0,
        replyCount: 0,
        parentId: null,
        authorName: input.authorName ?? "",
        authorAvatarUrl: input.authorAvatarUrl ?? "",
        authorIsMerchant: input.authorIsMerchant ?? false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.update(publicationRef, {
        commentCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    });

    return commentRef.id;
  }

  static async createReply(
    commentId: string,
    input: CommentInput,
  ): Promise<string> {
    const parentRef = doc(this.collection, commentId);
    const replyRef = doc(collection(parentRef, "replies"));
    const publicationRef = doc(
      FirebaseService.db,
      "publications",
      input.publicationId,
    );

    await runTransaction(FirebaseService.db, async (tx) => {
      tx.set(replyRef, {
        publicationId: input.publicationId,
        userId: input.userId,
        text: input.text,
        likeCount: 0,
        replyCount: 0,
        parentId: commentId,
        authorName: input.authorName ?? "",
        authorAvatarUrl: input.authorAvatarUrl ?? "",
        authorIsMerchant: input.authorIsMerchant ?? false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.update(parentRef, {
        replyCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      tx.update(publicationRef, {
        commentCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    });

    return replyRef.id;
  }

  static async likeTarget(
    publicationId: string,
    userId: string,
    targetId: string,
    parentId?: string,
  ): Promise<void> {
    const targetRef = parentId
      ? doc(collection(doc(this.collection, parentId), "replies"), targetId)
      : doc(this.collection, targetId);
    const likeRef = doc(collection(targetRef, "commentLikes"), userId);

    await runTransaction(FirebaseService.db, async (tx) => {
      const likeSnap = await tx.get(likeRef);
      if (likeSnap.exists) return;
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists) return;
      const data = targetSnap.data() as Comment;
      const current = Number(data.likeCount ?? 0);
      tx.set(likeRef, {
        publicationId,
        userId,
        targetId,
        parentId: parentId ?? null,
        createdAt: serverTimestamp(),
      });
      tx.update(targetRef, {
        likeCount: current + 1,
        updatedAt: serverTimestamp(),
      });
    });
  }

  static async unlikeTarget(
    publicationId: string,
    userId: string,
    targetId: string,
    parentId?: string,
  ): Promise<void> {
    const targetRef = parentId
      ? doc(collection(doc(this.collection, parentId), "replies"), targetId)
      : doc(this.collection, targetId);
    const likeRef = doc(collection(targetRef, "commentLikes"), userId);

    await runTransaction(FirebaseService.db, async (tx) => {
      const likeSnap = await tx.get(likeRef);
      if (!likeSnap.exists) return;
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists) return;
      const data = targetSnap.data() as Comment;
      const current = Number(data.likeCount ?? 0);
      tx.delete(likeRef);
      tx.update(targetRef, {
        likeCount: Math.max(0, current - 1),
        updatedAt: serverTimestamp(),
      });
    });
  }

  static async getUserLikesForPublication(
    publicationId: string,
    userId: string,
  ): Promise<Set<string>> {
    const likesGroup = collectionGroup(FirebaseService.db, "commentLikes");
    const q = query(
      likesGroup,
      where("publicationId", "==", publicationId),
      where("userId", "==", userId),
    );
    const snapshot = await getDocs(q);
    const liked = new Set<string>();
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as { targetId?: string };
      if (data.targetId) liked.add(data.targetId);
    });
    return liked;
  }
}
