# Computer Vision

Skills for implementing computer vision features on Apple platforms using the Vision framework.

```mermaid
flowchart LR
    classDef router fill:#6f42c1,stroke:#5a32a3,color:#fff
    classDef discipline fill:#d4edda,stroke:#28a745,color:#1b4332
    classDef reference fill:#cce5ff,stroke:#0d6efd,color:#003366
    classDef diagnostic fill:#fff3cd,stroke:#ffc107,color:#664d03

    axiom_ios_vision["ios-vision router"]:::router

    subgraph skills_d["Skills"]
        vision["vision"]:::discipline
    end
    axiom_ios_vision --> skills_d

    subgraph skills_r["References"]
        vision_ref["vision-ref"]:::reference
    end
    axiom_ios_vision --> skills_r

    subgraph skills_diag["Diagnostics"]
        vision_diag["vision-diag"]:::diagnostic
    end
    axiom_ios_vision --> skills_diag
```

## Available Skills

### [Vision](/skills/computer-vision/vision)

Subject segmentation, hand/body pose detection, text recognition (OCR), barcode/QR scanning, document scanning, and person segmentation using the Vision framework.

## Available References

- [Vision API Reference](/reference/vision-ref) — Complete Vision framework API reference with code examples

## Available Diagnostics

- [Vision Diagnostics](/diagnostic/vision-diag) — Subject not detected, text not recognized, barcode issues, performance problems

## Example Prompts

- "How do I detect hand poses in a camera feed?"
- "I need to segment subjects from a photo background"
- "How do I scan barcodes with the Vision framework?"
- "Text recognition isn't working on my images"
