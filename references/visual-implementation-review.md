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
- Treat the source screenshot as one visual baseline viewport. Do not treat its
  exact width, height, margins, or top offsets as production constants unless
  the target product is fixed-size.
- For native app screens, fixed navigation controls, close/back buttons,
  floating actions, tab bars, and bottom CTAs must remain in fixed/safe-area
  containers unless the source explicitly shows them scrolling with content.
- Prefer project-local page margins and design tokens over screenshot-only
  margins when implementing inside an existing product.
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

## Adaptive Layout Review

Visual parity at the source viewport is necessary but not sufficient for
production delivery. For `codegen-with-auto-review`, include adaptive layout
evidence whenever the target platform can run multiple device sizes.

Minimum viewport set:

- Compact mobile: a small/short phone viewport such as 375x667.
- Reference mobile: the source or nearest target viewport.
- Large mobile: a larger phone viewport such as 430x932.
- Landscape or compact-height viewport when the target platform supports it.

Required checks:

- Page-level horizontal padding matches the target app's existing page rhythm or
  a documented design token, not only the screenshot crop.
- Fixed controls stay fixed during scroll and are constrained to safe areas.
- Scroll content remains reachable without overlapping fixed controls.
- Forms keep 44 pt minimum touch targets and avoid the focused field or CTA when
  the keyboard appears.
- Text does not overlap, truncate unexpectedly, or become visually oversized
  when Dynamic Type/accessibility text sizes are enabled.
- Large viewports do not scale every font and control proportionally; they may
  add breathing room or width caps instead.

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

For iOS auth, form, onboarding, checkout, subscription, and creation flows,
capture at least the content state on a compact iPhone and a larger iPhone when
the simulator workflow can boot those devices. Also capture focused input or
keyboard state when possible.

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

Android View custom drawing color check:

- If Android geometry matches the Figma/iOS reference but CTA gradients, icon
  assets, or selected states are globally darker, audit Canvas `Paint` reuse
  before changing design tokens.
- `Paint` is mutable. Reset `alpha`, `shader`, `colorFilter`, `blendMode`, and
  color before each draw group, or use dedicated paints for bitmap icons,
  gradient fills, text, and translucent surfaces.
- `drawBitmap(..., paint)` inherits `paint.alpha`; a previous translucent card
  fill can darken Figma-exported icons even when the PNG itself is correct.
- Gradient fills for primary buttons should use `alpha == 255` unless the
  source Figma layer explicitly has opacity below 100%.

Icon and text alignment review:

- Treat every icon+text pair as a single review unit. Check the icon shape,
  icon wrapper position, visible icon center, text bbox, and gap together.
- Required evidence for each pair: source icon wrapper bbox, inner graphic bbox
  when available, text bbox, horizontal gap, centerY delta, and state variant
  such as default, selected, disabled, or pressed.
- If the icon shape is correct but appears shifted relative to the label, crop
  the pair from the source and runtime screenshot before changing global layout.
- Custom-drawn icons must use the source-derived wrapper center and inner visual
  center. Do not infer icon y from text baseline or font metrics alone.
- Exported Figma icons must preserve wrapper padding. Place the wrapper bbox in
  layout and use centered rendering inside it when the inner vector is smaller
  than the wrapper.
- Do not mark icon rows as visually matched until runtime review confirms icon
  center, text bbox, and wrapper-to-text gap against the source crop.

## Patch Loop

Use this order when visual review fails:

1. Fix viewport, crop, safe area, and root scale mismatch.
2. Fix adaptive behavior: project page margins, fixed regions, safe-area
   anchoring, keyboard avoidance, and compact/large viewport metrics.
3. Fix layout geometry: x/y, width/height, gaps, padding, fixed regions.
4. Fix typography: font size, weight, line height, wrapping, truncation.
5. Fix visual styling: colors, radius, border, shadow, opacity, blur.
6. Fix media crop and asset strategy.
7. Fix state-specific rendering.
8. Only then consider bitmap fallback for a component.

Stop after three failed patch iterations and report remaining mismatch with
diff evidence.

Do not mark `codegen-with-auto-review` as delivered when runtime capture is
blocked or the final non-material similarity is below 90%.
