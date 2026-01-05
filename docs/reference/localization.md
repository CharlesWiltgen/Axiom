---
name: localization
description: String Catalogs, LocalizedStringResource, pluralization, RTL support, and Xcode 26 type-safe symbols
skill_type: reference
version: 1.1.0
---

# Localization Reference

Complete API reference for iOS localization. Covers String Catalogs (.xcstrings), LocalizedStringResource, pluralization rules, RTL support, locale-aware formatting, and Xcode 26 type-safe localization.

## When to Use This Reference

Use this reference when you need:
- String Catalog structure and configuration
- SwiftUI/UIKit localization patterns
- Pluralization for multiple languages
- RTL layout support (Arabic, Hebrew)
- Locale-aware date/number formatting
- Xcode 26 generated symbols and #bundle macro
- Migration from legacy .strings files

**For quick patterns:** Use String Catalogs for all new projects.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I create and use a String Catalog?"
- "How do I handle pluralization in different languages?"
- "How do I support RTL layouts in SwiftUI?"
- "How do I use Xcode 26 type-safe localization symbols?"
- "How do I migrate from .strings to String Catalogs?"
- "How do I use LocalizedStringResource for deferred localization?"

## What's Covered

### String Catalogs (Xcode 15+)
- .xcstrings format and structure
- Automatic string extraction
- Plural variations
- Device-specific variations
- Translation state tracking

### SwiftUI Localization
- Automatic Text view localization
- String(localized:comment:) pattern
- LocalizedStringResource for deferred resolution
- LocalizedStringKey usage

### UIKit Localization
- NSLocalizedString patterns
- String(localized:) modern API (iOS 15+)
- Bundle-specific localization

### Pluralization
- Language-specific plural rules
- String Catalog plural variations
- Format string patterns

### RTL Support
- Leading/trailing vs left/right
- Layout mirroring
- Image flipping
- Testing RTL layouts

### Xcode 26 Features
- Generated symbols (compile-time safety)
- Automatic comment generation
- #bundle macro for packages
- Refactoring tools

## Key Pattern

### SwiftUI Localization

```swift
// Automatic localization
Text("Welcome to WWDC!")

// With comment for translators
let title = String(localized: "Welcome to WWDC!",
                   comment: "Notification banner title")

// Deferred localization
struct CardView: View {
    let title: LocalizedStringResource
    var body: some View {
        Text(title)  // Resolved at render time
    }
}
```

### Xcode 26 Type-Safe Symbols

```swift
// Generated symbols catch typos at compile time
Text(.appHomeScreenTitle)
Text(.subtitle(friendsPosts: 42))

// Swift Package localization
Text("My Collections", bundle: #bundle, comment: "Section title")
```

## Documentation Scope

This page documents the `axiom-localization` reference skill—complete API coverage Claude uses when you need specific localization APIs, String Catalog patterns, or internationalization details.

**For RTL testing:** Use Xcode scheme → Right-to-Left Pseudolanguage.

## Related

- [hig](/skills/ui-design/hig) — Typography and layout guidelines
- [typography-ref](/reference/typography-ref) — Font system reference

## Resources

**WWDC**: 2025-225 (Xcode 26 localization), 2023-10155 (String Catalogs)

**Docs**: /xcode/localizing-and-varying-text-with-a-string-catalog, /foundation/localizedstringresource
