# Visual Implementation Review

## Goal

The final purpose of this workflow is not only to generate structurally correct
code. It is to recreate the provided UI image as closely as practical on the
target platform using maintainable code and explicit assets.

## Required Review Artifacts

For `codegen-with-auto-review` mode, every target implementation must produce:

- `visual-review-plan.json`
- runtime screenshot(s)
- screenshot comparison result(s)
- `visual-review-result.json`
- cleanup status in `artifact-run-manifest.json`

If runtime screenshot capture is blocked, mark the visual review result as
`blocked` and report the exact missing prerequisite.

For plain `codegen` mode, these artifacts are optional. Keep `codegen` limited
to target code generation, normal project validation, and cleanup unless the
user explicitly selects `codegen-with-auto-review`.

## Fidelity Rules

- Do not replace a whole screen with one full-screen bitmap unless the user
  explicitly requests that.
- Complex media, photos, generated illustrations, and device mockup frames may
  be assets.
- Material regions such as photos, generated media, video thumbnails,
  illustrations, external assets, and device frames may be excluded from the
  similarity score only when the Visual Review Plan lists them as
  `materialExclusions` with source-image coordinates.
- UI chrome, cards, buttons, tabs, text, progress, badges, forms, and repeated
  cells should be code/native components.
- Visual review must include at least the content state. Include loading, empty,
  error, disabled, selected, and focused states when the generated UI supports
  them.
- Non-material UI similarity must be at least 90% before delivery in
  `codegen-with-auto-review`.

## Web Review

Use `capture_web_screenshot.js` for local web targets when Playwright is
available.

```bash
node <skill-dir>/scripts/capture_web_screenshot.js \
  --url http://localhost:3000 \
  --out review/web/home.png \
  --width 390 \
  --height 844 \
  --mobile
```

Then compare:

```bash
node <skill-dir>/scripts/compare_screenshots.js \
  --expected source/home.png \
  --actual review/web/home.png \
  --diff review/web/home.diff.ppm \
  --min-similarity 0.9 \
  --max-mean-channel-delta 12
```

When excluding material regions:

```bash
node <skill-dir>/scripts/compare_screenshots.js \
  --expected source/home.png \
  --actual review/web/home.png \
  --diff review/web/home.diff.ppm \
  --json review/web/visual-review-result.json \
  --min-similarity 0.9 \
  --ignore-rects-file review/material-exclusions.json
```

## iOS Review

Use `run_ios_simulator_review.js` when an iOS project can be built and launched
in Simulator.

```bash
node <skill-dir>/scripts/run_ios_simulator_review.js \
  --project App.xcodeproj \
  --scheme App \
  --configuration Debug \
  --derived-data /private/tmp/AppDerivedData \
  --app /path/to/App.app \
  --bundle-id com.example.App \
  --screenshot review/ios/content.png \
  --result-json review/ios/visual-review-result.json
```

Typical flow:

1. Build with `xcodebuild`.
2. Wait for a booted simulator through `xcrun simctl bootstatus booted -b`.
3. Install `.app`.
4. Launch bundle ID.
5. Capture screenshot.
6. Run `compare_screenshots.js`.

If no simulator is booted, boot one before running the script or provide a
project-specific simulator workflow.

## Android Review

Use `run_android_emulator_review.js` when an Android project can be built and
launched in an emulator.

```bash
node <skill-dir>/scripts/run_android_emulator_review.js \
  --project-dir . \
  --build-task assembleDebug \
  --apk app/build/outputs/apk/debug/app-debug.apk \
  --package com.example.app \
  --activity .MainActivity \
  --screenshot review/android/content.png \
  --result-json review/android/visual-review-result.json
```

Typical flow:

1. Build with Gradle.
2. Start or wait for emulator.
3. Install APK.
4. Launch package/activity.
5. Capture screenshot through `adb exec-out screencap -p`.
6. Run `compare_screenshots.js`.

If no emulator exists, pass `--avd <name>` or start one outside the script.

## Patch Loop

Use this order when visual review fails:

1. Fix viewport, crop, safe area, and root scale mismatch.
2. Fix layout geometry: x/y, width/height, gaps, padding, fixed regions.
3. Fix typography: font size, weight, line height, wrapping, truncation.
4. Fix visual styling: colors, radius, border, shadow, opacity, blur.
5. Fix media crop and asset strategy.
6. Fix state-specific rendering.
7. Only then consider bitmap fallback for a component.

Stop after three failed patch iterations and report remaining mismatch with
diff evidence.

Do not mark `codegen-with-auto-review` as delivered when runtime capture is
blocked or the final non-material similarity is below 90%.
