#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { apply: false, maxDebugBytes: null, maxReviewBytes: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--run") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail("missing value for --run");
      options.run = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg === "--max-debug-bytes") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 0) fail("invalid value for --max-debug-bytes");
      options.maxDebugBytes = value;
      index += 1;
      continue;
    }
    if (arg === "--max-review-bytes") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 0) fail("invalid value for --max-review-bytes");
      options.maxReviewBytes = value;
      index += 1;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!options.run) fail("--run is required");
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const runRoot = options.run;
  const manifestPath = path.join(runRoot, "artifact-run-manifest.json");

  if (!fs.existsSync(manifestPath)) {
    fail(`missing manifest: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  const declaredRoot = manifest.run && manifest.run.root ? manifest.run.root : runRoot;
  const manifestRoot = path.isAbsolute(declaredRoot)
    ? path.resolve(declaredRoot)
    : path.resolve(runRoot, declaredRoot);
  if (manifestRoot !== runRoot) {
    fail("manifest run.root must match --run");
  }

  const candidates = [];
  let totalBytes = 0;
  const categoryBytes = {};
  for (const artifact of manifest.artifacts || []) {
    const artifactPath = path.resolve(runRoot, artifact.path);
    if (!isInside(runRoot, artifactPath)) {
      fail(`refusing path outside run directory: ${artifact.path}`);
    }
    if (fs.existsSync(artifactPath) && fs.statSync(artifactPath).isFile()) {
      const sizeBytes = fs.statSync(artifactPath).size;
      artifact.sizeBytes = sizeBytes;
      totalBytes += sizeBytes;
      categoryBytes[artifact.category] = (categoryBytes[artifact.category] || 0) + sizeBytes;
    }
    if (artifact.cleanupStatus !== "cleanup_eligible") continue;
    candidates.push({ id: artifact.id, path: artifactPath });
  }

  console.log(`totalBytes: ${totalBytes}`);
  console.log(`categoryBytes: ${JSON.stringify(categoryBytes)}`);
  if (options.maxDebugBytes !== null && (categoryBytes.debug || 0) > options.maxDebugBytes) {
    console.log(`warning: debug artifacts exceed maxDebugBytes (${categoryBytes.debug} > ${options.maxDebugBytes})`);
  }
  if (options.maxReviewBytes !== null && (categoryBytes.review || 0) > options.maxReviewBytes) {
    console.log(`warning: review artifacts exceed maxReviewBytes (${categoryBytes.review} > ${options.maxReviewBytes})`);
  }
  console.log(`${options.apply ? "apply" : "dry-run"} cleanup candidates: ${candidates.length}`);
  for (const candidate of candidates) {
    const exists = fs.existsSync(candidate.path);
    console.log(`${exists ? "exists" : "missing"} ${candidate.id} ${candidate.path}`);
    if (options.apply && exists) {
      fs.rmSync(candidate.path, { recursive: true, force: true });
    }
  }
}

main();
