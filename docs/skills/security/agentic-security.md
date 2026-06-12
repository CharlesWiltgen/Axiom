# Agentic Feature Security

Threat modeling and mitigations for LLM-driven app features — agents built with Foundation Models or actions exposed to Siri via App Intents. Untrusted content reaching a model can become instructions; this skill covers identifying that exposure and gating the actions an attacker would abuse.

## When to Use

Use this skill when:
- Building an agentic loop with Foundation Models (tools plus multi-step actions)
- Exposing actions to Siri or Apple Intelligence via App Intents and App Schemas
- Feeding external content (feeds, calendars, messages, tool results) into a prompt
- Giving an agent actions with side effects — purchases, posts, deletions, device control
- Reviewing an AI feature's security posture before shipping

## Example Prompts

- "How do I protect my app's AI agent from prompt injection?"
- "My agent can order products — how do I require user confirmation?"
- "Should my App Intent run from the lock screen?"
- "How do I mark tool output as untrusted before it reaches the model?"

## What This Skill Provides

- A threat-modeling exercise: mapping untrusted prompt sources and classifying action side effects (financial, exfiltration, context poisoning, data loss)
- The indirect prompt injection model — data poisoning vs action poisoning, and the "Lethal Trifecta" risk framing
- Deterministic mitigations first: PII redaction, user confirmation via Foundation Models' `.onToolCall` lifecycle modifier (the 27 releases), and lock-screen gating with App Intents `authenticationPolicy`
- Probabilistic layers: spotlighting untrusted tool output with `.historyTransform` delimiters
- How App Intents schema risk metadata and the 27-cycle risk-based confirmation system protect schema-adopting intents
- A pre-ship checklist covering prompt-level and action-level defenses

## Related

- [App Attest](/skills/security/app-attest) — app integrity verification; complements agent security with client authenticity
- [Foundation Models](/skills/integration/foundation-models) — the framework these mitigations attach to (DynamicProfile, tools)
