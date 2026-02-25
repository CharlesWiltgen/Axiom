# UI & Design

Build beautiful, performant interfaces with expert guidance on the latest Apple design systems and testing practices.

```mermaid
flowchart LR
    classDef router fill:#6f42c1,stroke:#5a32a3,color:#fff
    classDef discipline fill:#d4edda,stroke:#28a745,color:#1b4332
    classDef reference fill:#cce5ff,stroke:#0d6efd,color:#003366
    classDef diagnostic fill:#fff3cd,stroke:#ffc107,color:#664d03
    classDef agent fill:#f8d7da,stroke:#dc3545,color:#58151c

    axiom_ios_ui["ios-ui router"]:::router

    subgraph skills_d["Skills"]
        swiftui_debugging["swiftui-debugging"]:::discipline
        swiftui_nav["swiftui-nav"]:::discipline
        swiftui_performance["swiftui-performance"]:::discipline
        swiftui_layout["swiftui-layout"]:::discipline
        swiftui_gestures["swiftui-gestures"]:::discipline
        swiftui_architecture["swiftui-architecture"]:::discipline
        app_composition["app-composition"]:::discipline
        liquid_glass["liquid-glass"]:::discipline
        sf_symbols["sf-symbols"]:::discipline
        hig["hig"]:::discipline
        uikit_bridging["uikit-bridging"]:::discipline
        ui_testing["ui-testing"]:::discipline
    end
    axiom_ios_ui --> skills_d

    subgraph skills_r["References"]
        swiftui_containers_ref["swiftui-containers-ref"]:::reference
        swiftui_animation_ref["swiftui-animation-ref"]:::reference
        swiftui_26_ref["swiftui-26-ref"]:::reference
        transferable_ref["transferable-ref"]:::reference
        swiftui_search_ref["swiftui-search-ref"]:::reference
        typography_ref["typography-ref"]:::reference
        textkit_ref["textkit-ref"]:::reference
    end
    axiom_ios_ui --> skills_r

    subgraph agents_sg["Agents"]
        agent_arch["swiftui-architecture-auditor"]:::agent
        agent_perf["swiftui-performance-analyzer"]:::agent
        agent_nav["swiftui-nav-auditor"]:::agent
        agent_lg["liquid-glass-auditor"]:::agent
        agent_tk["textkit-auditor"]:::agent
    end
    axiom_ios_ui --> agents_sg
```

## Skills

- **[Human Interface Guidelines](/skills/ui-design/hig)** – Quick design decisions, compliance checklists, defending design choices
  - *"Should my app have a dark background?"*
  - *"What's the right background color for my list view?"*
  - *"How do I push back on design requests that violate HIG?"*

- **[HIG Reference](/reference/hig-ref)** – Comprehensive HIG coverage with code examples (color, typography, shapes, materials, accessibility, platform-specific)
  - *"What are Apple's semantic colors and when should I use them?"*
  - *"How do I implement Base vs Elevated backgrounds?"*
  - *"What's the concentricity principle for iOS 26 shape geometry?"*

- **[Liquid Glass](/skills/ui-design/liquid-glass)** – Apple's new material design system (iOS 26+) with expert review checklist
  - *"I'm implementing Liquid Glass but the lensing effect looks like regular blur. What am I missing?"*
  - *"How do I ensure text contrast and legibility while using Liquid Glass?"*

- **[SF Symbols](/skills/ui-design/sf-symbols)** – Rendering modes, symbol effects, Draw animations (iOS 26+), custom symbol authoring
  - *"My SF Symbol shows as a flat color but I want it to have depth."*
  - *"How do I use the new SF Symbols 7 Draw animations?"*
  - *"Which symbol effect should I use for a loading indicator?"*
  - **Reference** [SF Symbols Reference](/reference/sf-symbols-ref) for complete API with UIKit equivalents

- **[SwiftUI Performance](/skills/ui-design/swiftui-performance)** – Master the new SwiftUI Instrument in Instruments 26, identify bottlenecks with Cause & Effect Graph
  - *"My animations stutter and scrolling is janky. How do I know if SwiftUI is the bottleneck?"*
  - *"Views are updating way too often even though their data hasn't changed."*

- **[SwiftUI Debugging](/skills/ui-design/swiftui-debugging)** – View updates, preview crashes, layout issues with Self._printChanges() debugging, @Observable patterns (iOS 17+), and view identity understanding
  - *"List item doesn't update even though the data changed."*
  - *"Preview keeps crashing with mysterious dependency errors."*
  - **Advanced** [SwiftUI Debugging Diagnostics](/diagnostic/swiftui-debugging-diag) for Instruments-based investigation

- **[UI Testing](/skills/ui-design/ui-testing)** – Recording UI Automation (Xcode 26) and condition-based waiting for reliable tests
  - *"Tests pass locally but fail in CI with no obvious reason."*
  - *"How do I replace sleep() timeouts with reliable condition-based waiting?"*

- **[SwiftUI Architecture](/skills/ui-design/swiftui-architecture)** – Feature-level patterns (MVVM, TCA, Coordinator), property wrapper decisions, refactoring workflows
  - *"Should I use MVVM, TCA, or Apple's vanilla patterns?"*
  - *"How do I make my SwiftUI code testable?"*

- **[App Composition](/skills/ui-design/app-composition)** – App-level patterns: @main structure, root view switching, scene lifecycle, modularization
  - *"How do I switch between login and main screens without flicker?"*
  - *"Where should auth state live in my app?"*
  - *"When should I split my app into modules?"*
