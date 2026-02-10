import { useQuery } from "@tanstack/react-query";
import { OrderService } from "@/services/firebase/order-service";

export function useOrderById(id?: string | null) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => OrderService.getOrderById(id ?? ""),
    enabled: !!id,
  });
}
