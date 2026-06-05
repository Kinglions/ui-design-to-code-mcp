# UI Design to Code MCP

中文 | [English](./README.md)

<!-- mcp-name: io.github.Kinglions/ui-design-to-code-mcp -->

`ui-design-to-code-mcp` 是一个可发布的 MCP server，用于把 UI 截图、Figma MCP 节点 JSON，或 Figma 节点加截图的混合输入，统一接入跨平台 design-to-code 产物流程。

它负责标准化设计源输入、Figma 数据集、运行目录、产物登记、codegen 结果记录、自动视觉验收门禁、pipeline 校验和产物清理。Semantic IR 生成和平台代码生成仍由调用方 agent/model 执行，并通过 MCP 工具登记到同一套产物结构中。

## 安装

所有支持的本地客户端快速安装：

```bash
npx -y ui-design-to-code-mcp@latest install \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir .
```

所有支持的本地客户端快速卸载：

```bash
npx -y ui-design-to-code-mcp@latest uninstall \
  --clients cursor,claude-code,codex \
  --scope project \
  --project-dir .
```

Cursor 项目级安装：

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client cursor \
  --scope project \
  --project-dir .
```

Cursor 项目级卸载：

```bash
npx -y ui-design-to-code-mcp@latest uninstall \
  --client cursor \
  --scope project \
  --project-dir .
```

Codex 用户级安装：

```bash
npx -y ui-design-to-code-mcp@latest install --client codex
```

Codex 安装器会写入用户级全局配置，并让 MCP 启动路径脱离网络依赖。它会把包安装到
`~/.codex/mcp-packages/ui-design-to-code-mcp`，让 Codex 指向
`~/.codex/bin/serve-ui-design-to-code-mcp`，并创建一个 macOS LaunchAgent，每天
04:15 运行 `~/.codex/bin/update-mcp-packages`。当安装规格是
`ui-design-to-code-mcp@latest` 时，更新脚本会检测 npm latest 是否有新版本，只在版本
变化时下载更新。更新后的代码会在 Codex 下一次启动或重新加载该 MCP server 时自动使用。

Codex 用户级卸载：

```bash
npx -y ui-design-to-code-mcp@latest uninstall --client codex
```

Claude Code 项目级安装：

```bash
npx -y ui-design-to-code-mcp@latest install \
  --client claude-code \
  --scope project \
  --project-dir .
```

Claude Code 项目级卸载：

```bash
npx -y ui-design-to-code-mcp@latest uninstall \
  --client claude-code \
  --scope project \
  --project-dir .
```

Claude Code 用户级安装：

```bash
claude mcp add-json ui-design-to-code '{"type":"stdio","command":"npx","args":["-y","ui-design-to-code-mcp@latest","serve"]}' --scope user
```

Claude Code 用户级卸载：

```bash
claude mcp remove ui-design-to-code --scope user
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
command = "/Users/<user>/.codex/bin/serve-ui-design-to-code-mcp"
args = []
startup_timeout_sec = 30
```

Claude Code 用户级安装也可以使用：

```bash
claude mcp add-json ui-design-to-code '{"type":"stdio","command":"npx","args":["-y","ui-design-to-code-mcp@latest","serve"]}' --scope user
```

## 触发方式与模式选择

当 IDE/agent 判断当前任务属于 UI 截图、参考图、Figma 设计稿、Figma MCP
节点数据或 design-to-code 场景时，应先进入 `ui-design-to-code` 流程。只要用户没有
明确写出执行模式，就必须先给出模式选项，等用户选择后再继续创建 run 和产物。

常见触发语句：

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

必须先展示的模式选项：

```text
请选择执行模式：
1. decode-only：只解析设计源和节点树，不生成平台计划或代码。
2. plan-only：生成跨平台节点数据和转换计划，不生成布局 IR 或代码。
3. target-ir：生成目标平台布局 IR，不写代码。
4. codegen：在目标平台生成/修改代码，做常规项目验证和清理；不强制截图验收。
5. codegen-with-auto-review：先生成/修改代码，再自动启动浏览器/模拟器/仿真器截图对比；非素材 UI 还原度必须 >= 90% 才可交付。
6. runtime-review：启动已有实现，在浏览器/模拟器/仿真器中截图并和原图对比，不改代码。
```

如果选择 `target-ir`、`codegen`、`codegen-with-auto-review` 或
`runtime-review`，并且用户没有指定平台，还必须继续询问：

```text
请选择目标平台：ios-uikit / ios-swiftui / web-react / web-next / android-compose / android-view
```

Figma 使用场景：

1. 先通过 Figma MCP 获取节点 JSON；如果可以，同时获取同一 frame 的截图。
2. 将 Figma MCP 输出作为 `ingest_figma_source` 的 `nodeJson` 或 `nodeJsonPath`。
3. 如果有截图，将截图作为 `screenshotPath`，形成 hybrid 输入。
4. 后续继续执行用户选择的模式，而不是走另一套 Figma 专用流程。

Figma hybrid 输入优先级最高：Figma 节点负责结构、命名、组件、文本、样式和布局；
截图负责像素基准、视觉效果和后续自动视觉验收。

## MCP 工具

- `get_run_modes`：返回标准执行模式、目标平台和触发示例。用户未明确选择模式时，先调用它并展示选项。
- `create_design_run`：创建设计转换运行目录和 manifest。
- `ingest_image_source`：接入截图或图片输入。
- `ingest_figma_source`：接入 Figma MCP 节点 JSON、Figma 截图或混合输入。
- `slice_image_assets`：根据包含 `source_bbox` 的 `layers.manifest.json`，从源图中精确裁切 bitmap/icon 资源。默认输出 PNG 到 `runRoot/assets/slices`，输出归一化 manifest 到 `runRoot/assets/slices/layers.manifest.normalized.json`，输出 bbox 预览到 `runRoot/qa/bbox-preview.svg`，输出审计报告到 `runRoot/qa/png-asset-audit.json`。
- `build_semantic_ir`：登记 Semantic UI IR，或返回需要生成该产物的 schema/prompt contract。
- `build_cross_platform_nodes`：登记 Cross-platform Node Data。
- `build_target_ir`：登记目标平台 Layout IR。
- `run_codegen`：记录普通 codegen 的改动文件和项目验证结果。
- `run_codegen_with_auto_review`：记录带自动视觉验收的 codegen 结果，并执行非素材区域相似度 `>= 0.9` 的交付门禁。
- `validate_pipeline`：运行跨产物 pipeline 校验。
- `cleanup_design_run`：运行产物清理，默认 dry-run。

## 精确切图

`slice_image_assets` 是显式调用的增量工具，不会改变现有 decode、plan、
target-IR 或 codegen 流程。仅当截图还原任务需要从当前源图精确导出图片资源时调用。

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

默认输出地址明确且全部位于 `runRoot` 内：

```text
assets/slices/<asset>.png
assets/slices/layers.manifest.normalized.json
qa/bbox-preview.svg
qa/png-asset-audit.json
```

切图脚本使用源图像素坐标精确裁切，不做自动 trim，也不会改变输出画布尺寸。当前版本保留源像素和源 alpha；在没有外部 alpha 图像解码器时，不执行背景抠除。

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

推荐的公共 npm 发布路径：

1. 为这个包配置 npm Trusted Publishing：

   ```bash
   node bin/ui-design-to-code-mcp.js configure-npm-trusted-publishing --dry-run
   ```

   确认参数无误后去掉 `--dry-run` 执行，或者在
   `npmjs.com -> Package -> Settings -> Trusted publishing` 中手动配置。

2. 从 `main` 分支手动触发 GitHub Actions 的 `Release` workflow。

Release workflow 使用 GitHub Actions OIDC（`id-token: write`）执行 `npm
publish`，因此不需要 `NPM_TOKEN`，也不会在 CI 发布时要求本地 OTP。使用
Trusted Publishing 时，npm 会自动发布 provenance 证明。

不要为了发布关闭 npm 账号的 2FA/OTP。交互式本地 `npm publish` 只作为首次建包
或紧急兜底流程，npm 可能会要求一次性 OTP，这是正常的安全保护。

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
