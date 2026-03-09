# Modern Swift Idioms

Corrects Claude's tendency to generate outdated Swift patterns — legacy APIs, pre-Swift 5.5 syntax, and Foundation patterns that have modern replacements.

## When to Use

Use this skill when:
- Reviewing generated Swift code for modern idiom compliance
- You notice Claude using `Date()`, `CGFloat`, `DateFormatter()`, or other legacy patterns
- Asking "is there a more modern way to do this?"
- Code review for Swift 5.5+ / 6.0+ API adoption

## Example Prompts

- "Review my Swift code for outdated patterns"
- "Is there a more modern way to write this?"
- "Why am I using DateFormatter when I could use FormatStyle?"
- "Check if my Foundation usage is current"

## What This Skill Provides

- **Modern API replacements** — 11 common outdated patterns with modern equivalents and Swift version requirements
- **Modern syntax** — Shorthand syntax, static member lookup, expression returns
- **Foundation modernization** — URL APIs, date parsing, name formatting, sort patterns
- **Claude hallucination corrections** — 5 specific patterns Claude generates incorrectly

## Philosophy

Based on Paul Hudson's principle: "Don't repeat what LLMs already know — focus on edge cases, surprises, soft deprecations."

This skill is intentionally small. It only covers patterns where Claude consistently generates the wrong thing. General Swift knowledge doesn't need to be in a skill.

## Related

- [Swift Performance](/skills/concurrency/swift-performance) — Low-level optimization (COW, ARC, generics) — different from idiom correctness
- [Swift Concurrency](/skills/concurrency/swift-concurrency) — async/await, actors, Sendable patterns
- [Modernization Helper](/agents/modernization-helper) — Agent that scans for SwiftUI-specific legacy patterns (ObservableObject → @Observable)
