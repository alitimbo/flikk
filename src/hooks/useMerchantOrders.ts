import { useInfiniteQuery } from "@tanstack/react-query";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { OrderService } from "@/services/firebase/order-service";
import type { Order } from "@/types";

type OrdersPage = {
  orders: Order[];
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
};

export function useMerchantOrders(merchantId?: string | null) {
  return useInfiniteQuery({
    queryKey: ["merchantOrders", merchantId],
    initialPageParam: null as FirebaseFirestoreTypes.QueryDocumentSnapshot | null,
    queryFn: ({ pageParam }) =>
      OrderService.getOrdersByMerchant(
        merchantId ?? "",
        pageParam ?? undefined,
      ),
    getNextPageParam: (lastPage: OrdersPage) =>
      lastPage.lastDoc ?? undefined,
    enabled: !!merchantId,
  });
}
