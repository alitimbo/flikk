import { FirebaseService } from "@/services/firebase/firebase-service";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  serverTimestamp,
  where,
  documentId,
} from "@react-native-firebase/firestore";
import { chunkArray } from "@/utils/array";

export class FavoriteService {
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
        const q = query(
          favoritesCollection,
          where(documentId(), "in", ids),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => docSnap.id);
      }),
    );

    return results.flat();
  }

  static async addFavorite(uid: string, publicationId: string): Promise<void> {
    const ref = doc(
      FirebaseService.db,
      `users/${uid}/favorites/${publicationId}`,
    );
    await setDoc(ref, {
      publicationId,
      createdAt: serverTimestamp(),
    });
  }

  static async removeFavorite(
    uid: string,
    publicationId: string,
  ): Promise<void> {
    const ref = doc(
      FirebaseService.db,
      `users/${uid}/favorites/${publicationId}`,
    );
    await deleteDoc(ref);
  }
}
