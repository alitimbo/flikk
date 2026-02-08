const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Transcodes a video into HLS with multiple resolutions (ABR ladder).
 * 
 * @param {string} inputPath Path to the raw video file in /tmp
 * @param {string} outputDir Directory in /tmp where HLS files will be saved
 * @returns {Promise<void>}
 */
async function transcodeVideo(inputPath, outputDir) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const ladder = [
        { resolution: "1280x720", bitrate: "2500k", name: "720p" },
        { resolution: "854x480", bitrate: "1000k", name: "480p" },
        { resolution: "640x360", bitrate: "600k", name: "360p" },
    ];

    const masterPlaylistLines = ["#EXTM3U", "#EXT-X-VERSION:3"];

    // Note: For simplicity in this implementation, we process sequentially.
    // In production, you might want to run them in parallel for speed if resources allow.
    for (const variant of ladder) {
        const variantDir = path.join(outputDir, variant.name);
        if (!fs.existsSync(variantDir)) {
            fs.mkdirSync(variantDir);
        }

        const playlistFile = "index.m3u8";
        const segmentFiles = "segment_%03d.ts";

        console.log(`Flikk Transcoding: Starting ${variant.name}...`);

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .size(variant.resolution)
                .videoBitrate(variant.bitrate)
                .addOptions([
                    "-profile:v main",
                    "-level 3.1",
                    "-start_number 0",
                    "-hls_time 10",
                    "-hls_list_size 0",
                    "-f hls",
                ])
                .output(path.join(variantDir, playlistFile))
                .on("end", () => {
                    console.log(`Flikk Transcoding: Finished ${variant.name}.`);

                    // Add to master playlist
                    // Calculate bandwidth (approximate)
                    const bandwidth = parseInt(variant.bitrate) * 1000;
                    masterPlaylistLines.push(
                        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${variant.resolution}`
                    );
                    masterPlaylistLines.push(`${variant.name}/${playlistFile}`);

                    resolve();
                })
                .on("error", (err) => {
                    console.error(`Flikk Transcoding Error [${variant.name}]:`, err);
                    reject(err);
                })
                .run();
        });
    }

    // Write Master Playlist
    fs.writeFileSync(
        path.join(outputDir, "master.m3u8"),
        masterPlaylistLines.join("\n")
    );
    console.log("Flikk Transcoding: Master playlist generated.");
}

module.exports = { transcodeVideo };
