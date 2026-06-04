# Prompt: Preview Image to Platform-neutral Semantic UI IR

You are converting an app UI preview image into traceable design-decoding artifacts and a platform-neutral Semantic UI IR.

Do not write platform code. Do not output Figma nodes. Do not map raw visual primitives directly to UIKit, SwiftUI, DOM, React, Compose, Android Views, or any other platform widget.

## Coordinate Contract

Use source-image pixel coordinates by default:

- Origin is the top-left corner of the source image.
- `x` grows to the right.
- `y` grows downward.
- `width` and `height` are source pixels.
- Normalized coordinates are optional helpers and must not replace source-pixel values.
- Logical units are optional and must include scale confidence.

## Required Steps

1. Produce Source Image Manifest.
   - Record image dimensions and coordinate spaces.
   - Mark logical unit scale as unknown unless evidence is explicit.
2. Produce Vision IR.
   - Detect raw visual primitives: text runs, icon candidates, shapes, image regions, effects, color samples, spacing samples, and bounding boxes.
   - Preserve noisy measurements, style evidence, primitive confidence, and uncertainties.
   - Keep text, icons, background shells, strokes, shadows, overlays, media, and spacing as separate primitives.
3. Produce Node Compression IR.
   - Compress primitives into grouped candidates: buttons, inputs, cards, list items, tab bars, headers, option selectors, media blocks, sections, and decorative groups.
   - Every group must preserve primitive IDs, grouping evidence, bbox, slot candidates, confidence, alternatives, and uncertainties.
   - Detect repeated cards/lists and output templates with instance IDs, item size, slot candidates, and sample data.
4. Produce Platform-neutral Semantic UI IR.
   - Classify each grouped candidate into a semantic type without platform class names.
   - Infer layout intent: scroll content, fixed regions, overlays, modal surfaces, stacks, grids, safe-area hints, and keyboard-sensitive areas.
   - Capture detail geometry for every visible card, button, input, and header: corner radius, height mode, content insets, inter-item spacing, text style hierarchy, line count, and media aspect ratio where visible.
   - Capture `slotMetrics` for every named slot in every interactive or content-bearing node. Include media height/aspect ratio, text line height and max lines, badge/pill height, footer height, progress height, CTA height, and overlay bottom inset where visible.
   - For repeated lists, rails, and grids, capture the template `itemSize` and the internal slot metrics of the item template. Do not only capture the container height.
   - Normalize measurements into design tokens where useful, but keep the original bbox and semantic meaning of each measurement.
   - Add confidence to every semantic node.
   - Add alternatives for every node with confidence below 0.8.
   - Add loading, empty, error, and content states at screen level.
   - Add validation and error behavior for every user input node.
   - Include `visualMetrics`, `contentStructure`, and `slotMetrics` on every interactive or content-bearing node.

## Height Flattening Guard

Reject your own output before returning it when a card, hero, prompt input, CTA, rail item, or list item has multiple slots but only one outer height. The IR must explain how internal slots consume the component height through fixed values, min/max values, ratios, aspect ratios, fill behavior, or intrinsic text rules.

## Output

Return separate JSON artifacts matching:

- `image-source-manifest.schema.json`
- `vision-ir.schema.json`
- `node-compression-ir.schema.json`
- `platform-neutral-semantic-ui-ir.schema.json`
