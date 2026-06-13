---
name: audit-swiftui-layout
description: Scan SwiftUI layouts for GeometryReader misuse, deprecated screen APIs, hardcoded breakpoints, identity loss
---

# audit-swiftui-layout

Scan SwiftUI layout code for patterns that break across device sizes or cause unexpected re-layouts.

## What This Command Does

Launches the **swiftui-layout-auditor** agent to flag layout patterns that look fine on the developer's simulator but break on iPad, landscape, Dynamic Type at maximum, or split-screen multitasking.

## What It Checks

1. **GeometryReader misuse** – using `GeometryReader` where a layout container would suffice, or for sizing decisions that should respond to environment
2. **Deprecated screen APIs** – `UIScreen.main.bounds` and other window-coordinate calls that fail in multi-window contexts
3. **Hardcoded breakpoints** – magic-number widths instead of `horizontalSizeClass` or `ViewThatFits`
4. **Identity loss** – conditional `HStack`/`VStack` swaps that destroy and recreate child views, losing animation continuity
5. **Missing safe-area handling** – fixed insets that don't account for keyboard, Dynamic Island, or external displays

## Related Agent

- [swiftui-layout-auditor](/agents/swiftui-layout-auditor) – The agent that powers this command
- [swiftui-layout-ref](/reference/swiftui-layout-ref) – SwiftUI layout reference
