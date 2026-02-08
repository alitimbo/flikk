import { FirebaseService } from "@/services/firebase/firebase-service";
import firestore from "@react-native-firebase/firestore";
import { Publication } from "@/types";

export class PublicationService {
  private static collection = FirebaseService.db.collection("publications");

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
    const docRef = await this.collection.add({
      ...publication,
      orderCount: 0,
      commentCount: 0,
      likeCount: 0,
      reviewCount: 0,
      viewCount: 0,
      status: "pending",
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  static async getPublication(id: string): Promise<Publication | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...(doc.data() as Publication) };
  }
}
