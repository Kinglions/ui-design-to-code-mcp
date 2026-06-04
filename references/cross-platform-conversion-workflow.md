# Cross-platform UI Conversion Workflow

## Scope

This workflow starts after the design image has already been decoded into:

- Source Image Manifest
- Vision IR
- Node Compression IR
- Platform-neutral Semantic UI IR

It converts the platform-neutral semantic tree into adapter-ready node data and
target-platform conversion plans. Platform code generation is optional and must
not happen before the target adapter contract is chosen.

## Pipeline

```text
Platform-neutral Semantic UI IR
  -> Cross-platform Node Data
  -> Platform Conversion Plan
  -> Platform Adapter Contract
  -> Target Layout IR
  -> Target Code
  -> Runtime Review
```

## Cross-platform Node Data

File suffix: `.cross-platform-nodes.json`

Purpose: preserve everything a future iOS, Web, Android, or other platform
adapter needs without re-reading the source image.

Each node is split into stable sections:

- `core`: identity, semantic type, role, hierarchy, states, events.
- `source`: source bbox, source groups, source primitives, confidence.
- `layout`: flow intent, container intent, fixed/scroll/modal/overlay behavior,
  slot layout, responsive constraints, safe-area and keyboard hints.
- `visual`: color, typography, radius, shadow, border, opacity, media crop,
  spacing, density assumptions.
- `interaction`: event model, disabled/loading/error/focused behavior, gesture
  hints, navigation targets.
- `data`: input validation, display model, repeated template model, sample data.
- `accessibility`: role, label, value, hint, focus order, dynamic text behavior.
- `traceability`: semantic node ID, group IDs, primitive IDs, uncertainties.

This artifact may include optional `platformHints`, but those hints must not
replace platform-neutral fields.

## Platform Conversion Plan

File suffix: `.conversion-plan.json`

Purpose: choose target adapters and record conversion decisions before code
generation.

Each target plan must include:

- `target.id`: for example `ios-uikit`, `ios-swiftui`, `web-react`, `web-next`,
  `android-compose`, or `android-view`.
- `language`: Swift, TypeScript, Kotlin, or another target language.
- `uiRuntime`: UIKit, SwiftUI, React, Next.js, Jetpack Compose, Android Views.
- `stateStrategy`: ViewModel, reducer/store, React state, Compose state holder,
  or project-specific strategy.
- `componentMapping`: node ID to target component mapping.
- `layoutMapping`: node ID to target layout strategy.
- `assetPlan`: bitmap assets, icons, media crops, generated placeholders.
- `unsupportedPatterns`: explicit gaps that need human or project decisions.
- `reviewPlan`: build, lint, typecheck, screenshot, simulator/browser/device
  checks.

## Adapter Contract

File suffix: `.adapter-contract.json`

Purpose: define how semantic node types and cross-platform node fields map to a
target platform.

Adapter contracts must specify:

- Supported target runtime and language.
- Mapping priority.
- Semantic type mappings.
- Layout capability mapping.
- State and event mapping.
- Accessibility mapping.
- Asset handling.
- Rejection rules.
- Required review commands or runtime checks.

## Target Adapter Defaults

### iOS UIKit

- Language: Swift.
- Runtime: UIKit.
- Layout: Auto Layout, SnapKit by default.
- Lists: `UICollectionView` or `UITableView`.
- State: ViewModel plus explicit ViewState enum.
- Review: xcodebuild, simulator launch, screenshot comparison.

### iOS SwiftUI

- Language: Swift.
- Runtime: SwiftUI.
- Layout: stacks, scroll views, grids, safe-area modifiers.
- Lists: `List`, `LazyVStack`, `LazyHGrid`, `LazyVGrid`.
- State: observable view model or local state for small screens.
- Review: xcodebuild, previews when available, simulator screenshot comparison.

### Web React

- Language: TypeScript.
- Runtime: React.
- Layout: semantic HTML plus CSS modules, Tailwind, or project system.
- Lists: mapped arrays with stable keys.
- State: local state, reducer, or project store.
- Review: typecheck, lint, browser screenshot comparison, responsive checks.

### Web Next.js

- Language: TypeScript.
- Runtime: Next.js + React.
- Layout: route/page component plus reusable UI components.
- Lists: server/client split must be explicit.
- State: URL state, client state, or server data contract.
- Review: typecheck, lint, dev server, browser screenshot, SEO/accessibility
  checks when applicable.

### Android Compose

- Language: Kotlin.
- Runtime: Jetpack Compose.
- Layout: `Column`, `Row`, `Box`, `LazyColumn`, `LazyRow`, grids.
- State: state holder/ViewModel and immutable UI state.
- Review: Gradle build, Compose preview when possible, emulator screenshot.

### Android View

- Language: Kotlin.
- Runtime: Android Views/XML or programmatic Views.
- Layout: ConstraintLayout/RecyclerView/ViewBinding.
- Lists: RecyclerView adapter and item layout.
- State: ViewModel plus view state.
- Review: Gradle build, emulator screenshot.

## Self-audit

Before code generation:

1. Can every target component be traced to one cross-platform node?
2. Can every cross-platform node be traced to source semantic, group, and
   primitive IDs?
3. Are platform class names absent from Cross-platform Node Data?
4. Are unsupported patterns explicit in the conversion plan?
5. Are target-specific layout decisions recorded before code is generated?
6. Are loading, empty, error, disabled, focused, selected, and content states
   mapped or intentionally rejected?
7. Are accessibility roles and labels mapped for the target runtime?
