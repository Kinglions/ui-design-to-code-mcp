#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    out: "targets/asset-sync-manifest.json"
  };
  const takesValue = new Set(["--run", "--downloads", "--project-root", "--targets", "--out"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (takesValue.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`missing value for ${arg}`);
      if (arg === "--run") options.runRoot = path.resolve(process.cwd(), value);
      if (arg === "--downloads") options.downloadsPath = path.resolve(process.cwd(), value);
      if (arg === "--project-root") options.projectRoot = path.resolve(process.cwd(), value);
      if (arg === "--targets") options.targets = String(value).split(",").map((item) => item.trim()).filter(Boolean);
      if (arg === "--out") options.out = value;
      index += 1;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!options.runRoot) fail("--run is required");
  if (!options.downloadsPath) fail("--downloads is required");
  if (!options.projectRoot) fail("--project-root is required");
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

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function listDirs(root, matcher, results = []) {
  if (!exists(root)) return results;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (matcher(fullPath, entry.name)) results.push(fullPath);
      listDirs(fullPath, matcher, results);
    }
  }
  return results;
}

function sanitizeFileName(value) {
  return String(value || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "asset";
}

function copyFile(sourcePath, destinationPath) {
  mkdirp(path.dirname(destinationPath));
  fs.copyFileSync(sourcePath, destinationPath);
}

function relativeToProject(projectRoot, destinationPath) {
  return path.relative(projectRoot, destinationPath) || ".";
}

function findIosAssetCatalog(projectRoot) {
  const matches = listDirs(projectRoot, (_, name) => name.endsWith(".xcassets"));
  return matches[0] || "";
}

function findAndroidResDir(projectRoot) {
  const preferred = [
    path.join(projectRoot, "app", "src", "main", "res"),
    path.join(projectRoot, "src", "main", "res")
  ];
  for (const dir of preferred) {
    if (exists(dir)) return dir;
  }
  const matches = listDirs(projectRoot, (fullPath) => fullPath.endsWith(path.join("src", "main", "res")));
  return matches[0] || "";
}

function findWebPublicDir(projectRoot) {
  const preferred = [path.join(projectRoot, "public"), path.join(projectRoot, "src", "assets")];
  for (const dir of preferred) {
    if (exists(dir)) return dir;
  }
  return path.join(projectRoot, "public");
}

function writeIosContentsJson(imagesetPath, fileName, item = {}) {
  const ext = path.extname(fileName).toLowerCase();
  const scale = item.scale ? String(item.scale) + "x" : "1x";
  const data = {
    images: [
      ext === ".pdf"
        ? { idiom: "universal", filename: fileName }
        : { idiom: "universal", scale, filename: fileName }
    ],
    info: { version: 1, author: "ui-design-to-code-mcp" }
  };
  if (ext === ".pdf") data.properties = { "preserves-vector-representation": true };
  writeJson(path.join(imagesetPath, "Contents.json"), data);
}

function syncToIos(projectRoot, item) {
  const catalogPath = findIosAssetCatalog(projectRoot);
  const assetBaseName = sanitizeFileName(path.basename(item.outputPath, path.extname(item.outputPath)));
  if (catalogPath) {
    const imagesetPath = path.join(catalogPath, `${assetBaseName}.imageset`);
    const fileName = path.basename(item.outputPath);
    const destinationPath = path.join(imagesetPath, fileName);
    copyFile(item.outputPath, destinationPath);
    writeIosContentsJson(imagesetPath, fileName, item);
    return {
      target: item.target,
      strategy: "ios_xcassets",
      destinationPath,
      projectRelativePath: relativeToProject(projectRoot, destinationPath)
    };
  }
  const fallbackDir = path.join(projectRoot, "Resources", "UIFigmaGenerated");
  const destinationPath = path.join(fallbackDir, path.basename(item.outputPath));
  copyFile(item.outputPath, destinationPath);
  return {
    target: item.target,
    strategy: "ios_resources_fallback",
    destinationPath,
    projectRelativePath: relativeToProject(projectRoot, destinationPath)
  };
}

function syncToAndroid(projectRoot, item) {
  const resDir = findAndroidResDir(projectRoot) || path.join(projectRoot, "app", "src", "main", "res");
  const ext = path.extname(item.outputPath).toLowerCase();
  const subdir = ext === ".png" ? "drawable" : "raw";
  const destinationDir = path.join(resDir, subdir);
  const destinationName = `${sanitizeFileName(path.basename(item.outputPath, ext))}${ext}`;
  const destinationPath = path.join(destinationDir, destinationName);
  copyFile(item.outputPath, destinationPath);
  return {
    target: item.target,
    strategy: ext === ".png" ? "android_drawable" : "android_raw",
    destinationPath,
    projectRelativePath: relativeToProject(projectRoot, destinationPath)
  };
}

function syncToWeb(projectRoot, item) {
  const publicDir = findWebPublicDir(projectRoot);
  const baseDir = path.basename(publicDir) === "assets"
    ? path.join(publicDir, "ui-design-to-code", "figma")
    : path.join(publicDir, "ui-design-to-code", "figma");
  const folder = item.kind === "icon" ? "icons" : item.kind === "illustration" ? "illustrations" : "images";
  const destinationPath = path.join(baseDir, folder, path.basename(item.outputPath));
  copyFile(item.outputPath, destinationPath);
  return {
    target: item.target,
    strategy: path.basename(publicDir) === "assets" ? "web_src_assets" : "web_public",
    destinationPath,
    projectRelativePath: relativeToProject(projectRoot, destinationPath)
  };
}

function syncItem(projectRoot, item, fallbackTargets) {
  const targets = item.target === "shared" ? fallbackTargets : [item.target];
  const results = [];
  for (const target of targets) {
    const typedItem = { ...item, target };
    if (target.startsWith("ios-")) results.push(syncToIos(projectRoot, typedItem));
    else if (target.startsWith("android-")) results.push(syncToAndroid(projectRoot, typedItem));
    else if (target.startsWith("web-")) results.push(syncToWeb(projectRoot, typedItem));
  }
  return results;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const downloads = readJson(options.downloadsPath);
  const items = Array.isArray(downloads.items) ? downloads.items : [];
  const fallbackTargets = Array.isArray(options.targets) && options.targets.length > 0
    ? options.targets
    : ["web-react", "ios-uikit", "android-view"];
  const synced = [];
  for (const item of items) {
    synced.push(...syncItem(options.projectRoot, item, fallbackTargets));
  }
  const manifest = {
    artifactType: "target_asset_sync_manifest",
    generatedAt: new Date().toISOString(),
    projectRoot: options.projectRoot,
    sourceDownloadsPath: options.downloadsPath,
    count: synced.length,
    items: synced
  };
  const outPath = path.resolve(options.runRoot, options.out);
  writeJson(outPath, manifest);
  process.stdout.write(`${JSON.stringify({ outPath, count: synced.length, items: synced }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
