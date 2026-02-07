const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { logger } = require("firebase-functions");

const { convertMedia } = require("./controllers/mediaController");

exports.convertMedia = onObjectFinalized(
  {
    memory: "2GiB",
    timeoutSeconds: 540,
    region: "us-central1",
  },
  async (event) => {
    try {
      await convertMedia(event);
    } catch (error) {
      logger.error("convertMedia failed", { error });
      throw error;
    }
  }
);
