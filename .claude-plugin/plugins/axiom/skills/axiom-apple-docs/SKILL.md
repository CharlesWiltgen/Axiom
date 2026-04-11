---
name: axiom-apple-docs
description: Use when ANY question involves Apple framework APIs, Swift compiler errors, or Xcode-bundled documentation. Covers Liquid Glass, Swift 6.2 concurrency, Foundation Models, SwiftData, StoreKit, 32 Swift compiler diagnostics.
license: MIT
---

# Apple Documentation Router

Apple bundles for-LLM markdown documentation inside Xcode. These are authoritative, up-to-date guides and diagnostics written by Apple engineers. Use them alongside Axiom skills for the most accurate information.

## When to Use

Use Apple's bundled docs when:
- You need the exact API signature or behavior from Apple
- Axiom skills reference an Apple framework and you want the official source
- A Swift compiler diagnostic needs explanation
- The user asks about a specific Apple framework feature

**Priority**: Axiom skills provide opinionated guidance (decision trees, anti-patterns, pressure scenarios). Apple docs provide authoritative API details. Use both together.

## Guide Topics (AdditionalDocumentation)

Read these with the MCP `axiom_read_skill` tool using the skill name.

### UI & Design

| Topic | Skill Name |
|-------|-----------|
| Liquid Glass in SwiftUI | `apple-guide-swiftui-implementing-liquid-glass-design` |
| Liquid Glass in UIKit | `apple-guide-uikit-implementing-liquid-glass-design` |
| Liquid Glass in AppKit | `apple-guide-appkit-implementing-liquid-glass-design` |
| Liquid Glass in WidgetKit | `apple-guide-widgetkit-implementing-liquid-glass-design` |
| SwiftUI toolbar features | `apple-guide-swiftui-new-toolbar-features` |
| SwiftUI styled text editing | `apple-guide-swiftui-styled-text-editing` |
| SwiftUI WebKit integration | `apple-guide-swiftui-webkit-integration` |
| SwiftUI AlarmKit integration | `apple-guide-swiftui-alarmkit-integration` |
| Swift Charts 3D visualization | `apple-guide-swift-charts-3d-visualization` |
| Foundation AttributedString | `apple-guide-foundation-attributedstring-updates` |

### Data & Persistence

| Topic | Skill Name |
|-------|-----------|
| SwiftData class inheritance | `apple-guide-swiftdata-class-inheritance` |

### Concurrency & Performance

| Topic | Skill Name |
|-------|-----------|
| Swift concurrency updates | `apple-guide-swift-concurrency-updates` |
| InlineArray and Span | `apple-guide-swift-inlinearray-span` |

### Apple Intelligence

| Topic | Skill Name |
|-------|-----------|
| Foundation Models (on-device LLM) | `apple-guide-foundationmodels-using-on-device-llm-in-your-app` |

### System Integration

| Topic | Skill Name |
|-------|-----------|
| App Intents updates | `apple-guide-appintents-updates` |
| StoreKit updates | `apple-guide-storekit-updates` |
| MapKit GeoToolbox | `apple-guide-mapkit-geotoolbox-placedescriptors` |
| Widgets for visionOS | `apple-guide-widgets-for-visionos` |

### Accessibility

| Topic | Skill Name |
|-------|-----------|
| Assistive Access in iOS | `apple-guide-implementing-assistive-access-in-ios` |

### Computer Vision

| Topic | Skill Name |
|-------|-----------|
| Visual Intelligence in iOS | `apple-guide-implementing-visual-intelligence-in-ios` |

## Swift Compiler Diagnostics

These explain specific Swift compiler errors and warnings with examples and fixes.

### Concurrency Diagnostics

| Diagnostic | Skill Name |
|-----------|-----------|
| Actor-isolated call from nonisolated context | `apple-diag-actor-isolated-call` |
| Conformance isolation | `apple-diag-conformance-isolation` |
| Isolated conformances | `apple-diag-isolated-conformances` |
| Nonisolated nonsending by default | `apple-diag-nonisolated-nonsending-by-default` |
| Sendable closure captures | `apple-diag-sendable-closure-captures` |
| Sendable metatypes | `apple-diag-sendable-metatypes` |
| Sending closure risks data race | `apple-diag-sending-closure-risks-data-race` |
| Sending risks data race | `apple-diag-sending-risks-data-race` |
| Mutable global variable | `apple-diag-mutable-global-variable` |
| Preconcurrency import | `apple-diag-preconcurrency-import` |

### Type System Diagnostics

| Diagnostic | Skill Name |
|-----------|-----------|
| Existential any | `apple-diag-existential-any` |
| Existential member access limitations | `apple-diag-existential-member-access-limitations` |
| Nominal types | `apple-diag-nominal-types` |
| Multiple inheritance | `apple-diag-multiple-inheritance` |
| Protocol type non-conformance | `apple-diag-protocol-type-non-conformance` |
| Opaque type inference | `apple-diag-opaque-type-inference` |

### Build & Migration Diagnostics

| Diagnostic | Skill Name |
|-----------|-----------|
| Deprecated declaration | `apple-diag-deprecated-declaration` |
| Error in future Swift version | `apple-diag-error-in-future-swift-version` |
| Strict language features | `apple-diag-strict-language-features` |
| Strict memory safety | `apple-diag-strict-memory-safety` |
| Implementation only deprecated | `apple-diag-implementation-only-deprecated` |
| Member import visibility | `apple-diag-member-import-visibility` |
| Missing module on known paths | `apple-diag-missing-module-on-known-paths` |
| Clang declaration import | `apple-diag-clang-declaration-import` |
| Availability unrecognized name | `apple-diag-availability-unrecognized-name` |
| Unknown warning group | `apple-diag-unknown-warning-group` |

### Swift Language Diagnostics

| Diagnostic | Skill Name |
|-----------|-----------|
| Dynamic callable requirements | `apple-diag-dynamic-callable-requirements` |
| Property wrapper requirements | `apple-diag-property-wrapper-requirements` |
| Result builder methods | `apple-diag-result-builder-methods` |
| String interpolation conformance | `apple-diag-string-interpolation-conformance` |
| Trailing closure matching | `apple-diag-trailing-closure-matching` |
| Temporary pointers | `apple-diag-temporary-pointers` |

## Routing Decision Tree

```
User question about Apple API/framework?
├── Specific compiler error/warning → Read matching apple-diag-* skill
├── Liquid Glass implementation → Read apple-guide-*-liquid-glass-design (SwiftUI/UIKit/AppKit)
├── Swift concurrency patterns → Read apple-guide-swift-concurrency-updates
├── Foundation Models / on-device AI → Read apple-guide-foundationmodels-*
├── SwiftData features → Read apple-guide-swiftdata-*
├── StoreKit / IAP → Read apple-guide-storekit-updates
├── App Intents / Siri → Read apple-guide-appintents-updates
├── Charts / visualization → Read apple-guide-swift-charts-3d-visualization
├── Text editing / AttributedString → Read apple-guide-swiftui-styled-text-editing or apple-guide-foundation-attributedstring-updates
├── WebKit in SwiftUI → Read apple-guide-swiftui-webkit-integration
├── Toolbar features → Read apple-guide-swiftui-new-toolbar-features
└── Other → Search with axiom_search_skills using source filter "apple"
```

## Resources

**Skills**: axiom-swiftui, axiom-concurrency, axiom-ios-data, axiom-ios-ai, axiom-integration
