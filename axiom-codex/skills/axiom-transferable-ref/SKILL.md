---
name: axiom-transferable-ref
description: Use when implementing drag and drop, copy/paste, ShareLink, or ANY content sharing between apps or views - covers Transferable protocol, TransferRepresentation types, UTType declarations, SwiftUI surfaces, and NSItemProvider bridging
license: MIT
metadata:
  version: "1.0.0"
---

# Transferable & Content Sharing Reference

Comprehensive guide to the CoreTransferable framework and SwiftUI sharing surfaces: drag and drop, copy/paste, and ShareLink.

## When to Use This Skill

- Implementing drag and drop (`.draggable`, `.dropDestination`)
- Adding copy/paste support (`.copyable`, `.pasteDestination`, `PasteButton`)
- Sharing content via `ShareLink`
- Making custom types transferable
- Declaring custom UTTypes for app-specific formats
- Bridging `Transferable` types with UIKit's `NSItemProvider`
- Choosing between `CodableRepresentation`, `DataRepresentation`, `FileRepresentation`, and `ProxyRepresentation`

## Example Prompts

"How do I make my model draggable in SwiftUI?"
"ShareLink isn't showing my custom preview"
"How do I accept dropped files in my view?"
"What's the difference between DataRepresentation and FileRepresentation?"
"How do I add copy/paste support for my custom type?"
"My drag and drop works within the app but not across apps"
"How do I declare a custom UTType?"

---

## Part 1: Quick Reference

### Decision Tree: Which TransferRepresentation?

```
Your model type...
├─ Conforms to Codable + no specific binary format needed?
│  → CodableRepresentation
├─ Has custom binary format (Data in memory)?
│  → DataRepresentation (exporting/importing closures)
├─ Lives on disk (large files, videos, documents)?
│  → FileRepresentation (passes file URLs, not bytes)
├─ Need a fallback for receivers that don't understand your type?
│  → Add ProxyRepresentation (e.g., export as String or URL)
└─ Need to conditionally hide a representation?
   → Apply .exportingCondition to any representation
```

### Common Errors

| Error / Symptom | Cause | Fix |
|-----------------|-------|-----|
| "Type does not conform to Transferable" | Missing `transferRepresentation` | Add `static var transferRepresentation: some TransferRepresentation` |
| Drop works in-app but not across apps | Custom UTType not declared in Info.plist | Add `UTExportedTypeDeclarations` entry |
| Receiver always gets plain text instead of rich type | ProxyRepresentation listed before CodableRepresentation | Reorder: richest representation first |
| FileRepresentation crashes with "file not found" | Receiver didn't copy file before sandbox extension expired | Copy to app storage in the importing closure |
| PasteButton always disabled | Pasteboard doesn't contain matching Transferable type | Check UTType conformance; verify the pasted data matches |
| ShareLink shows generic preview | No `SharePreview` provided or image isn't `Transferable` | Supply explicit `SharePreview` with title and image |
| `.dropDestination` closure never fires | Wrong payload type or view has zero hit-test area | Verify `for:` type matches dragged content; add `.frame()` or `.contentShape()` |

### Built-in Transferable Types

These work with zero additional code — no conformance needed:

`String`, `Data`, `URL`, `AttributedString`, `Image`, `Color`

---

## Part 2: Making Types Transferable

The `Transferable` protocol has one requirement: a static `transferRepresentation` property.

### CodableRepresentation

Best for: models already conforming to `Codable`. Uses JSON by default.

```swift
import UniformTypeIdentifiers

extension UTType {
    static var todo: UTType = UTType(exportedAs: "com.example.todo")
}

struct Todo: Codable, Transferable {
    var text: String
    var isDone: Bool

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .todo)
    }
}
```

Custom encoder/decoder (e.g., PropertyList instead of JSON):

```swift
CodableRepresentation(
    contentType: .todo,
    encoder: PropertyListEncoder(),
    decoder: PropertyListDecoder()
)
```

**Requirement**: Custom UTTypes need matching `UTExportedTypeDeclarations` in Info.plist (see Part 4).

### DataRepresentation

Best for: custom binary formats where data is in memory and you control serialization.

```swift
struct ProfilesArchive: Transferable {
    var profiles: [Profile]

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(contentType: .commaSeparatedText) { archive in
            try archive.toCSV()
        } importing: { data in
            try ProfilesArchive(csvData: data)
        }
    }
}
```

Import-only or export-only variants:

```swift
// Import only
DataRepresentation(importedContentType: .png) { data in
    try MyImage(pngData: data)
}

// Export only
DataRepresentation(exportedContentType: .png) { image in
    try image.pngData()
}
```

**Avoid** using `UTType.data` as the content type — use a specific type like `.png`, `.pdf`, `.commaSeparatedText`.

### FileRepresentation

Best for: large payloads on disk (videos, documents, archives). Passes file URLs instead of loading bytes into memory.

```swift
struct Video: Transferable {
    let file: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .mpeg4Movie) { video in
            SentTransferredFile(video.file)
        } importing: { received in
            // MUST copy — sandbox extension is temporary
            let dest = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("mp4")
            try FileManager.default.copyItem(at: received.file, to: dest)
            return Video(file: dest)
        }
    }
}
```

**Critical**: The `received.file` URL has a temporary sandbox extension. Copy the file to your own storage in the importing closure — the URL becomes inaccessible after the closure returns.

`SentTransferredFile` properties:
- `file: URL` — the file location
- `allowAccessingOriginalFile: Bool` — when `false` (default), receiver gets a copy

`ReceivedTransferredFile` properties:
- `file: URL` — the received file on disk
- `isOriginalFile: Bool` — whether this is the sender's original file or a copy

**Content type precision**: `.mpeg4Movie` only matches `.mp4` files. To accept all common video formats (`.mp4`, `.mov`, `.m4v`), use the parent type `.movie` — or declare multiple `FileRepresentation`s for specific subtypes:

```swift
// Broad: accept any video format the system recognizes
FileRepresentation(contentType: .movie) { ... } importing: { ... }

// Or specific: separate handlers per format
FileRepresentation(contentType: .mpeg4Movie) { ... } importing: { ... }
FileRepresentation(contentType: .quickTimeMovie) { ... } importing: { ... }
```

**Import-only**: When your type only receives files (drop target, no export), use the import-only initializer — it makes intent explicit and avoids accidental export:

```swift
FileRepresentation(importedContentType: .movie) { received in
    let dest = appStorageURL.appendingPathComponent(received.file.lastPathComponent)
    try FileManager.default.copyItem(at: received.file, to: dest)
    return VideoClip(localURL: dest)
}
```

### ProxyRepresentation

Best for: fallback representations that let your type work with receivers expecting simpler types.

```swift
struct Profile: Transferable {
    var name: String
    var avatar: Image

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .profile)
        ProxyRepresentation(exporting: \.name)  // Fallback: paste as text
    }
}
```

Export-only proxy (common pattern — reverse conversion often impossible):

```swift
ProxyRepresentation(exporting: \.name)  // Profile → String (one-way)
```

Bidirectional proxy (when reverse makes sense):

```swift
ProxyRepresentation { item in
    item.name  // export
} importing: { name in
    Profile(name: name)  // import
}
```

### Combining Multiple Representations

List representations in the `transferRepresentation` body. **Order matters** — receivers use the first representation they support.

```swift
struct Profile: Transferable {
    static var transferRepresentation: some TransferRepresentation {
        // 1. Richest: full profile data (apps that understand .profile)
        CodableRepresentation(contentType: .profile)
        // 2. Fallback: plain text (text fields, notes, any app)
        ProxyRepresentation(exporting: \.name)
    }
}
```

**Common mistake**: putting `ProxyRepresentation` first causes receivers that support both to always get the degraded version.

### Conditional Export

Hide a representation at runtime when conditions aren't met:

```swift
DataRepresentation(contentType: .commaSeparatedText) { archive in
    try archive.toCSV()
} importing: { data in
    try Self(csvData: data)
}
.exportingCondition { archive in
    archive.supportsCSV
}
```

### Visibility

Control which processes can see a representation:

```swift
CodableRepresentation(contentType: .profile)
    .visibility(.ownProcess)  // Only within this app
```

Options: `.all` (default), `.team` (same developer team), `.group` (same App Group, macOS), `.ownProcess` (same app only)

### Suggested File Name

Hint for receivers writing to disk:

```swift
FileRepresentation(contentType: .mpeg4Movie) { video in
    SentTransferredFile(video.file)
} importing: { received in
    // ...
}
.suggestedFileName("My Video.mp4")

// Or dynamic:
.suggestedFileName { video in video.title + ".mp4" }
```

---

## Part 3: SwiftUI Surfaces

### ShareLink

The standard sharing entry point. Accepts any `Transferable` type.

```swift
// Simple: share a string
ShareLink(item: "Check out this app!")

// With preview
ShareLink(
    item: photo,
    preview: SharePreview(photo.caption, image: photo.image)
)

// Share a URL with custom preview (prevents system metadata fetch)
ShareLink(
    item: URL(string: "https://example.com")!,
    preview: SharePreview("My Site", image: Image("hero"))
)
```

Sharing multiple items with per-item previews:

```swift
ShareLink(items: photos) { photo in
    SharePreview(photo.caption, image: photo.image)
}
```

`SharePreview` initializers:
- `SharePreview("Title")` — text only
- `SharePreview("Title", image: someImage)` — text + full-size image
- `SharePreview("Title", icon: someIcon)` — text + thumbnail icon
- `SharePreview("Title", image: someImage, icon: someIcon)` — all three

**Gotcha**: If you omit `SharePreview` for a custom type, the share sheet shows a generic preview. Always provide one for non-trivial types.

### Drag and Drop

**Making a view draggable:**

```swift
Text(profile.name)
    .draggable(profile)
```

With custom drag preview:

```swift
Text(profile.name)
    .draggable(profile) {
        Label(profile.name, systemImage: "person")
            .padding()
            .background(.regularMaterial)
    }
```

**Accepting drops:**

```swift
Color.clear
    .frame(width: 200, height: 200)
    .dropDestination(for: Profile.self) { profiles, location in
        guard let profile = profiles.first else { return false }
        self.droppedProfile = profile
        return true
    } isTargeted: { isTargeted in
        self.isDropTargeted = isTargeted
    }
```

**Multiple item types** — use an enum wrapper conforming to `Transferable` rather than stacking `.dropDestination` modifiers (stacking may cause only the outermost handler to fire):

```swift
enum DroppableItem: Transferable {
    case image(Image)
    case text(String)

    static var transferRepresentation: some TransferRepresentation {
        ProxyRepresentation { (image: Image) in DroppableItem.image(image) }
        ProxyRepresentation { (text: String) in DroppableItem.text(text) }
    }
}

myView
    .dropDestination(for: DroppableItem.self) { items, _ in
        for item in items {
            switch item {
            case .image(let img): handleImage(img)
            case .text(let str): handleString(str)
            }
        }
        return true
    }
```

**ForEach with reordering** — combine with `.onMove` or use `draggable`/`dropDestination` for cross-container moves.

### Clipboard (Copy/Paste)

**Copy support** (activates Edit > Copy / Cmd+C):

```swift
List(items) { item in
    Text(item.name)
}
.copyable(items)
```

**Paste support** (activates Edit > Paste / Cmd+V):

```swift
List(items) { item in
    Text(item.name)
}
.pasteDestination(for: Item.self) { pasted in
    items.append(contentsOf: pasted)
} validator: { candidates in
    candidates.filter { $0.isValid }
}
```

The validator closure runs before the action — return an empty array to prevent the paste.

**Cut support:**

```swift
.cuttable(for: Item.self) {
    let selected = items.filter { $0.isSelected }
    items.removeAll { $0.isSelected }
    return selected
}
```

**PasteButton** — system button that handles paste with type filtering:

```swift
PasteButton(payloadType: String.self) { strings in
    notes.append(contentsOf: strings)
}
```

Platform difference: PasteButton auto-validates pasteboard changes on iOS but not on macOS.

**Availability**: `.copyable`, `.pasteDestination`, and `.cuttable` are **macOS 13+ only** — they do not exist on iOS. On iOS, use `PasteButton` (iOS 16+) for paste, and standard context menus or `UIPasteboard` for programmatic copy/cut. `PasteButton` is cross-platform: macOS 10.15+, iOS 16+, visionOS 1.0+.

---

## Part 4: UTType Declarations

### System Types

Use Apple's built-in UTTypes when possible — they're already recognized across the system:

```swift
import UniformTypeIdentifiers

// Common types
UTType.plainText       // public.plain-text
UTType.utf8PlainText   // public.utf8-plain-text
UTType.json            // public.json
UTType.png             // public.png
UTType.jpeg            // public.jpeg
UTType.pdf             // com.adobe.pdf
UTType.mpeg4Movie      // public.mpeg-4
UTType.commaSeparatedText  // public.comma-separated-values-text
```

### Declaring Custom Types

**Step 1**: Declare in Swift:

```swift
extension UTType {
    static var recipe: UTType = UTType(exportedAs: "com.myapp.recipe")
}
```

**Step 2**: Add to Info.plist under `UTExportedTypeDeclarations`:

```xml
<key>UTExportedTypeDeclarations</key>
<array>
    <dict>
        <key>UTTypeIdentifier</key>
        <string>com.myapp.recipe</string>
        <key>UTTypeDescription</key>
        <string>Recipe</string>
        <key>UTTypeConformsTo</key>
        <array>
            <string>public.data</string>
        </array>
        <key>UTTypeTagSpecification</key>
        <dict>
            <key>public.filename-extension</key>
            <array>
                <string>recipe</string>
            </array>
        </dict>
    </dict>
</array>
```

**Both are required.** The Swift declaration alone makes it compile, but cross-app transfers silently fail without the Info.plist entry.

### Imported vs Exported Types

- **Exported** (`exportedAs:`) — Your app owns this type. Use for app-specific formats.
- **Imported** (`importedAs:`) — Another app owns this type. Use when you want to accept their format.

### UTType Conformance

Custom types should conform to system types for broader compatibility:

```swift
// Your .recipe conforms to public.data (binary data)
// This means any receiver that accepts generic data can also accept recipes
```

Common conformance parents: `public.data`, `public.content`, `public.text`, `public.image`

---

## Part 5: UIKit Bridging

### NSItemProvider + Transferable

Bridge between UIKit's `NSItemProvider` (used by `UIActivityViewController`, extensions, drag sessions) and `Transferable`:

```swift
// Load a Transferable from an NSItemProvider
let provider: NSItemProvider = // from drag session, extension, etc.
provider.loadTransferable(type: Profile.self) { result in
    switch result {
    case .success(let profile):
        // Use the profile
    case .failure(let error):
        // Handle error
    }
}
```

### When to Use UIActivityViewController

`ShareLink` covers most sharing needs. Use `UIActivityViewController` when you need:
- Custom activity items or excluded activity types
- `UIActivityItemsConfiguration` for lazy item provision
- Custom `UIActivity` subclasses
- Programmatic presentation control

```swift
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
```

For most apps, `ShareLink` is sufficient and preferred — it integrates with `Transferable` natively.

---

## Part 6: Gotchas & Troubleshooting

### FileRepresentation Temporary File Lifecycle

The `received.file` URL in a `FileRepresentation` importing closure has a temporary sandbox extension. The system may revoke access after the closure returns. Always copy the file:

```swift
// WRONG — file may become inaccessible
return Video(file: received.file)

// RIGHT — copy to your own storage
let dest = myAppDirectory.appendingPathComponent(received.file.lastPathComponent)
try FileManager.default.copyItem(at: received.file, to: dest)
return Video(file: dest)
```

### Async Work After File Drop

The `FileRepresentation` importing closure is synchronous — you cannot `await` inside it. Copy the file first, return the model, then do async post-processing (thumbnails, transcoding, metadata extraction) on the copied URL:

```swift
// WRONG — can't await in the importing closure
FileRepresentation(importedContentType: .movie) { received in
    let dest = ...
    try FileManager.default.copyItem(at: received.file, to: dest)
    let thumbnail = await generateThumbnail(for: dest)  // ❌ compile error
    return VideoClip(localURL: dest, thumbnail: thumbnail)
}

// RIGHT — return immediately, process async afterward
// In your view model or drop handler:
.dropDestination(for: VideoClip.self) { clips, _ in
    for clip in clips {
        timeline.append(clip)
        Task {
            // clip.localURL is the COPY — safe to access anytime
            let thumbnail = await generateThumbnail(for: clip.localURL)
            clip.thumbnail = thumbnail
        }
    }
    return true
}
```

### Representation Ordering

Representations are tried **in declaration order**. The receiver uses the first one it supports.

```swift
// WRONG — receivers always get plain text
static var transferRepresentation: some TransferRepresentation {
    ProxyRepresentation(exporting: \.name)   // ← every receiver supports String
    CodableRepresentation(contentType: .profile)  // ← never reached
}

// RIGHT — richest first, fallbacks last
static var transferRepresentation: some TransferRepresentation {
    CodableRepresentation(contentType: .profile)  // ← apps that understand Profile
    ProxyRepresentation(exporting: \.name)         // ← fallback for everyone else
}
```

### Custom UTType Without Info.plist

If you declare `UTType(exportedAs: "com.myapp.type")` in Swift but forget the Info.plist entry:
- In-app transfers work (same process recognizes the type)
- Cross-app transfers silently fail (other apps can't resolve the type)

This is the most common "works in development, fails in production" issue.

### Drop Target Hit Testing

`.dropDestination` requires the view to have a non-zero frame for hit testing. If drops aren't registering:

```swift
// WRONG — Color.clear has zero intrinsic size
Color.clear
    .dropDestination(for: Image.self) { ... }

// RIGHT — give it a frame
Color.clear
    .frame(width: 200, height: 200)
    .contentShape(Rectangle())  // ensure full area is hit-testable
    .dropDestination(for: Image.self) { ... }
```

### Async Loading with loadTransferable

`NSItemProvider.loadTransferable` is asynchronous. Update UI on the main actor:

```swift
provider.loadTransferable(type: Profile.self) { result in
    Task { @MainActor in
        switch result {
        case .success(let profile):
            self.profile = profile
        case .failure(let error):
            self.errorMessage = error.localizedDescription
        }
    }
}
```

### PasteButton Platform Differences

`PasteButton` auto-validates against pasteboard changes on iOS — the button enables/disables as the pasteboard content changes. On macOS, this automatic validation does not occur. If your macOS app needs dynamic paste validation, monitor `UIPasteboard.changedNotification` (UIKit) or `NSPasteboard` change count manually.

---

## Resources

**WWDC**: 2022-10062, 2022-10052, 2022-10023, 2022-10093, 2022-10095

**Docs**: /coretransferable/transferable, /coretransferable/choosing-a-transfer-representation-for-a-model-type, /coretransferable/filerepresentation, /coretransferable/proxyrepresentation, /swiftui/sharelink, /swiftui/drag-and-drop, /swiftui/clipboard, /uniformtypeidentifiers

**Skills**: axiom-photo-library, axiom-codable, axiom-swiftui-gestures, axiom-app-intents-ref
