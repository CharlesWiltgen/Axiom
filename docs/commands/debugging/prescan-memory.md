# /prescan-memory

Quick triage scan for the 6 most common memory leak patterns before they cause crashes.

## Purpose

Performs a **fast heuristic scan** (30-60 seconds) to identify high-confidence memory leak patterns in your Swift code. This is quick triage to point you in the right direction before deep debugging.

**Command Type:** `/prescan-*` (quick triage, 30-60 seconds)

Use before the `memory-debugging` skill to quickly identify which leak patterns to investigate first.

## What It Detects

Fast pattern matching for the 6 most common leak sources:

1. **Timer Leaks** (CRITICAL) - `Timer.scheduledTimer` without `invalidate()`
2. **Observer Leaks** (HIGH) - `addObserver` without `removeObserver`
3. **Closure Captures** (HIGH) - Closures in arrays/collections capturing self
4. **Delegate Cycles** (MEDIUM) - Delegate properties without `weak`
5. **View Callbacks** (MEDIUM) - Layout callbacks with strong self capture
6. **PhotoKit Requests** (LOW) - Image requests without cancellation

**Note:** This is a quick heuristic scan with potential false positives. For comprehensive cross-file analysis and deinit verification, a future `/audit-memory` command will provide deeper analysis.

## When to Use

Run this command when:

- Starting a new feature that involves timers, notifications, or delegates
- Debugging progressive memory growth (50MB → 200MB over time)
- Before profiling with Instruments (narrows investigation scope)
- Reviewing pull requests for memory safety
- App crashes after 10-15 minutes with no error logs

## Usage

```bash
/prescan-memory
```

The command will:
1. Find all Swift files in your project
2. Run pattern detection for each of the 6 leak types
3. Report findings with file:line references
4. Categorize by severity (CRITICAL/HIGH/MEDIUM/LOW)
5. Provide quick fixes and link to memory-debugging skill

## Example Output

```
# Memory Prescan Results

Scanned: 42 Swift files

## CRITICAL - Timer Leaks (3 found)

- **PlayerViewModel.swift:45**
  Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true)
  → No invalidate() found in this file

## HIGH - Observer Leaks (2 found)

- **AudioManager.swift:34**
  addObserver(..., name: AVAudioSession.routeChangeNotification)
  → No removeObserver in deinit

## SUMMARY

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 2     |
| MEDIUM   | 1     |
| LOW      | 0     |
| **TOTAL**| **6** |
```

## Next Steps

After running the scan:

1. **Fix CRITICAL issues first** - Timer leaks cause crashes fastest
2. **Review HIGH issues** - Observer and closure leaks accumulate
3. **For detailed fixes, run the memory-debugging skill:**

   > "How do I fix these memory leaks?"

   The skill provides:
   - Copy-paste fix templates for all 6 patterns
   - Instruments debugging workflows
   - Memory graph debugging techniques
   - Testing strategies to verify fixes

## How It Detects Leaks

The command uses grep patterns to find:

| Pattern | Detection | False Positive Mitigation |
|---------|-----------|---------------------------|
| Timer Leaks | `Timer.scheduledTimer` without `invalidate()` in file | Skips if `deinit.*invalidate` exists |
| Observer Leaks | `addObserver(self,` without `removeObserver` | Skips Combine `.sink.store(in:)` patterns |
| Closure Captures | `.append { self.` or `[self]` | Skips `[weak self]` or `[unowned self]` |
| Delegate Cycles | `var delegate:` without `weak` | Context-aware (skips structs) |
| View Callbacks | Layout callbacks with strong capture | Checks for `[weak self]` usage |
| PhotoKit | `requestImage(` without cancel tracking | Checks for `PHImageRequestID` storage |

## Real-World Impact

**Before scanning:**
- Memory grows: 50MB → 100MB → 200MB → Crash (13 min)
- Developer spends 2+ hours debugging with Instruments
- Hard to isolate which of 50+ view controllers is leaking

**After scanning:**
- Find 3 timer leaks in 30 seconds
- Fix with 5 lines of code each
- Memory stays flat at 50MB indefinitely

## See Also

- **[memory-debugging skill](/skills/debugging/memory-debugging)** - Comprehensive leak diagnosis and fixes
- **[/audit-concurrency](/commands/concurrency/audit-concurrency)** - Scan for Swift Concurrency issues
