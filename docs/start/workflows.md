# Example Workflows

## Implementing On-Device AI with Foundation Models

When adding Apple Intelligence features to your app:

1. Use `axiom:foundation-models` skill
2. Check device availability with `SystemLanguageModel.default.availability`
3. Design `@Generable` schema for structured output
4. Implement streaming with `PartiallyGenerated` for better UX
5. Add tools for external data integration (MapKit, Contacts, etc.)
6. Handle errors: context exceeded, guardrail violations, unsupported language

## Implementing Liquid Glass

When adding Liquid Glass to your app:

1. Use `axiom:liquid-glass` skill
2. Review Regular vs Clear variant decision criteria
3. Apply `.glassEffect()` to navigation layer elements
4. Run the Expert Review Checklist (7 sections) to validate implementation
5. Test across light/dark modes and accessibility settings

## Optimizing SwiftUI Performance

When app feels sluggish or animations stutter:

1. Use `axiom:swiftui-performance` skill
2. Profile with Instruments 26 using SwiftUI template
3. Check Long View Body Updates lane for expensive operations
4. Use Cause & Effect Graph to identify unnecessary updates
5. Apply formatter caching or granular dependencies patterns

## Recording UI Tests

When writing UI tests for new features:

1. Use `axiom:ui-testing` skill
2. Record interactions with Recording UI Automation (Xcode 26)
3. Replay across devices, languages, and configurations
4. Review video recordings to debug failures
5. Apply condition-based waiting for reliable tests

## Debugging Xcode Build Failures

When you encounter BUILD FAILED or mysterious Xcode issues:

1. Use `axiom:xcode-debugging` skill
2. Run mandatory environment checks (Derived Data, processes, simulators)
3. Follow the decision tree for your specific error
4. Apply quick fixes before debugging code

## Fixing Swift Concurrency Errors

When you see actor isolation or Sendable errors:

1. Use `axiom:swift-concurrency` skill
2. Match your error to the decision tree
3. Copy the relevant pattern template (delegate capture, weak self, etc.)
4. Run the code review checklist

## Creating Safe Database Migrations

When adding database columns or changing schema:

1. Use `axiom:database-migration` skill
2. Follow safe patterns (additive, idempotent, transactional)
3. Write tests for both fresh install and migration paths
4. Test manually on device before shipping
