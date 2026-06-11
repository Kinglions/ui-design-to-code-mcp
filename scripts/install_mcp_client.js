#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

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
  if (!["install", "update", "config", "uninstall"].includes(options.command)) fail(`unknown command: ${options.command}`);
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

function writeText(filePath, text, dryRun, mode) {
  if (dryRun) {
    console.log(`--- ${filePath}`);
    console.log(text);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
  if (mode) fs.chmodSync(filePath, mode);
  console.log(`updated ${filePath}`);
}

function run(command, args, dryRun, options = {}) {
  const printable = [command, ...args].join(" ");
  if (dryRun) {
    console.log(`run: ${printable}`);
    return { status: 0 };
  }
  const { allowFailure, ...spawnOptions } = options;
  const result = spawnSync(command, args, { stdio: "inherit", ...spawnOptions });
  if (result.status !== 0 && !allowFailure) {
    fail(`command failed: ${printable}`);
  }
  return result;
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

function uninstallJsonConfig(filePath, dryRun) {
  const config = readJson(filePath);
  if (config.mcpServers) delete config.mcpServers[serverName];
  writeJson(filePath, config, dryRun);
}

function tomlArray(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function codexBlock(packageSpec) {
  const home = os.homedir();
  const wrapperPath = path.join(home, ".codex", "bin", "serve-ui-design-to-code-mcp");
  return [
    "[mcp_servers.ui_design_to_code]",
    `command = ${JSON.stringify(wrapperPath)}`,
    "args = []",
    "startup_timeout_sec = 30",
    ""
  ].join("\n");
}

function codexPaths() {
  const home = os.homedir();
  const codexRoot = path.join(home, ".codex");
  const packageRoot = path.join(codexRoot, "mcp-packages", pkg.name);
  const binDir = path.join(codexRoot, "bin");
  const logDir = path.join(codexRoot, "logs");
  const launchAgentsDir = path.join(home, "Library", "LaunchAgents");
  const launchAgentLabel = "com.wuyb.codex.update-mcp-packages";
  return {
    home,
    codexRoot,
    packageRoot,
    binDir,
    logDir,
    updateScript: path.join(binDir, "update-mcp-packages"),
    serveScript: path.join(binDir, "serve-ui-design-to-code-mcp"),
    launchAgentLabel,
    launchAgentPath: path.join(launchAgentsDir, `${launchAgentLabel}.plist`)
  };
}

function sh(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function codexUpdateScript(paths, packageSpec) {
  const packageJsonPath = path.join(paths.packageRoot, "node_modules", pkg.name, "package.json");
  return `#!/usr/bin/env bash
set -euo pipefail

PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PACKAGE_NAME=${sh(pkg.name)}
PACKAGE_SPEC=${sh(packageSpec)}
PACKAGE_ROOT=${sh(paths.packageRoot)}
LOG_DIR=${sh(paths.logDir)}
LOG_FILE="\${LOG_DIR}/update-mcp-packages.log"
STATE_FILE="\${PACKAGE_ROOT}/.last-update-check"
LOCK_DIR="\${PACKAGE_ROOT}/.update-lock"
PACKAGE_JSON=${sh(packageJsonPath)}

mkdir -p "\${PACKAGE_ROOT}" "\${LOG_DIR}"

log() {
  printf '[%s] %s\\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$*" >> "\${LOG_FILE}"
}

if ! mkdir "\${LOCK_DIR}" 2>/dev/null; then
  log "skip: another update is already running"
  exit 0
fi
trap 'rmdir "\${LOCK_DIR}" 2>/dev/null || true' EXIT

force=false
if [[ "\${1:-}" == "--force" ]]; then
  force=true
fi

today="$(date '+%Y-%m-%d')"
if [[ "\${force}" != true && -f "\${STATE_FILE}" && "$(cat "\${STATE_FILE}")" == "\${today}" ]]; then
  log "skip: already checked today"
  exit 0
fi

current_version="missing"
if [[ -f "\${PACKAGE_JSON}" ]]; then
  current_version="$(node -e "console.log(require(process.argv[1]).version)" "\${PACKAGE_JSON}")"
fi

target_version="$(npm view "\${PACKAGE_SPEC}" version 2>> "\${LOG_FILE}")"
if [[ -z "\${target_version}" ]]; then
  log "error: npm returned empty target version for \${PACKAGE_SPEC}"
  exit 1
fi

if [[ "\${current_version}" != "\${target_version}" ]]; then
  log "update: \${PACKAGE_NAME} \${current_version} -> \${target_version}"
  npm install --prefix "\${PACKAGE_ROOT}" "\${PACKAGE_SPEC}" >> "\${LOG_FILE}" 2>&1
  installed_version="$(node -e "console.log(require(process.argv[1]).version)" "\${PACKAGE_JSON}")"
  log "updated: \${PACKAGE_NAME}@\${installed_version}"
else
  log "ok: \${PACKAGE_NAME}@\${current_version} is current for \${PACKAGE_SPEC}"
fi

printf '%s' "\${today}" > "\${STATE_FILE}"
`;
}

function codexServeScript(paths) {
  const binPath = path.join(paths.packageRoot, "node_modules", pkg.name, "bin", "ui-design-to-code-mcp.js");
  return `#!/usr/bin/env bash
set -euo pipefail

PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

BIN_PATH=${sh(binPath)}
UPDATE_SCRIPT=${sh(paths.updateScript)}

if [[ ! -f "\${BIN_PATH}" ]]; then
  "\${UPDATE_SCRIPT}" --force
fi

exec node "\${BIN_PATH}" serve
`;
}

function codexLaunchAgent(paths) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${paths.launchAgentLabel}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${paths.updateScript}</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>4</integer>
    <key>Minute</key>
    <integer>15</integer>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${path.join(paths.logDir, "update-mcp-packages.launchd.out.log")}</string>

  <key>StandardErrorPath</key>
  <string>${path.join(paths.logDir, "update-mcp-packages.launchd.err.log")}</string>
</dict>
</plist>
`;
}

function installCodexAssets(packageSpec, dryRun) {
  const paths = codexPaths();
  run("npm", ["install", "--prefix", paths.packageRoot, packageSpec], dryRun);
  writeText(paths.updateScript, codexUpdateScript(paths, packageSpec), dryRun, 0o755);
  writeText(paths.serveScript, codexServeScript(paths), dryRun, 0o755);

  if (process.platform === "darwin") {
    writeText(paths.launchAgentPath, codexLaunchAgent(paths), dryRun, 0o644);
    const uid = String(process.getuid ? process.getuid() : "");
    if (uid) {
      run("launchctl", ["bootout", `gui/${uid}`, paths.launchAgentPath], dryRun, { allowFailure: true });
      run("launchctl", ["bootstrap", `gui/${uid}`, paths.launchAgentPath], dryRun, { allowFailure: true });
    }
  } else {
    console.log("skipped LaunchAgent install: daily auto-update currently supports macOS launchd only");
  }
}

function uninstallCodexAssets(dryRun) {
  const paths = codexPaths();
  const uid = String(process.getuid ? process.getuid() : "");
  if (process.platform === "darwin" && uid) {
    run("launchctl", ["bootout", `gui/${uid}`, paths.launchAgentPath], dryRun, { allowFailure: true });
  }
  for (const filePath of [paths.updateScript, paths.serveScript, paths.launchAgentPath]) {
    if (dryRun) {
      console.log(`remove: ${filePath}`);
      continue;
    }
    fs.rmSync(filePath, { force: true });
  }
  if (dryRun) console.log(`remove: ${paths.packageRoot}`);
  else fs.rmSync(paths.packageRoot, { recursive: true, force: true });
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

function uninstallCodexConfig(filePath, dryRun) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const section = /\n?\[mcp_servers\.ui_design_to_code\]\n(?:[^\n]*\n)*?(?=\n\[|$)/m;
  text = text.replace(section, "\n").trimEnd();
  if (dryRun) {
    console.log(`--- ${filePath}`);
    console.log(text ? `${text}\n` : "");
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text ? `${text}\n` : "");
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
  if (options.command === "uninstall") {
    if (client === "claude-code" && options.scope === "user") {
      console.log(`Run this Claude Code command for user-scope uninstall:\nclaude mcp remove ${serverName} --scope user`);
      return;
    }
    if (client === "codex") {
      uninstallCodexConfig(filePath, options.dryRun);
      uninstallCodexAssets(options.dryRun);
    } else uninstallJsonConfig(filePath, options.dryRun);
    return;
  }
  if (client === "claude-code" && options.scope === "user") {
    const config = JSON.stringify({ type: "stdio", ...stdioConfig(options.packageSpec) });
    console.log(`Run this Claude Code command for user-scope install:\nclaude mcp add-json ${serverName} '${config}' --scope user`);
    return;
  }
  if (client === "codex") {
    installCodexAssets(options.packageSpec, options.dryRun);
    installCodexConfig(filePath, options.packageSpec, options.dryRun);
  } else installJsonConfig(filePath, options.packageSpec, options.dryRun);
  if (options.command === "install") {
    console.log(`next step: configure Figma token with`);
    if (client === "codex") {
      console.log(`  ui-design-to-code-mcp setup-figma-token`);
    } else if (client === "cursor") {
      console.log(`  printf %s '<YOUR_FIGMA_TOKEN>' | ui-design-to-code-mcp configure-figma-token --client cursor --scope ${options.scope} --project-dir ${JSON.stringify(options.projectDir)} --stdin`);
    } else if (client === "claude-code") {
      console.log(`  printf %s '<YOUR_FIGMA_TOKEN>' | ui-design-to-code-mcp configure-figma-token --client claude-code --scope ${options.scope} --project-dir ${JSON.stringify(options.projectDir)} --stdin`);
    }
  }
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
