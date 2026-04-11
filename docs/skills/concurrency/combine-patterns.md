# Combine Patterns

Combine reactive programming patterns for production iOS codebases — decision-making, pitfall prevention, and async/await bridging.

## When to Use

Use this skill when:
- Deciding between Combine and async/await for a data flow
- Debugging silent pipeline failures or AnyCancellable leaks
- Working with @Published properties or ObservableObject
- Bridging Combine publishers with async/await code
- Using Subjects, operators, or reactive patterns

## Example Prompts

- "Should I use Combine or async/await for this?"
- "My Combine pipeline silently stops producing values"
- "How do I convert a publisher to an async sequence?"
- "AnyCancellable is leaking — where do I store it?"
- "What's the difference between debounce and throttle?"
- "How do I bridge a Combine publisher into async/await code?"
- "My @Published property update isn't reaching the view"

## What This Skill Provides

- **Combine vs async/await decision tree** — When each is the right tool, with specific use cases
- **AnyCancellable lifecycle rules** — Why Set not Array, 4 memory leak patterns with fixes (including assign(to:on:) retain cycle)
- **Essential operators** — One canonical example per group (transform, combine, time, error)
- **@Published traps** — willSet timing, nested ObservableObject, thread safety
- **Bridging patterns** — `.values` for Publisher → AsyncSequence, `Future` for async → Publisher
- **Subject patterns** — PassthroughSubject vs CurrentValueSubject, send-after-completion pitfall
- **Cold vs hot publishers** — share()/multicast() gotchas, when to use each
- **Silent pipeline diagnosis** — Checklist for when pipelines stop producing values

## Related

- [Swift Concurrency](/skills/concurrency/swift-concurrency) — Modern async/await patterns; use for new code on iOS 17+
- **Timer Patterns** (routed via `axiom-concurrency`) — Dedicated Timer/DispatchSourceTimer lifecycle; use for Timer.publish patterns
- **Memory Debugging** (routed via `axiom-ios-performance`) — Instruments-based leak diagnosis when Combine pipelines cause retain cycles
