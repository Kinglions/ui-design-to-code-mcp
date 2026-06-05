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

The Codex installer writes a global user config and keeps runtime startup off
the network path. It installs the package under
`~/.codex/mcp-packages/ui-design-to-code-mcp`, points Codex at
`~/.codex/bin/serve-ui-design-to-code-mcp`, and creates a macOS LaunchAgent
that runs `~/.codex/bin/update-mcp-packages` once per day at 04:15. When the
install spec is `ui-design-to-code-mcp@latest`, the updater checks npm for a
new latest version and downloads it only when the version changes. Updated
code is used automatically the next time Codex starts or reloads this MCP
server.

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
command = "/Users/<user>/.codex/bin/serve-ui-design-to-code-mcp"
args = []
startup_timeout_sec = 30
```

Claude Code user-scope install can also use:

```bash
claude mcp add-json ui-design-to-code '{"type":"stdio","command":"npx","args":["-y","ui-design-to-code-mcp@latest","serve"]}' --scope user
```

## Triggers and Mode Selection

When an IDE/agent detects a UI screenshot, reference image, Figma design,
Figma MCP node dataset, or design-to-code task, route into this workflow. If
the user did not explicitly name an execution mode, ask for mode selection
before creating a run or artifacts.

Common trigger phrases:

```text
解析这图
分析参考图结构
解析图片结构
图转节点树
转代码
还原页面
复刻这个页面
走设计稿流程
生成页面
Figma to code
解析这个 Figma 节点
根据 Figma MCP 输出继续生成跨平台节点数据
implement this design
convert this screenshot
```

Required mode prompt:

```text
请选择执行模式：
1. decode-only：只解析设计源和节点树，不生成平台计划或代码。
2. plan-only：生成跨平台节点数据和转换计划，不生成布局 IR 或代码。
3. target-ir：生成目标平台布局 IR，不写代码。
4. codegen：在目标平台生成/修改代码，做常规项目验证和清理；不强制截图验收。
5. codegen-with-auto-review：先生成/修改代码，再自动启动浏览器/模拟器/仿真器截图对比；非素材 UI 还原度必须 >= 90% 才可交付。
6. runtime-review：启动已有实现，在浏览器/模拟器/仿真器中截图并和原图对比，不改代码。
```

For `target-ir`, `codegen`, `codegen-with-auto-review`, and `runtime-review`,
also ask for a target platform when missing:

```text
请选择目标平台：ios-uikit / ios-swiftui / web-react / web-next / android-compose / android-view
```

Figma flow:

1. Use Figma MCP first to fetch node JSON. If possible, also fetch the same
   frame screenshot.
2. Pass the Figma MCP output to `ingest_figma_source` as `nodeJson` or
   `nodeJsonPath`.
3. Pass the screenshot as `screenshotPath` to create a hybrid source.
4. Continue with the selected shared mode. Do not branch into a separate Figma
   downstream workflow.

Hybrid Figma input is preferred: Figma nodes provide structure, names,
components, text, styles, and layout metadata; screenshots provide pixel truth,
visual effects, and later auto-review baselines.

## Tools

- `get_run_modes`
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
