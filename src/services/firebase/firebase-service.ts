import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

import { initAppCheck } from "./app-check";

export class FirebaseService {
  private static initialized = false;

  static auth = auth();

  static db = firestore();

  static storage = storage();

  static async init() {
    if (this.initialized) return;
    await initAppCheck();
    this.initialized = true;
  }
}
