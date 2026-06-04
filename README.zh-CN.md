# UI Design to Code MCP

中文 | [English](./README.md)

<!-- mcp-name: io.github.Kinglions/ui-design-to-code-mcp -->

`ui-design-to-code-mcp` 是一个可发布的 MCP server，用于把 UI 截图、Figma MCP 节点 JSON，或 Figma 节点加截图的混合输入，统一接入跨平台 design-to-code 产物流程。

它负责标准化设计源输入、Figma 数据集、运行目录、产物登记、codegen 结果记录、自动视觉验收门禁、pipeline 校验和产物清理。Semantic IR 生成和平台代码生成仍由调用方 agent/model 执行，并通过 MCP 工具登记到同一套产物结构中。

## 安装

动态安装最新版：

```bash
npx -y ui-design-to-code-mcp@latest install \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir .
```

动态更新：

```bash
npx -y ui-design-to-code-mcp@latest update \
  --clients cursor,claude-code,codex \
  --channel latest
```

Beta 灰度：

```bash
npx -y ui-design-to-code-mcp@latest update \
  --clients cursor,claude-code,codex \
  --channel beta
```

固定版本安装：

```bash
npx -y ui-design-to-code-mcp@0.1.0 install \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir . \
  --package-spec ui-design-to-code-mcp@0.1.0
```

直接启动 MCP server：

```bash
npx -y ui-design-to-code-mcp@latest serve
```

健康检查：

```bash
npx -y ui-design-to-code-mcp@latest doctor
```

## 客户端配置

Cursor 或 Claude Code 项目级配置：

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

Codex 配置：

```toml
[mcp_servers.ui_design_to_code]
command = "npx"
args = ["-y", "ui-design-to-code-mcp@latest", "serve"]
startup_timeout_sec = 60
```

Claude Code 用户级安装也可以使用：

```bash
claude mcp add-json ui-design-to-code '{"type":"stdio","command":"npx","args":["-y","ui-design-to-code-mcp@latest","serve"]}' --scope user
```

## MCP 工具

- `create_design_run`：创建设计转换运行目录和 manifest。
- `ingest_image_source`：接入截图或图片输入。
- `ingest_figma_source`：接入 Figma MCP 节点 JSON、Figma 截图或混合输入。
- `build_semantic_ir`：登记 Semantic UI IR，或返回需要生成该产物的 schema/prompt contract。
- `build_cross_platform_nodes`：登记 Cross-platform Node Data。
- `build_target_ir`：登记目标平台 Layout IR。
- `run_codegen`：记录普通 codegen 的改动文件和项目验证结果。
- `run_codegen_with_auto_review`：记录带自动视觉验收的 codegen 结果，并执行非素材区域相似度 `>= 0.9` 的交付门禁。
- `validate_pipeline`：运行跨产物 pipeline 校验。
- `cleanup_design_run`：运行产物清理，默认 dry-run。

## 支持的输入

- 图片或截图。
- Figma MCP 节点 JSON。
- Figma 节点 JSON + Figma 截图的混合输入。

混合输入优先级最高：Figma 节点提供结构、命名、组件、文本、样式和布局信息；截图提供像素级视觉基准，用于后续自动视觉验收。

## 发布

先运行发布门禁：

```bash
npm run release:check
```

发布到公共 npm：

```bash
npm version patch
npm publish --access public
```

发布到官方 MCP Registry：

```bash
mcp-publisher login github-oidc
mcp-publisher publish
```

发布到官方 MCP Registry 前，需要先发布 npm 包，并确保 `package.json#mcpName` 与 `server.json#name` 完全一致。
GitHub Actions 发布流程使用 OIDC，不需要长期保存 `MCP_REGISTRY_TOKEN`。

企业内部发布：

```bash
npm publish --registry https://npm.your-company.internal
npx -y ui-design-to-code-mcp@latest install --clients cursor,claude-code,codex
```

内部稳定环境建议使用：

```bash
--package-spec ui-design-to-code-mcp@<version>
```

需要动态更新时使用：

```bash
--channel latest
```

需要灰度时使用：

```bash
--channel beta
```

## 仓库

GitHub:

```text
https://github.com/Kinglions/ui-design-to-code-mcp.git
```

完整安全发布、灰度和回滚策略见 [RELEASE.md](./RELEASE.md) 与
[SECURITY.md](./SECURITY.md)。
