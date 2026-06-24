# UI Design to Code MCP

[中文](#中文) | [English](#english)

<!-- mcp-name: io.github.Kinglions/ui-design-to-code-mcp -->

MCP server for **Codex**, **Cursor**, and **Claude Code** that turns UI screenshots, source images, Figma MCP node JSON, and Figma-plus-screenshot hybrid input into traceable design-to-code artifacts.

```bash
npx -y ui-design-to-code-mcp@latest install --client codex
```

Use it when you need more than a one-shot screenshot-to-code prompt:

- Decode UI screenshots and Figma data into source manifests, reference analysis, Vision IR, Node Compression IR, and Semantic UI node trees.
- Preserve traceability from generated code plans back to visual primitives, grouped candidates, and source pixels.
- Generate adapter-ready artifacts for Web, iOS, Android, and other UI implementation targets.
- Run audit gates for text overflow, media coverage, navigation structure, visual review evidence, and cleanup.

Links:

- npm: <https://www.npmjs.com/package/ui-design-to-code-mcp>
- MCP Registry: `io.github.Kinglions/ui-design-to-code-mcp`
- GitHub: <https://github.com/Kinglions/ui-design-to-code-mcp>
- Quick feedback: <https://github.com/Kinglions/ui-design-to-code-mcp/issues/new?title=%5BFeedback%5D%20>
- GitHub Issues: <https://github.com/Kinglions/ui-design-to-code-mcp/issues/new/choose>

## 中文

`ui-design-to-code-mcp` 是一个用于 UI design-to-code 流程的 MCP server。它可以把 UI 截图、Figma MCP 节点 JSON，或 Figma 节点 + 截图的混合输入，接入一套结构化、可追踪、可校验的产物流水线。

它**不替代真正写代码的 agent/model**。它的职责是标准化运行目录、输入清单、Figma 数据集、中间 IR 合约、目标平台布局产物、代码生成记录、精确切图产物、视觉验收门禁、产物校验和清理流程。

## 功能介绍

### 适用场景

- 需要把 UI 截图、参考图、GPT Image mockup、Figma URL、Figma MCP 节点 JSON 或 Figma 导出图转成可追踪的设计实现流程。
- 需要先解析设计结构、节点树、布局语义、组件层级、状态和资产，再进入代码实现。
- 需要 Web、iOS、Android 等多目标平台的 Target Layout IR 或实现计划。
- 需要对生成实现做截图验收、视觉差异复核、文本溢出检查、底部导航检查、资产覆盖检查和产物清理。

### 不适用场景

- 只想让模型基于一张图直接写最终代码，且不需要中间产物、追踪关系或验收证据。
- 纯 MCP 安装、版本、doctor、配置排查请求；这类请求不应该创建 design run。
- 没有设计源，也没有 design-to-code / design-decoding 意图的普通前端开发任务。

### 核心能力

- 支持 **Codex**、**Cursor**、**Claude Code**。
- 创建隔离的标准运行目录：`generated/ui-design-to-code/<run-id>` 或 `/private/tmp/ui-design-to-code/<run-id>`。
- 统一接入截图、图片、Figma 节点 JSON、Figma + 截图混合输入。
- 覆盖完整流程：decode、planning、target IR、codegen、自动视觉验收、runtime review、validate、cleanup。
- 提供 Semantic UI IR、Cross-platform Node Data、Target Layout IR、视觉验收、产物生命周期等 schema 合约。
- 支持基于 `source_bbox` 的源图精确 bitmap/icon 切图。
- Codex 安装后使用本地稳定 serve 命令，避免每次 MCP 启动都执行 `npx @latest`。

### 产出物

- `artifact-run-manifest.json`：一次运行的产物清单、保留策略和清理边界。
- `design-source-manifest.json` / `source image manifest`：设计源、像素尺寸、坐标系和输入假设。
- `figma-source-dataset.json`：Figma 节点、样式、组件、注释、截图和资产下载信息。
- Reference Image Analysis、Vision IR、Node Compression IR、Semantic UI IR、Cross-platform Node Data。
- Target Layout IR、codegen 记录、visual review plan/result、QA audit 和 cleanup dry-run 结果。

## 使用手册

### 快速开始

### 安装到 Codex

```bash
npx -y ui-design-to-code-mcp@latest install --client codex
```

配置 Figma token：

```bash
ui-design-to-code-mcp setup-figma-token
```

该命令会提示粘贴 token，并写入 `~/.codex/config.toml` 的
`[mcp_servers.ui_design_to_code.env]`。如果要在脚本里使用：

```bash
printf %s '<YOUR_FIGMA_TOKEN>' | ui-design-to-code-mcp configure-figma-token --client codex --stdin
```

### 安装到 Cursor 项目级配置

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client cursor \
  --scope project \
  --project-dir .
```

配置 Figma token：

```bash
ui-design-to-code-mcp configure-figma-token --client cursor --scope project --project-dir . --token <YOUR_FIGMA_TOKEN>
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

### 反馈与改进入口

如果你在使用中遇到模式选择不清晰、Figma token 检测不符合预期、视觉还原不稳定、资产同步路径错误、运行时验收失败或文档示例缺失，可以直接提交反馈：

- 快捷反馈：<https://github.com/Kinglions/ui-design-to-code-mcp/issues/new?title=%5BFeedback%5D%20>
- Bug / 功能请求 / 使用问题：<https://github.com/Kinglions/ui-design-to-code-mcp/issues/new/choose>
- 已有问题列表：<https://github.com/Kinglions/ui-design-to-code-mcp/issues>

提交时建议附带：

- 客户端：Codex / Cursor / Claude Code。
- 输入类型：截图、Figma URL、Figma node JSON、混合输入。
- 选择的模式：`decode-only`、`plan-only`、`target-ir`、`codegen`、`codegen-with-auto-review` 或 `runtime-review`。
- 目标平台：`web-react`、`web-next`、`ios-uikit`、`ios-swiftui`、`android-compose`、`android-view`。
- 关键产物或日志：`artifact-run-manifest.json`、`validate_pipeline` 输出、`visual-review-result.json`、doctor 输出。

## 推荐执行流程

当请求同时包含设计源和 design-to-code / design-decoding 意图时，客户端应先自动发现并调用 `ui_design_to_code` MCP，而不是先走纯本地实现流程。典型设计源包括 UI 截图、预览图、GPT Image mockup、Figma URL / `node-id`、Figma MCP 节点 JSON、Figma 截图或导出图。

不要为 MCP 存在性、版本、安装、doctor 或路由排查请求创建 run，除非用户同时提供设计源并要求解析、实现或视觉验收。

1. 如果流程包含 Figma 设计稿，先调用 `check_figma_token`。
   - token 缺失时，直接要求用户输入 Figma token；收到后调用 `configure_figma_token` 自动写入全局 Codex 配置，不要创建 run。
   - 只有交互式自动写入不可用时，才提示备用命令 `ui-design-to-code-mcp setup-figma-token`。
   - token 已配置后，继续进入执行模式选择。
2. 用户没有显式指定模式时，再调用 `get_run_modes`，把返回的模式选择提示展示给用户。
   - `recommendedMode` 只能作为默认高亮选项，不能当作用户已同意。
   - 用户必须选择 `decode-only`、`plan-only`、`target-ir`、`codegen`、`codegen-with-auto-review` 或 `runtime-review` 之一。
3. 用户确认模式后，再调用 `create_design_run` 创建独立产物运行目录。
4. 使用 `ingest_image_source` 或 `ingest_figma_source` 登记源输入。
   - `ingest_figma_source` 支持两种来源：外部已获取的 Figma 节点 JSON，或 Figma URL / `fileKey` / `nodeId` + token 直连 Figma REST API 由本 MCP 自行拉取节点树、截图和 image fills。
5. 对截图/图片输入，先生成并用 `build_reference_analysis` 登记 Reference Image Analysis。
6. 生成并登记 Semantic UI IR、Cross-platform Node Data、Target Layout IR。
7. 当已有 Vision/Compression/Semantic 产物后，调用 `audit_image_decoding` 审计图片解析质量。
8. 在宿主项目中生成或修改目标代码。
9. 使用 `run_codegen` 或 `run_codegen_with_auto_review` 记录结果。
9. 调用 `validate_pipeline` 校验完整产物链路。
10. 需要时使用 `cleanup_design_run` 清理生成产物。

## 当前流程优化建议

当前流程已经具备 token gate、mode gate、独立 runRoot、manifest 追踪、结构校验、视觉验收和 cleanup dry-run。后续更值得优化的是下面几类：

- **IR 自动生成边界**：MCP 当前负责登记、校验和追踪产物；Vision IR、Compression IR、Semantic IR 和真实代码仍由调用 agent/model 生成。README 和客户端提示应持续避免暗示 MCP 单独完成全自动截图转代码。
- **运行时验收前置条件**：`codegen-with-auto-review` 和 `runtime-review` 需要宿主项目具备可运行命令、截图入口和目标页面定位。缺少这些条件时，应明确返回 blocked，而不是把未截图的实现标记为可交付。
- **Schema 校验深度**：`validate_pipeline` 目前偏结构性、依赖少。未来可以在不显著增加安装成本的前提下，引入更完整的 JSON Schema 校验。
- **产物体积和孤儿文件审计**：现有 size accounting 主要覆盖 manifest 已登记文件。后续可以增加 runRoot orphan artifact audit，只报告不删除。
- **revision 管理**：多轮 patch / review 后，应在 manifest 中记录 supersedes 关系，让旧失败版本自动进入 cleanup eligible。
- **资产去重**：source crop 和 Figma asset 下载可以进一步用 hash 去重，减少多轮 review 产生的重复图片。

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
| Figma 节点 JSON 或 Figma REST 直连 | 需要结构、命名、文本、组件、样式和布局元数据。 | `ingest_figma_source` |
| Figma 节点 + 截图 / REST 导出截图 | 同时需要结构化信息和像素级视觉基准。 | `ingest_figma_source` |

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

登记 Figma 输入源。支持：

1. 传入现成 Figma 节点 JSON。
2. 提供 Figma URL / `figma.fileKey` / `figma.nodeId`，并通过 `apiToken` 或环境变量（默认尝试 `FIGMA_API_TOKEN`、`FIGMA_ACCESS_TOKEN`、`FIGMA_OAUTH_TOKEN`）让 MCP 直接调用 Figma REST API。
3. 在 1 或 2 的基础上附带截图，或让 MCP 自动导出截图和 target-aware 资产。
4. 如果同时提供 `projectRoot`，MCP 会在下载完成后把资产自动同步到目标工程的默认资源目录，同时保留 runRoot 中的归档副本。

输出：

```text
source/design-source-manifest.json
figma/figma-source-dataset.json
figma/figma-node-index.json
figma/figma-asset-plan.json
figma/raw-node-response.json
figma/raw-file-metadata.json
figma/raw-image-fills.json
figma/figma-asset-downloads.json
targets/asset-sync-manifest.json
```

关键入参：

- `runRoot`
- `figmaUrl`
- `figma.fileKey`
- `figma.nodeId`
- `nodeJson` 或 `nodeJsonPath`
- `screenshotPath`
- `figmaBounds`
- `fetchFromApi`
- `apiToken` / `tokenEnvVar`
- `downloadScreenshot`
- `downloadAssets`
- `screenshotScale`
- `projectRoot`

资源同步规则：

- `web-react` / `web-next`：默认同步到 `public/ui-design-to-code/figma/...`；若无 `public/`，回退到 `src/assets/ui-design-to-code/figma/...`
- `ios-uikit` / `ios-swiftui`：优先同步到首个发现的 `.xcassets`，自动创建 `.imageset`
- `android-compose` / `android-view`：默认同步到 `app/src/main/res/drawable`；若无则搜索 `src/main/res`

也可以显式单独调用：

```text
sync_target_assets
```

如果缺少 token，MCP 会要求用户直接输入 Figma token，并通过 `configure_figma_token` 自动写入全局 Codex 配置；只有自动配置不可用时，才使用备用命令：

```bash
ui-design-to-code-mcp setup-figma-token
```

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

## English

`ui-design-to-code-mcp` is an MCP server that standardizes the artifact pipeline for converting UI screenshots, Figma MCP node JSON, or Figma-plus-screenshot hybrid sources into implementation-ready design-to-code outputs.

It does **not** replace the coding agent or model. Instead, it gives agents a reliable workflow for run directories, source manifests, Figma datasets, intermediate IR contracts, target layout artifacts, codegen records, asset slicing outputs, visual review gates, validation, and cleanup.

## Feature Overview

### When to use it

- You have a UI screenshot, reference image, GPT Image mockup, Figma URL, Figma MCP node JSON, or Figma export and need a traceable design-to-code workflow.
- You want to decode structure, node hierarchy, layout semantics, states, and assets before implementation.
- You need target layout artifacts or implementation plans for Web, iOS, Android, or multiple platforms.
- You need runtime screenshots, visual diff evidence, text-overflow checks, navigation checks, asset coverage checks, or artifact cleanup.

### When not to use it

- You only want a one-shot prompt that writes final code from an image, with no intermediate artifacts or review evidence.
- You are only checking MCP installation, version, doctor output, or configuration. Those requests should not create a design run.
- The task has no design source and no design-decoding or design-to-code intent.

### Core capabilities

- Works with **Codex**, **Cursor**, and **Claude Code**.
- Creates isolated artifact runs under `generated/ui-design-to-code/<run-id>` or `/private/tmp/ui-design-to-code/<run-id>`.
- Supports screenshots, source images, Figma node JSON, and hybrid Figma + screenshot input.
- Covers the full pipeline: decode, planning, target IR, codegen, auto review, runtime review, validation, and cleanup.
- Provides schema-backed contracts for Semantic UI IR, Cross-platform Node Data, Target Layout IR, visual review, and artifact lifecycle.
- Supports precise source-image asset slicing using explicit `source_bbox` layer manifests.
- Optimizes Codex startup by installing a stable local MCP serve command instead of running `npx @latest` on every startup.

### Outputs

- `artifact-run-manifest.json`: run-level artifact list, retention policy, and cleanup boundary.
- `design-source-manifest.json` / source image manifest: source metadata, pixel size, coordinate system, and assumptions.
- `figma-source-dataset.json`: Figma nodes, styles, components, comments, screenshots, and asset download metadata.
- Reference Image Analysis, Vision IR, Node Compression IR, Semantic UI IR, and Cross-platform Node Data.
- Target Layout IR, codegen records, visual review plan/result, QA audit outputs, and cleanup dry-run reports.

## User Handbook

### Quick Start

### Install for Codex

```bash
npx -y ui-design-to-code-mcp@latest install --client codex
```

### Install for Cursor project config

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client cursor \
  --scope project \
  --project-dir .
```

### Install for all supported local clients

```bash
npx -y ui-design-to-code-mcp@latest install \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir .
```

### Check or run the server

```bash
npx -y ui-design-to-code-mcp@latest doctor
npx -y ui-design-to-code-mcp@latest serve
```

### Feedback and Issues

Use these links when mode selection is unclear, Figma token detection does not behave as expected, visual restoration is unstable, asset sync paths are wrong, runtime review is blocked, or documentation examples are missing:

- Quick feedback: <https://github.com/Kinglions/ui-design-to-code-mcp/issues/new?title=%5BFeedback%5D%20>
- Bug reports / feature requests / usage questions: <https://github.com/Kinglions/ui-design-to-code-mcp/issues/new/choose>
- Existing issues: <https://github.com/Kinglions/ui-design-to-code-mcp/issues>

Useful details to include:

- Client: Codex / Cursor / Claude Code.
- Source type: screenshot, Figma URL, Figma node JSON, or hybrid input.
- Mode: `decode-only`, `plan-only`, `target-ir`, `codegen`, `codegen-with-auto-review`, or `runtime-review`.
- Target: `web-react`, `web-next`, `ios-uikit`, `ios-swiftui`, `android-compose`, or `android-view`.
- Evidence: `artifact-run-manifest.json`, `validate_pipeline` output, `visual-review-result.json`, or doctor output.

## Recommended Workflow

1. Choose a mode with `get_run_modes` when the user has not specified one.
2. Create an artifact run with `create_design_run`.
3. Register source input with `ingest_image_source` or `ingest_figma_source`.
4. For screenshot/image input, produce and register Reference Image Analysis with `build_reference_analysis`.
5. Generate and register Semantic UI IR, Cross-platform Node Data, and Target Layout IR.
6. Audit image decoding quality with `audit_image_decoding` when Vision/Compression/Semantic artifacts exist.
7. Generate or modify code in the host project.
8. Record results with `run_codegen` or `run_codegen_with_auto_review`.
9. Validate the full artifact chain with `validate_pipeline`.
10. Optionally clean generated artifacts with `cleanup_design_run`.

## Current Workflow Optimization Notes

The current workflow already has token gating, mode gating, isolated run roots, manifest traceability, structural validation, visual review, and cleanup dry-runs. The next high-value improvements are:

- **IR generation boundary**: the MCP registers, validates, and tracks artifacts; the calling agent/model still generates Vision IR, Compression IR, Semantic IR, and implementation code.
- **Runtime review prerequisites**: `codegen-with-auto-review` and `runtime-review` need runnable host-app commands, screenshot capture configuration, and page routing. Missing prerequisites should return blocked, not deliverable.
- **Schema validation depth**: `validate_pipeline` is intentionally lightweight and structural. A future version can add deeper JSON Schema validation if dependency impact is acceptable.
- **Artifact size and orphan audit**: current size accounting covers manifest-listed files. A future audit can report unregistered files inside runRoot without deleting them.
- **Revision management**: patch/review loops should record supersedes relationships so failed old revisions can become cleanup-eligible.
- **Asset dedupe**: source crops and Figma downloads can use hashes to avoid duplicate image assets across review loops.

## Execution Modes

| Mode | Target required | Main use |
| --- | --- | --- |
| `decode-only` | No | Capture source manifests, vision/compression/semantic artifacts. No target plan or code. |
| `plan-only` | No | Add cross-platform node data and conversion planning. No target layout or code. |
| `target-ir` | Yes | Register target-platform layout IR. No code changes. |
| `codegen` | Yes | Generate or modify implementation code and record validation. |
| `codegen-with-auto-review` | Yes | Record codegen plus visual review evidence and similarity gate. |
| `runtime-review` | Yes | Review an existing runtime implementation against the source. No code changes. |

Target platform examples:

```text
ios-uikit / ios-swiftui / web-react / web-next / android-compose / android-view
```

## Source Input Strategy

| Source type | Use when | Recommended tool |
| --- | --- | --- |
| Screenshot or image | The design source is a rendered image. | `ingest_image_source` |
| Figma MCP node JSON | You need structure, names, text, components, styles, and layout metadata. | `ingest_figma_source` |
| Figma node JSON + screenshot | You need both structural metadata and pixel-level visual truth. | `ingest_figma_source` |

Hybrid Figma input is preferred when available because Figma nodes provide structure while screenshots provide the pixel baseline for visual review.

## Artifact Run Layout

Every workflow starts with `create_design_run`, which creates a dedicated `runRoot` and an `artifact-run-manifest.json`.

Project run layout:

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

Temporary runs use:

```text
/private/tmp/ui-design-to-code/<timestamp>-<slug>/
```

## Client Installation

### Codex

The Codex installer writes a user-level MCP config and keeps runtime startup off the network path.

Codex plugin marketplace install:

```bash
codex plugin marketplace add Kinglions/ui-design-to-code-mcp --ref main
codex plugin list --marketplace ui-design-to-code
codex plugin add ui-design-to-code@ui-design-to-code
```

After installation, verify the MCP server:

```bash
codex mcp list
```

The plugin registers `ui_design_to_code` with:

```bash
npx -y ui-design-to-code-mcp@latest serve
```

Direct npm-based MCP install remains available:

```bash
npx -y ui-design-to-code-mcp@latest install --client codex
```

Installed package:

```text
~/.codex/mcp-packages/ui-design-to-code-mcp
```

Codex serve command:

```text
~/.codex/bin/serve-ui-design-to-code-mcp
```

Daily updater on macOS:

```text
~/Library/LaunchAgents/com.wuyb.codex.update-mcp-packages.plist
```

Updater command:

```text
~/.codex/bin/update-mcp-packages
```

When the install spec is `ui-design-to-code-mcp@latest`, the updater checks npm once per day at 04:15 and downloads a new version only when `npm latest` changes. The updated package is used the next time Codex starts or reloads this MCP server.

Codex config example:

```toml
[mcp_servers.ui_design_to_code]
command = "/Users/<user>/.codex/bin/serve-ui-design-to-code-mcp"
args = []
startup_timeout_sec = 30
```

Uninstall:

```bash
npx -y ui-design-to-code-mcp@latest uninstall --client codex
```

### Cursor

Project config:

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

Install:

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client cursor \
  --scope project \
  --project-dir .
```

Uninstall:

```bash
npx -y ui-design-to-code-mcp@latest uninstall \
  --client cursor \
  --scope project \
  --project-dir .
```

### Claude Code

Project install:

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client claude-code \
  --scope project \
  --project-dir .
```

User-scope install:

```bash
claude mcp add-json ui-design-to-code \
  '{"type":"stdio","command":"npx","args":["-y","ui-design-to-code-mcp@latest","serve"]}' \
  --scope user
```

## Tool Reference

### `get_run_modes`

Returns supported modes, target platforms, trigger examples, and the mode-selection prompt.

Use it when the user provides a UI screenshot, reference image, Figma design, or design-to-code request without naming a mode.

Typical input:

```json
{ "requestText": "convert this screenshot to web code" }
```

### `create_design_run`

Creates the run directory and `artifact-run-manifest.json`.

Key inputs:

- `workspace`: project root for generated outputs.
- `slug`: readable run suffix.
- `mode`: one supported execution mode.
- `targets`: required for target/codegen/review modes.
- `useTmp`: writes under `/private/tmp` when true.

Returns:

- `runRoot`
- `manifestPath`
- `mode`

### `ingest_image_source`

Registers a screenshot or image into:

```text
source/design-source-manifest.json
source/page.source-manifest.json
```

Key inputs:

- `runRoot`
- `imagePath`
- `sourceId`
- `widthPx` and `heightPx` when size cannot be inferred
- `knownViewport`
- `logicalUnit`

### `ingest_figma_source`

Registers Figma MCP node JSON, an optional screenshot, or both.

Outputs:

```text
source/design-source-manifest.json
figma/figma-source-dataset.json
```

Key inputs:

- `runRoot`
- `figma.fileKey`
- `figma.nodeId`
- `nodeJson` or `nodeJsonPath`
- `screenshotPath`
- `figmaBounds`

### `slice_image_assets`

Crops bitmap/icon assets from a source image using a `layers.manifest.json` with `source_bbox` entries.

This tool is opt-in and does not alter decode, planning, target IR, or codegen flows.

Layer manifest example:

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

Typical tool input:

```json
{
  "runRoot": "/path/to/run",
  "sourcePath": "/path/to/source.png",
  "layersManifestPath": "/path/to/layers.manifest.json",
  "canvasWidth": 750,
  "onlyType": "bitmap"
}
```

Default outputs:

```text
assets/slices/<asset>.png
assets/slices/layers.manifest.normalized.json
qa/bbox-preview.svg
qa/png-asset-audit.json
```

The slicer uses exact source pixel bboxes and never auto-trims output canvases. It preserves source pixels and source alpha. Background removal is not performed without an external alpha-capable image decoder, so the audit report marks alpha-specific checks as unavailable when it cannot inspect them.

### `build_reference_analysis`

Registers model-generated Reference Image Analysis before Vision IR. This captures the original pixel size, root frame, semantic top-level groups, text/media/icon/material inventory, bottom navigation, strict extraction settings, high-risk zones, and the audit plan used for later decoding.

When `artifactPath` is missing, the tool returns the schema and reference path.

Default artifact type:

```text
reference_analysis
```

### `build_semantic_ir`

Registers model-generated Platform-neutral Semantic UI IR.

When `artifactPath` is missing, the tool returns the schema and reference path.

Default artifact type:

```text
platform_neutral_semantic_ui_ir
```

### `build_cross_platform_nodes`

Registers Cross-platform Node Data.

When `artifactPath` is missing, the tool returns the required schema contract.

Default artifact type:

```text
cross_platform_node_data
```

### `build_target_ir`

Registers target-platform layout IR for a selected target.

Schema hint selection:

- Android targets use Android layout schemas.
- iOS targets use iOS SwiftUI layout schemas.
- Other targets use Web React layout schemas.

### `run_codegen`

Records implementation output and validation summary without enforcing visual review.

Output:

```text
review/codegen-result.json
```

### `run_codegen_with_auto_review`

Records implementation output plus visual review evidence.

When `visualReviewResultPath` is provided, delivery is ready only when:

```text
review.status == "passed"
minimum non-material similarity >= 0.9
```

Output:

```text
review/codegen-with-auto-review-result.json
```

### `validate_pipeline`

Validates an existing run by checking required artifacts and traceability links between vision, compression, semantic, cross-platform, and target planning artifacts.

### `audit_image_decoding`

Audits screenshot/image decoding artifacts. It checks that reference analysis matches source dimensions, top-level groups stay in bounds, audit sections are present, text runs carry font metrics, media/icon regions are accounted for, semantic nodes keep traceability, single-line text avoids wrap risk, bottom navigation exposes slots, and uncertain nodes provide alternatives.

Default output:

```text
qa/image-decoding-audit.json
```

### `cleanup_design_run`

Runs artifact cleanup in dry-run mode by default.

Use:

```json
{ "runRoot": "/path/to/run", "apply": false }
```

Set `apply: true` only when cleanup should actually remove eligible artifacts.

## Common Workflows

### Screenshot to Web Code

1. Call `get_run_modes` if the user has not chosen a mode.
2. Call `create_design_run` with `mode: "codegen"` or `mode: "codegen-with-auto-review"` and `targets: ["web-react"]`.
3. Call `ingest_image_source` with the source screenshot.
4. Call `build_reference_analysis` after analyzing the screenshot structure.
5. Generate or register Semantic UI IR, Cross-platform Node Data, and Target Layout IR.
6. Call `audit_image_decoding` after Vision/Compression/Semantic artifacts are available.
7. Implement code in the host project.
8. Call `run_codegen` or `run_codegen_with_auto_review`.
9. Call `validate_pipeline`.

### Figma Hybrid to Target IR

1. Fetch Figma node JSON through Figma MCP.
2. Capture or provide the matching Figma frame screenshot.
3. Call `create_design_run` with `mode: "target-ir"` and the target platform.
4. Call `ingest_figma_source` with `nodeJson` and `screenshotPath`.
5. Generate target layout IR.
6. Call `build_target_ir`.
7. Call `validate_pipeline`.

### Precise Screenshot Asset Slicing

1. Call `create_design_run`.
2. Call `ingest_image_source`.
3. Create a `layers.manifest.json` with source pixel bboxes for bitmap/icon layers.
4. Call `slice_image_assets`.
5. Use `assets/slices/` in generated code.
6. Review `qa/bbox-preview.svg` and `qa/png-asset-audit.json`.

## Update and Versioning

Update client configs to a channel:

```bash
npx -y ui-design-to-code-mcp@latest update \
  --clients cursor,claude-code,codex \
  --channel latest
```

Install a pinned version:

```bash
npx -y ui-design-to-code-mcp@0.1.4 install \
  --client codex \
  --package-spec ui-design-to-code-mcp@0.1.4
```

Use pinned versions for stable production environments. Use `@latest` when you want the Codex daily updater or `npx`-based clients to pick up future releases.

## Development

Run checks:

```bash
npm run check
npm run release:check
```

Package dry run:

```bash
npm pack --dry-run
```

## Release

Recommended public npm release path:

1. Configure npm Trusted Publishing:

   ```bash
   node bin/ui-design-to-code-mcp.js configure-npm-trusted-publishing --dry-run
   ```

2. Trigger the GitHub Actions `Release` workflow from `main`.

The workflow uses GitHub Actions OIDC (`id-token: write`) and does not require `NPM_TOKEN` or a long-lived MCP Registry token. Keep npm account 2FA enabled.

For full release, registry, rollback, and security policy, see:

- [RELEASE.md](./RELEASE.md)
- [SECURITY.md](./SECURITY.md)

## Repository

```text
https://github.com/Kinglions/ui-design-to-code-mcp.git
```
