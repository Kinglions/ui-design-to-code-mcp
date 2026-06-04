#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const serverName = "ui-design-to-code";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    command: argv[0] || "install",
    clients: ["cursor", "claude-code", "codex"],
    scope: "project",
    projectDir: process.cwd(),
    packageSpec: `${pkg.name}@latest`,
    packageSpecExplicit: false,
    channel: "latest",
    dryRun: false
  };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--clients") {
      options.clients = String(next || "").split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === "--client") {
      options.clients = [String(next || "").trim()];
      index += 1;
      continue;
    }
    if (arg === "--scope") {
      options.scope = String(next || "project");
      index += 1;
      continue;
    }
    if (arg === "--project-dir") {
      options.projectDir = path.resolve(String(next || ""));
      index += 1;
      continue;
    }
    if (arg === "--package-spec") {
      options.packageSpec = String(next || options.packageSpec);
      options.packageSpecExplicit = true;
      index += 1;
      continue;
    }
    if (arg === "--channel") {
      options.channel = String(next || "latest");
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!["install", "update", "config"].includes(options.command)) fail(`unknown command: ${options.command}`);
  if (!["project", "user"].includes(options.scope)) fail("--scope must be project or user");
  if (!options.packageSpecExplicit) {
    const channel = options.channel === "stable" ? "latest" : options.channel;
    if (!["latest", "beta", "next"].includes(channel)) fail("--channel must be latest, stable, beta, or next");
    options.packageSpec = `${pkg.name}@${channel}`;
  }
  return options;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value, dryRun) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (dryRun) {
    console.log(`--- ${filePath}`);
    console.log(text);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
  console.log(`updated ${filePath}`);
}

function stdioConfig(packageSpec) {
  return {
    command: "npx",
    args: ["-y", packageSpec, "serve"]
  };
}

function jsonMcpConfig(packageSpec) {
  return {
    mcpServers: {
      [serverName]: stdioConfig(packageSpec)
    }
  };
}

function installJsonConfig(filePath, packageSpec, dryRun) {
  const config = readJson(filePath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers[serverName] = stdioConfig(packageSpec);
  writeJson(filePath, config, dryRun);
}

function tomlArray(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function codexBlock(packageSpec) {
  return [
    "[mcp_servers.ui_design_to_code]",
    "command = \"npx\"",
    `args = ${tomlArray(["-y", packageSpec, "serve"])}`,
    "startup_timeout_sec = 60",
    ""
  ].join("\n");
}

function installCodexConfig(filePath, packageSpec, dryRun) {
  const block = codexBlock(packageSpec);
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const section = /\n?\[mcp_servers\.ui_design_to_code\]\n(?:[^\n]*\n)*?(?=\n\[|$)/m;
  if (section.test(text)) text = text.replace(section, `\n${block}`);
  else text = `${text.trimEnd()}\n\n${block}`;
  if (dryRun) {
    console.log(`--- ${filePath}`);
    console.log(text);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
  console.log(`updated ${filePath}`);
}

function configPath(client, options) {
  const home = os.homedir();
  if (client === "cursor") {
    return options.scope === "user"
      ? path.join(home, ".cursor", "mcp.json")
      : path.join(options.projectDir, ".cursor", "mcp.json");
  }
  if (client === "claude-code") {
    if (options.scope === "user") {
      return null;
    }
    return path.join(options.projectDir, ".mcp.json");
  }
  if (client === "codex") {
    return path.join(home, ".codex", "config.toml");
  }
  fail(`unsupported client: ${client}`);
}

function printConfig(client, options) {
  if (client === "codex") {
    console.log(codexBlock(options.packageSpec));
    return;
  }
  console.log(JSON.stringify(jsonMcpConfig(options.packageSpec), null, 2));
}

function installClient(client, options) {
  const filePath = configPath(client, options);
  if (options.command === "config") {
    printConfig(client, options);
    return;
  }
  if (client === "claude-code" && options.scope === "user") {
    const config = JSON.stringify({ type: "stdio", ...stdioConfig(options.packageSpec) });
    console.log(`Run this Claude Code command for user-scope install:\nclaude mcp add-json ${serverName} '${config}' --scope user`);
    return;
  }
  if (client === "codex") installCodexConfig(filePath, options.packageSpec, options.dryRun);
  else installJsonConfig(filePath, options.packageSpec, options.dryRun);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const client of options.clients) installClient(client, options);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
