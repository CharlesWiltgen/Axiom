---
name: axiom-apple-docs
description: Use when ANY question involves Apple framework APIs, Swift compiler errors, or Xcode-bundled documentation. Covers Liquid Glass, Swift 6.2 concurrency, Foundation Models, SwiftData, StoreKit, 32 Swift compiler diagnostics.
license: MIT
---

# Apple Documentation Router

Apple bundles for-LLM markdown documentation inside Xcode. These are authoritative, up-to-date guides and diagnostics written by Apple engineers. Read them directly with Claude Code's native **`Read`** tool — no MCP server or special tool required.

## When to Use

- You need the exact API signature or behavior from Apple
- An Axiom skill references an Apple framework and you want the official source
- A Swift compiler diagnostic needs explanation
- The user asks about a specific Apple framework feature

**Priority**: Axiom skills provide opinionated guidance (decision trees, anti-patterns, pressure scenarios). Apple docs provide authoritative API details. Use both together.

## How to Read These Docs

The session-start hook resolves Xcode's location and echoes the literal base directories into session context (look for "Apple for-LLM Documentation: Xcode detected at `<path>`"). Use the **`Read`** tool with `<that base>/<filename>`.

Default Xcode location (`/Applications/Xcode.app`) base directories:

| Content | Base directory |
|---|---|
| AdditionalDocumentation guides | `/Applications/Xcode.app/Contents/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation/` |
| Swift compiler diagnostics | `/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/share/doc/swift/diagnostics/` |

Example invocation Claude should produce:

```
Read /Applications/Xcode.app/Contents/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation/SwiftUI-Implementing-Liquid-Glass-Design.md
```

Xcode-beta users: the session-start hook respects `AXIOM_XCODE_PATH` and reports the resolved path in session context — use that path, not the default above.

## Guide Files (AdditionalDocumentation)

20 files. Read with the path pattern `{guides base}/{filename}`.

### UI & Design

| Topic | Filename |
|---|---|
| Liquid Glass in SwiftUI | `SwiftUI-Implementing-Liquid-Glass-Design.md` |
| Liquid Glass in UIKit | `UIKit-Implementing-Liquid-Glass-Design.md` |
| Liquid Glass in AppKit | `AppKit-Implementing-Liquid-Glass-Design.md` |
| Liquid Glass in WidgetKit | `WidgetKit-Implementing-Liquid-Glass-Design.md` |
| SwiftUI new toolbar features | `SwiftUI-New-Toolbar-Features.md` |
| SwiftUI styled text editing | `SwiftUI-Styled-Text-Editing.md` |
| SwiftUI WebKit integration | `SwiftUI-WebKit-Integration.md` |
| SwiftUI AlarmKit integration | `SwiftUI-AlarmKit-Integration.md` |
| Swift Charts 3D visualization | `Swift-Charts-3D-Visualization.md` |
| Foundation AttributedString updates | `Foundation-AttributedString-Updates.md` |

### Data & Persistence

| Topic | Filename |
|---|---|
| SwiftData class inheritance | `SwiftData-Class-Inheritance.md` |

### Concurrency & Performance

| Topic | Filename |
|---|---|
| Swift concurrency updates | `Swift-Concurrency-Updates.md` |
| InlineArray and Span | `Swift-InlineArray-Span.md` |

### Apple Intelligence

| Topic | Filename |
|---|---|
| Foundation Models (on-device LLM) | `FoundationModels-Using-on-device-LLM-in-your-app.md` |

### System Integration

| Topic | Filename |
|---|---|
| App Intents updates | `AppIntents-Updates.md` |
| StoreKit updates | `StoreKit-Updates.md` |
| MapKit GeoToolbox PlaceDescriptors | `MapKit-GeoToolbox-PlaceDescriptors.md` |
| Widgets for visionOS | `Widgets-for-visionOS.md` |

### Accessibility

| Topic | Filename |
|---|---|
| Assistive Access in iOS | `Implementing-Assistive-Access-in-iOS.md` |

### Computer Vision

| Topic | Filename |
|---|---|
| Visual Intelligence in iOS | `Implementing-Visual-Intelligence-in-iOS.md` |

## Swift Compiler Diagnostics

46 files in the diagnostics directory. Read with the path pattern `{diagnostics base}/{filename}`.

### Concurrency Diagnostics

| Diagnostic | Filename |
|---|---|
| Actor-isolated call from nonisolated context | `actor-isolated-call.md` |
| Conformance isolation | `conformance-isolation.md` |
| Isolated conformances | `isolated-conformances.md` |
| Nonisolated nonsending by default | `nonisolated-nonsending-by-default.md` |
| Sendable closure captures | `sendable-closure-captures.md` |
| Sendable metatypes | `sendable-metatypes.md` |
| Explicit Sendable annotations | `explicit-sendable-annotations.md` |
| Sending closure risks data race | `sending-closure-risks-data-race.md` |
| Sending risks data race | `sending-risks-data-race.md` |
| Mutable global variable | `mutable-global-variable.md` |
| Preconcurrency import | `preconcurrency-import.md` |
| Dynamic exclusivity | `dynamic-exclusivity.md` |
| Exclusivity violation | `exclusivity-violation.md` |

### Type System Diagnostics

| Diagnostic | Filename |
|---|---|
| Existential any | `existential-any.md` |
| Existential member access limitations | `existential-member-access-limitations.md` |
| Nominal types | `nominal-types.md` |
| Multiple inheritance | `multiple-inheritance.md` |
| Protocol type non-conformance | `protocol-type-non-conformance.md` |
| Opaque type inference | `opaque-type-inference.md` |
| Foreign reference type | `foreign-reference-type.md` |

### Build & Migration Diagnostics

| Diagnostic | Filename |
|---|---|
| Deprecated declaration | `deprecated-declaration.md` |
| Error in future Swift version | `error-in-future-swift-version.md` |
| Strict language features | `strict-language-features.md` |
| Strict memory safety | `strict-memory-safety.md` |
| Implementation only deprecated | `implementation-only-deprecated.md` |
| Member import visibility | `member-import-visibility.md` |
| Missing module on known paths | `missing-module-on-known-paths.md` |
| Module not testable | `module-not-testable.md` |
| Module version missing | `module-version-missing.md` |
| Clang declaration import | `clang-declaration-import.md` |
| Availability unrecognized name | `availability-unrecognized-name.md` |
| Always-available domain | `always-available-domain.md` |
| Upcoming language features | `upcoming-language-features.md` |
| Unknown warning group | `unknown-warning-group.md` |
| Compilation caching | `compilation-caching.md` |
| Embedded restrictions | `embedded-restrictions.md` |

### Swift Language Diagnostics

| Diagnostic | Filename |
|---|---|
| Dynamic callable requirements | `dynamic-callable-requirements.md` |
| Property wrapper requirements | `property-wrapper-requirements.md` |
| Result builder methods | `result-builder-methods.md` |
| String interpolation conformance | `string-interpolation-conformance.md` |
| Trailing closure matching | `trailing-closure-matching.md` |
| Temporary pointers | `temporary-pointers.md` |
| Semantic copies | `semantic-copies.md` |
| Performance hints | `performance-hints.md` |

### Index

| Diagnostic | Filename |
|---|---|
| Diagnostic groups (taxonomy) | `diagnostic-groups.md` |
| All diagnostics index | `diagnostics.md` |

If a diagnostic you need isn't listed above, list the diagnostics directory first:

```
ls $AXIOM_XCODE_PATH/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/share/doc/swift/diagnostics/
```

Filenames follow the diagnostic's short name (lowercase, hyphenated).

## Routing Decision Tree

```
User question about Apple API/framework?
├── Specific compiler error/warning → Read {diagnostics base}/<diagnostic-name>.md
├── Liquid Glass implementation     → Read {guides base}/<Framework>-Implementing-Liquid-Glass-Design.md
├── Swift concurrency patterns      → Read {guides base}/Swift-Concurrency-Updates.md
├── Foundation Models / on-device AI → Read {guides base}/FoundationModels-Using-on-device-LLM-in-your-app.md
├── SwiftData features              → Read {guides base}/SwiftData-Class-Inheritance.md
├── StoreKit / IAP                  → Read {guides base}/StoreKit-Updates.md
├── App Intents / Siri              → Read {guides base}/AppIntents-Updates.md
├── Charts / visualization          → Read {guides base}/Swift-Charts-3D-Visualization.md
├── Text editing / AttributedString → Read {guides base}/SwiftUI-Styled-Text-Editing.md or Foundation-AttributedString-Updates.md
├── WebKit in SwiftUI               → Read {guides base}/SwiftUI-WebKit-Integration.md
├── Toolbar features                → Read {guides base}/SwiftUI-New-Toolbar-Features.md
└── Other                           → ls the base directory to see what's available
```

## Fallback When Xcode Is Unavailable

If `AXIOM_XCODE_PATH` is unset, or the path doesn't exist, or the `IDEIntelligenceChat.framework` directory is missing (older Xcode), fall back to:

1. **sosumi.ai** (markdown mirror of developer.apple.com — see `axiom-tools/apple-docs-research.md`)
2. **WebFetch** of the equivalent developer.apple.com URL
3. **Suggest** installing the latest Xcode for full Apple docs coverage

Do not silently fail — tell the user when Xcode docs aren't available locally and which fallback you used.

## MCP Convenience Path

Clients using axiom-mcp can also invoke `axiom_read_skill` with the legacy ID (e.g., `apple-guide-swiftui-implementing-liquid-glass-design`). The MCP server reads the same Xcode files and returns the same content. Both paths are supported — the file-Read path works everywhere; the MCP path is a convenience for catalog/search workflows.

## Research Methodology

For WWDC transcript capture (Chrome auto-capture), sosumi.ai documentation access, and multi-session research workflows, see [skills/apple-docs-research.md](skills/apple-docs-research.md).

## Resources

**Skills**: axiom-swiftui, axiom-concurrency, axiom-data, axiom-ai, axiom-integration
