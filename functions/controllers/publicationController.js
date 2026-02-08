const { onObjectFinalized } = require("firebase-functions/v2/storage");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { transcodeVideo } = require("../utils/transcode");

/**
 * Triggered when a raw video is uploaded to 'uploads/raw/videos/'
 */
exports.onRawVideoUpload = onObjectFinalized({
    memory: "2GiB", // FFmpeg is memory intensive
    timeoutSeconds: 540, // Max timeout for long videos
    region: "us-central1",
}, async (event) => {
    const file = event.data;
    const filePath = file.name;
    const contentType = file.contentType;

    // 1. Filter for raw videos
    if (!filePath.startsWith("uploads/raw/videos/") || !contentType.startsWith("video/")) {
        return logger.info("Flikk CF: Not a raw video or wrong path. Skipping.", { filePath });
    }

    logger.info("Flikk CF: Starting HLS processing for", filePath);

    const publicationId = file.metadata?.["flikk:publicationId"];
    if (publicationId) {
        // Mark as processing in Firestore
        await admin.firestore().collection("publications").doc(publicationId).update({
            status: "processing",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    const fileName = path.basename(filePath);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const outputDirName = fileName.split(".")[0];
    const tempOutputDir = path.join(os.tmpdir(), "hls", outputDirName);

    try {
        const bucket = admin.storage().bucket(file.bucket);

        // 2. Download raw video to /tmp
        await bucket.file(filePath).download({ destination: tempFilePath });
        logger.info("Flikk CF: Downloaded to", tempFilePath);

        // 3. Transcode
        await transcodeVideo(tempFilePath, tempOutputDir);

        // 4. Upload HLS files to processed/hls/{fileName}/
        const targetDir = `processed/hls/${outputDirName}`;
        const uploadFiles = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const uploads = entries.map(async (entry) => {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    return uploadFiles(fullPath);
                } else {
                    const relativePath = path.relative(tempOutputDir, fullPath).replace(/\\/g, "/");
                    return bucket.upload(fullPath, {
                        destination: `${targetDir}/${relativePath}`,
                        metadata: {
                            cacheControl: "public, max-age=31536000",
                            contentType: entry.name.endsWith(".m3u8") ? "application/x-mpegURL" : "video/MP2T",
                        },
                    });
                }
            });
            return Promise.all(uploads);
        };

        await uploadFiles(tempOutputDir);
        logger.info("Flikk CF: HLS files uploaded to", targetDir);

        // 5. Update Firestore if publicationId exists
        if (publicationId) {
            const masterPlaylistUrl = `https://storage.googleapis.com/${file.bucket}/${targetDir}/master.m3u8`;
            await admin.firestore().collection("publications").doc(publicationId).update({
                hlsUrl: masterPlaylistUrl,
                status: "ready",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            logger.info("Flikk CF: Publication updated in Firestore", { publicationId });
        }

        // 6. Cleanup /tmp
        fs.unlinkSync(tempFilePath);
        fs.rmSync(tempOutputDir, { recursive: true, force: true });

        logger.info("Flikk CF: Finished processing successfully.");
    } catch (error) {
        logger.error("Flikk CF Error processing video:", error);
        if (publicationId) {
            await admin.firestore().collection("publications").doc(publicationId).update({
                status: "error",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // Cleanup on error
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempOutputDir)) fs.rmSync(tempOutputDir, { recursive: true, force: true });
    }
});
