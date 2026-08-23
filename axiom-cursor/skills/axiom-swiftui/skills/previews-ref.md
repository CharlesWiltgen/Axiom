
# SwiftUI Previews — API Reference

Comprehensive API reference for SwiftUI preview construction. For discipline guidance (performance rules, when to use, environment setup patterns), see `skills/previews.md`.

## Overview

This reference covers:

- **`#Preview` macro** — Basic form, named previews, traits, widget previews, Live Activity previews
- **`@Previewable` macro** — Inline dynamic properties (Xcode 16+)
- **`PreviewModifier` protocol** — Shared expensive context across previews (Xcode 15.4+)
- **`PreviewTrait`** — `.landscapeLeft`, `.sizeThatFitsLayout`, `.fixed`, `.modifier(_:)`
- **Canvas modes** — Live, Selectable, Variants
- **Variant Mode** — What it auto-varies and when to use
- **Development Assets** — Preview-only resources without bundle bloat
- **Known issues** — Xcode 26.x preview-target gotchas

**Availability matrix:**

| API | Xcode | iOS |
|---|---|---|
| `#Preview` | 15.0+ | 17.0+ |
| `PreviewTrait.landscapeLeft` | 15.0+ | 17.0+ |
| `PreviewTrait.sizeThatFitsLayout` | 15.0+ | 17.0+ |
| `PreviewTrait.fixed(width:height:)` | 15.0+ | 17.0+ |
| `#Preview(as: WidgetFamily) { } timelineProvider: { }` | 15.0+ | 17.0+ |
| `PreviewModifier` protocol | 16.0+ | 18.0+ (macOS 15+) |
| `PreviewTrait.modifier(_:)` | 16.0+ | 18.0+ |
| `@Previewable` macro | 16.0+ | 17.0+ (back-deployed) |

---

## `#Preview` Macro

The entry point for all previews. Defined at the **top level of a source file** — not nested inside a type or function.

### Basic Form

```swift
#Preview {
    ContentView()
}
```

Works for SwiftUI views, UIKit `UIView` / `UIViewController`, and AppKit `NSView` / `NSViewController`. Apple ships the same macro shape across platforms; the return type adapts.

**UIKit:**

```swift
#Preview {
    let vc = WeatherViewController()
    vc.title = "Current Weather"
    return vc
}

#Preview {
    let view = WeatherView()
    view.icon = UIImage(systemName: "sun.max.fill")
    return view
}
```

**AppKit:**

```swift
#Preview {
    let vc = WeatherViewController()
    vc.title = "Current Weather"
    return vc
}
```

### Named Preview

The first positional argument is an optional `String` name. The name appears as the tab label when multiple previews exist in one file.

```swift
#Preview("Light mode") {
    ContentView()
}

#Preview("Dark mode") {
    ContentView()
        .preferredColorScheme(.dark)
}
```

### Traits — Variadic

After the name, the macro takes a variadic list of `PreviewTrait<Preview.ViewTraits>` values. Order does not matter.

```swift
#Preview("2x2 Grid", traits: .landscapeLeft) {
    CollageView(layout: .twoByTwoGrid)
}

#Preview("Sized", traits: .sizeThatFitsLayout) {
    Badge(text: "NEW")
}

#Preview("Fixed canvas", traits: .fixed(width: 320, height: 200)) {
    InspectorPanel()
}

// Combining traits — both apply
#Preview("Multi-trait", traits: .landscapeLeft, .modifier(SampleData())) {
    ContentView()
}
```

### Signatures (DeveloperToolsSupport / SwiftUI)

For reference — the macros declared in `DeveloperToolsSupport` and `SwiftUI`:

```swift
// SwiftUI views, body returns View
#Preview(_ name: String? = nil, body: @escaping () -> some View)

#Preview(_ name: String? = nil,
         traits: PreviewTrait<Preview.ViewTraits>...,
         body: @escaping () -> some View)

// Widget timeline-provider variant
#Preview(_ name: String? = nil,
         as family: WidgetFamily,
         widget: @escaping () -> some Widget,
         timelineProvider: @escaping () -> some TimelineProvider)

// Widget specific entries (result builder over TimelineEntry)
#Preview(_ name: String? = nil,
         as family: WidgetFamily,
         widget: @escaping () -> some Widget,
         @TimelineEntryBuilder timeline: () -> [some TimelineEntry])

// Live Activity widget (result builder over ContentState)
#Preview(_ name: String? = nil,
         as attributes: some ActivityAttributes,
         widget: @escaping () -> some Widget,
         @ContentStateBuilder contentStates: () -> [some ActivityAttributes.ContentState])
```

Signatures are simplified — the actual macro definitions use platform conditionals and result-builder attributes. `timeline:` and `contentStates:` are result builders, so you list entries / states as statements without `return` or array literal.

#### About `Preview.ViewTraits`

`PreviewTrait<Preview.ViewTraits>` is the parameterized type used for view-preview traits. The generic parameter `Preview.ViewTraits` distinguishes view-preview traits (orientation, sizing, modifiers) from widget-preview traits — the type system prevents you from passing a widget trait to a view preview, and vice versa.

---

## Widget Previews

Widgets get dedicated `#Preview` forms because they need a timeline. The widget form takes the widget family as the first non-name argument, the widget closure as `widget:`, and either a `timelineProvider:` or an inline `timeline:`.

### TimelineProvider Preview

```swift
#Preview(as: .systemSmall) {
    FrameWidget()
} timelineProvider: {
    RandomCollageProvider()
}
```

Useful when you want previews to exercise the real provider's snapshot/timeline logic.

### Specific Timeline Entries

```swift
#Preview(as: .systemSmall) {
    FrameWidget()
} timeline: {
    FrameEntry(date: .now,                                  photo: .sample1)
    FrameEntry(date: Date.now.addingTimeInterval(60),       photo: .sample2)
    FrameEntry(date: Date.now.addingTimeInterval(120),      photo: .sample3)
}
```

The `timeline:` closure uses a result-builder syntax — list entries as statements, not as an array literal. Best for visual iteration: bypass the provider entirely and supply the entries you want to render.

### Live Activity Preview

```swift
#Preview(as: PizzaAttributes(pizzaName: "Margherita")) {
    PizzaActivityWidget()
} contentStates: {
    PizzaAttributes.ContentState(status: .baking,     minutesRemaining: 8)
    PizzaAttributes.ContentState(status: .ready,      minutesRemaining: 0)
    PizzaAttributes.ContentState(status: .delivering, minutesRemaining: 3)
}
```

`contentStates:` is a result-builder closure; list `ContentState` values as statements. The canvas lets you scrub through them.

---

## `@Previewable` Macro

Apple-introduced at WWDC 2024 (Xcode 16). Tags a dynamic-property declaration at the root of a `#Preview` body so it works inline without a wrapper view.

### Declaration

```swift
@attached(peer) macro Previewable()
```

### Usage — Eliminates Wrapper-View Boilerplate

**Before Xcode 16** (no `@Previewable`):

```swift
#Preview {
    struct Wrapper: View {
        @State private var isOn = true
        var body: some View {
            Toggle("Show all songs", isOn: $isOn)
        }
    }
    return Wrapper()
}
```

**With `@Previewable`:**

```swift
#Preview {
    @Previewable @State var isOn = true
    Toggle("Show all songs", isOn: $isOn)
}
```

### Composes with Any `DynamicProperty`

`@State`, `@Binding`, `@Bindable`, `@Environment`, `@FocusState`, `@SceneStorage`, and any custom `DynamicProperty` — all work with `@Previewable`. To pass a binding to a child, use `$` as usual:

```swift
#Preview {
    @Previewable @State var value = 0
    ChildView(count: $value)
}
```

### Constraints

- **Must be at root scope** inside the `#Preview` body closure. Not in nested `if`, `for`, or function bodies.
- **Compile-time error** if used outside `#Preview`. Apple: "It is an error to use `@Previewable` outside of a `#Preview` body closure."
- **SwiftUI only.** Apple: "`Previewable()` is a SwiftUI only macro and doesn't apply to UIKit or AppKit previews."

### What `#Preview` Generates Under the Hood

Per Apple's documentation: "tagged declarations become properties on the view, and all remaining statements form the view's body." Without `@Previewable`, the macro can't tell that a `@State` variable should be hoisted to the synthesized wrapper view — it would be treated as a local. The tag is the opt-in.

---

## `PreviewModifier` Protocol

Available iOS 18.0+ / macOS 15.0+ / Xcode 16+. Apple's official answer for sharing expensive preview setup across multiple previews.

### Protocol Definition

```swift
@MainActor protocol PreviewModifier {
    associatedtype Context
    associatedtype Body: View
    typealias Content = PreviewModifierContent

    @MainActor static func makeSharedContext() async throws -> Context
    @MainActor func body(content: Content, context: Context) -> Body
}
```

The protocol is `@MainActor`. `Content` is a type alias for `PreviewModifierContent` — a type-erased preview body that you apply your shared context to. Concrete implementations may declare `makeSharedContext()` as synchronous `throws` if no async work is required (Swift allows satisfying an `async throws` requirement with a non-`async` method).

### Usage — Three Steps

1. **Define a struct conforming to `PreviewModifier`.** Pick a meaningful `Context` type (often your app's `@Observable` model or a SwiftData `ModelContainer`).
2. **Implement `static func makeSharedContext() async throws -> Context`.** This runs *once* across all previews using the modifier; cache result is shared.
3. **Implement `func body(content: Content, context: Context) -> some View`.** Inject the context into the previewed content.

### Canonical Example — `@Observable` Shared State

```swift
@Observable
class AppState {
    var expensiveObject = "Some expensive object"
}

struct SampleData: PreviewModifier {
    static func makeSharedContext() async throws -> AppState {
        let state = AppState()
        state.expensiveObject = "An expensive object to reuse in previews"
        return state
    }

    func body(content: Content, context: AppState) -> some View {
        content.environment(context)
    }
}

#Preview(traits: .modifier(SampleData())) {
    ComplexView()
}
```

`ComplexView` here is a SwiftUI view that does `@Environment(AppState.self) var appState`. Multiple `#Preview` calls with the same modifier share one `AppState` instance.

### Canonical Example — SwiftData `ModelContainer`

Apple's official docs feature this SwiftData variant — the most common real-world `PreviewModifier`:

```swift
import SwiftData

struct SampleData: PreviewModifier {
    static func makeSharedContext() throws -> ModelContainer {
        let container = try ModelContainer(for: Snack.self)
        container.mainContext.insert(Snack.potatoChips)
        return container
    }

    func body(content: Content, context: ModelContainer) -> some View {
        content.modelContainer(context)
    }
}

#Preview(traits: .modifier(SampleData())) {
    @Previewable @Query var snacks: [Snack]
    return SnackView(snack: snacks.first!)
}
```

Notes on this form:
- `makeSharedContext()` may drop `async` if no async work is needed — Swift's protocol-satisfaction rules allow a sync `throws` method to satisfy an `async throws` requirement.
- `@Previewable @Query` reads from the container the modifier supplied — the modifier and `@Query` cooperate via the same `ModelContainer`.
- `try!` on `snacks.first!` is acceptable in a preview because the modifier inserted `Snack.potatoChips`; in production code, handle empty cases explicitly.

### `makeSharedContext()` is `async throws`

Apple chose `async throws` because the context can legitimately come from async setup (loading sample JSON from a bundle, opening a SwiftData container, doing one-time prefetch). If your setup is synchronous, just return:

```swift
static func makeSharedContext() async throws -> AppState {
    let state = AppState()
    state.products = Product.previewCatalog
    return state
}
```

If your setup genuinely needs async work, do it:

```swift
static func makeSharedContext() async throws -> Catalog {
    let url = Bundle.main.url(forResource: "catalog", withExtension: "json")!
    let data = try Data(contentsOf: url)
    return try JSONDecoder().decode(Catalog.self, from: data)
}
```

### Apply Via `.modifier(_:)` Trait

```swift
#Preview(traits: .modifier(SampleData())) { ... }

// Multi-trait
#Preview("RTL with seeded data",
         traits: .modifier(SampleData()), .landscapeLeft) {
    ContentView()
        .environment(\.layoutDirection, .rightToLeft)
}
```

The modifier is a `PreviewTrait`, so it composes with `.landscapeLeft`, `.sizeThatFitsLayout`, `.fixed(width:height:)`, etc.

---

## `PreviewTrait` Quick Reference

`PreviewTrait<Preview.ViewTraits>` is the type Apple uses for the variadic `traits:` parameter. Constructed via static members.

| Trait | Effect |
|---|---|
| `.landscapeLeft` | Start preview in landscape-left orientation |
| `.landscapeRight` | Start preview in landscape-right orientation |
| `.portrait` | Force portrait |
| `.portraitUpsideDown` | Upside-down portrait |
| `.sizeThatFitsLayout` | Canvas sizes to the view's ideal size (no device frame) |
| `.fixed(width:height:)` | Canvas sized to fixed dimensions |
| `.modifier(_:)` | Apply a `PreviewModifier` to the preview |

For *device-level* options that aren't in the trait list (specific device model, dark mode, Dynamic Type size), use the canvas Device Settings popover instead — those aren't expressed as code traits.

### When to Use Code Traits vs Canvas Settings

| Goal | Use |
|---|---|
| Default orientation per preview | `traits: .landscapeLeft` |
| One-off canvas sizing | `traits: .sizeThatFitsLayout` |
| Reusable shared state | `traits: .modifier(MyModifier())` |
| Specific device model | Canvas → Preview Device dropdown |
| Try every Dynamic Type size | Canvas → Variants → Dynamic Type Variants |
| Light + Dark side-by-side | Canvas → Variants → Color Scheme |

---

## Canvas Modes

The preview canvas has three modes, switched via buttons at the bottom of the canvas.

### Live Mode (default)

- Default for new previews
- View behaves like a real app: animations, control logic, text entry, async work all execute
- Use for: testing interaction, animation, loading-state cycles

### Selectable Mode

- Snapshot of the view; UI is selectable
- Double-click an element → Xcode highlights the corresponding source code line
- Use for: visual inspection, finding what code drives a specific element

### Variants Mode

- Auto-generates multiple instances of the view varying one canvas device setting
- Apple-confirmed dimensions (per `previewing-your-apps-interface-in-xcode`): **Color Scheme**, **Dynamic Type Variants**
- Additional dimensions surfaced by the picker in current Xcode (orientation, layout direction) vary by version; check the canvas dropdown for the live list.
- Use for: design-system audits — see every variant at once without writing N named previews

Pick which device setting to fan out from the bottom of the canvas. Selecting "Color Scheme" generates Light + Dark side-by-side; "Dynamic Type Variants" generates the full size range including AX1–AX5.

---

## Device Settings Popover

The canvas Device Settings panel (icon at the bottom of the canvas) provides toggles that adjust the *current* preview render:

- **Color Scheme** — Light / Dark
- **Orientation** — Portrait / Landscape Left / Landscape Right / Portrait Upside Down
- **Dynamic Type** — slider across sizes including AX1–AX5
- **Increased Contrast**, **Reduce Motion**, **Reduce Transparency** (accessibility traits)

Note from Apple: "Because variant mode shows all the values for a given device setting, you can override what variant mode displays by making further changes in Canvas Device Settings." Combine Variants Mode with Device Settings to constrain the matrix (e.g. "all Dynamic Type sizes BUT only in Dark mode").

---

## Preview Device Selection

Use the **Preview Device** pop-up at the bottom of the canvas to pick a specific device (iPhone 17 Pro, iPad Pro 13-inch, etc.) for rendering. This swaps the canvas frame to match the device.

Apple's API no longer requires the old `.previewDevice("iPhone 14")` view-modifier approach — the canvas dropdown is the modern path.

---

## Development Assets

Resources you want available *only* in previews and the simulator, without shipping in the App Store binary.

### Setup

1. Select the project folder in the Project navigator
2. Select the target
3. In the **General** tab, scroll to **Development Assets**
4. Click **+** in the lower-left
5. Select the items to add and click **Add**

The folder(s) you add are bundled into preview and simulator builds, and stripped from App Store submissions. Use it for:

- Sample JSON / catalog files for `PreviewModifier` contexts
- High-resolution placeholder images for design previews
- Large fixtures that would bloat the binary

App Store binary size is not affected.

---

## Coding Intelligence — "Generate a Preview"

Xcode 26's coding intelligence can synthesize a `#Preview` for selected view code. Select view code and click the coding assistant icon, or Control-click a symbol and choose Show Coding Tools → Generate a Preview.

Generated previews are starting points — most need a sample-data factory before they're useful.

---

## Library Targets — `XCPreviewAgent`

When you preview a view that lives in a framework or Swift Package, Xcode launches a process called `XCPreviewAgent` that loads your library. Crash reports referencing `XCPreviewAgent` are *your* crash — the agent is a thin shell that loads your code.

This is also why the Five Performance Rules (see `skills/previews.md`) put so much weight on Swift Package isolation: a `XCPreviewAgent` loading a small `Features` package starts in 2–3 seconds. The same agent loading your full app target with the full dependency graph takes far longer.

---

## Known Issues

### Xcode 26.x: "Cannot preview in this file. Failed to launch"

When previewing a file in a framework or package target, Xcode sometimes reports "Cannot preview in this file. Failed to launch" — even though the file compiles fine.

**Workaround**: In the active scheme selector, change the run target from the framework/package target to the *app target*. Previews then resolve correctly.

Apple addressed similar previews-failed-to-launch issues across Xcode 26.x point releases. If updating Xcode doesn't fix it, fall back to the app-target-as-active-scheme workaround.

### Cache corruption

If a preview was working and now refuses to load with no clear error: cache corruption is the most likely cause. The fix sequence — Restart Preview Canvas (⌥⌘P) → Restart Xcode → `rm -rf ~/Library/Developer/Xcode/DerivedData` → rebuild — is the same as for any preview crash. Full diagnostic decision tree lives in `skills/debugging.md` Preview Crashes section.

### `@Previewable` outside `#Preview` is a compile error

If you see "`@Previewable` may only be used inside a `#Preview` macro", you've put a `@Previewable` declaration in a regular view body or function. Move it to `#Preview` root scope.

### `ENABLE_PREVIEWS` is gone in Xcode 16+

Xcode 15 set the `ENABLE_PREVIEWS` build setting (and Swift compile flag) when running in preview mode. Xcode 16+ no longer sets it — guards based on `#if ENABLE_PREVIEWS` silently stop firing. If you need to detect preview context, use the runtime check:

```swift
if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
    // preview-only path
}
```

`XCODE_RUNNING_FOR_PREVIEWS` is set to the string `"1"` during preview builds. It is community-established, not an official Apple API, but stable across Xcode 15–26.

---

## Migration: `PreviewProvider` → `#Preview`

Pre-Xcode-15 codebases use the `PreviewProvider` protocol. Apple has not deprecated it (it remains available iOS 13+), but the official documentation directs new code to `#Preview`: "You can use this protocol to define a preview manually, but you typically use a preview macro like `Preview(_:body:)` instead."

### Mapping

| Legacy (Xcode 14 and earlier) | Modern (Xcode 15+) |
|---|---|
| `struct ContentView_Previews: PreviewProvider { static var previews: some View { ... } }` | `#Preview { ContentView() }` |
| `.previewDisplayName("Light")` | `#Preview("Light") { ... }` |
| `.previewLayout(.sizeThatFits)` | `#Preview(traits: .sizeThatFitsLayout) { ... }` |
| `.previewLayout(.fixed(width: 320, height: 200))` | `#Preview(traits: .fixed(width: 320, height: 200)) { ... }` |
| `.previewDevice("iPhone 14")` | Canvas → Preview Device dropdown (no code equivalent) |
| `Group { Preview1; Preview2 }` for multi-variant | Multiple `#Preview("Name") { ... }` blocks |

### Before / After

```swift
// Legacy
struct ProductCard_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            ProductCard(product: .sample)
                .previewLayout(.sizeThatFits)
                .previewDisplayName("Default")

            ProductCard(product: .sample)
                .preferredColorScheme(.dark)
                .previewLayout(.sizeThatFits)
                .previewDisplayName("Dark")
        }
    }
}

// Modern
#Preview("Default", traits: .sizeThatFitsLayout) {
    ProductCard(product: .sample)
}

#Preview("Dark", traits: .sizeThatFitsLayout) {
    ProductCard(product: .sample)
        .preferredColorScheme(.dark)
}
```

Migration is safe in either direction during the same Xcode session — `PreviewProvider` and `#Preview` co-exist. There is no upgrade pressure beyond Apple's recommendation; existing `PreviewProvider` code continues to work indefinitely.

---

## Cross-References

- **Discipline guidance** (the five performance rules, environment patterns, when not to use): `skills/previews.md`
- **Preview crashes** (cannot find in scope, fatal error, cache corruption): `skills/debugging.md` Preview Crashes Decision Tree
- **Runtime performance** (not preview perf): `skills/swiftui-performance.md`
- **Design-system variant audits** (Dynamic Type, RTL, contrast): `axiom-accessibility`
- **SwiftData previews** (`ModelContainer` setup): `axiom-data`

---

## Resources

**WWDC**: 2023-10252, 2024-10144, 2020-10185

**Docs**: /xcode/previewing-your-apps-interface-in-xcode, /swiftui/preview(_:body:), /swiftui/preview(_:traits:_:body:), /swiftui/previewable(), /swiftui/previewmodifier, /swiftui/previewmodifier/makesharedcontext(), /developertoolssupport/previewtrait

**Skills**: skills/previews.md, skills/debugging.md, skills/swiftui-performance.md, axiom-accessibility, axiom-data
