# Machine Learning

Skills for deploying and running machine learning models on Apple devices using CoreML and related frameworks.

```mermaid
flowchart LR
    classDef router fill:#6f42c1,stroke:#5a32a3,color:#fff
    classDef discipline fill:#d4edda,stroke:#28a745,color:#1b4332
    classDef reference fill:#cce5ff,stroke:#0d6efd,color:#003366
    classDef diagnostic fill:#fff3cd,stroke:#ffc107,color:#664d03

    axiom_ai["axiom-ai router"]:::router

    subgraph skills_d["Skills"]
        coreml["coreml"]:::discipline
        speech["speech"]:::discipline
    end
    axiom_ai --> skills_d

    subgraph skills_r["References"]
        coreml_ref["coreml-ref"]:::reference
    end
    axiom_ai --> skills_r

    subgraph skills_diag["Diagnostics"]
        coreml_diag["coreml-diag"]:::diagnostic
    end
    axiom_ai --> skills_diag
```

## Available Skills

### [CoreML](/skills/machine-learning/coreml)

Deploy custom ML models on-device — model conversion with coremltools, compression (quantization, palettization), stateful models with KV-cache, MLTensor operations, and LLM inference patterns.

### [ML Training Paths](/skills/machine-learning/training-paths)

Pick the right training toolchain before you build — disambiguates Foundation Models adapters, Create ML, `MLUpdateTask` personalization, coremltools conversion, and MLX, and flags the format and toolchain traps that make a trained artifact fail to load.

### [iOS ML (deployment overview)](/skills/machine-learning/ios-ml)

Navigation hub for on-device ML and speech-to-text — routes you to the right skill for model conversion, inference optimization, debugging, or SpeechAnalyzer transcription.

### [Core AI](/skills/machine-learning/core-ai)

Core AI (iOS 27) — the on-device inference framework behind Apple Intelligence, now open to apps. Convert PyTorch models to `.aimodel`, run them from Swift across CPU, GPU, and Neural Engine, and back a `LanguageModelSession` with your own model.

### [Speech](/skills/machine-learning/speech)

Speech-to-text with SpeechAnalyzer (iOS 26+) — live transcription from microphone, file transcription, custom vocabulary, and language detection.

## Available References

- [CoreML API Reference](/reference/coreml-ref) – CoreML API reference, MLTensor, coremltools, state management

## Available Diagnostics

- [CoreML Diagnostics](/diagnostic/coreml-diag) – Model load failures, slow inference, compression accuracy loss

## Example Prompts

- "How do I convert a PyTorch model to CoreML?"
- "My CoreML model is too large, how do I compress it?"
- "How do I implement speech-to-text with SpeechAnalyzer?"
- "Model inference is slow, how do I optimize it?"
