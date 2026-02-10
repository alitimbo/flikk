import { useQuery } from "@tanstack/react-query";
import { PaymentService } from "@/services/firebase/payment-service";

export function usePaymentStatus(reference: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["paymentStatus", reference],
    queryFn: () => PaymentService.getPaymentStatus(reference ?? ""),
    enabled: enabled && !!reference,
    refetchInterval: enabled ? 3000 : false,
    staleTime: 0,
  });
}
