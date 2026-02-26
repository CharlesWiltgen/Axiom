# Timer Safety Patterns

Production-safe timer patterns preventing DispatchSourceTimer crashes and RunLoop mode gotchas.

## When to Use

Use this skill when:
- Timer stops firing during scrolling
- EXC_BAD_INSTRUCTION crash in timer code
- Choosing between Timer, DispatchSourceTimer, Combine, or async timer APIs
- Implementing a repeating timer with proper lifecycle management

## Example Prompts

- "My timer stops when the user scrolls the list"
- "I'm getting EXC_BAD_INSTRUCTION in my DispatchSourceTimer code"
- "Should I use Timer or DispatchSourceTimer?"
- "How do I safely cancel a DispatchSourceTimer?"
- "What's the best timer API for a background polling task?"

## What This Skill Provides

- Timer vs DispatchSourceTimer vs Combine vs AsyncTimerSequence decision tree
- The 4 DispatchSourceTimer crash patterns (each causes EXC_BAD_INSTRUCTION) with safe alternatives
- RunLoop mode explanation (why `.default` breaks during scrolling)
- Copy-paste SafeDispatchTimer wrapper class with state machine
- 6 anti-patterns with time costs
- 3 pressure scenarios for deadline resistance

## Related

- [Timer Patterns Reference](/reference/timer-patterns-ref) — API reference for all timer APIs with lifecycle diagrams and platform availability
- [Memory Debugging](/skills/debugging/memory-debugging) — Timer as Pattern 1 memory leak (Timer retains target)
- [Energy Optimization](/skills/debugging/energy) — Timer tolerance and energy-efficient scheduling

## Resources

**WWDC**: 2017-706

**Skills**: axiom-timer-patterns-ref, axiom-memory-debugging, axiom-energy
