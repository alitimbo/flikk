import { FirebaseService } from "@/services/firebase/firebase-service";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  increment,
  documentId,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { Publication, UserProfile } from "@/types";
import { buildSearchTokens, normalizeSearchToken } from "@/utils/search";
import { chunkArray } from "@/utils/array";

export class PublicationService {
  private static get collection() {
    return collection(FirebaseService.db, "publications");
  }

  static async createPublication(
    publication: Omit<
      Publication,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "orderCount"
      | "commentCount"
      | "likeCount"
      | "reviewCount"
      | "viewCount"
    >,
  ): Promise<string> {
    const searchTokens = buildSearchTokens([
      publication.productName,
      publication.title,
      publication.hashtags?.join(" "),
      publication.merchantName ?? "",
    ]);

    const docRef = await addDoc(this.collection, {
      ...publication,
      searchTokens,
      orderCount: 0,
      commentCount: 0,
      likeCount: 0,
      reviewCount: 0,
      viewCount: 0,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  static async getPublication(id: string): Promise<Publication | null> {
    const ref = doc(this.collection, id);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists) return null;
    return { id: snapshot.id, ...(snapshot.data() as Publication) };
  }

  static async getFeed(
    lastDoc?: FirebaseFirestoreTypes.QueryDocumentSnapshot,
  ): Promise<{
    publications: Publication[];
    lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
  }> {
    let q = query(
      this.collection,
      where("status", "==", "ready"),
      orderBy("orderCount", "desc"),
      orderBy("createdAt", "desc"),
      limit(5),
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const publications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Publication),
    }));

    void this.backfillMerchantSnapshots(publications);

    return {
      publications,
      lastDoc:
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null,
    };
  }

  static async getDiscover(
    options: {
      lastDoc?: FirebaseFirestoreTypes.QueryDocumentSnapshot;
      limit?: number;
      search?: string;
      searchVariants?: string[];
    } = {},
  ): Promise<{
    publications: Publication[];
    lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
  }> {
    const limitValue = options.limit ?? 12;
    const token = options.search ? normalizeSearchToken(options.search) : null;
    const variants =
      options.searchVariants && options.searchVariants.length > 0
        ? options.searchVariants
        : token
          ? [token]
          : [];

    let q;
    if (variants.length > 0) {
      q = query(
        this.collection,
        where("status", "==", "ready"),
        where("searchTokens", "array-contains-any", variants),
        limit(limitValue),
      );
    } else {
      q = query(
        this.collection,
        where("status", "==", "ready"),
        orderBy("orderCount", "desc"),
        orderBy("createdAt", "desc"),
        limit(limitValue),
      );
    }

    if (options.lastDoc) {
      q = query(q, startAfter(options.lastDoc));
    }

    const snapshot = await getDocs(q);
    const publications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Publication),
    }));

    void this.backfillMerchantSnapshots(publications);

    return {
      publications,
      lastDoc:
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null,
    };
  }

  static async incrementViewCount(id: string): Promise<void> {
    const ref = doc(this.collection, id);
    await updateDoc(ref, {
      viewCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  static async adjustLikeCount(id: string, delta: number): Promise<void> {
    const ref = doc(this.collection, id);
    await runTransaction(FirebaseService.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() as Publication;
      const current = Number(data.likeCount ?? 0);
      const next = Math.max(0, current + delta);
      tx.update(ref, {
        likeCount: next,
        updatedAt: serverTimestamp(),
      });
    });
  }

  static async updatePublication(
    id: string,
    data: Partial<Publication>,
  ): Promise<void> {
    const searchTokens = buildSearchTokens([
      data.productName,
      data.title,
      data.hashtags?.join(" "),
      data.merchantName ?? "",
    ]);
    const ref = doc(this.collection, id);
    await updateDoc(ref, {
      ...data,
      searchTokens,
      updatedAt: serverTimestamp(),
    });
  }

  static async deletePublication(id: string): Promise<void> {
    const ref = doc(this.collection, id);
    await updateDoc(ref, {
      status: "deleted",
      updatedAt: serverTimestamp(),
    });
  }

  static async getByIds(ids: string[]): Promise<Publication[]> {
    if (ids.length === 0) return [];
    const chunks = chunkArray(ids, 10);
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const q = query(this.collection, where(documentId(), "in", chunk));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Publication),
        }));
      }),
    );

    return results.flat().filter((pub) => pub.status === "ready");
  }

  static async getByMerchant(
    userId: string,
    options: {
      lastDoc?: FirebaseFirestoreTypes.QueryDocumentSnapshot;
      limit?: number;
    } = {},
  ): Promise<{
    publications: Publication[];
    lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
  }> {
    const limitValue = options.limit ?? 50;
    const q = query(
      this.collection,
      where("userId", "==", userId),
      limit(limitValue),
    );

    const snapshot = await getDocs(q);
    const publications = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Publication),
      }))
      .filter((pub) => pub.status === "ready")
      .sort((a, b) => {
        const aTime = (a.createdAt as any)?.toMillis?.() ?? 0;
        const bTime = (b.createdAt as any)?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

    void this.backfillMerchantSnapshots(publications);

    return {
      publications,
      lastDoc: null,
    };
  }

  private static async backfillMerchantSnapshots(
    publications: Publication[],
  ): Promise<void> {
    const missing = publications.filter(
      (pub) => !pub.merchantName || !pub.merchantLogoUrl,
    );
    if (missing.length === 0) return;

    const uniqueUserIds = Array.from(new Set(missing.map((pub) => pub.userId)));

    const usersCollection = collection(FirebaseService.db, "users");
    const userDocs = await Promise.all(
      uniqueUserIds.map((uid) => getDoc(doc(usersCollection, uid))),
    );

    const userMap = new Map<string, UserProfile>();
    userDocs.forEach((doc) => {
      if (doc.exists) {
        userMap.set(doc.id, doc.data() as UserProfile);
      }
    });

    const batch = writeBatch(FirebaseService.db);
    let hasUpdates = false;

    missing.forEach((pub) => {
      const user = userMap.get(pub.userId);
      if (!user) return;
      const merchantName =
        user.merchantInfo?.businessName ||
        [user.firstName, user.lastName].filter(Boolean).join(" ");
      const merchantLogoUrl = user.merchantInfo?.logoUrl;

      if (!merchantName && !merchantLogoUrl) return;

      const update: Partial<Publication> = {};
      if (!pub.merchantName && merchantName) update.merchantName = merchantName;
      if (!pub.merchantLogoUrl && merchantLogoUrl) {
        update.merchantLogoUrl = merchantLogoUrl;
      }

      if (Object.keys(update).length === 0) return;
      const ref = doc(this.collection, pub.id!);
      batch.update(ref, update);
      hasUpdates = true;
    });

    if (hasUpdates) {
      await batch.commit();
    }
  }
}
