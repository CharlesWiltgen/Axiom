# Transferable and Content Sharing Reference

Reference for the CoreTransferable framework and the SwiftUI surfaces that use it: drag and drop, copy and paste, and `ShareLink`. It covers making custom types transferable, choosing a transfer representation, declaring UTTypes, and bridging to UIKit.

## When to Use This Reference

Use this reference when:
- Making a custom model type draggable or shareable
- Implementing drag and drop with `.draggable` and `.dropDestination`
- Adding copy and paste with `.copyable`, `.pasteDestination`, or `PasteButton`
- Sharing content with `ShareLink`
- Choosing between `CodableRepresentation`, `DataRepresentation`, `FileRepresentation`, and `ProxyRepresentation`
- Declaring custom UTTypes for app-specific formats
- Bridging `Transferable` types to UIKit's `NSItemProvider`

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "How do I make my model draggable in SwiftUI?"
- "What's the difference between DataRepresentation and FileRepresentation?"
- "How do I add a ShareLink with a custom preview?"
- "Why does my drag and drop work in my app but not across apps?"
- "How do I declare a custom UTType?"
- "How do I accept dropped files in my view?"
- "How do I add copy and paste support for my custom type?"
- "How do file promises work when dragging to Finder?"
- "Why does my drop target stop working when the window resizes mid-drag?"
- "How does a drop destination find out which of my items was dragged?" (iOS 27.3)

## What's Covered

- **Choosing a representation** – A decision tree that picks the `TransferRepresentation` for your data type
- `CodableRepresentation` – Codable models, with optional custom encoders
- `DataRepresentation` – Custom binary formats with import and export closures
- `FileRepresentation` – Large on-disk files and the temporary-file lifecycle
- `ProxyRepresentation` – Fallback representations, and why declaration order matters
- **Export controls** – Combining representations, conditional export, visibility, suggested file names
- `ShareLink` and `SharePreview` – SwiftUI sharing with custom previews
- **Drag and drop** – `.draggable`, `.dropDestination`, custom drag previews, multiple item types, and the `Identifiable` `draggable(_:containerNamespace:)` overloads with `DropSession.LocalSession.draggedItemIDs(for:)` that keep an item's identity (iOS, macOS, and visionOS 27.3)
- **Clipboard** – `.copyable`, `.pasteDestination`, `.cuttable`, `PasteButton`, and their platform differences
- **UTType declarations** – System types, custom types, Info.plist entries, `UTType.markdown` and `UTType(identifier:allowUndeclared:)` (iOS 27)
- **UIKit bridging** – `NSItemProvider.loadTransferable`, `UIActivityViewController`
- **Promised files** – `NSFilePromiseProvider` and `NSFilePromiseReceiver` for drags to Finder on the Mac
- **Drop targets during reflow** – Keeping drop handling correct when the window resizes mid-drag
- **Troubleshooting** – A table of common errors and their fixes

## Key Patterns

### Making a Type Shareable and Draggable

```swift
extension UTType {
    static var recipe: UTType { UTType(exportedAs: "com.myapp.recipe") }
}

struct Recipe: Codable, Transferable {
    var title: String
    var ingredients: [String]

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .recipe)
        ProxyRepresentation(exporting: \.title)  // Fallback: plain text
    }
}
```

### ShareLink with a Preview

```swift
ShareLink(
    item: recipe,
    preview: SharePreview(recipe.title, image: recipe.heroImage)
)
```

### Drag and Drop

```swift
Text(recipe.title)
    .draggable(recipe)

Color.clear
    .frame(width: 200, height: 200)
    .dropDestination(for: Recipe.self) { recipes, location in
        guard let recipe = recipes.first else { return false }
        self.droppedRecipe = recipe
        return true
    }
```

## Documentation Scope

This page documents the `transferable-ref` skill in the `axiom-swift` suite. Most of what it covers needs iOS 16; the `.copyable`, `.pasteDestination`, and `.cuttable` modifiers need iOS 27 on iPhone and iPad, and macOS 13 on the Mac.

- For photo picking and library access, see [photo-library-ref](/reference/photo-library-ref)
- For gesture handling (taps, drag gesture state, composition), see [SwiftUI Gestures](/skills/ui-design/swiftui-gestures)
- For sharing App Intents entities through `Transferable`, see [app-intents-ref](/reference/app-intents-ref)

## Related

- [codable](/skills/persistence/codable) – The Codable patterns that `CodableRepresentation` builds on
- [swiftui-26-ref](/reference/swiftui-26-ref) – Multi-item and container-based dragging, new in iOS 27 and macOS 26
