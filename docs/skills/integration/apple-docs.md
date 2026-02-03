# Apple Documentation Access

Router skill providing direct access to Apple's official for-LLM markdown documentation bundled inside Xcode. 20 guide topics and 32 Swift compiler diagnostics, written by Apple engineers.

## When to Use

Use this skill when:
- You need the exact API signature or behavior from Apple
- A Swift compiler diagnostic needs explanation with examples
- Axiom skills reference an Apple framework and you want the official source
- You want authoritative code examples for Liquid Glass, Foundation Models, SwiftData, or Swift 6.2 concurrency

**Priority**: Axiom skills provide opinionated guidance (decision trees, anti-patterns, pressure scenarios). Apple docs provide authoritative API details. Use both together.

## Example Prompts

- "What does the Swift compiler error 'actor-isolated call from nonisolated context' mean?"
- "Show me Apple's official guide for implementing Liquid Glass in SwiftUI"
- "How does Apple recommend using Foundation Models on-device?"
- "What's the official pattern for SwiftData class inheritance?"

## What's Covered

### Guide Topics (20)

**UI & Design** -- Liquid Glass (SwiftUI, UIKit, AppKit, WidgetKit), toolbar features, styled text editing, WebKit integration, AlarmKit integration, Swift Charts 3D, Foundation AttributedString

**Data & Persistence** -- SwiftData class inheritance

**Concurrency & Performance** -- Swift 6.2 concurrency updates, InlineArray and Span

**Apple Intelligence** -- Foundation Models (on-device LLM)

**System Integration** -- App Intents updates, StoreKit updates, MapKit GeoToolbox, Widgets for visionOS

**Accessibility** -- Assistive Access in iOS

**Computer Vision** -- Visual Intelligence in iOS

### Swift Compiler Diagnostics (32)

Official explanations with code examples for concurrency errors (actor isolation, Sendable, data races), type system diagnostics (existential any, opaque types, protocol conformance), and build/migration diagnostics (deprecated declarations, strict language features, module visibility).

## How It Works

Apple bundles for-LLM markdown documentation inside Xcode at two locations:
- **AdditionalDocumentation** -- Framework guides with implementation patterns
- **Swift diagnostics** -- Compiler error/warning explanations with before/after code

Axiom's MCP server reads these files at runtime from the local Xcode installation. They stay current when Xcode updates.

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `AXIOM_XCODE_PATH` | `/Applications/Xcode.app` | Custom Xcode path (e.g., Xcode-beta.app) |
| `AXIOM_APPLE_DOCS` | `true` | Set to `false` to disable Apple docs loading |

## Documentation Scope

This page documents the `axiom-apple-docs` router skill. The router maps user questions to specific Apple doc files (prefixed `apple-guide-*` and `apple-diag-*`).

- For WWDC transcript research, see [apple-docs-research](/skills/integration/apple-docs-research)
- For Axiom's own Liquid Glass guidance, see [liquid-glass](/skills/ui-design/liquid-glass)
- For Axiom's own concurrency guidance, see [swift-concurrency](/skills/concurrency/swift-concurrency)

## Related

- [apple-docs-research](/skills/integration/apple-docs-research) -- Research Apple frameworks via WWDC transcripts and sosumi.ai
- [foundation-models](/skills/integration/foundation-models) -- Axiom's opinionated Foundation Models guidance
- [swift-concurrency](/skills/concurrency/swift-concurrency) -- Axiom's Swift 6 concurrency patterns
- [liquid-glass](/skills/ui-design/liquid-glass) -- Axiom's Liquid Glass implementation guidance
