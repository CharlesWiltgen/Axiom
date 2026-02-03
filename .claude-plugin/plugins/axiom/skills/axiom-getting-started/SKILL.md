---
name: axiom-getting-started
description: Use when first installing Axiom, unsure which skill to use, want an overview of available skills, or need help finding the right skill for your situation — interactive onboarding that recommends skills based on your project and current focus
license: MIT
metadata:
  version: "1.0.0"
---

# Getting Started with Axiom

Welcome! This skill helps new users discover the most relevant Axiom skills for their situation.

## How This Skill Works

1. Ask the user 2-3 targeted questions about their project
2. Provide personalized skill recommendations (3-5 skills max)
3. Show example prompts they can try immediately
4. Include a complete skill reference for browsing

## Step 1: Ask Questions

Use the AskUserQuestion tool to gather context:

### Question 1: Current Focus

```
Question: "What brings you to Axiom today?"
Header: "Focus"
Options:
- "Debugging an issue" → Prioritize diagnostic skills
- "Optimizing performance" → Prioritize profiling skills
- "Adding new features" → Prioritize reference skills
- "Code review / quality check" → Prioritize audit commands
- "Just exploring" → Show overview
```

### Question 2: Tech Stack

```
Question: "What's your primary tech stack?"
Header: "Stack"
Options:
- "SwiftUI (iOS 16+)" → SwiftUI-focused skills
- "UIKit" → UIKit-focused skills
- "Mixed SwiftUI + UIKit" → Both
- "Starting new project" → Best practices skills
```

### Question 3: Pain Points (Optional, Multi-Select)

Only ask if "Debugging an issue" was selected:

```
Question: "Which areas are you struggling with?"
Header: "Pain Points"
Multi-select: true
Options:
- "Xcode/build issues"
- "Memory leaks"
- "UI/animation problems"
- "Database/persistence"
- "Networking"
- "Concurrency/async"
- "Accessibility"
```

## Step 2: Provide Personalized Recommendations

Based on answers, recommend 3-5 skills using this matrix:

### If "Debugging an issue"

**Always recommend**: axiom:xcode-debugging (universal starting point)

**Then add based on pain points**:
- Xcode/build → xcode-debugging, axiom-build-debugging
- Memory leaks → memory-debugging, axiom-objc-block-retain-cycles
- UI/animation (SwiftUI) → swiftui-debugging, axiom-swiftui-performance
- UI/animation (UIKit) → uikit-animation-debugging, axiom-auto-layout-debugging
- Database → database-migration, axiom-sqlitedata-migration (decision guide)
- Networking → networking, axiom-networking-diag
- Concurrency → swift-concurrency
- Accessibility → accessibility-diag

### If "Optimizing performance"

**SwiftUI stack**:
1. performance-profiling (decision trees for tools)
2. swiftui-performance (SwiftUI Instrument)
3. swiftui-debugging (view update issues)

**UIKit/Mixed**:
1. performance-profiling (Instruments guide)
2. memory-debugging (leak detection)
3. uikit-animation-debugging (CAAnimation issues)

### If "Adding new features"

**Design decisions**:
- hig (quick design decisions, checklists)
- hig-ref (comprehensive HIG reference)

**iOS 26+ features**:
- liquid-glass (material design system)
- foundation-models (on-device AI)
- swiftui-26-ref (complete iOS 26 guide)

**Navigation patterns**:
- swiftui-nav (iOS 18+ Tab/Sidebar, deep linking)
- swiftui-nav-ref (comprehensive API reference)

**Integrations**:
- app-intents-ref (Siri, Shortcuts, Spotlight)
- networking (Network.framework modern patterns)

**Data persistence**:
- Ask: "Which persistence framework?" → swiftdata, axiom-sqlitedata, or grdb
- Migration: axiom-sqlitedata-migration, axiom-realm-migration-ref

### If "Code review / quality check"

**Start with audit commands** (quick wins):
1. `/axiom:audit-accessibility` — WCAG compliance
2. `/axiom:audit-concurrency` — Swift 6 violations
3. `/axiom:audit-memory` — Leak patterns
4. `/axiom:audit-core-data` — Migration safety
5. `/axiom:audit-networking` — Deprecated APIs

**Then suggest**:
- Review skills based on what audits find

### If "Just exploring"

Show the complete skill index (see below) and explain categories.

## Step 3: Output Format

After gathering answers, output:

```markdown
## Your Recommended Skills

Based on your answers, here are the skills most relevant to you right now:

### [Icon] [Category Name]
**axiom:[skill-name]** — [One-line description]
> Try: "[Example prompt they can use immediately]"

[Repeat for 3-5 skills]

### Quick Wins
Run these audit commands to find issues automatically:
- `/axiom:audit-[name]` — [What it finds]

## What's Next

1. **Try the example prompts above** — Copy/paste to see how skills work
2. **Run an audit command** — Get immediate actionable insights
3. **Describe your problem** — I'll suggest the right skill
4. **Browse the complete index below** — Explore all 34 skills

---

[Include the Complete Skill Reference below]
```

## Complete Skill Reference

Include this reference section in every response for browsing:

### Debugging & Troubleshooting

**Environment & Build Issues**
- **xcode-debugging** — BUILD FAILED, simulator hangs, zombie processes, environment-first diagnostics
- **build-debugging** — Dependency conflicts, CocoaPods/SPM failures, Multiple commands produce

**Memory & Performance**
- **memory-debugging** — Memory growth, retain cycles, leak diagnosis with Instruments
- **performance-profiling** — Decision trees for Instruments (Time Profiler, Allocations, Core Data, Energy)
- **objc-block-retain-cycles** — Objective-C block memory leaks, weak-strong pattern

**UI Debugging**
- **swiftui-debugging** — View update issues, struct mutation, binding identity, view recreation
- **swiftui-performance** — SwiftUI Instrument (iOS 26), long view bodies, Cause & Effect Graph
- **uikit-animation-debugging** — CAAnimation completion, spring physics, gesture+animation jank
- **auto-layout-debugging** — Auto Layout conflicts, constraint debugging (not yet in manifest)

### Concurrency & Async
- **swift-concurrency** — Swift 6 strict concurrency, @concurrent, actor isolation, Sendable, data races

### UI & Design (iOS 26+)

**Liquid Glass (Material Design)**
- **liquid-glass** — Implementation, Regular vs Clear variants, design review defense
- **liquid-glass-ref** — Complete app-wide adoption guide (icons, controls, navigation, windows)

**Layout & Navigation**
- **swiftui-layout** — ViewThatFits vs AnyLayout vs onGeometryChange, decision trees, iOS 26 free-form windows
- **swiftui-layout-ref** — Complete layout API reference
- **swiftui-nav** — NavigationStack vs NavigationSplitView, deep links, coordinator patterns, iOS 18+ Tab/Sidebar
- **swiftui-nav-ref** — Comprehensive navigation API reference
- **swiftui-nav-diag** — Navigation not responding, unexpected pops, deep link failures, state loss

### Testing
- **ui-testing** — Recording UI Automation (Xcode 26), condition-based waiting, accessibility-first patterns

### Persistence

**Frameworks**
- **swiftdata** — @Model, @Query, @Relationship, CloudKit, iOS 26 features, Swift 6 concurrency
- **sqlitedata** — Point-Free SQLiteData, @Table, FTS5, CTEs, JSON aggregation, CloudKit sync
- **grdb** — Raw SQL, complex joins, ValueObservation, DatabaseMigrator, performance
- **database-migration** — Safe schema evolution for SQLite/GRDB, additive migrations, prevents data loss

**Migration Guides**
- **sqlitedata-migration** — Decision guide, pattern equivalents, performance benchmarks
- **realm-migration-ref** — Realm → SwiftData migration (Realm Device Sync sunset Sept 2025)

### Networking
- **networking** — Network.framework (iOS 12-26), NetworkConnection (iOS 26), structured concurrency
- **networking-diag** — Connection timeouts, TLS failures, data not arriving, performance issues
- **network-framework-ref** — Complete API reference, TLV framing, Coder protocol, Wi-Fi Aware

### Apple Intelligence (iOS 26+)
- **foundation-models** — On-device AI, LanguageModelSession, @Generable, streaming, tool calling
- **foundation-models-diag** — Context exceeded, guardrails, slow generation, availability issues
- **foundation-models-ref** — Complete API reference, all 26 WWDC examples

### Design & UI Guidelines
- **hig** — Quick design decisions, color/background/typography choices, HIG compliance checklists
- **hig-ref** — Comprehensive Human Interface Guidelines reference with code examples

### Integrations
- **app-intents-ref** — Siri, Apple Intelligence, Shortcuts, Spotlight (iOS 16+)
- **swiftui-26-ref** — iOS 26 SwiftUI features, @Animatable, 3D layout, WebView, AttributedString
- **avfoundation-ref** — Audio APIs, bit-perfect DAC, iOS 26 spatial audio, ASAF/APAC

### Diagnostics (Systematic Troubleshooting)
- **accessibility-diag** — VoiceOver, Dynamic Type, color contrast, WCAG compliance, App Store defense
- **core-data-diag** — Schema migration crashes, thread-confinement, N+1 queries

### Audit Commands (Quick Scans)
- `/axiom:audit-accessibility` — VoiceOver labels, Dynamic Type, contrast, touch targets
- `/axiom:audit-concurrency` — Swift 6 violations, unsafe tasks, missing @MainActor
- `/axiom:audit-memory` — Timer leaks, observer leaks, closure captures, delegate cycles
- `/axiom:audit-core-data` — Migration risks, thread violations, N+1 queries
- `/axiom:audit-networking` — Deprecated APIs (SCNetworkReachability, CFSocket), anti-patterns
- `/axiom:audit-liquid-glass` — Glass adoption opportunities, toolbar improvements, blur migration

## Skill Categories Explained

- **Discipline skills** (no suffix) — Step-by-step workflows with pressure scenarios, TDD-tested
- **Diagnostic skills** (-diag suffix) — Systematic troubleshooting with production crisis defense
- **Reference skills** (-ref suffix) — Comprehensive API guides with WWDC examples

## Quick Decision Trees

**"My build is failing"**
→ Start: axiom:xcode-debugging
→ If dependency issue: axiom:build-debugging

**"App is slow"**
→ Start: axiom:performance-profiling (decision trees)
→ If SwiftUI: axiom:swiftui-performance
→ If memory grows: axiom:memory-debugging

**"Memory leak"**
→ Start: axiom:memory-debugging
→ If Objective-C blocks: axiom:objc-block-retain-cycles

**"SwiftUI view issues"**
→ Start: axiom:swiftui-debugging
→ If performance: axiom:swiftui-performance

**"Navigation problems"**
→ Start: axiom:swiftui-nav-diag (troubleshooting)
→ For patterns: axiom:swiftui-nav

**"Which database?"**
→ Decision guide: axiom:sqlitedata-migration
→ Then: axiom:swiftdata, axiom:sqlitedata, or axiom:grdb

**"iOS 26 design"**
→ Start: axiom:liquid-glass
→ Complete guide: axiom:liquid-glass-ref

**"Code quality check"**
→ Run: `/axiom:audit-accessibility`, `/axiom:audit-concurrency`, `/axiom:audit-memory`
→ Fix issues with relevant skills

## Tips

- **Describe your problem** — Claude will suggest the right skill
- **Run audits first** — Quick wins with automated scans
- **Start with diagnostic skills** — When troubleshooting specific issues
- **Use reference skills** — When implementing new features
- **All skills are searchable** — Just describe what you need

---

**Total**: 50 skills, 12 audit commands, covering the complete iOS development lifecycle from design to deployment
