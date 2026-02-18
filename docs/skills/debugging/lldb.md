---
name: lldb
description: Use when ANY runtime debugging is needed — setting breakpoints, inspecting variables, evaluating expressions, analyzing threads, or reproducing crashes interactively with LLDB
---

# LLDB Debugging

Interactive debugging with LLDB. The debugger freezes time so you can interrogate your running app — inspect variables, evaluate expressions, navigate threads, and understand exactly why something went wrong.

## When to Use This Skill

Use this skill when you're:
- Hitting a crash you can reproduce locally and need to inspect state at the crash site
- Seeing wrong values at runtime even though the code looks correct
- Needing to understand thread state during a hang or deadlock
- Getting garbage output from `po` and need alternatives for Swift types
- Want to test a fix without rebuilding by evaluating expressions at a breakpoint
- Need to break on all exceptions, specific conditions, or symbolic breakpoints
- Analyzing a crash log and need to set breakpoints to reproduce the failure path

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My app crashes on this line but I can't tell why. How do I inspect the state?"
- "How do I set a conditional breakpoint that only fires for a specific user ID?"
- "`po` shows garbage for my Swift struct. What should I use instead?"
- "How do I evaluate an expression at a breakpoint without rebuilding?"
- "I need to break whenever any exception is thrown. How?"
- "How do I navigate threads and understand which one caused the crash?"
- "What's the difference between `v`, `p`, and `po` in LLDB?"
- "How do I use LLDB to test a fix without recompiling?"

## What This Skill Provides

### 6 Playbooks for Common Debugging Scenarios

1. **Crash Triage** — Read stop reasons, navigate the call stack, inspect crash context
2. **Inspect State** — Choose the right command (`v` vs `p` vs `po`), dig into nested types, handle optionals and collections
3. **When `po` Doesn't Work** — Swift struct workarounds, protocol-typed values, iterative dynamic type resolution
4. **Breakpoint Strategy** — Conditional, symbolic, exception, and one-shot breakpoints
5. **Expression Evaluation** — Test fixes at runtime, modify state, call functions without rebuilding
6. **Thread Analysis** — Navigate threads, read backtraces, identify which thread caused the issue

### Decision Trees

- LLDB vs other tools (when to reach for Instruments, Memory Graph, or crash log analysis instead)
- Variable inspection command selection (`v` → `p` → `po` decision flow)
- Breakpoint type selection based on what you're trying to catch

### Anti-Rationalization

- Prevents "I'll just add print statements" when LLDB would be faster
- Prevents "po is broken" when `v` or `p` would work for Swift types
- Prevents skipping thread analysis during crash triage

## Documentation Scope

This page documents the `axiom-lldb` skill — the debugging workflow and decision tree skill Claude uses when helping you debug at runtime with LLDB. The skill contains complete playbooks, command selection logic, and pressure scenario handling.

**For the complete command reference:** See [LLDB Command Reference](/reference/lldb-ref) for every LLDB command organized by task.

## Related

- [LLDB Command Reference](/reference/lldb-ref) — Complete command reference organized by task (variables, breakpoints, threads, expressions, memory)
- [Xcode Debugging](/skills/debugging/xcode-debugging) — Environment-first diagnostics for build failures and Xcode issues
- [Memory Debugging](/skills/debugging/memory-debugging) — Instruments-based memory leak diagnosis (use when memory grows over time)
- [Performance Profiling](/skills/debugging/performance-profiling) — Instruments workflows for CPU, memory, and energy (use when measuring trends)
- [Hang Diagnostics](/skills/debugging/hang-diagnostics) — Diagnosis approach for frozen apps (may use LLDB for thread inspection)

## Resources

**Docs**: /xcode/debugging, /xcode/stepping-through-code-and-inspecting-variables-to-isolate-bugs

**Skills**: axiom-lldb-ref, axiom-hang-diagnostics, axiom-memory-debugging, axiom-performance-profiling
