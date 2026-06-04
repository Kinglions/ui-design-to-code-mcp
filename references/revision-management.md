# Revision Management

Patch loops and visual reviews can produce many versions of the same artifact.
Every revision must stay inside the run directory and be represented in
`artifact-run-manifest.json`.

## Revision Fields

Artifacts may include:

- `revision`: integer starting at 1.
- `status`: `active`, `superseded`, `final`, or `failed`.
- `supersedes`: artifact ID or list of artifact IDs.
- `reason`: short reason for the revision.

## Rules

- Only one active revision of a given artifact type and target should exist.
- When a new revision replaces an old one, mark the old artifact
  `cleanupStatus: "cleanup_eligible"` unless it is final evidence.
- Failed revisions belong in `debug` or `review`, not `final`.
- Final deliverables must be copied or moved to `final/`.

## Recommended Names

```text
semantic/page.v1.semantic-tree.json
semantic/page.v2.semantic-tree.json
targets/web-react/page.v1.target-layout.json
targets/web-react/page.v2.target-layout.json
review/web-react/page.v2.screenshot.png
final/web-react/page.target-layout.json
```

## Cleanup Implication

Superseded intermediate artifacts should be cleanup-eligible by default.
Superseded review screenshots should be cleanup-eligible unless the user asked
for visual evidence.
