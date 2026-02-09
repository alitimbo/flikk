import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";
import { getStorage } from "@react-native-firebase/storage";

import { initAppCheck } from "./app-check";

export class FirebaseService {
  private static initialized = false;

  static auth = getAuth();

  static db = getFirestore();

  static storage = getStorage();

  static async init() {
    if (this.initialized) return;
    await initAppCheck();
    this.initialized = true;
  }
}
