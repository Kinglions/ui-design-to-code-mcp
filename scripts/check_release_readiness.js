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
  if (!server.description || server.description.length > 100) {
    fail(`server.json#description must be 100 characters or fewer: ${server.description ? server.description.length : 0}`);
  }
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

function checkCodexPluginMarketplace() {
  const pkg = readJson("package.json");
  const marketplace = readJson(".agents/plugins/marketplace.json");
  const plugin = readJson("plugins/ui-design-to-code/.codex-plugin/plugin.json");
  const mcp = readJson("plugins/ui-design-to-code/.mcp.json");
  if (marketplace.name !== "ui-design-to-code") fail("Codex marketplace name must be ui-design-to-code");
  const entry = (marketplace.plugins || []).find((item) => item.name === "ui-design-to-code");
  if (!entry) fail("Codex marketplace must include ui-design-to-code plugin");
  if (!entry.source || entry.source.path !== "./plugins/ui-design-to-code") {
    fail("Codex marketplace entry must point to ./plugins/ui-design-to-code");
  }
  if (!entry.policy || entry.policy.installation !== "AVAILABLE" || entry.policy.authentication !== "ON_INSTALL") {
    fail("Codex marketplace entry must be available with ON_INSTALL authentication policy");
  }
  if (plugin.name !== "ui-design-to-code") fail("Codex plugin name must be ui-design-to-code");
  if (plugin.version !== pkg.version) fail("Codex plugin version must match package version");
  if (plugin.mcpServers !== "./.mcp.json") fail("Codex plugin must reference ./.mcp.json");
  const server = mcp.mcpServers && mcp.mcpServers.ui_design_to_code;
  if (!server) fail("Codex plugin .mcp.json must register ui_design_to_code");
  if (server.command !== "npx") fail("Codex plugin MCP command must use npx");
  const expectedArgs = ["-y", `${pkg.name}@latest`, "serve"];
  if (JSON.stringify(server.args) !== JSON.stringify(expectedArgs)) {
    fail(`Codex plugin MCP args must be ${JSON.stringify(expectedArgs)}`);
  }
}

function checkPackageFiles() {
  const pkg = readJson("package.json");
  const requiredFiles = [
    "README.md",
    "README.zh-CN.md",
    "LICENSE",
    "server.json",
    ".agents/plugins/marketplace.json",
    "plugins/ui-design-to-code/.codex-plugin/plugin.json",
    "plugins/ui-design-to-code/.mcp.json",
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
  checkCodexPluginMarketplace();
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
