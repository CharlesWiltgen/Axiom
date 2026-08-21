
# Suggested Actions (Apple Intelligence for Messaging) `OS27`

`import SuggestedActions` — a new framework (`OS27`: iOS 27, macOS 27, macCatalyst 27, visionOS 27 — **not** tvOS/watchOS) that gives a **messaging app** a drop-in SwiftUI view rendering Apple-Intelligence-generated suggested actions for a conversation (e.g. surfacing "Create Event" from "lunch at noon?"). The suggestions are produced on-device; you supply the message context and Apple generates and renders the actions — you do not author the actions or call a model yourself.

This is a **turnkey Apple Intelligence UI component**, not a build-your-own path. There is no `LanguageModelSession`, no `@Generable`, no prompt. If you need to generate your own structured output, that's Foundation Models (`skills/foundation-models.md`), not this.

## When to Use

- You build a Messages-style / chat / email app and want Apple's system-suggested actions shown inline for an incoming message

## Entitlement

The feature is gated. Add the **`com.apple.developer.suggested-actions`** capability (Signing & Capabilities) — the system won't provide suggestions without it. This is a request-access entitlement, like other Apple Intelligence surfaces; budget for the provisioning step.

## Describe the message

`SuggestedActionsMessage` is the context you hand the system. Bodies and subjects are `AttributedString`; participants carry a display `name`, a `handle` (address/phone/username), and `isUser` to mark which side is the local user.

```swift
import SuggestedActions

@available(iOS 27, macOS 27, macCatalyst 27, visionOS 27, *)
func makeContext(from incoming: ChatMessage) -> SuggestedActionsMessage {
    let them = SuggestedActionsMessage.Participant(
        name: "Alex", handle: "alex@example.com", isUser: false
    )
    let me = SuggestedActionsMessage.Participant(
        name: "Me", handle: "me@example.com", isUser: true
    )
    return SuggestedActionsMessage(
        id: incoming.id,                          // any Hashable
        date: incoming.date,
        subject: nil,                             // AttributedString? — e.g. email subject
        body: AttributedString(incoming.text),
        sender: them,
        recipients: [me]
    )
}
```

## Show the view

`SuggestedActionsView` is a `@MainActor` SwiftUI `View`. Pass the focused message plus the preceding thread messages for context; the system uses up to `SuggestedActionsMessage.previousMessagesLimit` of them, so keep the array within that bound:

```swift
import SwiftUI
import SuggestedActions

@available(iOS 27, macOS 27, macCatalyst 27, visionOS 27, *)
struct ConversationFooter: View {
    let message: SuggestedActionsMessage
    let history: [SuggestedActionsMessage]   // preceding messages in this thread

    var body: some View {
        SuggestedActionsView(message: message, previousMessages: history)
    }
}
```

`previousMessages` defaults to `[]`, so `SuggestedActionsView(message:)` is valid when you have no thread context. `previousMessagesLimit` is the system's supported maximum; follow Apple's docs for the expected ordering of the messages you pass.

## Pre-generate (optional)

`SuggestedActionsView.generate(message:previousMessages:)` is a `nonisolated static async` call intended to warm suggestions ahead of display — call it when a message arrives so generation can begin before the view appears, rather than starting when it's shown:

```swift
@available(iOS 27, macOS 27, macCatalyst 27, visionOS 27, *)
func onMessageReceived(_ m: SuggestedActionsMessage, history: [SuggestedActionsMessage]) async {
    await SuggestedActionsView.generate(message: m, previousMessages: history)
}
```

## Gate on availability

The framework is 27-cycle and not on every platform — gate with `#available` and provide your app's normal UI when it's absent (older OS, tvOS/watchOS, or Apple Intelligence unavailable):

```swift
if #available(iOS 27, macOS 27, macCatalyst 27, visionOS 27, *) {
    SuggestedActionsView(message: context)
} else {
    // your existing reply UI
}
```

## Resources

**Docs**: /suggestedactions

**Skills**: foundation-models, foundation-models-ref
