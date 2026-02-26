# Machine Learning

Skills for deploying and running machine learning models on Apple devices using CoreML and related frameworks.

```mermaid
flowchart LR
    classDef router fill:#6f42c1,stroke:#5a32a3,color:#fff
    classDef discipline fill:#d4edda,stroke:#28a745,color:#1b4332
    classDef reference fill:#cce5ff,stroke:#0d6efd,color:#003366
    classDef diagnostic fill:#fff3cd,stroke:#ffc107,color:#664d03

    axiom_ios_ml["ios-ml router"]:::router

    subgraph skills_d["Skills"]
        coreml["coreml"]:::discipline
        speech["speech"]:::discipline
    end
    axiom_ios_ml --> skills_d

    subgraph skills_r["References"]
        coreml_ref["coreml-ref"]:::reference
    end
    axiom_ios_ml --> skills_r

    subgraph skills_diag["Diagnostics"]
        coreml_diag["coreml-diag"]:::diagnostic
    end
    axiom_ios_ml --> skills_diag
```

## Available Skills

### [CoreML](/skills/machine-learning/coreml)

Deploy custom ML models on-device — model conversion with coremltools, compression (quantization, palettization), stateful models with KV-cache, MLTensor operations, and LLM inference patterns.

### [Speech](/skills/machine-learning/speech)

Speech-to-text with SpeechAnalyzer (iOS 26+) — live transcription from microphone, file transcription, custom vocabulary, and language detection.

## Available References

- [CoreML API Reference](/reference/coreml-ref) — CoreML API reference, MLTensor, coremltools, state management

## Available Diagnostics

- [CoreML Diagnostics](/diagnostic/coreml-diag) — Model load failures, slow inference, compression accuracy loss

## Example Prompts

- "How do I convert a PyTorch model to CoreML?"
- "My CoreML model is too large, how do I compress it?"
- "How do I implement speech-to-text with SpeechAnalyzer?"
- "Model inference is slow, how do I optimize it?"
