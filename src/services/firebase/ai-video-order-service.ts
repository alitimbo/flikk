import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import type {
  AiVideoFormat,
  AiVideoOrder,
  AiVideoReceptionMethod,
  UserProfile,
} from "@/types";

export class AiVideoOrderService {
  private static functions = getFunctions(undefined, "us-central1");

  static async createOrder(params: {
    uid: string;
    userProfile: UserProfile | null;
    expectedContent: string;
    format: AiVideoFormat;
    productImage1Url: string;
    productImage2Url: string;
    receptionMethod: AiVideoReceptionMethod;
    receptionContact: string;
  }): Promise<{ orderId: string; orderNumber: string; finalPrice: number }> {
    const {
      uid,
      expectedContent,
      format,
      productImage1Url,
      productImage2Url,
      receptionMethod,
      receptionContact,
    } = params;

    if (!uid) {
      throw new Error("AUTH_REQUIRED");
    }

    const call = httpsCallable<
      {
        expectedContent: string;
        format: AiVideoFormat;
        productImage1Url: string;
        productImage2Url: string;
        receptionMethod: AiVideoReceptionMethod;
        receptionContact: string;
      },
      { orderId: string; orderNumber: string; finalPrice: number }
    >(this.functions, "requestAiVideoOrder");

    try {
      const result = await call({
        expectedContent,
        format,
        productImage1Url,
        productImage2Url,
        receptionMethod,
        receptionContact,
      });

      return result.data;
    } catch (error: any) {
      console.error("[AiVideoOrderService] createOrder failed:", error);
      // Re-throw meaningful errors if needed, or generic
      throw error;
    }
  }
}
