# Asset Policy

## Goal

Avoid duplicate crops and uncontrolled image growth while preserving assets that
are required for platform implementation.

## Naming

Use deterministic names:

```text
assets/<sourceNodeId>.<role>.<hash8>.<ext>
```

Examples:

```text
assets/hero_image.media.a1b2c3d4.png
assets/nav_search.icon.09e8d7c6.svg
```

## Dedupe

- Hash every generated crop.
- If two crops have the same hash, keep one file and reference it from multiple
  asset-plan entries.
- Keep hash metadata in the artifact manifest or asset policy artifact.

## Icon Priority

1. System icon.
2. Project icon.
3. Vector rebuild.
4. Bitmap crop.

Bitmap crop is the fallback, not the default, for simple icons.

## Retention

- Final assets used by generated code: `final`.
- Review-only screenshots: `review`, 7-day TTL.
- Failed/duplicate crops: `debug`, 24-hour TTL, cleanup-eligible.

## Platform Notes

- Web: prefer SVG or icon library for simple icons, `object-fit` for media.
- iOS: prefer SF Symbols for common icons, asset catalog for final bitmaps.
- Android: prefer vector drawables or Material Icons, drawable resources for
  final bitmaps.

## Default Sync Locations

- Web React / Next: `public/ui-design-to-code/figma/...`, fallback `src/assets/ui-design-to-code/figma/...`
- iOS UIKit / SwiftUI: first discovered `.xcassets`, fallback `Resources/UIFigmaGenerated/`
- Android Compose / View: `app/src/main/res/drawable/`, fallback first discovered `src/main/res/`

## Figma Wrapper Assets

When a Figma node tree contains a named asset wrapper such as `ic_*`, `icon_*`, `img_*`, `logo_*`, `avatar_*`, or `thumbnail_*`, export the wrapper node itself instead of drilling down to its internal vector child. The wrapper bbox is the implementation contract.

Example: if `ic_vip` is a 20x20 FRAME containing `Star 19` at 17.777x17.777, download `ic_vip` at the target scale. For iOS @3x the PNG must be 60x60, preserving the 20x20 canvas and inner padding.

Every Figma asset plan item must record:

- the exported wrapper node id, name, type, and source bbox;
- the primary inner graphic bbox and relative insets when present;
- sibling text node ids under the same parent;
- a placement rule of `preserve_figma_wrapper_bbox`.

Target code must place the image using the wrapper bbox and parent layout metadata. Do not center or resize the image based on the internal vector bounds unless the wrapper node is absent.

For icons placed next to text, the asset plan must also preserve the sibling
text bbox, wrapper-to-text gap, wrapper centerY versus text bbox centerY, and
inner graphic bbox when available. Do not trim wrapper padding or recenter from
the exported bitmap bounds unless visual review proves that behavior matches
the source.

## Figma Design Notes

During Figma REST ingestion, fetch file comments when a token is available and scan the node tree for annotation/callout/spec labels. Persist these into `figma/figma-design-notes.json`. Codegen and target IR must read this artifact before implementation and treat notes/comments as requirements unless an explicit user instruction overrides them.
