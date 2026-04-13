
# macOS AppKit Interoperability

## When to Use This Skill

Use when:
- Embedding an AppKit view or view controller inside SwiftUI (NSViewRepresentable, NSViewControllerRepresentable)
- Hosting SwiftUI views inside an AppKit app (NSHostingController, NSHostingView)
- Menu bar commands, copy/paste, or keyboard shortcuts fail across the SwiftUI/AppKit boundary
- NSToolbar needs capabilities beyond SwiftUI's `.toolbar` modifier
- File panels need options that `.fileImporter` doesn't expose
- Drag and drop must cross the SwiftUI/AppKit boundary
- Responder chain or focus behavior breaks when mixing frameworks

#### Related Skills

- Use `axiom-uikit` for UIKit-SwiftUI bridging (same representable pattern, different types)
- Use `axiom-swiftui` skills for pure SwiftUI navigation, layout, and architecture

---

## Red Flags -- Anti-Patterns to Prevent

If you're doing ANY of these, STOP and use the patterns in this skill:

### 1. Fighting the responder chain instead of joining it

```swift
// WRONG -- manually forwarding selectors
override func keyDown(with event: NSEvent) {
    swiftUIView.handleKeyDown(event)  // bypasses responder chain
}
```
**Why this fails** SwiftUI views participate in the AppKit responder chain automatically. When an NSHostingView is in focus, selectors travel through SwiftUI's `onCommand`, `copyable`, `pasteDestination` modifiers. Manually forwarding events duplicates or breaks the chain.

### 2. Using NSOpenPanel when fileImporter suffices

```swift
// WRONG -- unnecessary AppKit drop-down for basic file picking
let panel = NSOpenPanel()
panel.allowedContentTypes = [.png]
panel.begin { response in ... }
```
**Why this fails** SwiftUI's `.fileImporter(isPresented:allowedContentTypes:)` handles single/multi-file picking with content types and works correctly with sandbox entitlements. Drop to NSOpenPanel only when you need `canChooseDirectories`, accessory views, or `canDownloadUbiquitousContents`.

### 3. Creating a new NSHostingView on every cell reuse

```swift
// WRONG -- destroys and rebuilds SwiftUI hierarchy each scroll
func collectionView(_ cv: NSCollectionView, ...) -> NSCollectionViewItem {
    let item = cv.makeItem(...)
    let hosting = NSHostingView(rootView: CellView(data: data))
    item.view.addSubview(hosting)  // new view every time
    return item
}
```
**Why this fails** Each `NSHostingView` creates a full SwiftUI view hierarchy. Rebuilding on every cell reuse causes jank during scrolling. Instead, create the hosting view once and update its `rootView` property.

### 4. Modifying frame/bounds on a hosted AppKit view

```swift
// WRONG -- conflicts with SwiftUI layout
func updateNSView(_ nsView: MyView, context: Context) {
    nsView.frame = CGRect(x: 0, y: 0, width: 300, height: 200)
}
```
**Why this fails** SwiftUI fully controls the layout of representable views through its own constraint system. Setting frame or bounds directly produces undefined behavior. Use SwiftUI's `.frame()` modifier on the representable instead.

### 5. Forgetting to update the coordinator in updateNSView

```swift
// WRONG -- coordinator holds stale bindings
func updateNSView(_ nsView: MyView, context: Context) {
    nsView.text = text
    // forgot: context.coordinator.parent = self
}
```
**Why this fails** The coordinator is created once and persists for the view's lifetime. If it holds a reference to the representable (for accessing bindings), that reference must be refreshed in every `updateNSView` call. Stale bindings cause writes to go nowhere.

---

## Direction Decision

The first question: which framework is the host, and which is the guest?

```
Mixing SwiftUI and AppKit?
|
+-- SwiftUI is the host, need an AppKit view inside it?
|   |
|   +-- Single NSView (text editor, custom control, map)
|   |   -> NSViewRepresentable
|   |
|   +-- NSViewController with lifecycle (document editor, media player)
|       -> NSViewControllerRepresentable
|
+-- AppKit is the host, need SwiftUI inside it?
    |
    +-- Need a view controller (split view item, sheet, popover, tab)?
    |   -> NSHostingController
    |
    +-- Need a raw view (collection cell, sidebar, subview)?
        -> NSHostingView
```

**Start with SwiftUI.** Only drop to AppKit when SwiftUI lacks the capability. Common reasons to cross the boundary:

| Need | SwiftUI equivalent | When AppKit is required |
|------|-------------------|----------------------|
| File picking | `.fileImporter` | Directory selection, accessory views, iCloud conflict resolution |
| Toolbar | `.toolbar` modifier | Item validation, custom views in toolbar, overflow behavior |
| Drag destination | `.onDrop`, `Transferable` | NSDraggingDestination for legacy pasteboard types |
| Text editing | `TextEditor` | NSTextView for rich text, custom input, TextKit 2 |
| Menu bar | `CommandMenu`, `CommandGroup` | Dynamic menus, `NSHostingMenu`, validateMenuItem |
| Responder commands | `onCommand`, `copyable` | Custom selectors not in SwiftUI's command set |

---

## SwiftUI to AppKit (NSViewRepresentable)

Use when SwiftUI needs to host an AppKit view. This is the most common bridging direction.

### Lifecycle

1. `makeCoordinator()` -- created once, lives as long as the view
2. `makeNSView(context:)` -- create the AppKit view, assign coordinator as delegate
3. `updateNSView(_:context:)` -- called on every SwiftUI state change; keep updates minimal
4. `dismantleNSView(_:coordinator:)` -- optional cleanup

### Canonical Example: Wrapping an AppKit Editor

```swift
struct ScriptEditorRepresentable: NSViewRepresentable {
    @Binding var sourceCode: String

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> ScriptEditorView {
        let editor = ScriptEditorView(frame: .zero)
        editor.delegate = context.coordinator
        return editor
    }

    func updateNSView(_ editor: ScriptEditorView, context: Context) {
        // Guard against redundant updates
        if editor.sourceCode != sourceCode {
            editor.sourceCode = sourceCode
        }
        editor.isEditable = context.environment.isEnabled
        // Keep coordinator's reference fresh
        context.coordinator.parent = self
    }

    class Coordinator: NSObject, ScriptEditorViewDelegate {
        var parent: ScriptEditorRepresentable

        init(parent: ScriptEditorRepresentable) {
            self.parent = parent
        }

        func sourceCodeDidChange(in view: ScriptEditorView) {
            parent.sourceCode = view.sourceCode
        }
    }
}
```

### Key Rules

- **Guard updates**: `updateNSView` is called frequently. Compare before setting properties to avoid unnecessary work.
- **Coordinator is the bridge**: It conforms to AppKit delegates and writes back to SwiftUI bindings.
- **Refresh the coordinator**: Always update `context.coordinator.parent = self` (or equivalent) in `updateNSView` so bindings stay current.
- **Environment propagation**: Read `context.environment` values (like `isEnabled`) in `updateNSView` and apply them to the AppKit view.
- **Never set frame/bounds**: SwiftUI owns layout. Use `.frame()` on the SwiftUI side.

---

## AppKit to SwiftUI (NSHostingController / NSHostingView)

Use when an AppKit app needs to embed SwiftUI content.

### NSHostingController -- for view controller contexts

Use with NSSplitViewController, sheets, popovers, modal windows, and tab view controllers.

```swift
// Sidebar in a split view
let sidebar = NSHostingController(rootView: SidebarView(model: selectionModel))
let item = NSSplitViewItem(viewController: sidebar)
splitViewController.addSplitViewItem(item)

// Sheet
viewController.presentAsSheet(NSHostingController(rootView: SheetContent()))

// Popover
viewController.present(
    NSHostingController(rootView: PopoverContent()),
    asPopoverRelativeTo: rect, of: view,
    preferredEdge: .maxY, behavior: .transient
)

// Modal window
let controller = NSHostingController(rootView: ModalView())
controller.title = "Settings"
viewController.presentAsModalWindow(controller)
```

**Sizing**: NSHostingController creates Auto Layout constraints from the SwiftUI view's ideal, minimum, and maximum sizes. Customize with:

```swift
controller.sizingOptions = [.minSize, .intrinsicContentSize, .maxSize]
```

Disable constraints you don't need for performance or when surrounding AppKit views already handle layout.

### NSHostingView -- for raw view contexts

Use in collection view cells, table view cells, and any place that needs an NSView rather than a view controller.

```swift
class ShortcutItemView: NSCollectionViewItem {
    private var hostingView: NSHostingView<ShortcutView>?

    func displayShortcut(_ shortcut: Shortcut) {
        let view = ShortcutView(shortcut: shortcut)

        if let hostingView {
            hostingView.rootView = view  // reuse existing hierarchy
        } else {
            let newHosting = NSHostingView(rootView: view)
            self.view.addSubview(newHosting)
            setupConstraints(for: newHosting)
            hostingView = newHosting
        }
    }
}
```

**Critical for performance**: Create the NSHostingView once, then set `rootView` on reuse. SwiftUI diffs the view hierarchy internally and only updates what changed.

### Shared State Between AppKit and SwiftUI

Use an `@Observable` model (or `ObservableObject` for pre-iOS 17) that both sides can access:

```swift
@Observable
class SelectionModel {
    var selectedItem: SidebarItem = .allShortcuts
}

// AppKit side: observe changes
let cancellable = selectionModel.$selectedItem.sink { newItem in
    detailViewController.showPage(for: newItem)
}

// SwiftUI side: bind directly
struct SidebarView: View {
    @Bindable var model: SelectionModel
    var body: some View {
        List(selection: $model.selectedItem) { ... }
    }
}
```

---

## Responder Chain and Focus

SwiftUI views hosted in AppKit participate in the same responder chain. This is the key mental model: they don't live in separate worlds.

### How it works

When an NSHostingView has focus, it becomes the first responder. Selectors from menu items travel through the responder chain just like they would for any AppKit view. SwiftUI intercepts them via modifiers.

### SwiftUI command modifiers

```swift
struct EditorView: View {
    var body: some View {
        ScrollView { ... }
            .focusable()
            .copyable { [selectedItem] }
            .cuttable { cut(selectedItem) }
            .pasteDestination(payloadType: String.self) { strings in
                paste(strings)
            }
            .onMoveCommand { direction in moveSelection(direction) }
            .onExitCommand { cancelOperation() }
            .onCommand(#selector(NSResponder.selectAll(_:))) {
                selectAllItems()
            }
            .onCommand(#selector(moveActionUp(_:))) {
                moveSelected(.up)
            }
    }
}
```

### Standard selectors handled by SwiftUI

| Modifier | Selector |
|----------|----------|
| `.copyable` | `copy:` |
| `.cuttable` | `cut:` |
| `.pasteDestination` | `paste:` |
| `.onCommand(#selector(...))` | Any custom or standard selector |
| `.onMoveCommand` | Arrow keys |
| `.onExitCommand` | Escape |

### Focus and Full Keyboard Navigation

- Use `.focusable()` to make non-interactive SwiftUI views participate in keyboard navigation
- Test with System Settings > Keyboard > Full Keyboard Navigation both on and off
- Use `@FocusState` and `.focused()` for programmatic focus control
- Some controls are only focusable when Full Keyboard Navigation is enabled

---

## NSToolbar Integration

SwiftUI's `.toolbar` modifier covers most toolbar needs. Drop to NSToolbar when you need:

- **Item validation** (`validateToolbarItem` for enabling/disabling based on state)
- **User customization** (`allowsUserCustomization` with persistent layout)
- **Centered item groups** (`centeredItemIdentifiers`)
- **Custom item views** beyond what SwiftUI toolbar content supports
- **Overflow behavior** control

### Bridging approach

Use `NSToolbar` on the window and populate items with `NSHostingView`-wrapped SwiftUI views for the best of both worlds:

```swift
func toolbar(_ toolbar: NSToolbar,
             itemForIdentifier identifier: NSToolbarItem.Identifier,
             willBeInsertedIntoToolbar: Bool) -> NSToolbarItem? {
    let item = NSToolbarItem(itemIdentifier: identifier)
    item.view = NSHostingView(rootView: MyToolbarButton())
    return item
}
```

---

## NSOpenPanel vs fileImporter

### Use `.fileImporter` when

- Picking files by content type (UTType)
- Single or multiple file selection
- Standard file picker UX is sufficient
- Working within sandbox (`.fileImporter` handles entitlements automatically)

```swift
.fileImporter(isPresented: $showPicker,
              allowedContentTypes: [.png, .jpeg],
              allowsMultipleSelection: true) { result in
    switch result {
    case .success(let urls): handleFiles(urls)
    case .failure(let error): handleError(error)
    }
}
```

### Use NSOpenPanel when

- Selecting directories (`canChooseDirectories`)
- Adding accessory views to the panel
- Handling iCloud conflicts (`canResolveUbiquitousConflicts`)
- Downloading ubiquitous content (`canDownloadUbiquitousContents`)
- Needing panel delegate callbacks for filtering beyond UTType

```swift
let panel = NSOpenPanel()
panel.canChooseDirectories = true
panel.canChooseFiles = false
panel.allowsMultipleSelection = false
panel.begin { response in
    guard response == .OK, let url = panel.url else { return }
    handleDirectory(url)
}
```

---

## Drag and Drop

### SwiftUI-native (preferred)

Use `Transferable` conformance with `.draggable()` and `.dropDestination()` when both sides are SwiftUI or when working with standard types.

### Bridging to AppKit drag destinations

When an NSView wrapped via NSViewRepresentable needs to accept drops, implement `NSDraggingDestination` on the AppKit view (or its coordinator) as usual. The representable pattern naturally supports this since you own the AppKit view creation.

When SwiftUI content needs to accept drops from AppKit views using legacy pasteboard types that `Transferable` doesn't cover, use `.onDrop(of:delegate:)` with `NSItemProvider` to access the raw pasteboard data.

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| New NSHostingView per cell reuse | Scroll jank, high memory | Create once, update `rootView` |
| Setting frame/bounds in updateNSView | Layout corruption | Use SwiftUI `.frame()` modifier |
| Stale coordinator bindings | Writes to SwiftUI state ignored | Update coordinator reference in `updateNSView` |
| Redundant property sets in updateNSView | Unnecessary AppKit view reloads | Compare before setting |
| Using NSOpenPanel for basic file picks | Unnecessary complexity, sandbox issues | Use `.fileImporter` first |
| Manual event forwarding | Duplicated or broken input | Let the responder chain work |
| Missing `.focusable()` on command receivers | `onCommand` modifiers silently ignored | Add `.focusable()` to the view |
| Forgetting Full Keyboard Navigation testing | Controls unreachable for keyboard users | Test with setting on and off |

## Resources

**WWDC**: 2022-10075

**Docs**: /swiftui/nsviewrepresentable, /swiftui/nsviewcontrollerrepresentable, /swiftui/nshostingcontroller, /swiftui/nshostingview, /appkit/nstoolbar, /appkit/nsopenpanel

**Skills**: axiom-uikit, axiom-swiftui
