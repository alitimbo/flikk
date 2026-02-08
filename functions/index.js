/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const admin = require("firebase-admin");
const publicationController = require("./controllers/publicationController");

// Initialize Admin once at entry point
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// Global options for all v2 functions
setGlobalOptions({
    maxInstances: 10,
    region: "us-central1"
});

/**
 * Storage Triggers
 */
exports.onRawVideoUpload = publicationController.onRawVideoUpload;

// Example of grouping for future scalability
// exports.publications = {
//    onRawVideoUpload: publicationController.onRawVideoUpload,
//    onCreate: publicationController.onCreate, // etc.
// };
