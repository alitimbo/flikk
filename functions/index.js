/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

require("dotenv").config();
const { setGlobalOptions } = require("firebase-functions");
const admin = require("firebase-admin");
const publicationController = require("./controllers/publicationController");
const viewController = require("./controllers/viewController");
const paymentController = require("./controllers/paymentController");
const webhookController = require("./controllers/webhookController");

// Initialize Admin once at entry point
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// Global options for all v2 functions
setGlobalOptions({
    maxInstances: 10,
    region: "us-central1",
    invoker: "public"
});

/**
 * Storage Triggers
 */
exports.onRawVideoUpload = publicationController.onRawVideoUpload;
exports.incrementViewOnce = viewController.incrementViewOnce;
exports.requestPayment = paymentController.requestPayment;
exports.getPaymentStatus = paymentController.getPaymentStatus;
exports.ipayWebhook = webhookController.ipayWebhook;

// Example of grouping for future scalability
// exports.publications = {
//    onRawVideoUpload: publicationController.onRawVideoUpload,
//    onCreate: publicationController.onCreate, // etc.
// };
