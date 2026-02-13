import { FirebaseService } from "@/services/firebase/firebase-service";
import { NotificationDevice, UserProfile, AppLanguage } from "@/types";
import { Platform } from "react-native";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { getDownloadURL, putFile, ref } from "@react-native-firebase/storage";

export class UserService {
  private static get collection() {
    return collection(FirebaseService.db, "users");
  }

  static async getUser(uid: string): Promise<UserProfile | null> {
    const ref = doc(this.collection, uid);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return (snapshot.data() as UserProfile) || null;
  }

  static async createOrUpdateUser(
    uid: string,
    data: Partial<UserProfile>,
  ): Promise<void> {
    // Remove undefined fields to avoid Firestore errors
    const safeData = JSON.parse(JSON.stringify(data));
    const ref = doc(this.collection, uid);
    const existingSnap = await getDoc(ref);

    if (typeof safeData.freeUsageCount === "undefined") {
      const existingFreeUsageCount = existingSnap.exists()
        ? existingSnap.data()?.freeUsageCount
        : undefined;
      safeData.freeUsageCount =
        typeof existingFreeUsageCount === "number" ? existingFreeUsageCount : 0;
    }

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

  static async upsertNotificationDevice(
    uid: string,
    deviceId: string,
    data: {
      fcmToken?: string | null;
      language?: AppLanguage;
    },
  ): Promise<void> {
    if (!uid || !deviceId) return;

    const devicesCollection = collection(
      FirebaseService.db,
      `users/${uid}/notificationDevices`,
    );
    const ref = doc(devicesCollection, deviceId);

    const payload: Partial<NotificationDevice> & {
      uid: string;
      deviceId: string;
      updatedAt: any;
      lastSeenAt: any;
    } = {
      uid,
      deviceId,
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      platform:
        Platform.OS === "ios" ||
        Platform.OS === "android" ||
        Platform.OS === "web"
          ? Platform.OS
          : "android",
    };

    if (typeof data.fcmToken !== "undefined") {
      payload.fcmToken = data.fcmToken;
    }
    if (typeof data.language !== "undefined") {
      payload.language = data.language;
    }

    await setDoc(ref, payload, { merge: true });

    if (data.language) {
      await setDoc(
        doc(this.collection, uid),
        {
          notificationLanguage: data.language,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  }
}
