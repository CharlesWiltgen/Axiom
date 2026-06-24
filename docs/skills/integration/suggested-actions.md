---
name: suggested-actions
description: Drop-in Apple-Intelligence-generated suggested actions for a messaging conversation with the iOS 27 SuggestedActions framework
skill_type: reference
apple_platforms: iOS 27+, iPadOS 27+, macOS 27+, macCatalyst 27+, visionOS 27+
---

# Suggested Actions

`import SuggestedActions` is a new iOS 27 framework that gives a messaging app a drop-in SwiftUI view rendering Apple-Intelligence-generated suggested actions for a conversation. The suggestions are produced on-device — you describe the message and the system generates and renders the actions. There's no `LanguageModelSession`, prompt, or `@Generable`; this is a turnkey Apple Intelligence component, not a build-your-own path.

## When to Use

Use this skill when you're:
- Building a Messages-style chat or email app and want Apple's system-suggested actions shown inline for an incoming message
- Pre-generating suggestions as messages arrive so the view appears without delay

If you need to generate your *own* structured output from an on-device model, that's [Foundation Models](/skills/integration/foundation-models), not this.

## Example Prompts

- "Add Apple's built-in suggested actions to my Messages-style app on iOS 27."
- "Show smart, on-device suggested replies for a message thread."
- "What's the `com.apple.developer.suggested-actions` entitlement for?"
- "Pre-generate suggestions when a message arrives so the view is instant."

## What This Skill Provides

- **`SuggestedActionsView`** – a `@MainActor` SwiftUI `View`; initialize with the focused `message` and optional `previousMessages`
- **`SuggestedActionsMessage`** – the context you hand the system: `AttributedString` body/subject, `date`, a `sender`, and `recipients`, each a `Participant(name:handle:isUser:)`
- **`previousMessagesLimit`** – the system's supported maximum number of preceding messages to pass for context
- **`generate(message:previousMessages:)`** – a `nonisolated static async` call to warm suggestions ahead of presenting the view
- **Entitlement** – the feature is gated by `com.apple.developer.suggested-actions` (Signing & Capabilities); availability-gate with `#available` and fall back to your normal reply UI

## Related

- [Foundation Models](/skills/integration/foundation-models) – build-your-own on-device generation (`LanguageModelSession`, `@Generable`), the path to use when you need custom output rather than system-suggested actions
- [Privacy UX](/skills/integration/privacy-ux) – entitlement and capability request patterns
