# Artifact Lifecycle and Cleanup

## Scope

This workflow controls temporary and final outputs produced by UI design image
decoding, node-tree construction, platform conversion, runtime review, and patch
loops.

The goal is to keep traceability without allowing intermediate files, crops,
debug screenshots, and repeated IR revisions to accumulate indefinitely.

## Run Directory

Every execution must create one run directory before producing artifacts.

Default workspace location:

```text
generated/ui-design-to-code/<YYYYMMDD-HHMMSS>-<slug>/
```

Temporary fallback:

```text
/private/tmp/ui-design-to-code/<YYYYMMDD-HHMMSS>-<slug>/
```

Use `/private/tmp` when the user only needs analysis, when the repo should not be
modified, or when artifacts are large debug outputs.

## Required Layout

```text
<run>/
  artifact-run-manifest.json
  source/
  vision/
  compression/
  semantic/
  cross-platform/
  targets/
    ios-uikit/
    ios-swiftui/
    web-react/
    web-next/
    android-compose/
    android-view/
  review/
  final/
  debug/
```

Create only the folders needed for the current task.

## Artifact Categories

- `source`: original or copied source inputs and source manifests.
- `intermediate`: Vision IR, Node Compression IR, Semantic UI IR,
  Cross-platform Node Data, Target Layout IR, and conversion plans.
- `review`: screenshots, diffs, runtime check logs, validation summaries.
- `debug`: crops, OCR dumps, raw detector output, failed attempts, discarded
  patches.
- `final`: user-requested deliverables, final code patches, final IR package, or
  compact evidence bundle.

## Retention Defaults

- `final`: keep unless the user asks to delete.
- `source`: keep only if copied into the run and needed for reproducibility.
- `intermediate`: 7 days.
- `review`: 7 days.
- `debug`: 24 hours.
- temporary `/private/tmp` runs: 24 hours unless marked final.

If an artifact contains a large bitmap, video, or repeated screenshot, prefer
`debug` or `review`, not `final`.

## Cleanup Rules

Before ending a task:

1. Update `artifact-run-manifest.json`.
2. Mark every artifact as `final`, `keep`, `cleanup_eligible`, or `deleted`.
3. Move user-requested deliverables into `final/`.
4. Keep compact evidence summaries instead of full debug dumps when possible.
5. Run cleanup in dry-run mode for workspace outputs.
6. Apply cleanup automatically only for `/private/tmp` outputs or when the user
   explicitly requested cleanup.

Never delete user source files. Cleanup may delete only files listed in the run
manifest and inside the run directory.

## Cleanup Script

Dry run:

```bash
node <skill-dir>/scripts/cleanup_artifacts.js \
  --run generated/ui-design-to-code/<run-id>
```

Apply deletion:

```bash
node <skill-dir>/scripts/cleanup_artifacts.js \
  --run generated/ui-design-to-code/<run-id> \
  --apply
```

The script deletes only artifacts listed in `artifact-run-manifest.json` with
`cleanupStatus: "cleanup_eligible"` and never follows paths outside the run
directory.

Size accounting:

```bash
node <skill-dir>/scripts/cleanup_artifacts.js \
  --run generated/ui-design-to-code/<run-id> \
  --max-debug-bytes 10485760 \
  --max-review-bytes 52428800
```

Full pipeline validation with size writeback:

```bash
node <skill-dir>/scripts/validate_pipeline.js \
  --run generated/ui-design-to-code/<run-id> \
  --write-sizes
```

## Self-audit

Before final response:

1. Is every generated file listed in the manifest?
2. Are large debug files outside `final/`?
3. Are final deliverables clearly marked?
4. Did any artifact get written outside the run directory?
5. Is cleanup status recorded for every intermediate/debug/review file?
6. Was cleanup dry-run reported when workspace files remain?
