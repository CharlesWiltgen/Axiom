---
name: typography-ref
description: Apple platform typography reference with San Francisco fonts, text styles, and Dynamic Type
---

# Typography Reference

Complete reference for typography on Apple platforms. Covers San Francisco font system, text styles, Dynamic Type, optical sizes, and internationalization through iOS 26.

## When to Use This Reference

Use this reference when you need:
- San Francisco font family details
- Text style sizes and scaling behavior
- Dynamic Type implementation patterns
- Font weight and width options
- Optical size behavior
- International typography considerations

**For quick decisions:** See [hig](/skills/ui-design/hig) for font weight recommendations.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What are all the San Francisco font variants?"
- "What's the default size for each text style?"
- "How do optical sizes work in SF Pro?"
- "How do I use SF Mono for code?"
- "What font widths are available in SF Pro?"
- "How do I support Dynamic Type in my app?"

## What's Covered

### San Francisco Font System
- SF Pro and SF Pro Rounded (iOS, iPadOS, macOS, tvOS)
- SF Compact (watchOS, narrow columns)
- SF Mono (monospaced, code)
- New York (serif)
- SF Arabic (right-to-left)

### Variable Font Axes
- Weight (9 weights: Ultralight to Black)
- Width (Condensed, Compressed, Regular, Expanded)
- Optical sizes (automatic text/display switching)

### Text Styles
- largeTitle through caption2
- Default sizes at each style
- Scaling behavior with Dynamic Type

### Dynamic Type
- Preferred content size categories
- Text style adoption in SwiftUI/UIKit
- Custom font scaling
- Accessibility sizes

### Typography Best Practices
- Weight recommendations by context
- Minimum sizes for legibility
- Line height and tracking
- Internationalization considerations

## Key Pattern

### Text Styles in SwiftUI

```swift
// System text styles (automatic Dynamic Type)
Text("Large Title").font(.largeTitle)    // 34pt default
Text("Title").font(.title)                // 28pt
Text("Title 2").font(.title2)             // 22pt
Text("Title 3").font(.title3)             // 20pt
Text("Headline").font(.headline)          // 17pt semibold
Text("Body").font(.body)                  // 17pt
Text("Callout").font(.callout)            // 16pt
Text("Subheadline").font(.subheadline)    // 15pt
Text("Footnote").font(.footnote)          // 13pt
Text("Caption").font(.caption)            // 12pt
Text("Caption 2").font(.caption2)         // 11pt
```

### Font Weights

```swift
// Available weights
.fontWeight(.ultraLight)  // Avoid at small sizes
.fontWeight(.thin)        // Avoid at small sizes
.fontWeight(.light)       // Avoid at small sizes
.fontWeight(.regular)     // ✅ Default, good legibility
.fontWeight(.medium)      // ✅ Slightly heavier
.fontWeight(.semibold)    // ✅ Headlines
.fontWeight(.bold)        // ✅ Emphasis
.fontWeight(.heavy)
.fontWeight(.black)
```

### Custom Font with Dynamic Type

```swift
// SwiftUI - scales custom font with body text style
Text("Custom")
    .font(.custom("Helvetica", size: 17, relativeTo: .body))

// UIKit - scale with metrics
let metrics = UIFontMetrics(forTextStyle: .body)
let font = metrics.scaledFont(for: UIFont(name: "Helvetica", size: 17)!)
```

## Documentation Scope

This page documents the `axiom-typography-ref` reference skill—comprehensive typography coverage Claude uses when you need specific font details, text style sizes, or Dynamic Type patterns.

**For quick decisions:** See [hig](/skills/ui-design/hig) for typography best practices.

## Related

- [hig](/skills/ui-design/hig) — Typography best practices and weight recommendations
- [hig-ref](/reference/hig-ref) — Complete HIG reference

## Resources

**WWDC**: 2020-10175 (San Francisco variable fonts), 2022-10057 (SF Arabic)

**Docs**: /design/typography, /uikit/uifont/text_styles
