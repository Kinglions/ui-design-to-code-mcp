# Workflow Audit and Optimization Notes

## Current Fixes

### Naming

Issue: `ui2code` is short but not descriptive enough for global usage.

Fix: the primary skill is now `ui-design-to-code`. The old `ui2code` and
`ui2uikit` entries are compatibility routes.

### Artifact Growth

Issue: the previous workflow produced many possible artifacts but did not define
where they should live, how long they should be retained, or how to clean them.

Fix: every run now starts with `artifact-run-manifest.json` and one run
directory. Intermediate, review, debug, and final artifacts have explicit cleanup
status and retention defaults.

### Cross-artifact Traceability

Issue: Vision IR, Node Compression IR, Semantic UI IR, Cross-platform Node Data,
and Platform Conversion Plan existed as separate concepts but did not share a
run-level manifest.

Fix: the run manifest records every generated file and lets cleanup operate only
on files inside the run directory.

### Cleanup Safety

Issue: cleanup without a manifest risks deleting source files or user-owned
outputs.

Fix: `cleanup_artifacts.js` deletes only files listed in
`artifact-run-manifest.json` with `cleanupStatus: "cleanup_eligible"` and only
inside the run directory. Dry-run is the default.

## Implemented Optimizations

### Cross-artifact Validator

`scripts/validate_pipeline.js` validates the manifest, artifact existence,
traceability, conversion-plan node references, adapter semantic type coverage,
and artifact size summary.

### Artifact Size Accounting

`validate_pipeline.js --write-sizes` and `cleanup_artifacts.js` can compute
artifact sizes by category.

### Target Layout IR Schemas

Target layout schemas now exist for SwiftUI, React/Next.js, Compose, and Android
View. UIKit keeps the legacy schema.

### Run Modes

`decode-only`, `plan-only`, `target-ir`, and `codegen` are documented to prevent
unnecessary downstream artifacts.

### Mode Selection Gate

Issue: the natural-language skill required mode selection, but the MCP
`create_design_run` tool previously defaulted to `decode-only` when no mode was
provided. Tool callers could accidentally bypass the user-facing choice.

Fix: `get_run_modes` now exposes the canonical options, triggers, and target
platform list. `create_design_run` requires an explicit mode and requires
targets for `target-ir`, `codegen`, `codegen-with-auto-review`, and
`runtime-review`.

### MCP Protocol Hygiene

Issue: tool-call errors returned JSON-RPC responses with `id: null`, which made
it harder for clients to correlate failures to requests. The server also
reported a hard-coded `serverInfo.version`.

Fix: error responses now preserve the original request id when parsing
succeeded, and `serverInfo.version` is read from `package.json`.

### Revision, Asset, and Capability Policies

Revision management, asset naming/dedupe policy, token map schema, and adapter
capability matrix schema are now documented.

## Remaining Gaps

### Agent/model-generated IR Boundary

The MCP server registers, validates, and tracks artifacts, but it does not
automatically infer Vision IR, Node Compression IR, Semantic UI IR, or generated
platform code from pixels. Those steps are still performed by the calling agent
or model, which must write schema-compliant artifacts and register them with the
MCP tools. This is intentional, but docs and client prompts must not imply the
server alone can fully parse a screenshot into final code.

### Figma MCP Source Dependency

`ingest_figma_source` expects Figma MCP output as JSON or a saved JSON path. It
does not call Figma itself. A client that wants Figma design input must first
run the Figma MCP node/screenshot retrieval step, then pass those outputs into
this MCP as `nodeJson`, `nodeJsonPath`, and optional `screenshotPath`.

### Runtime Review Preconditions

The review scripts can automate browser, iOS Simulator, or Android Emulator
flows only when the target project has a runnable app, launch command, and
capture configuration. `codegen-with-auto-review` must report blocked instead
of deliverable when those runtime prerequisites are missing.

### Cross-artifact Validator

`validate_pipeline.js` is intentionally dependency-free and structural. It does
not yet validate every JSON schema keyword. A future version can add a JSON
Schema engine if dependency policy allows it.

### Artifact Size Accounting

Current size accounting handles manifest-listed files. It does not scan for
unlisted files in the run directory. A future audit mode can report orphaned
files without deleting them.

### Target Layout IR Schemas

The target layout schemas are baseline schemas. They should be tightened after
real codegen usage reveals stable required fields per platform.

### Revision Management

Patch loops can produce repeated IR versions. Future run manifests should record
revision numbers and a supersedes relationship so old failed revisions become
cleanup-eligible automatically.

### Asset Crop Policy

The workflow allows source crops, but does not yet define deduplication hashes or
asset naming rules. Future asset extraction should hash crops and avoid storing
duplicate images across review loops.

## Recommended Defaults

- Use `/private/tmp/ui-design-to-code` for analysis-only runs.
- Use `generated/ui-design-to-code` only when the user needs files in the repo.
- Keep `final/` small and intentional.
- Prefer compact JSON summaries over full debug detector dumps.
- Run cleanup dry-run before final response when workspace artifacts are created.
