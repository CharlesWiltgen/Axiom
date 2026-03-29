---
name: axiom-objc-block-retain-cycles
description: Use when debugging memory leaks from blocks, blocks assigned to self or properties, network callbacks, or crashes from deallocated objects - systematic weak-strong pattern diagnosis with mandatory diagnostic rules
license: MIT
metadata:
  version: "1.0.0"
---

# Objective-C Block Retain Cycles

## Overview

Block retain cycles are the #1 cause of Objective-C memory leaks. When a block captures `self` and is stored on that same object (directly or indirectly through an operation/request), you create a circular reference: self → block → self. **Core principle** 90% of block memory leaks stem from missing or incorrectly applied weak-strong patterns, not genuine Apple framework bugs.

## Red Flags — Suspect Block Retain Cycle

If you see ANY of these, suspect a block retain cycle, not something else:
- Memory grows steadily over time during normal app use
- UIViewController instances not deallocating (verified in Instruments)
- Crash: "Sending message to deallocated instance" from network/async callback
- Network requests or animations prevent view controller from closing
- Weak reference becomes nil unexpectedly in a block
- NSLog, NSAssert, or string formatting hiding self references
- Completion handler fires after the view controller "should be gone"
- ❌ **FORBIDDEN** Rationalizing as "It's probably normal memory usage"
  - Memory leaks are never "normal"
  - Apps should return to baseline memory after user dismisses a screen
  - Do not rationalize this as "good enough" or "monitor it later"

**Critical distinction** Block retain cycles accumulate silently. A single cycle might be 100KB, but after 50 screens viewed, you have 5MB of dead memory. **MANDATORY: Test on real device (oldest supported model) after fixes, not just simulator.**

## Mandatory First Steps

**ALWAYS run these FIRST** (before changing code):

```objc
// 1. Identify the leak with Allocations instrument
// In Xcode: Xcode > Open Developer Tool > Instruments
// Choose Allocations template
// Perform an action (open/close a screen with the suspected block)
// Check if memory doesn't return to baseline
// Record: "Memory baseline: X MB, after action: Y MB, still allocated: Z objects"

// 2. Use Memory Debugger to trace the cycle
// Run app, pause at suspected code location
// Debug > Debug Memory Graph
// Search for the view controller that should be deallocated
// Right-click > Show memory graph
// Look for arrows pointing back to self (the cycle)
// Record: "ViewController retained by: [operation/block/property]"

// 3. Check if block is assigned to self or self's properties
// Search for: setBlock:, completion:, handler:, callback:
// Check: Is the block stored in self.property?
// Check: Is the block passed to something that retains it (network operation)?
// Record: "Block assigned to: [property or operation]"

// 4. Search for self references in the block
// Look for: [self method], self.property, self-> access
// Look for HIDDEN self references:
//   - NSLog(@"Value: %@", self.property)
//   - NSAssert(self.isValid, @"message")
//   - Format strings: @"Name: %@", self.name
// Record: "self references found in block: [list]"

// Example output:
// Memory not returning to baseline ✓
// ViewController retained by: AFHTTPRequestOperation
// Operation retains: successBlock
// Block references self: [self updateUI], NSLog with self.property
// → DIAGNOSIS: Block retain cycle confirmed
```

#### What this tells you
- **Memory stays high** → Leak confirmed, not false alarm
- **ViewController retained by operation** → Block is the culprit
- **Block references self** → Pattern: weak-strong needed
- **Hidden self in NSLog/NSAssert** → Need to check ALL macro calls
- **No self references found** → Maybe not a block cycle, investigate elsewhere

#### MANDATORY INTERPRETATION

Before changing ANY code, you must confirm ONE of these:

1. If memory doesn't return to baseline AND ViewController still allocated → Block retain cycle exists
2. If memory returns to baseline → Not a retain cycle, investigate other causes
3. If cycle exists but you can't find self references → Check for hidden references (macros, indirect property access)
4. If you find the cycle but don't understand the chain → Trace backward through retained objects in Memory Graph

#### If diagnostics are contradictory or unclear
- STOP. Do NOT proceed to patterns yet
- Add more diagnostics: Print the object graph, list retained objects
- Ask: "If memory is low, why is the ViewController still allocated?"
- Run Instruments > Leaks instrument if memory graph is confusing

## Decision Tree

```
Block memory leak suspected?
├─ Memory stays high after dismiss?
│  ├─ YES
│  │  ├─ ViewController still allocated in Memory Graph?
│  │  │  ├─ YES → Proceed to patterns
│  │  │  └─ NO → Not a block cycle, check other leaks
│  │  └─ NO → Not a leak, normal memory usage
│  │
│  └─ Crash: "Sending message to deallocated instance"?
│     ├─ Happens in block/callback?
│     │  ├─ YES → Block captured weakSelf but it became nil
│     │  │  └─ Apply Pattern 4 (Guard condition is wrong or missing)
│     │  └─ NO → Different crash, not block-related
│     └─ Crash is timing-dependent (only on device)?
│        └─ YES → Weak reference timing issue, apply Pattern 2
│
├─ Block assigned to self or self.property?
│  ├─ YES → Apply Pattern 1 (weak-strong mandatory)
│  ├─ Assigned through network operation/timer/animation?
│  │  └─ YES → Apply Pattern 1 (operation retains block indirectly)
│  └─ Block called immediately (inline execution)?
│     ├─ YES → Optional to use weak-strong (no cycle possible)
│     │  └─ But recommend for consistency with other blocks
│     └─ NO → Block stored or passed to async method → Use Pattern 1
│
├─ Multiple nested blocks?
│  └─ YES → Apply Pattern 3 (must guard ALL nested blocks)
│
├─ Block contains NSAssert, NSLog, or string format with self?
│  └─ YES → Apply Pattern 2 (macro hides self reference)
│
└─ Implemented weak-strong pattern but still leaking?
   ├─ Check: Is weakSelf used EVERYWHERE?
   ├─ Check: No direct `self` references mixed in?
   ├─ Check: Nested blocks also guarded?
   └─ Check: No __unsafe_unretained used?
```

## Common Patterns

### Pattern Selection Rules (MANDATORY)

#### Apply ONE pattern at a time, in this order

1. **Always start with Pattern 1** (Weak-Strong Basics)
   - If block assigned to self or self's properties → Pattern 1
   - If block passed to operation/request that retains it → Pattern 1
   - Only proceed to Pattern 2 if pattern still leaks

2. **Then Pattern 2** (Hidden self in Macros)
   - Only if memory still leaks after applying Pattern 1
   - Check for NSAssert, NSLog, string formatting
   - If found, apply Pattern 2

3. **Then Pattern 3** (Nested Blocks)
   - Only if block has nested callbacks
   - Each nested block needs its own guard
   - If found, apply Pattern 3

4. **Then Pattern 4** (Guard Condition Edge Cases)
   - Only if crash happens with weakSelf approach
   - Check guard condition is correct
   - Verify strongSelf used everywhere

#### FORBIDDEN
- ❌ Applying multiple patterns at once
- ❌ Skipping Pattern 1 because "I already know weak-strong"
- ❌ Using __unsafe_unretained as workaround
- ❌ Using strong self "just this once"
- ❌ Rationalizing: "The block is too small for a leak"

---

### Pattern 1: Weak-Strong Pattern (MANDATORY)

**PRINCIPLE** Any block that captures `self` must use weak-strong pattern if block is retained by self (directly or transitively).

#### ❌ WRONG (Creates retain cycle)
```objc
[self.networkManager GET:@"url" success:^(id response) {
    self.data = response;  // self is retained by block
    [self updateUI];       // block is retained by operation
} failure:^(NSError *error) {
    [self handleError:error];  // CYCLE!
}];
```

#### ✅ CORRECT (Breaks the cycle)
```objc
__weak typeof(self) weakSelf = self;
[self.networkManager GET:@"url" success:^(id response) {
    typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
        strongSelf.data = response;
        [strongSelf updateUI];
    }
} failure:^(NSError *error) {
    __weak typeof(self) weakSelf2 = self;
    typeof(self) strongSelf = weakSelf2;
    if (strongSelf) {
        [strongSelf handleError:error];
    }
}];
```

#### Why this works
1. `__weak typeof(self) weakSelf = self;` creates a weak reference outside the block
2. Block captures weakSelf (weak reference), not self (strong reference)
3. When block executes, convert to strongSelf (temporary strong ref)
4. Check if strongSelf is nil (object was deallocated)
5. Use strongSelf for the duration of the block
6. strongSelf released when block exits → No cycle

#### Important details
- Declare weakSelf OUTSIDE the block, not inside
- Use `typeof(self)` for type safety (works in both ARC and non-ARC)
- Guard condition MUST use `if (strongSelf)`, not just declare it
- Never use direct `self` inside the block once weakSelf is declared
- Apply to EVERY block that captures self
- ANY block that captures `self` must use weak-strong pattern
  - This includes: `[self method]`, `self.property`, `self->ivar`
  - Property access (`self.property = value`) captures self just like method calls
- Blocks passed to frameworks:
  - If framework documentation says 'block is called asynchronously' → Use weak-strong pattern (framework retains the block)
  - If framework documentation says 'block is called immediately' → Still safe to use weak-strong (better practice)
  - If unsure about framework behavior → Always use weak-strong (doesn't hurt)

#### Capturing variables (avoiding indirect self references)
```objc
// ✅ SAFE: Capture simple values extracted from self
__weak typeof(self) weakSelf = self;
[self.manager fetch:^(id response) {
    typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
        NSString *name = strongSelf.name;  // Extract value
        dispatch_async(dispatch_get_main_queue(), ^{
            NSLog(@"Name: %@", name);  // Captured the STRING, not self
        });
    }
}];

// ❌ WRONG: Capture properties directly in nested blocks
__weak typeof(self) weakSelf = self;
[self.manager fetch:^(id response) {
    typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSLog(@"Name: %@", strongSelf.name);  // Captures strongSelf again!
        });
    }
}];
```

When nesting blocks, extract simple values first, then pass them to the inner block. This avoids creating an indirect capture of self through property access.

**Time cost** 30 seconds per block

---

### Pattern 2: Hidden self in Macros

**PRINCIPLE** Macros like NSAssert, NSLog, and string formatting can secretly capture self. You must check them.

#### ❌ WRONG (NSAssert captures self)
```objc
[self.button setTapAction:^{
    NSAssert(self.isValidState, @"State must be valid");  // self captured!
    [self doWork];  // Another self reference
}];
// Leak exists even though you think only [self doWork] captures self
```

#### ✅ CORRECT (Check for hidden captures)
```objc
__weak typeof(self) weakSelf = self;
[self.button setTapAction:^{
    typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
        // NSAssert still references self indirectly through strongSelf
        NSAssert(strongSelf.isValidState, @"State must be valid");
        [strongSelf doWork];
    }
}];
```

#### Common hidden self references
- `NSAssert(self.condition, ...)` → Use strongSelf instead
- `NSLog(@"Value: %@", self.property)` → Use strongSelf.property
- `NSError *error = [NSError errorWithDomain:@"MyApp" ...]` → Safe, doesn't capture self
- String formatting: `@"Name: %@", self.name` → Use strongSelf.name
- Inline conditionals: `self.flag ? @"yes" : @"no"` → Use strongSelf.flag

#### How to find them
1. Search block for all instances of `self.`
2. Mark them: `[self method]`, `self.property`, `self->ivar`
3. Check if any are inside macro calls (NSAssert, NSLog, etc.)
4. Replace with strongSelf

**Time cost** 1 minute per block to audit

---

### Pattern 3: Nested Blocks (Each Needs Guard)

**PRINCIPLE** Nested blocks create a chain: outer block captures self, inner block captures outer block variable (which holds strongSelf), creating a new cycle. Each nested block needs its own weak-strong pattern.

#### ❌ WRONG (Guarded outer block only)
```objc
__weak typeof(self) weakSelf = self;
[self.manager fetchData:^(NSArray *result) {
    typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
        // Inner block captures strongSelf!
        [strongSelf.analytics trackEvent:@"Fetched"
                              completion:^{
            strongSelf.cachedData = result;  // Still strong reference!
            [strongSelf updateUI];
        }];
    }
}];
```

#### ✅ CORRECT (Guard every nested block)
```objc
__weak typeof(self) weakSelf = self;
[self.manager fetchData:^(NSArray *result) {
    typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
        // Declare new weak reference for inner block
        __weak typeof(strongSelf) weakSelf2 = strongSelf;

        [strongSelf.analytics trackEvent:@"Fetched"
                              completion:^{
            typeof(strongSelf) strongSelf2 = weakSelf2;
            if (strongSelf2) {
                strongSelf2.cachedData = result;
                [strongSelf2 updateUI];
            }
        }];
    }
}];
```

#### Why this works
- Each nesting level needs its own weakSelf/strongSelf pair
- Outer block: weakSelf → strongSelf
- Inner block: weakSelf2 → strongSelf2
- Each level is independent and safe

#### Important details
- Don't reuse the same weakSelf variable in nested blocks
- Each nesting level gets a new pair (weakSelf2, strongSelf2)
- Guard condition MANDATORY for each level
- Use consistent naming: weakSelf, weakSelf2, weakSelf3 (for readability)

#### Common nested block patterns that need Pattern 3
- Completion handlers in callbacks
- `dispatch_async(queue, ^{ ... })`
- `dispatch_after(time, queue, ^{ ... })`
- `[NSTimer scheduledTimerWithTimeInterval:... block:^{ ... }]`
- `[UIView animateWithDuration:... animations:^{ ... }]`

Each of these is a block that might capture strongSelf, requiring its own weak-strong pattern.

#### Example with dispatch_async
```objc
__weak typeof(self) weakSelf = self;
[self.manager fetchData:^(NSArray *result) {
    typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
        __weak typeof(strongSelf) weakSelf2 = strongSelf;

        dispatch_async(dispatch_get_main_queue(), ^{
            typeof(strongSelf) strongSelf2 = weakSelf2;
            if (strongSelf2) {
                strongSelf2.data = result;
                [strongSelf2 updateUI];
            }
        });
    }
}];
```

**Time cost** 1 minute per nesting level

---

### Pattern 4: Guard Condition Edge Cases

**PRINCIPLE** The guard condition `if (strongSelf)` must be correct. Common mistakes: forgetting the guard, wrong condition, or mixing self and strongSelf.

#### ❌ WRONG (Multiple guard failures)
```objc
__weak typeof(self) weakSelf = self;
[self.button setTapAction:^{
    typeof(self) strongSelf = weakSelf;
    // MISTAKE 1: Forgot guard condition
    self.counter++;  // CRASH! self is deallocated, accessing freed object

    // MISTAKE 2: Guard exists but used wrong variable
    if (weakSelf) {
        [weakSelf doWork];  // weakSelf is weak, might become nil again
    }

    // MISTAKE 3: Mixed self and strongSelf
    if (strongSelf) {
        self.flag = YES;  // Used self instead of strongSelf!
        [strongSelf doWork];
    }
}];
```

#### ✅ CORRECT (Proper guard and consistent usage)
```objc
__weak typeof(self) weakSelf = self;
[self.button setTapAction:^{
    typeof(self) strongSelf = weakSelf;
    if (strongSelf) {
        // CORRECT: Use strongSelf everywhere, never self
        strongSelf.counter++;
        strongSelf.flag = YES;
        [strongSelf doWork];
    }
    // If strongSelf is nil, entire block skips gracefully
}];
```

#### Why this works
1. `if (strongSelf)` checks if object still exists
2. If it does, strongSelf is a strong reference (safe)
3. If it doesn't (object deallocated), block skips
4. Using strongSelf everywhere prevents accidental self references

#### Critical rules (MANDATORY, no exceptions)
- ✅ ALWAYS check `if (strongSelf)` before using it
- ✅ ALWAYS use strongSelf inside the if block, NEVER direct self
- ✅ strongSelf is guaranteed valid for the entire block scope
- ❌ NEVER use `if (!strongSelf) return;` (confuses logic)
- ❌ NEVER skip the guard to "save code"
- ❌ NEVER mix weakSelf and strongSelf access
- ❌ NEVER use strongSelf without guard (GUARANTEED crash)

#### What happens if you get it wrong
- No guard: Crashes with "Sending message to deallocated instance"
- Wrong condition: Object still deallocated, still crashes
- Mixed self/strongSelf: One accidental self defeats entire pattern
- Using strongSelf without guard: GUARANTEED crash when object is deallocated

#### Inside the guard
```objc
if (strongSelf) {
    strongSelf.data1 = value1;
    [strongSelf doWork1];
    [strongSelf doWork2];  // All safe
}
// ❌ WRONG: Using strongSelf after guard ends
strongSelf.data = value2;  // CRASH! Outside guard
```

#### What NOT to do
```objc
// ❌ FORBIDDEN: strongSelf without guard guarantees crash
typeof(self) strongSelf = weakSelf;
strongSelf.data = value;  // CRASH if weakSelf is nil!

// ✅ MANDATORY: Always guard before using strongSelf
if (strongSelf) {
    strongSelf.data = value;  // Safe
}
```

**Time cost** 10 seconds per block to verify guard is correct

---

## Quick Reference Table

| Issue | Check | Fix |
|-------|-------|-----|
| Memory not returning to baseline | Does ViewController still exist in Memory Graph? | Apply Pattern 1 (weak-strong) |
| Crash: "message to deallocated instance" | Is guard condition missing or wrong? | Apply Pattern 4 (correct guard) |
| Applied weak-strong but still leaking | Are ALL self references using strongSelf? | Check for mixed self/strongSelf |
| Block contains NSAssert or NSLog | Do they reference self? | Apply Pattern 2 (use strongSelf in macros) |
| Nested blocks | Is weak-strong applied to EACH level? | Apply Pattern 3 (guard every block) |
| Not sure if block creates cycle | Is block assigned to self or self.property? | If yes, apply Pattern 1 |

---

## When You're Stuck After 30 Minutes

If you've spent >30 minutes and the leak still exists:

#### STOP. You either
1. Skipped a mandatory diagnostic step (most common)
2. Didn't apply weak-strong to ALL blocks (nested blocks missed)
3. Have hidden self reference (NSAssert, NSLog, string format)
4. Applied pattern but mixed in direct `self` references
5. Have a different kind of leak (not block-related)

#### MANDATORY checklist before claiming "skill didn't work"

- [ ] I ran all 4 diagnostic blocks (Allocations, Memory Graph, block search, self reference search)
- [ ] I confirmed memory doesn't return to baseline in Instruments
- [ ] I confirmed ViewController is still allocated (not deallocated)
- [ ] I traced the retention chain (what's holding the ViewController?)
- [ ] I found ALL blocks that capture self (global search: `[self` in the file)
- [ ] I checked for hidden self references (NSAssert, NSLog, string formatting)
- [ ] I applied weak-strong pattern to outer blocks
- [ ] I applied weak-strong pattern to nested blocks (every nesting level)
- [ ] I verified NO direct `self` references remain (only strongSelf)
- [ ] I ran Instruments again and memory returned to baseline
- [ ] I tested on real device, not just simulator
- [ ] I cleared Xcode derived data between runs

#### If ALL boxes are checked and still leaking
- You have a non-block leak (Core Data, timer, delegate, notification)
- Use Instruments > Leaks instrument to identify the actual cycle
- Profile for 2-3 minutes: open screen, close screen, repeat 5 times
- Look at "Leaks" panel—it shows exactly what's not being released
- Time cost: 15-30 minutes to identify the real culprit

#### If you identify it's NOT a block leak
- Do not rationalize: "Maybe blocks are fine, I'll ship anyway"
- Find the actual cycle (could be delegate, timer, property observer, notification)
- Fix the real issue, not a false positive

#### Time cost transparency
- Pattern 1: 30 seconds per block
- Pattern 2: 1 minute per block (audit for hidden self)
- Pattern 3: 1 minute per nesting level
- Nested diagnostics if stuck: 15-30 minutes
- Total for straightforward leak: 5-10 minutes

---

## Common Mistakes

❌ **Forgetting the guard condition**
- `strongSelf.property = value;` without `if (strongSelf)`
- Crash when object is deallocated
- Fix: ALWAYS use `if (strongSelf) { ... }`

❌ **Mixing self and strongSelf in same block**
- `self.flag = YES; [strongSelf doWork];`
- One direct `self` reference defeats the entire pattern
- Fix: ONLY use strongSelf inside the block

❌ **Applying pattern to outer block only**
- Nested block still captures strongSelf strongly
- Still leaks
- Fix: Apply weak-strong to EVERY block

❌ **Using __unsafe_unretained as "workaround"**
- ❌ FORBIDDEN pattern—unsafe and crashes
- Creates crashes when object is deallocated
- Not a solution, worse problem
- Fix: Use weak-strong pattern instead

❌ **Not checking for hidden self references**
- `NSLog(@"Value: %@", self.property)` in a block
- Leak still exists even after applying weak-strong
- Fix: Audit for NSAssert, NSLog, string formatting

❌ **Rationalizing "it's a small leak"**
- Single block leak might be 100KB
- After 50 screens, accumulates to 5MB
- Eventually app crashes from memory pressure
- Fix: Fix every block leak, don't rationalize

❌ **Assuming blocks in system frameworks are safe**
- UIView animations, AFNetworking, dispatch, timers
- ALL can retain blocks that reference self
- Fix: Apply weak-strong pattern regardless of source

❌ **Testing only in simulator**
- Simulator memory pressure is different
- Leak might not appear until real device under load
- Fix: Test on real device, oldest supported model

## Real-World Impact

**Before** Block memory leak debugging 2-3 hours per issue
- Run Allocations, not sure what to look at
- Search everywhere, no clear diagnostic path
- Try random fixes, hope one works
- Ship anyway after sunk cost fallacy
- Customer reports crashes or slowdown

**After** 5-10 minutes with systematic diagnosis
- Run Allocations, confirm memory not returning to baseline
- Memory Graph shows exactly what's retained
- Find all blocks capturing self with global search
- Apply weak-strong pattern (30 seconds per block)
- Test in Instruments, memory returns to baseline
- Done

**Key insight** Block retain cycles are 100% preventable with weak-strong pattern. There are no exceptions, no "special cases" where strong self is acceptable.

---

**Last Updated**: 2025-11-30
**Status**: TDD-tested with pressure scenarios
**Framework**: Objective-C, blocks (closure), ARC
