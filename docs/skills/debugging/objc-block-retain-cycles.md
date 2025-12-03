---
name: objc-block-retain-cycles
description: Use when debugging memory leaks from blocks, blocks assigned to self or properties, network callbacks, or crashes from deallocated objects — systematic weak-strong pattern diagnosis with mandatory diagnostic rules
---

# Objective-C Block Retain Cycles

Systematic weak-strong pattern diagnosis for Objective-C blocks with mandatory diagnostic rules preventing all block memory leaks.

## Overview

Debug memory leaks from Objective-C blocks capturing self. **Core principle**: Blocks in Objective-C always capture strong references by default. Every block that references self needs explicit weak-strong pattern or will leak.

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "My view controller never deallocates. Instruments shows a retain cycle with a block. How do I fix it?"
→ The skill shows weak-strong pattern and explains block capture rules

#### 2. "I used __weak self in the block but still getting crashes with 'message sent to deallocated instance'. What's wrong?"
→ The skill demonstrates why weak alone isn't enough and shows proper strong-weak-strong pattern

#### 3. "Network callback retains view controller. How do I prevent leak without canceling requests?"
→ The skill covers network completion handler patterns with proper weak self

#### 4. "Block assigned to property never releases. Is there a pattern for this?"
→ The skill shows copy vs strong property semantics and cleanup patterns

## Red Flags — Check Block Capture

If you see ANY of these, suspect block retain cycle not code logic:
- View controller never deallocates (check with deinit log)
- Multiple instances of same class in Instruments
- Crashes with "message sent to deallocated instance" when using weak self
- Block assigned to property or instance variable
- Network callbacks capturing self
- Timer or animation callbacks

## Mandatory First Steps

**ALWAYS run these checks when blocks involved**:

```objective-c
// 1. Add deinit logging to verify deallocation
- (void)dealloc {
    NSLog(@"✓ %@ deallocated", NSStringFromClass([self class]));
}
// If this never prints → retain cycle exists

// 2. Check Instruments Leaks and Allocations
// Profile → Leaks instrument
// Look for persistent instances of your class

// 3. Enable Malloc Stack Logging
// Edit Scheme → Diagnostics → Malloc Stack
// Shows exact allocation point of leaked objects
```

## The 4 Mandatory Block Patterns

### Pattern 1: Block Passed as Parameter (Method Returns Immediately)

```objective-c
// ❌ PROBLEM: Retain cycle if block is stored
- (void)fetchDataWithCompletion:(void (^)(Data *data))completion {
    self.completionBlock = completion;  // LEAK! Block captures self, self stores block
    [self startFetch];
}

// ✅ SOLUTION: Weak-strong pattern
__weak typeof(self) weakSelf = self;
[self fetchDataWithCompletion:^(Data *data) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf processData:data];  // Safe - strongSelf extends lifetime for block
}];
```

**When to use**: Block passed as parameter AND stored by called method.

### Pattern 2: Block Assigned to Property

```objective-c
// ❌ PROBLEM: Block property captures self strongly
@property (nonatomic, copy) void (^updateBlock)(void);

self.updateBlock = ^{
    self.label.text = @"Updated";  // LEAK! self → updateBlock → self
};

// ✅ SOLUTION: Weak-strong + explicit cleanup
__weak typeof(self) weakSelf = self;
self.updateBlock = ^{
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    strongSelf.label.text = @"Updated";
};

// MANDATORY: Clear in dealloc
- (void)dealloc {
    self.updateBlock = nil;  // Break cycle
}
```

**When to use**: Block assigned to instance variable or property.

### Pattern 3: Network Callbacks (Completion Handlers)

```objective-c
// ❌ PROBLEM: Network callback captures self, request manager retains callback
[[NetworkManager shared] fetchDataWithCompletion:^(Data *data, NSError *error) {
    [self updateUI:data];  // LEAK! shared manager holds callback, callback holds self
}];

// ✅ SOLUTION: Weak-strong pattern
__weak typeof(self) weakSelf = self;
[[NetworkManager shared] fetchDataWithCompletion:^(Data *data, NSError *error) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;  // View controller deallocated, skip UI update
    [strongSelf updateUI:data];
}];
```

**When to use**: Network requests, API calls, any callback to shared/singleton services.

### Pattern 4: Timers and Animation Blocks

```objective-c
// ❌ PROBLEM: Timer retains target, block captures self
self.timer = [NSTimer scheduledTimerWithTimeInterval:1.0 repeats:YES block:^(NSTimer *timer) {
    [self updateUI];  // LEAK! timer holds block, block holds self, self holds timer
}];

// ✅ SOLUTION: Weak-strong + invalidate in dealloc
__weak typeof(self) weakSelf = self;
self.timer = [NSTimer scheduledTimerWithTimeInterval:1.0 repeats:YES block:^(NSTimer *timer) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) {
        [timer invalidate];  // Stop timer if object deallocated
        return;
    }
    [strongSelf updateUI];
}];

// MANDATORY: Invalidate in dealloc
- (void)dealloc {
    [self.timer invalidate];
    self.timer = nil;
}
```

**When to use**: Timers, CADisplayLink, repeating animations.

## Decision Tree

```
Block captures self?
├─ Block passed as parameter?
│  ├─ Does method return immediately?
│  │  └─ Safe - no cycle (method doesn't store block)
│  └─ Method stores block?
│     └─ Use Pattern 1: Weak-strong
├─ Block assigned to property?
│  └─ Use Pattern 2: Weak-strong + clear in dealloc
├─ Network/API callback?
│  └─ Use Pattern 3: Weak-strong (safe if request cancelled on dealloc)
└─ Timer or repeating callback?
   └─ Use Pattern 4: Weak-strong + invalidate in dealloc
```

## Why Weak Alone Isn't Enough

```objective-c
// ❌ PROBLEM: Crashes with weak alone
__weak typeof(self) weakSelf = self;
[self fetchDataWithCompletion:^(Data *data) {
    [weakSelf.label setText:data.text];  // CRASH! weakSelf becomes nil mid-execution
}];

// ✅ SOLUTION: Weak-strong pattern
__weak typeof(self) weakSelf = self;
[self fetchDataWithCompletion:^(Data *data) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;  // Exit early if deallocated
    [strongSelf.label setText:data.text];  // Safe - strongSelf is guaranteed valid
}];
```

**Key insight**: `__weak` allows nil during block execution. `__strong` inside block keeps object alive for block's duration.

## Common Error Patterns

| Symptom | Cause | Fix |
|---------|-------|-----|
| View controller never deallocates | Block captures self, self stores block | Pattern 2: Weak-strong + dealloc cleanup |
| Crashes with "message sent to deallocated" | Using `__weak` without `__strong` | Add `__strong` copy at block start |
| Network callback leak | Singleton retains completion block | Pattern 3: Weak-strong |
| Timer leak | Timer retains block, block retains self | Pattern 4: Weak-strong + invalidate |

## Instruments Workflow

```bash
# 1. Profile with Leaks instrument
Product → Profile → Leaks

# 2. Reproduce issue (create and dismiss view controller)
# Watch "Leaks" column for red bars

# 3. Inspect leaked object
# Instrument shows retain cycle graph
# Follow "Block → self → property → Block" cycle

# 4. Fix with weak-strong pattern
# Re-profile to verify leak gone
```

## Mandatory Diagnostic Rules

**Rule 1**: Every block that references self MUST use weak-strong pattern UNLESS method returns immediately and doesn't store block.

**Rule 2**: Every block assigned to property MUST be set to nil in dealloc.

**Rule 3**: Every timer with block callback MUST be invalidated in dealloc.

**Rule 4**: Network callbacks to shared/singleton services MUST use weak-strong pattern.

#### Violating these rules = guaranteed memory leak.

## Common Mistakes

❌ **Using weak without strong** — Crashes when object deallocated mid-block

❌ **Forgetting to clear block properties in dealloc** — Leaves cycle intact

❌ **Not invalidating timers** — Timer keeps firing, retaining self

❌ **Thinking 'copy' property prevents cycles** — It doesn't, use weak-strong

## Real-World Impact

**Before** 2-4 hours with Instruments finding leak
**After** 5-15 minutes applying one of 4 patterns

**Key insight** All Objective-C block memory leaks fit into 4 patterns. Learn them once, fix any leak in minutes.

## Bridging to Swift

When calling Objective-C from Swift, Swift's `[weak self]` pattern is similar but slightly different:

```swift
// Swift version of weak-strong pattern
someObject.fetchData { [weak self] data in
    guard let self = self else { return }
    self.updateUI(data)  // self is strong for scope
}
```

Swift handles the strong-weak dance automatically when you unwrap `self` after `[weak self]`.

## Related Skills

- [memory-debugging](/skills/debugging/memory-debugging) — For general memory leak diagnosis
- [audit-memory](/commands/debugging/audit-memory) — Quick automated scan for leak patterns

## Size

30 KB - Complete Objective-C block retain cycle patterns
