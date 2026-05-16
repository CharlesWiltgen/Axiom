---
name: axiom-ai
description: Use when implementing ANY Apple Intelligence or on-device AI feature. Covers Foundation Models, @Generable, LanguageModelSession, structured output, Tool protocol, iOS 26 AI integration.
license: MIT
---

# Apple Intelligence & AI

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
| Custom ML model deployment (PyTorch, TensorFlow) | **See skills/ios-ml.md** → CoreML conversion, compression |
| Computer vision (image analysis, OCR, segmentation) | **/skill axiom-vision** → Vision framework |
| Cloud API integration (OpenAI, generic HTTP) | **/skill axiom-networking** → URLSession patterns |
| Cloud Claude integration (Anthropic SDK, Messages API, Claude Agent SDK) | **See `claude-api` skill** (external) → includes automated Opus 4.6 → 4.7 migration |
| System AI features (Writing Tools, Genmoji) | No custom code needed — these are system-provided |

**Key boundary: Foundation Models vs ML (custom models)**
- Foundation Models = Apple's on-device LLM framework (LanguageModelSession, @Generable)
- ML = Custom model deployment (CoreML conversion, quantization, MLTensor, speech-to-text)
- If developer says "run my own model" → skills/ios-ml.md. If "use Apple Intelligence" → stay here.

## Training Path Boundaries

When developers say "I need to train / fine-tune / personalize a model," four distinct paths exist. They are often conflated; each has different output, lifecycle, and runtime compatibility.

| Path | Trains | Output | Lifecycle | Routes to |
|------|--------|--------|-----------|-----------|
| **FM custom adapter** | Apple's frozen on-device 3B LLM (rank-32 LoRA) | `.fmadapter` package, ~160 MB | Build-time per OS version, delivered via Background Assets | `skills/foundation-models-adapters.md` (discipline) + `skills/foundation-models-adapters-ref.md` (toolkit + runtime) + `skills/foundation-models-adapters-diag.md` (failure modes); delivery via `axiom-integration (skills/background-assets.md)` |
| **Core ML `MLUpdateTask`** | Your NN-spec model's fully-connected and convolutional layers | Updated `.mlmodelc` saved to disk | Runtime, per-user (on-device personalization) | `skills/ios-ml.md` |
| **MLX LM** (`mlx_lm.lora`) | Open-source LLMs on Apple silicon | `adapters/adapters.safetensors` — NOT loadable by Foundation Models | Build-time; not an iOS distribution path | External — outside Axiom scope; treat as adjacent research tool |
| **Server LLM fine-tune** | Cloud-hosted model (e.g., vendor fine-tunes) | Cloud artifact, accessed via API | Build-time; runs in cloud | `/skill axiom-networking` for the API integration; the fine-tune workflow is the vendor's domain |

**Critical distinctions**:
- MLX LM output (`.safetensors`) cannot be loaded into a `LanguageModelSession`. Different toolchain, different deployment target.
- `MLUpdateTask` is **NN-spec only** — does not support ML Program (`.mlpackage`) models from modern PyTorch / TensorFlow conversion. This is the main reason it's rarely used in new projects.
- FM custom adapters are pinned per-base-model version (per-OS). One adapter does NOT serve every device in your install base — see the Approach Triage section in `skills/foundation-models.md` for the deflection ladder.

## Cross-Domain Routing

**Foundation Models + concurrency** (session blocking main thread, UI freezes):
- Foundation Models sessions are async — blocking likely means missing `await` or running on @MainActor
- **Fix here first** using async session patterns in foundation-models skill
- If concurrency issue is broader than Foundation Models → **also invoke axiom-concurrency**

**Foundation Models + data** (@Generable decoding errors, structured output issues):
- @Generable output problems are Foundation Models-specific, NOT generic Codable issues
- **Stay here** → foundation-models-diag handles structured output debugging
- If developer also has general Codable/serialization questions → **also invoke axiom-data**

## Routing Logic

### Foundation Models Work

**Implementation patterns** → `skills/foundation-models.md`
- LanguageModelSession basics
- @Generable structured output
- Tool protocol integration
- Streaming with PartiallyGenerated
- Dynamic schemas
- 26 WWDC code examples

**API reference** → `skills/foundation-models-ref.md`
- Complete API documentation
- All @Generable examples
- Tool protocol patterns
- Streaming generation patterns

**Diagnostics** → `skills/foundation-models-diag.md`
- AI response blocked
- Generation slow
- Guardrail violations
- Context limits exceeded
- Model unavailable

**Custom adapter training (after Approach Triage rungs 1-4)** → `skills/foundation-models-adapters.md`
- Decision discipline (when adapter training is justified vs. rungs 1-4)
- Maintenance contract (per-OS retrain burden, four-axis eval)
- Per-OS variant strategy and runtime fallback
- Dataset construction discipline
- HIG disclosure for adapter-enhanced features

**Adapter toolkit & runtime API** → `skills/foundation-models-adapters-ref.md`
- Python toolkit setup (3.11, 32 GB Apple silicon Mac or Linux GPU)
- Dataset JSONL schema (chat-turn + tool-calling extension)
- `examples.train_adapter`, `examples.train_draft_model`, `examples.generate`, `export.export_fmadapter`
- `SystemLanguageModel.Adapter` runtime API and `AssetError` cases
- Per-base-model-version compatibility matrix
- `com.apple.developer.foundation-model-adapter` entitlement

**Adapter-specific diagnostics** → `skills/foundation-models-adapters-diag.md`
- `compatibleAdapterNotFound`, `invalidAdapterName`, `invalidAsset`
- Tool calls don't fire from adapter
- Adapter consumes context window with trivial prompts
- Accuracy drops after OS update (FB18924722)
- `coremltools.libmilstoragepython` missing on export

**Automated scanning** → Launch `foundation-models-auditor` agent or `/axiom:audit foundation-models`

Detects anti-patterns AND architectural gaps:
- Missing availability checks, main-thread `respond()`, manual JSON parsing, missing specific error catches (guardrail / contextWindow), session created per-tap, no streaming for long output, missing `@Guide` constraints, nested non-`@Generable` types, no fallback UI
- Prompt-injection risk from direct user-text interpolation, `@Generable` enums without `@frozen` (future-case crash), missing Cancel UX, missing transcript trimming, stale availability cache after Settings toggle, partial-output validation gaps, Tool errors indistinguishable from session errors, no retry on transient errors

Scores: PRODUCTION-READY / NEEDS HARDENING / FRAGILE

## Decision Tree

1. Custom ML model / CoreML / PyTorch conversion? → **See skills/ios-ml.md**
2. Computer vision / image analysis / OCR? → **/skill axiom-vision**
3. Cloud AI API integration? → **/skill axiom-networking**
4. Implementing Foundation Models / @Generable / Tool protocol? → foundation-models
5. Need API reference / code examples? → foundation-models-ref
6. Debugging AI issues (blocked, slow, guardrails)? → foundation-models-diag
7. Foundation Models + UI freezing? → foundation-models (async patterns) + also invoke axiom-concurrency if needed
8. Considering training a custom adapter? → **foundation-models** Approach Triage (rungs 1-4) FIRST; only after documented rung-1-4 failures → foundation-models-adapters
9. Implementing adapter loading, training pipeline, or runtime selection? → foundation-models-adapters + foundation-models-adapters-ref + axiom-integration (skills/background-assets.md) for delivery
10. Debugging adapter-specific failures (compatibleAdapterNotFound, tool calls don't fire from adapter, accuracy regression after OS update)? → foundation-models-adapters-diag
11. Want automated Foundation Models code scan? → foundation-models-auditor (Agent — detects 10 anti-patterns AND completeness gaps including prompt injection, frozen-enum discipline, transcript trimming, Cancel UX; scores PRODUCTION-READY / NEEDS HARDENING / FRAGILE)

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Foundation Models is just LanguageModelSession" | Foundation Models has @Generable, Tool protocol, streaming, and guardrails. foundation-models covers all. |
| "I'll figure out the AI patterns as I go" | AI APIs have specific error handling and fallback requirements. foundation-models prevents runtime failures. |
| "I've used LLMs before, this is similar" | Apple's on-device models have unique constraints (guardrails, context limits). foundation-models is Apple-specific. |
| "I know the Anthropic SDK already" | Opus 4.7 removed `temperature`, `top_p`, `top_k`, and prefill from the Messages API. Code that worked on 4.6 returns HTTP 400 at runtime. Read `claude-api` (external) before changing model IDs. |
| "We need to train a custom adapter to fix the model's outputs" | Most "we need an adapter" requests resolve via rungs 1-4 of the Approach Triage (prompt engineering, `@Generable`/`@Guide`, tool calling, built-in content-tagging adapter). foundation-models has the ladder; foundation-models-adapters is only justified after each rung's failure is documented. |
| "We trained one adapter, ship it for all our users" | Each `.fmadapter` pins to one base-model version; one adapter does not cover a multi-OS install base. foundation-models-adapters covers per-OS variant strategy and `compatibleAdapterIdentifiers(name:)` runtime selection. |
| "Skip locale-specific eval, our users are mostly English-speaking" | Apple's 2025 tech report groups eval as English-US / English-outside-US / PFIGSCJK. English-only eval against a multi-locale app ships invisible non-English regressions. foundation-models-adapters covers the four-axis eval requirement. |
| "Just bundle the .fmadapter file in the app" | Apple's docs explicitly prohibit this. Adapters ship via Background Assets `onDemand` policy. axiom-integration (skills/background-assets.md) covers the delivery half. |

## External Resources

**Cloud Claude integration (`claude-api` skill, ships outside Axiom).** Opus 4.7 removed `temperature`, `top_p`, `top_k`, and prefill from the Messages API — code that built successfully on 4.6 returns HTTP 400 at runtime, not compile time. The `claude-api` skill automates the migration (model ID swap, sampling-param removal, prefill replacement) and enforces prompt caching from day one. Skipping it costs an afternoon of production debugging when the first 400s arrive.

Apple's on-device Foundation Models and Anthropic's cloud Claude are unrelated stacks; use both in parallel when an app needs both, and treat `claude-api` as mandatory reading before any Claude model-ID change ships.

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
→ Read: `skills/foundation-models.md`

User: "My AI generation is being blocked"
→ Read: `skills/foundation-models-diag.md`

User: "Show me @Generable examples"
→ Read: `skills/foundation-models-ref.md`

User: "Implement streaming AI generation"
→ Read: `skills/foundation-models.md`

User: "I want to add AI to my app"
→ First ask: Apple Intelligence (Foundation Models) or custom ML model? Route accordingly.

User: "My Foundation Models session is blocking the UI"
→ Read: `skills/foundation-models.md` (async patterns) + also invoke `axiom-concurrency` if needed

User: "Review my Foundation Models code for issues"
→ Invoke: `foundation-models-auditor` agent

User: "I want to run my PyTorch model on device"
→ Read: `skills/ios-ml.md` (CoreML conversion, not Foundation Models)

User: "How do I train a custom adapter for our app's summarization?"
→ Read: `skills/foundation-models.md` (Approach Triage rungs 1-4 FIRST), then `skills/foundation-models-adapters.md` only if rung-1-4 failures are documented

User: "Our adapter loaded fine on iOS 26.0 but throws compatibleAdapterNotFound on 26.1"
→ Read: `skills/foundation-models-adapters-diag.md` (Pattern 1)

User: "What's the toolkit setup for adapter training?"
→ Read: `skills/foundation-models-adapters-ref.md` (Toolkit Setup)

User: "How do we ship a custom adapter to users?"
→ Read: `skills/foundation-models-adapters.md` (runtime lifecycle) + `axiom-integration (skills/background-assets.md)` (delivery)
