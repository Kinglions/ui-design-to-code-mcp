#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) fail(`missing required file: ${filePath}`);
}

function checkSkillDescription() {
  const skill = read("SKILL.md");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) fail("SKILL.md missing frontmatter");
  const description = frontmatter[1].match(/^description:\s*(.*)$/m);
  if (!description) fail("SKILL.md missing description");
  if (description[1].length > 1024) {
    fail(`SKILL.md description exceeds 1024 characters: ${description[1].length}`);
  }
}

function checkPackageMetadata() {
  const pkg = readJson("package.json");
  const server = readJson("server.json");
  if (pkg.mcpName !== server.name) fail("package.json#mcpName must match server.json#name");
  if (pkg.version !== server.version) fail("package.json#version must match server.json#version");
  if (!server.packages || !server.packages[0]) fail("server.json missing packages[0]");
  if (server.packages[0].identifier !== pkg.name) fail("server package identifier must match package name");
  if (server.packages[0].version !== pkg.version) fail("server package version must match package version");
  if (!pkg.repository || !String(pkg.repository.url).includes("Kinglions/ui-design-to-code-mcp")) {
    fail("package repository must point to Kinglions/ui-design-to-code-mcp");
  }
  if (!server.repository || !String(server.repository.url).includes("Kinglions/ui-design-to-code-mcp")) {
    fail("server repository must point to Kinglions/ui-design-to-code-mcp");
  }
}

function checkPackageFiles() {
  const pkg = readJson("package.json");
  const requiredFiles = [
    "README.md",
    "README.zh-CN.md",
    "LICENSE",
    "server.json",
    "bin/ui-design-to-code-mcp.js",
    "scripts/ui_design_to_code_mcp_server.js",
    "references/design-source-manifest.schema.json",
    "references/figma-source-dataset.schema.json"
  ];
  for (const filePath of requiredFiles) assertFile(filePath);
  for (const filePath of ["README.md", "README.zh-CN.md"]) {
    if (!(pkg.files || []).includes(filePath)) fail(`package files must include ${filePath}`);
  }
}

function checkLifecycleScripts() {
  const pkg = readJson("package.json");
  const scripts = pkg.scripts || {};
  const blocked = [
    "preinstall",
    "install",
    "postinstall",
    "prepare",
    "prepack",
    "postpack"
  ];
  for (const name of blocked) {
    if (scripts[name]) fail(`disallowed npm lifecycle script: ${name}`);
  }
}

function checkTrustedPublishingWorkflow() {
  const workflowPath = ".github/workflows/release.yml";
  assertFile(workflowPath);
  const workflow = read(workflowPath);
  if (!workflow.includes("id-token: write")) {
    fail("release workflow must grant id-token: write for OIDC publishing");
  }
  if (!workflow.includes("environment: npm-publish")) {
    fail("release workflow must use the npm-publish GitHub Environment");
  }
  if (!workflow.includes("node-version: 22.14.0")) {
    fail("release workflow must use Node 22.14.0 or newer for npm Trusted Publishing");
  }
  if (!workflow.includes("npm install -g npm@^11.10.0")) {
    fail("release workflow must install npm 11.10.0 or newer for Trusted Publishing");
  }
  if (workflow.includes("package-manager-cache")) {
    fail("release workflow must not use unsupported setup-node input: package-manager-cache");
  }
  if (workflow.includes("NPM_TOKEN") || workflow.includes("NODE_AUTH_TOKEN")) {
    fail("release workflow must not use long-lived npm token secrets for publishing");
  }
  if (workflow.includes("MCP_REGISTRY_TOKEN")) {
    fail("release workflow must not use long-lived MCP Registry token secrets");
  }
  if (!workflow.includes("npm publish --access public")) {
    fail("release workflow must publish the public npm package");
  }
  if (!workflow.includes("mcp-publisher login github-oidc")) {
    fail("release workflow must authenticate MCP Registry publishing with github-oidc");
  }
}

function main() {
  process.chdir(path.resolve(__dirname, ".."));
  checkSkillDescription();
  checkPackageMetadata();
  checkPackageFiles();
  checkLifecycleScripts();
  checkTrustedPublishingWorkflow();
  console.log("release readiness passed");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
