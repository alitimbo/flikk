const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegPath);

const PORTRAIT_RATIO = 9 / 16;
const LANDSCAPE_RATIO = 16 / 9;

function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (error, metadata) => {
      if (error) {
        reject(error);
        return;
      }

      const videoStream = (metadata?.streams || []).find(
        (stream) => stream.codec_type === "video",
      );
      const width = Number(videoStream?.width || 0);
      const height = Number(videoStream?.height || 0);
      const rotateTag = Number(videoStream?.tags?.rotate || 0);
      const rotateSideData = Number(
        (videoStream?.side_data_list || []).find(
          (sideData) => typeof sideData?.rotation !== "undefined",
        )?.rotation || 0,
      );
      const rotation = Number.isFinite(rotateTag) && rotateTag !== 0
        ? rotateTag
        : rotateSideData;
      const hasRotatedMetadata = Math.abs(rotation) % 180 === 90;

      if (!width || !height) {
        reject(new Error("Unable to read input video dimensions."));
        return;
      }

      resolve({
        width: hasRotatedMetadata ? height : width,
        height: hasRotatedMetadata ? width : height,
      });
    });
  });
}

function chooseAspectProfile(width, height) {
  const ratio = width / height;
  const distancePortrait = Math.abs(ratio - PORTRAIT_RATIO);
  const distanceLandscape = Math.abs(ratio - LANDSCAPE_RATIO);
  return distancePortrait <= distanceLandscape ? "portrait" : "landscape";
}

function buildLadder(profile) {
  if (profile === "portrait") {
    return [
      {
        name: "1280x720",
        width: 720,
        height: 1280,
        bitrate: "2800k",
        maxrate: "3000k",
        bufsize: "5600k",
      },
      {
        name: "960x540",
        width: 540,
        height: 960,
        bitrate: "1600k",
        maxrate: "1750k",
        bufsize: "3200k",
      },
      {
        name: "640x360",
        width: 360,
        height: 640,
        bitrate: "900k",
        maxrate: "1000k",
        bufsize: "1800k",
      },
    ];
  }

  return [
    {
      name: "720p",
      width: 1280,
      height: 720,
      bitrate: "2500k",
      maxrate: "2700k",
      bufsize: "5000k",
    },
    {
      name: "480p",
      width: 854,
      height: 480,
      bitrate: "1200k",
      maxrate: "1300k",
      bufsize: "2400k",
    },
    {
      name: "360p",
      width: 640,
      height: 360,
      bitrate: "700k",
      maxrate: "800k",
      bufsize: "1400k",
    },
  ];
}

function writeMasterPlaylist(outputDir, ladder) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];

  for (const variant of ladder) {
    const bandwidth = parseInt(variant.maxrate || variant.bitrate, 10) * 1000;
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${variant.width}x${variant.height}`,
    );
    lines.push(`${variant.name}/index.m3u8`);
  }

  fs.writeFileSync(path.join(outputDir, "master.m3u8"), lines.join("\n"));
}

/**
 * Transcodes a video into HLS with multiple resolutions.
 * Orientation is inferred from source dimensions:
 * - closer to 9:16 => portrait ladder
 * - closer to 16:9 => landscape ladder
 *
 * @param {string} inputPath
 * @param {string} outputDir
 * @returns {Promise<{
 *   aspectProfile: "portrait" | "landscape",
 *   sourceWidth: number,
 *   sourceHeight: number,
 *   sourceRatio: number,
 *   ladder: Array<{ name: string, width: number, height: number, bitrate: string }>
 * }>}
 */
async function transcodeVideo(inputPath, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const source = await probeVideo(inputPath);
  const sourceRatio = source.width / source.height;
  const aspectProfile = chooseAspectProfile(source.width, source.height);
  const ladder = buildLadder(aspectProfile);

  for (const variant of ladder) {
    const variantDir = path.join(outputDir, variant.name);
    if (!fs.existsSync(variantDir)) {
      fs.mkdirSync(variantDir, { recursive: true });
    }

    const playlistPath = path.join(variantDir, "index.m3u8");
    const segmentPattern = path.join(variantDir, "segment_%03d.ts");
    const videoFilter =
      `scale=w=${variant.width}:h=${variant.height}:force_original_aspect_ratio=decrease,` +
      `pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(videoFilter)
        .outputOptions([
          "-map 0:v:0",
          "-map 0:a:0?",
          "-c:v libx264",
          "-preset veryfast",
          "-profile:v main",
          "-level 4.0",
          "-pix_fmt yuv420p",
          `-b:v ${variant.bitrate}`,
          `-maxrate ${variant.maxrate}`,
          `-bufsize ${variant.bufsize}`,
          "-g 48",
          "-keyint_min 48",
          "-sc_threshold 0",
          "-c:a aac",
          "-b:a 128k",
          "-ac 2",
          "-ar 48000",
          "-start_number 0",
          "-hls_time 6",
          "-hls_list_size 0",
          "-hls_playlist_type vod",
          `-hls_segment_filename ${segmentPattern}`,
          "-f hls",
        ])
        .on("end", resolve)
        .on("error", reject)
        .output(playlistPath)
        .run();
    });
  }

  writeMasterPlaylist(outputDir, ladder);

  return {
    aspectProfile,
    sourceWidth: source.width,
    sourceHeight: source.height,
    sourceRatio,
    ladder: ladder.map((variant) => ({
      name: variant.name,
      width: variant.width,
      height: variant.height,
      bitrate: variant.bitrate,
    })),
  };
}

module.exports = { transcodeVideo };
