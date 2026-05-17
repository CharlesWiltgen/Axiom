---
name: localization
description: Discipline for localizing apps with String Catalogs, SwiftUI/UIKit APIs, pluralization, RTL support, locale-aware formatting, and Xcode 26 type-safe generated symbols
---

# Localization

Discipline-enforcing skill for app localization and internationalization. String Catalogs are the unified format for everything (replacing legacy `.strings` and `.stringsdict`); SwiftUI and UIKit have first-class localization APIs; Xcode 26 adds compile-time-safe generated symbols.

## When to Use

Use this skill when:
- Setting up String Catalogs in Xcode 15+
- Localizing SwiftUI or UIKit views and strings
- Handling plural forms across languages (critical for Slavic, Arabic, Hebrew, etc.)
- Supporting RTL languages (Arabic, Hebrew) and verifying layouts
- Formatting dates, numbers, and currencies by locale
- Migrating from legacy `.strings` / `.stringsdict` to String Catalogs
- Preparing App Shortcuts and App Intents for localization
- Debugging missing translations, wrong plural forms, or layout mirroring problems
- Adopting Xcode 26 type-safe generated symbols and the `#bundle` macro

## Example Prompts

- "How do I create and use a String Catalog?"
- "How do I handle pluralization correctly for Polish or Arabic?"
- "How do I support RTL layouts in SwiftUI without re-doing every leading/trailing?"
- "How do I use Xcode 26's type-safe localization symbols?"
- "How do I migrate from `.strings` to a String Catalog?"
- "When should I use `LocalizedStringResource` instead of `String(localized:)`?"
- "How do I localize an App Shortcut phrase?"

## What This Skill Provides

- **String Catalog discipline** — `.xcstrings` is the single source of truth; automatic key extraction; per-language plural and device variations; translation-state tracking
- **SwiftUI patterns** — `Text("…")` localizes automatically, `String(localized:comment:)` with translator-facing comments, `LocalizedStringResource` for deferred resolution at render time, `LocalizedStringKey` for view APIs
- **UIKit patterns** — modern `String(localized:)` API (iOS 15+), bundle-specific lookup, `NSLocalizedString` for older deployment targets
- **Pluralization rules** — use String Catalog plural variations rather than format-string tricks; language plural rule categories (`zero`/`one`/`two`/`few`/`many`/`other`); how Polish, Russian, and Arabic disagree with English
- **Device and width variations** — different strings per device class or available width
- **RTL discipline** — `leading`/`trailing` instead of `left`/`right`, layout mirroring, image flipping for directional symbols, testing with the RTL Pseudolanguage scheme option
- **Locale-aware formatting** — `Date.FormatStyle`, `IntegerFormatStyle`, `Decimal.FormatStyle.Currency`, `Measurement` for units; avoid baking culture-specific patterns into strings
- **App Shortcuts localization** — phrases, parameter prompts, response dialogs, all routed through String Catalogs
- **Xcode 26 generated symbols** — compile-time type safety for keys (`Text(.appHomeScreenTitle)`), automatic comment generation, `#bundle` macro for Swift Package localization, refactoring tools
- **Migration paths** — `.strings` → `.xcstrings`, `.stringsdict` → catalog plural variations, removing manual `Localizable.strings` from build phases

## Related

- [hig](/skills/ui-design/hig) — typography and RTL layout guidance
- [typography-ref](/reference/typography-ref) — font system that must adapt to per-locale Dynamic Type sizing
