---
name: axiom-apple-docs
description: "Use when you need Apple's own documentation or a Swift compiler diagnostic explained rather than recalled."
---


# Apple Documentation Router

Apple bundles for-LLM markdown documentation inside Xcode. These are authoritative, up-to-date guides and diagnostics written by Apple engineers. Read them directly as files (in Claude Code, with the **`Read`** tool) — no MCP server or special tool required.

## When to Use

- You need the exact API signature or behavior from Apple
- An Axiom skill references an Apple framework and you want the official source
- A Swift compiler diagnostic needs explanation
- The user asks about a specific Apple framework feature

**Priority**: Axiom skills provide opinionated guidance (decision trees, anti-patterns, pressure scenarios). Apple docs provide authoritative API details. Use both together.

## How to Read These Docs

Axiom's session context names the Xcode the user has switched to. In Claude Code it lists the literal base directories ("Apple for-LLM Documentation: Xcode detected at `<path>`"); other harnesses name the app ("Installed on this machine: Xcode … (`<path>`)") — substitute that `.app` for `/Applications/Xcode.app` in the table below. Read `<base>/<filename>` as a file (the **`Read`** tool in Claude Code).

Default Xcode location (`/Applications/Xcode.app`) base directories:

| Content | Base directory |
|---|---|
| AdditionalDocumentation guides | `/Applications/Xcode.app/Contents/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation/` |
| Swift compiler diagnostics | `/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/share/doc/swift/diagnostics/` |

Example invocation Claude should produce:

```
Read /Applications/Xcode.app/Contents/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation/SwiftUI-Implementing-Liquid-Glass-Design.md
```

These paths assume the default install; use the path from session context instead. Without session context: use `AXIOM_XCODE_PATH` if it is set; otherwise run `xcode-select -p` (it honors `DEVELOPER_DIR`), which prints `<Xcode>.app/Contents/Developer` — drop `/Contents/Developer` and put that `.app` in place of `/Applications/Xcode.app` above. If it prints `/Library/Developer/CommandLineTools`, no Xcode is selected; try `/Applications/Xcode.app`.

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
ls "<Xcode>.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/share/doc/swift/diagnostics/"
```

`<Xcode>.app` is the app session context names; without session context, derive it as above. Command Line Tools keep the same files at `/Library/Developer/CommandLineTools/usr/share/doc/swift/diagnostics/`.

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

If the resolved Xcode has no `IDEIntelligenceChat.framework` documentation directory (older Xcode, or only Command Line Tools installed), fall back to the list below. For a Swift diagnostic, first try the Command Line Tools copy at `/Library/Developer/CommandLineTools/usr/share/doc/swift/diagnostics/`.

1. **sosumi.ai** (markdown mirror of developer.apple.com — see `skills/apple-docs-research.md`)
2. **WebFetch** of the equivalent developer.apple.com URL
3. **Suggest** installing the latest Xcode for full Apple docs coverage

Do not silently fail — tell the user when Xcode docs aren't available locally and which fallback you used.

## MCP Convenience Path

Clients using axiom-mcp can also invoke `axiom_read_skill` with the legacy ID (e.g., `apple-guide-swiftui-implementing-liquid-glass-design`). The MCP server reads the same Xcode files and returns the same content. Both paths are supported — the file-Read path works everywhere; the MCP path is a convenience for catalog/search workflows.

## Research Methodology

For WWDC transcript capture (Chrome auto-capture), sosumi.ai documentation access, and multi-session research workflows, see [skills/apple-docs-research.md](skills/apple-docs-research.md).

## Resources

**Skills**: axiom-swiftui, axiom-concurrency, axiom-data, axiom-ai, axiom-integration
