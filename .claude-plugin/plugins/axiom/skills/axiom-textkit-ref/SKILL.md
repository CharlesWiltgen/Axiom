---
name: axiom-textkit-ref
description: TextKit 2 complete reference (architecture, migration, Writing Tools, SwiftUI TextEditor) through iOS 26
user-invocable: true
---

# TextKit 2 Reference

Complete reference for TextKit 2 covering architecture, migration from TextKit 1, Writing Tools integration, and SwiftUI TextEditor with AttributedString through iOS 26.

## Architecture

TextKit 2 uses MVC pattern with new classes optimized for correctness, safety, and performance.

### Model Layer

**NSTextContentManager** (abstract)
- Generates NSTextElement objects from backing store
- Tracks element ranges within document
- Default implementation: NSTextContentStorage

**NSTextContentStorage**
- Uses NSTextStorage as backing store
- Automatically divides content into NSTextParagraph elements
- Generates updated elements when text changes

**NSTextElement** (abstract)
- Represents portion of content (paragraph, attachment, custom type)
- Immutable value semantics
- Properties cannot change after creation
- Default implementation: NSTextParagraph

**NSTextParagraph**
- Represents single paragraph
- Contains range within document

### Controller Layer

**NSTextLayoutManager**
- Replaces TextKit 1's NSLayoutManager
- **NO glyph APIs** (abstracts away glyphs entirely)
- Takes elements, lays out into container, generates layout fragments
- Always uses noncontiguous layout

**NSTextLayoutFragment**
- Immutable layout information for one or more elements
- Key properties:
  - `textLineFragments` — array of NSTextLineFragment
  - `layoutFragmentFrame` — layout bounds within container
  - `renderingSurfaceBounds` — actual drawing bounds (can exceed frame)

**NSTextLineFragment**
- Measurement info for single line of text
- Used for line counting and geometric queries

### View Layer

**NSTextViewportLayoutController**
- Source of truth for viewport layout
- Coordinates visible-only layout
- Calls delegate methods: `willLayout`, `configureRenderingSurface`, `didLayout`

**NSTextContainer**
- Provides geometric information for layout destination
- Can define exclusion paths (non-rectangular layout)

### Object-Based Ranges

**NSTextLocation** (protocol)
- Represents single location in text
- Replaces integer indices
- Supports structured documents (e.g., DOM with nested elements)

**NSTextRange**
- Start and end locations (end is excluded)
- Can represent nested structure
- Incompatible with NSRange for non-linear documents

**NSTextSelection**
- Contains: granularity, affinity, possibly disjoint ranges
- Read-only properties
- Immutable value semantics

**NSTextSelectionNavigation**
- Performs actions on selections
- Returns new NSTextSelection instances
- Handles bidirectional text correctly

## Core Design Principles

### 1. Correctness — No Glyph APIs

From WWDC 2021:
> "TextKit 2 abstracts away glyph handling to provide a consistent experience for international text."

**Why no glyphs?**

**Problem:** In scripts like Kannada and Arabic:
- One glyph can represent multiple characters (ligatures)
- One character can split into multiple glyphs
- Glyphs reorder during shaping
- No correct character→glyph mapping

**Example (Kannada word "October"):**
- Character 4 splits into 2 glyphs
- Glyphs reorder before ligature application
- Glyph 3 becomes conjoining form and moves below another glyph

**Solution:** Use NSTextLocation, NSTextRange, NSTextSelection instead of glyph indices.

### 2. Safety — Value Semantics

**Immutable objects:**
- NSTextElement
- NSTextLayoutFragment
- NSTextLineFragment
- NSTextSelection

**Benefits:**
- No unintended sharing
- No side effects from mutations
- Easier to reason about state

**Pattern:**
To change layout/selection, create new instances with desired changes.

### 3. Performance — Viewport Layout

**Always Noncontiguous:**
TextKit 2 performs layout only for visible content + overscroll region.

**TextKit 1:**
- Optional noncontiguous layout (boolean property)
- No visibility into layout state
- Can't control which parts get laid out

**TextKit 2:**
- Always noncontiguous
- Viewport defines visible area
- Consistent layout info for viewport
- Notifications for viewport layout updates

**Viewport Delegate Methods:**
1. `textViewportLayoutControllerWillLayout(_:)` — setup before layout
2. `textViewportLayoutController(_:configureRenderingSurfaceFor:)` — per fragment
3. `textViewportLayoutControllerDidLayout(_:)` — cleanup after layout

## Migration from TextKit 1

### Key Paradigm Shift

| TextKit 1 | TextKit 2 |
|-----------|-----------|
| Glyphs | Elements |
| NSRange | NSTextLocation/NSTextRange |
| NSLayoutManager | NSTextLayoutManager |
| Glyph APIs | NO glyph APIs |
| Optional noncontiguous | Always noncontiguous |
| NSTextStorage directly | Via NSTextContentManager |

### API Naming Heuristics

From WWDC 2022:
- `.offset` in name → TextKit 1
- `.location` in name → TextKit 2

### NSRange ↔ NSTextRange Conversion

**NSRange → NSTextRange:**
```swift
// UITextView/NSTextView
let nsRange = NSRange(location: 0, length: 10)

// Via content manager
let startLocation = textContentManager.location(
    textContentManager.documentRange.location,
    offsetBy: nsRange.location
)!
let endLocation = textContentManager.location(
    startLocation,
    offsetBy: nsRange.length
)!
let textRange = NSTextRange(location: startLocation, end: endLocation)
```

**NSTextRange → NSRange:**
```swift
let startOffset = textContentManager.offset(
    from: textContentManager.documentRange.location,
    to: textRange.location
)
let length = textContentManager.offset(
    from: textRange.location,
    to: textRange.endLocation
)
let nsRange = NSRange(location: startOffset, length: length)
```

### Glyph API Replacements

**NO direct glyph API equivalents.** Must use higher-level structures.

**Example (TextKit 1 - counting lines):**
```swift
// TextKit 1 - iterate glyphs
var lineCount = 0
let glyphRange = layoutManager.glyphRange(for: textContainer)
for glyphIndex in glyphRange.location..<NSMaxRange(glyphRange) {
    let lineRect = layoutManager.lineFragmentRect(
        forGlyphAt: glyphIndex,
        effectiveRange: nil
    )
    // Count unique rects...
}
```

**Replacement (TextKit 2 - enumerate fragments):**
```swift
// TextKit 2 - enumerate layout fragments
var lineCount = 0
textLayoutManager.enumerateTextLayoutFragments(
    from: textLayoutManager.documentRange.location,
    options: [.ensuresLayout]
) { fragment in
    lineCount += fragment.textLineFragments.count
    return true
}
```

### Compatibility Mode (UITextView/NSTextView)

**Automatic Fallback to TextKit 1:**
Happens when you access `.layoutManager` property.

**Warning (WWDC 2022):**
> "Accessing textView.layoutManager triggers TK1 fallback"

**Once fallback occurs:**
- No automatic way back to TextKit 2
- Expensive to switch
- Lose UI state (selection, scroll position)
- **One-way operation**

**Prevent Fallback:**
1. Check `.textLayoutManager` first (TextKit 2)
2. Only access `.layoutManager` in else clause
3. Opt out at initialization if TK1 required

```swift
// Check TextKit 2 first
if let textLayoutManager = textView.textLayoutManager {
    // TextKit 2 code
} else if let layoutManager = textView.layoutManager {
    // TextKit 1 fallback (old OS versions)
}
```

**Debug Fallback:**
- **UIKit:** Breakpoint on `_UITextViewEnablingCompatibilityMode`
- **AppKit:** Subscribe to `willSwitchToNSLayoutManagerNotification`

### NSTextView Opt-In (macOS)

**Create TextKit 2 NSTextView:**
```swift
let textLayoutManager = NSTextLayoutManager()
let textContainer = NSTextContainer()
textLayoutManager.textContainer = textContainer

let textView = NSTextView(frame: .zero, textContainer: textContainer)
// textView.textLayoutManager now available
```

**New Convenience Constructor:**
```swift
// iOS 16+ / macOS 13+
let textView = UITextView(usingTextLayoutManager: true)
let nsTextView = NSTextView(usingTextLayoutManager: true)
```

## Delegate Hooks

### NSTextContentStorageDelegate

**Customize attributes without modifying storage:**
```swift
func textContentStorage(
    _ textContentStorage: NSTextContentStorage,
    textParagraphWith range: NSRange
) -> NSTextParagraph? {
    // Modify attributes for display
    var attributedString = textContentStorage.attributedString!
        .attributedSubstring(from: range)

    // Add custom attributes
    if isComment(range) {
        attributedString.addAttribute(
            .foregroundColor,
            value: UIColor.systemIndigo,
            range: NSRange(location: 0, length: attributedString.length)
        )
    }

    return NSTextParagraph(attributedString: attributedString)
}
```

**Filter elements (hide/show content):**
```swift
func textContentManager(
    _ textContentManager: NSTextContentManager,
    shouldEnumerate textElement: NSTextElement,
    options: NSTextContentManager.EnumerationOptions
) -> Bool {
    // Return false to hide element
    if hideComments && isComment(textElement) {
        return false
    }
    return true
}
```

### NSTextLayoutManagerDelegate

**Provide custom layout fragments:**
```swift
func textLayoutManager(
    _ textLayoutManager: NSTextLayoutManager,
    textLayoutFragmentFor location: NSTextLocation,
    in textElement: NSTextElement
) -> NSTextLayoutFragment {
    // Return custom fragment for special styling
    if isComment(textElement) {
        return BubbleLayoutFragment(
            textElement: textElement,
            range: textElement.elementRange
        )
    }
    return NSTextLayoutFragment(
        textElement: textElement,
        range: textElement.elementRange
    )
}
```

### NSTextViewportLayoutController.Delegate

**Viewport layout lifecycle:**
```swift
func textViewportLayoutControllerWillLayout(_ controller: NSTextViewportLayoutController) {
    // Prepare for layout: clear sublayers, begin animation
}

func textViewportLayoutController(
    _ controller: NSTextViewportLayoutController,
    configureRenderingSurfaceFor textLayoutFragment: NSTextLayoutFragment
) {
    // Update geometry for each visible fragment
    let layer = getOrCreateLayer(for: textLayoutFragment)
    layer.frame = textLayoutFragment.layoutFragmentFrame
    // Animate to new position if needed
}

func textViewportLayoutControllerDidLayout(_ controller: NSTextViewportLayoutController) {
    // Finish: commit animations, update scroll indicators
}
```

## Practical Patterns

### Custom Layout Fragment (Bubble Backgrounds)

```swift
class BubbleLayoutFragment: NSTextLayoutFragment {
    override func draw(at point: CGPoint, in context: CGContext) {
        // Draw custom background
        context.setFillColor(UIColor.systemIndigo.cgColor)
        let bubblePath = UIBezierPath(
            roundedRect: layoutFragmentFrame,
            cornerRadius: 8
        )
        context.addPath(bubblePath.cgPath)
        context.fillPath()

        // Draw text on top
        super.draw(at: point, in: context)
    }
}
```

### Rendering Attributes (Temporary Styling)

**Add attributes that don't modify text storage:**
```swift
textLayoutManager.addRenderingAttribute(
    .foregroundColor,
    value: UIColor.green,
    for: ingredientRange
)

// Remove when no longer needed
textLayoutManager.removeRenderingAttribute(
    .foregroundColor,
    for: ingredientRange
)
```

### Text Attachment with UIView

```swift
// iOS 15+
let attachment = NSTextAttachment()
attachment.image = UIImage(systemName: "star.fill")

// Provide view for interaction
class AttachmentViewProvider: NSTextAttachmentViewProvider {
    override func loadView() {
        super.loadView()
        let button = UIButton(type: .system)
        button.setTitle("Tap me", for: .normal)
        button.addTarget(self, action: #selector(didTap), for: .touchUpInside)
        view = button
    }

    @objc func didTap() {
        // Handle tap
    }
}
```

### Lists and Tables

```swift
// Create list
let listItem = NSTextList(markerFormat: .disc, options: 0)
let paragraphStyle = NSMutableParagraphStyle()
paragraphStyle.textLists = [listItem]

attributedString.addAttribute(
    .paragraphStyle,
    value: paragraphStyle,
    range: range
)
```

**NSTextList** available in UIKit (iOS 16+), previously AppKit-only.

### Hit Testing & Selection Geometry

```swift
// Get text range at point
let location = textLayoutManager.location(
    interactingAt: point,
    inContainerAt: textContainer.location
)

// Get bounding rect for range
var boundingRect = CGRect.zero
textLayoutManager.enumerateTextSegments(
    in: textRange,
    type: .standard,
    options: []
) { segmentRange, segmentRect, baselinePosition, textContainer in
    boundingRect = boundingRect.union(segmentRect)
    return true
}
```

## Writing Tools (iOS 18+)

### Basic Integration (TextKit 2 Required)

From WWDC 2024:
> "UITextView or NSTextView has to use TextKit 2 to support the full Writing Tools experience. If using TextKit 1, you will get a limited experience that just shows rewritten results in a panel."

**Free for native text views:**
```swift
// UITextView, NSTextView, WKWebView
// Writing Tools appears automatically
```

### Lifecycle Delegate Methods

```swift
func textViewWritingToolsWillBegin(_ textView: UITextView) {
    // Pause syncing, prevent edits
    isSyncing = false
}

func textViewWritingToolsDidEnd(_ textView: UITextView) {
    // Resume syncing
    isSyncing = true
}

// Check if active
if textView.isWritingToolsActive {
    // Don't persist text storage
}
```

### Controlling Behavior

```swift
// Opt out completely
textView.writingToolsBehavior = .none

// Panel-only experience (no in-line edits)
textView.writingToolsBehavior = .limited

// Full experience (default)
textView.writingToolsBehavior = .default
```

### Result Options

```swift
// Plain text only
textView.writingToolsResultOptions = [.plainText]

// Rich text
textView.writingToolsResultOptions = [.richText]

// Rich text + tables
textView.writingToolsResultOptions = [.richText, .table]

// Rich text + lists
textView.writingToolsResultOptions = [.richText, .list]
```

### Protected Ranges

```swift
// UITextViewDelegate / NSTextViewDelegate
func textView(
    _ textView: UITextView,
    writingToolsIgnoredRangesIn enclosingRange: NSRange
) -> [NSRange] {
    // Return ranges that Writing Tools should not modify
    return codeBlockRanges + quoteRanges
}
```

**WKWebView:** `<blockquote>` and `<pre>` tags automatically ignored.

## Writing Tools Coordinator (iOS 26+)

Advanced integration for custom text engines.

### Setup

```swift
// UIKit
let coordinator = UIWritingToolsCoordinator()
coordinator.delegate = self
textView.addInteraction(coordinator)
coordinator.writingToolsBehavior = .default
coordinator.writingToolsResultOptions = [.richText]

// AppKit
let coordinator = NSWritingToolsCoordinator()
coordinator.delegate = self
customView.writingToolsCoordinator = coordinator
```

### Coordinator Delegate

**Provide context:**
```swift
func writingToolsCoordinator(
    _ coordinator: NSWritingToolsCoordinator,
    requestContexts scope: NSWritingToolsCoordinator.ContextScope
) async -> [NSWritingToolsCoordinator.Context] {
    // Return attributed string + selection range
    let context = NSWritingToolsCoordinator.Context(
        attributedString: currentText,
        range: currentSelection
    )
    return [context]
}
```

**Apply changes:**
```swift
func writingToolsCoordinator(
    _ coordinator: NSWritingToolsCoordinator,
    replace context: NSWritingToolsCoordinator.Context,
    range: NSRange,
    with attributedString: NSAttributedString
) async {
    // Update text storage
    textStorage.replaceCharacters(in: range, with: attributedString)
}
```

**Update selection:**
```swift
func writingToolsCoordinator(
    _ coordinator: NSWritingToolsCoordinator,
    updateSelectedRange selectedRange: NSRange,
    in context: NSWritingToolsCoordinator.Context
) async {
    // Update selection
    self.selectedRange = selectedRange
}
```

**Provide previews for animation:**
```swift
// macOS
func writingToolsCoordinator(
    _ coordinator: NSWritingToolsCoordinator,
    previewsFor context: NSWritingToolsCoordinator.Context,
    range: NSRange
) async -> [NSTextPreview] {
    // Return one preview per line for smooth animation
    return textLines.map { line in
        NSTextPreview(
            image: renderImage(for: line),
            frame: line.frame
        )
    }
}

// iOS
func writingToolsCoordinator(
    _ coordinator: UIWritingToolsCoordinator,
    previewFor context: UIWritingToolsCoordinator.Context,
    range: NSRange
) async -> UITargetedPreview {
    // Return single preview
    return UITargetedPreview(
        view: previewView,
        parameters: parameters
    )
}
```

**Proofreading marks:**
```swift
func writingToolsCoordinator(
    _ coordinator: NSWritingToolsCoordinator,
    underlinesFor context: NSWritingToolsCoordinator.Context,
    range: NSRange
) async -> [NSValue] {
    // Return bezier paths for underlines
    return ranges.map { range in
        let path = bezierPath(for: range)
        return NSValue(bytes: &path, objCType: "CGPath")
    }
}
```

### PresentationIntent (iOS 26+)

**Semantic rich text result option:**
```swift
coordinator.writingToolsResultOptions = [.richText, .presentationIntent]
```

**Difference from display attributes:**

**Display attributes** (bold, italic):
- Concrete font info (point sizes, font names)
- No semantic meaning

**PresentationIntent** (header, code block, emphasis):
- Semantic style info
- App converts to internal styles
- Lists, tables, code blocks use presentation intent
- Underline, subscript, superscript still use display attributes

**Example:**
```swift
// Check for presentation intent
if attributedString.runs[\.presentationIntent].contains(where: { $0?.components.contains(.header(level: 1)) == true }) {
    // This is a heading
}
```

## SwiftUI TextEditor + AttributedString (iOS 26+)

### Basic Usage

```swift
struct RecipeEditor: View {
    @State private var text: AttributedString = "Recipe text"

    var body: some View {
        TextEditor(text: $text)
    }
}
```

**Supported attributes:**
- Bold, italic, underline, strikethrough
- Custom fonts, point size
- Foreground and background colors
- Kerning, tracking, baseline offset
- Genmoji
- Line height, text alignment, base writing direction

### Selection Binding

```swift
@State private var selection: AttributedTextSelection?

TextEditor(text: $text, selection: $selection)
```

**AttributedTextSelection:**
```swift
enum AttributedTextSelection {
    case none
    case single(NSRange)
    case multiple(Set<NSRange>) // For bidirectional text
}
```

**Get selected text:**
```swift
if let selection {
    let selectedText: AttributedSubstring
    switch selection.indices {
    case .none:
        selectedText = text[...]
    case .single(let range):
        selectedText = text[range]
    case .multiple(let ranges):
        // Discontiguous substring from RangeSet
        selectedText = text[selection]
    }
}
```

### Custom Formatting Definition

**Constrain which attributes are editable:**

```swift
struct RecipeFormattingDefinition: AttributedTextFormattingDefinition {
    typealias FormatScope = RecipeAttributeScope

    static let constraints: [any AttributedTextValueConstraint<RecipeFormattingDefinition>] = [
        IngredientsAreGreen()
    ]
}

struct RecipeAttributeScope: AttributedScope {
    var ingredient: IngredientAttribute
    var foregroundColor: ForegroundColorAttribute
    var genmoji: GenmojiAttribute
}
```

**Apply to TextEditor:**
```swift
TextEditor(text: $text)
    .attributedTextFormattingDefinition(RecipeFormattingDefinition.self)
```

### Value Constraints

**Control attribute values based on custom logic:**

```swift
struct IngredientsAreGreen: AttributedTextValueConstraint {
    typealias Definition = RecipeFormattingDefinition
    typealias AttributeKey = ForegroundColorAttribute

    func constrain(
        _ value: inout Color?,
        in scope: RecipeFormattingDefinition.FormatScope
    ) {
        if scope.ingredient != nil {
            value = .green // Ingredients are always green
        } else {
            value = nil // Others use default
        }
    }
}
```

**System behavior:**
- TextEditor probes constraints to determine if changes are valid
- If constraint would revert change, control is disabled
- Constraints applied to pasted content

### Custom Attributes

**Define attribute:**
```swift
struct IngredientAttribute: CodableAttributedStringKey {
    typealias Value = UUID // Ingredient ID

    static let name = "ingredient"
}

extension AttributeScopes.RecipeAttributeScope {
    var ingredient: IngredientAttribute.Type { IngredientAttribute.self }
}
```

**Attribute behavior:**
```swift
extension IngredientAttribute {
    // Don't expand when typing after ingredient
    static let inheritedByAddedText = false

    // Remove if text in run changes
    static let invalidationConditions: [AttributedString.InvalidationCondition] = [
        .textChanged
    ]

    // Optional: constrain to paragraph boundaries
    static let runBoundaries: AttributedString.RunBoundaries = .paragraph
}
```

### AttributedString Mutations

**Safe index updates:**
```swift
// Transform updates indices/selection during mutation
text.transform(updating: &selection) { mutableText in
    // Find ranges
    let ranges = mutableText.characters.ranges(of: "butter")

    // Set attribute for all ranges at once
    for range in ranges {
        mutableText[range].ingredient = ingredientID
    }
}

// selection is now updated to match transformed text
```

**Don't use old indices:**
```swift
// BAD - indices invalidated by mutation
let range = text.characters.range(of: "butter")!
text[range].foregroundColor = .green
text.append(" (unsalted)") // range is now invalid!
```

### AttributedString Views

Multiple views into same content:
- `characters` — grapheme clusters
- `unicodeScalars` — Unicode scalars
- `utf8` — UTF-8 code units
- `utf16` — UTF-16 code units

All views share same indices.

## Known Limitations & Gotchas

### Viewport Scroll Issues

From expert articles:
- Viewport can cause scroll position instability
- `usageBoundsForTextContainer` changes during scroll
- Apple's TextEdit exhibits same issues
- Trade-off for performance benefits

### TextKit 1 Compatibility

- Accessing `.layoutManager` triggers fallback
- One-way operation (no automatic return)
- Loses UI state during switch
- Expensive to switch layout systems

### AttributedString Index Invalidation

- Any mutation invalidates all indices
- Must use `.transform(updating:)` to keep indices valid
- Indices only work with originating AttributedString

### Limited TextKit 1 Support

Unsupported in TextKit 2:
- NSTextTable (use NSTextList or custom layouts)
- Some legacy text attachments
- Direct glyph manipulation

## Resources

**WWDC**: 2021-10061, 2022-10090, 2023-10058, 2024-10168, 2025-265, 2025-280

**Docs**: /uikit/nstextlayoutmanager, /appkit/textkit/using_textkit_2_to_interact_with_text, /uikit/display-text-with-a-custom-layout, /swiftui/building-rich-swiftui-text-experiences, /foundation/attributedstring, /uikit/writing-tools, /appkit/enhancing-your-custom-text-engine-with-writing-tools
