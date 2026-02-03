---
name: axiom-ios-ai
description: Use when implementing ANY Apple Intelligence or on-device AI feature. Covers Foundation Models, @Generable, LanguageModelSession, structured output, Tool protocol, iOS 26 AI integration.
license: MIT
---

# iOS Apple Intelligence Router

**You MUST use this skill for ANY Apple Intelligence or Foundation Models work.**

## When to Use

Use this router when:
- Implementing Apple Intelligence features
- Using Foundation Models
- Working with LanguageModelSession
- Generating structured output with @Generable
- Debugging AI generation issues
- iOS 26 on-device AI

## Routing Logic

### Foundation Models Work

**Implementation patterns** → `/skill axiom-foundation-models`
- LanguageModelSession basics
- @Generable structured output
- Tool protocol integration
- Streaming with PartiallyGenerated
- Dynamic schemas
- 26 WWDC code examples

**API reference** → `/skill axiom-foundation-models-ref`
- Complete API documentation
- All @Generable examples
- Tool protocol patterns
- Streaming generation patterns

**Diagnostics** → `/skill axiom-foundation-models-diag`
- AI response blocked
- Generation slow
- Guardrail violations
- Context limits exceeded
- Model unavailable

## Decision Tree

1. Implementing Foundation Models / @Generable / Tool protocol? → foundation-models
2. Need API reference / code examples? → foundation-models-ref
3. Debugging AI issues (blocked, slow, guardrails)? → foundation-models-diag

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Foundation Models is just LanguageModelSession" | Foundation Models has @Generable, Tool protocol, streaming, and guardrails. foundation-models covers all. |
| "I'll figure out the AI patterns as I go" | AI APIs have specific error handling and fallback requirements. foundation-models prevents runtime failures. |
| "I've used LLMs before, this is similar" | Apple's on-device models have unique constraints (guardrails, context limits). foundation-models is Apple-specific. |

## Critical Patterns

**foundation-models**:
- LanguageModelSession setup
- @Generable for structured output
- Tool protocol for function calling
- Streaming generation
- Dynamic schema evolution

**foundation-models-diag**:
- Blocked response handling
- Performance optimization
- Guardrail violations
- Context management

## Example Invocations

User: "How do I use Apple Intelligence to generate structured data?"
→ Invoke: `/skill axiom-foundation-models`

User: "My AI generation is being blocked"
→ Invoke: `/skill axiom-foundation-models-diag`

User: "Show me @Generable examples"
→ Invoke: `/skill axiom-foundation-models-ref`

User: "Implement streaming AI generation"
→ Invoke: `/skill axiom-foundation-models`
