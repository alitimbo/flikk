const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

const { downloadToTemp, uploadFromTemp, deleteObject } = require("../utils/storage");
const { buildTargetPath, getKindFromMetadata, shouldProcessPath } = require("../utils/paths");
const { transcodeToMp4, convertToPng } = require("../utils/transform");
const { safeUnlink } = require("../utils/fs");

admin.initializeApp();

async function convertMedia(event) {
  const object = event.data;
  if (!object || !object.name) {
    logger.warn("convertMedia: missing object data");
    return;
  }

  const filePath = object.name;
  if (!shouldProcessPath(filePath)) return;

  const kind = getKindFromMetadata(object.metadata);
  if (!kind) {
    logger.warn("convertMedia: missing kind metadata", { filePath });
    return;
  }

  const bucket = admin.storage().bucket(object.bucket);
  const target = buildTargetPath(filePath, kind);

  const tmpInput = await downloadToTemp(bucket, filePath);
  const tmpOutput = await (kind === "image"
    ? convertToPng(tmpInput, target.fileName)
    : transcodeToMp4(tmpInput, target.fileName));

  try {
    await uploadFromTemp(bucket, tmpOutput, target.path, kind, filePath);
    await deleteObject(bucket, filePath);
  } finally {
    await safeUnlink(tmpInput);
    await safeUnlink(tmpOutput);
  }
}

module.exports = {
  convertMedia,
};
