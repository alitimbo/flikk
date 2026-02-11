const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

const IPAY_SECRET_HASH = process.env.IPAY_SECRET_HASH;

function isValidSecret(request) {
  const headerSecret =
    request.headers["x-ipaymoney-secret"] ||
    request.headers["x-ipaymoney-secret-hash"] ||
    request.headers["secret-hash"];
  if (!IPAY_SECRET_HASH) return false;
  return String(headerSecret || "") === String(IPAY_SECRET_HASH);
}

exports.ipayWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  if (!isValidSecret(req)) {
    logger.warn("Webhook invalid signature", {
      headers: req.headers,
    });
    return res.status(401).send("Invalid signature");
  }

  const data = req.body?.data;
  if (!data?.reference && !data?.external_reference) {
    logger.warn("Webhook missing identifiers", { body: req.body });
    return res.status(400).send("Missing reference");
  }

  let paymentRef = null;
  let paymentSnap = null;

  if (data.reference) {
    paymentRef = admin.firestore().collection("payments").doc(data.reference);
    paymentSnap = await paymentRef.get();
  }

  if ((!paymentSnap || !paymentSnap.exists) && data.external_reference) {
    const paymentQuery = await admin
      .firestore()
      .collection("payments")
      .where("externalReference", "==", data.external_reference)
      .limit(1)
      .get();
    if (!paymentQuery.empty) {
      paymentRef = paymentQuery.docs[0].ref;
      paymentSnap = paymentQuery.docs[0];
    }
  }

  if (!paymentSnap || !paymentSnap.exists || !paymentRef) {
    logger.warn("Webhook payment not found", {
      reference: data.reference,
      externalReference: data.external_reference,
    });
    return res.status(200).json({ received: true });
  }

  const payment = paymentSnap.data() || {};
  const orderId = payment.orderId || payment.reference || data.reference;
  const orderRef = admin.firestore().collection("orders").doc(orderId);
  const mappedStatus = data.status === "succeeded" ? "paid" : "failed";

  await paymentRef.set(
    {
      reference: payment.reference || data.reference,
      status: data.status || "pending",
      externalReference: data.external_reference ?? null,
      msisdn: data.msisdn ?? null,
      paymentStatus: mappedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const orderSnap = await orderRef.get();
  const wasPaid = (orderSnap.data()?.status || "") === "paid";

  await orderRef.set(
    {
      orderId,
      paymentReference: payment.reference || data.reference,
      externalReference: data.external_reference ?? payment.externalReference ?? null,
      paymentStatus: mappedStatus,
      status: mappedStatus,
      msisdn: data.msisdn ?? payment.msisdn ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (data.status === "succeeded" && payment.publicationId && !wasPaid) {
    await admin.firestore().runTransaction(async (tx) => {
      const latestOrderSnap = await tx.get(orderRef);
      const latestStatus = latestOrderSnap.data()?.status;
      if (latestStatus === "paid") return;
      tx.set(
        orderRef,
        {
          status: "paid",
          paymentStatus: "paid",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      const publicationRef = admin
        .firestore()
        .collection("publications")
        .doc(payment.publicationId);
      tx.set(
        publicationRef,
        {
          orderCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  }

  return res.status(200).json({ received: true });
});
