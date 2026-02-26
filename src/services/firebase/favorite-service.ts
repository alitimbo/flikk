import { FirebaseService } from "@/services/firebase/firebase-service";
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  documentId,
  writeBatch,
} from "@react-native-firebase/firestore";
import { chunkArray } from "@/utils/array";

export class FavoriteService {
  static async getFavoriteIds(uid: string): Promise<string[]> {
    const favoritesCollection = collection(
      FirebaseService.db,
      `users/${uid}/favorites`,
    );
    const snapshot = await getDocs(favoritesCollection);
    return snapshot.docs.map((docSnap) => docSnap.id);
  }

  static async getFavoritesByPublicationIds(
    uid: string,
    publicationIds: string[],
  ): Promise<string[]> {
    if (publicationIds.length === 0) return [];
    const favoritesCollection = collection(
      FirebaseService.db,
      `users/${uid}/favorites`,
    );

    const chunks = chunkArray(publicationIds, 10);
    const results = await Promise.all(
      chunks.map(async (ids) => {
        const q = query(favoritesCollection, where(documentId(), "in", ids));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => docSnap.id);
      }),
    );

    return results.flat();
  }

  static async addFavorite(
    uid: string,
    publicationId: string,
  ): Promise<boolean> {
    const userFavRef = doc(
      FirebaseService.db,
      `users/${uid}/favorites/${publicationId}`,
    );

    // Transaction sur users/{uid}/favorites pour éviter les doublons
    const added = await runTransaction(FirebaseService.db, async (tx) => {
      const snapshot = await tx.get(userFavRef);
      if (snapshot.exists()) return false;
      tx.set(userFavRef, {
        publicationId,
        createdAt: serverTimestamp(),
      });
      return true;
    });

    if (added) {
      // ✅ Écrire aussi dans /publications/{pubId}/likes/{uid}
      // Règle Firestore : allow create, delete: if isMe(uid) ✅
      const pubLikeRef = doc(
        FirebaseService.db,
        `publications/${publicationId}/likes/${uid}`,
      );
      const batch = writeBatch(FirebaseService.db);
      batch.set(pubLikeRef, {
        userId: uid,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    }

    return added;
  }

  static async removeFavorite(
    uid: string,
    publicationId: string,
  ): Promise<boolean> {
    const userFavRef = doc(
      FirebaseService.db,
      `users/${uid}/favorites/${publicationId}`,
    );

    const removed = await runTransaction(FirebaseService.db, async (tx) => {
      const snapshot = await tx.get(userFavRef);
      if (!snapshot.exists()) return false;
      tx.delete(userFavRef);
      return true;
    });

    if (removed) {
      // ✅ Supprimer aussi de /publications/{pubId}/likes/{uid}
      // Règle Firestore : allow create, delete: if isMe(uid) ✅
      const pubLikeRef = doc(
        FirebaseService.db,
        `publications/${publicationId}/likes/${uid}`,
      );
      const batch = writeBatch(FirebaseService.db);
      batch.delete(pubLikeRef);
      await batch.commit();
    }

    return removed;
  }
}
