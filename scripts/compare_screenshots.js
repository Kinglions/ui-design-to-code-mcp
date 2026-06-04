#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    maxPixelDiffRatio: 0.08,
    maxPixelDiffRatioExplicit: false,
    maxMeanChannelDelta: 12,
    pixelDeltaThreshold: 16,
    requireSameDimensions: true,
    minSimilarity: null,
    ignoreRects: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const valueArgs = [
      "--expected",
      "--actual",
      "--diff",
      "--json",
      "--ignore-rects",
      "--ignore-rects-file",
      "--min-similarity",
      "--max-pixel-diff-ratio",
      "--max-mean-channel-delta",
      "--pixel-delta-threshold"
    ];
    if (arg === "--allow-different-dimensions") {
      options.requireSameDimensions = false;
      continue;
    }
    if (valueArgs.includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`missing value for ${arg}`);
      if (arg === "--expected") options.expected = path.resolve(process.cwd(), value);
      if (arg === "--actual") options.actual = path.resolve(process.cwd(), value);
      if (arg === "--diff") options.diff = path.resolve(process.cwd(), value);
      if (arg === "--json") options.json = path.resolve(process.cwd(), value);
      if (arg === "--ignore-rects") options.ignoreRects = JSON.parse(value);
      if (arg === "--ignore-rects-file") options.ignoreRects = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), value), "utf8"));
      if (arg === "--min-similarity") options.minSimilarity = Number(value);
      if (arg === "--max-pixel-diff-ratio") {
        options.maxPixelDiffRatio = Number(value);
        options.maxPixelDiffRatioExplicit = true;
      }
      if (arg === "--max-mean-channel-delta") options.maxMeanChannelDelta = Number(value);
      if (arg === "--pixel-delta-threshold") options.pixelDeltaThreshold = Number(value);
      index += 1;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }

  if (!options.expected) fail("--expected is required");
  if (!options.actual) fail("--actual is required");
  if (!fs.existsSync(options.expected)) fail(`missing expected image: ${options.expected}`);
  if (!fs.existsSync(options.actual)) fail(`missing actual image: ${options.actual}`);
  if (options.minSimilarity !== null) {
    if (!Number.isFinite(options.minSimilarity) || options.minSimilarity < 0 || options.minSimilarity > 1) {
      fail("--min-similarity must be between 0 and 1");
    }
    options.maxPixelDiffRatio = options.maxPixelDiffRatioExplicit
      ? Math.min(options.maxPixelDiffRatio, 1 - options.minSimilarity)
      : 1 - options.minSimilarity;
  }
  if (!Array.isArray(options.ignoreRects)) fail("--ignore-rects must be a JSON array");
  return options;
}

function convertWithSips(inputPath) {
  const outputPath = path.join(os.tmpdir(), `ui-design-to-code-${process.pid}-${path.basename(inputPath)}.bmp`);
  try {
    execFileSync("sips", ["-s", "format", "bmp", inputPath, "--out", outputPath], { stdio: "ignore" });
  } catch (error) {
    fail("Image comparison needs macOS sips for PNG/JPEG/BMP conversion, or provide BMP files directly.");
  }
  return outputPath;
}

function readBmp(inputPath) {
  const bmpPath = path.extname(inputPath).toLowerCase() === ".bmp" ? inputPath : convertWithSips(inputPath);
  const buffer = fs.readFileSync(bmpPath);
  if (buffer.toString("ascii", 0, 2) !== "BM") fail(`not a BMP image: ${inputPath}`);

  const pixelOffset = buffer.readUInt32LE(10);
  const dibSize = buffer.readUInt32LE(14);
  const width = buffer.readInt32LE(18);
  const rawHeight = buffer.readInt32LE(22);
  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const bitsPerPixel = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);

  if (![24, 32].includes(bitsPerPixel)) fail(`unsupported BMP bit depth ${bitsPerPixel}: ${inputPath}`);
  if (compression !== 0 && compression !== 3) fail(`unsupported BMP compression ${compression}: ${inputPath}`);
  if (dibSize < 40) fail(`unsupported BMP DIB header: ${inputPath}`);

  const bytesPerPixel = bitsPerPixel / 8;
  const rowStride = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceY = topDown ? y : height - 1 - y;
    const rowStart = pixelOffset + sourceY * rowStride;
    for (let x = 0; x < width; x += 1) {
      const source = rowStart + x * bytesPerPixel;
      const target = (y * width + x) * 4;
      pixels[target] = buffer[source + 2];
      pixels[target + 1] = buffer[source + 1];
      pixels[target + 2] = buffer[source];
      pixels[target + 3] = bitsPerPixel === 32 ? buffer[source + 3] : 255;
    }
  }

  if (bmpPath !== inputPath) {
    fs.rmSync(bmpPath, { force: true });
  }

  return { width, height, pixels };
}

function writePpmDiff(outputPath, width, height, diffPixels) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, "ascii");
  const body = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    const target = i * 3;
    if (diffPixels[i]) {
      body[target] = 255;
      body[target + 1] = 0;
      body[target + 2] = 80;
    } else {
      body[target] = 24;
      body[target + 1] = 24;
      body[target + 2] = 24;
    }
  }
  fs.writeFileSync(outputPath, Buffer.concat([header, body]));
}

function compareImages(expected, actual, options) {
  if (options.requireSameDimensions && (expected.width !== actual.width || expected.height !== actual.height)) {
    fail(`image dimensions differ: expected ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`);
  }

  const width = Math.min(expected.width, actual.width);
  const height = Math.min(expected.height, actual.height);
  const totalPixels = width * height;
  const diffPixels = new Uint8Array(totalPixels);
  const ignored = new Uint8Array(totalPixels);
  for (const rect of options.ignoreRects) {
    const startX = Math.max(0, Math.floor(rect.x || 0));
    const startY = Math.max(0, Math.floor(rect.y || 0));
    const endX = Math.min(width, Math.ceil(startX + (rect.width || 0)));
    const endY = Math.min(height, Math.ceil(startY + (rect.height || 0)));
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        ignored[y * width + x] = 1;
      }
    }
  }
  let differentPixels = 0;
  let totalDelta = 0;
  let comparedPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (ignored[pixelIndex]) continue;
      const expectedIndex = (y * expected.width + x) * 4;
      const actualIndex = (y * actual.width + x) * 4;
      const dr = Math.abs(expected.pixels[expectedIndex] - actual.pixels[actualIndex]);
      const dg = Math.abs(expected.pixels[expectedIndex + 1] - actual.pixels[actualIndex + 1]);
      const db = Math.abs(expected.pixels[expectedIndex + 2] - actual.pixels[actualIndex + 2]);
      const mean = (dr + dg + db) / 3;
      totalDelta += mean;
      comparedPixels += 1;
      if (mean > options.pixelDeltaThreshold) {
        differentPixels += 1;
        diffPixels[pixelIndex] = 1;
      }
    }
  }

  const pixelDiffRatio = comparedPixels === 0 ? 1 : differentPixels / comparedPixels;
  const meanChannelDelta = comparedPixels === 0 ? 255 : totalDelta / comparedPixels;
  const similarity = 1 - pixelDiffRatio;
  return {
    width,
    height,
    totalPixels,
    comparedPixels,
    ignoredPixels: totalPixels - comparedPixels,
    differentPixels,
    pixelDiffRatio,
    similarity,
    meanChannelDelta,
    passed: pixelDiffRatio <= options.maxPixelDiffRatio && meanChannelDelta <= options.maxMeanChannelDelta,
    diffPixels
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const expected = readBmp(options.expected);
  const actual = readBmp(options.actual);
  const result = compareImages(expected, actual, options);

  if (options.diff) {
    writePpmDiff(options.diff, result.width, result.height, result.diffPixels);
  }

  const report = {
    artifactType: "visual_review_result",
    status: result.passed ? "passed" : "failed",
    comparisons: [
      {
        id: "screenshot-diff",
        sourcePath: options.expected,
        actualPath: options.actual,
        diffPath: options.diff,
        status: result.passed ? "passed" : "failed",
        metrics: {
          width: result.width,
          height: result.height,
          pixelDiffRatio: result.pixelDiffRatio,
          similarity: result.similarity,
          meanChannelDelta: result.meanChannelDelta,
          differentPixels: result.differentPixels,
          comparedPixels: result.comparedPixels,
          ignoredPixels: result.ignoredPixels,
          totalPixels: result.totalPixels
        }
      }
    ],
    findings: result.passed
      ? []
      : [{ severity: "error", message: "Screenshot diff exceeds configured thresholds." }]
  };

  if (options.json) {
    fs.mkdirSync(path.dirname(options.json), { recursive: true });
    fs.writeFileSync(options.json, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(JSON.stringify(report.comparisons[0].metrics));
  if (!result.passed) process.exit(2);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
