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
  private static merchantStatuses = ["paid", "delivered", "shipped", "shipping"];

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
    if (!snapshot.exists) return null;
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
      where("status", "in", this.merchantStatuses),
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
}
