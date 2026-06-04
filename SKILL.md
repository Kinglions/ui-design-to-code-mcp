---
name: ui-design-to-code
description: Use when the user asks to decode APP/Web UI preview images, screenshots, generated UI mockups, GPT Image UI previews, Figma MCP design node data, Figma screenshots, Figma-free screenshot-to-code flows, or visual UI references into design-source manifests, source-image manifests, Figma source datasets, Vision IR, Node Compression IR, platform-neutral Semantic UI node trees, cross-platform node data, platform adapter contracts, iOS UIKit/SwiftUI, Web React/Next.js, Android Compose/View implementation plans, target layout IR, generated code, node-tree mappings, component mapping contracts, artifact cleanup, or runtime screenshot review workflows. Trigger for simple phrases like 解析这张图, 解析这图, 看下这图, 转代码, 还原页面, 复刻这个页面, 走设计稿流程, 设计稿转代码, 截图转代码, 图片转代码, UI转代码, UI节点树, 图转节点树, 生成页面, implement this design, convert this screenshot, design to code, Figma to code, Figma MCP to code, preview image to code, screenshot to code, UI node tree, image to semantic UI IR, design image decoding, cross-platform UI mapping, UIKit mapping contract, Compose mapping contract, React mapping contract, or bypass Figma and generate code directly.
metadata:
  short-description: Decode UI designs into node trees and platform code
---

# UI Design to Code

Use this skill to turn a UI preview image, screenshot, Figma MCP node dataset, Figma screenshot, or hybrid Figma+image source into traceable design-decoding artifacts, a platform-neutral UI node tree, cross-platform node data, and optionally maintainable implementation workflows for iOS, Web, Android, or other platform adapters. In `codegen-with-auto-review` mode, the goal is to recreate the visual effect of the source image or Figma screenshot with target-platform code, then verify it with runtime screenshots and visual comparison.

Core rule: do not generate platform code directly from a bitmap or raw Figma JSON. First build a Design Source Manifest, normalize source-specific data, then build a platform-neutral semantic node tree, then cross-platform node data, then map through an explicit platform adapter contract.

Traceability rule: every semantic node must trace back to grouped candidate IDs, and every grouped candidate must trace back to raw primitive IDs. If a future platform adapter cannot map the node tree without re-reading the source image, the decoding artifacts are incomplete.

Coordinate rule: every artifact must declare its coordinate system. Source-image pixel coordinates and Figma canvas coordinates use a top-left origin and must remain traceable even when logical units are inferred.

Artifact lifecycle rule: every generated intermediate artifact must live inside a single run directory with a run manifest, retention policy, and cleanup status. Do not scatter Vision IR, node trees, crops, screenshots, or target IR files across the repo. Keep only user-requested final deliverables after cleanup.

Detail preservation rule: screenshot similarity failures usually come from missing micro-geometry, not missing controllers. Before generating platform code, extract and preserve corner radius, container padding, inter-item spacing, text hierarchy, line count, component height, and internal slot height distribution for every visible card, button, header, input, and repeated cell.

Height preservation rule: never flatten a multi-slot card into a single container height. Any `content_card`, `hero_header`, `prompt_input`, repeated-list cell, rail cell, or fixed CTA must carry both outer height and a `slotMetrics` / `slotLayout` contract that explains how media, title, subtitle, badges, metadata, progress, footer, and actions consume vertical space. If the screenshot does not support exact values, preserve measured ratios or min/max constraints with an uncertainty note instead of replacing them with defaults.

Visual fidelity rule: generated code must not be accepted only because the IR validates or the build passes when the selected mode is `codegen-with-auto-review`. In that mode, create a visual review plan, capture runtime screenshot(s), compare non-material UI regions against the source or cropped source image, and run a bounded patch loop when visual thresholds fail. Non-material view similarity must be at least `0.9` before delivery. If capture is blocked or similarity is below `0.9`, do not mark the implementation as deliverable.

## Default Pipeline

```text
Preview Image
  -> Artifact Run Manifest
  -> Design Source Manifest
  -> Source Image Manifest
  -> Figma Source Dataset when Figma input exists
  -> Vision IR
  -> Node Compression
  -> Platform-neutral Semantic UI IR
  -> Cross-platform Node Data
  -> Platform Conversion Plan
  -> Platform Adapter Contract
  -> Target Layout IR
  -> Target Code
  -> Runtime Review / Visual Screenshot Diff / Patch Loop when selected mode is codegen-with-auto-review
```

Figma is an optional source adapter, not a separate downstream flow. When Figma MCP node JSON, a Figma screenshot, or both are available, ingest them into the shared source artifacts and continue through the same Semantic UI IR, Cross-platform Node Data, target IR, codegen, and review modes. Hybrid Figma nodes plus screenshot are preferred; either input can also run alone.

For design-decoding-only tasks, stop after the platform-neutral Semantic UI IR. For platform planning tasks, stop after Cross-platform Node Data and Platform Conversion Plan. Enter code generation only when the user asks for a target implementation.

## Simple Trigger and Mode Selection

Simple trigger rule: if the user uploads or references a UI screenshot/design image and says a short command such as `解析这图`, `转代码`, `还原页面`, `复刻这个页面`, `走设计稿流程`, `图转节点树`, `生成页面`, `convert this screenshot`, or `implement this design`, activate this skill.

If the user did not explicitly specify one of `decode-only`, `plan-only`, `target-ir`, `codegen`, `codegen-with-auto-review`, or `runtime-review`, do not start producing artifacts yet. First ask the user to choose one execution mode:

1. `decode-only`: parse the image into source manifest, Vision IR, Node Compression IR, and platform-neutral Semantic UI node tree. No platform plan or code.
2. `plan-only`: add Cross-platform Node Data and compare target-platform conversion plans. No target layout IR or code.
3. `target-ir`: generate target-platform layout IR for selected targets. No code.
4. `codegen`: generate or modify target-platform code, run normal project validation, and cleanup artifacts. Runtime screenshot review is not mandatory in this mode.
5. `codegen-with-auto-review`: run `codegen`, then run browser/simulator/emulator screenshot review and visual diff. Non-material UI similarity must be at least `90%` before delivery.
6. `runtime-review`: run an existing target implementation in browser/simulator/emulator, capture screenshots, compare with the source image, and report visual diff. No decoding, IR generation, or code changes unless required inputs are missing.

Do not infer the mode from intent alone. Even if the user says "解析图片结构", "转代码", "生成页面", "验证模拟器", or "实现这个设计", ask for mode selection unless the message explicitly includes one of the six mode names.

If the mode is `target-ir`, `codegen`, `codegen-with-auto-review`, or `runtime-review` and the target platform is missing, ask for target platform selection before continuing.

Default artifact location:

```text
<workspace>/generated/ui-design-to-code/<YYYYMMDD-HHMMSS>-<slug>/
```

If the workspace should not be modified, use `/private/tmp/ui-design-to-code/<run-id>/`.
Large temporary crops, screenshots, and debug images should default to `/private/tmp`.

## When Starting

1. Determine whether the user wants planning, image decoding artifacts, platform-neutral node-tree generation, cross-platform node data, target-platform conversion, code generation, or review.
2. If only a screenshot or preview image is provided, infer semantics cautiously and preserve uncertainty with confidence and alternatives.
3. If a PRD, product notes, or existing project exists, use it to resolve product semantics, components, and data models.
4. If implementing in a repo, inspect existing components, tokens, state patterns, routing, and validation patterns before creating new components.
5. If the mode is not explicitly named, use the mode-selection rule above before creating artifacts.

## Required Workflow

1. Build `Artifact Run Manifest`.
   - Create one run directory before producing any IR or screenshots.
   - Record source inputs, output files, artifact categories, sizes when known, retention TTL, cleanup eligibility, and final deliverables.
   - Default TTL: 7 days for intermediate artifacts, 24 hours for debug crops/screenshots, keep final deliverables only when the user requested them.
   - Mark artifacts as `intermediate`, `debug`, `review`, or `final`.

2. Build `Design Source Manifest`.
   - Record whether the run uses `image`, `figma`, or `hybrid` input.
   - For image input, record the image path and pixel dimensions.
   - For Figma input, record file key, node/frame IDs when known, Figma MCP node JSON path, and screenshot path when available.
   - Define `source_pixel`, `figma_canvas`, `logical`, and `figmaToSourcePixel` mapping when both Figma bounds and screenshot pixels are available.

3. Build `Source Image Manifest` when an image or Figma screenshot is available.
   - Record source image width, height, path, color space if known, pixel density if known, and viewport assumptions.
   - Define source pixel, normalized, and logical coordinate spaces.
   - Mark logical scale as `unknown` when it cannot be inferred from the image or metadata.

4. Build `Figma Source Dataset` when Figma MCP node data is available.
   - Preserve Figma node IDs, parent/child relationships, names, node types, bounding boxes, text, styles, layout metadata, effects, and component references.
   - Keep Figma canvas coordinates separate from screenshot pixel coordinates.
   - When screenshot input also exists, record the mapping evidence between Figma canvas and source pixels.

5. Build `Vision IR`.
   - Extract raw visual primitives before grouping.
   - For image-only input, derive primitives from the screenshot or preview image.
   - For Figma-only input, normalize Figma nodes into primitive candidates without inventing pixel-only effects.
   - For hybrid input, combine Figma structure with screenshot-derived pixel evidence.
   - Do not map raw rectangles/text/icons directly into UIKit or any platform widget.
   - Preserve raw primitive IDs, bounding boxes, style evidence, content, confidence, and uncertainties.
   - Split text by visible line or run, keep icons separate from background shells, and keep effects separate from shapes.

6. Build `Node Compression IR`.
   - Group primitives by containment, alignment, shared background, proximity, z-order, and repeated geometry.
   - Every group must keep `primitiveIds`, `bbox`, `slotCandidates`, grouping evidence, confidence, alternatives, and uncertainties.
   - Repeated lists, rails, and grids must become templates with sampled instance IDs, item size, and slot candidates.
   - Leave ambiguous primitives unassigned instead of forcing them into a semantic node.

7. Build `Platform-neutral Semantic UI IR`.
   - Convert grouped candidates into product-semantic nodes.
   - Capture detail geometry before token normalization: outer radius, height mode, content insets, inner spacing, media aspect ratio, text style hierarchy, and line limits.
   - Capture slot-level height allocation before token normalization: media height or aspect ratio, text block line heights, badge height, footer height, CTA height, and progress/control heights.
   - Include `confidence` on every semantic node.
   - Include `alternatives` when confidence is below `0.8`.
   - Convert repeated lists/grids into templates with sample data.
   - Add screen states: `loading`, `empty`, `error`, `content`.
   - Add validation and error behavior for every user input node.
   - Every interactive or content-bearing node must include `visualMetrics`, `contentStructure`, and slot-level measurement data for each visible slot.
   - Keep the node tree platform-neutral. Do not use UIKit, SwiftUI, DOM, React, Compose, or Android View class names here.

8. Build `Cross-platform Node Data`.
   - Convert semantic nodes into adapter-ready nodes without platform class names.
   - Preserve source bboxes, source group IDs, primitive traceability, states, events, data requirements, accessibility hints, visual metrics, slot metrics, and responsive constraints.
   - Split node data into stable `core`, `visual`, `layout`, `interaction`, `data`, `accessibility`, and `traceability` sections.
   - Add `platformHints` only as optional hints. They must not replace platform-neutral node data.

9. Build `Platform Conversion Plan`.
   - Choose target adapters such as `ios-uikit`, `ios-swiftui`, `web-react`, `web-next`, `android-compose`, or `android-view`.
   - For each target, map cross-platform nodes through a versioned adapter contract.
   - Record unsupported patterns, required assets, required project components, state-management assumptions, and review commands.

10. Apply a platform adapter contract only for target implementation tasks.
   - Prefer existing project components.
   - Then use native target-platform controls.
   - Then generated reusable components.
   - Then page-private views.
   - Use bitmap fallback only for decorative media or explicit assets.
   - Record `mappingReason` for each mapped component.

11. Build target Layout IR.
   - Keep fixed regions outside scroll content unless the target adapter explicitly uses scaffold slots or sticky containers.
   - Add scroll inset, padding, safe-area, or viewport compensation for fixed controls.
   - Use target-native repeated-content containers for dynamic lists and grids.
   - Use simple stack/flex/linear containers only for stable small static groups.
   - Use design tokens instead of raw magic numbers.
   - Preserve semantic detail fields in generated layout and visual specs instead of re-inferring them later.
   - Preserve `slotMetrics` from Semantic UI IR as target slot layout; generated code must consume that data directly.
   - Buttons must keep touch height, label/icon spacing, and content insets.
   - Cards must keep shell radius, media crop rules, internal padding, slot order, and title/meta line limits.
   - Cards, cells, and repeated items must keep internal slot allocation; only emitting one outer height is invalid unless the component has a single slot.

12. Generate target code only after the IR validates.
   - Default target adapters: iOS UIKit + SnapKit, iOS SwiftUI, Web React/Next.js, Android Jetpack Compose.
   - Generate screen/root view, reusable components, cells/items, state model, view-model/store stub, view state, and mock data.
   - Include loading, empty, error, and content states.
   - Include input validation, error presentation, boundary values, and keyboard handling.
   - Generate named layout constants for outer component heights and for internal slots. Avoid anonymous page-level numbers such as `card.height = 404` unless the same component also defines slot heights/ratios that sum to the card layout.

13. Review normal project behavior for `codegen`.
   - Run project-appropriate validation such as build, typecheck, lint, unit tests, or targeted smoke tests.
   - Also check scrolling, dynamic text, dark mode, empty/error/loading, and input behavior when feasible.
   - Runtime screenshot review is optional in `codegen`; do not require it unless the user selected `codegen-with-auto-review` or `runtime-review`.

14. Run visual implementation review for `codegen-with-auto-review`.
   - Build `Visual Review Plan` with source image/crop, target runtime, viewports, states, thresholds, and output paths.
   - Mark material regions such as photos, generated media, video thumbnails, illustrations, external assets, and device frames as `materialExclusions`.
   - Capture runtime screenshot for each required viewport/state when automation is available.
   - Compare screenshots with `compare_screenshots.js --min-similarity 0.9` or an adapter-specific equivalent.
   - Save `Visual Review Result` with metrics, findings, and blocked status when capture cannot run.
   - Patch in this order when diff fails: viewport/crop/safe area, layout geometry, typography, visual styling, media crop/assets, state rendering, component-level bitmap fallback.
   - Stop after three failed visual patch iterations and report remaining mismatch with evidence.
   - Deliver only when non-material view similarity is at least `0.9`; otherwise report blocked/failed status and remaining gaps.

15. Run standalone runtime review for `runtime-review`.
   - Require an existing runnable target implementation plus source image/crop.
   - For web targets, capture with `capture_web_screenshot.js`.
   - For iOS targets, build/install/launch/capture with `run_ios_simulator_review.js`.
   - For Android targets, build/install/launch/capture with `run_android_emulator_review.js`.
   - Compare with `compare_screenshots.js`.
   - Save `visual-review-plan.json`, runtime screenshot(s), diff output, and `visual-review-result.json`.
   - Do not edit implementation code in this mode unless the user explicitly asks to patch after reviewing results.

16. Clean up artifacts.
   - Update the run manifest with actual outputs and cleanup status.
   - Delete or mark cleanup-eligible intermediate/debug artifacts that are not needed for the user's requested deliverable.
   - Preserve only final deliverables, compact manifests, and explicitly requested evidence.
   - Run the cleanup script in dry-run mode before applying deletion for non-temporary workspace outputs.

Run-mode rule: choose one of `decode-only`, `plan-only`, `target-ir`, `codegen`,
`codegen-with-auto-review`, or `runtime-review` before generating artifacts. Do
not produce larger downstream artifacts than the user requested.

## Bundled Resources

- `references/workflow.md`: full workflow and acceptance criteria.
- `references/artifact-lifecycle-and-cleanup.md`: run directory, retention, cleanup, and disk-size rules.
- `references/artifact-run-manifest.schema.json`: run manifest and artifact retention schema.
- `references/design-source-manifest.schema.json`: common image/Figma/hybrid source schema.
- `references/figma-source-dataset.schema.json`: normalized Figma MCP node dataset schema.
- `references/mcp-and-cross-tool-reuse.md`: MCP-first reuse model for Codex, Cursor, and Claude Code.
- `references/workflow-audit-and-optimization.md`: known gaps, fixes, and future validator improvements.
- `references/run-modes.md`: decode-only, plan-only, target-ir, codegen, codegen-with-auto-review, and runtime-review mode boundaries.
- `references/revision-management.md`: patch-loop revision naming and superseded artifact cleanup.
- `references/asset-policy.md`: asset naming, dedupe, icon priority, and retention.
- `references/usage-examples.md`: examples for each run mode and cleanup.
- `references/visual-implementation-review.md`: visual fidelity review, screenshot diff, and patch-loop rules.
- `references/design-image-decoding-workflow.md`: platform-neutral image decoding, coordinate systems, artifacts, and self-audit.
- `references/cross-platform-conversion-workflow.md`: platform-neutral node data and target adapter conversion flow.
- `references/node-tree-and-mapping.md`: node compression and mapping rules.
- `references/cross-platform-node-data.schema.json`: adapter-ready platform-neutral node data schema.
- `references/platform-adapter-contract.schema.json`: target adapter contract schema.
- `references/platform-conversion-plan.schema.json`: cross-platform conversion plan schema.
- `references/target-layout-ios-swiftui.schema.json`: SwiftUI target layout IR schema.
- `references/target-layout-web-react.schema.json`: React and Next.js target layout IR schema.
- `references/target-layout-android-compose.schema.json`: Compose target layout IR schema.
- `references/target-layout-android-view.schema.json`: Android View target layout IR schema.
- `references/design-token-map.schema.json`: normalized token output and platform token mappings.
- `references/adapter-capability-matrix.schema.json`: target adapter support matrix schema.
- `references/asset-policy.schema.json`: asset naming, dedupe, and retention schema.
- `references/visual-review-plan.schema.json`: source/runtime screenshot review plan schema.
- `references/visual-review-result.schema.json`: screenshot comparison result schema.
- `references/platform-adapters/*.json`: default adapter contracts for UIKit, SwiftUI, React, Next.js, Compose, and Android View.
- `references/uikit-mapping-contract.json`: default semantic-to-UIKit contract.
- `references/image-source-manifest.schema.json`: source image metadata and coordinate-space schema.
- `references/vision-ir.schema.json`: raw visual primitive schema.
- `references/node-compression-ir.schema.json`: grouped-candidate and repeated-template schema.
- `references/platform-neutral-semantic-ui-ir.schema.json`: platform-neutral semantic node-tree schema.
- `references/semantic-ui-ir.schema.json`: Semantic UI IR schema.
- `references/uikit-layout-ir.schema.json`: UIKit Layout IR schema.
- `references/vision-to-semantic-ir.md`: prompt template for image-to-semantic IR.
- `references/semantic-ir-to-uikit-ir.md`: prompt template for semantic-to-UIKit IR.
- `examples/ai-image-home.semantic.json`: example Semantic UI IR.
- `examples/ai-image-home.uikit.json`: example UIKit Layout IR.
- `scripts/cleanup_artifacts.js`: dependency-free cleanup utility with dry-run default.
- `scripts/validate_pipeline.js`: dependency-free cross-artifact pipeline validator.
- `scripts/capture_web_screenshot.js`: Playwright-based web runtime screenshot capture.
- `scripts/run_ios_simulator_review.js`: iOS Simulator build/install/launch/screenshot workflow.
- `scripts/run_android_emulator_review.js`: Android emulator build/install/launch/screenshot workflow.
- `scripts/compare_screenshots.js`: dependency-free screenshot comparison using BMP input or macOS `sips` conversion.
- `scripts/validate_ir.js`: dependency-free local validator.
- `scripts/ui_design_to_code_mcp_server.js`: dependency-free MCP stdio server for shared source ingestion, validation, and cleanup.

Read only the resource needed for the current step. For code generation tasks, read the selected adapter contract and relevant schemas before writing target code.

## Validation

Run the cross-artifact validator before accepting any full pipeline output:

```bash
node <skill-dir>/scripts/validate_pipeline.js \
  --run path/to/run
```

Run the bundled legacy validator before generating or accepting UIKit code:

```bash
node <skill-dir>/scripts/validate_ir.js \
  --semantic path/to/page.semantic.json \
  --uikit path/to/page.uikit.json \
  --contract <skill-dir>/references/uikit-mapping-contract.json
```

If no paths are provided, the script validates the bundled examples.
