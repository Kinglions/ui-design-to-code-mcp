# UI Design to Code MCP

[中文文档](./README.zh-CN.md) | English

<!-- mcp-name: io.github.Kinglions/ui-design-to-code-mcp -->

MCP server for ingesting UI screenshots, Figma MCP node JSON, or hybrid
Figma-plus-screenshot sources into a cross-platform design-to-code artifact
pipeline.

The server standardizes source manifests, Figma source datasets, artifact run
directories, codegen result registration, visual-review delivery gates,
pipeline validation, and cleanup. Semantic IR and code generation remain
agent/model-driven steps that write the existing schemas and register outputs
through the MCP tools.

## Install

Quick install for all supported local clients:

```bash
npx -y ui-design-to-code-mcp@latest install \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir .
```

Quick uninstall for all supported local clients:

```bash
npx -y ui-design-to-code-mcp@latest uninstall \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir .
```

Cursor project install:

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client cursor \
  --scope project \
  --project-dir .
```

Cursor project uninstall:

```bash
npx -y ui-design-to-code-mcp@latest uninstall \
  --client cursor \
  --scope project \
  --project-dir .
```

Codex user install:

```bash
npx -y ui-design-to-code-mcp@latest install --client codex
```

Codex user uninstall:

```bash
npx -y ui-design-to-code-mcp@latest uninstall --client codex
```

Claude Code project install:

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client claude-code \
  --scope project \
  --project-dir .
```

Claude Code project uninstall:

```bash
npx -y ui-design-to-code-mcp@latest uninstall \
  --client claude-code \
  --scope project \
  --project-dir .
```

Claude Code user install:

```bash
claude mcp add-json ui-design-to-code '{"type":"stdio","command":"npx","args":["-y","ui-design-to-code-mcp@latest","serve"]}' --scope user
```

Claude Code user uninstall:

```bash
claude mcp remove ui-design-to-code --scope user
```

Dynamic update:

```bash
npx -y ui-design-to-code-mcp@latest update \
  --clients cursor,claude-code,codex \
  --channel latest
```

Beta channel rollout:

```bash
npx -y ui-design-to-code-mcp@latest update \
  --clients cursor,claude-code,codex \
  --channel beta
```

Pinned install:

```bash
npx -y ui-design-to-code-mcp@0.1.0 install \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir . \
  --package-spec ui-design-to-code-mcp@0.1.0
```

Run directly:

```bash
npx -y ui-design-to-code-mcp@latest serve
```

Health check:

```bash
npx -y ui-design-to-code-mcp@latest doctor
```

## Client Config

Cursor or Claude Code project config:

```json
{
  "mcpServers": {
    "ui-design-to-code": {
      "command": "npx",
      "args": ["-y", "ui-design-to-code-mcp@latest", "serve"]
    }
  }
}
```

Codex config:

```toml
[mcp_servers.ui_design_to_code]
command = "npx"
args = ["-y", "ui-design-to-code-mcp@latest", "serve"]
startup_timeout_sec = 60
```

Claude Code user-scope install can also use:

```bash
claude mcp add-json ui-design-to-code '{"type":"stdio","command":"npx","args":["-y","ui-design-to-code-mcp@latest","serve"]}' --scope user
```

## Tools

- `create_design_run`
- `ingest_image_source`
- `ingest_figma_source`
- `build_semantic_ir`
- `build_cross_platform_nodes`
- `build_target_ir`
- `run_codegen`
- `run_codegen_with_auto_review`
- `validate_pipeline`
- `cleanup_design_run`

## Publish

Run the release gate first:

```bash
npm run release:check
```

Recommended public npm release path:

1. Configure npm Trusted Publishing for this package:

   ```bash
   node bin/ui-design-to-code-mcp.js configure-npm-trusted-publishing --dry-run
   ```

   Then run the same command without `--dry-run`, or configure it in
   `npmjs.com -> Package -> Settings -> Trusted publishing`.

2. Run the GitHub Actions `Release` workflow from `main`.

The release workflow uses GitHub Actions OIDC (`id-token: write`) and `npm
publish`, so it does not need `NPM_TOKEN` and does not prompt for a local OTP.
npm automatically publishes provenance for Trusted Publishing releases.

Keep npm account 2FA enabled. Do not disable OTP to make local publish easier.
Interactive local `npm publish` remains a first-package or emergency fallback
only, and npm may require a one-time OTP for that fallback.

Official MCP Registry:

```bash
mcp-publisher login github-oidc
mcp-publisher publish
```

For public Registry publishing, `package.json#mcpName` must match
`server.json#name`, and the npm package must be published first. The GitHub
Actions release workflow uses OIDC, so no long-lived `MCP_REGISTRY_TOKEN` is
required.

Enterprise internal release:

```bash
npm publish --registry https://npm.your-company.internal
npx -y ui-design-to-code-mcp@latest install --clients cursor,claude-code,codex
```

Use `--package-spec ui-design-to-code-mcp@<version>` for pinned stable rollout,
or `@latest` for dynamic update on next MCP server restart.

For the full secure release and rollback policy, see [RELEASE.md](./RELEASE.md)
and [SECURITY.md](./SECURITY.md).
