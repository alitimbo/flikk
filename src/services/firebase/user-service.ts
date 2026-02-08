import { FirebaseService } from "@/services/firebase/firebase-service";
import firestore from "@react-native-firebase/firestore";
import { UserProfile } from "@/types";

export class UserService {
  private static collection = FirebaseService.db.collection("users");

  static async getUser(uid: string): Promise<UserProfile | null> {
    const doc = await this.collection.doc(uid).get();
    if (!doc.exists) return null;
    return (doc.data() as UserProfile) || null;
  }

  static async createOrUpdateUser(
    uid: string,
    data: Partial<UserProfile>,
  ): Promise<void> {
    // Remove undefined fields to avoid Firestore errors
    const safeData = JSON.parse(JSON.stringify(data));
    await this.collection.doc(uid).set(
      {
        ...safeData,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  static async uploadLogo(uid: string, uri: string): Promise<string> {
    try {
      const filename = uri.substring(uri.lastIndexOf("/") + 1);
      const extension = filename.split(".").pop() || "jpg";
      const path = `uploads/logos/${uid}/${Date.now()}.${extension}`;

      const ref = FirebaseService.storage.ref(path);
      await ref.putFile(uri);
      return await ref.getDownloadURL();
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw error;
    }
  }
}
