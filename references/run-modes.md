# Run Modes

Use the smallest mode that satisfies the request. Smaller modes produce fewer
artifacts and reduce cleanup cost.

## Simple Trigger Behavior

Short user commands can trigger this workflow when a UI image, screenshot,
Figma MCP node dataset, Figma screenshot, or hybrid Figma+image source is
present. Examples:

- `解析这图`
- `转代码`
- `还原页面`
- `复刻这个页面`
- `走设计稿流程`
- `图转节点树`
- `生成页面`
- `convert this screenshot`
- `implement this design`
- `Figma to code`

When one of these commands does not explicitly specify one of `decode-only`,
`plan-only`, `target-ir`, `codegen`, `codegen-with-auto-review`, or
`runtime-review`, ask the user to choose before producing any artifacts:

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
also ask for target platform if missing:

```text
请选择目标平台：ios-uikit / ios-swiftui / web-react / web-next / android-compose / android-view
```

## decode-only

Stops after Platform-neutral Semantic UI IR.

Required artifacts:

- Artifact Run Manifest
- Design Source Manifest
- Source Image Manifest
- Figma Source Dataset when Figma input is present
- Vision IR
- Node Compression IR
- Platform-neutral Semantic UI IR

Use when the user wants image understanding, node trees, audit, or design
handoff, but not platform planning.

## plan-only

Stops after Cross-platform Node Data and Platform Conversion Plan.

Required artifacts:

- decode-only artifacts
- Cross-platform Node Data
- Platform Conversion Plan
- Adapter contracts used by selected targets

Use when the user wants to compare iOS/Web/Android feasibility or choose a
platform strategy.

## target-ir

Stops after Target Layout IR.

Required artifacts:

- plan-only artifacts
- target-specific layout IR for each selected platform
- design token map when token normalization is needed
- asset policy when image crops or icons are involved

Use when the user wants implementation-ready structured handoff but not code.

## codegen

Continues into target code generation or code modification.

Required artifacts:

- target-ir artifacts
- generated code or patches
- normal project validation logs
- cleanup dry-run result

Use when the user asks to implement or generate target code but does not require
automatic runtime screenshot review.

## codegen-with-auto-review

Runs codegen and then mandatory runtime visual review.

Required artifacts:

- codegen artifacts
- Visual Review Plan
- runtime screenshots from browser, iOS Simulator, or Android Emulator
- screenshot diff outputs
- Visual Review Result
- cleanup dry-run result

Non-material UI regions must reach at least 90% similarity before delivery.
Material regions such as photos, generated media, video thumbnails,
illustrations, external assets, and device frames may be excluded from the
similarity score when listed in `materialExclusions`.

If runtime capture is blocked or similarity is below 90%, do not mark the work
as delivered. Report the blocker or remaining visual mismatch.

## runtime-review

Runs an existing implementation and verifies visual fidelity.

Required artifacts:

- Artifact Run Manifest
- Visual Review Plan
- runtime screenshots
- screenshot diff outputs
- Visual Review Result
- cleanup dry-run result

Use when the user already has an implementation and wants browser, iOS
Simulator, or Android emulator validation against a source image.

This mode must not generate or modify code unless the user explicitly asks for a
patch after reviewing the visual result.

## Default Selection

There is no automatic default mode for simple triggers. Ask for mode selection
unless the user explicitly names `decode-only`, `plan-only`, `target-ir`,
`codegen`, `codegen-with-auto-review`, or `runtime-review`.

Never run a larger mode just because the pipeline supports it.
