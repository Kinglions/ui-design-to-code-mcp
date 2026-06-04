#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    configuration: "Debug",
    destination: "generic/platform=iOS Simulator",
    bootedDevice: "booted",
    waitMs: 1500,
    skipBuild: false,
    skipInstall: false,
    skipLaunch: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--skip-build") {
      options.skipBuild = true;
      continue;
    }
    if (arg === "--skip-install") {
      options.skipInstall = true;
      continue;
    }
    if (arg === "--skip-launch") {
      options.skipLaunch = true;
      continue;
    }
    const valueArgs = [
      "--project",
      "--workspace",
      "--scheme",
      "--configuration",
      "--destination",
      "--derived-data",
      "--app",
      "--bundle-id",
      "--device",
      "--screenshot",
      "--result-json",
      "--wait-ms"
    ];
    if (valueArgs.includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`missing value for ${arg}`);
      if (arg === "--project") options.project = path.resolve(process.cwd(), value);
      if (arg === "--workspace") options.workspace = path.resolve(process.cwd(), value);
      if (arg === "--scheme") options.scheme = value;
      if (arg === "--configuration") options.configuration = value;
      if (arg === "--destination") options.destination = value;
      if (arg === "--derived-data") options.derivedData = path.resolve(process.cwd(), value);
      if (arg === "--app") options.app = path.resolve(process.cwd(), value);
      if (arg === "--bundle-id") options.bundleId = value;
      if (arg === "--device") options.bootedDevice = value;
      if (arg === "--screenshot") options.screenshot = path.resolve(process.cwd(), value);
      if (arg === "--result-json") options.resultJson = path.resolve(process.cwd(), value);
      if (arg === "--wait-ms") options.waitMs = Number(value);
      index += 1;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }

  if (!options.project && !options.workspace && !options.skipBuild) fail("--project or --workspace is required unless --skip-build is used");
  if (!options.scheme && !options.skipBuild) fail("--scheme is required unless --skip-build is used");
  if (!options.app && !options.skipInstall) fail("--app is required unless --skip-install is used");
  if (!options.bundleId && !options.skipLaunch) fail("--bundle-id is required unless --skip-launch is used");
  if (!options.screenshot) fail("--screenshot is required");
  if (!Number.isFinite(options.waitMs) || options.waitMs < 0) fail("--wait-ms must be non-negative");
  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });
  if (result.status !== 0) {
    const details = options.capture ? `${result.stdout || ""}${result.stderr || ""}`.trim() : "";
    fail(`${command} ${args.join(" ")} failed${details ? `\n${details}` : ""}`);
  }
  return result.stdout || "";
}

function sleep(ms) {
  if (ms > 0) execFileSync("sleep", [String(ms / 1000)]);
}

function writeResult(options, status, findings) {
  if (!options.resultJson) return;
  fs.mkdirSync(path.dirname(options.resultJson), { recursive: true });
  const result = {
    artifactType: "visual_review_result",
    sourceId: "runtime-ios",
    target: "ios-simulator",
    status,
    captures: [
      {
        id: "ios-simulator-content",
        path: options.screenshot,
        viewport: { device: options.bootedDevice },
        state: "content"
      }
    ],
    comparisons: [],
    findings
  };
  fs.writeFileSync(options.resultJson, `${JSON.stringify(result, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.skipBuild) {
    const args = [];
    if (options.workspace) args.push("-workspace", options.workspace);
    if (options.project) args.push("-project", options.project);
    args.push("-scheme", options.scheme);
    args.push("-configuration", options.configuration);
    args.push("-destination", options.destination);
    if (options.derivedData) args.push("-derivedDataPath", options.derivedData);
    args.push("build");
    run("xcodebuild", args);
  }

  run("xcrun", ["simctl", "bootstatus", options.bootedDevice, "-b"]);

  if (!options.skipInstall) {
    run("xcrun", ["simctl", "install", options.bootedDevice, options.app]);
  }

  if (!options.skipLaunch) {
    run("xcrun", ["simctl", "launch", options.bootedDevice, options.bundleId]);
  }

  sleep(options.waitMs);
  fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
  run("xcrun", ["simctl", "io", options.bootedDevice, "screenshot", options.screenshot]);
  writeResult(options, "partial", [{ severity: "info", message: "iOS simulator screenshot captured. Run screenshot diff separately." }]);
  console.log(`screenshot: ${options.screenshot}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
