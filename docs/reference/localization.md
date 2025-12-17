---
name: localization
description: Use when localizing apps, using String Catalogs, generating type-safe symbols (Xcode 26+), handling plurals, RTL layouts, locale-aware formatting, or migrating from .strings files - comprehensive i18n patterns for Xcode 15-26
skill_type: reference
version: 1.1.0
last_updated: 2025-12-16
---

# Localization & Internationalization

Comprehensive guide to app localization using String Catalogs, the modern replacement for legacy .strings/.stringsdict files introduced in Xcode 15. Based on WWDC 2023 session 10155 (Discover String Catalogs).

## Overview

This reference covers modern localization patterns for iOS apps:

- **String Catalogs** — .xcstrings format for managing translations (Xcode 15+)
- **SwiftUI Localization** — LocalizedStringKey, LocalizedStringResource patterns
- **Pluralization** — Language-specific plural forms
- **RTL Support** — Right-to-left layout for Arabic, Hebrew
- **Locale-Aware Formatting** — Dates, numbers, currencies by locale
- **Migration** — Converting legacy .strings/.stringsdict to String Catalogs

## System Requirements

- **Xcode 15+** for String Catalogs (.xcstrings)
- **Xcode 26+** for automatic symbol generation and #bundle macro
- **iOS 15+** for LocalizedStringResource (recommended)
- **iOS 13+** for basic LocalizedStringKey support

---

## Quick Start

### Creating a String Catalog

1. In Xcode, select File → New → File
2. Choose "String Catalog" template
3. Name it `Localizable.xcstrings`
4. Add to your app target

Xcode automatically extracts localized strings from your code.

### SwiftUI Localization

String literals in SwiftUI `Text` views are automatically localized:

```swift
// ✅ Automatically localized
Text("Welcome to WWDC!")

// ✅ With comment for translators
let title = String(localized: "Welcome to WWDC!",
                   comment: "Notification banner title")

// ✅ Deferred localization
struct CardView: View {
    let title: LocalizedStringResource
    var body: some View {
        Text(title)  // Resolved at render time
    }
}
```

### UIKit Localization

```swift
// Traditional NSLocalizedString
let message = NSLocalizedString("Welcome to WWDC!",
                                comment: "Greeting message")

// Modern String(localized:) - iOS 15+
let message = String(localized: "Welcome to WWDC!",
                     comment: "Greeting message")
```

---

## Pluralization

Different languages have different plural rules:

- **English**: 2 forms (singular, plural)
- **Arabic**: 6 forms (zero, one, two, few, many, other)
- **Russian**: 3 forms (one, few, many)

### String Catalog Plural Example

In your code:
```swift
let count = 5
let message = String(localized: "\(count) items selected",
                     comment: "Selection count")
```

In `Localizable.xcstrings`:
```json
{
  "%lld items selected" : {
    "extractionState" : "manual",
    "localizations" : {
      "en" : {
        "variations" : {
          "plural" : {
            "one" : {
              "stringUnit" : { "value" : "%lld item selected" }
            },
            "other" : {
              "stringUnit" : { "value" : "%lld items selected" }
            }
          }
        }
      }
    }
  }
}
```

---

## RTL Support (Right-to-Left)

### Layout Mirroring

Use **leading/trailing** instead of **left/right**:

```swift
// ✅ Correct - mirrors automatically in RTL
.padding(.leading, 16)
.frame(maxWidth: .infinity, alignment: .leading)

// ❌ Wrong - doesn't mirror
.padding(.left, 16)
.frame(maxWidth: .infinity, alignment: .left)
```

### Testing RTL

1. Add Arabic or Hebrew to your project's localizations
2. In Simulator, Settings → General → Language & Region → Add Language
3. Or use Xcode scheme: Edit Scheme → Run → App Language → Right-to-Left Pseudolanguage

### Images and Icons

Images with directional meaning (arrows, chevrons) should flip in RTL:

```swift
Image(systemName: "chevron.right")
    .environment(\.layoutDirection, .rightToLeft)  // Test flipping
```

For custom images:
```swift
Image("back-arrow")
    .flipsForRightToLeftLayoutDirection(true)  // UIKit
```

---

## Locale-Aware Formatting

### Dates

```swift
let date = Date()
let formatter = DateFormatter()
formatter.dateStyle = .medium
formatter.timeStyle = .short
formatter.locale = Locale.current  // Respects user's locale
let formatted = formatter.string(from: date)
```

### Numbers and Currency

```swift
let price = 99.99
let formatter = NumberFormatter()
formatter.numberStyle = .currency
formatter.locale = Locale.current
let formatted = formatter.string(from: NSNumber(value: price))
// US: "$99.99"
// France: "99,99 €"
```

### Measurements

```swift
let distance = Measurement(value: 100, unit: UnitLength.meters)
let formatter = MeasurementFormatter()
formatter.locale = Locale.current
let formatted = formatter.string(from: distance)
// US: "328 ft"
// France: "100 m"
```

---

## Common Mistakes

### ❌ Hardcoded Strings

```swift
// Wrong
Text("Welcome")

// Correct
Text("Welcome")  // SwiftUI auto-localizes
```

### ❌ String Concatenation

```swift
// Wrong - word order varies by language
let message = name + " sent you " + count + " messages"

// Correct - use format strings
let message = String(localized: "\(name) sent you \(count) messages")
```

### ❌ Ignoring Plural Forms

```swift
// Wrong - assumes English plural rules
Text("\(count) item(s)")

// Correct - let String Catalog handle plurals
Text("\(count) items")
```

### ❌ Missing RTL Support

```swift
// Wrong
.padding(.left, 20)

// Correct
.padding(.leading, 20)
```

---

## Migration from Legacy .strings

Xcode 15+ can automatically convert legacy files:

1. Select `.strings` or `.stringsdict` file in Project Navigator
2. Editor → Convert to String Catalog
3. Review conversion (some manual fixes may be needed)
4. Delete old `.strings`/`.stringsdict` files after verification

**Gradual Migration**: You can use both systems during transition. String Catalogs take precedence.

---

## Xcode 26 Type-Safe Localization

Xcode 26 introduces type-safe localization with generated symbols that catch typos at compile time.

### Generated Symbols

Manually add strings to String Catalog, enable "Generate String Catalog Symbols" build setting, and use type-safe symbols:

```swift
// ✅ Type-safe - compiler catches typos
Text(.appHomeScreenTitle)
Text(.subtitle(friendsPosts: 42))  // With placeholders
```

### Automatic Comments

Xcode 26 uses on-device AI to generate translator context automatically. Enable in Xcode Settings → Editing → "automatically generate string catalog comments".

### Swift Package Localization

Use the `#bundle` macro for automatic bundle resolution in Swift Packages and frameworks:

```swift
Text("My Collections", bundle: #bundle, comment: "Section title")
```

### Refactoring

Convert string-based localization to symbols: Right-click → "Refactor > Convert Strings to Symbols"

---

## App Shortcuts Localization

For App Intents and Shortcuts:

```swift
import AppIntents

struct SendMessageIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Message"

    @Parameter(title: "Recipient")
    var recipient: String
}
```

String Catalogs automatically extract App Intent strings.

---

## WWDC Sessions

- [Explore localization with Xcode (2025/225)](https://developer.apple.com/videos/play/wwdc2025/225/) — Xcode 26 type-safe symbols, #bundle macro
- [Discover String Catalogs (2023/10155)](https://developer.apple.com/videos/play/wwdc2023/10155/) — Modern localization with .xcstrings

## Related Skills

- **localization** — Complete reference with device variations, width classes, legacy migration strategies

## Related Documentation

- [Localization](https://developer.apple.com/localization/)
- [String Catalogs](https://developer.apple.com/documentation/xcode/localizing-and-varying-text-with-a-string-catalog)
- [LocalizedStringResource](https://developer.apple.com/documentation/foundation/localizedstringresource)
