# Cocos Creator 3.x Development Rules

This contract applies when the target is `cocos-creator`. It is based on the Cocos Creator 3.8 LTS UI and scripting model. If the project pins another Creator version, inspect the project API and editor settings before generating code.

## Target model

- Generate TypeScript for Cocos Creator 3.x, using `import { _decorator, Component, Node, ... } from "cc"` and ES6 classes.
- Treat the scene as a Node tree with Components. Do not generate DOM, React, UIKit, SwiftUI, Compose, Android View, CSS, or browser event code.
- Start UI from a Canvas and record the design resolution, fit-width/fit-height policy, orientation policy, and safe-area policy in Target Layout IR.
- Use `UITransform` for UI geometry, `Widget` for anchoring/alignment, and `Layout` for stable horizontal/vertical/grid groups. Keep measured slot metrics from the source instead of collapsing a card to one outer height.

## Node and component limits

- A Node is a hierarchy/container. Split shell, Sprite, Label, Button, and other renderable roles into child Nodes.
- Do not put multiple renderable components on one Node. If a design has a background, icon, and text, represent them as separate child Nodes.
- Prefer existing project prefabs/components first, Cocos native UI components second, reusable generated Components third, and page-private Components last.
- Use `Button`, `Toggle`, `EditBox`, `ScrollView`, `PageView`, `ProgressBar`, `Label`, `Sprite`, `Mask`, `SafeArea`, `BlockInputEvents`, `Widget`, and `Layout` only when their Node hierarchy and serialized references are explicit.
- Do not assume a component can resolve a sibling or child reference by name at runtime. Keep serialized `@property` references or project-owned binding code.

## Layout and responsive behavior

- Canvas design resolution is not CSS pixels. Use the existing project design resolution when available; otherwise select one logical baseline per orientation from the primary target device class. Do not select a new baseline from every screenshot.
- Preserve aspect ratio. Never apply independent X/Y scaling, CSS-style stretching, or ExactFit-style distortion to make a screenshot fill the screen.
- Select exactly one proportional adaptation mode per orientation:
  - Portrait HUD/page: default to `Fit Width` (`fit_width`) so horizontal geometry remains stable and extra vertical space is handled by anchors or scrolling.
  - Landscape HUD/page: default to `Fit Height` (`fit_height`) so vertical geometry remains stable and extra horizontal space is handled by anchors or safe margins.
  - Board-game, puzzle-board, or other content that must remain fully visible: use `Show All` (`show_all`) and explicitly accept letterboxing/background bleed.
  - Full-bleed scene/background with no guaranteed visible edge content: `No Border` (`no_border`) is allowed, but controls must still use the safe content area and tolerate crop at the edges.
- Do not enable Fit Width and Fit Height together unless the target explicitly declares `show_all`. Do not use a mode that distorts X and Y independently.
- Keep fixed top controls, bottom navigation, and bottom CTAs outside ScrollView content unless the product explicitly requires them to scroll.
- Use `SafeArea` on the interaction root for notched mobile devices. Background art may bleed beyond the safe area, but controls, text, and touch targets must remain inside it.
- Use `Widget` for edge/center anchoring and `Layout` for repeated groups. Do not position production UI from physical device pixels or add CSS-like breakpoints for every device model.
- Prefer a small set of orientation/aspect-ratio variants over continuous per-device branching. A default review matrix is portrait 19.5:9, landscape 16:9, tablet 4:3, and one extreme aspect ratio; project-specific bands must document their rationale.
- On extreme aspect ratios, preserve the safe content width/height, allow background crop or extra margins according to the selected mode, and move overflow into ScrollView/PageView. Never shrink typography and hit targets solely to fit an unusually narrow or short screen.
- A ScrollView must declare its viewport/view and content Nodes separately. Repeated content belongs under the content Node, normally with Layout.
- Layout and Widget changes may take effect on the next frame. Do not read final positions immediately after changing children, size, or layout settings; schedule post-layout reads or call the documented update API where appropriate.
- Cover portrait, landscape, short-height, safe-area, keyboard/input, loading, empty, error, and content states. Record unsupported states instead of silently inventing behavior.
- Avoid runtime creation of large static UI trees. Prefer scene/prefab authored hierarchy and data-driven reusable item prefabs for lists.

## Interaction and state

- Map taps to Button click events or `Node.EventType` constants. Do not register deprecated string event names or invent DOM pointer APIs.
- Every input needs validation rules, error presentation, boundary values, loading/disabled state, and a keyboard/focus policy appropriate to the target project.
- Keep loading, empty, error, and content nodes explicit. A successful visual match in the content state is not enough to claim the screen is complete.
- Preserve semantic labels and accessibility intent in component metadata and visible Labels. Cocos UI is not an ARIA tree; do not claim web accessibility semantics that the project does not implement.

## Assets and review

- Put generated project assets below `assets/ui-design-to-code/figma/{icons,illustrations,images}` unless the project has an established asset convention.
- Reference imported SpriteFrames or project asset bindings. Never emit base64/data URLs or files outside the Cocos asset pipeline.
- Preserve wrapper bounds, crop mode, anchor, and source-to-runtime mapping for icons and images. Rasterize vectors to PNG by default unless the project has a verified vector pipeline.
- Run the project's Cocos Creator preview/build and capture the actual runtime at the design resolution plus portrait/landscape variants. At minimum review the primary design ratio, 16:9 landscape, 19.5:9 portrait, 4:3 tablet, and one extreme ratio. Use screenshot comparison only when a real captured PNG is available.
- A validated IR is not a runtime acceptance. Check clipping, anchors, safe area, touch hit regions, text overflow, ScrollView behavior, and all required UI states.

## Required Target Layout IR policy

Every `cocos-creator` Target Layout IR must declare:

- `canvasPolicy.designResolution` and `canvasPolicy.orientationPolicy`;
- one `canvasPolicy.adaptationMode` from `fit_width`, `fit_height`, `show_all`, `no_border`, or an explicitly documented `project_policy`;
- `canvasPolicy.safeContentPolicy`, including whether `SafeArea` is used, whether fixed controls stay inside safe content, and whether background art may bleed;
- aspect-ratio variants only when they change layout structure, not merely because the device model changed.

## Official references

- Cocos Creator 3.8 LTS: https://docs.cocos.com/creator/3.8/manual/en/getting-started/attention/
- Multi-resolution adaptation: https://docs.cocos.com/creator/3.7/manual/en/ui-system/components/engine/multi-resolution.html
- Canvas: https://docs.cocos.com/creator/3.8/manual/en/ui-system/components/editor/canvas.html
- Layout: https://docs.cocos.com/creator/3.8/manual/en/ui-system/components/editor/layout.html
- UI API: https://docs.cocos.com/creator/3.8/api/en/ui-readme
- Nodes and Components: https://docs.cocos.com/creator/3.8/manual/en/concepts/scene/node-component.html
- Node events: https://docs.cocos.com/creator/3.8/manual/en/engine/event/event-node.html
