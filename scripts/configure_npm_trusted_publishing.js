#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const args = {
    repo: "Kinglions/ui-design-to-code-mcp",
    workflow: "release.yml",
    environment: "npm-publish",
    dryRun: false,
    yes: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo" || arg === "--repository") args.repo = argv[++index];
    else if (arg === "--workflow" || arg === "--file") args.workflow = argv[++index];
    else if (arg === "--environment" || arg === "--env") args.environment = argv[++index];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--yes" || arg === "-y") args.yes = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  console.log(`Configure npm Trusted Publishing for this package.

Usage:
  ui-design-to-code-mcp configure-npm-trusted-publishing [--repo owner/name] [--workflow release.yml] [--environment npm-publish] [--dry-run] [--yes]

Notes:
  - Requires npm >= 11.10.0.
  - Requires 2FA enabled on the npm account.
  - The package must already exist on npm before npm trust can configure it.
  - This command does not create or store NPM_TOKEN.
`);
}

function parseVersion(version) {
  return String(version).trim().split(".").map((part) => Number(part) || 0);
}

function isAtLeast(version, minimum) {
  const current = parseVersion(version);
  const required = parseVersion(minimum);
  for (let index = 0; index < required.length; index += 1) {
    if ((current[index] || 0) > required[index]) return true;
    if ((current[index] || 0) < required[index]) return false;
  }
  return true;
}

function checkNpmVersion() {
  const result = spawnSync("npm", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("npm is required to configure Trusted Publishing.");
  }
  const version = result.stdout.trim();
  if (!isAtLeast(version, "11.10.0")) {
    throw new Error(`npm ${version} does not support npm trust. Install npm >= 11.10.0 first:

  npm install -g npm@^11.10.0

Then rerun this command.`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  process.chdir(path.resolve(__dirname, ".."));
  checkNpmVersion();
  const pkg = readJson("package.json");
  const command = [
    "trust",
    "github",
    pkg.name,
    "--repo",
    args.repo,
    "--file",
    args.workflow,
    "--environment",
    args.environment,
    "--allow-publish"
  ];
  if (args.yes) command.push("--yes");
  if (args.dryRun) command.push("--dry-run");

  console.log(`npm ${command.join(" ")}`);
  const result = spawnSync("npm", command, { stdio: "inherit" });
  process.exit(result.status || 0);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
