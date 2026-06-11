#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");

const DEFAULT_TOKEN_ENV_VARS = ["FIGMA_API_TOKEN", "FIGMA_ACCESS_TOKEN", "FIGMA_OAUTH_TOKEN"];

function fail(message) {
  throw new Error(message);
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, data) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, data);
}

function writeJson(filePath, data) {
  writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function sanitizeFileKey(value) {
  return String(value || "").trim();
}

function normalizeNodeId(nodeId) {
  return String(nodeId || "").trim().replace(/-/g, ":");
}

function parseFigmaUrl(url) {
  if (!url) return {};
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return {};
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  let fileKey = "";
  if ((segments[0] === "design" || segments[0] === "file") && segments[2] === "branch" && segments[3]) {
    fileKey = segments[3];
  } else if ((segments[0] === "design" || segments[0] === "file" || segments[0] === "proto" || segments[0] === "make" || segments[0] === "board" || segments[0] === "slides") && segments[1]) {
    fileKey = segments[1];
  }
  const nodeId = normalizeNodeId(parsed.searchParams.get("node-id") || "");
  return { fileKey, nodeId, url: String(url) };
}

function resolveApiToken(figma = {}, args = {}) {
  return resolveApiTokenInfo(figma, args).token;
}

function readCodexConfiguredToken(envName) {
  const configPath = path.join(os.homedir(), ".codex", "config.toml");
  if (!fs.existsSync(configPath)) return "";
  const text = fs.readFileSync(configPath, "utf8");
  const section = text.match(/\[mcp_servers\.ui_design_to_code\.env\]\n([\s\S]*?)(?=\n\[|$)/);
  if (!section) return "";
  const line = new RegExp(`^\\s*${envName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\n#]+))`, "m");
  const match = section[1].match(line);
  if (!match) return "";
  return String(match[2] || match[3] || match[4] || "").trim();
}

function resolveApiTokenInfo(figma = {}, args = {}) {
  if (args.apiToken) return { token: String(args.apiToken), source: "args.apiToken" };
  if (figma.apiToken) return { token: String(figma.apiToken), source: "figma.apiToken" };
  const explicitEnv = figma.tokenEnvVar || args.tokenEnvVar;
  if (explicitEnv && process.env[explicitEnv]) return { token: process.env[explicitEnv], source: `process.env.${explicitEnv}` };
  if (explicitEnv) {
    const configured = readCodexConfiguredToken(explicitEnv);
    if (configured) return { token: configured, source: `~/.codex/config.toml:${explicitEnv}` };
  }
  for (const envName of DEFAULT_TOKEN_ENV_VARS) {
    if (process.env[envName]) return { token: process.env[envName], source: `process.env.${envName}` };
  }
  for (const envName of DEFAULT_TOKEN_ENV_VARS) {
    const configured = readCodexConfiguredToken(envName);
    if (configured) return { token: configured, source: `~/.codex/config.toml:${envName}` };
  }
  return { token: "", source: "" };
}

function queryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function request(urlString, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error(`too many redirects for ${urlString}`));
      return;
    }
    const parsed = new URL(urlString);
    const transport = parsed.protocol === "http:" ? http : https;
    const req = transport.request(parsed, {
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: options.timeoutMs || 30000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirected = new URL(res.headers.location, parsed).toString();
        resolve(request(redirected, options, redirects + 1));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body
        });
      });
    });
    req.on("timeout", () => req.destroy(new Error(`request timeout for ${urlString}`)));
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function requestJson(urlString, options = {}) {
  const response = await request(urlString, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });
  const text = response.body.toString("utf8");
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    fail(`Figma API request failed ${response.statusCode}: ${text}`);
  }
  return parsed;
}

async function downloadToFile(urlString, outputPath) {
  const response = await request(urlString, { timeoutMs: 60000 });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    fail(`download failed ${response.statusCode}: ${urlString}`);
  }
  writeFile(outputPath, response.body);
  return {
    path: outputPath,
    bytes: response.body.length,
    contentType: response.headers["content-type"] || "application/octet-stream"
  };
}

async function fetchFigmaJson({ fileKey, nodeId, depth, version, apiToken, geometry }) {
  const params = {
    ids: normalizeNodeId(nodeId),
    depth: depth || undefined,
    version: version || undefined,
    geometry: geometry || undefined
  };
  return requestJson(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes${queryString(params)}`, {
    headers: { "X-Figma-Token": apiToken, "User-Agent": "ui-design-to-code-mcp" }
  });
}

async function fetchFigmaMeta({ fileKey, apiToken }) {
  return requestJson(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/meta`, {
    headers: { "X-Figma-Token": apiToken, "User-Agent": "ui-design-to-code-mcp" }
  });
}

async function fetchFigmaComments({ fileKey, apiToken }) {
  return requestJson(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/comments`, {
    headers: { "X-Figma-Token": apiToken, "User-Agent": "ui-design-to-code-mcp" }
  });
}

async function fetchImageFillMap({ fileKey, apiToken }) {
  return requestJson(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/images`, {
    headers: { "X-Figma-Token": apiToken, "User-Agent": "ui-design-to-code-mcp" }
  });
}

async function fetchRenderedImages({ fileKey, nodeIds, apiToken, format, scale, svgOutlineText, svgIncludeId, svgIncludeNodeId, contentsOnly, useAbsoluteBounds, version }) {
  const params = {
    ids: nodeIds.map(normalizeNodeId).join(","),
    format,
    scale: scale || undefined,
    svg_outline_text: svgOutlineText,
    svg_include_id: svgIncludeId,
    svg_include_node_id: svgIncludeNodeId,
    contents_only: contentsOnly,
    use_absolute_bounds: useAbsoluteBounds,
    version: version || undefined
  };
  return requestJson(`https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}${queryString(params)}`, {
    headers: { "X-Figma-Token": apiToken, "User-Agent": "ui-design-to-code-mcp" }
  });
}

module.exports = {
  DEFAULT_TOKEN_ENV_VARS,
  downloadToFile,
  fetchFigmaJson,
  fetchFigmaMeta,
  fetchFigmaComments,
  fetchImageFillMap,
  fetchRenderedImages,
  normalizeNodeId,
  parseFigmaUrl,
  requestJson,
  resolveApiToken,
  resolveApiTokenInfo,
  sanitizeFileKey,
  writeJson
};
