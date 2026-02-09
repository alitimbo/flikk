import { FirebaseService } from "@/services/firebase/firebase-service";
import { UserProfile } from "@/types";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { getDownloadURL, putFile, ref } from "@react-native-firebase/storage";

export class UserService {
  private static collection = collection(FirebaseService.db, "users");

  static async getUser(uid: string): Promise<UserProfile | null> {
    const ref = doc(this.collection, uid);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists) return null;
    return (snapshot.data() as UserProfile) || null;
  }

  static async createOrUpdateUser(
    uid: string,
    data: Partial<UserProfile>,
  ): Promise<void> {
    // Remove undefined fields to avoid Firestore errors
    const safeData = JSON.parse(JSON.stringify(data));
    const ref = doc(this.collection, uid);
    await setDoc(
      ref,
      {
        ...safeData,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  static async uploadLogo(uid: string, uri: string): Promise<string> {
    try {
      const filename = uri.substring(uri.lastIndexOf("/") + 1);
      const extension = filename.split(".").pop() || "jpg";
      const path = `uploads/logos/${uid}/${Date.now()}.${extension}`;

      const storageRef = ref(FirebaseService.storage, path);
      await putFile(storageRef, uri);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw error;
    }
  }
}
