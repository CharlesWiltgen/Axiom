---
name: axiom-typography-ref
description: Apple platform typography reference (San Francisco fonts, text styles, Dynamic Type, tracking, leading, internationalization) through iOS 26
user-invocable: true
---

# Typography Reference

Complete reference for typography on Apple platforms including San Francisco font system, text styles, Dynamic Type, tracking, leading, and internationalization through iOS 26.

## San Francisco Font System

### Font Families

**SF Pro** and **SF Pro Rounded** (iOS, iPadOS, macOS, tvOS)
- Main system fonts for most UI elements
- Rounded variant for friendly, approachable interfaces (e.g., Reminders app)

**SF Compact** and **SF Compact Rounded** (watchOS, narrow columns)
- Optimized for constrained spaces and small sizes
- watchOS default system font

**SF Mono** (Code environments, monospaced text)
- Monospaced font for code editors and technical content
- Consistent character widths for alignment

**New York** (Serif system font)
- Serif alternative for editorial content
- Works with text styles just like SF Pro

### Variable Font Axes

#### Weight Axis (9 weights)
- Ultralight, Thin, Light, Regular, Medium, Semibold, Bold, Heavy, Black
- Continuous weight spectrum via variable fonts
- Avoid light weights at small sizes (legibility issues)

#### Width Axis (WWDC 2022)
- **Condensed** — narrowest width
- **Compressed** — narrow width
- **Regular** — standard width (default)
- **Expanded** — wide width

Access via:
```swift
// iOS/macOS
let descriptor = UIFontDescriptor(fontAttributes: [
    .family: "SF Pro",
    kCTFontWidthTrait: 1.0 // 1.0 = Expanded
])
```

**SF Arabic** (WWDC 2022)
- Matches SF Pro design language for Arabic text
- Proper right-to-left support

#### Optical Sizes
Variable fonts automatically adjust optical size based on point size:
- **Text variant** (< 20pt) — more spacing, sturdier strokes
- **Display variant** (≥ 20pt) — tighter spacing, refined details
- **Smooth transition** (17-28pt) with variable SF Pro

From WWDC 2020:
> "TextKit 2 abstracts away glyph handling to provide a consistent experience for international text."

## Text Styles & Dynamic Type

### System Text Styles

| Text Style | Default Size (iOS) | Use Case |
|------------|-------------------|----------|
| `.largeTitle` | 34pt | Primary page headings |
| `.title` | 28pt | Secondary headings |
| `.title2` | 22pt | Tertiary headings |
| `.title3` | 20pt | Quaternary headings |
| `.headline` | 17pt (Semibold) | Emphasized body text |
| `.body` | 17pt | Primary body text |
| `.callout` | 16pt | Secondary body text |
| `.subheadline` | 15pt | Tertiary body text |
| `.footnote` | 13pt | Footnotes, captions |
| `.caption` | 12pt | Small annotations |
| `.caption2` | 11pt | Smallest annotations |

### Emphasized Text Styles

Apply `.bold` symbolic trait to get emphasized variants:

```swift
// UIKit
let descriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: .title1)
let boldDescriptor = descriptor.withSymbolicTraits(.traitBold)!
let font = UIFont(descriptor: boldDescriptor, size: 0)

// SwiftUI
Text("Bold Title")
    .font(.title.bold())
```

**Actual weights by text style:**
- Some styles map to **medium**
- Others map to **semibold**, **bold**, or **heavy**
- Depends on semantic hierarchy

### Leading Variants

**Tight Leading** (reduces line height by 2pt on iOS, 1pt on watchOS):
```swift
// UIKit
let descriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body)
let tightDescriptor = descriptor.withSymbolicTraits(.traitTightLeading)!

// SwiftUI
Text("Compact text")
    .font(.body.leading(.tight))
```

**Loose Leading** (increases line height by 2pt on iOS, 1pt on watchOS):
```swift
// SwiftUI
Text("Spacious paragraph")
    .font(.body.leading(.loose))
```

### Dynamic Type

**Automatic Scaling** (iOS):
Text styles scale automatically based on user preferences from Settings → Display & Brightness → Text Size.

**Custom Fonts with Dynamic Type:**

```swift
// UIKit - UIFontMetrics
let customFont = UIFont(name: "Avenir-Medium", size: 34)!
let bodyMetrics = UIFontMetrics(forTextStyle: .body)
let scaledFont = bodyMetrics.scaledFont(for: customFont)

// Also scale constants
let spacing = bodyMetrics.scaledValue(for: 20.0)
```

```swift
// SwiftUI - .font(.custom(_:relativeTo:))
Text("Custom scaled text")
    .font(.custom("Avenir-Medium", size: 34, relativeTo: .body))

// @ScaledMetric for values
@ScaledMetric(relativeTo: .body) var padding: CGFloat = 20
```

### Platform Differences

**macOS**
- No Dynamic Type support in AppKit
- Text style sizes optimized for macOS control sizes
- Catalyst apps use iOS sizes × 77% (legacy) or macOS-optimized sizes ("Optimize Interface for Mac")

**watchOS**
- Smaller text styles optimized for watch faces
- Tight leading default for compact displays

**visionOS**
- System fonts work identically to iOS
- Dynamic Type support included

## Tracking & Leading

### Tracking (Letter Spacing)

Tracking adjusts space between letters. Essential for optical size behavior.

**Size-Specific Tracking Tables:**

SF Pro includes tracking values that vary by point size to maintain optimal spacing:
- Larger sizes: tighter tracking
- Smaller sizes: looser tracking

Example from Apple Design Resources:
- 34pt (largeTitle): +0.016 tracking
- 17pt (body): +0.008 tracking
- 11pt (caption2): +0.06 tracking

**Tight Tracking API** (for fitting text):
```swift
// UIKit
textView.allowsDefaultTightening(for: .byTruncatingTail)

// SwiftUI
Text("Long text that needs to fit")
    .lineLimit(1)
    .minimumScaleFactor(0.5) // Allows tight tracking
```

**Manual Tracking:**
```swift
// UIKit
let attributes: [NSAttributedString.Key: Any] = [
    .font: UIFont.preferredFont(forTextStyle: .body),
    .kern: 2.0 // 2pt tracking
]

// SwiftUI
Text("Tracked text")
    .tracking(2.0)
    .kerning(2.0) // Alternative API
```

**Important:** Use `.tracking()` not `.kerning()` API for semantic correctness. Tracking disables ligatures when necessary; kerning does not.

### Leading (Line Spacing)

**Default Line Height:**
Calculated from font's built-in metrics (ascender + descender + line gap).

**Language-Aware Adjustments:**
iOS 17+ automatically increases line height for scripts with tall ascenders/descenders:
- Arabic
- Thai, Lao
- Hindi, Bengali, Telugu

From WWDC 2023:
> "Automatic line height adjustment for scripts with variable heights"

**Manual Leading:**
```swift
// UIKit
let paragraphStyle = NSMutableParagraphStyle()
paragraphStyle.lineSpacing = 8.0 // 8pt additional space

// SwiftUI
Text("Custom spacing")
    .lineSpacing(8.0)
```

### Third-Party Font Tracking

**New in iOS 18:**
Font vendors can embed tracking tables in custom fonts using STAT table + CTFont optical size attribute.

```swift
let attributes: [String: Any] = [
    kCTFontOpticalSizeAttribute as String: pointSize
]
let descriptor = CTFontDescriptorCreateWithAttributes(attributes as CFDictionary)
let font = CTFontCreateWithFontDescriptor(descriptor, pointSize, nil)
```

## SwiftUI AttributedString Typography

### Font Environment Interaction

**Critical Pattern** When using `AttributedString` with SwiftUI's `Text`, paragraph styles (like `lineHeightMultiple`) can be lost if fonts come from the environment instead of the attributed content.

From WWDC 2025-280:
> "TextEditor substitutes the default value calculated from the environment for any AttributedStringKeys with a value of nil."

This same principle applies to `Text`—when your `AttributedString` doesn't specify a font, SwiftUI applies the environment font, which can cause it to rebuild text runs and drop or normalize paragraph style details.

### The Problem

```swift
// ❌ WRONG - .font() modifier can override and drop paragraph styles
var s = AttributedString(longString)

// Set paragraph style
var p = AttributedString.ParagraphStyle()
p.lineHeightMultiple = 0.92
s.paragraphStyle = p
// ⚠️ No font set in AttributedString

Text(s)
    .font(.body) // ⚠️ May rebuild runs, lose lineHeightMultiple
```

**Why this fails:**
1. `AttributedString` has no font attribute set (value is `nil`)
2. SwiftUI's `.font(.body)` modifier tells it "use this font for the whole run"
3. SwiftUI rebuilds text runs with the environment font
4. Paragraph styles get dropped or normalized during rebuild

### The Solution

**Keep typography inside the AttributedString when you need fine control:**

```swift
// ✅ CORRECT - Font in AttributedString, no environment override
var s = AttributedString(longString)

// Set font INSIDE the attributed content
s.font = .system(.body) // ✅ Typography inside AttributedString

// Set paragraph style
var p = AttributedString.ParagraphStyle()
p.lineHeightMultiple = 0.92
s.paragraphStyle = p

Text(s) // ✅ No .font() modifier
```

**Why this works:**
1. Font is part of the attributed content (not `nil`)
2. No environment override from `.font()` modifier
3. SwiftUI preserves both font AND paragraph styles
4. Text runs remain intact with all attributes

### When to Use Each Approach

#### Use Font in AttributedString (Fine Control)

```swift
var s = AttributedString("Carefully styled text")
s.font = .system(.body)

var p = AttributedString.ParagraphStyle()
p.lineHeightMultiple = 0.92
p.alignment = .leading
s.paragraphStyle = p

Text(s) // No modifier
```

**When to use:**
- Need precise paragraph styling (line height, alignment)
- Mixing multiple fonts in one string
- Content will be displayed in both `Text` and `TextEditor`
- Preserving exact formatting from rich text editor

#### Use .font() Modifier (Broad Override)

```swift
Text("Simple text")
    .font(.body)
    .lineSpacing(4.0) // SwiftUI-level spacing
```

**When to use:**
- Simple text without paragraph styles
- Want Dynamic Type automatic scaling
- Need SwiftUI's semantic font behavior (Dark Mode, accessibility)
- Intentionally overriding AttributedString fonts

### Multiple Fonts in One String

```swift
var s = AttributedString("Title")
s.font = .system(.title).bold()

var body = AttributedString(" and body text")
body.font = .system(.body)

s.append(body)

Text(s) // ✅ No .font() modifier preserves both fonts
```

### Common Mistake: Order Doesn't Matter

```swift
// ❌ WRONG mental model: "Create AttributedString first"
var s = AttributedString(text)
var p = AttributedString.ParagraphStyle()
p.lineHeightMultiple = 0.92
s.paragraphStyle = p
s.font = .system(.body) // ⚠️ Setting font last doesn't help if you use .font() modifier

Text(s).font(.body) // Still breaks!
```

The issue isn't **when** you set the font in `AttributedString`. The issue is **whether the attributed content carries its own font attributes** versus relying on SwiftUI's `.font(...)` environment.

### Verification Checklist

When using `AttributedString` with paragraph styles:
- [ ] Font set inside `AttributedString` (not `nil`)
- [ ] No `.font()` modifier on `Text` view (unless intentionally overriding)
- [ ] Paragraph styles set after or before font (order doesn't matter)
- [ ] Tested with actual content to verify line height/alignment preserved

## Internationalization

### Bidirectional Text

**Complex Script Example (from WWDC 2021):**

Kannada word "October":
- Character index 4 has split vowel → 2 glyphs
- Glyphs reorder before ligature application
- Glyph index ≠ character index

This is why TextKit 2 uses **NSTextLocation** instead of integer indices.

**Hebrew/Arabic Selection:**
Single visual selection = multiple NSRanges in AttributedString due to right-to-left layout.

### Line Breaking

**Language-Aware (iOS 17+):**
- Chinese, Japanese, Korean: break at semantic boundaries
- German: avoid breaking compound words
- English: prefer breaking at hyphens

**Even Line Breaking (TextKit 2):**
Justified paragraphs use improved line breaking algorithm:
- Reduces stretched-out lines
- More even interword spacing
- Automatic in TextKit 2

### Text Clipping Prevention

**Best Practices:**
1. Use Dynamic Type (auto-adjusts)
2. Set `.lineLimit(nil)` or `.lineLimit(2...5)` in SwiftUI
3. Use `.minimumScaleFactor()` for constrained single-line text
4. Test with large accessibility sizes

## CSS & Web Typography

**System UI Font Families:**

```css
font-family: system-ui; /* SF Pro */
font-family: ui-rounded; /* SF Pro Rounded */
font-family: ui-serif; /* New York */
font-family: ui-monospace; /* SF Mono */
```

**Legacy:**
```css
font-family: -apple-system; /* deprecated, use system-ui */
```

## Code Examples

### Emphasized Large Title (SwiftUI)
```swift
Text("Recipe Editor")
    .font(.largeTitle.bold()) // Emphasized variant
```

### Custom Font + Dynamic Type (UIKit)
```swift
let customFont = UIFont(name: "Avenir-Medium", size: 17)!
let metrics = UIFontMetrics(forTextStyle: .body)
label.font = metrics.scaledFont(for: customFont)
label.adjustsFontForContentSizeCategory = true
```

### Rounded Design (UIKit)
```swift
let descriptor = UIFontDescriptor
    .preferredFontDescriptor(withTextStyle: .largeTitle)
    .withDesign(.rounded)!
let font = UIFont(descriptor: descriptor, size: 0)
```

### Rounded Design (SwiftUI)
```swift
Text("Today")
    .font(.largeTitle.bold())
    .fontDesign(.rounded)
```

### ScaledMetric (SwiftUI)
```swift
struct RecipeView: View {
    @ScaledMetric(relativeTo: .body) var padding: CGFloat = 20

    var body: some View {
        Text("Recipe")
            .padding(padding) // Scales with Dynamic Type
    }
}
```

## Resources

**WWDC**: 2020-10175, 2022-110381, 2023-10058

**Docs**: /uikit/uifontdescriptor, /uikit/uifontmetrics, /swiftui/font
