#!/usr/bin/env node

const path = require("path");
const { spawnSync, spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const serverPath = path.join(root, "scripts", "ui_design_to_code_mcp_server.js");
const installerPath = path.join(root, "scripts", "install_mcp_client.js");

function usage() {
  console.log(`ui-design-to-code-mcp

Usage:
  ui-design-to-code-mcp serve
  ui-design-to-code-mcp install [--clients cursor,claude-code,codex] [--scope project|user] [--project-dir <dir>] [--package-spec <pkg>] [--dry-run]
  ui-design-to-code-mcp update [--clients cursor,claude-code,codex] [--channel latest|beta|next|stable]
  ui-design-to-code-mcp config [--client cursor|claude-code|codex] [--package-spec <pkg>]
  ui-design-to-code-mcp doctor
  ui-design-to-code-mcp version
`);
}

function doctor() {
  const server = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "pipe"] });
  function frame(message) {
    const payload = JSON.stringify(message);
    return `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;
  }
  let buffer = "";
  let done = false;
  const timeout = setTimeout(() => {
    if (!done) {
      server.kill();
      console.error("doctor failed: MCP server did not respond within 3s");
      process.exit(1);
    }
  }, 3000);

  server.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const match = buffer.slice(0, headerEnd).match(/Content-Length:\s*(\d+)/i);
      if (!match) return;
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const body = buffer.slice(start, start + length);
      buffer = buffer.slice(start + length);
      const response = JSON.parse(body);
      if (response.id === 2) {
        done = true;
        clearTimeout(timeout);
        const tools = response.result.tools || [];
        console.log(`doctor passed: ${tools.length} tools`);
        console.log(tools.map((tool) => tool.name).join(","));
        server.kill();
      }
    }
  });
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  server.stdin.write(frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
  server.stdin.write(frame({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
}

function main() {
  const command = process.argv[2] || "help";
  const rest = process.argv.slice(3);
  if (command === "serve") {
    require(serverPath);
    return;
  }
  if (command === "install" || command === "update" || command === "config") {
    const result = spawnSync(process.execPath, [installerPath, command, ...rest], { stdio: "inherit" });
    process.exit(result.status || 0);
  }
  if (command === "doctor") {
    doctor();
    return;
  }
  if (command === "version") {
    const pkg = require(path.join(root, "package.json"));
    console.log(pkg.version);
    return;
  }
  usage();
}

main();
