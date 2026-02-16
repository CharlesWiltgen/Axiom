---
name: getting-started
description: Interactive onboarding that recommends Axiom skills based on your project and current focus
---

# Getting Started

Interactive onboarding skill that asks about your project and recommends the most relevant Axiom skills for your situation.

## When to Use

Use this skill when:
- You just installed Axiom and want to know where to start
- You're unsure which skill applies to your current problem
- You want an overview of what Axiom offers
- You need help finding the right skill for a specific task

## Example Prompts

- "I just installed Axiom. What should I look at first?"
- "Which Axiom skills help with debugging memory leaks?"
- "I'm building a new SwiftUI app -- what skills should I know about?"
- "Show me all available Axiom skills"
- "I need to optimize my app's performance. Where do I start?"

## What This Skill Provides

### Personalized Recommendations

The skill asks 2-3 targeted questions about your project -- your current focus (debugging, performance, new features, code quality), tech stack (SwiftUI, UIKit, mixed), and specific pain points -- then recommends 3-5 skills with example prompts you can try immediately.

### Complete Skill Index

A browsable reference of all Axiom skills organized by category:

- **Debugging and Troubleshooting** -- Build failures, memory leaks, UI issues, performance profiling
- **Concurrency** -- Swift 6 actor isolation, Sendable, data races
- **UI and Design** -- Liquid Glass, SwiftUI layout, navigation, architecture
- **Persistence** -- SwiftData, SQLiteData, GRDB, migrations
- **Networking** -- Network.framework, connection diagnostics
- **Apple Intelligence** -- Foundation Models, on-device AI
- **Integrations** -- App Intents, widgets, StoreKit, AVFoundation
- **Testing** -- UI testing, Recording UI Automation

### Quick Decision Trees

Common starting points based on your situation:

- **"My build is failing"** -- Start with xcode-debugging, then build-debugging for dependency issues
- **"App is slow"** -- Start with performance-profiling, then swiftui-performance or memory-debugging
- **"Memory leak"** -- Start with memory-debugging, add objc-block-retain-cycles for Objective-C
- **"Code quality check"** -- Run audit commands (`/axiom:audit-accessibility`, `/axiom:audit-concurrency`, `/axiom:audit-memory`)

### Audit Commands

Quick-win commands that scan your codebase automatically and report issues without requiring deep knowledge of Axiom.

## Related

- [Skills index](/skills/) -- Full browsable list of all Axiom skills
- [Agents](/agents/) -- Autonomous agents that scan code and report issues
- [Commands](/commands/) -- Explicit commands for common workflows
