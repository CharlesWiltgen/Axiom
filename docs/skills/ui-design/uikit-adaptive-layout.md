# UIKit Adaptive Layout

Guidance for building UIKit layouts that adapt to any window size — layout guides, width-conditional constraint sets, self-sizing cells, and compositional layouts that derive column math from their actual container. The construction counterpart to Auto Layout Debugging.

## When to Use

Use this skill when:

- Building a UIKit screen that must work across iPhone, iPad windows, and resizable environments
- Text lines run edge-to-edge and become unreadable in wide windows
- Switching between compact and regular constraint sets on size-class change
- Collection view columns should follow window width, not device model
- Table or collection cells won't self-size
- Measuring a constraint-built view for a popover or content height

## Example Prompts

- "How do I vary my collection view's column count with the window width?"
- "Should my text column use readableContentGuide?"
- "How do I switch constraints when the size class changes?"
- "My table view cells won't self-size — what's missing?"
- "How do I keep content out of the keyboard's way in UIKit?"
- "How do I measure a view built with Auto Layout?"

## What This Skill Provides

- **The guide table** – `safeAreaLayoutGuide`, `layoutMarginsGuide`, `readableContentGuide` (automatic readable width in wide windows), `keyboardLayoutGuide`, and custom `UILayoutGuide` spacers
- **Width-conditional constraint sets** – pre-built compact/regular arrays activated on `registerForTraitChanges`, with the deactivate-before-activate rule
- **Self-sizing cells** – the constraint-chain requirement behind `automaticDimension` and `.estimated(_:)` dimensions
- **Environment-driven compositional layout** – column math from `NSCollectionLayoutEnvironment.container.effectiveContentSize`, the UIKit peer of SwiftUI's adaptive grid
- **`systemLayoutSizeFitting`** – measuring constraint-built views outside a layout pass

## Related

- [Auto Layout Debugging](/skills/debugging/auto-layout-debugging) – when the constraints you built break; this skill is how to build them
- [UIKit Modernization](/skills/ui-design/uikit-modernization) – the geometry ground rules (scene bounds, traits, resizability at iOS 27) these patterns build on
- [SwiftUI Layout](/skills/ui-design/swiftui-layout) – the SwiftUI side of the same adaptivity discipline
