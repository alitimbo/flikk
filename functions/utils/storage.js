const path = require("path");
const os = require("os");
const { logger } = require("firebase-functions");

async function downloadToTemp(bucket, filePath) {
  const fileName = path.basename(filePath);
  const tmpPath = path.join(os.tmpdir(), fileName);
  await bucket.file(filePath).download({ destination: tmpPath });
  return tmpPath;
}

async function uploadFromTemp(bucket, tmpPath, targetPath, kind, sourcePath) {
  const contentType = kind === "image" ? "image/png" : "video/mp4";
  await bucket.upload(tmpPath, {
    destination: targetPath,
    metadata: {
      contentType,
      metadata: {
        "flikk:sourcePath": sourcePath,
        "flikk:convertedAt": new Date().toISOString(),
      },
    },
  });
  logger.info("convertMedia: uploaded", { targetPath, contentType });
}

async function deleteObject(bucket, filePath) {
  await bucket.file(filePath).delete();
  logger.info("convertMedia: deleted raw file", { filePath });
}

module.exports = {
  downloadToTemp,
  uploadFromTemp,
  deleteObject,
};
