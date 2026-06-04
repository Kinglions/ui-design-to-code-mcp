# Design Image Decoding Workflow

## Scope

This workflow stops before platform mapping. It only decodes a UI design image,
builds a platform-neutral node tree, and preserves the evidence needed for later
iOS, Web, Android, or other platform adapters.

Do not generate platform code from these artifacts. Do not collapse raw visual
evidence into semantic nodes without keeping traceable intermediate IDs.

## Coordinate Systems

Every artifact must declare the coordinate system it uses. Coordinates are
measured in source-image pixels unless the artifact explicitly says otherwise.

### Source Pixel Space

- `origin`: top-left of the source image.
- `x`: horizontal pixels from the left edge.
- `y`: vertical pixels from the top edge.
- `width`: horizontal pixel span.
- `height`: vertical pixel span.
- `rotation`: degrees clockwise around the element center.
- `bounds`: `{ "x": 0, "y": 0, "width": imageWidth, "height": imageHeight }`.

### Normalized Space

Normalized coordinates are optional helper values for cross-size comparison.

- `nx = x / imageWidth`
- `ny = y / imageHeight`
- `nw = width / imageWidth`
- `nh = height / imageHeight`

Normalized values must not replace pixel-space values.

### Logical Design Space

Logical units are inferred only when the image provides enough evidence, such as
a known device frame, Figma export metadata, or a stated target viewport.

- `unit`: `pt`, `dp`, `cssPx`, or `unknown`
- `scaleFromSourcePx`: number
- `confidence`: number from 0 to 1
- `evidence`: why the scale is believed

When scale is uncertain, keep all source-pixel values and mark logical space as
`unknown`.

## Required Artifacts

### 0. Source Image Manifest

File suffix: `.source-manifest.json`

Purpose: capture immutable image facts and the coordinate systems used by all
downstream artifacts.

Minimum fields:

- `source.id`
- `source.path`
- `source.widthPx`
- `source.heightPx`
- `source.colorSpace`
- `source.pixelDensity`
- `coordinateSpaces.sourcePixel`
- `coordinateSpaces.normalized`
- `coordinateSpaces.logical`
- `knownViewport`
- `uncertainties`

### 1. Vision IR

File suffix: `.vision.json`

Purpose: preserve raw visual evidence at the smallest useful implementation
granularity.

Minimum primitive types:

- `text_run`: one visible OCR text run or line-level text segment.
- `icon_candidate`: icon-shaped region, including vector-like or raster-like
  evidence.
- `shape`: rectangle, rounded rectangle, circle, line, divider, or freeform
  shape.
- `image_region`: bitmap/media/photo/illustration area.
- `effect`: shadow, blur, stroke, gradient, opacity, or overlay.
- `color_sample`: sampled color token evidence.
- `spacing_sample`: measured gap between nearby primitives.

Each primitive must include:

- stable `id`
- `type`
- `bbox` in source pixel space
- optional `normalizedBBox`
- `style`
- `content` when readable
- `confidence`
- `uncertainties`

Vision IR is intentionally noisy. It must not decide final component semantics.

### 2. Node Compression IR

File suffix: `.compression.json`

Purpose: group raw primitives into candidate nodes and repeated templates while
keeping full traceability to primitive IDs.

Minimum outputs:

- `spatialRelations`: containment, overlap, alignment, adjacency, z-order, and
  repeated-geometry evidence.
- `groups`: candidate groups such as button, card, input, list item, navigation
  item, media block, toolbar, tab bar, chip, badge, or section.
- `templates`: repeated item templates with sampled instances.
- `unassignedPrimitives`: primitive IDs that were not safely grouped.

Each group must include:

- stable `id`
- `candidateType`
- `primitiveIds`
- `bbox`
- `groupingEvidence`
- `slotCandidates`
- `confidence`
- `alternatives`
- `uncertainties`

Node Compression IR may use product-agnostic component names, but it must not
choose platform widgets.

### 3. Platform-neutral Semantic UI IR

File suffix: `.semantic-tree.json`

Purpose: convert grouped candidates into a product-semantic node tree that later
platform adapters can consume.

Minimum outputs:

- `screen`
- `nodeTree`
- `tokens`
- `states`
- `interactions`
- `validation`
- `dataHints`
- `accessibilityHints`
- `traceability`

Each semantic node must include:

- stable `id`
- `semanticType`
- `role`
- `sourceGroupIds`
- `bbox`
- `layoutIntent`
- `visualMetrics`
- `contentStructure`
- `slotMetrics`
- `states`
- `events`
- `confidence`
- `alternatives`
- `uncertainties`

This IR must remain platform-neutral. Use names such as `primary_cta`,
`content_card`, `media_gallery`, `option_selector`, `input_field`,
`bottom_navigation`, and `modal_surface`. Do not use names such as `UIButton`,
`UIScrollView`, `div`, `RecyclerView`, or `Composable`.

## Minimum Granularity Checklist

Before accepting the artifacts, check whether a smaller useful granularity is
still missing.

Vision IR:

- Text is split by visual line or visible run, not only by whole screen.
- Icons are separate from button/card backgrounds.
- Background shells are separate from shadows, strokes, and overlays.
- Media regions are separate from captions, badges, and controls.
- Spacing is recorded as samples between primitives or groups.

Node Compression IR:

- Every group keeps `primitiveIds`.
- Every card, button, input, list item, and navigation item has named
  `slotCandidates`.
- Repeated items become templates with instance IDs and item-size evidence.
- Ambiguous primitives remain unassigned or carry alternatives.
- Decorative primitives are classified as style evidence, not content nodes.

Semantic UI IR:

- Every semantic node keeps `sourceGroupIds`.
- Multi-slot nodes keep slot-level metrics.
- Repeated content keeps template data and sample data.
- Screen-level loading, empty, error, and content states are present.
- User-input nodes include validation and error-message behavior.
- Accessibility role hints are present even when the final platform is unknown.

## Self-audit Questions

Run this audit after producing the three artifacts:

1. Can any semantic node be traced back to exact primitive IDs?
2. Can every bbox be interpreted without guessing the coordinate space?
3. Did any multi-slot component lose internal slot sizes or ratios?
4. Did any repeated list/grid become hard-coded duplicate nodes?
5. Are decorative shapes kept out of the semantic content tree?
6. Are unresolved ambiguities explicit instead of silently normalized?
7. Can a future platform adapter map the same node tree to iOS, Web, or Android
   without re-reading the image?

If any answer is no, split the artifact into smaller nodes or add missing
measurements before platform mapping.
