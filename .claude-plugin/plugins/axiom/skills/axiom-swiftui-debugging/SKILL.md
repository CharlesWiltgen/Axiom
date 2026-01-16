---
name: axiom-swiftui-debugging
description: Use when debugging SwiftUI view updates, preview crashes, or layout issues - diagnostic decision trees to identify root causes quickly and avoid misdiagnosis under pressure
user-invocable: true
skill_type: discipline
version: 1.3.0
last_updated: Added Self._printChanges() debugging, @Observable patterns (iOS 17+), @Bindable, view identity section, and cross-references to swiftui-performance
---

# SwiftUI Debugging

## Overview

SwiftUI debugging falls into three categories, each with a different diagnostic approach:

1. **View Not Updating** – You changed something but the view didn't redraw. Decision tree to identify whether it's struct mutation, lost binding identity, accidental view recreation, or missing observer pattern.
2. **Preview Crashes** – Your preview won't compile or crashes immediately. Decision tree to distinguish between missing dependencies, state initialization failures, and Xcode cache corruption.
3. **Layout Issues** – Views appearing in wrong positions, wrong sizes, overlapping unexpectedly. Quick reference patterns for common scenarios.

**Core principle**: Start with observable symptoms, test systematically, eliminate causes one by one. Don't guess.

**Requires**: Xcode 26+, iOS 17+ (iOS 14-16 patterns still valid, see notes)
**Related skills**: `axiom-xcode-debugging` (cache corruption diagnosis), `axiom-swift-concurrency` (observer patterns), `axiom-swiftui-performance` (profiling with Instruments), `axiom-swiftui-layout` (adaptive layout patterns)

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "My list item doesn't update when I tap the favorite button, even though the data changed"
→ The skill walks through the decision tree to identify struct mutation vs lost binding vs missing observer

#### 2. "Preview crashes with 'Cannot find AppModel in scope' but it compiles fine"
→ The skill shows how to provide missing dependencies with `.environment()` or `.environmentObject()`

#### 3. "My counter resets to 0 every time I toggle a boolean, why?"
→ The skill identifies accidental view recreation from conditionals and shows `.opacity()` fix

#### 4. "I'm using @Observable but the view still doesn't update when I change the property"
→ The skill explains when to use @State vs plain properties with @Observable objects

#### 5. "Text field loses focus when I start typing, very frustrating"
→ The skill identifies ForEach identity issues and shows how to use stable IDs

## When to Use SwiftUI Debugging

#### Use this skill when
- ✅ A view isn't updating when you expect it to
- ✅ Preview crashes or won't load
- ✅ Layout looks wrong on specific devices
- ✅ You're tempted to bandaid with @ObservedObject everywhere

#### Use `axiom-xcode-debugging` instead when
- App crashes at runtime (not preview)
- Build fails completely
- You need environment diagnostics

#### Use `axiom-swift-concurrency` instead when
- Questions about async/await or MainActor
- Data race warnings

## Debugging Tools

### Self._printChanges()

SwiftUI provides a debug-only method to understand why a view's body was called.

**Usage in LLDB**:
```swift
// Set breakpoint in view's body
// In LLDB console:
(lldb) expression Self._printChanges()
```

**Temporary in code** (remove before shipping):
```swift
var body: some View {
    let _ = Self._printChanges() // Debug only

    Text("Hello")
}
```

**Output interpretation**:
```
MyView: @self changed
  - Means the view value itself changed (parameters passed to view)

MyView: count changed
  - Means @State property "count" triggered the update

MyView: (no output)
  - Body not being called; view not updating at all
```

**⚠️ Important**:
- Prefixed with underscore → May be removed in future releases
- **NEVER submit to App Store** with _printChanges calls
- Performance impact → Use only during debugging

**When to use**:
- Need to understand exact trigger for view update
- Investigating unexpected updates
- Verifying dependencies after refactoring

**Cross-reference**: For complex update patterns, use SwiftUI Instrument → see `axiom-swiftui-performance` skill

---

## View Not Updating Decision Tree

The most common frustration: you changed @State but the view didn't redraw. The root cause is always one of four things.

### Step 1: Can You Reproduce in a Minimal Preview?

```swift
#Preview {
  YourView()
}
```

**YES** → The problem is in your code. Continue to Step 2.

**NO** → It's likely Xcode state or cache corruption. Skip to Preview Crashes section.

### Step 2: Diagnose the Root Cause

#### Root Cause 1: Struct Mutation

**Symptom**: You modify a @State value directly, but the view doesn't update.

**Why it happens**: SwiftUI doesn't see direct mutations on structs. You need to reassign the entire value.

```swift
// ❌ WRONG: Direct mutation doesn't trigger update
@State var items: [String] = []

func addItem(_ item: String) {
    items.append(item)  // SwiftUI doesn't see this change
}

// ✅ RIGHT: Reassignment triggers update
@State var items: [String] = []

func addItem(_ item: String) {
    var newItems = items
    newItems.append(item)
    self.items = newItems  // Full reassignment
}

// ✅ ALSO RIGHT: Use a binding
@State var items: [String] = []

var itemsBinding: Binding<[String]> {
    Binding(
        get: { items },
        set: { items = $0 }
    )
}
```

**Fix it**: Always reassign the entire struct value, not pieces of it.

---

#### Root Cause 2: Lost Binding Identity

**Symptom**: You pass a binding to a child view, but changes in the child don't update the parent.

**Why it happens**: You're passing `.constant()` or creating a new binding each time, breaking the two-way connection.

```swift
// ❌ WRONG: Constant binding is read-only
@State var isOn = false

ToggleChild(value: .constant(isOn))  // Changes ignored

// ❌ WRONG: New binding created each render
@State var name = ""

TextField("Name", text: Binding(
    get: { name },
    set: { name = $0 }
))  // New binding object each time parent renders

// ✅ RIGHT: Pass the actual binding
@State var isOn = false

ToggleChild(value: $isOn)

// ✅ RIGHT (iOS 17+): Use @Bindable for @Observable objects
@Observable class Book {
    var title = "Sample"
    var isAvailable = true
}

struct EditView: View {
    @Bindable var book: Book  // Enables $book.title syntax

    var body: some View {
        TextField("Title", text: $book.title)
        Toggle("Available", isOn: $book.isAvailable)
    }
}

// ✅ ALSO RIGHT (iOS 17+): @Bindable as local variable
struct ListView: View {
    @State private var books = [Book(), Book()]

    var body: some View {
        List(books) { book in
            @Bindable var book = book  // Inline binding
            TextField("Title", text: $book.title)
        }
    }
}

// ✅ RIGHT (pre-iOS 17): Create binding once, not in body
@State var name = ""
@State var nameBinding: Binding<String>?

var body: some View {
    if nameBinding == nil {
        nameBinding = Binding(
            get: { name },
            set: { name = $0 }
        )
    }
    return TextField("Name", text: nameBinding!)
}
```

**Fix it**: Pass `$state` directly when possible. For @Observable objects (iOS 17+), use `@Bindable`. If creating custom bindings (pre-iOS 17), create them in `init` or cache them, not in `body`.

---

#### Root Cause 3: Accidental View Recreation

**Symptom**: The view updates, but @State values reset to initial state. You see brief flashes of initial values.

**Why it happens**: The view got a new identity (removed from a conditional, moved in a container, or the container itself was recreated), causing SwiftUI to treat it as a new view.

```swift
// ❌ WRONG: View identity changes when condition flips
@State var count = 0

var body: some View {
    VStack {
        if showCounter {
            Counter()  // Gets new identity each time showCounter changes
        }
        Button("Toggle") {
            showCounter.toggle()
        }
    }
}

// Counter gets recreated, @State count resets to 0

// ✅ RIGHT: Preserve identity with opacity or hidden
@State var count = 0

var body: some View {
    VStack {
        Counter()
            .opacity(showCounter ? 1 : 0)
        Button("Toggle") {
            showCounter.toggle()
        }
    }
}

// ✅ ALSO RIGHT: Use id() if you must conditionally show
@State var count = 0

var body: some View {
    VStack {
        if showCounter {
            Counter()
                .id("counter")  // Stable identity
        }
        Button("Toggle") {
            showCounter.toggle()
        }
    }
}
```

**Fix it**: Preserve view identity by using `.opacity()` instead of conditionals, or apply `.id()` with a stable identifier.

---

#### Root Cause 4: Missing Observer Pattern

**Symptom**: An object changed, but views observing it didn't update.

**Why it happens**: SwiftUI doesn't know to watch for changes in the object.

```swift
// ❌ WRONG: Property changes don't trigger update
class Model {
    var count = 0  // Not observable
}

struct ContentView: View {
    let model = Model()  // New instance each render, not observable

    var body: some View {
        Text("\(model.count)")
        Button("Increment") {
            model.count += 1  // View doesn't update
        }
    }
}

// ✅ RIGHT (iOS 17+): Use @Observable with @State
@Observable class Model {
    var count = 0  // No @Published needed
}

struct ContentView: View {
    @State private var model = Model()  // @State, not @StateObject

    var body: some View {
        Text("\(model.count)")
        Button("Increment") {
            model.count += 1  // View updates
        }
    }
}

// ✅ RIGHT (iOS 17+): Injected @Observable objects
struct ContentView: View {
    var model: Model  // Just a plain property

    var body: some View {
        Text("\(model.count)")  // View updates when count changes
    }
}

// ✅ RIGHT (iOS 17+): @Observable with environment
@Observable class AppModel {
    var count = 0
}

@main
struct MyApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(model)  // Add to environment
        }
    }
}

struct ContentView: View {
    @Environment(AppModel.self) private var model  // Read from environment

    var body: some View {
        Text("\(model.count)")
    }
}

// ✅ RIGHT (pre-iOS 17): Use @StateObject/ObservableObject
class Model: ObservableObject {
    @Published var count = 0
}

struct ContentView: View {
    @StateObject var model = Model()  // For owned instances

    var body: some View {
        Text("\(model.count)")
        Button("Increment") {
            model.count += 1  // View updates
        }
    }
}

// ✅ RIGHT (pre-iOS 17): Use @ObservedObject for injected instances
struct ContentView: View {
    @ObservedObject var model: Model  // Passed in from parent

    var body: some View {
        Text("\(model.count)")
    }
}
```

**Fix it (iOS 17+)**: Use `@Observable` macro on your class, then `@State` to store it. Views automatically track dependencies on properties they read.

**Fix it (pre-iOS 17)**: Use `@StateObject` if you own the object, `@ObservedObject` if it's injected, or `@EnvironmentObject` if it's shared across the tree.

**Why @Observable is better** (iOS 17+):
- Automatic dependency tracking (only reads trigger updates)
- No `@Published` wrapper needed
- Works with `@State` instead of `@StateObject`
- Can pass as plain property instead of `@ObservedObject`

**See also**: [Managing model data in your app](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)

---

### Decision Tree Summary

```
View not updating?
├─ Can reproduce in preview?
│  ├─ YES: Problem is in code
│  │  ├─ Modified struct directly? → Struct Mutation
│  │  ├─ Passed binding to child? → Lost Binding Identity
│  │  ├─ View inside conditional? → Accidental Recreation
│  │  └─ Object changed but view didn't? → Missing Observer
│  └─ NO: Likely cache/Xcode state → See Preview Crashes
```

## Preview Crashes Decision Tree

When your preview won't load or crashes immediately, the three root causes are distinct.

### Step 1: What's the Error?

#### Error Type 1: "Cannot find in scope" or "No such module"

**Root cause**: Preview missing a required dependency (@EnvironmentObject, @Environment, imported module).

```swift
// ❌ WRONG: ContentView needs a model, preview doesn't provide it
struct ContentView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Text(model.title)
    }
}

#Preview {
    ContentView()  // Crashes: model not found
}

// ✅ RIGHT: Provide the dependency
#Preview {
    ContentView()
        .environmentObject(AppModel())
}

// ✅ ALSO RIGHT: Check for missing imports
// If using custom types, make sure they're imported in preview file

#Preview {
    MyCustomView()  // Make sure MyCustomView is defined or imported
}
```

**Fix it**: Trace the error, find what's missing, provide it to the preview.

---

#### Error Type 2: Fatal error or Silent crash (no error message)

**Root cause**: State initialization failed at runtime. The view tried to access data that doesn't exist.

```swift
// ❌ WRONG: Index out of bounds at runtime
struct ListView: View {
    @State var selectedIndex = 10
    let items = ["a", "b", "c"]

    var body: some View {
        Text(items[selectedIndex])  // Crashes: index 10 doesn't exist
    }
}

// ❌ WRONG: Optional forced unwrap fails
struct DetailView: View {
    @State var data: Data?

    var body: some View {
        Text(data!.title)  // Crashes if data is nil
    }
}

// ✅ RIGHT: Safe defaults
struct ListView: View {
    @State var selectedIndex = 0  // Valid index
    let items = ["a", "b", "c"]

    var body: some View {
        if selectedIndex < items.count {
            Text(items[selectedIndex])
        }
    }
}

// ✅ RIGHT: Handle optionals
struct DetailView: View {
    @State var data: Data?

    var body: some View {
        if let data = data {
            Text(data.title)
        } else {
            Text("No data")
        }
    }
}
```

**Fix it**: Review your @State initializers. Check array bounds, optional unwraps, and default values.

---

#### Error Type 3: Works fine locally but preview won't load

**Root cause**: Xcode cache corruption. The preview process has stale information about your code.

**Diagnostic checklist**:
- Preview worked yesterday, code hasn't changed → Likely cache
- Restarting Xcode fixes it temporarily but returns → Definitely cache
- Same code builds in simulator fine but preview fails → Cache
- Multiple unrelated previews fail at once → Cache

**Fix it** (in order):
1. Restart Preview Canvas: `Cmd+Option+P`
2. Restart Xcode completely (File → Close Window, then reopen project)
3. Nuke derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
4. Rebuild: `Cmd+B`

If still broken after all four steps: It's not cache, see Error Types 1 or 2.

---

### Decision Tree Summary

```
Preview crashes?
├─ Error message visible?
│  ├─ "Cannot find in scope" → Missing Dependency
│  ├─ "Fatal error" or silent crash → State Init Failure
│  └─ No error → Likely Cache Corruption
└─ Try: Restart Preview → Restart Xcode → Nuke DerivedData
```

## Layout Issues Quick Reference

Layout problems are usually visually obvious. Match your symptom to the pattern.

### Pattern 1: Views Overlapping in ZStack

**Symptom**: Views stacked on top of each other, some invisible.

**Root cause**: Z-order is wrong or you're not controlling visibility.

```swift
// ❌ WRONG: Can't see the blue view
ZStack {
    Rectangle().fill(.blue)
    Rectangle().fill(.red)
}

// ✅ RIGHT: Use zIndex to control layer order
ZStack {
    Rectangle().fill(.blue).zIndex(0)
    Rectangle().fill(.red).zIndex(1)
}

// ✅ ALSO RIGHT: Hide instead of removing from hierarchy
ZStack {
    Rectangle().fill(.blue)
    Rectangle().fill(.red).opacity(0.5)
}
```

---

### Pattern 2: GeometryReader Sizing Weirdness

**Symptom**: View is tiny or taking up the entire screen unexpectedly.

**Root cause**: GeometryReader sizes itself to available space; parent doesn't constrain it.

```swift
// ❌ WRONG: GeometryReader expands to fill all available space
VStack {
    GeometryReader { geo in
        Text("Size: \(geo.size)")
    }
    Button("Next") { }
}
// Text takes entire remaining space

// ✅ RIGHT: Constrain the geometry reader
VStack {
    GeometryReader { geo in
        Text("Size: \(geo.size)")
    }
    .frame(height: 100)

    Button("Next") { }
}
```

---

### Pattern 3: SafeArea Complications

**Symptom**: Content hidden behind notch, or not using full screen space.

**Root cause**: `.ignoresSafeArea()` applied to wrong view.

```swift
// ❌ WRONG: Only the background ignores safe area
ZStack {
    Color.blue.ignoresSafeArea()
    VStack {
        Text("Still respects safe area")
    }
}

// ✅ RIGHT: Container ignores, children position themselves
ZStack {
    Color.blue
    VStack {
        Text("Can now use full space")
    }
}
.ignoresSafeArea()

// ✅ ALSO RIGHT: Be selective about which edges
ZStack {
    Color.blue
    VStack { ... }
}
.ignoresSafeArea(edges: .horizontal)  // Only horizontal
```

---

### Pattern 4: frame() vs fixedSize() Confusion

**Symptom**: Text truncated, buttons larger than text, sizing behavior unpredictable.

**Root cause**: Mixing `frame()` (constrains) with `fixedSize()` (expands to content).

```swift
// ❌ WRONG: fixedSize() overrides frame()
Text("Long text here")
    .frame(width: 100)
    .fixedSize()  // Overrides the frame constraint

// ✅ RIGHT: Use frame() to constrain
Text("Long text here")
    .frame(width: 100, alignment: .leading)
    .lineLimit(1)

// ✅ RIGHT: Use fixedSize() only for natural sizing
VStack(spacing: 0) {
    Text("Small")
        .fixedSize()  // Sizes to text
    Text("Large")
        .fixedSize()
}
```

---

### Pattern 5: Modifier Order Matters

**Symptom**: Padding, corners, or shadows appearing in wrong place.

**Root cause**: Applying modifiers in wrong order. SwiftUI applies bottom-to-top.

```swift
// ❌ WRONG: Corners applied after padding
Text("Hello")
    .padding()
    .cornerRadius(8)  // Corners are too large

// ✅ RIGHT: Corners first, then padding
Text("Hello")
    .cornerRadius(8)
    .padding()

// ❌ WRONG: Shadow after frame
Text("Hello")
    .frame(width: 100)
    .shadow(radius: 4)  // Shadow only on frame bounds

// ✅ RIGHT: Shadow includes all content
Text("Hello")
    .shadow(radius: 4)
    .frame(width: 100)
```

## View Identity

### Understanding View Identity

SwiftUI uses view identity to track views over time, preserve state, and animate transitions. Understanding identity is critical for debugging state preservation and animation issues.

### Two Types of Identity

#### 1. Structural Identity (Implicit)
Position in view hierarchy determines identity:

```swift
VStack {
    Text("First")   // Identity: VStack.child[0]
    Text("Second")  // Identity: VStack.child[1]
}
```

**When structural identity changes**:
```swift
if showDetails {
    DetailView()  // Identity changes when condition changes
    SummaryView()
} else {
    SummaryView()  // Same type, different position = different identity
}
```

**Problem**: `SummaryView` gets recreated each time, losing @State values.

#### 2. Explicit Identity
You control identity with `.id()` modifier:

```swift
DetailView()
    .id(item.id)  // Explicit identity tied to item

// When item.id changes → SwiftUI treats as different view
// → @State resets
// → Animates transition
```

### Common Identity Issues

#### Issue 1: State Resets Unexpectedly
**Symptom**: @State values reset to initial values when you don't expect.

**Cause**: View identity changed (position in hierarchy or .id() value changed).

```swift
// ❌ PROBLEM: Identity changes when showDetails toggles
@State private var count = 0

var body: some View {
    VStack {
        if showDetails {
            CounterView(count: $count)  // Position changes
        }
        Button("Toggle") {
            showDetails.toggle()
        }
    }
}

// ✅ FIX: Stable identity with .opacity()
var body: some View {
    VStack {
        CounterView(count: $count)
            .opacity(showDetails ? 1 : 0)  // Same identity always
        Button("Toggle") {
            showDetails.toggle()
        }
    }
}

// ✅ ALSO FIX: Explicit stable ID
var body: some View {
    VStack {
        if showDetails {
            CounterView(count: $count)
                .id("counter")  // Stable ID
        }
        Button("Toggle") {
            showDetails.toggle()
        }
    }
}
```

#### Issue 2: Animations Don't Work
**Symptom**: View changes but doesn't animate.

**Cause**: Identity changed, SwiftUI treats as remove + add instead of update.

```swift
// ❌ PROBLEM: Identity changes with selection
ForEach(items) { item in
    ItemView(item: item)
        .id(item.id + "-\(selectedID)")  // ID changes when selection changes
}

// ✅ FIX: Stable identity
ForEach(items) { item in
    ItemView(item: item, isSelected: item.id == selectedID)
        .id(item.id)  // Stable ID
}
```

#### Issue 3: ForEach with Changing Data
**Symptom**: List items jump around or animate incorrectly.

**Cause**: Non-unique or changing identifiers.

```swift
// ❌ WRONG: Index-based ID changes when array changes
ForEach(Array(items.enumerated()), id: \.offset) { index, item in
    Text(item.name)
}

// ❌ WRONG: Non-unique IDs
ForEach(items, id: \.category) { item in  // Multiple items per category
    Text(item.name)
}

// ✅ RIGHT: Stable, unique IDs
ForEach(items, id: \.id) { item in
    Text(item.name)
}

// ✅ RIGHT: Make type Identifiable
struct Item: Identifiable {
    let id = UUID()
    var name: String
}

ForEach(items) { item in  // id: \.id implicit
    Text(item.name)
}
```

### When to Use .id()

**Use .id() to**:
- Force view recreation when data changes fundamentally
- Animate transitions between distinct states
- Reset @State when external dependency changes

**Example: Force recreation on data change**:
```swift
DetailView(item: item)
    .id(item.id)  // New item → new view → @State resets
```

**Don't use .id() when**:
- You just need to update view content (use bindings instead)
- Trying to fix update issues (investigate root cause instead)
- Identity is already stable

### Debugging Identity Issues

#### 1. Self._printChanges()
```swift
var body: some View {
    let _ = Self._printChanges()
    // Check if "@self changed" appears when you don't expect
}
```

#### 2. Check .id() modifiers
Search codebase for `.id()` - are IDs changing unexpectedly?

#### 3. Check conditionals
Views in `if/else` change position → different identity.

**Fix**: Use `.opacity()` or stable `.id()` instead.

### Identity Quick Reference

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| State resets | Identity change | Use `.opacity()` instead of `if` |
| No animation | Identity change | Remove `.id()` or use stable ID |
| ForEach jumps | Non-unique ID | Use unique, stable IDs |
| Unexpected recreation | Conditional position | Add explicit `.id()` |

**See also**: [WWDC21: Demystify SwiftUI](https://developer.apple.com/videos/play/wwdc2021/10022/)

---

## Pressure Scenarios and Real-World Constraints

When you're under deadline pressure, you'll be tempted to shortcuts that hide problems instead of fixing them.

### Scenario 1: "Preview keeps crashing, we ship tomorrow"

#### Red flags you might hear
- "Just rebuild everything"
- "Delete derived data and don't worry about it"
- "Ship without validating in preview"
- "It works on my machine, good enough"

**The danger**: You skip diagnosis, cache issue recurs after 2 weeks in production, you're debugging while users hit crashes.

**What to do instead** (5-minute protocol, total):
1. Restart Preview Canvas: `Cmd+Option+P` (30 seconds)
2. Restart Xcode (2 minutes)
3. Nuke derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData` (30 seconds)
4. Rebuild: `Cmd+B` (2 minutes)
5. Still broken? Use the dependency or initialization decision trees above

**Time cost**: 5 minutes diagnosis + 2 minutes fix = **7 minutes total**

**Cost of skipping**: 30 min shipping + 24 hours debug cycle = **24+ hours total**

---

### Scenario 2: "View won't update, let me just wrap it in @ObservedObject"

#### Red flags you might think
- "Adding @ObservedObject everywhere will fix it"
- "Use ObservableObject as a band-aid"
- "Add @Published to random properties"
- "It's probably a binding issue, I'll just create a custom binding"

**The danger**: You're treating symptoms, not diagnosing. Same view won't update in other contexts. You've just hidden the bug.

**What to do instead** (2-minute diagnosis):
1. Can you reproduce in a minimal preview? If NO → cache corruption (see Scenario 1)
2. If YES: Test each root cause in order:
   - Does the view have @State that you're modifying directly? → Struct Mutation
   - Did the view move into a conditional recently? → View Recreation
   - Are you passing bindings to children that have changed? → Lost Binding Identity
   - Only if none of above: Missing Observer
3. Fix the actual root cause, not with @ObservedObject band-aid

**Decision principle**: If you can't name the specific root cause, you haven't diagnosed yet. Don't code until you can answer "the problem is struct mutation because...".

---

### Scenario 2b: "Intermittent updates - it works sometimes, not always"

#### Red flags you might think
- "It must be a threading issue, let me add @MainActor everywhere"
- "Let me try @ObservedObject, @State, and custom Binding until something works"
- "Delete DerivedData and hope cache corruption fixes it"
- "This is unfixable, let me ship without this feature"

**The danger**: You're exhausted after 2 hours of guessing. You're 17 hours from App Store submission. You're panicking. Every minute feels urgent, so you stop diagnosing and start flailing.

Intermittent bugs are the MOST important to diagnose correctly. One wrong guess now creates a new bug. You ship with a broken view AND a new bug. App Store rejects you. You miss launch.

**What to do instead** (60-minute systematic diagnosis):

**Step 1: Reproduce in preview** (15 min)
- Create minimal preview of just the broken view
- Tap/interact 20 times
- Does it fail intermittently, consistently, or never?
  - **Fails in preview**: Real bug in your code, use decision tree above
  - **Works in preview but fails in app**: Cache or environment issue, use Preview Crashes decision tree
  - **Can't reproduce at all**: Intermittent race condition, investigate further

**Step 2: Isolate the variable** (15 min)
- If it's intermittent in preview: Likely view recreation
  - Did the view recently move into a conditional? Remove it and test
  - Did you add `if` logic that might recreate the parent? Remove it and test
- If it works in preview but fails in app: Likely environment/cache issue
  - Try on different device/simulator
  - Try after clearing DerivedData

**Step 3: Apply the specific fix** (30 min)
- Once you've identified view recreation: Use `.opacity()` instead of conditionals
- Once you've identified struct mutation: Use full reassignment
- Once you've verified it's cache: Nuke DerivedData properly

**Step 4: Verify 100% reliability** (until submission)
- Run the same interaction 30+ times
- Test on multiple devices/simulators
- Get QA to verify
- Only ship when it's 100% reproducible (not the bug, the FIX)

**Time cost**: 60 minutes diagnosis + 30 minutes fix + confidence = **submit at 9am**

**Cost of guessing**: 2 hours already + 3 more hours guessing + new bug introduced + crash reports post-launch + emergency patch + reputation damage = **miss launch + post-launch chaos**

**The decision principle**: Intermittent bugs require SYSTEMATIC diagnosis. The slower you go in diagnosis, the faster you get to the fix. Guessing is the fastest way to disaster.

#### Professional script for co-leads who suggest guessing

> "I appreciate the suggestion. Adding @ObservedObject everywhere is treating the symptom, not the root cause. The skill says intermittent bugs create NEW bugs when we guess. I need 60 minutes for systematic diagnosis. If I can't find the root cause by then, we'll disable the feature and ship a clean v1.1. The math shows we have time—I can complete diagnosis, fix, AND verification before the deadline."

---

### Scenario 3: "Layout looks wrong on iPad, we're out of time"

#### Red flags you might think
- "Add some padding and magic numbers"
- "It's probably a safe area thing, let me just ignore it"
- "Let's lock this to iPhone only"
- "GeometryReader will solve this"

**The danger**: Magic numbers break on other sizes. SafeArea ignoring is often wrong. Locking to iPhone means you ship a broken iPad experience.

**What to do instead** (3-minute diagnosis):
1. Run in simulator or device
2. Use Debug View Hierarchy: Debug menu → View Hierarchy (takes 30 seconds to load)
3. Check: Is the problem SafeArea, ZStack ordering, or GeometryReader sizing?
4. Use the correct pattern from the Quick Reference above

**Time cost**: 3 minutes diagnosis + 5 minutes fix = **8 minutes total**

**Cost of magic numbers**: Ship wrong, report 2 weeks later, debug 4 hours, patch in update = **2+ weeks delay**

---

## Quick Reference

### Common View Update Fixes

```swift
// Fix 1: Reassign the full struct
@State var items: [String] = []
var newItems = items
newItems.append("new")
self.items = newItems

// Fix 2: Pass binding correctly
@State var value = ""
ChildView(text: $value)  // Pass binding, not value

// Fix 3: Preserve view identity
View().opacity(isVisible ? 1 : 0)  // Not: if isVisible { View() }

// Fix 4: Observe the object
@StateObject var model = MyModel()
@ObservedObject var model: MyModel
```

### Common Preview Fixes

```swift
// Fix 1: Provide dependencies
#Preview {
    ContentView()
        .environmentObject(AppModel())
}

// Fix 2: Safe defaults
@State var index = 0  // Not 10, if array has 3 items

// Fix 3: Nuke cache
// Terminal: rm -rf ~/Library/Developer/Xcode/DerivedData
```

### Common Layout Fixes

```swift
// Fix 1: Z-order
Rectangle().zIndex(1)

// Fix 2: Constrain GeometryReader
GeometryReader { geo in ... }.frame(height: 100)

// Fix 3: SafeArea
ZStack { ... }.ignoresSafeArea()

// Fix 4: Modifier order
Text().cornerRadius(8).padding()  // Corners first
```

## Real-World Examples

### Example 1: List Item Doesn't Update When Tapped

**Scenario**: You have a list of tasks. When you tap a task to mark it complete, the checkmark should appear, but it doesn't.

**Code**:
```swift
struct TaskListView: View {
    @State var tasks: [Task] = [...]

    var body: some View {
        List {
            ForEach(tasks, id: \.id) { task in
                HStack {
                    Image(systemName: task.isComplete ? "checkmark.circle.fill" : "circle")
                    Text(task.title)
                    Spacer()
                    Button("Done") {
                        // ❌ WRONG: Direct mutation
                        task.isComplete.toggle()
                    }
                }
            }
        }
    }
}
```

**Diagnosis using the skill**:
1. Can you reproduce in preview? YES
2. Are you modifying the struct directly? YES → **Struct Mutation** (Root Cause 1)

**Fix**:
```swift
Button("Done") {
    // ✅ RIGHT: Full reassignment
    if let index = tasks.firstIndex(where: { $0.id == task.id }) {
        tasks[index].isComplete.toggle()
    }
}
```

**Why this works**: SwiftUI detects the array reassignment, triggering a redraw. The task in the List updates.

---

### Example 2: Preview Crashes with "No Such Module"

**Scenario**: You created a custom data model. It works fine in the app, but the preview crashes with "Cannot find 'CustomModel' in scope".

**Code**:
```swift
import SwiftUI

// ❌ WRONG: Preview missing the dependency
#Preview {
    TaskDetailView(task: Task(...))
}

struct TaskDetailView: View {
    @Environment(\.modelContext) var modelContext
    let task: Task  // Custom model

    var body: some View {
        Text(task.title)
    }
}
```

**Diagnosis using the skill**:
1. What's the error? "Cannot find in scope" → **Missing Dependency** (Error Type 1)
2. What does TaskDetailView need? The Task model and modelContext

**Fix**:
```swift
#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Task.self, configurations: config)

    return TaskDetailView(task: Task(title: "Sample"))
        .modelContainer(container)
}
```

**Why this works**: Providing the environment object and model container satisfies the view's dependencies. Preview loads successfully.

---

### Example 3: Text Field Value Changes Don't Appear

**Scenario**: You have a search field. You type characters, but the text doesn't appear in the UI. However, the search results DO update.

**Code**:
```swift
struct SearchView: View {
    @State var searchText = ""

    var body: some View {
        VStack {
            // ❌ WRONG: Passing constant binding
            TextField("Search", text: .constant(searchText))

            Text("Results for: \(searchText)")  // This updates
            List {
                ForEach(results(for: searchText), id: \.self) { result in
                    Text(result)
                }
            }
        }
    }

    func results(for text: String) -> [String] {
        // Returns filtered results
    }
}
```

**Diagnosis using the skill**:
1. Can you reproduce in preview? YES
2. Are you passing a binding to a child view? YES (TextField)
3. Is it a constant binding? YES → **Lost Binding Identity** (Root Cause 2)

**Fix**:
```swift
// ✅ RIGHT: Pass the actual binding
TextField("Search", text: $searchText)
```

**Why this works**: `$searchText` passes a two-way binding. TextField writes changes back to @State, triggering a redraw. Text field now shows typed characters.

---

## Simulator Verification

After fixing SwiftUI issues, verify with visual confirmation in the simulator.

### Why Simulator Verification Matters

SwiftUI previews don't always match simulator behavior:
- **Different rendering** — Some visual effects only work on device/simulator
- **Different timing** — Animations may behave differently
- **Different state** — Full app lifecycle vs isolated preview

**Use simulator verification for**:
- Layout fixes (spacing, alignment, sizing)
- View update fixes (state changes, bindings)
- Animation and gesture issues
- Before/after visual comparison

### Quick Verification Workflow

```bash
# 1. Take "before" screenshot
/axiom:screenshot

# 2. Apply your fix

# 3. Rebuild and relaunch
xcodebuild build -scheme YourScheme

# 4. Take "after" screenshot
/axiom:screenshot

# 5. Compare screenshots to verify fix
```

### Navigating to Problem Screens

If the bug is deep in your app, use debug deep links to navigate directly:

```bash
# 1. Add debug deep links (see deep-link-debugging skill)
# Example: debug://settings, debug://recipe-detail?id=123

# 2. Navigate and capture
xcrun simctl openurl booted "debug://problem-screen"
sleep 1
/axiom:screenshot
```

### Full Simulator Testing

For complex scenarios (state setup, multiple steps, log analysis):

```bash
/axiom:test-simulator
```

Then describe what you want to test:
- "Navigate to the recipe editor and verify the layout fix"
- "Test the profile screen with empty state"
- "Verify the animation doesn't stutter anymore"

### Before/After Example

**Before fix** (view not updating):
```bash
# 1. Reproduce bug
xcrun simctl openurl booted "debug://recipe-list"
sleep 1
xcrun simctl io booted screenshot /tmp/before-fix.png
# Screenshot shows: Tapping star doesn't update UI
```

**After fix** (added @State binding):
```bash
# 2. Test fix
xcrun simctl openurl booted "debug://recipe-list"
sleep 1
xcrun simctl io booted screenshot /tmp/after-fix.png
# Screenshot shows: Star updates immediately when tapped
```

**Time saved**: 60%+ faster iteration with visual verification vs manual navigation

---

## Resources

**WWDC**: 2025-256, 2025-306, 2023-10160, 2023-10149, 2021-10022

**Docs**: /swiftui/managing-model-data-in-your-app, /swiftui, /swiftui/state-and-data-flow, /xcode/previews, /observation

**Skills**: axiom-swiftui-performance, axiom-swiftui-debugging-diag, axiom-xcode-debugging, axiom-swift-concurrency

