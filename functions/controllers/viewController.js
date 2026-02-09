const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

exports.incrementViewOnce = onCall(async (request) => {
  const { publicationId, deviceId } = request.data || {};

  if (!publicationId || typeof publicationId !== "string") {
    throw new HttpsError("invalid-argument", "publicationId is required.");
  }
  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 8) {
    throw new HttpsError("invalid-argument", "deviceId is required.");
  }

  const publicationRef = admin.firestore().collection("publications").doc(publicationId);
  const viewerRef = publicationRef.collection("viewers").doc(deviceId);

  try {
    const result = await admin.firestore().runTransaction(async (tx) => {
      const viewerSnap = await tx.get(viewerRef);
      if (viewerSnap.exists) {
        return { counted: false };
      }

      tx.set(viewerRef, {
        deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(publicationRef, {
        viewCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { counted: true };
    });

    return result;
  } catch (error) {
    logger.error("incrementViewOnce failed", { publicationId, deviceId, error });
    throw new HttpsError("internal", "Unable to increment view.");
  }
});
