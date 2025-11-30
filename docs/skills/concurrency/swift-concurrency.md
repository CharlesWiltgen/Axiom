# Swift Concurrency

Swift 6 strict concurrency patterns – async/await, MainActor, Sendable, actor isolation, and data race prevention.

**When to use**: Debugging Swift 6 concurrency errors (actor isolation, data races, Sendable warnings), implementing @MainActor classes, converting delegate callbacks to async-safe patterns

## Key Features

- Quick decision tree for concurrency errors
- Copy-paste templates for common patterns
  - Delegate capture (weak self)
  - Sendable conformance
  - MainActor isolation
  - Background task patterns
- Anti-patterns to avoid
- Code review checklist

**Philosophy**: Swift 6's strict concurrency catches bugs at compile time instead of runtime crashes.

**TDD Tested**: Critical checklist contradiction found and fixed during pressure testing
