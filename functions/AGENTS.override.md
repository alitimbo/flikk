# AGENT OVERRIDE: GCP CLOUD FUNCTIONS (Backend)

## 1. CONTEXT & STACK

- **Environment:** Firebase Functions v2 (Cloud Functions).
- **Language:** JavaScript (Node.js).
- **Structure:** Clean Architecture (Controllers, Utils, Index).
- **Style:** Modular and Decoupled.

## 2. ARCHITECTURE RULES (functions/)

- **index.js** : Entry point. Exports all functions by grouping them.
- **controllers/** : Contains the core logic for each function.
- **utils/** : Reusable helpers (DB connections, formatters).
- **middleware/** : Error handling and validation.

## 3. CODING STANDARDS (v2 STRICT)

- **Functions:** Use `onCall` (for Firebase SDK) or `onRequest` (for HTTP) from `firebase-functions/v2/https`.
- **Logging:** Use `logger` from `firebase-functions`. NEVER use `console.log`.
- **Errors:** Use a custom `HttpError` class or `HttpsError` from `firebase-functions/v2/https` for `onCall`.
- **Async:** Use `async/await` exclusively.

## 4. FUNCTION EXPORT PATTERN (index.js)

Group functions for scalability:

```javascript
const { onCall, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const productController = require("./controllers/productController");

exports.getProducts = onCall({ region: "us-central1" }, productController.list);
exports.processPayment = onRequest(
  { region: "us-central1" },
  productController.webhook,
);
```
