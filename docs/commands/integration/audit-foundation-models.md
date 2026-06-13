---
name: audit-foundation-models
description: Scan Foundation Models / Apple Intelligence code for missing availability checks, main-thread blocking, manual JSON parsing, guardrail handling
---

# audit-foundation-models

Scan Foundation Models / Apple Intelligence integration code for issues that crash on unsupported devices, freeze the UI, or mishandle guardrail responses.

## What This Command Does

Launches the **foundation-models-auditor** agent to flag the most common mistakes when integrating on-device language models — missing availability gates, blocking calls on the main actor, and brittle parsing of structured output.

## What It Checks

1. **Missing availability checks** – `LanguageModelSession` use without `isAvailable` or device-capability gating
2. **Main thread blocking** – synchronous model calls on `@MainActor`, freezing the UI during inference
3. **Manual JSON parsing** – `JSONDecoder` against model output where `@Generable` would give compiler-checked structure
4. **Missing error handling** – no recovery for `.guardrailViolation`, `.unsupportedLanguage`, `.assetsUnavailable`
5. **Session lifecycle** – sessions created per-message instead of reused, or held across app states without checkpointing

## Related Agent

- [foundation-models-auditor](/agents/foundation-models-auditor) – The agent that powers this command
- [foundation-models-ref](/reference/foundation-models-ref) – Foundation Models reference
