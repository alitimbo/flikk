const { onObjectFinalized } = require("firebase-functions/v2/storage");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { transcodeVideo } = require("../utils/transcode");

/**
 * Triggered when a raw video is uploaded to 'uploads/raw/videos/'
 * Transcodes to HLS and updates Firestore via CDN URL.
 */
exports.onRawVideoUpload = onObjectFinalized({
    memory: "2GiB", // FFmpeg est gourmand en RAM
    timeoutSeconds: 540, // 9 minutes max pour les vidéos lourdes
    region: "us-central1",
}, async (event) => {
    const file = event.data;
    const filePath = file.name;
    const contentType = file.contentType;
    const bucketName = file.bucket;

    logger.info("Flikk CF: Analyse du fichier entrant...", { filePath, contentType });

    // 1. Filtrage : On ne traite que les vidéos dans le dossier raw
    if (!filePath.includes("uploads/raw/videos/") || !contentType.startsWith("video/")) {
        return logger.info("Flikk CF: Skipping - Not in raw folder or not a video", { filePath });
    }

    logger.info("Flikk CF: Starting HLS processing for", filePath);

    // Initialisation des variables de chemin
    const fileName = path.basename(filePath);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const outputDirName = fileName.split(".")[0];
    const tempOutputDir = path.join(os.tmpdir(), "hls", outputDirName);

    // Identification de la publication (via metadata ou recherche)
    let pubId = file.metadata?.["flikk:publicationId"];

    try {
        const bucket = admin.storage().bucket(bucketName);

        // 2. Marquer le début du traitement si on a déjà l'ID
        if (pubId) {
            await admin.firestore().collection("publications").doc(pubId).update({
                status: "processing",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // 3. Téléchargement de la vidéo brute
        await bucket.file(filePath).download({ destination: tempFilePath });
        logger.info("Flikk CF: Downloaded to", tempFilePath);

        // 4. HLS transcode with orientation-aware ladder (portrait or landscape)
        const transcodeResult = await transcodeVideo(tempFilePath, tempOutputDir);

        // 5. Upload des fichiers HLS vers processed/hls/{fileName}/
        const targetDir = `processed/hls/${outputDirName}`;

        const uploadFiles = async (dir) => {
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

        // 6. Identification du document Firestore (Recherche par URL si pubId est manquant)
        if (!pubId) {
            logger.info("Flikk CF: ID non trouvé dans metadata, recherche par URL...");
            const originalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media`;

            const snapshot = await admin.firestore().collection("publications")
                .where("videoUrl", ">=", originalUrl.split('?')[0])
                .limit(1)
                .get();

            if (!snapshot.empty) {
                pubId = snapshot.docs[0].id;
            }
        }

        // 7. Mise à jour finale du document avec l'URL du CDN
        if (pubId) {
            const cdnBaseUrl = "http://34.128.178.186"; // Ton IP Load Balancer
            const hlsUrl = `${cdnBaseUrl}/${targetDir}/master.m3u8`;

            await admin.firestore().collection("publications").doc(pubId).update({
                hlsUrl: hlsUrl,
                videoUrl: hlsUrl, // On remplace par l'URL rapide pour le feed
                videoAspectProfile: transcodeResult.aspectProfile,
                videoSourceWidth: transcodeResult.sourceWidth,
                videoSourceHeight: transcodeResult.sourceHeight,
                videoSourceRatio: transcodeResult.sourceRatio,
                videoVariants: transcodeResult.ladder,
                status: "ready",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            logger.info("Flikk CF: Firestore updated successfully", {
                pubId,
                hlsUrl,
                aspectProfile: transcodeResult.aspectProfile,
                sourceWidth: transcodeResult.sourceWidth,
                sourceHeight: transcodeResult.sourceHeight,
            });
        } else {
            logger.warn("Flikk CF: No Firestore document found to update.");
        }

        // 8. Nettoyage
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempOutputDir)) fs.rmSync(tempOutputDir, { recursive: true, force: true });

        logger.info("Flikk CF: Finished processing successfully.");

    } catch (error) {
        logger.error("Flikk CF Error processing video:", error);
        if (pubId) {
            await admin.firestore().collection("publications").doc(pubId).update({
                status: "error",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // Nettoyage en cas d'erreur
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempOutputDir)) fs.rmSync(tempOutputDir, { recursive: true, force: true });
    }
});
