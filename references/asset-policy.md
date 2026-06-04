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
