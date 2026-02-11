import { FirebaseService } from "@/services/firebase/firebase-service";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import type { Order } from "@/types";

type OrdersPage = {
  orders: Order[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

export class OrderService {
  private static collection = collection(FirebaseService.db, "orders");
  private static shouldShowForMerchant(order: Order): boolean {
    const effectiveStatus = order.status ?? order.paymentStatus ?? "pending";
    return effectiveStatus !== "pending";
  }

  static async getOrdersByCustomer(
    customerId: string,
    lastDoc?: FirebaseFirestoreTypes.QueryDocumentSnapshot,
    pageSize = 20,
  ): Promise<OrdersPage> {
    let q = query(
      this.collection,
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc"),
      limit(pageSize),
    );
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map((docSnap) => ({
      orderId: docSnap.id,
      ...(docSnap.data() as Order),
    }));
    const hasMore = snapshot.docs.length === pageSize;

    return {
      orders,
      lastDoc: hasMore ? snapshot.docs[snapshot.docs.length - 1] : null,
    };
  }

  static async getOrderById(id: string): Promise<Order | null> {
    if (!id) return null;
    const ref = doc(this.collection, id);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return { orderId: snapshot.id, ...(snapshot.data() as Order) };
  }

  static async getOrdersByMerchant(
    merchantId: string,
    lastDoc?: FirebaseFirestoreTypes.QueryDocumentSnapshot,
    pageSize = 20,
  ): Promise<OrdersPage> {
    let q = query(
      this.collection,
      where("merchantId", "==", merchantId),
      orderBy("createdAt", "desc"),
      limit(pageSize),
    );
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const orders = snapshot.docs
      .map((docSnap) => ({
        orderId: docSnap.id,
        ...(docSnap.data() as Order),
      }))
      .filter((order) => this.shouldShowForMerchant(order));
    const hasMore = snapshot.docs.length === pageSize;

    return {
      orders,
      lastDoc: hasMore ? snapshot.docs[snapshot.docs.length - 1] : null,
    };
  }

  static async getMerchantOrderCount(merchantId: string): Promise<number> {
    if (!merchantId) return 0;
    try {
      const q = query(
        this.collection,
        where("merchantId", "==", merchantId),
      );
      const snapshot = await getDocs(q);
      const count = snapshot.docs
        .map((docSnap) => ({ orderId: docSnap.id, ...(docSnap.data() as Order) }))
        .filter((order) => this.shouldShowForMerchant(order)).length;
      return count;
    } catch (error) {
      console.log("[OrderService] getMerchantOrderCount error:", error);
      throw error;
    }
  }
}
