import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import type {
  PaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
} from "@/types";

export class PaymentService {
  private static get functions() {
    return getFunctions(undefined, "us-central1");
  }

  static async requestPayment(
    payload: PaymentRequest,
  ): Promise<PaymentResponse> {
    const call = httpsCallable<PaymentRequest, PaymentResponse>(
      this.functions,
      "requestPayment",
    );
    const result = await call(payload);
    return result.data;
  }

  static async requestManualOrder(
    payload: PaymentRequest,
  ): Promise<PaymentResponse> {
    const call = httpsCallable<PaymentRequest, PaymentResponse>(
      this.functions,
      "requestManualOrder",
    );
    const result = await call(payload);
    return result.data;
  }

  static async getPaymentStatus(
    reference: string,
  ): Promise<PaymentStatusResponse> {
    const call = httpsCallable<{ reference: string }, PaymentStatusResponse>(
      this.functions,
      "getPaymentStatus",
    );
    const result = await call({ reference });
    return result.data;
  }
}
