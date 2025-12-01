---
name: prescan-memory
description: Quick prescan for memory leaks - detects timer leaks, observer leaks, closure captures, delegate cycles, view callbacks, and PhotoKit accumulation with file:line references and severity ratings
allowed-tools: Glob(*.swift), Grep(*)
---

# Memory Prescan

I'll scan your Swift codebase for the 6 most common memory leak patterns that cause crashes and progressive memory growth.

## Scanning Project

First, let me find all Swift files:

```bash
find . -name "*.swift" -type f | wc -l
```

Now running comprehensive leak detection across all 6 patterns...

---

## Pattern 1: CRITICAL - Timer Leaks

Checking for `Timer.scheduledTimer` without corresponding `invalidate()`:

**What I'm looking for:**
- Timer.scheduledTimer with `repeats: true`
- No matching `timer?.invalidate()` in same file
- No cleanup in `deinit`

**Why this crashes apps:**
- Timer retains closure, closure captures self
- Even with `[weak self]`, timer keeps running
- Memory grows 10-30MB/minute until crash

```bash
# Find Timer.scheduledTimer usage
grep -rn "Timer\.scheduledTimer" --include="*.swift" .

# Check for invalidate() calls in same files
grep -rn "\.invalidate()" --include="*.swift" .
```

---

## Pattern 2: HIGH - Observer/Notification Leaks

Checking for `addObserver` without `removeObserver`:

**What I'm looking for:**
- NotificationCenter.default.addObserver(self, ...)
- No matching removeObserver(self) in file
- No cleanup in `deinit`

**Why this leaks:**
- NotificationCenter holds strong reference to observer
- Accumulates on each view controller creation
- Multiple instances all listening

```bash
# Find addObserver calls
grep -rn "addObserver\(self," --include="*.swift" .
grep -rn "NotificationCenter\.default\.addObserver" --include="*.swift" .

# Check for removeObserver cleanup
grep -rn "removeObserver\(self" --include="*.swift" .
```

---

## Pattern 3: HIGH - Closure Capture Leaks

Checking for closures in arrays/collections capturing self:

**What I'm looking for:**
- Arrays or dictionaries storing closures
- Closures with `[self]` or strong `self.` captures
- Missing `[weak self]` capture lists

**Why this leaks:**
- Array owns closures, closures capture self strongly
- Self owns array → retain cycle
- Common in callback/delegate patterns

```bash
# Find closure appends with self capture
grep -rn "\.append.*{.*self\." --include="*.swift" .
grep -rn "\.append.*\[self\]" --include="*.swift" .

# Check for weak self (safe pattern)
grep -rn "\[weak self\]" --include="*.swift" .
```

---

## Pattern 4: MEDIUM - Strong Delegate Cycles

Checking for delegate properties without `weak`:

**What I'm looking for:**
- `var delegate: SomeDelegate?` without `weak` keyword
- Protocol delegates that should be weak

**Why this leaks:**
- If delegate owns the object with delegate property → cycle
- Classic two-way strong reference
- Common in custom view/controller communication

```bash
# Find delegate properties
grep -rn "var.*delegate.*:" --include="*.swift" . | grep -v "weak"

# Check which are properly marked weak
grep -rn "weak var.*delegate" --include="*.swift" .
```

---

## Pattern 5: MEDIUM - View/Layout Callback Leaks

Checking for view callbacks with strong self capture:

**What I'm looking for:**
- Layout callbacks assigned with closures
- UIView.animate closures without `[weak self]`
- Custom view callbacks capturing self

**Why this leaks:**
- View owns closure, closure captures view controller
- Less common but hard to debug

```bash
# Find UIView.animate without weak self
grep -rn "UIView\.animate" --include="*.swift" . | grep -v "\[weak"

# Find layout callbacks
grep -rn "layoutIfNeeded.*=" --include="*.swift" .
```

---

## Pattern 6: LOW - PhotoKit Image Request Accumulation

Checking for PHImageManager requests without cancellation:

**What I'm looking for:**
- `imageManager.requestImage(...)` calls
- No stored `PHImageRequestID`
- No `cancelImageRequest()` in prepareForReuse

**Why this leaks:**
- Pending requests accumulate during scrolling
- Each request holds memory for image processing
- Crashes after scrolling through 100+ photos

```bash
# Find PHImageManager usage
grep -rn "requestImage\(" --include="*.swift" .
grep -rn "PHImageManager" --include="*.swift" .

# Check for cancellation
grep -rn "cancelImageRequest" --include="*.swift" .
```

---

## Analysis Results

Based on the grep results above, here's what I found:

### SUMMARY

| Severity | Pattern | Count |
|----------|---------|-------|
| 🔴 CRITICAL | Timer Leaks | ? |
| 🟠 HIGH | Observer Leaks | ? |
| 🟠 HIGH | Closure Captures | ? |
| 🟡 MEDIUM | Delegate Cycles | ? |
| 🟡 MEDIUM | View Callbacks | ? |
| ⚪ LOW | PhotoKit Requests | ? |

**Risk Assessment:** Based on findings above

**Estimated Memory Impact:** Varies by pattern severity

---

## Interpreting Results

### CRITICAL Issues (Fix Immediately)
Timer leaks crash apps fastest. Memory growth: 10-30MB/minute.

**Quick fix:**
```swift
deinit {
    timer?.invalidate()
    timer = nil
}
```

### HIGH Issues (Fix Soon)
Observer and closure leaks accumulate over time. Multiple view controller creations compound the issue.

**Quick fix:**
```swift
// Observers
deinit {
    NotificationCenter.default.removeObserver(self)
}

// Closures
callbacks.append { [weak self] in
    self?.handleCallback()
}
```

### MEDIUM/LOW Issues (Review)
These may be false positives or acceptable patterns. Review each case.

---

## Next Steps

1. **Fix CRITICAL issues first** - Timer leaks cause crashes fastest
2. **Review HIGH issues** - Observer and closure leaks accumulate
3. **Run the memory-debugging skill for detailed fixes:**

   Simply say: *"How do I fix these memory leaks?"*

   The skill provides:
   - Copy-paste fix templates for all 6 patterns
   - Instruments debugging workflows
   - Memory graph debugging techniques
   - Testing strategies to verify fixes

---

## Verification

After applying fixes, verify with:

```bash
# 1. Check for deinit cleanup
grep -A 5 "deinit {" YourFile.swift

# 2. Run in Instruments
# Xcode → Product → Profile → Memory
# Perform actions 10x, check memory stays flat

# 3. Add deinit logging
deinit {
    print("✅ ViewModel deallocated - no leak")
}
```

---

**Remember:** This is a **pre-scan** to identify likely issues. The memory-debugging skill provides comprehensive fix strategies and Instruments workflows for confirmed leaks.
