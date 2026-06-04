# UI Preview Decoding and UIKit Workflow

## Goal

Create traceable design-image decoding artifacts and a platform-neutral UI node tree from an app UI preview image. When requested, continue from that node tree into maintainable UIKit + SnapKit code while preserving layout intent, interaction semantics, reusable components, and reviewability.

The system must optimize for implementation quality, not screenshot-only similarity. Visual match is one signal; functional behavior and maintainable structure are required.

## Execution Flow

1. Image intake and Source Image Manifest
   - Input: preview image, target device, page name, optional product notes.
   - Required metadata: source image path, source image pixel size, known viewport if any, and coordinate-space assumptions.
   - Default coordinate system: source-image pixels with top-left origin.

2. Vision IR
   - Extract raw visual elements: text, icons, shapes, images, backgrounds, color samples, shadows, dividers, and bounding boxes.
   - Keep raw confidence scores.
   - Keep text, icons, shell shapes, effects, image regions, and spacing samples as separate primitives.
   - Do not map raw nodes to any platform widget.

3. Node compression
   - Merge visual primitives into grouped candidates.
   - Examples: button background + label + icon -> `button_candidate`; card background + title + metadata + thumbnail -> `card_candidate`.
   - Detect repeated patterns and convert them into templates.
   - Preserve primitive IDs, grouped candidate IDs, slot candidates, grouping evidence, confidence, alternatives, and uncertainties.

4. Platform-neutral Semantic UI IR
   - Classify compressed candidates into product semantics such as `primary_cta`, `prompt_input`, `option_selector`, `content_card`, `vertical_list`, `tab_bar`.
   - Every semantic node must include confidence.
   - Any node below the review threshold must include alternatives.
   - Keep source group IDs and bbox data so later platform adapters can run without re-reading the image.
   - Do not use platform class names in this artifact.

5. UIKit mapping, only when UIKit implementation is requested
   - Resolve every semantic node through `contracts/uikit-mapping-contract.json`.
   - Mapping priority: project component, UIKit native control, generated reusable component, page-private view, bitmap fallback.
   - The mapper must record why a preferred or fallback mapping was selected.

6. UIKit Layout IR
   - Build UIKit hierarchy, layout containers, fixed regions, scroll containers, cell templates, state containers, events, and data model stubs.
   - Use design tokens for spacing, radius, colors, type, and standard sizes.
   - Avoid magic numbers except measured constants that are explicitly marked as temporary.
   - Carry forward measured detail geometry into `layoutSpec` and `visualSpec` for every component.

7. Swift generation
   - Default stack: UIKit + SnapKit, no Storyboard.
   - Generated files: ViewController, root View, reusable subviews, cells, ViewModel stub, view state, mock data, and token references.
   - User input must include validation, error UI, empty value handling, and keyboard behavior.

8. Runtime review, only when selected mode is `codegen-with-auto-review` or
   `runtime-review`
   - Build and launch on browser, simulator, or emulator.
   - Capture screenshot and compare against source preview.
   - Review layout behavior, interaction states, dynamic text, dark mode,
     empty/error/loading states, and scroll behavior.

9. Patch loop
   - Patches may adjust tokens, constraints, component choices, and localized visual style.
   - Patches must not replace the page with a full bitmap or rewrite the architecture only to improve visual diff.

## Detail Preservation Rules

For screenshot-to-node-tree tasks, the agent must model the following detail groups before any platform mapping:

1. Container shell
   - Outer radius.
   - Visible height mode: fixed, min, or intrinsic.
   - Background, border, and shadow style.
   - Safe area or edge anchoring intent.

2. Internal layout
   - Top, bottom, leading, and trailing content insets.
   - Vertical and horizontal inter-item spacing.
   - Slot order: title, subtitle, badge, media, footer, actions.
   - Alignment anchors: leading, centered, trailing, fill.
   - Slot height allocation: fixed height, min/max height, aspect-ratio-derived height, intrinsic text height, or proportional fill.
   - Slot-to-slot constraints: media-to-title gap, title-to-meta gap, footer reservation, and overlay text bottom inset.

3. Text structure
   - Primary and secondary text style tokens.
   - Max line count per text slot.
   - Truncation intent where visible.
   - Baseline relationship for title/subtitle/meta rows.

4. Button and CTA metrics
   - Touch height must not be inferred from font size alone.
   - Content insets and title/icon gap must be explicit.
   - Corner style must be preserved independently from card radius.
   - Trailing affordance placement must remain part of the component structure.

5. Card and collection metrics
   - Thumbnail or hero media aspect ratio must be explicit.
   - Internal padding must be modeled separately from section spacing.
   - Progress badges, status pills, and footer captions must occupy named slots.
   - Repeated cards must share one template with measured item shell metrics.
   - Repeated cell templates must define both `itemSize` and the internal slot layout for media, text, badge, footer, progress, and affordance slots.

6. Height flattening guard
   - A component with multiple visible slots must not be represented only by an outer height.
   - A fixed card height is valid only when the IR also explains the internal slot allocation that consumes the height.
   - If a later platform generator emits one outer height for a card, cell, input, or CTA, the generated view must also expose named constants or constraints for each visible internal slot.
   - Shared components must accept metric/configuration input for slot sizes instead of baking one global default that all pages inherit.

When confidence is low, keep the detail measurement with an uncertainty note instead of silently replacing it with a default token.

## Acceptance Criteria

- Source Image Manifest, Vision IR, Node Compression IR, and Platform-neutral Semantic UI IR are separate artifacts.
- No raw visual node is mapped directly to platform code without semantic compression.
- Every semantic node traces back to grouped candidate IDs and primitive IDs.
- Every bbox is interpretable through a declared coordinate system.
- Every semantic node resolves through the mapping contract when platform mapping is requested.
- Repeated lists and grids generate cell templates and sample data, not hard-coded duplicate views.
- Fixed bottom CTAs are outside scroll content and anchored to safe area.
- Scroll content accounts for fixed bottom controls with content inset.
- Loading, empty, error, and content states exist for every screen.
- User input nodes include validation, error presentation, boundary handling, and keyboard behavior.
- Generated platform code uses tokens for spacing, radius, type, colors, and standard sizes.
- Every card, button, input, and header keeps explicit radius, padding, spacing, text hierarchy, and height data through Semantic UI IR and UIKit Layout IR.
- Every multi-slot card, hero, prompt input, repeated cell, and CTA keeps explicit `slotMetrics` in Semantic UI IR and `layoutSpec.slotLayout` in UIKit Layout IR.
- Generated Swift does not flatten a section or card into only a page-level height constant; internal slot heights, ratios, min/max constraints, or intrinsic sizing rules must be named and traceable to the IR.
- Layout spacing distinguishes section gaps from component-internal spacing.
- Text line count and truncation behavior are preserved for visible labels and metadata.
- In `codegen` mode, project validation must pass or be explicitly reported as
  blocked with the missing prerequisite. Runtime screenshot comparison is not
  mandatory.
- In `codegen-with-auto-review` mode, functional review must pass and runtime
  screenshot comparison of non-material UI regions must reach at least 90%
  similarity before marking the page done.
