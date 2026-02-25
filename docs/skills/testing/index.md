# Testing

Skills for writing fast, reliable tests on iOS.

```mermaid
flowchart LR
    classDef router fill:#6f42c1,stroke:#5a32a3,color:#fff
    classDef discipline fill:#d4edda,stroke:#28a745,color:#1b4332
    classDef reference fill:#cce5ff,stroke:#0d6efd,color:#003366
    classDef agent fill:#f8d7da,stroke:#dc3545,color:#58151c

    axiom_ios_testing["ios-testing router"]:::router

    subgraph skills_d["Skills"]
        swift_testing["swift-testing"]:::discipline
        ui_testing["ui-testing"]:::discipline
        testing_async["testing-async"]:::discipline
        ui_recording["ui-recording"]:::discipline
    end
    axiom_ios_testing --> skills_d

    subgraph skills_r["References"]
        axe_ref["axe-ref"]:::reference
    end
    axiom_ios_testing --> skills_r

    subgraph agents_sg["Agents"]
        agent_tfa["test-failure-analyzer"]:::agent
        agent_tr["test-runner"]:::agent
        agent_td["test-debugger"]:::agent
        agent_ta["testing-auditor"]:::agent
        agent_st["simulator-tester"]:::agent
    end
    axiom_ios_testing --> agents_sg
```

## Skills

### [Swift Testing](./swift-testing)
Modern Swift Testing framework with `@Test`, `#expect`, parameterized tests, and the ability to run without simulator. Covers async testing, TestClock, migration from XCTest.

### [Testing Async Code](./testing-async)
Patterns for testing async/await with Swift Testing — confirmation for callbacks, @MainActor tests, parallel execution, XCTest migration.

### [UI Testing](/skills/ui-design/ui-testing)
XCUITest patterns for reliable UI tests. Condition-based waiting, Recording UI Automation (WWDC 2025), cross-device testing.

## Quick Comparison

| Need | Skill |
|------|-------|
| Unit tests (logic, models) | [Swift Testing](./swift-testing) |
| Testing async code | [Testing Async](./testing-async) |
| Callback confirmation patterns | [Testing Async](./testing-async) |
| UI tests (tap, swipe, screens) | [UI Testing](/skills/ui-design/ui-testing) |
| Tests without simulator | [Swift Testing](./swift-testing) |
| Flaky UI tests | [UI Testing](/skills/ui-design/ui-testing) |
| Migrating from XCTest | [Swift Testing](./swift-testing) |
