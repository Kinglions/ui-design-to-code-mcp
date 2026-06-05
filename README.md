# UI Design to Code MCP

[中文文档](./README.zh-CN.md) | English

<!-- mcp-name: io.github.Kinglions/ui-design-to-code-mcp -->

`ui-design-to-code-mcp` is an MCP server that standardizes the artifact pipeline for converting UI screenshots, Figma MCP node JSON, or Figma-plus-screenshot hybrid sources into implementation-ready design-to-code outputs.

It does **not** replace the coding agent or model. Instead, it gives agents a reliable workflow for run directories, source manifests, Figma datasets, intermediate IR contracts, target layout artifacts, codegen records, asset slicing outputs, visual review gates, validation, and cleanup.

## Highlights

- Works with **Codex**, **Cursor**, and **Claude Code**.
- Creates isolated artifact runs under `generated/ui-design-to-code/<run-id>` or `/private/tmp/ui-design-to-code/<run-id>`.
- Supports screenshots, source images, Figma node JSON, and hybrid Figma + screenshot input.
- Covers the full pipeline: decode, planning, target IR, codegen, auto review, runtime review, validation, and cleanup.
- Provides schema-backed contracts for Semantic UI IR, Cross-platform Node Data, Target Layout IR, visual review, and artifact lifecycle.
- Supports precise source-image asset slicing using explicit `source_bbox` layer manifests.
- Optimizes Codex startup by installing a stable local MCP serve command instead of running `npx @latest` on every startup.

## Quick Start

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

## Recommended Workflow

1. Choose a mode with `get_run_modes` when the user has not specified one.
2. Create an artifact run with `create_design_run`.
3. Register source input with `ingest_image_source` or `ingest_figma_source`.
4. Generate and register Semantic UI IR, Cross-platform Node Data, and Target Layout IR.
5. Generate or modify code in the host project.
6. Record results with `run_codegen` or `run_codegen_with_auto_review`.
7. Validate the full artifact chain with `validate_pipeline`.
8. Optionally clean generated artifacts with `cleanup_design_run`.

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
4. Generate or register Semantic UI IR, Cross-platform Node Data, and Target Layout IR.
5. Implement code in the host project.
6. Call `run_codegen` or `run_codegen_with_auto_review`.
7. Call `validate_pipeline`.

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
