# iPhone Duo

iPhone Duo is Apple's first two-display iPhone: an outer display, and a larger inner display that folds along a hinge. This skill covers adapting an app to it — the device model, what changes with the SDK you build against, vertical bars, the fold, and the new layout, hinge, and scene tools. SwiftUI comes first; the UIKit equivalent sits beside it.

## SDK Status — Read First

Apple announced the Duo-specific APIs in six tech talks (111461–111466, September 2026). They're announced for the **iOS 27.1 SDK**, which was unreleased — not even in beta — when this skill was written (2026-09-11). Everything marked iOS 27.0 or earlier compiles today.

- **Check the installed SDK first** (`xcrun --sdk iphoneos --show-sdk-version`). Below 27.1: never write an API from the table in code as if it compiles — describe it, name the talk, and give today's alternative. On 27.1 or later, betas included: grep the SDK's `.swiftinterface` and headers for the name; if it's there, the SDK's spelling and signature win over this table; if it's missing, say it was renamed or dropped.
- **Never call iPhone Duo or these APIs fictional, hallucinated, or unannounced.** They come from Apple's own tech talks.
- **Never invent parameters, types, or cases** the table doesn't give.

## When to Use This Skill

Use when:
- Preparing an app for iPhone Duo, a foldable iPhone, or a two-display iPhone
- Layout breaks in some poses — closed, open, rotated, or partially folded
- Toolbar, tab bar, or navigation bar items should move to the side of the screen
- Interactive UI lands in the fold or under the inner camera
- Choosing between reserved regions, arrangements, and the hinge
- Showing content on another display, or opening multiple windows on iPhone
- Code or a question names an API from the 27.1 table (`onHingeChange`, `ArrangementView`, `reservedRegions`, `axisBehavior`, …)

#### Related Skills
- axiom-uikit (skills/uikit-modernization.md) — the resizing baseline Duo builds on: scene lifecycle, geometry, size classes
- skills/layout.md — adaptive layout; the size-class truth tables include Duo
- skills/toolbars.md — SwiftUI placements, overflow, and visibility priority
- axiom-media (skills/camera-capture.md, skills/camera-capture-ref.md) — Duo front cameras and camera direction

## Example Prompts

#### 1. "How do I prepare my app for iPhone Duo?"
→ Readiness Today: resizing baseline, per-side safe areas, standard containers; build with the 27.1 SDK once it ships.

#### 2. "How do I detect that my app is running on iPhone Duo?"
→ Don't. It's still an iPhone app — use size classes and scene geometry.

#### 3. "My toolbar buttons should move to the side on iPhone Duo."
→ Vertical Bars: system-managed bars only, titles on every item, overflow priorities.

#### 4. "A button sits in the fold when the phone is partly closed."
→ The Fold and the Camera: displacement rules.

#### 5. "Can I use the hinge angle in my app?"
→ Hinge: effects and interactions, never layout.

#### 6. "Add .axisBehavior(.horizontalOnly) to my Select button"
→ Announced for 27.1 (table); 27.0 builds never get vertical bars — ship titles, images, and priorities now.

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
| Custom UI that must avoid the fold or the inner camera | Reserved regions | 27.1, announced |
| Two views that split side by side or overlay | Arrangements | 27.1, announced |
| An effect or interaction driven by the fold angle | Hinge | 27.1, announced |
| Extra content on another display | Scene accessories | Today for external displays; Duo camera variant 27.1, announced |
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

The Swift name is `UIWindowScene.ActivationAction`; the ObjC name `UIWindowSceneActivationAction` doesn't compile in Swift. The talks don't say whether `supportsMultipleWindows` updates live as the device closes — confirm on the Duo simulator once Xcode 27.1 ships.

#### Match the new corners and support landscape

`ConcentricRectangle` / `UICornerConfiguration` (iOS 26) are updated for Duo's display corners — skills/26-ref.md (Corner Concentricity). Support landscape on the outer display; people may set the phone down like a tent.

#### Test both halves of Split View

Drag the app to the left half, then the right. The vertical bar follows the app's outer edge, so the larger safe-area inset switches sides. The talks don't say which horizontal size class each half reports: check on the Duo simulator once Xcode 27.1 ships, and until then make the half's layout work at both size classes.

## Vertical Bars

Built against the 27.1 SDK, navigation, toolbar, and tab bar items share one vertical stack along the side — picture the horizontal bars rotated 90°. Only **system-managed bars** take part: `NavigationStack`, `NavigationSplitView`, or `TabView` with `.toolbar`, or `UINavigationController` and `UITabBarController` with items set on the view controller. The content of a custom `UIToolbar`, `UINavigationBar`, or `UITabBar` never joins the vertical bar; it stays where you put it.

#### Which bars go vertical

- Only a split view's detail column; other columns keep horizontal bars. Inspectors get no vertical bar.
- Sheets: on the outer display a sheet's toolbar goes vertical; on the inner display sheets center with horizontal bars. A sheet placed on the right gets a vertical bar; one on the left doesn't. The placement APIs — `.presentationPlacement(.trailing)` and `sheetPresentationController?.preferredPlacement = .trailing`, both iOS 27; the UIKit one is ignored when `sourceView` is set — take leading/trailing, but the rule is physical right/left.
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
- Custom views, complex views, and wide controls like segmented controls stay horizontal unless opted in (table).
- Vertical bars have a fixed width and flexible height; once a custom view opts in, it must fit that width or adapt its layout. Flexible spacers collapse to zero vertically; fixed spacers keep their minimum. Don't add extra spacing.
- Vertical bars have no scroll-edge effect but gain a background under Reduce Transparency — keep custom content legible either way.

#### Plan for overflow

The outer display in landscape overflows most. Decide per view whether the toolbar or the tab bar compresses first — navigation-focused views keep their tabs, task-focused views keep their actions. By default the toolbar compresses first and the tabs stay; a task-focused view opts into keeping its actions (announced API, table). Merge your own overflow menu into the system one, keep the ellipsis for overflow only, and rank items with `visibilityPriority`: frequent actions and badged status items should collapse last. By default items overflow from the bottom up. A non-nil `additionalOverflowItems` always shows the overflow button. The keyboard and Picture in Picture in open portrait also shrink the bar.

#### When to turn vertical bars off

A single-page, bottom-heavy layout like a calculator, or a sheet whose only item is Close, may work better with horizontal bars.

Axis overrides, the vertical-edge query, the compression preference, and the switch that turns vertical bars off are announced for 27.1 — see the table below.

## The Fold and the Camera

When iPhone Duo is partially folded, the display curves through the center and splits into regions. Two kinds of **reserved region** shape the usable space:

- **Division** — the fold. Active only while partially folded; zero width when flat.
- **Occlusion** — the inner FaceTime camera. Active only while that camera runs.

The outer display's camera is always present, and system bars already lay out around it.

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
- **Find the fold (27.1).** Read the division region's `frame`, passing `.includeInactive` for the column decision (SwiftUI; the table gives no UIKit spelling) — `regions.query` in the table below. Before 27.1, only system components know where the fold is: don't hard-code the display's midpoint or check the device model.

## Arrangements

An arrangement places a primary and a secondary view by rules — size classes, aspect ratio, and active fold regions. It sits between navigation containers and content containers.

- **Split** — main and detail content where neither view may be obscured, like a player and its transcript. The default style; it splits along the longer axis unless restricted. If the split can't use the view's long axis (e.g. `.axes(.horizontal)` in a tall view), it shows a single view (the primary, in the talk's example) — keep the secondary reachable another way.
- **Overlay** — a clear foreground and background, like controls over readable content. It layers one view over the other, and goes side by side when folded.
- Follow existing patterns: an HStack or VStack split becomes a split arrangement; a ZStack overlay becomes an overlay arrangement.
- Never nest a navigation container inside an arrangement, and never put an arrangement inside a `List` or `ScrollView`.
- Put it inside the navigation container — the talks nest it in a `NavigationStack` and make the UIKit controller the navigation root. Use it for split-like layout without a split view's expand/collapse.

The API is announced for 27.1 — see the table below.

## Hinge

The hinge reports a status — closed, partially open, fully open — and a continuous angle. Use it for effects and interactions, like a pitch bend or a zoom that follows the fold, never for layout. A missing hinge means the device has none; reset hinge-driven state whenever the device isn't partially open. The API is announced for 27.1 — see the table below.

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

On iPhone Duo, a camera variant shows UI on the outer display — a teleprompter, or something to show the person being photographed — while your camera UI runs on the inner display. It's available only while the app is full screen on the inner display with an active camera session, and it's announced for 27.1 (table below). Camera direction and the new front cameras: axiom-media (skills/camera-capture.md, skills/camera-capture-ref.md).

## Announced for the iOS 27.1 SDK

From Apple's tech talks 111461–111466. **Absent from the 27.0 SDK; announced for 27.1, and names can change before it ships. Don't write them in code as if they compile. Don't call them fictional. Don't fill in parameters, types, or cases this table doesn't give.** Spellings follow the talks' code where the narration differs. Re-check each Xcode release.

| Key | SwiftUI | UIKit | Behavior | Talk |
|---|---|---|---|---|
| `bars.axis` | `.axisBehavior(.verticalPreferred)` / `.horizontalOnly` on a `ToolbarItem` | `UIBarButtonItem.axisBehavior` | Overrides the inferred axis; custom views stay horizontal unless `.verticalPreferred` | 111462 8:08 |
| `bars.edge` | `@Environment(\.toolbarVerticalEdge)` | `traitCollection.verticalBarEdge` | Which edge holds the vertical bar; nil or unspecified when items can't go vertical | 111462 10:36 |
| `bars.compression` | `.toolbarVerticalCompressionBehavior(.prefersToolbarItems)` (narration: "toolbarCompressionBehavior") | `navigationItem.verticalBarCompressionBehavior = .prefersBarItems` | Chooses whether toolbar items or the tab bar compress first. Default: toolbar compresses first. `.prefersToolbarItems` / `.prefersBarItems`: the tab bar compresses first | 111462 12:23 |
| `bars.disable` | `.toolbarVerticalBehavior(.disabled)` | `override var preferredVerticalBarBehavior: UIVerticalBarBehavior` returning `.disabled` | Keeps horizontal bars | 111462 14:47 |
| `regions.query` | `GeometryProxy.reservedRegions(kind: .division` or `.occlusion`, `options: .includeInactive)` | `UIView.reservedRegions(kind:)` | Returns regions with a `frame` — elements are `ReservedRegion` / `UIViewReservedRegion` (111461 7:37); active ones only unless `.includeInactive`; for custom bars and edge-to-edge UI (111461 8:27) | 111463 6:46 |
| `arrangement.view` | `ArrangementView { primary } secondary: { … }` | `UIArrangementViewController` with `setViewController(_:for: .primary` / `.secondary)` | Two-view layout container | 111463 11:23 |
| `arrangement.style` | `.arrangementViewStyle(.split)`, `.split.axes(.horizontal)`, `.overlay` | `updateArrangement(_:)` with a `UISplitArrangement`, e.g. `.split.axes(.horizontal)` | Picks split or overlay; restricts split axes | 111463 12:00 |
| `arrangement.zindex` | `@Environment(\.overlayArrangementZIndex)` | `state(for: .primary)?.zIndex` | Overlay stacking order; changes as the device folds | 111463 14:07 |
| `hinge` | `.onHingeChange { old, new in }` — `new.hinge?.status == .partiallyOpen`, `.angle` (an `Angle`) | `UIHingeInteraction` | Hinge status and live angle; nil hinge on devices without one | 111464 1:44 |
| `accessory.camera` | `CameraCaptureAccessory { … }` or `CameraCaptureAccessory(isEnabled:) { … }`, with `.onAvailabilityChange`, inside `.sceneAccessory` | — | Outer-display UI during an inner-display camera session | 111464 5:43 |

- Xcode 27.1 Device Hub: an iPhone Duo simulator with open, close, rotate, and fold controls (111461 0:56).
- Xcode's app-modernization agent skill, renamed "App Resizability", now covers SwiftUI and iPhone Duo (111461 9:15).

## Pressure Scenarios

#### "Ship Duo support by Friday — just check for the Duo model"
A model check covers one device and breaks in Split View and iPhone Mirroring. Size classes and per-side safe areas take the same time and cover every pose. Push back: "Size classes handle Duo and every future device; a model check handles one."

#### "That API doesn't exist — drop the Duo section"
The APIs come from Apple's September 2026 tech talks and are announced for the iOS 27.1 SDK. Keep the guidance, write no code against the announced APIs, and ship today's alternatives.

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
- ☑ No 27.1 API appears in code as if it compiles

## Resources

**Tech Talks**: 111461, 111462, 111463, 111464, 111465, 111466

**Docs**: /swiftui/view/defaulttabbarplacement(_:), /swiftui/view/sceneaccessory(content:), /swiftui/externalnoninteractiveaccessory, /swiftui/environmentvalues/supportsmultiplewindows, /uikit/uiwindowscene/activationaction, /uikit/uiapplication/activatescenesession(for:errorhandler:), /uikit/uinavigationitem/pinnedtrailinggroup

**Skills**: axiom-uikit (skills/uikit-modernization.md), skills/layout.md, skills/toolbars.md, skills/presentations.md, axiom-media (skills/camera-capture.md, skills/camera-capture-ref.md)
