# Transferable & Content Sharing Reference

Comprehensive reference for the CoreTransferable framework and SwiftUI sharing surfaces — drag and drop, copy/paste, and ShareLink. Covers making custom types transferable, choosing the right TransferRepresentation, declaring UTTypes, and bridging with UIKit.

## When to Use This Reference

Use this reference when:
- Making a custom model type draggable or shareable
- Implementing drag and drop with `.draggable` / `.dropDestination`
- Adding copy/paste support with `.copyable` / `.pasteDestination`
- Sharing content via `ShareLink`
- Choosing between CodableRepresentation, DataRepresentation, FileRepresentation, and ProxyRepresentation
- Declaring custom UTTypes for app-specific formats
- Bridging Transferable types with UIKit's NSItemProvider

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I make my model draggable in SwiftUI?"
- "What's the difference between DataRepresentation and FileRepresentation?"
- "How do I add ShareLink with a custom preview?"
- "My drag and drop works in-app but not across apps"
- "How do I declare a custom UTType?"
- "How do I accept dropped files in my view?"
- "How do I add copy/paste support for my custom type?"

## What's Covered

- **TransferRepresentation decision tree** — Which representation to use for your data type
- **CodableRepresentation** — For Codable models with optional custom encoders
- **DataRepresentation** — For custom binary formats with import/export closures
- **FileRepresentation** — For large on-disk files with sandbox lifecycle management
- **ProxyRepresentation** — For fallback representations; declaration order matters
- **ShareLink + SharePreview** — SwiftUI sharing with customizable previews
- **Drag and drop** — `.draggable`, `.dropDestination`, custom previews
- **Clipboard** — `.copyable`, `.pasteDestination`, `.cuttable`, `PasteButton`
- **UTType declarations** — System types, custom types, Info.plist entries
- **UIKit bridging** — NSItemProvider.loadTransferable, UIActivityViewController

## Key Patterns

### Making a type shareable and draggable

```swift
extension UTType {
    static var recipe: UTType = UTType(exportedAs: "com.myapp.recipe")
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

### ShareLink with preview

```swift
ShareLink(
    item: recipe,
    preview: SharePreview(recipe.title, image: recipe.heroImage)
)
```

### Drag and drop

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

This page documents the `axiom-transferable-ref` skill. It covers the CoreTransferable framework and all SwiftUI surfaces that consume Transferable types (iOS 16+).

- For photo-specific picking and library access, see [photo-library-ref](./photo-library-ref)
- For gesture handling (tap, drag gesture state, composition), see [SwiftUI Gestures](/skills/ui-design/swiftui-gestures)
- For App Intents entity sharing with Transferable, see [app-intents-ref](./app-intents-ref)

## Related

- [photo-library-ref](./photo-library-ref) — PhotosPicker uses Transferable for image loading
- [app-intents-ref](./app-intents-ref) — AppEntity + Transferable intersection for system sharing
- [codable](/skills/persistence/codable) — Codable patterns that feed into CodableRepresentation
- [swiftui-26-ref](./swiftui-26-ref) — iOS 26 drag and drop enhancements
