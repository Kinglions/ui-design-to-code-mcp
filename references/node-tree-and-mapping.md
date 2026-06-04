# Node Tree and Platform Mapping

## Core Risk

The biggest failure mode is treating a visual node tree as an engineering node tree. A preview image can expose rectangles, text, icons, gradients, and shadows, but platform implementation needs reusable views, state, data, constraints, and event boundaries.

## Node Construction

Build nodes in four passes:

1. Raw detection
   - Detect visual primitives with bounding boxes, styles, content, and confidence.
   - Preserve noisy measurements, but do not use them directly in code.

2. Visual grouping
   - Group by containment, alignment, shared background, proximity, z-order, and repeated geometry.
   - Convert primitives into grouped candidates such as button, card, input, chip group, list item, toolbar, tab item.

3. Semantic classification
   - Classify grouped candidates into product roles.
   - Examples: `primary_cta`, `prompt_input`, `hero_header`, `horizontal_option_list`, `vertical_list`, `tab_bar`.
   - Store `confidence`, `alternatives`, and `evidence`.

4. Platform-neutral layout intent inference
   - Identify scroll containers, fixed regions, stacks, grids, safe area usage, keyboard-sensitive areas, and repeated templates.
   - Identify detail geometry that must survive mapping: shell radius, internal padding, inter-slot spacing, text style hierarchy, line limits, and visible height.
   - Identify internal height allocation that must survive platform generation: media height/aspect ratio, text block min/intrinsic height, badge height, footer height, CTA height, progress height, and overlay bottom inset.

## Node Compression Rules

- Button primitives compress into one semantic node when a rounded background contains one primary label and optional leading or trailing icon.
- Card primitives compress into one semantic node when child elements share one background, radius, shadow, and internal padding.
- A card candidate is incomplete if it does not preserve named internal slots such as media, title, subtitle, badge, progress, footer, or action affordance.
- A card candidate is invalid for platform generation if it only records the outer bounding box height. Multi-slot cards must also record per-slot height mode and either a measured value, token, ratio, aspect ratio, or intrinsic text rule.
- Repeated cards compress into one `collection_template` or `list_template` when at least two items share geometry and child roles.
- Repeated templates must preserve `itemSize` and `slotMetrics` for the template, not only the collection view height.
- Chip groups compress into `horizontal_option_list` when items are horizontally aligned and share selection styling.
- Tab bars compress into `tab_bar` when items are fixed at the bottom, evenly distributed, and each contains icon/text navigation affordance.
- Decorative shapes remain style metadata unless they are interactive or content-bearing.
- Bitmap fallback is only allowed for decorative imagery, complex illustration, or explicit user-provided assets.

## Platform-neutral Node Tree Rules

- The semantic node tree must not contain platform class names.
- Every semantic node must keep `sourceGroupIds`.
- Every group in Node Compression IR must keep `primitiveIds`.
- Coordinate values must remain interpretable without re-opening the source image.
- Repeated templates must keep sampled instance IDs, item size, slot candidates, and sample data.
- Ambiguous decorative or low-confidence primitives should remain style evidence or uncertainties, not forced content nodes.

## UIKit Mapping Priority

Resolve each semantic node in this order:

1. Project-owned component.
2. UIKit native control.
3. Generated reusable component.
4. Page-private view.
5. Bitmap fallback.

The selected mapping must include a reason. If confidence is low, store alternatives and route the node to review instead of silently generating arbitrary UIKit.

## Contract Rules

Every mapping entry must define:

- `semanticType`
- `preferred`
- `fallbacks`
- `requiredStates`
- `requiredEvents`
- `layoutRules`
- `requiredDetailFields`
- `rejectWhen`

The generator must reject Semantic UI IR when:

- A semantic node has no mapping contract.
- A required state is missing.
- A required event is missing.
- A required detail field is missing.
- A dynamic repeated list is not converted to a template.
- A fixed bottom CTA appears inside scroll content.
- A user input node lacks validation and error behavior.
- A multi-slot semantic node lacks slot-level measurement data.
- A repeated list or rail has an item template without item size and slot-level measurement data.
- A fixed-height card/cell/input/CTA cannot explain how its internal slots consume that height.

## Detail Field Expectations

Each semantic node should preserve two explicit structures:

1. `visualMetrics`
   - Shell geometry such as radius and height.
   - Internal padding and gap measurements.
   - Typography role mapping for visible text.

2. `contentStructure`
   - Layout pattern such as stack, split, overlay, list, grid, button, or input.
   - Named slots in visual order.
   - Slot alignment and line-count limits when applicable.

3. `slotMetrics`
   - One entry per visible slot in `contentStructure.slots`.
   - Each entry must define `height.mode`: `fixed`, `min`, `max`, `intrinsic`, `ratio`, `aspectRatio`, or `fill`.
   - Fixed/min/max entries must include a numeric value or token.
   - Text slots must include line height or typography token plus max lines.
   - Media slots must include aspect ratio or explicit crop height.
   - Progress, badges, pills, and buttons must include explicit height and alignment.

The UIKit mapper should translate these into component-level `layoutSpec`, `layoutSpec.slotLayout`, and `visualSpec`, not re-derive them from the screenshot during Swift generation.

## Swift Generation Guardrails

- Do not emit only `make.height.equalTo(...)` for a multi-slot component.
- Each generated reusable view or cell must expose a local `Metrics` structure containing shell height, content insets, inter-slot gaps, and slot heights/ratios.
- Page-level constants may define section spacing and component placement, but internal media/text/footer/button heights must live with the component or cell that owns them.
- Shared preview components must accept metric configuration when page screenshots show different internal proportions.
