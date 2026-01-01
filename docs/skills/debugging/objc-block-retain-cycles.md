---
name: objc-block-retain-cycles
description: Systematic weak-strong pattern diagnosis for Objective-C block memory leaks
---

# Objective-C Block Retain Cycles

Systematic weak-strong pattern diagnosis for Objective-C blocks that capture self. All block memory leaks fit into 4 patterns — learn them once, fix any leak in minutes.

## When to Use

Use this skill when:
- View controller never deallocates (deinit doesn't log)
- Instruments shows retain cycle with a block
- Crashes with "message sent to deallocated instance" after using weak self
- Block assigned to property or instance variable
- Network callbacks capturing self

## Example Prompts

- "My view controller never deallocates — Instruments shows a block retain cycle"
- "I used __weak self but still getting crashes with deallocated instance"
- "Network callback retains view controller — how do I prevent the leak?"
- "Block assigned to property never releases"

## What This Skill Provides

### The 4 Mandatory Patterns

All Objective-C block retain cycles fit into 4 patterns:

1. **Block passed as parameter** — When method stores the block
2. **Block assigned to property** — Requires cleanup in dealloc
3. **Network callbacks** — Shared/singleton services retain callbacks
4. **Timers and animations** — Timer retains block, block retains self

### Weak-Strong Pattern

```objc
// ❌ Causes retain cycle
[self fetchDataWithCompletion:^(Data *data) {
    [self processData:data];
}];

// ✅ Weak-strong pattern
__weak typeof(self) weakSelf = self;
[self fetchDataWithCompletion:^(Data *data) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf processData:data];
}];
```

### Why Weak Alone Isn't Enough

`__weak` allows nil during block execution. `__strong` inside block keeps object alive for block's duration — preventing mid-execution crashes.

### Mandatory Rules

- Every block referencing self MUST use weak-strong (unless method returns immediately)
- Every block property MUST be nil'd in dealloc
- Every timer with block MUST be invalidated in dealloc
- Network callbacks to singletons MUST use weak-strong

## Related

- [memory-debugging](/skills/debugging/memory-debugging) — General memory leak diagnosis with Instruments
- [memory-auditor](/agents/memory-auditor) — Automated scan for leak patterns

## Resources

**Docs**: /objective-c, /automatic-reference-counting
