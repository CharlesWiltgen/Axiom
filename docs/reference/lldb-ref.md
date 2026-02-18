---
name: lldb-ref
description: Complete LLDB command reference — variable inspection, breakpoints, threads, expression evaluation, process control, memory commands, and .lldbinit customization
---

# LLDB Command Reference

Complete command reference for LLDB in Xcode. Organized by task so you can find the exact command you need for variable inspection, breakpoints, thread navigation, expression evaluation, and more.

## When to Use This Reference

Use this reference when:
- Looking up the exact LLDB command syntax for a specific task
- Choosing between `v`, `p`, and `po` for variable inspection
- Setting up breakpoints (conditional, symbolic, exception, regex)
- Navigating threads and reading backtraces
- Evaluating or modifying state at a breakpoint
- Customizing LLDB with `.lldbinit` aliases and scripts
- Inspecting raw memory or pointer values

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What's the syntax for a conditional breakpoint in LLDB?"
- "How do I inspect a Swift optional in LLDB without force-unwrapping?"
- "What flags does `frame variable` support?"
- "How do I set a symbolic breakpoint on a specific method?"
- "How do I read a thread backtrace and navigate frames?"
- "What's the difference between `thread step-over` and `thread step-in`?"
- "How do I dump raw memory at an address in LLDB?"
- "How do I create custom LLDB aliases in .lldbinit?"

## What's Covered

- **Variable inspection** — `v` / `frame variable`, `p` / `expression`, `po`, format specifiers, flags (`-d run`, `-T`, `-R`, `-D N`)
- **Breakpoints** — `breakpoint set` by file/line, name, regex, selector; conditional (`-c`), one-shot (`-o`), exception, symbolic
- **Thread navigation** — `thread backtrace`, `thread list`, `thread select`, `frame select`, `thread info`
- **Expression evaluation** — `expression`, result variables (`$R0`, `$R1`), modifying state, calling functions
- **Process control** — `continue`, `thread step-over` / `step-in` / `step-out`, `process interrupt`
- **Memory commands** — `memory read`, `memory find`, address formatting
- **`.lldbinit` customization** — Command aliases, type summaries, settings, Python scripts

## Key Pattern

### Variable Inspection Decision

```
v (frame variable)  → Reads memory directly. No compilation. Most reliable for Swift values.
p (expression)      → Compiles and executes. Use for computed properties and function calls.
po (print object)   → Calls debugDescription. Use for NSObject subclasses, NSError, collections.
```

```
(lldb) v self.myProperty           # Fast, reliable for stored properties
(lldb) p items.count               # Needed for computed values
(lldb) po error                    # Best for NSError, NSNotification
```

### Conditional Breakpoint

```
(lldb) breakpoint set -f MyFile.swift -l 42 -c 'userId == "abc123"'
```

## Documentation Scope

This page documents the `axiom-lldb-ref` reference skill — the complete LLDB command guide Claude uses when you need specific command syntax or flags.

**For debugging workflows and decision trees:** See [LLDB Debugging](/skills/debugging/lldb) for playbooks that tell you *which* commands to use and *when*.

## Related

- [LLDB Debugging](/skills/debugging/lldb) — Debugging workflows, playbooks, and decision trees for when to use which LLDB commands
- [Xcode Debugging](/skills/debugging/xcode-debugging) — Environment-first diagnostics for Xcode build and runtime issues
- [Memory Debugging](/skills/debugging/memory-debugging) — Instruments-based leak diagnosis (complements LLDB for memory issues)
- [Performance Profiling](/skills/debugging/performance-profiling) — Instruments workflows (LLDB inspects; Instruments measures)

## Resources

**Docs**: /xcode/debugging, /xcode/stepping-through-code-and-inspecting-variables-to-isolate-bugs

**Skills**: axiom-lldb, axiom-memory-debugging, axiom-performance-profiling
