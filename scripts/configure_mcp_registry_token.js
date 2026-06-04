#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    repo: "Kinglions/ui-design-to-code-mcp",
    secretName: "MCP_REGISTRY_TOKEN",
    token: process.env.MCP_REGISTRY_TOKEN || "",
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--repo") {
      options.repo = String(next || "");
      index += 1;
      continue;
    }
    if (arg === "--secret-name") {
      options.secretName = String(next || "");
      index += 1;
      continue;
    }
    if (arg === "--token") {
      options.token = String(next || "");
      index += 1;
      continue;
    }
    if (arg === "--stdin") {
      options.token = fs.readFileSync(0, "utf8").trim();
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!options.repo) fail("--repo is required");
  if (!options.secretName) fail("--secret-name is required");
  if (!options.token && !options.dryRun) {
    fail("MCP Registry token is required. Pass --token, --stdin, or MCP_REGISTRY_TOKEN.");
  }
  return options;
}

function ensureGhAvailable() {
  const result = spawnSync("gh", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) fail("GitHub CLI `gh` is required. Install it and run `gh auth login`.");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) {
    console.log(`Would set GitHub Actions secret ${options.secretName} on ${options.repo}.`);
    return;
  }
  ensureGhAvailable();
  const result = spawnSync("gh", ["secret", "set", options.secretName, "--repo", options.repo, "--body", options.token], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) fail(result.stderr || result.stdout || "gh secret set failed");
  console.log(`configured GitHub Actions secret ${options.secretName} on ${options.repo}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
