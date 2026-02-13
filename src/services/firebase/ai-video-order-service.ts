import { FirebaseService } from "@/services/firebase/firebase-service";
import type {
  AiVideoFormat,
  AiVideoOrder,
  AiVideoReceptionMethod,
  UserProfile,
} from "@/types";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "@react-native-firebase/firestore";

const AI_VIDEO_BASE_PRICE = 8000;
const FREE_VIDEO_LIMIT = 2;

function buildOrderNumber(sequence: number, year: number): string {
  return `${String(sequence).padStart(3, "0")}-${year}`;
}

function buildAiOrderId(uid: string): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `ai_${uid}_${stamp}_${rand}`;
}

export class AiVideoOrderService {
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
      userProfile,
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

    const trimmedContent = expectedContent.trim();
    const trimmedContact = receptionContact.trim();

    if (
      !trimmedContent ||
      !trimmedContact ||
      !productImage1Url ||
      !productImage2Url
    ) {
      throw new Error("INVALID_AI_ORDER_PAYLOAD");
    }

    const year = new Date().getFullYear();
    const orderId = buildAiOrderId(uid);
    const counterRef = doc(
      collection(
        doc(collection(FirebaseService.db, "meta"), "aiVideoOrderCounters"),
        "years",
      ),
      String(year),
    );
    const userRef = doc(collection(FirebaseService.db, "users"), uid);
    const orderRef = doc(collection(FirebaseService.db, "aiVideoOrders"), orderId);

    let output: { orderId: string; orderNumber: string; finalPrice: number } | null =
      null;

    await runTransaction(FirebaseService.db, async (tx) => {
      const [counterSnap, userSnap] = await Promise.all([
        tx.get(counterRef),
        tx.get(userRef),
      ]);

      const currentSequence = Number(counterSnap.data()?.lastSequence ?? 0);
      const nextSequence = currentSequence + 1;
      const orderNumber = buildOrderNumber(nextSequence, year);

      const existingFreeUsageCount = Number(
        userSnap.data()?.freeUsageCount ?? userProfile?.freeUsageCount ?? 0,
      );
      const freeUsageAvailable = existingFreeUsageCount < FREE_VIDEO_LIMIT;
      const nextFreeUsageCount = freeUsageAvailable
        ? existingFreeUsageCount + 1
        : existingFreeUsageCount;
      const finalPrice = freeUsageAvailable ? 0 : AI_VIDEO_BASE_PRICE;

      const customerName =
        [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(" ") ||
        userProfile?.phoneNumber ||
        "Client Flikk";
      const customerPhone = userProfile?.phoneNumber ?? null;
      const customerEmail = userProfile?.email ?? null;

      const orderPayload: AiVideoOrder = {
        orderId,
        orderNumber,
        customerId: uid,
        customerName,
        customerPhone,
        customerEmail,
        expectedContent: trimmedContent,
        format,
        productImage1Url,
        productImage2Url,
        receptionMethod,
        receptionContact: trimmedContact,
        basePrice: AI_VIDEO_BASE_PRICE,
        finalPrice,
        freeUsageApplied: freeUsageAvailable,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      tx.set(orderRef, orderPayload);
      tx.set(
        counterRef,
        {
          lastSequence: nextSequence,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      tx.set(
        userRef,
        {
          freeUsageCount: nextFreeUsageCount,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      output = {
        orderId,
        orderNumber,
        finalPrice,
      };
    });

    if (!output) {
      throw new Error("AI_ORDER_CREATION_FAILED");
    }

    return output;
  }
}
