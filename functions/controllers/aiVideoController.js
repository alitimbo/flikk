const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

const AI_VIDEO_BASE_PRICE = 8000;
const FREE_VIDEO_LIMIT = 2;

function buildOrderNumber(sequence, year) {
    return `${String(sequence).padStart(3, "0")}-${year}`;
}

function buildAiOrderId(uid) {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    return `ai_${uid}_${stamp}_${rand}`;
}

exports.requestAiVideoOrder = onCall({ invoker: "public" }, async (request) => {
    if (!request.auth?.uid) {
        logger.warn("requestAiVideoOrder unauthenticated", { hasAuth: !!request.auth });
        throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const {
        expectedContent,
        format,
        productImage1Url,
        productImage2Url,
        receptionMethod,
        receptionContact,
    } = request.data || {};

    const uid = request.auth.uid;

    // Validation
    if (
        !expectedContent ||
        !format ||
        !productImage1Url ||
        !productImage2Url ||
        !receptionMethod ||
        !receptionContact
    ) {
        throw new HttpsError("invalid-argument", "Missing required fields for AI order.");
    }

    const year = new Date().getFullYear();
    const orderId = buildAiOrderId(uid);
    const counterRef = admin
        .firestore()
        .collection("meta")
        .doc("aiVideoOrderCounters")
        .collection("years")
        .doc(String(year));
    const userRef = admin.firestore().collection("users").doc(uid);
    const orderRef = admin.firestore().collection("aiVideoOrders").doc(orderId);

    try {
        const result = await admin.firestore().runTransaction(async (tx) => {
            const [counterSnap, userSnap] = await Promise.all([
                tx.get(counterRef),
                tx.get(userRef),
            ]);

            if (!userSnap.exists) {
                throw new HttpsError("not-found", "User profile not found.");
            }

            const userData = userSnap.data();
            const currentSequence = counterSnap.exists
                ? Number(counterSnap.data()?.lastSequence || 0)
                : 0;
            const nextSequence = currentSequence + 1;
            const orderNumber = buildOrderNumber(nextSequence, year);

            const existingFreeUsageCount = Number(userData.freeUsageCount || 0);
            const freeUsageAvailable = existingFreeUsageCount < FREE_VIDEO_LIMIT;
            const nextFreeUsageCount = freeUsageAvailable
                ? existingFreeUsageCount + 1
                : existingFreeUsageCount;
            const finalPrice = freeUsageAvailable ? 0 : AI_VIDEO_BASE_PRICE;

            const customerName =
                [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
                userData.phoneNumber ||
                "Client Flikk";

            const orderPayload = {
                orderId,
                orderNumber,
                customerId: uid,
                customerName,
                customerPhone: userData.phoneNumber || null,
                customerEmail: userData.email || null,
                expectedContent: expectedContent.trim(),
                format,
                productImage1Url,
                productImage2Url,
                receptionMethod,
                receptionContact: receptionContact.trim(),
                basePrice: AI_VIDEO_BASE_PRICE,
                finalPrice,
                freeUsageApplied: freeUsageAvailable,
                status: "pending",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            tx.set(orderRef, orderPayload);
            tx.set(
                counterRef,
                {
                    lastSequence: nextSequence,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            tx.set(
                userRef,
                {
                    freeUsageCount: nextFreeUsageCount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

            return { orderId, orderNumber, finalPrice };
        });

        return result;
    } catch (error) {
        logger.error("AI Order Creation Transaction Failed", { uid, error: error.message });
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Failed to create AI video order.");
    }
});
