#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
    fullPage: false,
    waitMs: 500
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mobile") {
      options.mobile = true;
      continue;
    }
    if (arg === "--full-page") {
      options.fullPage = true;
      continue;
    }
    const valueArgs = ["--url", "--out", "--selector", "--wait-for", "--width", "--height", "--device-scale-factor", "--wait-ms"];
    if (valueArgs.includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`missing value for ${arg}`);
      if (arg === "--url") options.url = value;
      if (arg === "--out") options.out = path.resolve(process.cwd(), value);
      if (arg === "--selector") options.selector = value;
      if (arg === "--wait-for") options.waitFor = value;
      if (arg === "--width") options.width = Number(value);
      if (arg === "--height") options.height = Number(value);
      if (arg === "--device-scale-factor") options.deviceScaleFactor = Number(value);
      if (arg === "--wait-ms") options.waitMs = Number(value);
      index += 1;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }

  if (!options.url) fail("--url is required");
  if (!options.out) fail("--out is required");
  if (!Number.isFinite(options.width) || options.width <= 0) fail("--width must be positive");
  if (!Number.isFinite(options.height) || options.height <= 0) fail("--height must be positive");
  if (!Number.isFinite(options.deviceScaleFactor) || options.deviceScaleFactor <= 0) fail("--device-scale-factor must be positive");
  if (!Number.isFinite(options.waitMs) || options.waitMs < 0) fail("--wait-ms must be non-negative");
  return options;
}

async function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    fail("Playwright is required for web screenshot capture. Install it in the target project or use an existing project Playwright setup.");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(path.dirname(options.out), { recursive: true });

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: options.width,
      height: options.height
    },
    deviceScaleFactor: options.deviceScaleFactor,
    isMobile: options.mobile
  });

  try {
    await page.goto(options.url, { waitUntil: "networkidle" });
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { state: "visible", timeout: 10000 });
    }
    if (options.waitMs > 0) {
      await page.waitForTimeout(options.waitMs);
    }

    if (options.selector) {
      const element = await page.$(options.selector);
      if (!element) fail(`selector not found: ${options.selector}`);
      await element.screenshot({ path: options.out });
    } else {
      await page.screenshot({ path: options.out, fullPage: options.fullPage });
    }
  } finally {
    await browser.close();
  }

  console.log(`screenshot: ${options.out}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
