---
name: axiom-tvos
description: Use when building ANY tvOS app - covers Focus Engine, Siri Remote input, storage constraints (no Document directory), no WebView, TVUIKit, TextField workarounds, AVPlayer tuning, Menu button state machines, and tvOS-specific gotchas that catch iOS developers
license: MIT
compatibility: tvOS 17+
metadata:
  version: "1.0.0"
  last-updated: "2026-02-23"
---

# tvOS Development

## Overview

tvOS shares UIKit and SwiftUI with iOS but diverges in critical ways that catch every iOS developer. The three most dangerous assumptions: (1) local files persist, (2) WebView exists, (3) focus works like @FocusState.

**Core principle** tvOS is not "iOS on TV." It has a dual focus system, no persistent local storage, no WebView, and a remote with two incompatible generations. Treat it as its own platform.

**tvOS 26** Adopts Liquid Glass design language with new app icon system. See `axiom-liquid-glass` for implementation patterns.

### tvOS Porting Triage

Before shipping a tvOS port, verify these five areas — they account for 90% of tvOS-specific bugs:

| Area | Check | Section |
|------|-------|---------|
| Storage | No persistent local files — iCloud required | §3 |
| Focus | Dual system working, focus guides for gaps | §1 |
| WebView | Replaced with JavaScriptCore or native rendering | §4 |
| Text input | Shadow input or fullscreen keyboard handled | §6 |
| AVPlayer | Audio session, buffer, Menu button state machine | §7, §8 |

"It compiles on tvOS" means nothing. These five areas compile fine and fail at runtime.

## When to Use This Skill

- Building a new tvOS app or adding tvOS target
- Porting an iOS app to tvOS
- Debugging focus, remote input, or storage issues on tvOS
- Working with AVPlayer, TVUIKit, or text input on tvOS

## Example Prompts

These are real questions developers ask that this skill answers:

#### 1. "I'm porting my iOS app to tvOS and focus navigation doesn't work"
-> The skill explains the dual focus system (UIKit Focus Engine vs @FocusState) and common traps

#### 2. "My tvOS app loses all data between launches"
-> The skill explains there is no persistent local storage and shows the iCloud-first pattern

#### 3. "How do I handle Siri Remote input in SwiftUI on tvOS?"
-> The skill covers both generations of remote and the three input layers (SwiftUI, UIKit gestures, GameController)

#### 4. "WebView doesn't work on tvOS, how do I display web content?"
-> The skill shows JavaScriptCore for parsing and native rendering alternatives

## Red Flags

If ANY of these appear, STOP:

- "I'll just use the same storage code as iOS" — tvOS has no Document directory
- "WebView will work for this" — No WebView on tvOS at all (Apple HIG: "Not supported in tvOS")
- "@FocusState handles focus" — tvOS has a dual focus system; @FocusState alone is incomplete
- "I'll save to Application Support" — It's Cache-only; the system deletes files when app is not running
- "Standard UITextField will work" — tvOS text input triggers a fullscreen keyboard; consider the shadow input pattern
- "I'll just use the same AVPlayer code" — tvOS needs .ambient audio session on launch, custom Menu button handling, and buffer tuning. Default iOS AVPlayer setup causes audio session conflicts and broken back navigation.

---

## 1. Focus Engine vs @FocusState

tvOS has two focus systems that must coexist. This is the #1 source of confusion for iOS developers.

### The Dual System

| System | Controls | API |
|--------|----------|-----|
| UIKit Focus Engine | Hardware remote navigation, directional scanning | UIFocusEnvironment, UIFocusSystem, UIFocusGuide |
| SwiftUI Focus | Programmatic focus binding, focus sections | @FocusState, .focused(), .focusable(), .focusSection() |

### When Each Applies

```
User swipes on remote → UIKit Focus Engine handles it (always)
Code sets @FocusState → SwiftUI handles it (sometimes overridden by Focus Engine)
```

**The trap**: @FocusState can set focus programmatically, but the UIKit Focus Engine is the ultimate authority. If the Focus Engine considers a view unfocusable, @FocusState assignments are silently ignored.

### UIKit Focus Engine API

The UIFocusEnvironment protocol (implemented by UIView, UIViewController, UIWindow) provides:

```swift
class MyViewController: UIViewController {
    // Priority-ordered list of where focus should go
    override var preferredFocusEnvironments: [UIFocusEnvironment] {
        [preferredButton, fallbackButton]
    }

    // Validate proposed focus changes
    override func shouldUpdateFocus(
        in context: UIFocusUpdateContext
    ) -> Bool {
        // Return false to block focus movement
        return context.nextFocusedView != disabledButton
    }

    // Respond to completed focus changes
    override func didUpdateFocus(
        in context: UIFocusUpdateContext,
        with coordinator: UIFocusAnimationCoordinator
    ) {
        coordinator.addCoordinatedAnimations {
            context.nextFocusedView?.transform = CGAffineTransform(scaleX: 1.1, y: 1.1)
            context.previouslyFocusedView?.transform = .identity
        }
    }

    // Request focus update (async)
    func moveFocusToPreferred() {
        setNeedsFocusUpdate()      // Schedule update
        updateFocusIfNeeded()       // Execute immediately
    }
}
```

### UIFocusGuide — Bridging Navigation Gaps

When focusable views aren't in a direct grid layout, the Focus Engine can't find them by scanning directionally. UIFocusGuide creates invisible focusable regions that redirect to real views:

```swift
let focusGuide = UIFocusGuide()
view.addLayoutGuide(focusGuide)

// Position the guide between two non-adjacent views
NSLayoutConstraint.activate([
    focusGuide.leadingAnchor.constraint(equalTo: leftButton.trailingAnchor),
    focusGuide.trailingAnchor.constraint(equalTo: rightButton.leadingAnchor),
    focusGuide.topAnchor.constraint(equalTo: leftButton.topAnchor),
    focusGuide.heightAnchor.constraint(equalTo: leftButton.heightAnchor)
])

// When focus enters the guide, redirect to the target view
focusGuide.preferredFocusEnvironments = [rightButton]
```

### SwiftUI Focus API

```swift
struct ContentView: View {
    @FocusState private var focusedItem: MenuItem?

    var body: some View {
        VStack {
            ForEach(MenuItem.allCases) { item in
                Button(item.title) { select(item) }
                    .focused($focusedItem, equals: item)
            }
        }
        .focusSection()       // Group focusable items for navigation
        .defaultFocus($focusedItem, .home)  // Set initial focus
    }
}
```

**Key SwiftUI focus modifiers for tvOS**:
- `.focused(_:equals:)` — Bind focus to a value
- `.focusable()` — Make custom views focusable
- `.focusSection()` — Group related items for directional navigation
- `.defaultFocus(_:_:)` — Set where focus starts in a scope

### Default Focusable Elements

UIButton, UITextField, UITableViewCell, and UICollectionViewCell are focusable by default. Custom views need `canBecomeFocused` (UIKit) or `.focusable()` (SwiftUI). The top-left item receives initial focus at launch.

### Common Focus Gotchas

| Gotcha | Symptom | Fix |
|--------|---------|-----|
| Non-focusable container | Swipe skips your view | Add `.focusable()` or override `canBecomeFocused` |
| Focus guide missing | Can't navigate to isolated view | Add UIFocusGuide to bridge the gap |
| @FocusState ignored | Programmatic focus doesn't work | Check preferredFocusEnvironments chain |
| Focus update not requested | Focus stays stale after layout change | Call setNeedsFocusUpdate() + updateFocusIfNeeded() |
| Items not in grid layout | Focus jumps unpredictably | Arrange focusable items in a grid or use focus guides |
| UIHostingConfiguration focus | Focus corruption in mixed UIKit/SwiftUI | Known issue — test UIHostingConfiguration cells carefully |

---

## 2. Siri Remote Input

Two generations with different hardware — your code must handle both.

### Generation Differences

| Feature | Gen 1 (2015-2021) | Gen 2 (2021+) |
|---------|-------------------|---------------|
| Top surface | Touchpad (full swipe) | Clickpad + outer touch ring |
| Swipe gestures | Full area | Ring edge only |
| Click navigation | Center press | D-pad style |
| Accelerometer | Yes | Yes |

### Standard SwiftUI Modifiers (Preferred)

For most UI, SwiftUI handles remote input automatically through the focus system:

```swift
Button("Play") { startPlayback() }
    .focused($isFocused)  // Automatically responds to remote navigation

List(items) { item in
    Text(item.title)
}
// List navigation works automatically with remote
// Note: First item receives focus by default on tvOS — use .defaultFocus() to override
```

### Gesture Recognizers (UIKit)

Detect specific button presses and gestures via UIKit recognizers:

```swift
// Detect Play/Pause button
let playPause = UITapGestureRecognizer(target: self, action: #selector(handlePlayPause))
playPause.allowedPressTypes = [NSNumber(value: UIPress.PressType.playPause.rawValue)]
view.addGestureRecognizer(playPause)

// Detect swipe on touchpad
let swipe = UISwipeGestureRecognizer(target: self, action: #selector(handleSwipe))
swipe.direction = .right
view.addGestureRecognizer(swipe)
```

**Available UIPress.PressType values**: `.menu`, `.playPause`, `.select`, `.upArrow`, `.downArrow`, `.leftArrow`, `.rightArrow`, `.pageUp`, `.pageDown`

### Low-Level Press Handling

For fine-grained control, override UIResponder press methods:

```swift
override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    for press in presses {
        if press.type == .select {
            handleSelectDown()
        }
    }
}

override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    for press in presses {
        if press.type == .select {
            handleSelectUp()
        }
    }
}

// Always implement all four: pressesBegan, pressesEnded, pressesChanged, pressesCancelled
```

### Game Controller Framework (Raw Input)

For custom interactions (scrubbing, games), access the Siri Remote as a GCMicroGamepad:

```swift
import GameController

NotificationCenter.default.addObserver(
    forName: .GCControllerDidConnect, object: nil, queue: .main
) { notification in
    guard let controller = notification.object as? GCController,
          let micro = controller.microGamepad else { return }

    // Touchpad as analog D-pad (-1.0 to 1.0)
    micro.dpad.valueChangedHandler = { _, xValue, yValue in
        handleRemoteInput(x: xValue, y: yValue)
    }

    // reportsAbsoluteDpadValues: true = absolute position, false = relative movement
    micro.reportsAbsoluteDpadValues = false

    // allowsRotation: true = values adjust when remote is rotated
    micro.allowsRotation = false

    // Face buttons
    micro.buttonA.pressedChangedHandler = { _, _, pressed in }
    micro.buttonX.pressedChangedHandler = { _, _, pressed in }
    micro.buttonMenu.pressedChangedHandler = { _, _, pressed in }
}
```

### Progress Bar Scrubbing

UIPanGestureRecognizer with virtual damping for smooth seeking:

```swift
let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan))

@objc func handlePan(_ gesture: UIPanGestureRecognizer) {
    let velocity = gesture.velocity(in: view)
    let dampingFactor: CGFloat = 0.002  // Tune for feel

    switch gesture.state {
    case .changed:
        let seekDelta = velocity.x * dampingFactor
        player.seek(to: currentTime + seekDelta)
    default:
        break
    }
}
```

---

## 3. Storage Constraints

**This is the most dangerous iOS assumption on tvOS.** tvOS has no Document directory. All local storage is Cache that the system can delete at any time. Skipping iCloud integration means 2-3 weeks debugging intermittent "data disappears" bugs that only happen on real devices between app launches.

From Apple's App Programming Guide for tvOS: "Every app developed for the new Apple TV **must be able to store data in iCloud** and retrieve it in a way that provides a great customer experience."

### What tvOS Has

| Directory | Exists? | Persistent? |
|-----------|---------|-------------|
| Documents | No | N/A |
| Application Support | Yes | No — system can delete when app is not running |
| Caches | Yes | No — system deletes under storage pressure |
| tmp | Yes | No |

### Size Limits

- **App bundle**: 4 GB maximum
- **NSUserDefaults / UserDefaults**: 500 KB maximum (Apple docs; not the 4 MB iOS gets). Available but subject to system purge — not guaranteed persistent between sessions
- **On-demand resources**: Available for read-only assets the OS manages
- **Local cache**: No guaranteed size; system can purge while app is not running

### What This Means

- Every local file can vanish between app launches
- SQLite databases stored locally will be deleted
- Your app must survive with zero local data
- Downloaded data is NOT deleted while the app is running — only between sessions

### Recommended Pattern

```swift
// ✅ CORRECT: iCloud as primary, local as cache only
func loadData() async throws -> [Item] {
    // 1. Try iCloud first (persistent)
    if let cloudData = try? await fetchFromICloud() {
        // Cache locally for offline use
        try? cacheLocally(cloudData)
        return cloudData
    }

    // 2. Fall back to local cache (may not exist)
    if let cached = try? loadFromLocalCache() {
        return cached
    }

    // 3. Start fresh — this is normal on tvOS
    return []
}
```

### Database Recommendations

| Solution | tvOS Viability | Notes |
|----------|---------------|-------|
| SQLiteData + CloudKit SyncEngine | Recommended | iCloud is persistent; local is just cache |
| SwiftData + CloudKit | Works, but fragile | No persistent local-only storage; ModelContainer must be configured for CloudKit from day one — adding sync later requires migration; system database deletion triggers full re-sync on next launch |
| CoreData + CloudKit | Dangerous | Space inflation from CloudKit metadata |
| Local-only GRDB/SQLite | Unreliable | System deletes the database file |
| NSUbiquitousKeyValueStore | Good for small data | 1 MB limit, key-value only |
| On-demand resources | Good for read-only assets | OS manages download/purge lifecycle |

**See** `axiom-sqlitedata` for CloudKit SyncEngine patterns, `axiom-storage` for full storage decision tree.

---

## 4. No WebView

tvOS has no WKWebView, no SFSafariViewController, no WebView. Apple HIG explicitly states: web views are "Not supported in tvOS."

### What You Can Do

| Need | Solution |
|------|----------|
| Parse HTML/JSON | Use JavaScriptCore (JSContext, JSValue — no DOM) |
| Display web content | Render natively from parsed data |
| HLS streaming from m3u8 | Local HTTP server pattern (see below) |
| OAuth login | Device code flow (RFC 8628) or companion device |

### JavaScriptCore for Parsing

JavaScriptCore provides a JavaScript execution engine without DOM or web rendering. Available on tvOS.

```swift
import JavaScriptCore

let context = JSContext()!

// Evaluate scripts
context.evaluateScript("""
    function parsePlaylist(m3u8Text) {
        return m3u8Text.split('\\n')
            .filter(line => !line.startsWith('#'))
            .filter(line => line.trim().length > 0);
    }
""")

// Pass data safely via setObject (avoids injection)
context.setObject(m3u8Content, forKeyedSubscript: "rawContent" as NSString)
let result = context.evaluateScript("parsePlaylist(rawContent)")

// Convert back to Swift types
let segments = result?.toArray() as? [String] ?? []
```

**Key classes**: JSVirtualMachine (execution environment), JSContext (script evaluation), JSValue (type bridging)

**Limitation**: No DOM, no web rendering, no fetch/XMLHttpRequest. Pure JavaScript execution only.

### Local HTTP Server for HLS

When you need to serve modified m3u8 playlists to AVPlayer:

```swift
// Use Swifter (httpswift/swifter) or GCDWebServer
// Serve rewritten m3u8 on localhost, point AVPlayer to it
let localURL = URL(string: "http://localhost:8080/playlist.m3u8")!
let playerItem = AVPlayerItem(url: localURL)
```

---

## 5. TVUIKit Components

tvOS-exclusive UIKit components. Bridge to SwiftUI via UIViewRepresentable.

### TVPosterView

Media content display with built-in focus expansion and parallax:

```swift
import TVUIKit

let poster = TVPosterView(image: UIImage(named: "moviePoster"))
poster.title = "Movie Title"
poster.subtitle = "2024"

// Focus expansion and parallax happen automatically
// Access the underlying image view:
poster.imageView.adjustsImageWhenAncestorFocused = true
```

### TVLockupView

Base class for TVPosterView — a flexible container managing content with focus behavior:

```swift
let lockup = TVLockupView()
lockup.contentView.addSubview(customView)
lockup.headerView = headerFooter   // TVLockupHeaderFooterView
lockup.footerView = footerFooter
// showsOnlyWhenAncestorFocused: header/footer visibility on focus
```

### Other TVUIKit Components

| Component | Purpose |
|-----------|---------|
| TVCardView | Simple container with customizable background |
| TVCaptionButtonView | Button with image + text + directional parallax |
| TVMonogramView | User initials/image with PersonNameComponents |
| TVCollectionViewFullScreenLayout | Immersive full-screen collection with parallax + masking |
| TVMediaItemContentView | Content configuration with badges, playback progress |

### TVDigitEntryViewController

System-provided passcode/PIN entry (tvOS 12+):

```swift
let digitEntry = TVDigitEntryViewController()
digitEntry.numberOfDigits = 4
digitEntry.titleText = "Enter PIN"
digitEntry.promptText = "Enter your parental control code"
digitEntry.isSecureDigitEntry = true

present(digitEntry, animated: true)

digitEntry.entryCompletionHandler = { pin in
    guard let pin else { return }  // User cancelled
    authenticate(with: pin)
}

// Reset entry
digitEntry.clearEntry(animated: true)
```

---

## 6. Text Input on tvOS

tvOS text input is fundamentally different from iOS. Apple recommends minimizing text input in your UI.

### Three Approaches

| Approach | Best For | Keyboard Style |
|----------|----------|---------------|
| UIAlertController | Quick, simple input | Modal with text field |
| UITextField | Multi-field forms | Fullscreen keyboard with Next/Previous |
| UISearchController | Search | Inline single-line keyboard |

### UITextField (Fullscreen Keyboard)

The primary text input method. Calling `becomeFirstResponder()` presents a fullscreen keyboard:

```swift
let textField = UITextField()
textField.placeholder = "Enter name"
textField.becomeFirstResponder()  // Presents keyboard immediately
// Done button returns user to previous page
// Built-in Next/Previous buttons navigate between text fields
```

### Shadow Input Pattern (SwiftUI)

When you want a custom-styled input trigger in SwiftUI:

```swift
struct TVTextInput: View {
    @State private var text = ""
    @State private var isEditing = false

    var body: some View {
        Button {
            isEditing = true
        } label: {
            HStack {
                Text(text.isEmpty ? "Search..." : text)
                    .foregroundStyle(text.isEmpty ? .secondary : .primary)
                Spacer()
                Image(systemName: "keyboard")
            }
            .padding()
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .sheet(isPresented: $isEditing) {
            TVKeyboardSheet(text: $text)
        }
    }
}
```

### UISearchController (Inline Keyboard)

For search interfaces — all input on a single line, but very limited customization:

```swift
let searchController = UISearchController(searchResultsController: resultsVC)
searchController.searchResultsUpdater = self
// Cannot customize text traits or add input accessories
```

### SwiftUI `.searchable()`

SwiftUI's `.searchable()` modifier works on tvOS and presents the system search keyboard. Use it for standard search patterns:

```swift
NavigationStack {
    List(filteredItems) { item in
        Text(item.title)
    }
    .searchable(text: $searchText, prompt: "Search movies")
}
```

For custom search UI beyond what `.searchable()` offers, fall back to the shadow input pattern above.

---

## 7. AVPlayer Tuning

tvOS media apps need specific AVPlayer configuration for good UX.

### Essential Settings

```swift
let player = AVPlayer(url: streamURL)

// automaticallyWaitsToMinimizeStalling defaults to true (iOS 10+/tvOS 10+)
// Set false for immediate playback when synchronizing players
// or when you want playback to start ASAP from a non-empty buffer
player.automaticallyWaitsToMinimizeStalling = false

// Buffer hint — 0 means system chooses automatically
// Higher values reduce stalling risk but consume more memory
player.currentItem?.preferredForwardBufferDuration = 30

// Audio session — don't interrupt other apps' audio on launch
try AVAudioSession.sharedInstance().setCategory(.ambient)
// Switch to .playback when user presses play
```

### Custom Dismiss Logic

The default swipe-down gesture dismisses the player. Override for media apps:

```swift
class PlayerViewController: AVPlayerViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        // Handle Menu button for custom back navigation
        let menuPress = UITapGestureRecognizer(
            target: self, action: #selector(handleMenu)
        )
        menuPress.allowedPressTypes = [
            NSNumber(value: UIPress.PressType.menu.rawValue)
        ]
        view.addGestureRecognizer(menuPress)
    }

    @objc func handleMenu() {
        if isShowingControls {
            hideControls()
        } else {
            dismiss(animated: true)
        }
    }
}
```

---

## 8. Menu Button State Machine

The Siri Remote Menu button doubles as "back" and "dismiss." Media apps need a state machine to handle it correctly.

### The Problem

```
State: Playing with controls visible
  Menu press → Hide controls (not dismiss)

State: Playing with controls hidden
  Menu press → Show "are you sure?" or dismiss

State: In submenu/settings overlay
  Menu press → Close overlay (not dismiss player)
```

### Pattern

```swift
enum PlayerState {
    case loading        // Buffering / loading content
    case playing        // Controls hidden
    case controlsShown  // Controls visible
    case submenu        // Settings/subtitles overlay
}

func handleMenuPress(in state: PlayerState) -> PlayerState {
    switch state {
    case .submenu:
        dismissSubmenu()
        return .controlsShown
    case .controlsShown:
        hideControls()
        return .playing
    case .playing:
        dismiss(animated: true)
        return .playing
    case .loading:
        cancelLoading()
        dismiss(animated: true)
        return .loading
    }
}
```

---

## 9. Network Differences

### IPv6 Priority

Apple TV strongly prefers IPv6. All App Store apps must support IPv6-only networks (DNS64/NAT64). If your backend is IPv4-only, connections may be slower or fail on some networks.

### Device Performance Variance

| Device | Chip | RAM | Notes |
|--------|------|-----|-------|
| Apple TV HD (4th gen) | A8 | 2 GB | Still supported; much slower |
| Apple TV 4K (1st gen) | A10X | 3 GB | Capable |
| Apple TV 4K (2nd gen) | A12 | 4 GB | Good |
| Apple TV 4K (3rd gen) | A15 | 4 GB | Excellent |

**Test on older hardware.** The Apple TV HD is still in use and dramatically slower than 4K models.

---

## 10. Developer Experience

### Debug-Only Input Macros

Test without Siri Remote in Simulator using keyboard shortcuts:

```swift
#if DEBUG
extension View {
    func debugOnlyModifier() -> some View {
        self.onKeyPress(.space) {
            print("Space pressed — simulating select")
            return .handled
        }
    }
}
#endif
```

### View Inspection Helper

```swift
#if DEBUG
extension View {
    func debugBorder() -> some View {
        border(.red, width: 1)
    }
}
#endif
```

### Simulator Limitations

- Simulator does not accurately simulate Focus Engine behavior
- Always test focus navigation on a real Apple TV device
- Simulator keyboard input != Siri Remote input
- Performance profiling must happen on device (especially Apple TV HD)

---

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just use the same code as iOS" | tvOS diverges in storage, focus, input, and web views. You will hit walls. |
| "Focus works like iOS" | tvOS has a dual focus system (UIKit Focus Engine + SwiftUI @FocusState). @FocusState alone is insufficient. |
| "Local storage is fine for now" | There is no persistent local storage on tvOS. Apple requires iCloud capability. |
| "WebView will work" | Apple HIG: web views are "Not supported in tvOS." JavaScriptCore only (no DOM). |
| "I'll handle text input with TextField" | UITextField triggers a fullscreen keyboard. Consider shadow input pattern or UISearchController for better UX. |
| "I only need to test on Simulator" | Focus Engine and performance require real device testing. |

---

## Resources

**Source**: "Surviving tvOS" (Ronnie Wong, 2026) — tvOS engineering log for Syncnext media player

**Apple Docs**: /tvuikit, /uikit/uifocusenvironment, /uikit/uifocusguide, /swiftui/focus, /gamecontroller/gcmicrogamepad, /avfoundation/avplayer, /javascriptcore

**Apple Guides**: App Programming Guide for tvOS (storage, input, gestures), HIG Web Views (tvOS exclusion)

**WWDC**: 2016-215, 2017-224, 2021-10023, 2021-10081, 2021-10191, 2023-10162, 2025-219

**Skills**: axiom-storage, axiom-sqlitedata, axiom-avfoundation-ref, axiom-hig-ref, axiom-liquid-glass
