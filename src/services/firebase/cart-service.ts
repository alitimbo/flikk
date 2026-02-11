import { FirebaseService } from "@/services/firebase/firebase-service";
import type { CartItem, Publication, UserProfile } from "@/types";
import {
  collection,
  doc,
  FirebaseFirestoreTypes,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "@react-native-firebase/firestore";

function buildOrderNumber(sequence: number, year: number): string {
  return `${String(sequence).padStart(3, "0")}-${year}`;
}

function buildGroupId(uid: string): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `grp_${uid}_${stamp}_${rand}`;
}

export class CartService {
  static cartCollection(uid: string) {
    return collection(FirebaseService.db, `users/${uid}/cartItems`);
  }

  static async getCartItems(uid: string): Promise<CartItem[]> {
    if (!uid) return [];
    const snapshot = await getDocs(this.cartCollection(uid));
    return snapshot.docs.map((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const data = docSnap.data() as CartItem;
      const { publicationId: _ignored, ...rest } = data;
      return {
        publicationId: docSnap.id,
        ...rest,
      } as CartItem;
    });
  }

  static async upsertItem(
    uid: string,
    publication: Publication,
    quantityDelta = 1,
  ): Promise<void> {
    if (!uid) {
      throw new Error("CART_AUTH_REQUIRED");
    }
    if (!publication.id) {
      throw new Error("CART_PUBLICATION_ID_MISSING");
    }
    if (!publication.userId) {
      throw new Error("CART_MERCHANT_ID_MISSING");
    }

    const itemRef = doc(this.cartCollection(uid), publication.id);

    try {
      await runTransaction(FirebaseService.db, async (tx) => {
        const existingSnap = await tx.get(itemRef);
        const currentQty = existingSnap.exists()
          ? Number(existingSnap.data()?.quantity ?? 0)
          : 0;
        const nextQty = Math.max(0, currentQty + quantityDelta);

        if (nextQty <= 0) {
          tx.delete(itemRef);
          return;
        }

        tx.set(
          itemRef,
          {
            publicationId: publication.id,
            merchantId: publication.userId,
            merchantName: publication.merchantName ?? null,
            merchantLogoUrl: publication.merchantLogoUrl ?? null,
            productName: publication.productName,
            imageUrl: publication.imageUrl,
            priceAtAdd: Number(publication.price ?? 0),
            currency: "XOF",
            quantity: nextQty,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          } as CartItem,
          { merge: true },
        );
      });
    } catch (error) {
      console.log("[CartService] upsertItem error:", {
        uid,
        publicationId: publication.id,
        merchantId: publication.userId,
        quantityDelta,
        error,
      });
      throw error;
    }
  }

  static async setQuantity(
    uid: string,
    publicationId: string,
    quantity: number,
  ): Promise<void> {
    if (!uid || !publicationId) return;
    const itemRef = doc(this.cartCollection(uid), publicationId);
    if (quantity <= 0) {
      const batch = writeBatch(FirebaseService.db);
      batch.delete(itemRef);
      await batch.commit();
      return;
    }
    await setDoc(
      itemRef,
      {
        quantity,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  static async removeItem(uid: string, publicationId: string): Promise<void> {
    if (!uid || !publicationId) return;
    const itemRef = doc(this.cartCollection(uid), publicationId);
    const batch = writeBatch(FirebaseService.db);
    batch.delete(itemRef);
    await batch.commit();
  }

  static async clear(uid: string): Promise<void> {
    if (!uid) return;
    const snapshot = await getDocs(this.cartCollection(uid));
    if (snapshot.empty) return;
    const batch = writeBatch(FirebaseService.db);
    snapshot.docs.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      batch.delete(docSnap.ref),
    );
    await batch.commit();
  }

  static async checkoutManual(
    uid: string,
    userProfile: UserProfile | null,
    phoneNumber: string | null | undefined,
    items: {
      cart: CartItem;
      publication: Publication;
    }[],
  ): Promise<{ groupId: string; orderIds: string[] }> {
    if (!uid || items.length === 0) {
      throw new Error("Invalid checkout payload");
    }

    const groupId = buildGroupId(uid);
    const year = new Date().getFullYear();
    const counterRef = doc(
      collection(
        doc(collection(FirebaseService.db, "meta"), "orderCounters"),
        "years",
      ),
      String(year),
    );
    const orderGroupsRef = doc(collection(FirebaseService.db, "orderGroups"), groupId);
    const orderIds: string[] = [];

    const customerName =
      [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(" ") ||
      userProfile?.phoneNumber ||
      "Client Flikk";
    const msisdn = phoneNumber || userProfile?.phoneNumber || null;

    await runTransaction(FirebaseService.db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let seq = counterSnap.exists()
        ? Number(counterSnap.data()?.lastSequence ?? 0)
        : 0;

      let total = 0;
      const merchantIds = new Set<string>();

      items.forEach(({ cart, publication }, index) => {
        seq += 1;
        const orderNumber = buildOrderNumber(seq, year);
        const orderId = `cart_${groupId}_${index + 1}`;
        orderIds.push(orderId);

        const qty = Math.max(1, Number(cart.quantity ?? 1));
        const unitPrice = Number(publication.price ?? cart.priceAtAdd ?? 0);
        const amount = qty * unitPrice;
        total += amount;
        merchantIds.add(publication.userId);

        tx.set(doc(collection(FirebaseService.db, "orders"), orderId), {
          orderId,
          orderNumber,
          orderGroupId: groupId,
          paymentReference: orderId,
          externalReference: groupId,
          paymentStatus: "pending",
          status: "pending",
          publicationId: publication.id ?? cart.publicationId,
          productName: publication.productName ?? cart.productName,
          productImageUrl: publication.imageUrl ?? cart.imageUrl,
          amount,
          unitPrice,
          quantity: qty,
          currency: "XOF",
          country: "NE",
          msisdn,
          customerName,
          customerId: uid,
          merchantId: publication.userId,
          merchantName: publication.merchantName ?? cart.merchantName ?? null,
          merchantLogoUrl:
            publication.merchantLogoUrl ?? cart.merchantLogoUrl ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      tx.set(
        counterRef,
        {
          lastSequence: seq,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      tx.set(orderGroupsRef, {
        orderGroupId: groupId,
        customerId: uid,
        customerName,
        msisdn,
        itemCount: items.length,
        merchantCount: merchantIds.size,
        totalAmount: total,
        currency: "XOF",
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await this.clear(uid);
    return { groupId, orderIds };
  }

  static async getPublicationMap(
    publicationIds: string[],
  ): Promise<Map<string, Publication>> {
    const map = new Map<string, Publication>();
    if (publicationIds.length === 0) return map;
    const refs = publicationIds.map((id) =>
      doc(collection(FirebaseService.db, "publications"), id),
    );
    const snaps = await Promise.all(refs.map((r) => getDoc(r)));
    snaps.forEach((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Publication;
      map.set(snap.id, { id: snap.id, ...data });
    });
    return map;
  }
}
