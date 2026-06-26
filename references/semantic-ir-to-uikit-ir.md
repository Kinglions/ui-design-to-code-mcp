# Prompt: Semantic UI IR to UIKit Layout IR

You are converting Semantic UI IR into UIKit Layout IR.

Use `contracts/uikit-mapping-contract.json` as the source of truth. Do not invent mappings outside the contract unless the node is explicitly marked for review.

## Required Steps

1. Verify every semantic node has a mapping contract.
2. Select the mapping by priority: project component, UIKit native control, generated reusable component, page-private view, bitmap fallback.
3. Record `mappingReason` for every component.
4. Keep fixed navigation, close/back controls, bottom CTAs, tab bars, and floating controls outside scroll content unless the source explicitly makes them scroll away.
5. Add content inset when scroll content coexists with fixed controls.
6. Use `UICollectionView` for dynamic lists, grids, and reusable repeated content.
7. Use `UIStackView` only for stable small static groups.
8. Include screen states: loading, empty, error, content.
9. Include input validation, error presentation, and keyboard handling for user input components.
10. Preserve `visualMetrics` and `contentStructure` by translating them into component `layoutSpec` and `visualSpec`.
11. Preserve Semantic IR `slotMetrics` by translating every slot into `layoutSpec.slotLayout` with height mode, value/token/ratio/aspect ratio, spacing, and a suggested Swift metric constant name.
12. Create `layout.adaptiveLayoutPolicy` for substantial screens. Include source viewport, compact phone, reference phone, large phone, landscape or compact-height viewport, Dynamic Type strategy, keyboard avoidance strategy, fixed-region rules, and named adaptive metrics.
13. Use existing project layout tokens before screenshot-only margins. If target app evidence shows a page inset such as 20 pt, use it unless the design intentionally differs.
14. Use design tokens for layout, type, radius, color, and standard sizes.
15. Do not collapse section spacing, component padding, text spacing, and slot height allocation into one generic gap value.
16. For repeated lists/rails/grids, carry `itemSize` into the UIKit component and keep the cell template's internal `slotLayout`.

## Height Flattening Guard

Reject your own output before returning it when:

- A multi-slot component has `layoutSpec.height` but no `layoutSpec.slotLayout`.
- A repeated list/rail/grid has a collection height but no item size or cell slot layout.
- A fixed-height card/cell/input/CTA cannot explain how media, text, badge, footer, progress, and action slots consume that height.
- Swift generation would only emit page-level height constants without component-owned slot metrics.
- A page with scroll content maps back/close/navigation controls inside the scroll content.
- A nontrivial screen has no adaptive layout policy or only copies the source viewport's absolute margins and top offsets.

## Output

Return JSON matching `references/uikit-layout-ir.schema.json`.
