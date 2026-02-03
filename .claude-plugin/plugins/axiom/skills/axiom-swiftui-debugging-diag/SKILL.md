---
name: axiom-swiftui-debugging-diag
description: Use when SwiftUI view debugging requires systematic investigation - view updates not working after basic troubleshooting, intermittent UI issues, complex state dependencies, or when Self._printChanges() shows unexpected update patterns - systematic diagnostic workflows with Instruments integration
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "Initial release with 5 diagnostic patterns, SwiftUI Instrument workflows, and production crisis protocols"
---

# SwiftUI Debugging Diagnostics

## When to Use This Diagnostic Skill

Use this skill when:
- **Basic troubleshooting failed** — Applied `axiom-swiftui-debugging` skill patterns but issue persists
- **Self._printChanges() shows unexpected patterns** — View updating when it shouldn't, or not updating when it should
- **Intermittent issues** — Works sometimes, fails other times ("heisenbug")
- **Complex dependency chains** — Need to trace data flow through multiple views/models
- **Performance investigation** — Views updating too often or taking too long
- **Preview mysteries** — Crashes or failures that aren't immediately obvious

## FORBIDDEN Actions

Under pressure, you'll be tempted to shortcuts that hide problems instead of diagnosing them. **NEVER do these**:

❌ **Guessing with random @State/@Observable changes**
- "Let me try adding @Observable here and see if it works"
- "Maybe if I change this to @StateObject it'll fix it"

❌ **Adding .id(UUID()) to force updates**
- Creates new view identity every render
- Destroys state preservation
- Masks root cause

❌ **Using ObservableObject when @Observable would work** (iOS 17+)
- Adds unnecessary complexity
- Miss out on automatic dependency tracking

❌ **Ignoring intermittent issues** ("works sometimes")
- "I'll just merge and hope it doesn't happen in production"
- Intermittent = systematic bug, not randomness

❌ **Shipping without understanding**
- "The fix works, I don't know why"
- Production is too expensive for trial-and-error

## Mandatory First Steps

Before diving into diagnostic patterns, establish baseline environment:

```bash
# 1. Verify Instruments setup
xcodebuild -version  # Must be Xcode 26+ for SwiftUI Instrument

# 2. Build in Release mode for profiling
xcodebuild build -scheme YourScheme -configuration Release

# 3. Clear derived data if investigating preview issues
rm -rf ~/Library/Developer/Xcode/DerivedData
```

**Time cost**: 5 minutes
**Why**: Wrong Xcode version or Debug mode produces misleading profiling data

---

## Diagnostic Decision Tree

```
SwiftUI view issue after basic troubleshooting?
│
├─ View not updating?
│  ├─ Basic check: Add Self._printChanges() temporarily
│  │  ├─ Shows "@self changed" → View value changed
│  │  │  └─ Pattern D1: Analyze what caused view recreation
│  │  ├─ Shows specific state property → That state triggered update
│  │  │  └─ Verify: Should that state trigger update?
│  │  └─ Nothing logged → Body not being called at all
│  │     └─ Pattern D3: View Identity Investigation
│  └─ Advanced: Use SwiftUI Instrument
│     └─ Pattern D2: SwiftUI Instrument Investigation
│
├─ View updating too often?
│  ├─ Pattern D1: Self._printChanges() Analysis
│  │  └─ Identify unnecessary state dependencies
│  └─ Pattern D2: SwiftUI Instrument → Cause & Effect Graph
│     └─ Trace data flow, find broad dependencies
│
├─ Intermittent issues (works sometimes)?
│  ├─ Pattern D3: View Identity Investigation
│  │  └─ Check: Does identity change unexpectedly?
│  ├─ Pattern D4: Environment Dependency Check
│  │  └─ Check: Environment values changing frequently?
│  └─ Reproduce in preview 30+ times
│     └─ If can't reproduce: Likely timing/race condition
│
└─ Preview crashes (after basic fixes)?
    ├─ Pattern D5: Preview Diagnostics (Xcode 26)
    │  └─ Check diagnostics button, crash logs
    └─ If still fails: Pattern D2 (profile preview build)
```

---

## Diagnostic Patterns

### Pattern D1: Self._printChanges() Analysis

**Time cost**: 5 minutes

**Symptom**: Need to understand exactly why view body runs

**When to use**:
- View updating more often than expected
- View not updating when it should
- Verifying dependencies after refactoring

**Technique**:

```swift
struct MyView: View {
    @State private var count = 0
    @Environment(AppModel.self) private var model

    var body: some View {
        let _ = Self._printChanges()  // Add temporarily

        VStack {
            Text("Count: \(count)")
            Text("Model value: \(model.value)")
        }
    }
}
```

**Output interpretation**:

```
# Scenario 1: View parameter changed
MyView: @self changed
→ Parent passed new MyView instance
→ Check parent code - what triggered recreation?

# Scenario 2: State property changed
MyView: count changed
→ Local @State triggered update
→ Expected if you modified count

# Scenario 3: Environment property changed
MyView: @self changed  # Environment is part of @self
→ Environment value changed (color scheme, locale, custom value)
→ Pattern D4: Check environment dependencies

# Scenario 4: Nothing logged
→ Body not being called
→ Pattern D3: View identity investigation
```

**Common discoveries**:

1. **"@self changed" when you don't expect**
   - Parent recreating view unnecessarily
   - Check parent's state management

2. **Property shows changed but you didn't change it**
   - Indirect dependency (reading from object that changed)
   - Pattern D2: Use Instruments to trace

3. **Multiple properties changing together**
   - Broad dependency (e.g., reading entire array when only need one item)
   - Fix: Extract specific dependency

**Verification**:
- Remove `Self._printChanges()` call before committing
- Never ship to production with this code

**Cross-reference**: For complex cases, use Pattern D2 (SwiftUI Instrument)

---

### Pattern D2: SwiftUI Instrument Investigation

**Time cost**: 25 minutes

**Symptom**: Complex update patterns that Self._printChanges() can't fully explain

**When to use**:
- Multiple views updating when one should
- Need to trace data flow through app
- Views updating but don't know which data triggered it
- Long view body updates (performance issue)

**Prerequisites**:
- Xcode 26+ installed
- Device updated to iOS 26+ / macOS Tahoe+
- Build in Release mode

**Steps**:

#### 1. Launch Instruments (5 min)
```bash
# Build Release
xcodebuild build -scheme YourScheme -configuration Release

# Launch Instruments
# Press Command-I in Xcode
# Choose "SwiftUI" template
```

#### 2. Record Trace (3 min)
- Click Record button
- Perform the action that triggers unexpected updates
- Stop recording (10-30 seconds of interaction is enough)

#### 3. Analyze Long View Body Updates (5 min)
- Look at **Long View Body Updates lane**
- Any orange/red bars? Those are expensive views
- Click on a long update → Detail pane shows view name
- Right-click → "Set Inspection Range and Zoom"
- Switch to **Time Profiler** track
- Find your view in call stack
- Identify expensive operation (formatter creation, calculation, etc.)

**Fix**: Move expensive operation to model layer, cache result

#### 4. Analyze Unnecessary Updates (7 min)
- Highlight time range of user action (e.g., tapping favorite button)
- Expand hierarchy in detail pane
- **Count updates** — more than expected?
- Hover over view → Click arrow → "Show Cause & Effect Graph"

#### 5. Interpret Cause & Effect Graph (5 min)

**Graph nodes**:
```
[Blue node] = Your code (gesture, state change, view body)
[System node] = SwiftUI/system work
[Arrow labeled "update"] = Caused this update
[Arrow labeled "creation"] = Caused view to appear
```

**Common patterns**:

```
# Pattern A: Single view updates (GOOD)
[Gesture] → [State Change in ViewModelA] → [ViewA body]

# Pattern B: All views update (BAD - broad dependency)
[Gesture] → [Array change] → [All list item views update]
└─ Fix: Use granular view models, one per item

# Pattern C: Cascade through environment (CHECK)
[State Change] → [Environment write] → [Many view bodies check]
└─ If environment value changes frequently → Pattern D4 fix
```

**Click on nodes**:
- **State change node** → See backtrace of where value was set
- **View body node** → See which properties it read (dependencies)

**Verification**:
- Record new trace after fix
- Compare before/after update counts
- Verify red/orange bars reduced or eliminated

**Cross-reference**: `axiom-swiftui-performance` skill for detailed Instruments workflows

---

### Pattern D3: View Identity Investigation

**Time cost**: 15 minutes

**Symptom**: @State values reset unexpectedly, or views don't animate

**When to use**:
- Counter resets to 0 when it shouldn't
- Animations don't work (view pops instead of animates)
- ForEach items jump around
- Text field loses focus

**Root cause**: View identity changed unexpectedly

**Investigation steps**:

#### 1. Check for conditional placement (5 min)

```swift
// ❌ PROBLEM: Identity changes with condition
if showDetails {
    CounterView()  // Gets new identity each time showDetails toggles
}

// ✅ FIX: Use .opacity()
CounterView()
    .opacity(showDetails ? 1 : 0)  // Same identity always
```

**Find**: Search codebase for views inside `if/else` that hold state

#### 2. Check .id() modifiers (5 min)

```swift
// ❌ PROBLEM: .id() changes when data changes
DetailView()
    .id(item.id + "-\(isEditing)")  // ID changes with isEditing

// ✅ FIX: Stable ID
DetailView()
    .id(item.id)  // Stable ID
```

**Find**: Search codebase for `.id(` — check if ID values change

#### 3. Check ForEach identifiers (5 min)

```swift
// ❌ WRONG: Index-based ID
ForEach(Array(items.enumerated()), id: \.offset) { index, item in
    Text(item.name)
}

// ❌ WRONG: Non-unique ID
ForEach(items, id: \.category) { item in  // Multiple items per category
    Text(item.name)
}

// ✅ RIGHT: Unique, stable ID
ForEach(items, id: \.id) { item in
    Text(item.name)
}
```

**Find**: Search for `ForEach` — verify unique, stable IDs

**Fix patterns**:

| Issue | Fix |
|-------|-----|
| View in conditional | Use `.opacity()` instead |
| .id() changes too often | Use stable identifier |
| ForEach jumping | Use unique, stable IDs (UUID or server ID) |
| State resets on navigation | Check NavigationStack path management |

**Verification**:
- Add Self._printChanges() — should NOT see "@self changed" repeatedly
- Animations should now work smoothly
- @State values should persist

---

### Pattern D4: Environment Dependency Check

**Time cost**: 10 minutes

**Symptom**: Many views updating when unrelated data changes

**When to use**:
- Cause & Effect Graph shows "Environment" node triggering many updates
- Slow scrolling or animation performance
- Unexpected cascading updates

**Root cause**: Frequently-changing value in environment OR too many views reading environment

**Investigation steps**:

#### 1. Find environment writes (3 min)

```bash
# Search for environment modifiers in current project
grep -r "\.environment(" --include="*.swift" .
```

**Look for**:
```swift
// ❌ BAD: Frequently changing values
.environment(\.scrollOffset, scrollOffset)  // Updates 60+ times/second
.environment(model)  // If model updates frequently

// ✅ GOOD: Stable values
.environment(\.colorScheme, .dark)
.environment(appModel)  // If appModel changes rarely
```

#### 2. Check what's in environment (3 min)

Using Pattern D2 (Instruments), check Cause & Effect Graph:
- Click on "Environment" node
- See which properties changed
- Count how many views checked for updates

**Questions**:
- Is this value changing every scroll/animation frame?
- Do all these views actually need this value?

#### 3. Apply fix (4 min)

**Fix A: Remove from environment** (if frequently changing):
```swift
// ❌ Before: Environment
.environment(\.scrollOffset, scrollOffset)

// ✅ After: Direct parameter
ChildView(scrollOffset: scrollOffset)
```

**Fix B: Use @Observable model** (if needed by many views):
```swift
// Instead of storing primitive in environment:
@Observable class ScrollViewModel {
    var offset: CGFloat = 0
}

// Views depend on specific properties:
@Environment(ScrollViewModel.self) private var viewModel

var body: some View {
    Text("\(viewModel.offset)")  // Only updates when offset changes
}
```

**Verification**:
- Record new trace in Instruments
- Check Cause & Effect Graph — fewer views should update
- Performance should improve (smoother scrolling/animations)

---

### Pattern D5: Preview Diagnostics (Xcode 26)

**Time cost**: 10 minutes

**Symptom**: Preview won't load or crashes with unclear error

**When to use**:
- Preview fails after basic fixes (swiftui-debugging skill)
- Error message unclear or generic
- Preview worked before, stopped suddenly

**Investigation steps**:

#### 1. Use Preview Diagnostics Button (2 min)

**Location**: Editor menu → Canvas → Diagnostics

**What it shows**:
- Detailed error messages
- Missing dependencies
- State initialization issues
- Preview-specific problems

#### 2. Check crash logs (3 min)

```bash
# Open crash logs directory
open ~/Library/Logs/DiagnosticReports/

# Look for recent .crash files containing "Preview"
ls -lt ~/Library/Logs/DiagnosticReports/ | grep -i preview | head -5
```

**What to look for**:
- Fatal errors (array out of bounds, force unwrap nil)
- Missing module imports
- Framework initialization failures

#### 3. Isolate the problem (5 min)

**Create minimal preview**:
```swift
// Start with empty preview
#Preview {
    Text("Test")
}

// If this works, gradually add:
#Preview {
    MyView()  // Your actual view, but with mock data
        .environment(MockModel())  // Provide all dependencies
}

// Find which dependency causes crash
```

**Common issues**:

| Error | Cause | Fix |
|-------|-------|-----|
| "Cannot find in scope" | Missing dependency | Add to preview (see example below) |
| "Fatal error: Unexpectedly found nil" | Optional unwrap failed | Provide non-nil value in preview |
| "No such module" | Import missing | Add import statement |
| Silent crash (no error) | State init with invalid value | Use safe defaults |

**Fix patterns**:

```swift
// Missing @Environment
#Preview {
    ContentView()
        .environment(AppModel())  // Provide dependency
}

// Missing @EnvironmentObject (pre-iOS 17)
#Preview {
    ContentView()
        .environmentObject(AppModel())
}

// Missing ModelContainer (SwiftData)
#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Item.self, configurations: config)

    return ContentView()
        .modelContainer(container)
}

// State with invalid defaults
@State var selectedIndex = 10  // ❌ Out of bounds
let items = ["a", "b", "c"]

// Fix: Safe default
@State var selectedIndex = 0  // ✅ Valid index
```

**Verification**:
- Preview loads without errors
- Can interact with preview normally
- Changes reflect immediately

---

## Production Crisis Scenario

### The Situation

**Context**:
- iOS 26 build shipped 2 days ago
- Users report "settings screen freezes when toggling features"
- 15% of users affected (reported via App Store reviews)
- VP asking for updates every 2 hours
- 8 hours until next deployment window closes
- Junior engineer suggests: "Let me try switching to @ObservedObject"

### Red Flags — Resist These

If you hear ANY of these under deadline pressure, **STOP and use diagnostic patterns**:

❌ **"Let me try different property wrappers and see what works"**
- Random changes = guessing
- 80% chance of making it worse

❌ **"It works on my device, must be iOS 26 bug"**
- User reports are real
- 15% = systematic issue, not edge case

❌ **"We can roll back if the fix doesn't work"**
- App Store review takes 24 hours
- Rollback isn't instant

❌ **"Add .id(UUID()) to force refresh"**
- Destroys state preservation
- Hides root cause

❌ **"Users will accept degraded performance for now"**
- Once shipped, you're committed for 24 hours
- Bad reviews persist

### Mandatory Protocol (No Shortcuts)

**Total time budget**: 90 minutes

#### Phase 1: Reproduce (15 min)

```bash
# 1. Get exact steps from user report
# 2. Build Release mode
xcodebuild build -scheme YourApp -configuration Release

# 3. Test on device (not simulator)
# 4. Reproduce freeze 3+ times
```

**If can't reproduce**: Ask for video recording or device logs from affected users

#### Phase 2: Diagnose with Pattern D2 (30 min)

```bash
# Launch Instruments with SwiftUI template
# Command-I in Xcode

# Record while reproducing freeze
# Look for:
# - Long View Body Updates (red bars)
# - Cause & Effect Graph showing update cascade
```

**Find**:
- Which view is expensive?
- What data change triggered it?
- How many views updated?

#### Phase 3: Apply Targeted Fix (20 min)

Based on diagnostic findings:

**If Long View Body Update**:
```swift
// Example finding: Formatter creation in body
// Fix: Move to cached formatter
```

**If Cascade Update**:
```swift
// Example finding: All toggle views reading entire settings array
// Fix: Per-toggle view models with granular dependencies
```

**If Environment Issue**:
```swift
// Example finding: Environment value updating every frame
// Fix: Remove from environment, use direct parameter
```

#### Phase 4: Verify (15 min)

```bash
# Record new Instruments trace
# Compare before/after:
# - Long updates eliminated?
# - Update count reduced?
# - Freeze gone?

# Test on device 10+ times
```

#### Phase 5: Deploy with Evidence (10 min)

```
Slack to VP + team:

"Diagnostic complete: Settings screen freeze caused by formatter creation
in ToggleRow body (confirmed via SwiftUI Instrument, Long View Body Updates).

Each toggle tap recreated NumberFormatter + DateFormatter for all visible
toggles (20+ formatters per tap).

Fix: Cached formatters in SettingsViewModel, pre-formatted strings.
Verified: Settings screen now responds in <16ms (was 200ms+).

Deploying build 2.1.1 now. Will monitor for next 24 hours."
```

**This shows**:
- You diagnosed with evidence (not guessed)
- You understand the root cause
- You verified the fix
- You're shipping with confidence

### Time Cost Comparison

#### Option A: Guess and Pray
- Time to try random fixes: 30 min
- Time to deploy: 20 min
- Time to learn it failed: 24 hours (next App Store review)
- Total delay: 24+ hours
- User suffering: Continues through deployment window
- Risk: Made it worse, now TWO bugs

#### Option B: Diagnostic Protocol (This Skill)
- Time to diagnose: 45 min
- Time to apply targeted fix: 20 min
- Time to verify: 15 min
- Time to deploy: 10 min
- Total time: 90 minutes
- User suffering: Stopped after 2 hours
- Confidence: High (evidence-based fix)

**Savings**: 22 hours + avoid making it worse

### When Pressure is Legitimate

Sometimes managers are right to push for speed. Accept the pressure IF:

✅ You've completed diagnostic protocol (90 minutes)
✅ You know exact view/operation causing issue
✅ You have targeted fix, not a guess
✅ You've verified in Instruments before shipping
✅ You're shipping WITH evidence, not hoping

**Document your decision** (same as above Slack template)

### Professional Script for Pushback

If pressured to skip diagnostics:

> "I understand the urgency. Skipping diagnostics means 80% chance of shipping the wrong fix, committing us to 24 more hours of user suffering. The diagnostic protocol takes 90 minutes total and gives us evidence-based confidence. We'll have the fix deployed in under 2 hours, verified, with no risk of making it worse. The math says diagnostics is the fastest path to resolution."

---

## Quick Reference Table

| Symptom | Likely Cause | First Check | Pattern | Fix Time |
|---------|--------------|-------------|---------|----------|
| View doesn't update | Missing observer / Wrong state | Self._printChanges() | D1 | 10 min |
| View updates too often | Broad dependencies | Self._printChanges() → Instruments | D1 → D2 | 30 min |
| State resets | Identity change | .id() modifiers, conditionals | D3 | 15 min |
| Cascade updates | Environment issue | Environment modifiers | D4 | 20 min |
| Preview crashes | Missing deps / Bad init | Diagnostics button | D5 | 10 min |
| Intermittent issues | Identity or timing | Reproduce 30+ times | D3 | 30 min |
| Long updates (performance) | Expensive body operation | Instruments (SwiftUI + Time Profiler) | D2 | 30 min |

---

## Decision Framework

Before shipping ANY fix:

| Question | Answer Yes? | Action |
|----------|-------------|--------|
| Have you used Self._printChanges()? | No | STOP - Pattern D1 (5 min) |
| Have you run SwiftUI Instrument? | No | STOP - Pattern D2 (25 min) |
| Can you explain in one sentence what caused the issue? | No | STOP - you're guessing |
| Have you verified the fix in Instruments? | No | STOP - test before shipping |
| Did you check for simpler explanations? | No | STOP - review diagnostic patterns |

**Answer YES to all five** → Ship with confidence

---

## Common Mistakes

### Mistake 1: "I added @Observable and it fixed it"

**Why it's wrong**: You don't know WHY it fixed it
- Might work now, break later
- Might have hidden another bug

**Right approach**:
- Use Pattern D1 (Self._printChanges()) to see BEFORE state
- Apply @Observable
- Use Pattern D1 again to see AFTER state
- Understand exactly what changed

### Mistake 2: "Instruments is too slow for quick fixes"

**Why it's wrong**: Guessing is slower when you're wrong
- 25 min diagnostic = certain fix
- 5 min guess × 3 failed attempts = 15 min + still broken

**Right approach**:
- Always profile for production issues
- Use Self._printChanges() for simple cases

### Mistake 3: "The fix works, I don't need to verify"

**Why it's wrong**: Manual testing ≠ verification
- Might work for your specific test
- Might fail for edge cases
- Might have introduced performance regression

**Right approach**:
- Always verify in Instruments after fix
- Compare before/after traces
- Test edge cases (empty data, large data, etc.)

---

## Quick Command Reference

### Instruments Commands

```bash
# Launch Instruments with SwiftUI template
# 1. In Xcode: Command-I
# 2. Or from command line:
open -a Instruments

# Build in Release mode (required for accurate profiling)
xcodebuild build -scheme YourScheme -configuration Release

# Clean derived data if needed
rm -rf ~/Library/Developer/Xcode/DerivedData
```

### Self._printChanges() Debug Pattern

```swift
// Add temporarily to view body
var body: some View {
    let _ = Self._printChanges()  // Shows update reason

    // Your view code
}
```

**Remember**: Remove before committing!

### Preview Diagnostics

```bash
# Check preview crash logs
open ~/Library/Logs/DiagnosticReports/

# Filter for recent preview crashes
ls -lt ~/Library/Logs/DiagnosticReports/ | grep -i preview | head -5

# Xcode menu path:
# Editor → Canvas → Diagnostics
```

### Environment Search

```bash
# Find environment modifiers
grep -r "\.environment(" --include="*.swift" .

# Find environment object usage
grep -r "@Environment" --include="*.swift" .

# Find view identity modifiers
grep -r "\.id(" --include="*.swift" .
```

### Instruments Navigation

**In Instruments (after recording)**:
1. Select **SwiftUI** track
2. Expand to see:
   - Update Groups lane
   - Long View Body Updates lane
   - Long Representable Updates lane
3. Click **Long View Body Updates** summary
4. Right-click update → "Set Inspection Range and Zoom"
5. Switch to **Time Profiler** track
6. Find your view in call stack (Command-F)

**Cause & Effect Graph**:
1. Expand hierarchy in detail pane
2. Hover over view name → Click arrow
3. Choose "Show Cause & Effect Graph"
4. Click nodes to see:
   - State change node → Backtrace
   - View body node → Dependencies

---

## Resources

**WWDC**: 2025-306, 2023-10160, 2023-10149, 2021-10022

**Docs**: /xcode/understanding-hitches-in-your-app, /xcode/analyzing-hangs-in-your-app, /swiftui/managing-model-data-in-your-app

**Skills**: axiom-swiftui-debugging, axiom-swiftui-performance, axiom-swiftui-layout, axiom-xcode-debugging
