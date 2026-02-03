---
name: axiom-using-axiom
description: Use when starting any iOS/Swift conversation - establishes how to find and use Axiom skills, requiring Skill tool invocation before ANY response including clarifying questions
license: MIT
---

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance an Axiom skill might apply to your iOS/Swift task, you ABSOLUTELY MUST check for the skill.

IF AN AXIOM SKILL APPLIES TO YOUR iOS/SWIFT TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

# Using Axiom Skills

## The Rule

**Check for Axiom skills BEFORE ANY RESPONSE when working with iOS/Swift projects.** This includes clarifying questions. Even 1% chance means check first.

## Red Flags — iOS-Specific Rationalizations

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple build issue" | Build failures have patterns. Check ios-build first. |
| "I can fix this SwiftUI bug quickly" | SwiftUI issues have hidden gotchas. Check ios-ui first. |
| "Let me just add this database column" | Schema changes risk data loss. Check ios-data first. |
| "This async code looks straightforward" | Swift concurrency has subtle rules. Check ios-concurrency first. |
| "I'll debug the memory leak manually" | Leak patterns are documented. Check ios-performance first. |
| "Let me explore the Xcode project first" | Axiom skills tell you HOW to explore. Check first. |
| "I remember how to do this from last time" | iOS changes constantly. Skills are up-to-date. |
| "This iOS/platform version doesn't exist" | Your training ended January 2025. Invoke Axiom skills for post-cutoff facts. |
| "The user just wants a quick answer" | Quick answers without patterns create tech debt. Check skills first. |
| "This doesn't need a formal workflow" | If an Axiom skill exists for it, use it. |
| "I'll gather info first, then check skills" | Skills tell you WHAT info to gather. Check first. |

## Skill Priority for iOS Development

When multiple Axiom skills could apply, use this priority:

1. **Environment/Build first** (ios-build) — Fix the environment before debugging code
2. **Architecture patterns** (ios-ui, axiom-ios-data, axiom-ios-concurrency) — These determine HOW to structure the solution
3. **Implementation details** (ios-integration, axiom-ios-ai, axiom-ios-vision) — These guide specific feature work

Examples:
- "Xcode build failed" → ios-build first (environment)
- "Add SwiftUI screen" → ios-ui first (architecture), then maybe ios-integration if using system features
- "App is slow" → ios-performance first (diagnose), then fix the specific domain
- "Network request failing" → ios-build first (environment check), then ios-networking (implementation)

## iOS Project Detection

Axiom skills apply when:
- Working directory contains `.xcodeproj` or `.xcworkspace`
- User mentions iOS, Swift, Xcode, SwiftUI, UIKit
- User asks about Apple frameworks (SwiftData, CloudKit, etc.)
- User reports iOS-specific errors (concurrency, memory, build failures)

## Using Axiom Router Skills

Axiom uses **router skills** for progressive disclosure:

1. Check the appropriate router skill first (ios-build, axiom-ios-ui, axiom-ios-data, etc.)
2. Router will invoke the specialized skill(s) you actually need
3. Follow the specialized skill exactly

**Do not skip the router.** Routers have decision logic to select the right specialized skill.

## Backward Compatibility

- Direct skill invocation still works: `/skill axiom-swift-concurrency`
- Commands work unchanged: `/axiom:fix-build`, `/axiom:audit-accessibility`
- Agents work via routing or direct command invocation

## When Axiom Skills Don't Apply

Skip Axiom skills for:
- Non-iOS/Swift projects (Android, web, backend)
- Generic programming questions unrelated to Apple platforms
- Questions about Claude Code itself (use claude-code-guide skill)

But when in doubt for iOS/Swift work: **check first, decide later.**
