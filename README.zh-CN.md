# UI Design to Code MCP

中文 | [English](./README.md)

<!-- mcp-name: io.github.Kinglions/ui-design-to-code-mcp -->

`ui-design-to-code-mcp` 是一个用于 UI design-to-code 流程的 MCP server。它可以把 UI 截图、Figma MCP 节点 JSON，或 Figma 节点 + 截图的混合输入，接入一套结构化、可追踪、可校验的产物流水线。

它**不替代真正写代码的 agent/model**。它的职责是标准化运行目录、输入清单、Figma 数据集、中间 IR 合约、目标平台布局产物、代码生成记录、精确切图产物、视觉验收门禁、产物校验和清理流程。

## 核心亮点

- 支持 **Codex**、**Cursor**、**Claude Code**。
- 创建隔离的标准运行目录：`generated/ui-design-to-code/<run-id>` 或 `/private/tmp/ui-design-to-code/<run-id>`。
- 统一接入截图、图片、Figma 节点 JSON、Figma + 截图混合输入。
- 覆盖完整流程：decode、planning、target IR、codegen、自动视觉验收、runtime review、validate、cleanup。
- 提供 Semantic UI IR、Cross-platform Node Data、Target Layout IR、视觉验收、产物生命周期等 schema 合约。
- 支持基于 `source_bbox` 的源图精确 bitmap/icon 切图。
- Codex 安装后使用本地稳定 serve 命令，避免每次 MCP 启动都执行 `npx @latest`。

## 快速开始

### 安装到 Codex

```bash
npx -y ui-design-to-code-mcp@latest install --client codex
```

### 安装到 Cursor 项目级配置

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client cursor \
  --scope project \
  --project-dir .
```

### 一次安装到所有支持的本地客户端

```bash
npx -y ui-design-to-code-mcp@latest install \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir .
```

### 检查或直接启动服务

```bash
npx -y ui-design-to-code-mcp@latest doctor
npx -y ui-design-to-code-mcp@latest serve
```

## 推荐执行流程

1. 用户没有指定模式时，先调用 `get_run_modes` 选择执行模式。
2. 调用 `create_design_run` 创建独立产物运行目录。
3. 使用 `ingest_image_source` 或 `ingest_figma_source` 登记源输入。
4. 对截图/图片输入，先生成并用 `build_reference_analysis` 登记 Reference Image Analysis。
5. 生成并登记 Semantic UI IR、Cross-platform Node Data、Target Layout IR。
6. 当已有 Vision/Compression/Semantic 产物后，调用 `audit_image_decoding` 审计图片解析质量。
7. 在宿主项目中生成或修改目标代码。
8. 使用 `run_codegen` 或 `run_codegen_with_auto_review` 记录结果。
9. 调用 `validate_pipeline` 校验完整产物链路。
10. 需要时使用 `cleanup_design_run` 清理生成产物。

## 执行模式

| 模式 | 是否需要 target | 主要用途 |
| --- | --- | --- |
| `decode-only` | 否 | 只采集源输入、vision/compression/semantic 产物，不生成平台计划或代码。 |
| `plan-only` | 否 | 生成跨平台节点数据和转换计划，不生成目标布局或代码。 |
| `target-ir` | 是 | 登记目标平台布局 IR，不修改代码。 |
| `codegen` | 是 | 生成或修改实现代码，并记录常规验证结果。 |
| `codegen-with-auto-review` | 是 | 记录代码生成、视觉验收依据，并执行相似度门禁。 |
| `runtime-review` | 是 | 对已有运行时实现进行截图验收，不修改代码。 |

目标平台示例：

```text
ios-uikit / ios-swiftui / web-react / web-next / android-compose / android-view
```

## 输入源选择

| 输入类型 | 适用场景 | 推荐工具 |
| --- | --- | --- |
| 截图或图片 | 设计源是渲染后的图像。 | `ingest_image_source` |
| Figma MCP 节点 JSON | 需要结构、命名、文本、组件、样式和布局元数据。 | `ingest_figma_source` |
| Figma 节点 JSON + 截图 | 同时需要结构化信息和像素级视觉基准。 | `ingest_figma_source` |

能同时拿到 Figma 节点和截图时，优先使用混合输入：Figma 节点提供结构化信息，截图提供像素级视觉基准，便于后续视觉复核。

## 产物运行目录

所有流程都从 `create_design_run` 开始。它会创建独立 `runRoot` 和 `artifact-run-manifest.json`。

项目内默认目录：

```text
generated/ui-design-to-code/<timestamp>-<slug>/
  artifact-run-manifest.json
  source/
  figma/
  analysis/
  vision/
  compression/
  semantic/
  cross-platform/
  targets/
  assets/
  qa/
  review/
```

临时运行目录：

```text
/private/tmp/ui-design-to-code/<timestamp>-<slug>/
```

## 客户端安装

### Codex

Codex 安装器会写入用户级 MCP 配置，并让运行时启动路径脱离网络依赖。

Codex plugin marketplace 安装：

```bash
codex plugin marketplace add Kinglions/ui-design-to-code-mcp --ref main
codex plugin list --marketplace ui-design-to-code
codex plugin add ui-design-to-code@ui-design-to-code
```

安装后检查 MCP server：

```bash
codex mcp list
```

该插件会把 `ui_design_to_code` 注册为：

```bash
npx -y ui-design-to-code-mcp@latest serve
```

仍然可以使用 npm 方式直接安装 MCP：

```bash
npx -y ui-design-to-code-mcp@latest install --client codex
```

安装包路径：

```text
~/.codex/mcp-packages/ui-design-to-code-mcp
```

Codex serve 命令：

```text
~/.codex/bin/serve-ui-design-to-code-mcp
```

macOS 每日更新任务：

```text
~/Library/LaunchAgents/com.wuyb.codex.update-mcp-packages.plist
```

更新命令：

```text
~/.codex/bin/update-mcp-packages
```

当安装规格是 `ui-design-to-code-mcp@latest` 时，更新脚本每天 04:15 检查一次 npm latest，只有版本变化时才下载更新。更新后的包会在 Codex 下一次启动或重新加载该 MCP server 时生效。

Codex 配置示例：

```toml
[mcp_servers.ui_design_to_code]
command = "/Users/<user>/.codex/bin/serve-ui-design-to-code-mcp"
args = []
startup_timeout_sec = 30
```

卸载：

```bash
npx -y ui-design-to-code-mcp@latest uninstall --client codex
```

### Cursor

项目级配置：

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

安装：

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client cursor \
  --scope project \
  --project-dir .
```

卸载：

```bash
npx -y ui-design-to-code-mcp@latest uninstall \
  --client cursor \
  --scope project \
  --project-dir .
```

### Claude Code

项目级安装：

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client claude-code \
  --scope project \
  --project-dir .
```

用户级安装：

```bash
claude mcp add-json ui-design-to-code \
  '{"type":"stdio","command":"npx","args":["-y","ui-design-to-code-mcp@latest","serve"]}' \
  --scope user
```

## 工具参考

### `get_run_modes`

返回支持的执行模式、目标平台、触发示例和模式选择提示。

当用户提供 UI 截图、参考图、Figma 设计或 design-to-code 任务，但没有明确指定模式时，应先调用它。

典型输入：

```json
{ "requestText": "convert this screenshot to web code" }
```

### `create_design_run`

创建运行目录和 `artifact-run-manifest.json`。

关键入参：

- `workspace`：生成目录所在项目根目录。
- `slug`：可读的 run 名称后缀。
- `mode`：执行模式。
- `targets`：target/codegen/review 模式必填。
- `useTmp`：为 true 时写入 `/private/tmp`。

返回：

- `runRoot`
- `manifestPath`
- `mode`

### `ingest_image_source`

把截图或图片登记为源输入。

输出：

```text
source/design-source-manifest.json
source/page.source-manifest.json
```

关键入参：

- `runRoot`
- `imagePath`
- `sourceId`
- 无法自动读取尺寸时传 `widthPx`、`heightPx`
- `knownViewport`
- `logicalUnit`

### `ingest_figma_source`

登记 Figma MCP 节点 JSON、可选截图，或两者组成的 hybrid 输入。

输出：

```text
source/design-source-manifest.json
figma/figma-source-dataset.json
```

关键入参：

- `runRoot`
- `figma.fileKey`
- `figma.nodeId`
- `nodeJson` 或 `nodeJsonPath`
- `screenshotPath`
- `figmaBounds`

### `slice_image_assets`

根据 `layers.manifest.json` 中的 `source_bbox`，从源图精确裁切 bitmap/icon 资源。

这是显式调用的独立工具，不会改变 decode、plan、target IR 或 codegen 的默认流程。

输入 manifest 示例：

```json
[
  {
    "id": "icon-tab-home",
    "type": "bitmap",
    "source_bbox": { "x": 120, "y": 980, "width": 72, "height": 72 },
    "asset": "icon-tab-home.png",
    "transparent_required": true,
    "z_index": 20
  }
]
```

典型 tool 入参：

```json
{
  "runRoot": "/path/to/run",
  "sourcePath": "/path/to/source.png",
  "layersManifestPath": "/path/to/layers.manifest.json",
  "canvasWidth": 750,
  "onlyType": "bitmap"
}
```

默认输出：

```text
assets/slices/<asset>.png
assets/slices/layers.manifest.normalized.json
qa/bbox-preview.svg
qa/png-asset-audit.json
```

切图脚本使用源图像素坐标，不自动 trim，不改变输出画布尺寸。它会保留源像素和源 alpha。当前版本不引入额外图像依赖，因此不做背景抠除；当无法读取 alpha 细节时，审计报告会把透明/贴边检查标记为不可用。

### `build_reference_analysis`

登记模型生成的 Reference Image Analysis。它位于 Vision IR 之前，用来记录原始像素尺寸、根画板、语义顶层分组、文本/媒体/图标/材质清单、底部导航、严格提取设置、高风险区域和后续审计计划。

如果没有传 `artifactPath`，工具会返回需要生成该产物的 schema 和参考说明。

默认 artifact type：

```text
reference_analysis
```

### `build_semantic_ir`

登记 model 生成的 Platform-neutral Semantic UI IR。

如果没有传 `artifactPath`，工具会返回需要生成该产物的 schema 和参考说明。

默认 artifact type：

```text
platform_neutral_semantic_ui_ir
```

### `build_cross_platform_nodes`

登记 Cross-platform Node Data。

如果没有传 `artifactPath`，工具会返回对应 schema 合约。

默认 artifact type：

```text
cross_platform_node_data
```

### `build_target_ir`

登记目标平台布局 IR。

schema 提示按 target 名称选择：

- Android target 使用 Android layout schema。
- iOS target 使用 iOS SwiftUI layout schema。
- 其他 target 使用 Web React layout schema。

### `run_codegen`

记录实现代码变更和常规验证结果，不执行视觉验收门禁。

输出：

```text
review/codegen-result.json
```

### `run_codegen_with_auto_review`

记录代码生成结果和视觉验收依据。

当提供 `visualReviewResultPath` 时，只有满足下面条件才标记为可交付：

```text
review.status == "passed"
minimum non-material similarity >= 0.9
```

输出：

```text
review/codegen-with-auto-review-result.json
```

### `validate_pipeline`

校验现有 run 的跨产物链路。它会检查必需产物是否存在，以及 vision、compression、semantic、cross-platform、target planning 之间的 traceability 是否一致。

### `audit_image_decoding`

审计截图/图片解析产物。它会检查 reference analysis 是否匹配源图尺寸、顶层分组是否越界、审计章节是否齐全、文本是否有字体度量、媒体/图标区域是否被纳入、semantic node 是否保留 traceability、单行文本是否存在换行风险、底部导航是否包含槽位，以及低置信节点是否提供 alternatives。

默认输出：

```text
qa/image-decoding-audit.json
```

### `cleanup_design_run`

运行产物清理，默认 dry-run。

典型入参：

```json
{ "runRoot": "/path/to/run", "apply": false }
```

只有确认要删除可清理产物时，才设置 `apply: true`。

## 常见工作流

### 截图转 Web 代码

1. 用户未指定模式时，调用 `get_run_modes`。
2. 调用 `create_design_run`，选择 `mode: "codegen"` 或 `mode: "codegen-with-auto-review"`，并设置 `targets: ["web-react"]`。
3. 调用 `ingest_image_source` 登记截图。
4. 分析截图结构后调用 `build_reference_analysis`。
5. 生成或登记 Semantic UI IR、Cross-platform Node Data、Target Layout IR。
6. Vision/Compression/Semantic 产物就绪后调用 `audit_image_decoding`。
7. 在宿主项目里实现代码。
8. 调用 `run_codegen` 或 `run_codegen_with_auto_review`。
9. 调用 `validate_pipeline`。

### Figma Hybrid 到 Target IR

1. 通过 Figma MCP 获取节点 JSON。
2. 提供或截取同一 frame 的截图。
3. 调用 `create_design_run`，设置 `mode: "target-ir"` 和目标平台。
4. 调用 `ingest_figma_source`，传入 `nodeJson` 和 `screenshotPath`。
5. 生成目标平台 Layout IR。
6. 调用 `build_target_ir` 登记产物。
7. 调用 `validate_pipeline`。

### 截图精确切图

1. 调用 `create_design_run`。
2. 调用 `ingest_image_source`。
3. 创建包含源图像素 bbox 的 `layers.manifest.json`。
4. 调用 `slice_image_assets`。
5. 在生成代码中使用 `assets/slices/` 下的 PNG。
6. 检查 `qa/bbox-preview.svg` 和 `qa/png-asset-audit.json`。

## 更新和版本管理

更新客户端配置到指定 channel：

```bash
npx -y ui-design-to-code-mcp@latest update \
  --clients cursor,claude-code,codex \
  --channel latest
```

安装固定版本：

```bash
npx -y ui-design-to-code-mcp@0.1.4 install \
  --client codex \
  --package-spec ui-design-to-code-mcp@0.1.4
```

稳定生产环境建议使用固定版本。需要 Codex 每日自动更新或 `npx` 客户端动态获取新版时，使用 `@latest`。

## 开发

运行校验：

```bash
npm run check
npm run release:check
```

打包预览：

```bash
npm pack --dry-run
```

## 发布

推荐公共 npm 发布路径：

1. 配置 npm Trusted Publishing：

   ```bash
   node bin/ui-design-to-code-mcp.js configure-npm-trusted-publishing --dry-run
   ```

2. 从 `main` 分支触发 GitHub Actions 的 `Release` workflow。

Release workflow 使用 GitHub Actions OIDC（`id-token: write`），不需要 `NPM_TOKEN` 或长期 MCP Registry token。npm 账号 2FA 应保持开启。

完整发布、Registry、回滚和安全策略见：

- [RELEASE.md](./RELEASE.md)
- [SECURITY.md](./SECURITY.md)

## 仓库

```text
https://github.com/Kinglions/ui-design-to-code-mcp.git
```
