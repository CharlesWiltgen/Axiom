---
name: axiom-uikit
description: Use when bridging UIKit and SwiftUI, debugging Auto Layout constraints, working with Combine, TextKit, or UIKit animations.
license: MIT
---

# UIKit & Bridging

**You MUST use this skill for ANY UIKit bridging, Auto Layout, Combine, TextKit, or UIKit animation work.**

## Quick Reference

| Symptom / Task | Reference |
|----------------|-----------|
| UIViewRepresentable, UIViewControllerRepresentable | See `references/uikit-bridging.md` |
| Embedding SwiftUI in UIKit (UIHostingController) | See `references/uikit-bridging.md` |
| Coordinator pattern, updateUIView lifecycle | See `references/uikit-bridging.md` |
| "Unable to simultaneously satisfy constraints" | See `references/auto-layout-debugging.md` |
| Constraint conflicts, ambiguous layout | See `references/auto-layout-debugging.md` |
| Views not appearing, positioned incorrectly | See `references/auto-layout-debugging.md` |
| CAAnimation completion handler not firing | See `references/uikit-animation-debugging.md` |
| Spring physics wrong on device, duration mismatch | See `references/uikit-animation-debugging.md` |
| Animation jank, CATransaction timing | See `references/uikit-animation-debugging.md` |
| Combine publishers, AnyCancellable lifecycle | See `references/combine-patterns.md` |
| @Published properties, Combine ↔ async/await | See `references/combine-patterns.md` |
| When to use Combine vs async/await | See `references/combine-patterns.md` |
| TextKit 2 architecture, NSTextLayoutManager | See `references/textkit-ref.md` |
| Writing Tools integration (iOS 26) | See `references/textkit-ref.md` |
| SwiftUI TextEditor, TextKit 1 migration | See `references/textkit-ref.md` |

## Decision Tree

```dot
digraph uikit {
    start [label="UIKit task" shape=ellipse];
    what [label="What do you need?" shape=diamond];

    start -> what;
    what -> "references/uikit-bridging.md" [label="wrap UIKit in SwiftUI\nor SwiftUI in UIKit"];
    what -> "references/auto-layout-debugging.md" [label="constraint errors,\nlayout issues"];
    what -> "references/uikit-animation-debugging.md" [label="CAAnimation bugs,\nspring physics,\ncompletion handlers"];
    what -> "references/combine-patterns.md" [label="publishers, sinks,\n@Published,\nasync/await bridge"];
    what -> "references/textkit-ref.md" [label="text layout,\nWriting Tools,\nTextKit migration"];
}
```

1. UIViewRepresentable / UIViewControllerRepresentable / UIHostingController? → `references/uikit-bridging.md`
2. "Unable to simultaneously satisfy constraints" / layout bugs? → `references/auto-layout-debugging.md`
3. CAAnimation completion missing / spring physics wrong / animation jank? → `references/uikit-animation-debugging.md`
4. Combine publishers / AnyCancellable / @Published / Combine ↔ async bridge? → `references/combine-patterns.md`
5. TextKit 2 / Writing Tools / TextEditor / TextKit 1 migration? → `references/textkit-ref.md`
6. Pure SwiftUI view question (no UIKit bridging)? → `/skill axiom-swiftui`
7. Block retain cycles in UIKit callbacks? → See axiom-performance (`references/objc-block-retain-cycles.md`)
8. Memory leaks from Combine subscriptions? → Start with `references/combine-patterns.md`, then axiom-performance if leak persists

## Conflict Resolution

**uikit vs swiftui**: When working with UI code:
- **Use uikit** when wrapping UIKit in SwiftUI or vice versa, or debugging UIKit-specific issues (Auto Layout, CAAnimation)
- **Use swiftui** for pure SwiftUI views, navigation, layout, animations

**uikit vs concurrency**: When Combine interacts with async/await:
- **Use uikit** (`references/combine-patterns.md`) for bridging Combine pipelines with async/await
- **Use concurrency** for pure async/await patterns, actors, Sendable

**uikit vs performance**: When animations or layout cause performance issues:
1. **Try uikit FIRST** — Most animation jank is CATransaction timing or layer state, not a profiling issue
2. **Only use performance** if animation logic is correct but rendering is slow

**uikit vs ios-data**: When @Published properties relate to data persistence:
- **Use uikit** for Combine publisher patterns and @Published lifecycle
- **Use ios-data** for SwiftData/Core Data model layer concerns

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just use UIHostingController, it's simple" | Hosting has sizing, lifecycle, and navigation edge cases. `references/uikit-bridging.md` covers the gotchas. |
| "Auto Layout error is just a warning, I'll ignore it" | Unsatisfied constraints cause unpredictable layout at runtime. Fix them now. |
| "I know how CAAnimation works" | 90% of CAAnimation bugs are CATransaction timing, not Core Animation. Check `references/uikit-animation-debugging.md`. |
| "Combine is dead, just rewrite with async/await" | Combine has no deprecation notice. Rewriting working pipelines wastes time. `references/combine-patterns.md` covers when to migrate vs maintain. |
| "TextKit 1 still works fine" | TextKit 1 misses Writing Tools integration and has known layout bugs Apple won't fix. See `references/textkit-ref.md`. |
| "I'll store cancellables in a local variable" | Local AnyCancellable deallocates immediately, killing the subscription. |

## Example Invocations

User: "How do I wrap a UIKit view in SwiftUI?"
→ Read: `references/uikit-bridging.md`

User: "I'm getting 'Unable to simultaneously satisfy constraints'"
→ Read: `references/auto-layout-debugging.md`

User: "My CAAnimation completion handler never fires"
→ Read: `references/uikit-animation-debugging.md`

User: "Should I use Combine or async/await for this?"
→ Read: `references/combine-patterns.md`

User: "How do I integrate Writing Tools with my text editor?"
→ Read: `references/textkit-ref.md`

User: "My SwiftUI view has a memory leak from a Combine subscription"
→ Read: `references/combine-patterns.md`

User: "How do I embed SwiftUI in my UIKit app?"
→ Read: `references/uikit-bridging.md`
