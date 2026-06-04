#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    waitMs: 1500,
    bootTimeoutMs: 120000,
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
      "--project-dir",
      "--gradle",
      "--build-task",
      "--apk",
      "--package",
      "--activity",
      "--serial",
      "--avd",
      "--screenshot",
      "--result-json",
      "--wait-ms",
      "--boot-timeout-ms"
    ];
    if (valueArgs.includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`missing value for ${arg}`);
      if (arg === "--project-dir") options.projectDir = path.resolve(process.cwd(), value);
      if (arg === "--gradle") options.gradle = value;
      if (arg === "--build-task") options.buildTask = value;
      if (arg === "--apk") options.apk = path.resolve(process.cwd(), value);
      if (arg === "--package") options.packageName = value;
      if (arg === "--activity") options.activity = value;
      if (arg === "--serial") options.serial = value;
      if (arg === "--avd") options.avd = value;
      if (arg === "--screenshot") options.screenshot = path.resolve(process.cwd(), value);
      if (arg === "--result-json") options.resultJson = path.resolve(process.cwd(), value);
      if (arg === "--wait-ms") options.waitMs = Number(value);
      if (arg === "--boot-timeout-ms") options.bootTimeoutMs = Number(value);
      index += 1;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }

  if (!options.projectDir) options.projectDir = process.cwd();
  if (!options.gradle) options.gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  if (!options.buildTask) options.buildTask = "assembleDebug";
  if (!options.apk && !options.skipInstall) fail("--apk is required unless --skip-install is used");
  if ((!options.packageName || !options.activity) && !options.skipLaunch) fail("--package and --activity are required unless --skip-launch is used");
  if (!options.screenshot) fail("--screenshot is required");
  return options;
}

function adbArgs(options, args) {
  return options.serial ? ["-s", options.serial, ...args] : args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: options.binary ? undefined : "utf8",
    stdio: options.capture || options.binary ? "pipe" : "inherit"
  });
  if (result.status !== 0) {
    const details = options.capture && !options.binary ? `${result.stdout || ""}${result.stderr || ""}`.trim() : "";
    fail(`${command} ${args.join(" ")} failed${details ? `\n${details}` : ""}`);
  }
  return result.stdout;
}

function sleep(ms) {
  if (ms > 0) execFileSync("sleep", [String(ms / 1000)]);
}

function maybeStartEmulator(options) {
  if (!options.avd) return;
  const devices = run("adb", ["devices"], { capture: true }).toString();
  if (devices.includes("\tdevice")) return;
  const child = spawnSync("emulator", ["-avd", options.avd, "-no-snapshot-load"], {
    detached: true,
    stdio: "ignore"
  });
  if (child.error) fail(`failed to start emulator: ${child.error.message}`);
}

function waitForBoot(options) {
  run("adb", adbArgs(options, ["wait-for-device"]));
  const start = Date.now();
  while (Date.now() - start < options.bootTimeoutMs) {
    const value = run("adb", adbArgs(options, ["shell", "getprop", "sys.boot_completed"]), { capture: true }).toString().trim();
    if (value === "1") return;
    sleep(1000);
  }
  fail("Android emulator did not finish booting before timeout");
}

function writeResult(options, status, findings) {
  if (!options.resultJson) return;
  fs.mkdirSync(path.dirname(options.resultJson), { recursive: true });
  const result = {
    artifactType: "visual_review_result",
    sourceId: "runtime-android",
    target: "android-emulator",
    status,
    captures: [
      {
        id: "android-emulator-content",
        path: options.screenshot,
        viewport: { serial: options.serial || "default" },
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
    run(options.gradle, [options.buildTask], { cwd: options.projectDir });
  }

  maybeStartEmulator(options);
  waitForBoot(options);

  if (!options.skipInstall) {
    run("adb", adbArgs(options, ["install", "-r", options.apk]));
  }

  if (!options.skipLaunch) {
    run("adb", adbArgs(options, ["shell", "am", "start", "-n", `${options.packageName}/${options.activity}`]));
  }

  sleep(options.waitMs);
  fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
  const png = run("adb", adbArgs(options, ["exec-out", "screencap", "-p"]), { binary: true });
  fs.writeFileSync(options.screenshot, png);
  writeResult(options, "partial", [{ severity: "info", message: "Android emulator screenshot captured. Run screenshot diff separately." }]);
  console.log(`screenshot: ${options.screenshot}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
