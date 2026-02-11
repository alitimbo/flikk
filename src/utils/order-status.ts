import type { Order } from "@/types";

export function resolveOrderStatus(
  order: Pick<Order, "status" | "paymentStatus">,
): NonNullable<Order["status"]> {
  const status = order.status;
  const paymentStatus = order.paymentStatus;

  if ((status === "pending" || !status) && paymentStatus === "paid") {
    return "paid";
  }

  if ((status === "pending" || !status) && paymentStatus === "failed") {
    return "failed";
  }

  return (status ?? paymentStatus ?? "pending") as NonNullable<Order["status"]>;
}
