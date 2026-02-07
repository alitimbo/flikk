const path = require("path");
const os = require("os");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

async function convertToPng(inputPath, outputFileName) {
  const outputPath = path.join(os.tmpdir(), outputFileName);
  await sharp(inputPath).png().toFile(outputPath);
  return outputPath;
}

function transcodeToMp4(inputPath, outputFileName) {
  const outputPath = path.join(os.tmpdir(), outputFileName);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-preset veryfast",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k",
        "-movflags +faststart",
      ])
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });
}

module.exports = {
  convertToPng,
  transcodeToMp4,
};
