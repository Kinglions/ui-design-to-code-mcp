#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    client: "codex",
    scope: "project",
    projectDir: process.cwd(),
    envVar: "FIGMA_API_TOKEN",
    dryRun: false,
    stdin: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--client") {
      options.client = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--scope") {
      options.scope = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--project-dir") {
      options.projectDir = path.resolve(String(next || ""));
      index += 1;
      continue;
    }
    if (arg === "--env-var") {
      options.envVar = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--token") {
      options.token = String(next || "");
      index += 1;
      continue;
    }
    if (arg === "--stdin") {
      options.stdin = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!["codex", "cursor", "claude-code"].includes(options.client)) fail("--client must be codex, cursor, or claude-code");
  if (!["project", "user"].includes(options.scope)) fail("--scope must be project or user");
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

function writeText(filePath, text, dryRun) {
  if (dryRun) {
    console.log(`--- ${filePath}`);
    console.log(text);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
  console.log(`updated ${filePath}`);
}

function configPath(client, scope, projectDir) {
  const home = os.homedir();
  if (client === "codex") return path.join(home, ".codex", "config.toml");
  if (client === "cursor") {
    return scope === "user"
      ? path.join(home, ".cursor", "mcp.json")
      : path.join(projectDir, ".cursor", "mcp.json");
  }
  if (client === "claude-code") {
    if (scope === "user") return path.join(home, ".claude", "mcp.json");
    return path.join(projectDir, ".mcp.json");
  }
  fail(`unsupported client: ${client}`);
}

function setJsonEnv(filePath, envVar, token, serverName, dryRun) {
  const config = readJson(filePath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers[serverName] = config.mcpServers[serverName] || {};
  config.mcpServers[serverName].env = config.mcpServers[serverName].env || {};
  config.mcpServers[serverName].env[envVar] = dryRun ? "<redacted>" : token;
  writeJson(filePath, config, dryRun);
}

function setTomlEnv(filePath, envVar, token, dryRun) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const serverSectionPattern = /\n?\[mcp_servers\.ui_design_to_code\]\n(?:[^\n]*\n)*?(?=\n\[|$)/m;
  if (!serverSectionPattern.test(text)) {
    text = `${text.trimEnd()}\n\n[mcp_servers.ui_design_to_code]\ncommand = "/Users/<user>/.codex/bin/serve-ui-design-to-code-mcp"\nargs = []\nstartup_timeout_sec = 30\n`;
  }
  const envSectionPattern = /\n?\[mcp_servers\.ui_design_to_code\.env\]\n(?:[^\n]*\n)*?(?=\n\[|$)/m;
  const outputToken = dryRun ? "<redacted>" : token;
  const envLine = `${envVar} = ${JSON.stringify(outputToken)}\n`;
  if (envSectionPattern.test(text)) {
    let block = text.match(envSectionPattern)[0];
    const linePattern = new RegExp(`^${envVar}\\s*=.*$`, "m");
    block = linePattern.test(block) ? block.replace(linePattern, `${envVar} = ${JSON.stringify(outputToken)}`) : `${block}${envLine}`;
    text = text.replace(envSectionPattern, block);
  } else {
    text = `${text.trimEnd()}\n\n[mcp_servers.ui_design_to_code.env]\n${envLine}`;
  }
  writeText(filePath, text.trimEnd() + "\n", dryRun);
}

function readTokenFromStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.on("error", reject);
  });
}

function promptForToken() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true
    });
    rl.stdoutMuted = true;
    rl._writeToOutput = function writeToOutput(value) {
      if (rl.stdoutMuted) {
        rl.output.write(value.replace(/[^\r\n]/g, "*"));
      } else {
        rl.output.write(value);
      }
    };
    rl.question("Paste Figma token for ui_design_to_code MCP: ", (answer) => {
      rl.close();
      process.stderr.write("\n");
      resolve(String(answer || "").trim());
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let token = options.stdin ? await readTokenFromStdin() : options.token;
  if (!token && process.stdin.isTTY) token = await promptForToken();
  if (!token) {
    fail([
      "missing token: pass --token <value>, pipe with --stdin, or run interactively.",
      "One-command Codex setup:",
      "  ui-design-to-code-mcp setup-figma-token"
    ].join("\n"));
  }
  const filePath = configPath(options.client, options.scope, options.projectDir);
  if (options.client === "codex") {
    setTomlEnv(filePath, options.envVar, token, options.dryRun);
  } else {
    setJsonEnv(filePath, options.envVar, token, "ui-design-to-code", options.dryRun);
  }
  console.log(`configured ${options.envVar} for ${options.client}${options.scope ? ` (${options.scope})` : ""}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
