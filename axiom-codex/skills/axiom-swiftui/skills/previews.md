
# SwiftUI Previews — Building Good Previews

## Overview

**This skill covers BUILDING previews.** For preview *crashes*, see `skills/debugging.md` Preview Crashes Decision Tree.

The hard problem with SwiftUI previews is not the API — it's **discipline**. Apple gave you `#Preview`, `@Previewable`, `PreviewModifier`, traits, Variant Mode, and Development Assets. None of that helps if your view is too coupled to preview cheaply, or if every preview boots a network stack, or if you ship with auto-refresh fighting a 1,200-line view body.

**Core principle**: *If a view is hard to preview, the view is wrong, not previews.* A view that needs a `NetworkClient`, an authenticated session, an analytics SDK, a feature-flag service, and three environment objects before it renders a button has revealed a design problem the simulator was hiding from you. Previews force the question of what a view actually needs. Answer honestly.

**Requires**: Xcode 15+ / iOS 17+ for `#Preview`. Xcode 16+ / iOS 17+ for `@Previewable`. Xcode 16+ / iOS 18+ for `PreviewModifier`.
**Related skills**: `skills/debugging.md` (preview *crashes* — different problem), `skills/swiftui-performance.md` (runtime perf, not preview perf), `axiom-accessibility` (Variant Mode for Dynamic Type / RTL audits)

## Example Prompts

Real questions this skill is designed to answer:

#### 1. "My previews take 30 seconds to load and I'm losing my mind"
→ Five performance rules below. Rule 1 (Swift Package isolation) is the single biggest win; Rule 4 (auto-refresh off) is free.

#### 2. "How do I preview a view that takes an `@Environment(AppModel.self)`?"
→ Environment setup patterns. For expensive shared state across many previews, use `PreviewModifier` + `makeSharedContext()`.

#### 3. "I want to preview every variant of my button (light/dark/largest Dynamic Type/RTL/disabled)"
→ Variant Mode + the variant matrix discipline section.

#### 4. "How do I use `@State` in a preview without writing a wrapper view?"
→ `@Previewable @State` (Xcode 16+). See `skills/previews-ref.md` for the macro signature.

#### 5. "Should I even bother previewing this view?"
→ The "When NOT to use previews" section. Some views are honestly cheaper in the simulator with hot-reload.

## When to Use This Skill

#### Use this skill when
- ✅ Building, organizing, or speeding up previews for a SwiftUI app
- ✅ Previews are slow and you don't know why
- ✅ Designing a component that needs a variant matrix
- ✅ Setting up environment objects / model containers / mock data for previews
- ✅ Deciding whether to invest in previewability for a complex view

#### Use `skills/debugging.md` instead when
- Preview crashes with "Cannot find X in scope"
- Preview was working, now won't load
- Silent crash with no error

#### Use `skills/swiftui-performance.md` instead when
- Runtime app is janky (not preview)
- Profiling with Instruments
- Long view body updates at runtime

---

## The Previewability Principle

**Authority** (Apple, WWDC 2023-10252): "Previews are kind of like the scenes that you define at the top level of your app. […] You can use the preview to set up data and assets and then pass them into the views you're previewing."

If you can't write a preview that fits in 5 lines, your view is over-coupled. The fix is not to write a 50-line preview — the fix is to refactor the view.

```swift
// ❌ Over-coupled: view needs the whole world
struct ProductDetailView: View {
    @Environment(NetworkClient.self) var network
    @Environment(AuthSession.self) var auth
    @Environment(AnalyticsSDK.self) var analytics
    @Environment(FeatureFlagService.self) var flags
    @Environment(\.modelContext) var modelContext
    let productID: UUID

    var body: some View { /* fetches by productID */ }
}

// Preview is now a research project. You won't write it. The view won't get previewed.
// It will ship broken on iPad. You'll find out in TestFlight.

// ✅ Cohesive: view takes the data it needs
struct ProductDetailView: View {
    let product: Product           // pure value
    let onAddToCart: () -> Void    // pure callback
    var body: some View { /* renders product */ }
}

#Preview {
    ProductDetailView(
        product: .sample,          // a static factory on Product
        onAddToCart: {}
    )
}
```

**The test**: Can you preview this view with `.sample` data and an empty closure? If no, your view is doing fetching/auth/coordination that belongs in a parent or a model layer. Move it out.

**Cross-reference**: This is the same architectural discipline `skills/architecture.md` enforces — views render, models coordinate.

---

## The Five Performance Rules

Slow previews are a tax on every iteration of every view. Skipping these rules costs 10–30 seconds per preview rebuild, dozens of times a day. Loss framing: a 20-second preview compile that you hit 40 times a day costs **13 minutes daily**, ~**55 hours/year** per developer. The rules below are how heavy preview users (per community signal from r/SwiftUI/1ta4qq5, May 2026) survive.

### Rule 1: Isolate UI in a Swift Package — Single Biggest Win

The preview process compiles the smallest module that contains your view. If that module is your app target (with every dependency — Firebase, SDK frameworks, server clients, Swift macros from third-party packages, the whole graph), every preview compile re-builds all of it.

**Fix**: Move your views into a local Swift Package with only `SwiftUI` and `Foundation` as dependencies. Pass models in as plain types.

```
MyApp/
├── MyApp.xcodeproj
└── UIKit-free packages
    └── Features/                       <-- local Swift Package
        ├── Package.swift                  (deps: SwiftUI only)
        └── Sources/
            └── Features/
                ├── ProductDetailView.swift   <-- previewable in seconds
                └── ProductRow.swift
```

When you `#Preview` a view inside the `Features` package, the preview process compiles `Features` — not your whole app. Preview cold start drops from 20+ seconds to 2–3 seconds for most projects.

**Counterargument**: "But my views need my app's models." Then your models should also be in the package (or in a deeper `Models` package the `Features` package depends on). If your models can't be extracted without dragging the universe, you have a bigger architecture problem than slow previews.

### Rule 2: Use `PreviewModifier` for Shared Expensive Setup

If multiple previews need the same expensive object (an `@Observable` model with seeded data, a SwiftData `ModelContainer`, an authenticated session) — set it up ONCE with `PreviewModifier`, not in every `#Preview` body.

**Authority**: This is Apple's official answer for shared preview state (Xcode 16+ / iOS 18+, see `skills/previews-ref.md`).

```swift
struct SampleData: PreviewModifier {
    static func makeSharedContext() async throws -> AppState {
        let state = AppState()
        state.products = Product.previewCatalog   // seeded once
        return state
    }

    func body(content: Content, context: AppState) -> some View {
        content.environment(context)
    }
}

#Preview(traits: .modifier(SampleData())) {
    ProductDetailView(product: .sample, onAddToCart: {})
}

#Preview(traits: .modifier(SampleData())) {
    ProductListView()
}

// makeSharedContext() runs ONCE; both previews share the same AppState.
```

**Without `PreviewModifier`**: every preview rebuilds the AppState from scratch. With it: setup amortizes across every preview using the modifier.

### Rule 3: Pin the Parent Preview When Editing Child Views

When you're iterating on a leaf view (a button, a row), pin the canvas to a meaningful preview — usually the *parent* screen showing the leaf in context. The canvas then stays on that preview while you edit children in other files, instead of re-resolving which preview to show every time you switch files.

**Why it matters**: Without pinning, switching from the child file (where you're editing) to a different file resets the canvas to that file's preview. Pin the meaningful preview once and keep it visible while you edit anything in the same package.

**How**: Use Xcode's canvas pin control after navigating to the preview you want to keep. (Exact icon and placement vary by Xcode version — look for "pin" in the canvas controls.)

### Rule 4: Disable Auto-Refresh for Large Views

Auto-refresh is great for 50-line views. It's a performance fire for 500-line views with 30 components — every keystroke triggers a full re-compile of the preview.

**Fix**: `Editor → Canvas → Automatically Refresh Canvas` → OFF. Trigger manual refresh with **⌥⌘P** (Option-Command-P) when you actually want to see the change.

This is free, takes 5 seconds to toggle, and saves minutes of compile thrashing on every large view.

### Rule 5: Skip Analytics / Network SDK Init in Preview Builds

Apple's preview process is *almost* a real app launch. If your app's `init()` fires up Firebase, Sentry, Mixpanel, RevenueCat, or anything else that establishes a network connection at startup, those will fire in the preview process too — slowly, and against your production keys.

**Fix**: Guard SDK init with the preview environment flag:

```swift
@main
struct MyApp: App {
    init() {
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] != "1" {
            FirebaseApp.configure()
            Sentry.start { /* ... */ }
            Analytics.start()
        }
    }
    // ...
}
```

`XCODE_RUNNING_FOR_PREVIEWS` is set to `"1"` by Xcode whenever your code is running inside the preview agent (`XCPreviewAgent`). It's not formally documented as an API, but it has been the de-facto preview-detection mechanism since previews shipped, and it's stable across Xcode 15–26.

**Why this matters even if you have UI in a package**: if a preview imports anything that transitively pulls in your `App` struct's `init()` (e.g. dependency on a `Core` framework that initializes analytics in a top-level Swift initializer), this guard saves you.

---

## Environment Setup Patterns

Most previews need *something* — a model, a binding, environment data. Match the pattern to the situation.

### Pattern A — One Preview, Plain Sample Data

For a leaf view with no environment dependencies:

```swift
#Preview {
    ProductRow(product: .sample)
}

extension Product {
    static let sample = Product(id: UUID(), name: "Sample", price: 9.99)
}
```

Put the sample on the model as a static. Don't duplicate it in every preview.

### Pattern B — Inline State with `@Previewable`

For previews that need `@State` or `@Binding` (e.g. previewing a `Toggle` or `TextField`):

```swift
#Preview {
    @Previewable @State var isOn = true
    Toggle("Notifications", isOn: $isOn)
}
```

`@Previewable` must be at root scope inside the `#Preview` body. See `skills/previews-ref.md` for the macro details. Pre-Xcode 16 you had to write a wrapper view — that's no longer necessary.

### Pattern C — Single-Preview Environment

For one-off environment injection:

```swift
#Preview {
    let state = AppState()
    state.user = .sample
    return ContentView()
        .environment(state)
}
```

Fine for a single preview. If 3+ previews need the same `AppState`, promote to Pattern D.

### Pattern D — Shared Context with `PreviewModifier`

For expensive or repeated setup (see Rule 2 above):

```swift
struct WithSeededState: PreviewModifier {
    static func makeSharedContext() async throws -> AppState {
        let state = AppState()
        state.user = .sample
        state.products = Product.previewCatalog
        return state
    }

    func body(content: Content, context: AppState) -> some View {
        content.environment(context)
    }
}

#Preview(traits: .modifier(WithSeededState())) {
    DashboardView()
}
```

### Pattern F — Side-by-Side Composition with `Group` / `HStack`

For comparing variants at a glance — useful when Variant Mode doesn't cover the dimension you care about (e.g. semantic state, multiple `Product` shapes):

```swift
#Preview("All states", traits: .sizeThatFitsLayout) {
    Group {
        ProductRow(product: .sample,        state: .available)
        ProductRow(product: .sample,        state: .outOfStock)
        ProductRow(product: .longName,      state: .available)
        ProductRow(product: .veryLongName,  state: .preorder)
    }
    .padding()
}
```

`Group` is transparent in layout (no extra container affordances) and stacks members vertically by default in `#Preview` context. Use `HStack`/`VStack` explicitly when you need to control direction or spacing.

When the dimension you're comparing IS a Variants Mode dimension (Color Scheme, Dynamic Type), prefer Variant Mode over inline composition — Variant Mode renders side-by-side without code maintenance burden.

### Pattern E — SwiftData In-Memory Container

For SwiftData-backed views:

```swift
import SwiftData

#Preview {
    // try! is acceptable here — in-memory container cannot fail. See Scenario 3.
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Product.self, configurations: config)

    let sample = Product(name: "Sample", price: 9.99)
    container.mainContext.insert(sample)

    return ProductListView()
        .modelContainer(container)
}
```

Keep the sample-insertion in the preview body for a single preview, or move it into a `PreviewModifier` if shared. Cross-ref `axiom-data` for SwiftData preview patterns.

---

## Variant Matrix Discipline (Design Systems)

For design-system components (buttons, cards, list rows, badges), one preview is not enough. The component needs to render correctly across:

1. **Light + Dark** color schemes
2. **All Dynamic Type sizes**, especially the accessibility sizes (xxxLarge through AX5)
3. **LTR + RTL** layout direction
4. **All semantic states** (default, hover, selected, disabled, loading, error)

**Use Variant Mode** for color scheme, Dynamic Type, and orientation: Apple wires those automatically (canvas → Variants mode → pick the dimension). One `#Preview` becomes N visual variants.

**Use a single `#Preview` with a `VStack`** for semantic state coverage — state isn't a device setting, so Variant Mode doesn't help:

```swift
#Preview("All states", traits: .sizeThatFitsLayout) {
    VStack(spacing: 12) {
        PrimaryButton(title: "Default", action: {})
        PrimaryButton(title: "Loading", action: {}).disabled(true)
        PrimaryButton(title: "Error",   action: {}).foregroundStyle(.red)
    }
    .padding()
}
```

**Use `.environment(\.layoutDirection, .rightToLeft)`** for RTL spot-checks:

```swift
#Preview("RTL") {
    ProductRow(product: .sample)
        .environment(\.layoutDirection, .rightToLeft)
}
```

**Cross-reference**: For what to *look for* in the variant audits (truncation, contrast, focus order), see `axiom-accessibility` skills (Dynamic Type, RTL audits, color contrast).

---

## When NOT to Use Previews

Previews are not always the right tool. Recognize the boundary:

| View characteristic | Better than preview |
|---|---|
| View is mostly a `NavigationStack` root with deep coordinator state | Simulator + debug deep links (see `axiom-swift/skills/deep-link-debugging.md`) |
| View depends on a *real* network response (not mockable) | Simulator with a staging endpoint |
| View renders a CALayer / Metal / camera feed | Simulator — preview process doesn't render most non-SwiftUI layers reliably |
| View needs real permissions (camera, location, push) | Simulator — preview can't grant entitlements |
| You're testing real animation timing, not layout | Simulator — preview animation is approximate |
| View is the App's root scene | There's nothing to preview — preview the immediate child instead |

**Decision principle**: previews are for the *visual specification* of a leaf or composite view. If what you're testing isn't a visual specification (it's timing, real I/O, real permissions, real performance), the simulator is the right tool. Don't fight the preview process.

---

## Pressure Scenarios

### Scenario 1: "Previews are slow and I'm just going to disable them and use the simulator"

#### Red flags you might think
- "Previews are slow forever, this is a SwiftUI limitation"
- "The simulator is faster anyway, I'll just hot-reload"
- "I don't have time to extract a Swift Package"

**The danger**: You give up the tightest design loop SwiftUI offers. Without previews, variant audits stop happening — you ship broken Dynamic Type and RTL. Designer review cycles double in length.

**What to do instead** (90-minute investment, lifetime payoff):
1. Apply Rule 4 first (Disable auto-refresh — 30 seconds, often halves perceived slowness for large views)
2. Apply Rule 5 (Guard SDK init — 10 minutes, often the actual culprit for "previews take forever")
3. Apply Rule 1 (Extract a Swift Package — 60–90 minutes one-time, then permanently fast)

**Time cost**: 90 min one-time vs. losing the preview workflow forever (lifetime cost of ~55 hours/year/dev — see Rule 1 above).

### Scenario 2: "This component needs 12 previews so I'll just write them inline"

#### Red flags you might think
- "Same setup in every preview is fine, copy-paste is faster than refactoring"
- "I'll write one big preview that shows everything"
- "Variant Mode is too much hassle to learn"

**The danger**: 12 inline previews with duplicated setup means changing your environment object signature breaks 12 places. One big preview means you can't focus on one variant at a time.

**What to do instead** (10 minutes):
1. If shared expensive setup: extract a `PreviewModifier` (5 min — see Rule 2).
2. If a design-system variant matrix: use Variant Mode for color scheme + Dynamic Type, one named `#Preview` per semantic state.
3. Document `.sample` factories on your models so every preview is a one-liner.

### Scenario 3: "I'll just force-unwrap in the preview, it's only for development"

#### Red flags you might think
- "Preview is dev-only, force-unwrap is fine"
- "`try!` is acceptable in `#Preview` because it crashes the preview agent, not the app"
- "If the preview crashes I'll just nuke DerivedData"

**The danger**: You're conditioning yourself to ignore the canary. A preview that crashes is telling you the view's data model has an unsafe path. The same path will crash in production with different data.

**What to do instead**:
- `try!` in a preview is acceptable ONLY for fundamentally infallible setup (in-memory `ModelContainer`, sample data factories). Don't force-unwrap external data — *use sample data*. If you can't get sample data, the model is wrong (see Previewability Principle).
- Apple's official guidance: "Pass views only the data they need" (Apple, "Previewing your app's interface in Xcode"). If your preview needs to unwrap, the view took too much.

---

## Anti-Pattern Quick Reference

| Anti-pattern | Symptom | Fix |
|---|---|---|
| Preview imports app target | 20s preview compile | Extract UI to Swift Package (Rule 1) |
| `FirebaseApp.configure()` in `App.init` unguarded | Preview hits prod analytics, slow | Guard with `XCODE_RUNNING_FOR_PREVIEWS` (Rule 5) |
| Same `AppState()` in 8 previews | Slow, duplicated setup | `PreviewModifier` with `makeSharedContext()` (Rule 2) |
| Wrapper view just to host `@State` | Boilerplate, hard to read | `@Previewable @State` at root scope (Pattern B) |
| 6 named previews for color scheme + Dynamic Type | Manual maintenance | One preview + Variant Mode (Variant Matrix) |
| `try!` on real network response | Preview crashes on bad data | Sample factory on the model (Pattern A) |
| Auto-refresh on for 500-line view | Every keystroke recompiles | Disable auto-refresh, manual ⌥⌘P (Rule 4) |
| Inline `Binding(get:set:)` in preview body | Preview resets state on each redraw (new binding per evaluation) | `@Previewable @State` + pass `$value` |
| Manual `PreviewProvider` boilerplate | Pre-Xcode-15 verbosity (`struct X_Previews: PreviewProvider { static var previews ... }`) | Replace with `#Preview { ... }` (see `previews-ref.md` migration table) |
| Comparing 5 variants in one ZStack | Overlapping content, hard to read | `Group { ... }` or Variant Mode (Pattern F + Variant Matrix) |

---

## Quick Checklist Before Shipping a New Component

Before considering a component complete:

- [ ] At least one `#Preview` exists
- [ ] Preview uses `.sample` data, not constructed inline with `try!` / force-unwraps
- [ ] If shared with other previews, expensive setup uses `PreviewModifier`
- [ ] For design-system components: light + dark + largest Dynamic Type + RTL previews exist (Variant Mode counts)
- [ ] For semantic states: a "states" preview covers default + disabled + loading + error
- [ ] Preview compiles in <5 seconds in your local environment

---

## Resources

**WWDC**: 2023-10252, 2024-10144, 2020-10185

**Docs**: /xcode/previewing-your-apps-interface-in-xcode, /swiftui/preview(_:body:), /swiftui/preview(_:traits:_:body:), /swiftui/previewable(), /swiftui/previewmodifier

**Skills**: skills/previews-ref.md, skills/debugging.md, skills/swiftui-performance.md, skills/architecture.md, axiom-accessibility
