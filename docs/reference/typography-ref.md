---
name: typography-ref
description: Reference — Complete typography guide for Apple platforms covering San Francisco fonts, text styles, Dynamic Type, tracking, leading, and internationalization through iOS 26
---

# Typography Reference

Complete reference for typography on Apple platforms including San Francisco font system, text styles, Dynamic Type, tracking, leading, and internationalization.

## Overview

Comprehensive guide to all typography APIs and best practices for Apple platforms, based on WWDC 2020, 2022, 2023, and the Human Interface Guidelines.

## What This Reference Covers

### San Francisco Font System
- **SF Pro & SF Pro Rounded** — Main system fonts for iOS, iPadOS, macOS, tvOS
- **SF Compact & SF Compact Rounded** — Optimized for watchOS and narrow columns
- **SF Mono** — Monospaced font for code environments
- **New York** — Serif system font for editorial content

### Variable Font Axes
- **Weight axis** — 9 weights from Ultralight to Black
- **Width axis** — Condensed, Compressed, Regular, Expanded (WWDC 2022)
- **Optical sizes** — Automatic Display vs Text variant adjustment

### Text Styles & Dynamic Type
- **System text styles** — `.largeTitle` through `.caption2`
- **Emphasized variants** — `.bold()` symbolic trait
- **Leading variants** — `.leading(.tight)` and `.leading(.loose)`
- **Custom font scaling** — UIFontMetrics and `.custom(_:relativeTo:)`

### Tracking & Leading
- **Size-specific tracking** — Built-in optical size behavior
- **Language-aware line height** — Automatic adjustment for Arabic, Thai, Hindi (iOS 17+)
- **Manual controls** — `.tracking()`, `.lineSpacing()`, `.kern`

### Platform Differences
- **iOS/iPadOS** — Full Dynamic Type support
- **macOS** — No Dynamic Type in AppKit, text style sizes optimized for macOS
- **watchOS** — Tight leading default, smaller text styles
- **visionOS** — Identical to iOS with Dynamic Type

## Key Patterns

### Semantic Text Styles (Best Practice)
```swift
// SwiftUI
Text("Heading")
    .font(.largeTitle)

Text("Body content")
    .font(.body)

// UIKit
label.font = UIFont.preferredFont(forTextStyle: .largeTitle)
label.adjustsFontForContentSizeCategory = true
```

### Custom Fonts with Dynamic Type
```swift
// SwiftUI
Text("Custom")
    .font(.custom("Avenir-Medium", size: 34, relativeTo: .body))

@ScaledMetric(relativeTo: .body) var padding: CGFloat = 20

// UIKit
let customFont = UIFont(name: "Avenir-Medium", size: 17)!
let metrics = UIFontMetrics(forTextStyle: .body)
label.font = metrics.scaledFont(for: customFont)
```

### Emphasized Variants
```swift
// SwiftUI
Text("Bold Title")
    .font(.title.bold())

// UIKit
let descriptor = UIFontDescriptor
    .preferredFontDescriptor(withTextStyle: .title1)
    .withSymbolicTraits(.traitBold)!
let font = UIFont(descriptor: descriptor, size: 0)
```

### Rounded Design
```swift
// SwiftUI
Text("Today")
    .font(.largeTitle.bold())
    .fontDesign(.rounded)

// UIKit
let descriptor = UIFontDescriptor
    .preferredFontDescriptor(withTextStyle: .largeTitle)
    .withDesign(.rounded)!
let font = UIFont(descriptor: descriptor, size: 0)
```

## System Text Styles

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

## CSS System Fonts

```css
/* Modern (Recommended) */
font-family: system-ui;       /* SF Pro */
font-family: ui-rounded;      /* SF Pro Rounded */
font-family: ui-serif;        /* New York */
font-family: ui-monospace;    /* SF Mono */

/* Legacy */
font-family: -apple-system;   /* Deprecated */
```

## Internationalization

### Complex Scripts
- **TextKit 2 handles glyphs automatically** — Arabic, Hebrew, Thai, Kannada
- **Right-to-left support** — Automatic with proper text direction
- **Language-aware line breaking** — Chinese, Japanese, Korean (iOS 17+)

### Text Clipping Prevention
1. Use Dynamic Type (auto-adjusts)
2. Set `.lineLimit(nil)` or `.lineLimit(2...5)` in SwiftUI
3. Use `.minimumScaleFactor()` for constrained single-line text
4. Test with large accessibility sizes

## Related Resources

- [textkit-ref](/reference/textkit-ref) — TextKit 2 architecture and text layout
- [accessibility-auditor](/agents/accessibility-auditor) — Scans for Dynamic Type violations
- [HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [WWDC 2020-10175: The details of UI typography](https://developer.apple.com/videos/play/wwdc2020/10175/)
- [WWDC 2022-110381: Meet the expanded San Francisco font family](https://developer.apple.com/videos/play/wwdc2022/110381/)
