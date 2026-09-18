# iPhone Duo

iPhone Duo is Apple's first two-display iPhone: an outer display, and a larger inner display that folds along a hinge. This skill covers adapting an app to it — the device model, what changes with the SDK you build against, vertical bars, the fold, and the new layout, hinge, and scene tools. SwiftUI comes first; the UIKit equivalent sits beside it.

## SDK Status — Read First

Apple announced the Duo-specific APIs in six tech talks (111461–111466, September 2026). They shipped in the **iOS 27.1 SDK** (and are in the 27.2 SDK); every snippet below is compiled against it. Gate 27.1 calls at `@available(iOS 27.1, *)` and keep the pre-27.1 path compiling.

- **Check the installed SDK first** (`xcrun --sdk iphoneos --show-sdk-version`). Below 27.1 the 27.1 symbols don't exist — describe the API, name the talk, and give today's alternative. On 27.1 or later: grep the SDK's `.swiftinterface` and headers for the name; the SDK's spelling and signature win over this file; if it's missing, check for a rename before calling it dropped.
- **Never call iPhone Duo or these APIs fictional or hallucinated.** They come from Apple's own tech talks and are in the shipped SDK.
- **Never invent parameters, types, or cases** beyond what the snippets and the SDK give.

## When to Use This Skill

Use when:
- Preparing an app for iPhone Duo, a foldable iPhone, or a two-display iPhone
- Layout breaks in some poses — closed, open, rotated, or partially folded
- Toolbar, tab bar, or navigation bar items should move to the side of the screen
- Interactive UI lands in the fold or under the inner camera
- Choosing between reserved regions, arrangements, and the hinge
- Showing content on another display, or opening multiple windows on iPhone
- Code or a question names a 27.1 API (`onHingeChange`, `ArrangementView`, `reservedRegions`, `axisBehavior`, …)

#### Related Skills
- axiom-uikit (skills/uikit-modernization.md) — the resizing baseline Duo builds on: scene lifecycle, geometry, size classes
- skills/layout.md — adaptive layout; the size-class truth tables include Duo
- skills/toolbars.md — SwiftUI placements, overflow, and visibility priority
- axiom-media (skills/camera-capture.md, skills/camera-capture-ref.md) — Duo front cameras and camera direction

## Example Prompts

#### 1. "How do I prepare my app for iPhone Duo?"
→ Readiness Today: resizing baseline, per-side safe areas, standard containers; build with the 27.1 SDK or later.

#### 2. "How do I detect that my app is running on iPhone Duo?"
→ Don't. It's still an iPhone app — use size classes and scene geometry.

#### 3. "My toolbar buttons should move to the side on iPhone Duo."
→ Vertical Bars: system-managed bars only, titles on every item, overflow priorities.

#### 4. "A button sits in the fold when the phone is partly closed."
→ The Fold and the Camera: displacement rules.

#### 5. "Can I use the hinge angle in my app?"
→ Hinge: effects and interactions, never layout.

#### 6. "Add .axisBehavior(.horizontalOnly) to my Select button"
→ Vertical Bars: the axis APIs are iOS 27.1; a build against 27.0 or earlier never gets vertical bars — ship titles, images, and priorities until you rebuild.

## Red Flags — Anti-Patterns to Prevent

| Thought | Reality |
|---|---|
| "I'll check the model identifier and give Duo its own layout" | It's still an iPhone app — compact width outside, regular width inside. Model and idiom checks break in Split View, in iPhone Mirroring, and on the next device. Use size classes and scene geometry. |
| "I'll branch on interface orientation" | The inner display ignores your supported orientations. Decide layout with size classes. |
| "`UIScreen.main` gives me the screen" | Deprecated since iOS 26, and ambiguous with two displays. Use `window?.windowScene?.screen` or `traitCollection.displayScale`. |
| "Safe-area insets are symmetric" | A vertical bar sits on one side, so left ≠ right — and in Split View it switches sides. Inset each side independently. |
| "I'll build my own bottom bar" | A custom `UIToolbar`/`UINavigationBar`/`UITabBar` or a hand-built SwiftUI row never moves to the side, and a hand-built row gets none of the system's fold avoidance. Use system-managed bars. |
| "I'll hide the controls when it's folded" | Displace, never hide: move, resize, or reorganize so every function stays reachable in every pose. |
| "I'll read the hinge angle to size my panes" | The hinge drives effects and interactions. Layout uses arrangements and reserved regions. |
| "Each pose gets its own layout" | Design for the two horizontal size classes — compact outside, regular inside. An optional tabletop layout must keep every control and the same hierarchy. |
| "It's on the inner display, so it's wide" | A Split View half is half the inner display, and Apple hasn't said which size class it reports. Read the size class from the environment; never key a wide layout to the display. |
| "The New Window button can always show" | The outer display can't create windows. Gate the affordance. |

## The Device

| Display | Horizontal | Vertical |
|---|---|---|
| Outer, portrait | `.compact` | `.regular` |
| Outer, landscape | `.compact` | `.compact` |
| Inner, full screen | `.regular` | `.regular` |
| Inner, one half of Split View | not stated | not stated |

- **Poses** Closed; open in portrait or landscape; partially folded like a book; seated like a laptop (tabletop) with the inner display facing you; standing on its edges.
- **Still an iPhone app** Adapt to size classes and scene bounds, never to the device.
- **Controls on the side** Built against the 27.1 SDK, in every pose except inner-display portrait, bars lay out vertically along the side, sharing that edge with the status bar, the Dynamic Island, and Live Activities. When space runs out, items collapse into the overflow menu.
- **Multitasking** A 50/50 split view places two apps side by side, each with its controls on its outer edge. Picture in Picture can pin to the top; the app below resizes vertically.
- **Offset, don't center** Most content offsets away from the side controls — align to horizontal safe-area insets and it happens for you. Center on the full display only for non-scrolling, highly visual UI whose interactive elements the controls can't cover. A full-width background under inset scrolling content also works.
- **Inner display** Don't stretch the iPhone layout. Use a split view, a two-column rearrangement when width allows, or a tab sidebar for information-dense apps. Keep the hierarchy identical inside and out — people open and close the device mid-task.
- **Games** Lock to portrait or landscape, but fill the screen in every pose; change the aspect ratio rather than letterboxing or pillarboxing (HIG).

## Behavior by the SDK You Build Against

Link-time behavior — what the device does with your binary:

| Built against | On iPhone Duo |
|---|---|
| Pre-27 SDK | Closed: runs in the space beside the status bar and camera. Open: a familiar size and aspect ratio |
| iOS 27.0 SDK | Resizes like any 27 iPhone app; extends left of the status bar on the inner display |
| iOS 27.1 SDK | Edge to edge; standard navigation, toolbar, and tab bars lay out vertically |

`UIRequiresFullScreen` is still honored, but the app still resizes when the device opens or closes. Supported orientations govern the outer display as on any iPhone; the inner display doesn't honor them — the app scales there instead, including in Split View.

## Which Tool When

| Need | Tool | Availability |
|---|---|---|
| Navigation, tabs, sheets, alerts, and menus that adapt to every pose | Standard containers (`NavigationSplitView`, `TabView`, `UISplitViewController`, …) | Today |
| Custom UI that must avoid the fold or the inner camera | Reserved regions | 27.1 |
| Two views that split side by side or overlay | Arrangements | 27.1 |
| An effect or interaction driven by the fold angle | Hinge | 27.1 |
| Extra content on another display | Scene accessories | Today for external displays; Duo camera variant 27.1 |
| A second window of your app | Multiple scenes, inner display only | Today |

## Readiness Today

The resizing baseline is the same as for every 27 iPhone app — scene lifecycle, no `UIScreen.main`, size classes over orientation and idiom: axiom-uikit (skills/uikit-modernization.md). Adaptive patterns: skills/layout.md. Duo adds five things.

#### Handle each safe-area side independently

```swift
// Wrong on Duo: a vertical bar on one side makes left != right
let assumedWidth = view.bounds.width - view.safeAreaInsets.left * 2
// Right: inset each side on its own
let contentWidth = view.bounds.inset(by: view.safeAreaInsets).width
```

Layout margins are asymmetric too. SwiftUI places content inside the safe area by default; let backgrounds extend with `.ignoresSafeArea()`, and in UIKit size backgrounds to `view.bounds`. With Auto Layout, constrain to `safeAreaLayoutGuide` / `layoutMarginsGuide` — each side stays independent (axiom-uikit (skills/adaptive-layout.md)). Under right-to-left languages the bar stays on the hardware side, so never assume the trailing inset is the larger one.

#### Offer a tab sidebar on the inner display `iOS27`

```swift
TabView {
    Tab("Summary", systemImage: "heart") { SummaryView() }
    Tab("Browse", systemImage: "square.grid.2x2") { BrowseView() }
}
.tabViewStyle(.sidebarAdaptable)   // required: the placement applies only to this style
.defaultTabBarPlacement(.sidebar)
```

UIKit: `tabBarController.sidebar.preferredPlacement = .sidebar`. The SwiftUI modifier has no effect on iPadOS, where the bar adapts on its own — use `defaultAdaptableTabBarPlacement(_:)` there. A sidebar suits information-dense apps; most apps keep the tab bar.

#### Gate new-window affordances

iPhone Duo is the first iPhone with multiple windows of one app, and only its inner display can create them. Both paths need `UIApplicationSupportsMultipleScenes` set to `YES` in the scene manifest (axiom-uikit (skills/uikit-modernization.md)), and `openWindow(id:value:)` needs a matching `WindowGroup(id:for:)` (axiom-design (skills/app-composition.md)). Apple's own doc comment for `supportsMultipleWindows` limits `true` to macOS (any SwiftUI-lifecycle app) and iPadOS (a SwiftUI-lifecycle app with that manifest key set) — every other platform and configuration reports `false`. On today's SDK that means the value is `false` on iPhone; the talks don't say how Duo's inner display changes it.

```swift
struct ItemRow: View {
    let item: Item
    @Environment(\.supportsMultipleWindows) private var supportsMultipleWindows
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Text(item.title)
            .contextMenu {
                if supportsMultipleWindows {
                    Button("Open in New Window") { openWindow(id: "detail", value: item.id) }
                }
            }
    }
}
```

```swift
// UIKit menu action (iOS 15): where new windows aren't available the alternate runs;
// with no alternate, the talks say the item hides (111464)
let openHere = UIAction(title: "Open") { _ in showDetailInCurrentWindow() }
let newWindow = UIWindowScene.ActivationAction(alternate: openHere) { _ in
    UIWindowScene.ActivationConfiguration(userActivity: detailActivity)
}

// Direct request: fails on the outer display, so handle the error (iOS 17)
let request = UISceneSessionActivationRequest(role: .windowApplication, userActivity: detailActivity)
UIApplication.shared.activateSceneSession(for: request) { error in
    logger.error("Window request failed: \(error.localizedDescription, privacy: .public)")
    showDetailInCurrentWindow()
}
```

The Swift name is `UIWindowScene.ActivationAction`; the ObjC name `UIWindowSceneActivationAction` doesn't compile in Swift. The talks don't say whether `supportsMultipleWindows` updates live as the device closes — check on a Duo simulator (Tooling and Testing), and fall back to both size classes when in doubt.

#### Match the new corners and support landscape

`ConcentricRectangle` / `UICornerConfiguration` (iOS 26) are updated for Duo's display corners — skills/26-ref.md (Corner Concentricity). Support landscape on the outer display; people may set the phone down like a tent.

#### Test both halves of Split View

Drag the app to the left half, then the right. The vertical bar follows the app's outer edge, so the larger safe-area inset switches sides. The talks don't say which horizontal size class each half reports: check on the Duo simulator for your Xcode build, and make the half's layout work at both size classes either way.

## Vertical Bars

Built against the 27.1 SDK, navigation, toolbar, and tab bar items share one vertical stack along the side — picture the horizontal bars rotated 90°. Only **system-managed bars** take part: `NavigationStack`, `NavigationSplitView`, or `TabView` with `.toolbar`, or `UINavigationController` and `UITabBarController` with items set on the view controller. The content of a custom `UIToolbar`, `UINavigationBar`, or `UITabBar` never joins the vertical bar; it stays where you put it.

#### Which bars go vertical

- Only a split view's detail column; other columns keep horizontal bars. Inspectors get no vertical bar.
- Sheets: on the outer display a sheet's toolbar goes vertical by default (disable it with the off switch below); on the inner display sheets center with horizontal bars. A sheet placed on the right gets a vertical bar; one on the left doesn't. The placement APIs — `.presentationPlacement(.trailing)` and `sheetPresentationController?.preferredPlacement = .trailing`, both iOS 27; the UIKit one is ignored when `sourceView` is set — take leading/trailing, but the rule is physical right/left.
- Controls that belong to a content area stay with it, not on the side — Mail keeps the list's controls above the leading pane (HIG).
- The bar stays on the hardware side under right-to-left languages; content adapts around it.
- Keyboard accessory bars stay on the keyboard.
- The inner display in portrait keeps horizontal bars.

#### Order items top to bottom

1. Back (automatic in a navigation container) or a custom close. SwiftUI: `.cancellationAction`. UIKit: a leading item, with `leftItemsSupplementBackButton` left `false` (the default).
2. The prominent action. SwiftUI: `.topBarPinnedTrailing` `iOS27`. UIKit: `pinnedTrailingGroup`.
3. Everything else, in its existing groups. A spacer separates top and bottom placements.

Top-bar items go to the top of the stack, bottom-bar items to the bottom, and the tab bar stays bottom-aligned.

Keep placement consistent across poses so people don't relearn where actions live. SwiftUI code for these placements and for overflow: skills/toolbars.md (Pattern 2, Pattern 11). UIKit:

```swift
navigationItem.leftItemsSupplementBackButton = false   // the custom close replaces back
navigationItem.leadingItemGroups = [UIBarButtonItemGroup(barButtonItems: [closeItem], representativeItem: nil)]
navigationItem.pinnedTrailingGroup = UIBarButtonItemGroup(barButtonItems: [doneItem], representativeItem: nil)
navigationItem.additionalOverflowItems = UIDeferredMenuElement.uncached { completion in
    completion([UIAction(title: "Scan", image: UIImage(systemName: "doc.viewfinder")) { _ in scan() }])
}
shareItem.visibilityPriority = .high   // iOS27: collapses after standard-priority items
inboxItem.badge = .count(7)            // iOS 26: a symbol-only item that still shows the count
```

`UIBarButtonItem.Badge` is itself main-actor isolated — even `.count(n)` can't be built in a nonisolated model.

#### Make items vertical-ready

- Give every item a title and an image — a SwiftUI `Label`, or a `UIBarButtonItem` with both. Bars show the icon; the overflow menu shows title and icon.
- Items with an icon go vertical; text-only items stay horizontal. An item that switches between a symbol and text (a custom Select/Done) belongs on the horizontal axis — the system edit button already stays there.
- Replace inline counts with a badge. Text that carries real information, like a cart total, stays in a horizontal bar.
- Custom views, complex views, and wide controls like segmented controls stay horizontal unless opted in (Axis, edge, compression, and the off switch).
- Vertical bars have a fixed width and flexible height; once a custom view opts in, it must fit that width or adapt its layout. Flexible spacers collapse to zero vertically; fixed spacers keep their minimum. Don't add extra spacing — group items with `ToolbarItemGroup` / `UIBarButtonItemGroup`, which supply it and adapt it.
- Vertical bars have no scroll-edge effect but gain a background under Reduce Transparency — keep custom content legible either way.
- A hero or background image extends under the vertical bar with `.backgroundExtensionEffect()` (SwiftUI) or `UIBackgroundExtensionView` (UIKit).

#### Plan for overflow

The outer display in landscape overflows most. Decide per view whether the toolbar or the tab bar compresses first — navigation-focused views keep their tabs, task-focused views keep their actions. By default the toolbar compresses first and the tabs stay; a task-focused view opts into keeping its actions (Axis, edge, compression, and the off switch). Merge your own overflow menu into the system one, keep the ellipsis for overflow only, and rank items with `visibilityPriority`: frequent actions and badged status items should collapse last. By default items overflow from the bottom up. A non-nil `additionalOverflowItems` always shows the overflow button. The keyboard and Picture in Picture in open portrait also shrink the bar.

#### When to turn vertical bars off

A single-page, bottom-heavy layout like a calculator, or a sheet whose only item is Close, may work better with horizontal bars.

#### Axis, edge, compression, and the off switch

The inferred axis is usually right — a title-only item stays horizontal, an item with an image goes vertical. Override it per item when a custom view, a wide control, or a symbol↔text toggle needs a specific axis. All of these are iOS 27.1; below that, items keep whatever axis the system infers, and the knobs don't exist. A build against the 27.0 SDK or earlier never sees a vertical bar at all.

```swift
// SwiftUI — iOS 27.1: per-item axis override, compression order, and the edge read
@available(iOS 27.1, *)
struct BarControls: View {
    @Environment(\.toolbarVerticalEdge) private var edge: HorizontalEdge?

    var body: some View {
        NavigationStack {
            SummaryView()
                .toolbar {
                    ToolbarItem {
                        Button("Select", systemImage: "checkmark.circle") { }
                    }
                    .axisBehavior(.horizontalOnly)   // symbol↔text toggles and wide controls stay horizontal
                    ToolbarItem {
                        Button("Compass", systemImage: "location.north.circle") { }
                    }
                    .axisBehavior(.verticalPreferred)   // opt a custom view in (icon items infer this already)
                }
                .toolbarVerticalCompressionBehavior(.prefersToolbarItems)   // tab bar compresses first
                .overlay(alignment: .bottom) {
                    // .leading / .trailing while a bar is vertical; nil when items can't go vertical
                    Text(edge == .trailing ? "Bar: trailing" : edge == .leading ? "Bar: leading" : "No vertical bar")
                        .font(.caption)
                }
        }
    }
}

@available(iOS 27.1, *)
struct HorizontalBarsOnly: View {
    var body: some View {
        SummaryView()
            .toolbarVerticalBehavior(.disabled)   // bottom-heavy screens keep horizontal bars
    }
}
```

```swift
// UIKit — iOS 27.1: the item's axis, the compression preference, the off switch, the edge
@available(iOS 27.1, *)
final class PlayerViewController: UIViewController {
    override var preferredVerticalBarBehavior: UIVerticalBarBehavior { .disabled }
}

@MainActor
func tuneVerticalBar(_ item: UIBarButtonItem, _ navigationItem: UINavigationItem, _ traits: UITraitCollection) {
    guard #available(iOS 27.1, *) else { return }   // below 27.1 the knobs don't exist; bars stay horizontal
    item.axisBehavior = .verticalPreferred          // .horizontalOnly keeps a wide custom view put
    navigationItem.verticalBarCompressionBehavior = .prefersBarItems   // keep the item; compress the tab bar
    if traits.verticalBarEdge == .trailing {
        // .leading / .trailing / .unspecified — inset the side that holds the bar
    }
}
```

## The Fold and the Camera

When iPhone Duo is partially folded, the display curves through the center and splits into regions. Two kinds of **reserved region** shape the usable space:

- **Division** — the fold. Active only while partially folded; zero width when flat. The element is a `ReservedRegion` (SwiftUI) or `UIView.ReservedRegion` (UIKit); both expose `frame`, `margins`, and `isActive`.
- **Occlusion** — the inner FaceTime camera. Active only while that camera runs.

The outer display's camera is always present — it shares the corner with the Dynamic Island, which expands for Live Activities — and the system accounts for it, including when bars go to the side (HIG).

#### Displacement rules

- Move, resize, or reorganize — never hide. Every function stays reachable in every pose.
- Move elements that work together as a unit; move independent elements alone.
- Avoid long moves; distance weakens the link between an element and its source.
- Scrolling content — articles, feeds, lists — never displaces; it already adapts by scrolling.
- Let purpose choose the destination. Book pose: alerts move to the trailing side, where they'll be when the device closes. Tabletop: content meant to be seen from a distance goes to the top region; tappable controls go to the bottom, a stable surface.
- Stay contextual: search stays over the view it searches.

System components already avoid the fold: sheets, alerts, action sheets, menus, popovers, and toolbar buttons, and split views rebalance to an even 50/50. Use them wherever you can.

#### Custom grids

These change spacing and column count, not which region content lives in, so they aren't displacement.

- **Keep each item inside one region while folded.** Preserve the outer margins and widen the spacing around the fold (Apple's Fitness example, 111463 5:56).
- **Consider an even column count.** Apple suggests preferring an even number of columns when a division region exists, active or not (111463 7:36). The middle gap lands on the fold only when the grid is centered on the display and the fold runs vertically through it, as in book pose; otherwise place the gap from the region's `frame`. `GridItem(.adaptive(minimum:))` picks its own count, which can be odd.
- **Find the fold.** Read the division region's `frame`, passing `.includeInactive` for the column decision. Below 27.1 only system components know where the fold is: don't hard-code the display's midpoint or check the device model.

```swift
// SwiftUI — iOS 27.1: the fold's and the camera's regions, in view coordinates
@available(iOS 27.1, *)
func foldGap(proxy: GeometryProxy) -> CGFloat {
    proxy.reservedRegions(kind: .division, options: .includeInactive)
        .filter(\.isActive)
        .map(\.frame.width)
        .max() ?? 0
}

// UIKit — iOS 27.1
@MainActor
func cameraOcclusionRect(in view: UIView) -> CGRect? {
    guard #available(iOS 27.1, *) else { return nil }
    return view.reservedRegions(kind: .occlusion).first?.frame
}
```

## Arrangements

An arrangement places a primary and a secondary view by rules — size classes, aspect ratio, and active fold regions. It sits between navigation containers and content containers.

- **Split** — main and detail content where neither view may be obscured, like a player and its transcript. The default style; it splits along the longer axis unless restricted. If the split can't use the view's long axis (e.g. `.axes(.horizontal)` in a tall view), it shows a single view (the primary, in the talk's example) — keep the secondary reachable another way.
- **Overlay** — a clear foreground and background, like controls over readable content. Closed or fully open, it layers the primary over the secondary; partially folded, the primary moves to the trailing (or bottom) region and the secondary to the leading (or top).
- Follow existing patterns: an HStack or VStack split becomes a split arrangement; a ZStack overlay becomes an overlay arrangement.
- Never nest a navigation container inside an arrangement, and never put an arrangement inside a `List` or `ScrollView`.
- Put it inside the navigation container — the talks nest it in a `NavigationStack` and make the UIKit controller the navigation root. Use it for split-like layout without a split view's expand/collapse.

The API is iOS 27.1; below that, use `NavigationSplitView` (or nested stacks) for the same jobs — arrangements don't exist there.

```swift
// SwiftUI — iOS 27.1: split or overlay by rules
@available(iOS 27.1, *)
struct PlayerScreen: View {
    var body: some View {
        NavigationStack {
            ArrangementView {
                PlayerView()
            } secondary: {
                UpNextView()
            }
            .arrangementViewStyle(.split.axes(.horizontal))   // or .overlay
        }
    }
}

@available(iOS 27.1, *)
struct PlayerView: View {
    var body: some View { Text("Now playing") }
}

@available(iOS 27.1, *)
struct UpNextView: View {
    @Environment(\.overlayArrangementZIndex) private var zIndex: Int   // changes as the device folds
    var body: some View { Text(zIndex > 0 ? "Collapsed" : "Expanded") }
}
```

```swift
// UIKit — iOS 27.1: the arrangement controller is the navigation root
@available(iOS 27.1, *)
@MainActor
final class ArrangementHost {
    let controller = UIArrangementViewController()

    func place(player: UIViewController, upNext: UIViewController) {
        controller.setViewController(player, for: .primary)
        controller.setViewController(upNext, for: .secondary)
        controller.updateArrangement(.split.axes(.horizontal))
    }

    func primaryZIndex() -> Int {
        controller.state(for: .primary)?.zIndex ?? 0
    }
}
```

## Hinge

The hinge reports a status — closed, partially open, fully open — and a continuous angle. Use it for effects and interactions, like a pitch bend or a zoom that follows the fold, never for layout. A missing hinge means the device has none; reset hinge-driven state whenever the device isn't partially open. The API is iOS 27.1; below that your app never sees hinge updates.

```swift
// SwiftUI — iOS 27.1
@available(iOS 27.1, *)
struct HingeDrivenView: View {
    @State private var bend = Angle.zero

    var body: some View {
        Text("Pitch bend")
            .rotationEffect(bend)
            .onHingeChange { _, new in
                if let hinge = new.hinge, hinge.status == .partiallyOpen {
                    bend = hinge.angle
                } else {
                    bend = .zero   // no hinge, or not partially open: reset
                }
            }
    }
}
```

```swift
// UIKit — iOS 27.1: the same state, delivered to an interaction
@available(iOS 27.1, *)
@MainActor
final class HingeObserver {
    private var interaction: UIHingeInteraction?

    func attach(to view: UIView, onChange: @escaping (UIHinge.Status, CGFloat) -> Void) {
        let interaction = UIHingeInteraction { _, update in
            guard let hinge = update.hinge else { return }   // nil: this hierarchy provides no hinge
            onChange(hinge.status, hinge.angle)              // angle is in radians
        }
        view.addInteraction(interaction)
        self.interaction = interaction
    }
}
```

## Scenes and Accessories

A **scene accessory** is supplementary content the system presents for you when a capability becomes available. The system decides when and where it appears, and your app must stay fully functional without it.

#### External-display accessory `iOS27`

Today's accessory targets an external display, connected or over AirPlay:

```swift
struct PresenterView: View {
    let deck: Deck
    @State private var showsAudienceView = true
    @State private var accessoryAvailable = false

    var body: some View {
        SlideEditor(deck: deck)
            .toolbar {
                ToolbarItem {
                    Toggle("Audience View", systemImage: "rectangle.on.rectangle", isOn: $showsAudienceView)
                        .disabled(!accessoryAvailable)
                }
            }
            .sceneAccessory {
                ExternalNonInteractiveAccessory(isEnabled: $showsAudienceView) {
                    AudienceSlide(deck: deck)
                }
                .onAvailabilityChange { accessoryAvailable = $0 }
            }
    }
}
```

Register the accessory on the view whose visibility should gate it.

#### The Duo camera accessory

On iPhone Duo, a camera variant shows UI on the outer display — a teleprompter, or something to show the person being photographed — while your camera UI runs on the inner display. It's available only while the app is full screen on the inner display with an active camera session, and it's iOS 27.1 — below that the type doesn't exist, so ship without it. Camera direction and the new front cameras: axiom-media (skills/camera-capture.md, skills/camera-capture-ref.md).

```swift
// SwiftUI — iOS 27.1: outer-display UI while an inner-display camera session runs
@available(iOS 27.1, *)
struct CameraScreen: View {
    @State private var showsOuterUI = true
    @State private var accessoryAvailable = false

    var body: some View {
        Text("Camera preview")
            .sceneAccessory {
                CameraCaptureAccessory(isEnabled: $showsOuterUI) {
                    Text("Teleprompter")
                }
                .onAvailabilityChange { accessoryAvailable = $0 }
            }
    }
}
```

UIKit registers the same content on the capture view controller and holds the returned registration:

```swift
// UIKit — iOS 27.1
@available(iOS 27.1, *)
@MainActor
final class ScriptSceneDelegate: NSObject, UIWindowSceneDelegate {
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        // connectionOptions.sceneAccessoryUserInfo carries the object you pass as userInfo, when you pass one
    }
}

@available(iOS 27.1, *)
@MainActor
final class CameraViewController: UIViewController {
    private var registration: UISceneAccessoryRegistration?

    override func viewDidLoad() {
        super.viewDidLoad()
        let configuration = UISceneConfiguration()
        configuration.delegateClass = ScriptSceneDelegate.self
        registration = registerSceneAccessory(
            .cameraCapture(sceneConfiguration: configuration)
        )
    }
}
```

Availability (`isAvailable`) and your on/off switch (`isEnabled`) are separate: the system decides when it can present, you decide whether to offer. Content appears only while the app is foreground, capturing, and on the inner display; it yields to the top-most registration of its kind, and goes away when capture stops, the app backgrounds, or the device closes — keep essential controls on the inner display and treat the accessory as an enhancement. Test on hardware; Simulator has no camera. Apple article: "Registering a camera capture accessory on iPhone Duo".

## Tooling and Testing

- **Device Hub** — Xcode 27.1's Device Hub drives an iPhone Duo simulator with open, close, rotate, and fold controls (111461 0:56); Apple's overview notes the Duo simulator in Device Hub requires Xcode 27.1. The device type creates against the **iOS 27.1 runtime**; the 27.0 runtime rejects it (`Incompatible device`). `iPhone Fold` is a different product.
- **Simulator gaps** — per the Xcode 27.1 beta release notes, StandBy is unavailable in the iPhone Duo Simulator runtime, and running and debugging most app extensions is unavailable there.
- **App Resizability** — Xcode's app-modernization agent skill, renamed "App Resizability", now covers SwiftUI and iPhone Duo (111461 9:15). See axiom-uikit (skills/uikit-modernization.md).

## Pressure Scenarios

#### "Ship Duo support by Friday — just check for the Duo model"
A model check covers one device and breaks in Split View and iPhone Mirroring. Size classes and per-side safe areas take the same time and cover every pose. Push back: "Size classes handle Duo and every future device; a model check handles one."

#### "That API doesn't exist — drop the Duo section"
The APIs come from Apple's September 2026 tech talks and shipped in the iOS 27.1 SDK. Keep the guidance, verify each name against the installed SDK, and where the SDK you build with is older, ship today's alternatives and say what the 27.1 rebuild brings (the bar behavior is link-time).

#### "Just hide the controls when it's folded"
Hiding ties functionality to a pose. Move the controls to the region that suits their purpose; system components already do this.

## Checklist

- ☑ No model, idiom, or orientation checks drive layout
- ☑ No `UIScreen.main`; geometry comes from the scene or the view
- ☑ Safe-area and margin math handles each side independently
- ☑ Corner configuration matches Duo's display corners; the outer display supports landscape
- ☑ Bars are system-managed; every item has a title and an image
- ☑ Items run back/close → prominent → the rest; overflow priorities are set
- ☑ New-window affordances are gated; scene-request errors are handled
- ☑ Interactive UI stays out of the fold through system components or displacement — never by hiding
- ☑ Tested closed, open in both orientations, partially folded, and in both halves of Split View
- ☑ 27.1 APIs carry `@available(iOS 27.1, *)`; the app still compiles against the older SDK you support

## Resources

**Tech Talks**: 111461, 111462, 111463, 111464, 111465, 111466

**Docs**: /swiftui/view/defaulttabbarplacement(_:), /swiftui/view/sceneaccessory(content:), /swiftui/externalnoninteractiveaccessory, /swiftui/environmentvalues/supportsmultiplewindows, /uikit/uiwindowscene/activationaction, /uikit/uiapplication/activatescenesession(for:errorhandler:), /uikit/uinavigationitem/pinnedtrailinggroup, /technologyoverviews/preparing-your-app-for-iphone-duo, /design/human-interface-guidelines/designing-for-iphone-duo

**Skills**: axiom-uikit (skills/uikit-modernization.md), skills/layout.md, skills/toolbars.md, skills/presentations.md, axiom-media (skills/camera-capture.md, skills/camera-capture-ref.md)
