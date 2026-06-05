#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    canvasWidth: 750,
    onlyType: "bitmap",
    assetsDir: "assets/slices",
    qaDir: "qa",
    manifestOut: "assets/slices/layers.manifest.normalized.json",
    auditOut: "qa/png-asset-audit.json",
    previewOut: "qa/bbox-preview.svg"
  };
  const valueArgs = new Set([
    "--run",
    "--source",
    "--layers",
    "--canvas-width",
    "--only-type",
    "--assets-dir",
    "--qa-dir",
    "--manifest-out",
    "--audit-out",
    "--preview-out"
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valueArgs.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`missing value for ${arg}`);
      if (arg === "--run") options.runRoot = path.resolve(process.cwd(), value);
      if (arg === "--source") options.sourcePath = path.resolve(process.cwd(), value);
      if (arg === "--layers") options.layersPath = path.resolve(process.cwd(), value);
      if (arg === "--canvas-width") options.canvasWidth = Number(value);
      if (arg === "--only-type") options.onlyType = value === "all" ? "" : value;
      if (arg === "--assets-dir") options.assetsDir = value;
      if (arg === "--qa-dir") options.qaDir = value;
      if (arg === "--manifest-out") options.manifestOut = value;
      if (arg === "--audit-out") options.auditOut = value;
      if (arg === "--preview-out") options.previewOut = value;
      index += 1;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!options.runRoot) fail("--run is required");
  if (!options.sourcePath) fail("--source is required");
  if (!options.layersPath) fail("--layers is required");
  if (!Number.isFinite(options.canvasWidth) || options.canvasWidth <= 0) fail("--canvas-width must be positive");
  return options;
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveInside(runRoot, relativePath) {
  const absolutePath = path.resolve(runRoot, relativePath);
  if (!isInside(runRoot, absolutePath)) fail(`path escapes run directory: ${relativePath}`);
  return absolutePath;
}

function shellEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slugify(value) {
  return String(value || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
}

function imageSize(imagePath) {
  const result = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", imagePath], { encoding: "utf8" });
  if (result.status !== 0) fail(result.stderr || `sips failed to read image size: ${imagePath}`);
  const width = Number((result.stdout.match(/pixelWidth:\s*(\d+)/) || [])[1]);
  const height = Number((result.stdout.match(/pixelHeight:\s*(\d+)/) || [])[1]);
  if (!width || !height) fail(`unable to infer image size: ${imagePath}`);
  return { width, height };
}

function cropPng(sourcePath, outputPath, bbox) {
  mkdirp(path.dirname(outputPath));
  const result = spawnSync("sips", [
    "--cropToHeightWidth",
    String(bbox.height),
    String(bbox.width),
    "--cropOffset",
    String(bbox.y),
    String(bbox.x),
    "--setProperty",
    "format",
    "png",
    sourcePath,
    "--out",
    outputPath
  ], { encoding: "utf8" });
  if (result.status !== 0) fail(result.stderr || result.stdout || `sips crop failed: ${outputPath}`);
}

function normalizeBbox(raw, scale = 1) {
  const bbox = {
    x: Math.round(Number(raw.x) * scale),
    y: Math.round(Number(raw.y) * scale),
    width: Math.round(Number(raw.width) * scale),
    height: Math.round(Number(raw.height) * scale)
  };
  if (bbox.x < 0 || bbox.y < 0 || bbox.width <= 0 || bbox.height <= 0) {
    fail(`invalid bbox: ${JSON.stringify(raw)}`);
  }
  return bbox;
}

function validateBboxWithinSource(bbox, size, id) {
  if (bbox.x + bbox.width > size.width || bbox.y + bbox.height > size.height) {
    fail(`bbox exceeds source bounds for ${id}: ${JSON.stringify(bbox)} source=${size.width}x${size.height}`);
  }
}

function manifestItemSize(item) {
  const expected = item.scaled_bbox || item.source_bbox;
  return expected ? { width: Math.round(Number(expected.width)), height: Math.round(Number(expected.height)) } : null;
}

function createPreviewSvg(sourcePath, sourceSize, layers, outputPath) {
  const imageHref = shellEscape(sourcePath);
  const rects = layers.map((item, index) => {
    const bbox = item.source_bbox;
    const color = item.type === "text" ? "#0080ff" : item.type === "vector" ? "#00c850" : "#ff0038";
    const label = shellEscape(`${index + 1}:${item.id || item.type || "layer"}`);
    return [
      `<rect x="${bbox.x}" y="${bbox.y}" width="${bbox.width}" height="${bbox.height}" fill="none" stroke="${color}" stroke-width="2"/>`,
      `<rect x="${bbox.x}" y="${Math.max(0, bbox.y - 18)}" width="${Math.max(80, label.length * 7)}" height="18" fill="rgba(0,0,0,0.72)"/>`,
      `<text x="${bbox.x + 3}" y="${Math.max(12, bbox.y - 5)}" fill="#fff" font-size="12" font-family="monospace">${label}</text>`
    ].join("\n");
  }).join("\n");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sourceSize.width}" height="${sourceSize.height}" viewBox="0 0 ${sourceSize.width} ${sourceSize.height}">`,
    `<image href="${imageHref}" x="0" y="0" width="${sourceSize.width}" height="${sourceSize.height}"/>`,
    rects,
    "</svg>",
    ""
  ].join("\n");
  fs.writeFileSync(outputPath, svg);
}

function auditAssets(items) {
  return items.map((item) => {
    const exists = fs.existsSync(item.outputPath);
    const actual = exists ? imageSize(item.outputPath) : null;
    const expected = manifestItemSize(item);
    const sizeOk = Boolean(actual && expected && actual.width === expected.width && actual.height === expected.height);
    return {
      id: item.id,
      path: item.outputPath,
      relativePath: item.asset,
      exists,
      width: actual && actual.width,
      height: actual && actual.height,
      expectedWidth: expected && expected.width,
      expectedHeight: expected && expected.height,
      sizeOk,
      transparentRequired: Boolean(item.transparent_required),
      transparencyAudit: "not_available_without_alpha_decoder",
      edgeTouchAudit: "not_available_without_alpha_decoder"
    };
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.sourcePath)) fail(`source image does not exist: ${options.sourcePath}`);
  if (!fs.existsSync(options.layersPath)) fail(`layers manifest does not exist: ${options.layersPath}`);

  const sourceSize = imageSize(options.sourcePath);
  const scale = options.canvasWidth / sourceSize.width;
  const layers = readJson(options.layersPath);
  if (!Array.isArray(layers)) fail("layers manifest must be a JSON array");

  const assetsDir = resolveInside(options.runRoot, options.assetsDir);
  const qaDir = resolveInside(options.runRoot, options.qaDir);
  const normalizedPath = resolveInside(options.runRoot, options.manifestOut);
  const auditPath = resolveInside(options.runRoot, options.auditOut);
  const previewPath = resolveInside(options.runRoot, options.previewOut);
  mkdirp(assetsDir);
  mkdirp(qaDir);

  const normalizedLayers = [];
  const sliced = [];
  for (const [index, layer] of layers.entries()) {
    const type = String(layer.type || "bitmap");
    const id = String(layer.id || `${type}-${index + 1}`);
    const sourceBbox = normalizeBbox(layer.source_bbox || layer.bbox || layer, 1);
    validateBboxWithinSource(sourceBbox, sourceSize, id);
    const scaledBbox = layer.scaled_bbox ? normalizeBbox(layer.scaled_bbox, 1) : normalizeBbox(sourceBbox, scale);
    const shouldSlice = !options.onlyType || type === options.onlyType;
    const fileName = layer.asset ? path.basename(String(layer.asset)) : `${slugify(id)}.png`;
    const relativeAsset = path.join(options.assetsDir, fileName);
    const outputPath = resolveInside(options.runRoot, relativeAsset);
    const normalized = {
      ...layer,
      id,
      type,
      source_bbox: sourceBbox,
      scaled_bbox: scaledBbox,
      z_index: Number.isFinite(Number(layer.z_index)) ? Number(layer.z_index) : index,
      asset: shouldSlice ? relativeAsset : layer.asset,
      slice_output_path: shouldSlice ? outputPath : undefined
    };
    normalizedLayers.push(normalized);
    if (shouldSlice) {
      cropPng(options.sourcePath, outputPath, sourceBbox);
      sliced.push({ ...normalized, outputPath });
    }
  }

  writeJson(normalizedPath, normalizedLayers);
  createPreviewSvg(options.sourcePath, sourceSize, normalizedLayers, previewPath);
  const audit = {
    artifactType: "png_asset_audit",
    sourcePath: options.sourcePath,
    canvasWidth: options.canvasWidth,
    scale,
    assetsDir,
    slicedCount: sliced.length,
    items: auditAssets(sliced)
  };
  writeJson(auditPath, audit);

  return {
    sourcePath: options.sourcePath,
    sourceSize,
    canvasWidth: options.canvasWidth,
    scale,
    assetsDir,
    normalizedManifestPath: normalizedPath,
    bboxPreviewPath: previewPath,
    auditPath,
    slicedAssets: sliced.map((item) => ({ id: item.id, path: item.outputPath, relativePath: item.asset }))
  };
}

try {
  const result = main();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
