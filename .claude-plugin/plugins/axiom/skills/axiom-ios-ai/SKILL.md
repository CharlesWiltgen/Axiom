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

## AI Approach Triage

**First, determine which kind of AI the developer needs:**

| Developer Intent | Route To |
|-----------------|----------|
| On-device text generation (Apple Intelligence) | **Stay here** → Foundation Models skills |
| Custom ML model deployment (PyTorch, TensorFlow) | **Route to ios-ml** → CoreML conversion, compression |
| Computer vision (image analysis, OCR, segmentation) | **Route to ios-vision** → Vision framework |
| Cloud API integration (OpenAI, etc.) | **Route to ios-networking** → URLSession patterns |
| System AI features (Writing Tools, Genmoji) | No custom code needed — these are system-provided |

**Key boundary: ios-ai vs ios-ml**
- ios-ai = Apple's Foundation Models framework (LanguageModelSession, @Generable, on-device LLM)
- ios-ml = Custom model deployment (CoreML conversion, quantization, MLTensor, speech-to-text)
- If developer says "run my own model" → ios-ml. If "use Apple Intelligence" → ios-ai.

## Cross-Domain Routing

**Foundation Models + concurrency** (session blocking main thread, UI freezes):
- Foundation Models sessions are async — blocking likely means missing `await` or running on @MainActor
- **Fix here first** using async session patterns in foundation-models skill
- If concurrency issue is broader than Foundation Models → **also invoke ios-concurrency**

**Foundation Models + data** (@Generable decoding errors, structured output issues):
- @Generable output problems are Foundation Models-specific, NOT generic Codable issues
- **Stay here** → foundation-models-diag handles structured output debugging
- If developer also has general Codable/serialization questions → **also invoke ios-data**

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

1. Custom ML model / CoreML / PyTorch conversion? → **Route to ios-ml** (not this router)
2. Computer vision / image analysis / OCR? → **Route to ios-vision** (not this router)
3. Cloud AI API integration? → **Route to ios-networking** (not this router)
4. Implementing Foundation Models / @Generable / Tool protocol? → foundation-models
5. Need API reference / code examples? → foundation-models-ref
6. Debugging AI issues (blocked, slow, guardrails)? → foundation-models-diag
7. Foundation Models + UI freezing? → foundation-models (async patterns) + also invoke ios-concurrency if needed

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

User: "I want to add AI to my app"
→ First ask: Apple Intelligence (Foundation Models) or custom ML model? Route accordingly.

User: "My Foundation Models session is blocking the UI"
→ Invoke: `/skill axiom-foundation-models` (async patterns) + also invoke `ios-concurrency` if needed

User: "I want to run my PyTorch model on device"
→ Route to: `ios-ml` router (CoreML conversion, not Foundation Models)
