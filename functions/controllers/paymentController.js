const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

const IPAY_BASE_URL = "https://i-pay.money/api/v1/payments";
const IPAY_ENV = process.env.IPAY_ENV || "sandbox";
const IPAY_PRIVATE_KEY = process.env.IPAY_PRIVATE_KEY;

function buildTransactionId(publicationId) {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `flikk_${publicationId}_${stamp}_${rand}`;
}

function formatOrderNumber(sequence, year) {
  return `${String(sequence).padStart(3, "0")}-${year}`;
}

function assertConfig() {
  if (!IPAY_PRIVATE_KEY) {
    throw new HttpsError("failed-precondition", "Missing IPAY_PRIVATE_KEY.");
  }
}

exports.requestPayment = onCall({ invoker: "public" }, async (request) => {
  assertConfig();

  if (!request.auth?.uid) {
    logger.warn("requestPayment unauthenticated", {
      hasAuth: !!request.auth,
    });
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const {
    publicationId,
    msisdn,
    customerName,
    country = "NE",
    currency = "XOF",
  } = request.data || {};

  if (!publicationId || typeof publicationId !== "string") {
    throw new HttpsError("invalid-argument", "publicationId is required.");
  }
  if (!msisdn || typeof msisdn !== "string") {
    throw new HttpsError("invalid-argument", "msisdn is required.");
  }

  const publicationRef = admin.firestore().collection("publications").doc(publicationId);
  const publicationSnap = await publicationRef.get();
  if (!publicationSnap.exists) {
    throw new HttpsError("not-found", "Publication not found.");
  }

  const publication = publicationSnap.data();
  const amount = Number(publication?.price ?? 0);
  if (!amount || amount < 100) {
    throw new HttpsError("failed-precondition", "Amount must be >= 100.");
  }

  const transactionId = buildTransactionId(publicationId);
  const payload = {
    customer_name: customerName || "Client Flikk",
    currency,
    country,
    amount: String(amount),
    transaction_id: transactionId,
    msisdn,
  };

  const response = await fetch(IPAY_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ipay-Payment-Type": "mobile",
      "Ipay-Target-Environment": IPAY_ENV,
      Authorization: `Bearer ${IPAY_PRIVATE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("iPay requestPayment failed", {
      status: response.status,
      body: errorBody,
      payload,
    });
    throw new HttpsError("internal", "iPay request failed.");
  }

  const data = await response.json();
  const reference = data?.reference;
  const status = data?.status || "pending";

  if (!reference) {
    logger.error("iPay missing reference", { data });
    throw new HttpsError("internal", "Missing payment reference.");
  }

  const paymentRef = admin.firestore().collection("payments").doc(reference);
  const orderRef = admin.firestore().collection("orders").doc(reference);
  const year = new Date().getFullYear();
  const counterRef = admin
    .firestore()
    .collection("meta")
    .doc("orderCounters")
    .collection("years")
    .doc(String(year));

  const orderNumber = await admin.firestore().runTransaction(async (tx) => {
    const existingOrderSnap = await tx.get(orderRef);
    if (existingOrderSnap.exists) {
      return existingOrderSnap.data()?.orderNumber || null;
    }

    const counterSnap = await tx.get(counterRef);
    const currentSequence = counterSnap.exists
      ? Number(counterSnap.data()?.lastSequence || 0)
      : 0;
    const nextSequence = currentSequence + 1;
    const nextOrderNumber = formatOrderNumber(nextSequence, year);

    tx.set(
      counterRef,
      {
        lastSequence: nextSequence,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(orderRef, {
      orderId: reference,
      orderNumber: nextOrderNumber,
      paymentReference: reference,
      externalReference: transactionId,
      paymentStatus: status === "succeeded" ? "paid" : "pending",
      status: status === "succeeded" ? "paid" : "pending",
      publicationId,
      productName: publication?.productName ?? null,
      productImageUrl: publication?.imageUrl ?? null,
      amount,
      currency,
      country,
      msisdn,
      customerName: customerName || "Client Flikk",
      customerId: request.auth.uid,
      merchantId: publication?.userId ?? null,
      merchantName: publication?.merchantName ?? null,
      merchantLogoUrl: publication?.merchantLogoUrl ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return nextOrderNumber;
  });

  await paymentRef.set({
    reference,
    status,
    transactionId,
    externalReference: transactionId,
    publicationId,
    userId: request.auth.uid,
    customerName: customerName || "Client Flikk",
    amount,
    currency,
    country,
    msisdn,
    merchantId: publication?.userId ?? null,
    merchantName: publication?.merchantName ?? null,
    merchantLogoUrl: publication?.merchantLogoUrl ?? null,
    productName: publication?.productName ?? null,
    productImageUrl: publication?.imageUrl ?? null,
    orderId: reference,
    orderNumber: orderNumber ?? null,
    paymentStatus: status === "succeeded" ? "paid" : "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { reference, status, orderNumber: orderNumber ?? undefined };
});

exports.getPaymentStatus = onCall({ invoker: "public" }, async (request) => {
  assertConfig();

  const { reference } = request.data || {};
  if (!reference || typeof reference !== "string") {
    throw new HttpsError("invalid-argument", "reference is required.");
  }

  const response = await fetch(`${IPAY_BASE_URL}/${reference}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Ipay-Payment-Type": "mobile",
      "Ipay-Target-Environment": IPAY_ENV,
      Authorization: `Bearer ${IPAY_PRIVATE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("iPay getPaymentStatus failed", {
      status: response.status,
      body: errorBody,
    });
    throw new HttpsError("internal", "iPay status failed.");
  }

  const data = await response.json();
  const status = data?.status || "pending";

  const paymentRef = admin.firestore().collection("payments").doc(reference);
  await paymentRef.set(
    {
      reference,
      status,
      externalReference: data?.external_reference ?? null,
      msisdn: data?.msisdn ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return data;
});

exports.requestManualOrder = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const {
    publicationId,
    msisdn,
    customerName,
    country = "NE",
    currency = "XOF",
  } = request.data || {};

  if (!publicationId || typeof publicationId !== "string") {
    throw new HttpsError("invalid-argument", "publicationId is required.");
  }
  if (!msisdn || typeof msisdn !== "string") {
    throw new HttpsError("invalid-argument", "msisdn is required.");
  }

  const publicationRef = admin.firestore().collection("publications").doc(publicationId);
  const publicationSnap = await publicationRef.get();
  if (!publicationSnap.exists) {
    throw new HttpsError("not-found", "Publication not found.");
  }

  const publication = publicationSnap.data();
  const amount = Number(publication?.price ?? 0);
  if (!amount || amount < 100) {
    throw new HttpsError("failed-precondition", "Amount must be >= 100.");
  }

  const transactionId = buildTransactionId(publicationId);
  const reference = `manual_${transactionId}`;
  const status = "pending";

  const paymentRef = admin.firestore().collection("payments").doc(reference);
  const orderRef = admin.firestore().collection("orders").doc(reference);
  const year = new Date().getFullYear();
  const counterRef = admin
    .firestore()
    .collection("meta")
    .doc("orderCounters")
    .collection("years")
    .doc(String(year));

  const orderNumber = await admin.firestore().runTransaction(async (tx) => {
    const existingOrderSnap = await tx.get(orderRef);
    if (existingOrderSnap.exists) {
      return existingOrderSnap.data()?.orderNumber || null;
    }

    const counterSnap = await tx.get(counterRef);
    const currentSequence = counterSnap.exists
      ? Number(counterSnap.data()?.lastSequence || 0)
      : 0;
    const nextSequence = currentSequence + 1;
    const nextOrderNumber = formatOrderNumber(nextSequence, year);

    tx.set(
      counterRef,
      {
        lastSequence: nextSequence,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(orderRef, {
      orderId: reference,
      orderNumber: nextOrderNumber,
      paymentReference: reference,
      externalReference: transactionId,
      paymentStatus: "pending",
      status: "pending",
      publicationId,
      productName: publication?.productName ?? null,
      productImageUrl: publication?.imageUrl ?? null,
      amount,
      currency,
      country,
      msisdn,
      customerName: customerName || "Client Flikk",
      customerId: request.auth.uid,
      merchantId: publication?.userId ?? null,
      merchantName: publication?.merchantName ?? null,
      merchantLogoUrl: publication?.merchantLogoUrl ?? null,
      provider: "manual",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return nextOrderNumber;
  });

  await paymentRef.set({
    reference,
    status,
    transactionId,
    externalReference: transactionId,
    publicationId,
    userId: request.auth.uid,
    customerName: customerName || "Client Flikk",
    amount,
    currency,
    country,
    msisdn,
    merchantId: publication?.userId ?? null,
    merchantName: publication?.merchantName ?? null,
    merchantLogoUrl: publication?.merchantLogoUrl ?? null,
    productName: publication?.productName ?? null,
    productImageUrl: publication?.imageUrl ?? null,
    orderId: reference,
    orderNumber: orderNumber ?? null,
    paymentStatus: "pending",
    provider: "manual",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { reference, status, orderNumber: orderNumber ?? undefined };
});
