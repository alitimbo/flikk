import { getAuth, FirebaseAuthTypes } from "@react-native-firebase/auth";
import {
  getFirestore,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import {
  getStorage,
  FirebaseStorageTypes,
} from "@react-native-firebase/storage";

import { initAppCheck } from "./app-check";

export class FirebaseService {
  private static initialized = false;

  // On déclare les types, mais on n'instancie rien ici
  static auth: FirebaseAuthTypes.Module;
  static db: FirebaseFirestoreTypes.Module;
  static storage: FirebaseStorageTypes.Module;

  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // 1. Sécurité en premier — très important
      await initAppCheck();

      // 2. Ensuite seulement on récupère les instances
      //    → elles héritent du contexte App Check
      this.auth = getAuth();
      this.db = getFirestore();
      this.storage = getStorage();

      this.initialized = true;
      console.log("[FirebaseService] Firebase initialisé avec App Check actif");
    } catch (error) {
      console.error("[FirebaseService] Échec initialisation Firebase", error);
      throw error; // ou gère selon ta stratégie
    }
  }

  // Optionnel : helper pour forcer l’init depuis n’importe où
  static async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
}
