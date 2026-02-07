const path = require("path");

const RAW_PREFIX = "uploads/raw/";
const FINAL_PREFIX = "uploads/final/";

function shouldProcessPath(filePath) {
  if (!filePath.startsWith(RAW_PREFIX)) return false;
  if (filePath.startsWith(FINAL_PREFIX)) return false;
  return true;
}

function getKindFromMetadata(metadata = {}) {
  const kind = metadata["flikk:kind"];
  if (kind !== "image" && kind !== "video") return null;
  return kind;
}

function buildTargetPath(filePath, kind) {
  const fileName = path.basename(filePath);
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const ext = kind === "image" ? "png" : "mp4";
  const targetFileName = `${baseName}.${ext}`;
  const targetPath = `${FINAL_PREFIX}${targetFileName}`;
  return { path: targetPath, fileName: targetFileName };
}

module.exports = {
  RAW_PREFIX,
  FINAL_PREFIX,
  shouldProcessPath,
  getKindFromMetadata,
  buildTargetPath,
};
