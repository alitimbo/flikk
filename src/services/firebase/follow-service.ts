import { FirebaseService } from "@/services/firebase/firebase-service";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "@react-native-firebase/firestore";

export class FollowService {
  private static get followsCollection() {
    return collection(FirebaseService.db, "merchantFollowers");
  }

  private static buildFollowDocId(
    merchantId: string,
    followerId: string,
  ): string {
    return `${merchantId}_${followerId}`;
  }

  static async isFollowing(
    merchantId: string,
    followerId: string,
  ): Promise<boolean> {
    if (!merchantId || !followerId) return false;
    const followRef = doc(
      this.followsCollection,
      this.buildFollowDocId(merchantId, followerId),
    );
    const snapshot = await getDoc(followRef);
    return snapshot.exists();
  }

  static async getFollowerCount(merchantId: string): Promise<number> {
    if (!merchantId) return 0;
    const q = query(
      this.followsCollection,
      where("merchantId", "==", merchantId),
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  static async toggleFollow(
    merchantId: string,
    followerId: string,
  ): Promise<boolean> {
    if (!merchantId || !followerId || merchantId === followerId) return false;

    const followsRef = doc(
      this.followsCollection,
      this.buildFollowDocId(merchantId, followerId),
    );
    const merchantRef = doc(
      collection(FirebaseService.db, "users"),
      merchantId,
    );

    const isNowFollowing = await runTransaction(
      FirebaseService.db,
      async (tx) => {
        const followSnap = await tx.get(followsRef);
        const merchantSnap = await tx.get(merchantRef);

        const currentFollowerCount = merchantSnap.exists()
          ? Number(merchantSnap.data()?.followerCount ?? 0)
          : 0;

        if (followSnap.exists()) {
          tx.delete(followsRef);
          tx.set(
            merchantRef,
            {
              followerCount: Math.max(0, currentFollowerCount - 1),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          return false;
        }

        tx.set(followsRef, {
          merchantId,
          followerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(
          merchantRef,
          {
            followerCount: currentFollowerCount + 1,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        return true;
      },
    );

    return isNowFollowing;
  }
}
