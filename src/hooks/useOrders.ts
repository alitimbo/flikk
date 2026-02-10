import { useInfiniteQuery } from "@tanstack/react-query";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { OrderService } from "@/services/firebase/order-service";
import type { Order } from "@/types";

type OrdersPage = {
  orders: Order[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

export function useOrders(customerId?: string | null) {
  return useInfiniteQuery({
    queryKey: ["orders", customerId],
    initialPageParam: null as FirebaseFirestoreTypes.QueryDocumentSnapshot | null,
    queryFn: ({ pageParam }) =>
      OrderService.getOrdersByCustomer(
        customerId ?? "",
        pageParam ?? undefined,
      ),
    getNextPageParam: (lastPage: OrdersPage) =>
      lastPage.lastDoc ?? undefined,
    enabled: !!customerId,
  });
}
