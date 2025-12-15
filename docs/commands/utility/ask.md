# /axiom:ask

Ask a question about iOS/Swift development to get routed to the right Axiom skill or agent.

## Command

```bash
/axiom:ask [question]
```

## What It Does
- Analyzes your natural language question
- Matches it to one of 50+ specialized Axiom skills or 16 agents
- Automatically invokes the matching tool for you
- Falls back to `getting-started` skill if no clear match is found
- Answers directly if the question is trivial

## Examples

**Diagnose build issues:**
```bash
/axiom:ask "Why am I getting 'No such module' error?"
# -> Triggers xcode-debugging skill or build-fixer agent
```

**Find performance problems:**
```bash
/axiom:ask "My List scrolling is jerky"
# -> Triggers swiftui-performance skill or analyzer agent
```

**Get migration help:**
```bash
/axiom:ask "How do I move from Realm to SwiftData?"
# -> Triggers realm-to-swiftdata-migration skill
```

## Related
- [Getting Started](../../getting-started.md) - Learn how to discover skills interactively
