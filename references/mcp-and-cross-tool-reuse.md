# MCP and Cross-tool Reuse

## Goal

`ui-design-to-code` should be reusable from Codex, Cursor, Claude Code, or any
MCP-capable client without copying the workflow into each tool.

The reusable boundary is the MCP server. Agent-specific skills or rule files
should only route intent, choose a mode, and call the same MCP tools.

## Input Sources

The source adapter layer supports three source shapes:

- `image`: a screenshot, UI preview image, or exported bitmap.
- `figma`: Figma MCP node JSON without a screenshot.
- `hybrid`: Figma MCP node JSON plus a Figma screenshot/export.

Hybrid is preferred when available. Figma nodes provide structure, naming,
components, text, styles, and layout metadata. The screenshot provides pixel
truth for visual review and for effects that are hard to infer from structure
alone.

If only Figma JSON is available, visual screenshot diff is unavailable until a
screenshot or runtime baseline is provided. If only a screenshot is available,
the existing image-decoding workflow remains valid.

## Standard Artifacts

- `design-source-manifest.json`: source kind, input paths, and coordinate-space
  contracts.
- `figma-source-dataset.json`: normalized Figma node dataset when Figma input is
  available.
- Existing image artifacts remain valid: Source Image Manifest, Vision IR, Node
  Compression IR, Semantic UI IR, Cross-platform Node Data, target IR, code, and
  review results.

## Coordinate Systems

- `source_pixel`: top-left origin, `px`, used by screenshots and runtime visual
  diff.
- `figma_canvas`: top-left origin, `figma_px`, used by Figma node bounds.
- `logical`: `pt`, `dp`, `cssPx`, or `unknown`, used by platform adapters.
- `figmaToSourcePixel`: scale and offset mapping used only when both Figma
  bounds and screenshot pixels are available.

## MCP Tools

The bundled server is dependency-free and runs over stdio:

```bash
node /Users/wuyb/.codex/skills/ui-design-to-code/scripts/ui_design_to_code_mcp_server.js
```

Expected tools:

- `get_run_modes`: return canonical mode options, target platforms, and trigger
  examples. Call this before `create_design_run` when the user did not
  explicitly name a mode.
- `create_design_run`: create a run directory and manifest.
- `ingest_image_source`: write Design Source Manifest and Source Image Manifest
  for image input.
- `ingest_figma_source`: write Design Source Manifest and Figma Source Dataset
  for Figma or hybrid input.
- `build_semantic_ir`: register generated Semantic UI IR or return the schema
  and prompt contract needed to create it.
- `build_cross_platform_nodes`: register generated Cross-platform Node Data or
  return the schema contract needed to create it.
- `build_target_ir`: register target layout IR for a selected platform.
- `run_codegen`: record plain codegen changed files and validation summary.
- `run_codegen_with_auto_review`: record auto-review results and enforce the
  `>= 0.9` non-material similarity delivery gate when a visual review result is
  provided.
- `validate_pipeline`: run the existing cross-artifact validator.
- `cleanup_design_run`: run the cleanup utility in dry-run or apply mode.

The current MCP layer standardizes source ingestion, artifact lifecycle,
artifact registration, validation, and cleanup. Semantic IR generation and code
generation are still agent/model-driven steps that write the existing schemas,
then call the MCP registration and validation tools.

`create_design_run` intentionally requires an explicit mode. This prevents an
MCP client from skipping the user-facing mode gate and silently defaulting to
`decode-only`.

## Figma MCP Integration

When a task starts from Figma, run the Figma MCP source step first, then feed the
result into this shared pipeline:

1. Fetch Figma node JSON through Figma MCP.
2. Fetch a screenshot/export for the same frame when visual fidelity or
   auto-review will be needed.
3. Call `get_run_modes` unless the user already specified one of the six modes.
4. After mode selection, call `create_design_run`.
5. Call `ingest_figma_source` with `nodeJson` or `nodeJsonPath`; include
   `screenshotPath` for hybrid input.
6. Continue through the same Semantic IR, Cross-platform Node Data, target IR,
   codegen, and review artifacts.

There is no separate Figma downstream workflow. Figma is only a source adapter.

## Client Setup

Codex should keep using the `ui-design-to-code` skill as the natural-language
router. The skill calls the MCP tools when an MCP client is available, or falls
back to the bundled scripts directly.

Cursor and Claude Code should register the same server command in their MCP
configuration and use a short rule: "For UI screenshot, Figma design, or design
to code tasks, call the ui-design-to-code MCP server, select a run mode, ingest
sources, then continue through the shared artifacts."
