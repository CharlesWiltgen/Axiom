---
name: swiftui-previews
description: Discipline for building good SwiftUI previews — five performance rules, environment-object setup patterns, variant matrix discipline, when not to preview
skill_type: discipline
version: 1.0.0
---

# SwiftUI Previews

Discipline for building good SwiftUI previews. Covers the previewability principle, five performance rules that turn slow previews fast, environment-object setup patterns, variant matrix discipline for design-system components, and when previews are the wrong tool.

This page covers *building* previews. For preview *crashes*, see [swiftui-debugging](/skills/ui-design/swiftui-debugging).

## When to Use

Use this skill when:

- Building, organizing, or speeding up previews for a SwiftUI app
- Previews take 20+ seconds to load and you don't know why
- Designing a design-system component that needs a variant matrix
- Setting up environment objects, model containers, or mock data for previews
- Deciding whether a complex view is worth previewing at all

**Core principle**: If a view is hard to preview, the view is wrong, not previews. A view that needs a network client, an auth session, an analytics SDK, and three environment objects before it renders has revealed a design problem the simulator was hiding.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My SwiftUI previews take 30 seconds to load. How do I speed them up?"
- "How do I preview a view that takes an `@Environment(AppModel.self)`?"
- "I want to preview every variant of my button (light, dark, largest Dynamic Type, RTL, disabled). What's the right pattern?"
- "How do I use `@State` in a preview without writing a wrapper view?"
- "Should I even bother previewing this view, or just use the simulator?"
- "Why is my preview hitting production analytics?"
- "How do I share expensive setup across multiple previews?"

## What This Skill Provides

### The Previewability Principle

A view that can't be previewed in 5 lines is over-coupled. The fix is to refactor the view, not to write a 50-line preview. Authority cite: Apple's WWDC 2023-10252 framing — "Previews are kind of like the scenes that you define at the top level of your app."

### The Five Performance Rules

Loss-framed for impact. A 20-second preview compile hit 40 times a day costs ~55 hours/year per developer.

1. **Isolate UI in a Swift Package** – Single biggest win. Move views to a local Swift Package with only `SwiftUI` and `Foundation` as deps. Preview compiles drop from 20+ to 2–3 seconds.
2. **Use `PreviewModifier` for shared expensive setup** – Apple's official answer (Xcode 16+, iOS 18+, macOS 15+) for expensive shared state across previews via `makeSharedContext()`.
3. **Pin the parent preview** – Canvas pin button locks the canvas to a meaningful preview while you edit children.
4. **Disable auto-refresh for large views** – Editor → Canvas → Automatically Refresh Canvas off; trigger with ⌥⌘P.
5. **Skip SDK init in preview builds** – Guard `FirebaseApp.configure()` and similar with `ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"]`.

### Environment Setup Patterns

Six patterns matched to use case:

- **Pattern A** – Plain `.sample` data on the model for leaf views
- **Pattern B** – `@Previewable @State` for inline state (Xcode 16+)
- **Pattern C** – Single-preview `.environment()` injection
- **Pattern D** – `PreviewModifier` for repeated expensive setup
- **Pattern E** – SwiftData in-memory `ModelContainer`
- **Pattern F** – Side-by-side composition with `Group` for semantic-state comparisons

### Variant Matrix Discipline

For design-system components: light + dark, all Dynamic Type sizes, LTR + RTL, semantic states (default, disabled, loading, error). Variant Mode handles color scheme + Dynamic Type automatically (Apple-confirmed dimensions); RTL and semantic states need explicit code via `.environment(\.layoutDirection, .rightToLeft)` and a VStack-based preview respectively.

### When NOT to Use Previews

Boundary table: NavigationStack roots, real network responses, CALayer/Metal/camera feeds, real permissions, real animation timing, App root scenes. The simulator (with hot-reload and debug deep links) is faster for these.

## Documentation Scope

This page documents the `axiom-swiftui--previews` skill — discipline for *building* good previews. The complementary [swiftui-previews-ref](/reference/swiftui-previews-ref) reference page documents the API surface (`#Preview`, `@Previewable`, `PreviewModifier`, traits, canvas modes).

**For preview crashes:** Use [swiftui-debugging](/skills/ui-design/swiftui-debugging) when previews won't load, crash on launch, or show "Cannot find in scope" errors.

**For runtime performance:** Use [swiftui-performance](/skills/ui-design/swiftui-performance) — runtime jank and preview slowness are different problems with different fixes.

**For variant audits:** Use the [accessibility diagnostic](/diagnostic/accessibility-diag) to know *what to look for* in Dynamic Type and RTL variants.

## Related

- [swiftui-previews-ref](/reference/swiftui-previews-ref) – Complete API reference for `#Preview`, `@Previewable`, `PreviewModifier`, traits, and canvas features
- [swiftui-debugging](/skills/ui-design/swiftui-debugging) – Diagnostic decision tree for preview crashes (different problem from slow previews)
- [swiftui-performance](/skills/ui-design/swiftui-performance) – Runtime performance with the SwiftUI Instrument (not preview perf)
- [swiftui-architecture](/skills/ui-design/swiftui-architecture) – The previewability principle is the same architectural discipline (views render, models coordinate)

## Resources

**WWDC**: 2023-10252 (Build programmatic UI with Xcode Previews), 2024-10144 (What's new in SwiftUI — `@Previewable`), 2020-10185 (Structure your app for SwiftUI previews)

**Docs**: /xcode/previewing-your-apps-interface-in-xcode, /swiftui/previewmodifier, /swiftui/previewable()
