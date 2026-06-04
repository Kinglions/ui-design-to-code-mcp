# Usage Examples

## Simple Trigger

User request:

```text
解析这图
```

User request:

```text
解析这个 Figma 节点
```

If no mode is specified, ask for the same six-mode selection. If the selected
mode requires a target platform, ask for target platform after mode selection.

If no mode is specified, ask:

```text
请选择执行模式：
1. decode-only：只解析设计源和节点树，不生成平台计划或代码。
2. plan-only：生成跨平台节点数据和转换计划，不生成布局 IR 或代码。
3. target-ir：生成目标平台布局 IR，不写代码。
4. codegen：在目标平台生成/修改代码，做常规项目验证和清理；不强制截图验收。
5. codegen-with-auto-review：先生成/修改代码，再自动启动浏览器/模拟器/仿真器截图对比；非素材 UI 还原度必须 >= 90% 才可交付。
6. runtime-review：启动已有实现，在浏览器/模拟器/仿真器中截图并和原图对比，不改代码。
```

User request:

```text
转代码
```

If no mode is specified, ask for mode first. Do not infer `codegen` from
`转代码`.

```text
请选择执行模式：
1. decode-only：只解析设计源和节点树，不生成平台计划或代码。
2. plan-only：生成跨平台节点数据和转换计划，不生成布局 IR 或代码。
3. target-ir：生成目标平台布局 IR，不写代码。
4. codegen：在目标平台生成/修改代码，做常规项目验证和清理；不强制截图验收。
5. codegen-with-auto-review：先生成/修改代码，再自动启动浏览器/模拟器/仿真器截图对比；非素材 UI 还原度必须 >= 90% 才可交付。
6. runtime-review：启动已有实现，在浏览器/模拟器/仿真器中截图并和原图对比，不改代码。
```

After the user chooses `target-ir`, `codegen`, `codegen-with-auto-review`, or
`runtime-review`, if no target platform is specified, ask for target:

```text
请选择目标平台：ios-uikit / ios-swiftui / web-react / web-next / android-compose / android-view
```

## Decode-only

User request:

```text
把这张 UI 截图解析成节点树，不需要生成代码。
```

Expected mode: `decode-only`

Expected artifacts:

- `artifact-run-manifest.json`
- `source/design-source-manifest.json`
- `source/page.source-manifest.json`
- `vision/page.vision.json`
- `compression/page.compression.json`
- `semantic/page.semantic-tree.json`

Final response should summarize node hierarchy, uncertain detections, and
cleanup status.

## Decode-only Figma or Hybrid

User request:

```text
decode-only，解析这个 Figma MCP 节点 JSON 和对应截图，输出节点树。
```

Expected artifacts:

- `artifact-run-manifest.json`
- `source/design-source-manifest.json`
- `figma/figma-source-dataset.json`
- `source/page.source-manifest.json` when screenshot input exists
- `vision/page.vision.json`
- `compression/page.compression.json`
- `semantic/page.semantic-tree.json`

Figma-only input can skip the source image manifest and visual diff baseline.
Hybrid input should preserve both Figma node IDs and screenshot primitive IDs in
traceability.

## Plan-only Cross-platform

User request:

```text
分析这张 APP 页面适合转 iOS、Web、Android 哪些平台，并给出转换计划。
```

Expected mode: `plan-only`

Expected artifacts:

- decode-only artifacts
- `cross-platform/page.cross-platform-nodes.json`
- `targets/platform-conversion-plan.json`
- selected adapter contracts

Final response should compare target feasibility and list unsupported patterns.

## Target IR

User request:

```text
把这个截图转成 Web React 和 Android Compose 的结构化布局 IR，先不要写代码。
```

Expected mode: `target-ir`

Expected artifacts:

- plan-only artifacts
- `targets/web-react/page.target-layout.json`
- `targets/android-compose/page.target-layout.json`
- token map and asset policy when needed

Final response should link target layout files and report validation results.

## Codegen

User request:

```text
根据这张设计稿在当前 Next.js 项目里实现页面。
```

Expected mode: `codegen`

Expected workflow:

1. Inspect project components, tokens, routing, state, and validation patterns.
2. Produce or update run artifacts.
3. Generate target layout IR.
4. Implement code in the repo.
5. Run project validation.
6. Update manifest and run cleanup dry-run.

Final response must include changed files, validation, and cleanup status.

Minimum final response fields for codegen:

- changed files
- build/typecheck/lint result
- cleanup dry-run result

Runtime screenshot review is not mandatory in this mode.

## Codegen With Auto Review

User request:

```text
codegen-with-auto-review，目标 web-next，根据这张设计稿在当前项目里实现，并自动截图验收。
```

Expected mode: `codegen-with-auto-review`

Expected workflow:

1. Run the complete `codegen` workflow without changing its boundaries.
2. Build `visual-review-plan.json` with source crop, target runtime, viewport,
   states, thresholds, output paths, and `materialExclusions`.
3. Capture browser, iOS Simulator, or Android Emulator screenshot.
4. Compare screenshot with source image/crop using `--min-similarity 0.9` and
   material-region ignore rects when applicable.
5. Patch visual mismatches up to the bounded patch-loop limit.
6. Save `visual-review-result.json`.
7. Update manifest and run cleanup dry-run.

Final response must include changed files, validation, runtime screenshot path,
visual diff metrics, non-material similarity, cleanup status, and remaining
visual mismatches.

Minimum final response fields for codegen-with-auto-review:

- changed files
- build/typecheck/lint result
- runtime screenshot path or blocked reason
- screenshot diff metrics or blocked reason
- non-material similarity, must be >= 90% to deliver
- material exclusions used in comparison
- remaining visual mismatches
- cleanup dry-run result

If runtime capture is blocked or non-material similarity is below 90%, report
the mode as blocked/failed rather than delivered.

## Runtime Review

User request:

```text
runtime-review，目标 ios-uikit，用模拟器验证当前实现和这张图的还原效果。
```

Expected workflow:

1. Build `visual-review-plan.json`.
2. Build/install/launch the existing implementation on the requested runtime.
3. Capture screenshot.
4. Compare screenshot with source image/crop.
5. Save `visual-review-result.json`.
6. Run cleanup dry-run.

This mode reports visual mismatches but does not patch code unless the user asks
for a follow-up fix.

## Cleanup

Dry-run cleanup:

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/cleanup_artifacts.js \
  --run generated/ui-design-to-code/20260604-120000-example
```

Apply cleanup:

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/cleanup_artifacts.js \
  --run generated/ui-design-to-code/20260604-120000-example \
  --apply
```

Pipeline validation:

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/validate_pipeline.js \
  --run generated/ui-design-to-code/20260604-120000-example
```

## MCP Server

Run the shared MCP server:

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/ui_design_to_code_mcp_server.js
```

Use the same server from Codex, Cursor, or Claude Code. The tool layer creates
run directories, ingests image/Figma/hybrid sources, validates pipeline output,
and runs cleanup. Semantic IR and codegen remain model/agent steps that write
the existing artifacts and call validation.

## iOS Runtime Review

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/run_ios_simulator_review.js \
  --project App.xcodeproj \
  --scheme App \
  --configuration Debug \
  --derived-data /private/tmp/AppDerivedData \
  --app /private/tmp/AppDerivedData/Build/Products/Debug-iphonesimulator/App.app \
  --bundle-id com.example.App \
  --screenshot generated/ui-design-to-code/<run-id>/review/ios/content.png \
  --result-json generated/ui-design-to-code/<run-id>/review/ios/visual-review-result.json
```

Then compare:

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/compare_screenshots.js \
  --expected generated/ui-design-to-code/<run-id>/source/source-crop.png \
  --actual generated/ui-design-to-code/<run-id>/review/ios/content.png \
  --diff generated/ui-design-to-code/<run-id>/review/ios/content.diff.ppm \
  --min-similarity 0.9
```

## Android Runtime Review

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/run_android_emulator_review.js \
  --project-dir . \
  --build-task assembleDebug \
  --apk app/build/outputs/apk/debug/app-debug.apk \
  --package com.example.app \
  --activity .MainActivity \
  --screenshot generated/ui-design-to-code/<run-id>/review/android/content.png \
  --result-json generated/ui-design-to-code/<run-id>/review/android/visual-review-result.json
```

Then compare:

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/compare_screenshots.js \
  --expected generated/ui-design-to-code/<run-id>/source/source-crop.png \
  --actual generated/ui-design-to-code/<run-id>/review/android/content.png \
  --diff generated/ui-design-to-code/<run-id>/review/android/content.diff.ppm \
  --min-similarity 0.9
```
