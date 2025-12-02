---
name: audit-concurrency
description: Scan Swift code for concurrency issues and violations before running the swift-concurrency skill — detects unsafe tasks, missing @MainActor, Sendable violations, and actor isolation problems with file:line references
allowed-tools: Glob(*.swift), Grep(*)
---

# Swift Concurrency Audit

I'll scan your Swift codebase for common Swift 6 concurrency anti-patterns and violations.

## Scanning Project

First, let me find all Swift files:

```bash
find . -name "*.swift" -type f | head -100
```

Now I'll run a comprehensive audit checking for these concurrency issues:

## Issue Categories & Detection

### 1. Missing @MainActor on UI Classes

Checking for UIViewController, UIView, ObservableObject, SwiftUI View subclasses without @MainActor:

**Pattern**: Classes inheriting from UIViewController, ObservableObject, etc. that lack @MainActor annotation.

### 2. Unsafe Task Self Capture

Checking for Task { self.property } without [weak self]:

**Pattern**: `Task {` followed by direct `self.` usage without weak capture in braces.

### 3. Sendable Violations

Checking for non-Sendable types passed across actor boundaries:

**Pattern**: Non-Sendable types in closures passed to @MainActor or actor contexts.

### 4. Improper Actor Isolation

Checking for unsafe data access from actor contexts:

**Pattern**: Awaiting actor results and using them without proper thread-safety verification.

### 5. Missing Weak Self in Stored Tasks

Checking for stored Task properties without proper memory management:

**Pattern**: `var task: Task<...>? = Task { self.` patterns that could leak memory.

### 6. Thread Confinement Violations

Checking for MainActor property access from background contexts:

**Pattern**: @MainActor property access in detached tasks or background actors.

## Running Audit

Let me search for these patterns in your codebase:

```swift
// Pattern 1: Missing @MainActor on View/Observable
// Detect: class Foo: UIViewController/ObservableObject without @MainActor

// Pattern 2: Unsafe Task self capture
// Detect: Task { self. without [weak self]

// Pattern 3: Sendable violations
// Detect: @Sendable missing or non-Sendable in actor boundary crossing

// Pattern 4: Actor isolation
// Detect: await actor.method() followed by direct usage

// Pattern 5: Weak-strong pattern issues
// Detect: Improper [weak self] guard patterns

// Pattern 6: Thread confinement
// Detect: @MainActor property in Task.detached or background context
```

## Analysis Results

Based on my audit of your codebase, here are the issues I found:

### High Priority Issues (Crashes/Memory Leaks)

1. **Missing @MainActor annotations**
   - These can cause data race crashes if accessed from background threads
   - Fix: Add `@MainActor` decorator to View and Observable classes
   - See: swift-concurrency skill → "When to Use @MainActor"

2. **Unsafe Task self captures**
   - These cause memory leaks and potential crashes
   - Fix: Use `Task { [weak self] in` pattern
   - See: swift-concurrency skill → Pattern 3: Weak Self in Tasks

### Medium Priority Issues (Data Races)

3. **Sendable violations**
   - Non-Sendable types crossing actor boundaries cause warnings, may crash at runtime
   - Fix: Implement `Sendable` conformance or use lightweight representations
   - See: swift-concurrency skill → Pattern 1: Sendable Enum/Struct

4. **Improper actor isolation**
   - Data accessed without thread-safety verification
   - Fix: Use Pattern 4 (Atomic Snapshots) or lightweight representations
   - See: swift-concurrency skill → Pattern 4: Atomic Snapshots

### Low Priority Issues (Warnings)

5. **Thread confinement concerns**
   - Potential issues with main thread access from background
   - Fix: Use lightweight representations before leaving actor context
   - See: swift-concurrency skill → Pattern 8: Core Data Thread-Safe Fetch

## Next Steps

Now that you have a roadmap of concurrency issues, ask about specific patterns.

Simply say: "How do I fix these Swift concurrency issues?" and the skill activates automatically.

The skill provides copy-paste templates for:
- Pattern 1: Sendable types
- Pattern 2: Value capture before task
- Pattern 3: Weak self in tasks
- Pattern 4: Atomic snapshots
- And 8 more data persistence patterns

## Summary

Run this command periodically to catch concurrency regressions early. Most issues detected here can be fixed with ~5 lines of code using patterns from the skill.
