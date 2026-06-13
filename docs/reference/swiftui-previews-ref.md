---
name: swiftui-previews-ref
description: Reference — Complete SwiftUI preview API guide covering #Preview macro, @Previewable, PreviewModifier, PreviewTrait, canvas modes, Variant Mode, and Development Assets
---

# SwiftUI Previews API Reference

Comprehensive API reference for SwiftUI preview construction in Xcode 26.

## When to Use This Reference

Use this reference when:

- Looking up the exact signature of `#Preview` (basic, named, traits, widget, Live Activity forms)
- Verifying availability — which Xcode/iOS version added `@Previewable` or `PreviewModifier`
- Choosing between `PreviewTrait` values (`.landscapeLeft`, `.sizeThatFitsLayout`, `.fixed`, `.modifier`)
- Understanding what Variant Mode auto-varies vs what needs explicit code
- Setting up Development Assets for preview-only resources
- Debugging "Cannot preview in this file. Failed to launch" in Xcode 26.x

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What's the full signature of `#Preview(_:traits:_:body:)`?"
- "How do I write a `PreviewModifier` for shared expensive setup?"
- "Where can I use `@Previewable` — does it work in UIKit previews?"
- "What's the difference between Live mode, Selectable mode, and Variants mode in the canvas?"
- "How do I preview a widget with a TimelineProvider versus specific entries?"
- "What's the workaround for 'Cannot preview in this file. Failed to launch' in Xcode 26?"

## What's Covered

### `#Preview` Macro Forms

Basic, named, traits-only, widget (`as:` + `timelineProvider:` / `timeline:`), and Live Activity (`as:` + `contentStates:`) variants. Cross-platform (SwiftUI, UIKit, AppKit) shapes.

### `@Previewable` Macro

Inline `DynamicProperty` declarations at root scope of `#Preview` body. Eliminates wrapper-view boilerplate. SwiftUI-only (not UIKit/AppKit). Xcode 16+.

### `PreviewModifier` Protocol

Full protocol shape with `makeSharedContext() async throws -> Context` and `body(content:context:)`. Applied via `traits: .modifier(...)`. Xcode 16+, iOS 18+, macOS 15+.

### `PreviewTrait` Quick Table

Available trait values: `.landscapeLeft`, `.landscapeRight`, `.portrait`, `.portraitUpsideDown`, `.sizeThatFitsLayout`, `.fixed(width:height:)`, `.modifier(_:)`. Decision guide for traits vs canvas Device Settings.

### Canvas Modes

Three modes: Live (default, interactive), Selectable (click element → highlight code), Variants (auto-vary one device setting).

### Variant Mode

Apple-confirmed dimensions (per WWDC 2023-10252 and Apple's `previewing-your-apps-interface-in-xcode` docs): Color Scheme and Dynamic Type. Additional dimensions surfaced by the picker in current Xcode (orientation, layout direction) vary by version — check the canvas dropdown for the live list. How to combine with Device Settings to constrain the matrix.

### Development Assets

Preview-only resources without bundle bloat. Project navigator → target → General → Development Assets. Stripped from App Store builds.

### Known Issues

Xcode 26.x app-target-vs-framework-target preview launch issue, cache corruption fix sequence, `@Previewable`-outside-`#Preview` compile error, `ENABLE_PREVIEWS` deprecation in Xcode 16+ (use `XCODE_RUNNING_FOR_PREVIEWS` instead).

### Migration from `PreviewProvider`

`PreviewProvider` (iOS 13+) remains available but Apple directs new code to `#Preview`. Migration table covers `previewDisplayName` → name argument, `previewLayout` → `.sizeThatFitsLayout` / `.fixed`, `previewDevice` → canvas dropdown. Before/after example included.

## Availability Matrix

| API | Xcode | iOS |
|---|---|---|
| `#Preview` | 15.0+ | 17.0+ |
| `PreviewTrait.landscapeLeft` | 15.0+ | 17.0+ |
| `PreviewTrait.sizeThatFitsLayout` | 15.0+ | 17.0+ |
| Widget `#Preview(as:)` | 15.0+ | 17.0+ |
| `PreviewModifier` protocol | 16.0+ | 18.0+ (macOS 15+) |
| `PreviewTrait.modifier(_:)` | 16.0+ | 18.0+ |
| `@Previewable` macro | 16.0+ | 17.0+ (back-deployed) |

## Documentation Scope

This page documents the `axiom-swiftui--previews-ref` skill — the API surface for SwiftUI previews. The complementary [swiftui-previews](/skills/ui-design/swiftui-previews) skill page covers discipline (performance rules, when not to use, environment patterns).

**For preview crashes:** Use [swiftui-debugging](/skills/ui-design/swiftui-debugging) — the Preview Crashes Decision Tree covers "Cannot find in scope", "Fatal error", and cache corruption.

## Related

- [swiftui-previews](/skills/ui-design/swiftui-previews) – Discipline for building good previews (five performance rules, environment setup, variant matrix)
- [swiftui-debugging](/skills/ui-design/swiftui-debugging) – Preview crash diagnosis (different problem from API usage)
- [swiftui-layout-ref](/reference/swiftui-layout-ref) – Adaptive layout APIs you'll preview against

## Resources

**WWDC**: 2023-10252 (Build programmatic UI with Xcode Previews), 2024-10144 (What's new in SwiftUI — `@Previewable`)

**Docs**: /xcode/previewing-your-apps-interface-in-xcode, /swiftui/preview(_:body:), /swiftui/preview(_:traits:_:body:), /swiftui/previewable(), /swiftui/previewmodifier, /developertoolssupport/previewtrait
