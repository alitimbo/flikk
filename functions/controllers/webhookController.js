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
  if (!data?.reference) {
    logger.warn("Webhook missing reference", { body: req.body });
    return res.status(400).send("Missing reference");
  }

  const paymentRef = admin.firestore().collection("payments").doc(data.reference);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    logger.warn("Webhook payment not found", { reference: data.reference });
  }

  await paymentRef.set(
    {
      reference: data.reference,
      status: data.status || "pending",
      externalReference: data.external_reference ?? null,
      msisdn: data.msisdn ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (data.status === "succeeded" && paymentSnap.exists) {
    const payment = paymentSnap.data();
    const orderRef = admin.firestore().collection("orders").doc();
    const orderId = orderRef.id;

    await admin.firestore().runTransaction(async (tx) => {
      const latestPaymentSnap = await tx.get(paymentRef);
      const latestPayment = latestPaymentSnap.data() || {};
      if (latestPayment.orderId) return;

      tx.set(orderRef, {
        orderId,
        paymentReference: data.reference,
        paymentStatus: "paid",
        externalReference: data.external_reference ?? null,
        publicationId: payment.publicationId ?? null,
        productName: payment.productName ?? null,
        productImageUrl: payment.productImageUrl ?? null,
        amount: payment.amount ?? null,
        currency: payment.currency ?? "XOF",
        country: payment.country ?? "NE",
        msisdn: data.msisdn ?? payment.msisdn ?? null,
        customerName: payment.customerName ?? null,
        customerId: payment.userId ?? null,
        merchantId: payment.merchantId ?? null,
        merchantName: payment.merchantName ?? null,
        merchantLogoUrl: payment.merchantLogoUrl ?? null,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(paymentRef, {
        orderId,
        paymentStatus: "paid",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (payment.publicationId) {
        const publicationRef = admin
          .firestore()
          .collection("publications")
          .doc(payment.publicationId);
        tx.update(publicationRef, {
          orderCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });
  }

  return res.status(200).json({ received: true });
});
