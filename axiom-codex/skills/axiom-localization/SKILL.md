---
name: axiom-localization
description: Use when localizing apps, using String Catalogs, generating type-safe symbols (Xcode 26+), handling plurals, RTL layouts, locale-aware formatting, or migrating from .strings files - comprehensive i18n patterns for Xcode 15-26
license: MIT
metadata:
  version: "1.1.0"
  last-updated: "2025-12-16"
---

# Localization & Internationalization

Comprehensive guide to app localization using String Catalogs. Apple Design Award Inclusivity winners always support multiple languages with excellent RTL (Right-to-Left) support.

## Overview

String Catalogs (`.xcstrings`) are Xcode 15's unified format for managing app localization. They replace legacy `.strings` and `.stringsdict` files with a single JSON-based format that's easier to maintain, diff, and integrate with translation workflows.

This skill covers String Catalogs, SwiftUI/UIKit localization APIs, plural handling, RTL support, locale-aware formatting, and migration strategies from legacy formats.

## When to Use This Skill

- Setting up String Catalogs in Xcode 15+
- Localizing SwiftUI and UIKit apps
- Handling plural forms correctly (critical for many languages)
- Supporting RTL languages (Arabic, Hebrew)
- Formatting dates, numbers, and currencies by locale
- Migrating from legacy `.strings`/`.stringsdict` files
- Preparing App Shortcuts and App Intents for localization
- Debugging missing translations or incorrect plural forms

## System Requirements

- **Xcode 15+** for String Catalogs (`.xcstrings`)
- **Xcode 26+** for automatic symbol generation, `#bundle` macro, and AI-powered comment generation
- **iOS 15+** for `LocalizedStringResource`
- **iOS 16+** for App Shortcuts localization
- Earlier iOS versions use legacy `.strings` files

---

## Part 1: String Catalogs (WWDC 2023/10155)

### Creating a String Catalog

**Method 1: Xcode Navigator**
1. File → New → File
2. Choose "String Catalog"
3. Name it (e.g., `Localizable.xcstrings`)
4. Add to target

**Method 2: Automatic Extraction**

Xcode 15 can automatically extract strings from:
- SwiftUI views (string literals in `Text`, `Label`, `Button`)
- Swift code (`String(localized:)`)
- Objective-C (`NSLocalizedString`)
- C (`CFCopyLocalizedString`)
- Interface Builder files (`.storyboard`, `.xib`)
- Info.plist values
- App Shortcuts phrases

**Build Settings Required**:
- **"Use Compiler to Extract Swift Strings"** → Yes
- **"Localization Prefers String Catalogs"** → Yes

### String Catalog Structure

Each entry has:
- **Key**: Unique identifier (default: the English string)
- **Default Value**: Fallback if translation missing
- **Comment**: Context for translators
- **String Table**: Organization container (default: "Localizable")

**Example `.xcstrings` JSON**:
```json
{
  "sourceLanguage" : "en",
  "strings" : {
    "Thanks for shopping with us!" : {
      "comment" : "Label above checkout button",
      "localizations" : {
        "en" : {
          "stringUnit" : {
            "state" : "translated",
            "value" : "Thanks for shopping with us!"
          }
        },
        "es" : {
          "stringUnit" : {
            "state" : "translated",
            "value" : "¡Gracias por comprar con nosotros!"
          }
        }
      }
    }
  },
  "version" : "1.0"
}
```

### Translation States

Xcode tracks state for each translation:

- **New** (⚪) - String hasn't been translated yet
- **Needs Review** (🟡) - Source changed, translation may be outdated
- **Reviewed** (✅) - Translation approved and current
- **Stale** (🔴) - String no longer found in source code

**Workflow**:
1. Developer adds string → **New**
2. Translator adds translation → **Reviewed**
3. Developer changes source → **Needs Review**
4. Translator updates → **Reviewed**
5. Developer removes code → **Stale**

---

## Part 2: SwiftUI Localization

### LocalizedStringKey (Automatic)

SwiftUI views with `String` parameters automatically support localization:

```swift
// ✅ Automatically localizable
Text("Welcome to WWDC!")
Label("Thanks for shopping with us!", systemImage: "bag")
Button("Checkout") { }

// Xcode extracts these strings to String Catalog
```

**How it works**: SwiftUI uses `LocalizedStringKey` internally, which looks up strings in String Catalogs.

### String(localized:) with Comments

For explicit localization in Swift code:

```swift
// Basic
let title = String(localized: "Welcome to WWDC!")

// With comment for translators
let title = String(localized: "Welcome to WWDC!",
                   comment: "Notification banner title")

// With custom table
let title = String(localized: "Welcome to WWDC!",
                   table: "WWDCNotifications",
                   comment: "Notification banner title")

// With default value (key ≠ English text)
let title = String(localized: "WWDC_NOTIFICATION_TITLE",
                   defaultValue: "Welcome to WWDC!",
                   comment: "Notification banner title")
```

**Best practice**: Always include `comment` to give translators context.

### LocalizedStringResource (Deferred Localization)

For passing localizable strings to other functions:

```swift
import Foundation

struct CardView: View {
    let title: LocalizedStringResource
    let subtitle: LocalizedStringResource

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10.0)
            VStack {
                Text(title)      // Resolved at render time
                Text(subtitle)
            }
            .padding()
        }
    }
}

// Usage
CardView(
    title: "Recent Purchases",
    subtitle: "Items you've ordered in the past week."
)
```

**Key difference**: `LocalizedStringResource` defers lookup until used, allowing custom views to be fully localizable.

### AttributedString with Markdown

```swift
// Markdown formatting is preserved across localizations
let subtitle = AttributedString(localized: "**Bold** and _italic_ text")
```

---

## Part 3: UIKit & Foundation

### NSLocalizedString Macro

```swift
// Basic
let title = NSLocalizedString("Recent Purchases", comment: "Button Title")

// With table
let title = NSLocalizedString("Recent Purchases",
                             tableName: "Shopping",
                             comment: "Button Title")

// With bundle
let title = NSLocalizedString("Recent Purchases",
                             tableName: nil,
                             bundle: .main,
                             value: "",
                             comment: "Button Title")
```

### Bundle.localizedString

```swift
let customBundle = Bundle(for: MyFramework.self)
let text = customBundle.localizedString(forKey: "Welcome",
                                        value: nil,
                                        table: "MyFramework")
```

### Custom Macros

```objc
// Objective-C
#define MyLocalizedString(key, comment) \
    [myBundle localizedStringForKey:key value:nil table:nil]
```

### Info.plist Localization

Localize app name, permissions, etc.:

1. Select `Info.plist`
2. Editor → Add Localization
3. Create `InfoPlist.strings` for each language:

```
// InfoPlist.strings (Spanish)
"CFBundleName" = "Mi Aplicación";
"NSCameraUsageDescription" = "La app necesita acceso a la cámara para tomar fotos.";
```

---

## Part 4: Pluralization

Different languages have different plural rules:

- **English**: 2 forms (one, other)
- **Russian**: 3 forms (one, few, many)
- **Polish**: 3 forms (one, few, other)
- **Arabic**: 6 forms (zero, one, two, few, many, other)

### SwiftUI Plural Handling

```swift
// Xcode automatically creates plural variations
Text("\(count) items")

// With custom formatting
Text("\(visitorCount) Recent Visitors")
```

**In String Catalog**:
```json
{
  "strings" : {
    "%lld Recent Visitors" : {
      "localizations" : {
        "en" : {
          "variations" : {
            "plural" : {
              "one" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "%lld Recent Visitor"
                }
              },
              "other" : {
                "stringUnit" : {
                  "state" : "translated",
                  "value" : "%lld Recent Visitors"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### XLIFF Export Format

When exporting for translation (File → Export Localizations):

**Legacy (stringsdict)**:
```xml
<trans-unit id="/%lld Recent Visitors:dict/NSStringLocalizedFormatKey:dict/:string">
    <source>%#@recentVisitors@</source>
</trans-unit>

<trans-unit id="/%lld Recent Visitors:dict/recentVisitors:dict/one:dict/:string">
    <source>%lld Recent Visitor</source>
    <target>%lld Visitante Recente</target>
</trans-unit>
```

**String Catalog (cleaner)**:
```xml
<trans-unit id="%lld Recent Visitors|==|plural.one">
    <source>%lld Recent Visitor</source>
    <target>%lld Visitante Recente</target>
</trans-unit>

<trans-unit id="%lld Recent Visitors|==|plural.other">
    <source>%lld Recent Visitors</source>
    <target>%lld Visitantes Recentes</target>
</trans-unit>
```

### Substitutions with Plural Variables

```swift
// Multiple variables with different plural forms
let message = String(localized: "\(songCount) songs on \(albumCount) albums")
```

Xcode creates variations for **each** variable's plural form:
- `songCount`: one, other
- `albumCount`: one, other
- Total combinations: 2 × 2 = 4 translation entries

---

## Part 5: Device & Width Variations

### Device-Specific Strings

Different text for different platforms:

```swift
// Same code, different strings per device
Text("Bird Food Shop")
```

**String Catalog variations**:
```json
{
  "Bird Food Shop" : {
    "localizations" : {
      "en" : {
        "variations" : {
          "device" : {
            "applewatch" : {
              "stringUnit" : {
                "value" : "Bird Food"
              }
            },
            "other" : {
              "stringUnit" : {
                "value" : "Bird Food Shop"
              }
            }
          }
        }
      }
    }
  }
}
```

**Result**:
- iPhone/iPad: "Bird Food Shop"
- Apple Watch: "Bird Food" (shorter for small screen)

### Width Variations

For dynamic type and size classes:

```swift
Text("Application Settings")
```

String Catalog can provide shorter text for narrow widths.

---

## Part 6: RTL Support

### Layout Mirroring

SwiftUI automatically mirrors layouts for RTL languages:

```swift
// ✅ Automatically mirrors for Arabic/Hebrew
HStack {
    Image(systemName: "chevron.right")
    Text("Next")
}

// iPhone (English): [>] Next
// iPhone (Arabic):  Next [<]
```

### Leading/Trailing vs Left/Right

**Always use semantic directions**:

```swift
// ✅ Correct - mirrors automatically
.padding(.leading, 16)
.frame(maxWidth: .infinity, alignment: .leading)

// ❌ Wrong - doesn't mirror
.padding(.left, 16)
.frame(maxWidth: .infinity, alignment: .left)
```

### Images and Icons

Mark images that should/shouldn't flip:

```swift
// ✅ Directional - mirrors for RTL
Image(systemName: "chevron.forward")

// ✅ Non-directional - never mirrors
Image(systemName: "star.fill")

// Custom images
Image("backButton")
    .flipsForRightToLeftLayoutDirection(true)
```

### Testing in RTL Mode

**Xcode Scheme**:
1. Edit Scheme → Run → Options
2. Application Language: Arabic / Hebrew
3. OR: App Language → Right-to-Left Pseudolanguage

**Simulator**:
Settings → General → Language & Region → Preferred Language Order

**SwiftUI Preview**:
```swift
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "ar"))
    }
}
```

---

## Part 7: Locale-Aware Formatting

### DateFormatter

```swift
let formatter = DateFormatter()
formatter.locale = Locale.current  // ✅ Use current locale
formatter.dateStyle = .long
formatter.timeStyle = .short

let dateString = formatter.string(from: Date())

// US: "January 15, 2024 at 3:30 PM"
// France: "15 janvier 2024 à 15:30"
// Japan: "2024年1月15日 15:30"
```

**Never hardcode date format strings**:
```swift
// ❌ Wrong - breaks in other locales
formatter.dateFormat = "MM/dd/yyyy"

// ✅ Correct - adapts to locale
formatter.dateStyle = .short
```

### NumberFormatter for Currency

```swift
let formatter = NumberFormatter()
formatter.locale = Locale.current
formatter.numberStyle = .currency

let priceString = formatter.string(from: 29.99)

// US: "$29.99"
// UK: "£29.99"
// Japan: "¥30" (rounds to integer)
// France: "29,99 €" (comma decimal, space before symbol)
```

### MeasurementFormatter

```swift
let distance = Measurement(value: 100, unit: UnitLength.meters)

let formatter = MeasurementFormatter()
formatter.locale = Locale.current

let distanceString = formatter.string(from: distance)

// US: "328 ft" (converts to imperial)
// Metric countries: "100 m"
```

### Locale-Specific Sorting

```swift
let names = ["Ångström", "Zebra", "Apple"]

// ✅ Locale-aware sort
let sorted = names.sorted { (lhs, rhs) in
    lhs.localizedStandardCompare(rhs) == .orderedAscending
}

// Sweden: ["Ångström", "Apple", "Zebra"]  (Å comes first in Swedish)
// US: ["Ångström", "Apple", "Zebra"]      (Å treated as A)
```

---

## Part 8: App Shortcuts Localization

### Phrases with Parameters

```swift
import AppIntents

struct ShowTopDonutsIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Top Donuts"

    @Parameter(title: "Timeframe")
    var timeframe: Timeframe

    static var parameterSummary: some ParameterSummary {
        Summary("\(.applicationName) Trends for \(\.$timeframe)") {
            \.$timeframe
        }
    }
}
```

**String Catalog automatically extracts**:
- Intent title
- Parameter names
- Phrase templates with placeholders

**Localized phrases**:
```
English: "Food Truck Trends for this week"
Spanish: "Tendencias de Food Truck para esta semana"
```

### AppShortcutsProvider Localization

```swift
struct FoodTruckShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ShowTopDonutsIntent(),
            phrases: [
                "\(.applicationName) Trends for \(\.$timeframe)",
                "Show trending donuts for \(\.$timeframe) in \(.applicationName)",
                "Give me trends for \(\.$timeframe) in \(.applicationName)"
            ]
        )
    }
}
```

Xcode extracts all 3 phrases into String Catalog for translation.

---

## Part 9: Migration from Legacy

### Converting .strings to .xcstrings

**Automatic migration**:
1. Select `.strings` file in Navigator
2. Editor → Convert to String Catalog
3. Xcode creates `.xcstrings` and preserves translations

**Manual approach**:
1. Create new String Catalog
2. Build project (Xcode extracts strings from code)
3. Import translations via File → Import Localizations (XLIFF)
4. Delete old `.strings` files

### Converting .stringsdict

**Plural files automatically merge**:
1. Keep `.strings` and `.stringsdict` together
2. Convert → Both merge into single `.xcstrings`
3. Plural variations preserved

### Gradual Migration Strategy

**Phase 1**: New code uses String Catalogs
- Create `Localizable.xcstrings`
- Write new code with `String(localized:)`
- Keep legacy `.strings` files for old code

**Phase 2**: Migrate existing strings
- Convert one `.strings` table at a time
- Test translations after each conversion
- Update code using old `NSLocalizedString` calls

**Phase 3**: Remove legacy files
- Delete `.strings` and `.stringsdict` files
- Verify all strings in String Catalog
- Submit to App Store

**Coexistence**: `.strings` and `.xcstrings` work together - Xcode checks both.

---

## Common Mistakes

### Hardcoded Strings

```swift
// ❌ Wrong - not localizable
Text("Welcome")
let title = "Settings"

// ✅ Correct - localizable
Text("Welcome")  // SwiftUI auto-localizes
let title = String(localized: "Settings")
```

### Concatenating Localized Strings

```swift
// ❌ Wrong - word order varies by language
let message = String(localized: "You have") + " \(count) " + String(localized: "items")

// ✅ Correct - single localizable string with substitution
let message = String(localized: "You have \(count) items")
```

**Why wrong**: Some languages put numbers before nouns, some after.

### Missing Plural Forms

```swift
// ❌ Wrong - grammatically incorrect for many languages
Text("\(count) item(s)")

// ✅ Correct - proper plural handling
Text("\(count) items")  // Xcode creates plural variations
```

### Ignoring RTL

```swift
// ❌ Wrong - breaks in RTL languages
.padding(.left, 20)
HStack {
    backButton
    Spacer()
    title
}

// ✅ Correct - mirrors automatically
.padding(.leading, 20)
HStack {
    backButton  // Appears on right in RTL
    Spacer()
    title
}
```

### Wrong Date/Number Formats

```swift
// ❌ Wrong - US-only format
let formatter = DateFormatter()
formatter.dateFormat = "MM/dd/yyyy"

// ✅ Correct - adapts to locale
formatter.dateStyle = .short
formatter.locale = Locale.current
```

### Forgetting Comments

```swift
// ❌ Wrong - translator has no context
String(localized: "Confirm")

// ✅ Correct - clear context
String(localized: "Confirm", comment: "Button to confirm delete action")
```

**Impact**: "Confirm" could mean "verify" or "acknowledge" - context matters for accurate translation.

---

## Troubleshooting

### Strings not appearing in String Catalog

**Cause**: Build settings not enabled

**Solution**:
1. Build Settings → "Use Compiler to Extract Swift Strings" → Yes
2. Clean Build Folder (Cmd+Shift+K)
3. Build project

### Translations not showing in app

**Cause 1**: Language not added to project
1. Project → Info → Localizations → + button
2. Add target language

**Cause 2**: String marked as "Stale"
- Remove stale strings or verify code still uses them

### Plural forms incorrect

**Cause**: Using `String.localizedStringWithFormat` instead of String Catalog

**Solution**: Use String Catalog's automatic plural handling:
```swift
// ✅ Correct
Text("\(count) items")

// ❌ Wrong
Text(String.localizedStringWithFormat(NSLocalizedString("%d items", comment: ""), count))
```

### XLIFF export missing strings

**Cause**: "Localization Prefers String Catalogs" not set

**Solution**:
1. Build Settings → "Localization Prefers String Catalogs" → Yes
2. Export Localizations again

### Generated symbols not appearing (Xcode 26+)

**Cause 1**: Build setting not enabled

**Solution**:
1. Build Settings → "Generate String Catalog Symbols" → Yes
2. Clean Build Folder (Cmd+Shift+K)
3. Rebuild project

**Cause 2**: String not manually added to catalog

**Solution**: Symbols only generate for manually-added strings (+ button in String Catalog). Auto-extracted strings don't generate symbols.

### #bundle macro not working (Xcode 26+)

**Cause**: Wrong syntax or missing import

**Solution**:
```swift
import Foundation  // Required for #bundle
Text("My Collections", bundle: #bundle, comment: "Section title")
```

Verify you're using `#bundle` not `.module`.

### Refactoring to symbols fails (Xcode 26+)

**Cause 1**: String not in String Catalog
1. Ensure string exists in `.xcstrings` file
2. Build project to refresh catalog
3. Try refactoring again

**Cause 2**: Build setting not enabled
- Enable "Generate String Catalog Symbols" in Build Settings
- Clean and rebuild

---

## Part 10: Xcode 26 Localization Enhancements

Xcode 26 introduces type-safe localization with generated symbols, automatic comment generation using on-device AI, and improved Swift Package support with the `#bundle` macro. Based on WWDC 2025 session 225 "Explore localization with Xcode".

### Generated Symbols (Type-Safe Localization)

**The problem**: String-based localization fails silently when typos occur.

```swift
// ❌ Typo - fails silently at runtime
Text("App.HomeScren.Title")  // Missing 'e' in Screen
```

**The solution**: Xcode 26 generates type-safe symbols from manually-added strings.

#### How It Works

1. **Add strings manually** to String Catalog using the + button
2. **Enable build setting**: "Generate String Catalog Symbols" (ON by default in new projects)
3. **Use symbols** instead of strings

```swift
// ✅ Type-safe - compiler catches typos
Text(.appHomeScreenTitle)
```

#### Symbol Generation Rules

| String Type | Generated Symbol Type | Usage Example |
|-------------|----------------------|---------------|
| No placeholders | Static property | `Text(.introductionTitle)` |
| With placeholders | Function with labeled arguments | `.subtitle(friendsPosts: 42)` |

**Key naming conversion**:
- `App.HomeScreen.Title` → `.appHomeScreenTitle`
- Periods removed, camel-cased
- Available on `LocalizedStringResource`

#### Code Examples

```swift
// SwiftUI views
struct ContentView: View {
    var body: some View {
        NavigationStack {
            Text(.introductionTitle)
                .navigationSubtitle(.subtitle(friendsPosts: 42))
        }
    }
}

// Foundation String
let message = String(localized: .curatedCollection)

// Custom views with LocalizedStringResource
struct CollectionDetailEditingView: View {
    let title: LocalizedStringResource

    init(title: LocalizedStringResource) {
        self.title = title
    }

    var body: some View {
        Text(title)
    }
}

CollectionDetailEditingView(title: .editingTitle)
```

---

### Automatic Comment Generation

Xcode 26 uses an **on-device model** to automatically generate contextual comments for localizable strings.

#### Enabling the Feature

1. Open Xcode Settings → Editing
2. Enable "automatically generate string catalog comments"
3. New strings added to code automatically receive generated comments

#### Example

For a button string, Xcode generates:

> "The text label on a button to cancel the deletion of a collection"

This context helps translators understand where and how the string is used.

#### XLIFF Export

Auto-generated comments are marked in exported XLIFF files:

```xml
<trans-unit id="Grand Canyon" xml:space="preserve">
    <source>Grand Canyon</source>
    <target state="new">Grand Canyon</target>
    <note from="auto-generated">Suggestion for searching landmarks</note>
</trans-unit>
```

**Benefits**:
- Saves developer time writing translator context
- Provides consistent, clear descriptions
- Improves translation quality

---

### Swift Package & Framework Localization

#### The Problem

SwiftUI uses the `.main` bundle by default. Swift Packages and frameworks need to reference their own bundle:

```swift
// ❌ Wrong - uses main bundle, strings not found
Text("My Collections", comment: "Section title")
```

#### The Solution: #bundle Macro (NEW in Xcode 26)

The `#bundle` macro automatically references the correct bundle for the current target:

```swift
// ✅ Correct - automatically uses package/framework bundle
Text("My Collections", bundle: #bundle, comment: "Section title")
```

**Key advantages**:
- Works in main app, frameworks, and Swift Packages
- Backwards-compatible with older OS versions
- Eliminates manual `.module` bundle management

#### With Custom Table Names

```swift
// Main app
Text("My Collections",
     tableName: "Discover",
     comment: "Section title")

// Framework or Swift Package
Text("My Collections",
     tableName: "Discover",
     bundle: #bundle,
     comment: "Section title")
```

---

### Custom Table Symbol Access

When using multiple String Catalogs for organization:

#### Default "Localizable" Table

Symbols are directly accessible on `LocalizedStringResource`:

```swift
Text(.welcomeMessage)  // From Localizable.xcstrings
```

**Note**: Xcode automatically resolves symbols from the default "Localizable" table. Explicit table selection is rarely needed—use it only for debugging or testing specific catalogs.

#### Custom Tables

Symbols are nested in the table namespace:

```swift
// From Discover.xcstrings
Text(Discover.featuredCollection)

// From Settings.xcstrings
Text(Settings.privacyPolicy)
```

**Organization strategy for large apps**:
- **Localizable.xcstrings** - Core app strings
- **FeatureName.xcstrings** - Feature-specific strings (e.g., Onboarding, Settings, Discover)
- Benefits: Easier to manage, clearer ownership, better XLIFF organization

---

### Two Localization Workflows

Xcode 26 supports two complementary workflows:

#### Workflow 1: String Extraction (Recommended for new projects)

**Process**:
1. Write strings directly in code
2. Use SwiftUI views (`Text`, `Button`) and `String(localized:)`
3. Xcode automatically extracts to String Catalog
4. Leverage automatic comment generation

**Pros**: Simple initial setup, immediate start

**Cons**: Less control over string organization

```swift
// ✅ String extraction workflow
Text("Welcome to WWDC!", comment: "Main welcome message")
```

#### Workflow 2: Generated Symbols (Recommended as complexity grows)

**Process**:
1. Manually add strings to String Catalog
2. Reference via type-safe symbols
3. Organize into custom tables

**Pros**: Better control, type safety, easier to maintain across frameworks

**Cons**: Requires planning string catalog structure upfront

```swift
// ✅ Generated symbols workflow
Text(.welcomeMessage)
```

| Workflow | Best For | Trade-offs |
|----------|----------|------------|
| String Extraction | New projects, simple apps, prototyping | Automatic extraction, less control over organization |
| Generated Symbols | Large apps, frameworks, multiple teams | Type safety, better organization, requires upfront planning |

---

### Refactoring Between Workflows

Xcode 26 allows converting between workflows without manual rewriting.

#### Converting Strings to Symbols

1. **Right-click** on a string literal in code
2. Select **"Refactor > Convert Strings to Symbols"**
3. **Preview** all affected locations
4. **Customize** symbol names before confirming
5. **Apply** to entire table or individual strings

**Example**:

```swift
// Before
Text("Welcome to WWDC!", comment: "Main welcome message")

// After refactoring
Text(.welcomeToWWDC)
```

**Benefits**:
- Batch conversion of entire String Catalogs
- Preview changes before applying
- Maintain localization without code rewrites

---

### Implementation Checklist

After adopting Xcode 26 generated symbols, verify:

**Build Configuration:**
- [ ] "Generate String Catalog Symbols" build setting enabled
- [ ] Project builds without "Cannot find 'symbolName' in scope" errors
- [ ] Clean build succeeds (Cmd+Shift+K, then Cmd+B)

**String Catalog Setup:**
- [ ] Strings manually added to catalog using + button (not auto-extracted)
- [ ] Symbol names follow conventions (camelCase, no periods)
- [ ] Custom tables organized by feature (if using multiple catalogs)

**Swift Package Integration:**
- [ ] All `Text()` and `String(localized:)` calls in packages use `bundle: #bundle`
- [ ] Import Foundation added where `#bundle` is used
- [ ] Tested package builds independently and as dependency

**Refactoring & Migration:**
- [ ] Tested refactoring tool on sample strings
- [ ] Preview showed expected changes before applying
- [ ] Old string-based calls still work during transition period

**Optional Features:**
- [ ] Automatic comment generation enabled in Xcode Settings → Editing (optional)
- [ ] Tested AI-generated comments for accuracy
- [ ] XLIFF export includes auto-generated comments

**Testing:**
- [ ] Symbols resolve correctly in SwiftUI previews
- [ ] Localization works across all supported languages
- [ ] App runs on minimum supported iOS version

---

## Resources

**WWDC**: 2025-225, 2023-10155, 2022-10110

**Docs**: /xcode/localization, /xcode/localizing-and-varying-text-with-a-string-catalog

**Skills**: axiom-app-intents-ref, axiom-hig, axiom-accessibility-diag
