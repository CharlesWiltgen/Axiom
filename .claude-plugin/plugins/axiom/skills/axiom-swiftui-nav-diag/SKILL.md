---
name: axiom-swiftui-nav-diag
description: Use when debugging navigation not responding, unexpected pops, deep links showing wrong screen, state lost on tab switch or background, crashes in navigationDestination, or any SwiftUI navigation failure - systematic diagnostics with production crisis defense
user-invocable: false
skill_type: diagnostic
version: 1.0.0
---

# SwiftUI Navigation Diagnostics

## Overview

**Core principle** 85% of navigation problems stem from path state management errors, view identity issues, or placement mistakes—not SwiftUI defects.

SwiftUI's navigation system is used by millions of apps and handles complex navigation patterns reliably. If your navigation is failing, not responding, or behaving unexpectedly, the issue is almost always in how you're managing navigation state, not the framework itself.

This skill provides systematic diagnostics to identify root causes in minutes, not hours.

## Red Flags — Suspect Navigation Issue

If you see ANY of these, suspect a code issue, not framework breakage:

- Navigation tap does nothing (link present but doesn't push)
- Back button pops to wrong screen or root
- Deep link opens app but shows wrong screen
- Navigation state lost when switching tabs
- Navigation state lost when app backgrounds
- Same NavigationLink pushes twice
- Navigation animation stuck or janky
- Crash with `navigationDestination` in stack trace

- ❌ **FORBIDDEN** "SwiftUI navigation is broken, let's wrap UINavigationController"
  - NavigationStack is used by Apple's own apps
  - Wrapping UIKit adds complexity and loses SwiftUI state management benefits
  - UIKit interop has its own edge cases you'll spend weeks discovering
  - Your issue is almost certainly path management, not framework defect

**Critical distinction** NavigationStack behavior is deterministic. If it's not working, you're modifying state incorrectly, have view identity issues, or navigationDestination is misplaced.

## Mandatory First Steps

**ALWAYS run these checks FIRST** (before changing code):

```swift
// 1. Add NavigationPath logging
NavigationStack(path: $path) {
    RootView()
        .onChange(of: path.count) { oldCount, newCount in
            print("📍 Path changed: \(oldCount) → \(newCount)")
            // If this never fires, link isn't modifying path
            // If it fires unexpectedly, something else modifies path
        }
}

// 2. Check navigationDestination is visible
// Put temporary print in destination closure
.navigationDestination(for: Recipe.self) { recipe in
    let _ = print("🔗 Destination for Recipe: \(recipe.name)")
    RecipeDetail(recipe: recipe)
}
// If this never prints, destination isn't being evaluated

// 3. Check NavigationLink is inside NavigationStack
// Visual inspection: Trace from NavigationLink up view hierarchy
// Must hit NavigationStack, not another container first

// 4. Check path state location
// @State must be in stable view (not recreated each render)
// Must be @State, @StateObject, or @Observable — not local variable

// 5. Test basic case in isolation
// Create minimal reproduction
NavigationStack {
    NavigationLink("Test", value: "test")
        .navigationDestination(for: String.self) { str in
            Text("Pushed: \(str)")
        }
}
// If this works, problem is in your specific setup
```

#### What this tells you

| Observation | Diagnosis | Next Step |
|-------------|-----------|-----------|
| onChange never fires on tap | NavigationLink not in NavigationStack hierarchy | Pattern 1a |
| onChange fires but view doesn't push | navigationDestination not found/loaded | Pattern 1b |
| onChange fires, view pushes, then immediate pop | View identity issue or path modification | Pattern 2a |
| Path changes unexpectedly (not from tap) | External code modifying path | Pattern 2b |
| Deep link path.append() doesn't navigate | Timing issue or wrong thread | Pattern 3b |
| State lost on tab switch | NavigationStack shared across tabs | Pattern 4a |
| Works first time, fails on return | View recreation issue | Pattern 5a |

#### MANDATORY INTERPRETATION

Before changing ANY code, identify ONE of these:

1. If link tap does nothing AND no onChange → Link outside NavigationStack (check hierarchy)
2. If onChange fires but nothing pushes → navigationDestination not in scope (check placement)
3. If pushes then immediately pops → View identity change or path reset (check @State location)
4. If deep link fails → Timing or MainActor issue (check thread)
5. If crash → Force unwrap on path decode or missing type registration

#### If diagnostics are contradictory or unclear
- STOP. Do NOT proceed to patterns yet
- Add print statements at every path modification point
- Create minimal reproduction case
- Test with String values first (simplest case)

## Decision Tree

Use this to reach the correct diagnostic pattern in 2 minutes:

```
Navigation problem?
├─ Navigation tap does nothing?
│  ├─ NavigationLink inside NavigationStack?
│  │  ├─ No → Pattern 1a (Link outside Stack)
│  │  └─ Yes → Check navigationDestination
│  │
│  ├─ navigationDestination registered?
│  │  ├─ Inside lazy container? → Pattern 1b (Lazy Loading)
│  │  ├─ Type mismatch? → Pattern 1c (Type Registration)
│  │  └─ Blocked by sheet/popover? → Pattern 1d (Modal Blocking)
│  │
│  └─ Using view-based link?
│     └─ → Pattern 1e (Deprecated API)
│
├─ Unexpected pop back?
│  ├─ Immediate pop after push?
│  │  ├─ View body recreating path? → Pattern 2a (Path Recreation)
│  │  ├─ @State in wrong view? → Pattern 2a (State Location)
│  │  └─ ForEach id changing? → Pattern 2c (Identity Change)
│  │
│  ├─ Pop when shouldn't?
│  │  ├─ External code calling removeLast? → Pattern 2b (Unexpected Modification)
│  │  ├─ Task cancelled? → Pattern 2b (Async Cancellation)
│  │  └─ MainActor issue? → Pattern 2d (Threading)
│  │
│  └─ Back button behavior wrong?
│     └─ → Pattern 2e (Stack Corruption)
│
├─ Deep link not working?
│  ├─ URL not received?
│  │  ├─ onOpenURL not called? → Check URL scheme in Info.plist
│  │  └─ Universal Links issue? → Check apple-app-site-association
│  │
│  ├─ URL received, path not updated?
│  │  ├─ path.append not on MainActor? → Pattern 3a (Threading)
│  │  ├─ Timing issue (app not ready)? → Pattern 3b (Initialization)
│  │  └─ NavigationStack not created yet? → Pattern 3b (Lifecycle)
│  │
│  └─ Path updated, wrong screen shown?
│     ├─ Wrong path order? → Pattern 3c (Path Construction)
│     ├─ Wrong type appended? → Pattern 3c (Type Mismatch)
│     └─ Item not found? → Pattern 3d (Data Resolution)
│
├─ State lost?
│  ├─ Lost on tab switch?
│  │  ├─ Shared NavigationStack? → Pattern 4a (Shared State)
│  │  └─ Tab recreation? → Pattern 4a (Tab Identity)
│  │
│  ├─ Lost on background/foreground?
│  │  ├─ No SceneStorage? → Pattern 4b (No Persistence)
│  │  └─ Decode failure? → Pattern 4c (Decode Error)
│  │
│  └─ Lost on rotation/size change?
│     └─ → Pattern 4d (Layout Recreation)
│
└─ Crash?
   ├─ EXC_BAD_ACCESS in navigation code?
   │  └─ → Pattern 5a (Memory Issue)
   │
   ├─ Fatal error: type not registered?
   │  └─ → Pattern 5b (Missing Destination)
   │
   └─ Decode failure on restore?
      └─ → Pattern 5c (Restoration Crash)
```

## Pattern Selection Rules (MANDATORY)

Before proceeding to a pattern:

1. **Navigation tap does nothing** → Add onChange logging FIRST, then Pattern 1
2. **Unexpected pop** → Find WHAT is modifying path (logging), then Pattern 2
3. **Deep link fails** → Verify URL received (print in onOpenURL), then Pattern 3
4. **State lost** → Identify WHEN lost (tab switch vs background), then Pattern 4
5. **Crash** → Get full stack trace, then Pattern 5

#### Apply ONE pattern at a time
- Implement the fix from one pattern
- Test thoroughly
- Only if issue persists, try next pattern
- DO NOT apply multiple patterns simultaneously (can't isolate cause)

#### FORBIDDEN
- Guessing at solutions without diagnostics
- Changing multiple things at once
- Wrapping with UINavigationController "because SwiftUI is broken"
- Adding delays/DispatchQueue.main.async without understanding why
- Switching to view-based NavigationLink "to avoid path issues"

---

## Diagnostic Patterns

### Pattern 1a: NavigationLink Outside NavigationStack

**Time cost** 5-10 minutes

#### Symptom
- Tapping NavigationLink does nothing
- No navigation occurs, no errors
- onChange(of: path) never fires

#### Diagnosis
```swift
// Check view hierarchy — NavigationLink must be INSIDE NavigationStack

// ❌ WRONG — Link outside stack
struct ContentView: View {
    var body: some View {
        VStack {
            NavigationLink("Go", value: "test")  // Outside stack!
            NavigationStack {
                Text("Root")
            }
        }
    }
}

// Check: Add background color to NavigationStack
NavigationStack {
    Color.red  // If link is on red, it's inside
}
```

#### Fix
```swift
// ✅ CORRECT — Link inside stack
struct ContentView: View {
    var body: some View {
        NavigationStack {
            VStack {
                NavigationLink("Go", value: "test")  // Inside stack
                Text("Root")
            }
            .navigationDestination(for: String.self) { str in
                Text("Pushed: \(str)")
            }
        }
    }
}
```

#### Verification
- Tap link, navigation occurs
- onChange(of: path) fires when tapped

---

### Pattern 1b: navigationDestination in Lazy Container

**Time cost** 10-15 minutes

#### Symptom
- NavigationLink tap does nothing OR works intermittently
- onChange fires (path updated) but view doesn't push
- Console may show: "A navigationDestination for [Type] was not found"

#### Diagnosis
```swift
// ❌ WRONG — Destination inside lazy container (may not be loaded)
ScrollView {
    LazyVStack {
        ForEach(items) { item in
            NavigationLink(item.name, value: item)
                .navigationDestination(for: Item.self) { item in
                    ItemDetail(item: item)  // May not be evaluated!
                }
        }
    }
}
```

#### Fix
```swift
// ✅ CORRECT — Destination outside lazy container
ScrollView {
    LazyVStack {
        ForEach(items) { item in
            NavigationLink(item.name, value: item)
        }
    }
}
.navigationDestination(for: Item.self) { item in
    ItemDetail(item: item)  // Always available
}
```

#### Verification
- Add print in destination closure — should always print on navigation
- Works regardless of scroll position

---

### Pattern 1c: Type Registration Mismatch

**Time cost** 10 minutes

#### Symptom
- Navigation tap does nothing
- No matching navigationDestination for the value type
- May work for some links, not others

#### Diagnosis
```swift
// Check: Value type must EXACTLY match destination type

// Link uses Recipe
NavigationLink(recipe.name, value: recipe)  // value is Recipe

// Destination registered for... Recipe.ID?
.navigationDestination(for: Recipe.ID.self) { id in  // ❌ Wrong type!
    RecipeDetail(id: id)
}
```

#### Fix
```swift
// Match types exactly
NavigationLink(recipe.name, value: recipe)  // Recipe

.navigationDestination(for: Recipe.self) { recipe in  // ✅ Recipe
    RecipeDetail(recipe: recipe)
}

// OR change link to use ID
NavigationLink(recipe.name, value: recipe.id)  // Recipe.ID

.navigationDestination(for: Recipe.ID.self) { id in  // ✅ Recipe.ID
    RecipeDetail(id: id)
}
```

#### Verification
- Print type in destination: `print(type(of: value))`
- Types must match exactly (no inheritance)

---

### Pattern 2a: NavigationPath Recreated Every Render

**Time cost** 15-20 minutes

#### Symptom
- Navigation pushes then immediately pops back
- Appears to "flash" the destination view
- Works once, then fails, or fails immediately

#### Diagnosis
```swift
// ❌ WRONG — Path created in view body (reset every render)
struct ContentView: View {
    var body: some View {
        let path = NavigationPath()  // Recreated every time!
        NavigationStack(path: .constant(path)) {
            // ...
        }
    }
}

// ❌ WRONG — @State in child view that gets recreated
struct ParentView: View {
    @State var showChild = true
    var body: some View {
        if showChild {
            ChildView()  // Recreated when showChild toggles
        }
    }
}

struct ChildView: View {
    @State var path = NavigationPath()  // Lost when ChildView recreated
    // ...
}
```

#### Fix
```swift
// ✅ CORRECT — @State at stable level
struct ContentView: View {
    @State private var path = NavigationPath()  // Persists across renders

    var body: some View {
        NavigationStack(path: $path) {
            RootView()
        }
    }
}

// ✅ CORRECT — @StateObject for ObservableObject
struct ContentView: View {
    @StateObject private var navModel = NavigationModel()

    var body: some View {
        NavigationStack(path: $navModel.path) {
            RootView()
        }
    }
}
```

#### Verification
- Add onChange logging — path should not reset unexpectedly
- Navigate, wait, path.count stays stable

---

### Pattern 2d: Path Modified Off MainActor

**Time cost** 10-15 minutes

#### Symptom
- Navigation works sometimes, fails others
- Swift 6 warnings about MainActor isolation
- Unexpected pops or state corruption

#### Diagnosis
```swift
// ❌ WRONG — Modifying path from background task
func loadAndNavigate() async {
    let recipe = await fetchRecipe()
    path.append(recipe)  // ⚠️ Not on MainActor!
}

// Check: Search for path.append, path.removeLast outside @MainActor context
```

#### Fix
```swift
// ✅ CORRECT — Ensure MainActor
@MainActor
func loadAndNavigate() async {
    let recipe = await fetchRecipe()
    path.append(recipe)  // ✅ MainActor isolated
}

// OR explicitly dispatch
func loadAndNavigate() async {
    let recipe = await fetchRecipe()
    await MainActor.run {
        path.append(recipe)
    }
}

// ✅ BEST — Use @Observable with @MainActor
@Observable
@MainActor
class Router {
    var path = NavigationPath()

    func navigate(to value: any Hashable) {
        path.append(value)
    }
}
```

#### Verification
- No Swift 6 concurrency warnings
- Navigation consistent regardless of timing

---

### Pattern 3a: Deep Link Threading Issue

**Time cost** 15-20 minutes

#### Symptom
- Deep link URL received (onOpenURL fires)
- path.append called but navigation doesn't happen
- Works when app is in foreground, fails from cold start

#### Diagnosis
```swift
// ❌ WRONG — May be called before NavigationStack exists
.onOpenURL { url in
    handleDeepLink(url)  // NavigationStack may not be rendered yet
}

func handleDeepLink(_ url: URL) {
    path.append(parsedValue)  // Modifies path that doesn't exist yet
}
```

#### Fix
```swift
// ✅ CORRECT — Defer deep link handling
@State private var pendingDeepLink: URL?
@State private var isReady = false

var body: some View {
    NavigationStack(path: $path) {
        RootView()
            .onAppear {
                isReady = true
                if let url = pendingDeepLink {
                    handleDeepLink(url)
                    pendingDeepLink = nil
                }
            }
    }
    .onOpenURL { url in
        if isReady {
            handleDeepLink(url)
        } else {
            pendingDeepLink = url  // Queue for later
        }
    }
}
```

#### Verification
- Test deep link from cold start (app killed)
- Test deep link when app in background
- Test deep link when app in foreground

---

### Pattern 3c: Deep Link Path Construction Order

**Time cost** 10-15 minutes

#### Symptom
- Deep link navigates but to wrong screen
- Shows intermediate screen instead of final destination
- Path appears correct but wrong view displayed

#### Diagnosis
```swift
// ❌ WRONG — Wrong order (child before parent)
// URL: myapp://category/desserts/recipe/apple-pie
func handleDeepLink(_ url: URL) {
    path.append(recipe)    // Recipe pushed first
    path.append(category)  // Category pushed second — WRONG ORDER
}
// User sees Category screen, not Recipe screen
```

#### Fix
```swift
// ✅ CORRECT — Parent before child
func handleDeepLink(_ url: URL) {
    path.removeLast(path.count)  // Clear existing

    // Build hierarchy: parent → child
    path.append(category)  // First: Category
    path.append(recipe)    // Second: Recipe (shows this screen)
}

// For complex paths, build array first
var newPath: [any Hashable] = []
// Parse URL segments...
newPath.append(category)
newPath.append(subcategory)
newPath.append(item)

// Then apply
path = NavigationPath(newPath)
```

#### Verification
- Print path after construction
- Final item in path should be the destination screen

---

### Pattern 4a: Shared NavigationStack Across Tabs

**Time cost** 15-20 minutes

#### Symptom
- Navigate in Tab A, switch to Tab B
- Return to Tab A — navigation state lost (back at root)
- Or: Navigation from Tab A appears in Tab B

#### Diagnosis
```swift
// ❌ WRONG — Single NavigationStack wrapping TabView
NavigationStack(path: $path) {
    TabView {
        Tab("Home") { HomeView() }
        Tab("Settings") { SettingsView() }
    }
}
// All tabs share same navigation — state mixed/lost

// ❌ WRONG — Same @State used across tabs
@State var path = NavigationPath()  // Shared
TabView {
    Tab("Home") {
        NavigationStack(path: $path) { ... }  // Uses shared path
    }
    Tab("Settings") {
        NavigationStack(path: $path) { ... }  // Same path!
    }
}
```

#### Fix
```swift
// ✅ CORRECT — Each tab has own NavigationStack
TabView {
    Tab("Home", systemImage: "house") {
        NavigationStack {  // Own stack
            HomeView()
                .navigationDestination(for: HomeItem.self) { ... }
        }
    }
    Tab("Settings", systemImage: "gear") {
        NavigationStack {  // Own stack
            SettingsView()
                .navigationDestination(for: SettingItem.self) { ... }
        }
    }
}

// For per-tab path tracking:
struct HomeTab: View {
    @State private var path = NavigationPath()  // Tab-specific

    var body: some View {
        NavigationStack(path: $path) {
            HomeView()
        }
    }
}
```

#### Verification
- Navigate in Tab A, switch tabs, return — state preserved
- Each tab maintains independent navigation history

---

### Pattern 4b: No State Persistence on Background

**Time cost** 15-20 minutes

#### Symptom
- Navigate to screen, background app
- Kill app or wait for system to terminate
- Relaunch — navigation state lost (back at root)

#### Diagnosis
```swift
// ❌ WRONG — No persistence mechanism
@State private var path = NavigationPath()
// Path lost when app terminates
```

#### Fix
```swift
// ✅ CORRECT — Use SceneStorage + Codable
struct ContentView: View {
    @StateObject private var navModel = NavigationModel()
    @SceneStorage("navigation") private var savedData: Data?

    var body: some View {
        NavigationStack(path: $navModel.path) {
            RootView()
        }
        .task {
            // Restore on appear
            if let data = savedData {
                navModel.restore(from: data)
            }
            // Save on changes
            for await _ in navModel.objectWillChange.values {
                savedData = navModel.encoded()
            }
        }
    }
}

@MainActor
class NavigationModel: ObservableObject {
    @Published var path = NavigationPath()

    func encoded() -> Data? {
        guard let codable = path.codable else { return nil }
        return try? JSONEncoder().encode(codable)
    }

    func restore(from data: Data) {
        guard let codable = try? JSONDecoder().decode(
            NavigationPath.CodableRepresentation.self,
            from: data
        ) else { return }
        path = NavigationPath(codable)
    }
}
```

#### Verification
- Navigate deep, background app
- Kill app via Xcode
- Relaunch — state restored

---

### Pattern 5b: Missing navigationDestination Registration

**Time cost** 10-15 minutes

#### Symptom
- Crash: "No destination found for [Type]"
- Or navigation silently fails
- Happens when pushing certain types

#### Diagnosis
```swift
// Every type pushed on path needs a destination

// You push Recipe
path.append(recipe)  // Recipe type

// But only registered Category
.navigationDestination(for: Category.self) { ... }
// No destination for Recipe!
```

#### Fix
```swift
// Register ALL types you might push
NavigationStack(path: $path) {
    RootView()
        .navigationDestination(for: Category.self) { category in
            CategoryView(category: category)
        }
        .navigationDestination(for: Recipe.self) { recipe in
            RecipeDetail(recipe: recipe)
        }
        .navigationDestination(for: Chef.self) { chef in
            ChefProfile(chef: chef)
        }
}

// Or use enum route type for single registration
enum AppRoute: Hashable {
    case category(Category)
    case recipe(Recipe)
    case chef(Chef)
}

.navigationDestination(for: AppRoute.self) { route in
    switch route {
    case .category(let cat): CategoryView(category: cat)
    case .recipe(let recipe): RecipeDetail(recipe: recipe)
    case .chef(let chef): ChefProfile(chef: chef)
    }
}
```

#### Verification
- List all types you push on path
- Verify each has matching navigationDestination

---

### Pattern 5c: State Restoration Decode Crash

**Time cost** 15-20 minutes

#### Symptom
- Crash on app launch
- Stack trace shows JSON decode failure
- Happens after app update or data model change

#### Diagnosis
```swift
// ❌ WRONG — Force unwrap decode
func restore(from data: Data) {
    let codable = try! JSONDecoder().decode(  // 💥 Crashes!
        NavigationPath.CodableRepresentation.self,
        from: data
    )
    path = NavigationPath(codable)
}

// Crash reasons:
// - Saved path contains type that no longer exists
// - Codable encoding changed between versions
// - Saved item was deleted
```

#### Fix
```swift
// ✅ CORRECT — Graceful decode with fallback
func restore(from data: Data) {
    do {
        let codable = try JSONDecoder().decode(
            NavigationPath.CodableRepresentation.self,
            from: data
        )
        path = NavigationPath(codable)
    } catch {
        print("Navigation restore failed: \(error)")
        path = NavigationPath()  // Start fresh
        // Optionally clear bad saved data
    }
}

// ✅ BETTER — Store IDs, resolve to objects
class NavigationModel: ObservableObject, Codable {
    var selectedIds: [String] = []  // Store IDs

    func resolvedPath(dataModel: DataModel) -> NavigationPath {
        var path = NavigationPath()
        for id in selectedIds {
            if let item = dataModel.item(withId: id) {
                path.append(item)
            }
            // Missing items silently skipped
        }
        return path
    }
}
```

#### Verification
- Delete saved state, launch app — no crash
- Simulate bad data — graceful fallback
- Change data model, launch — handles mismatch

---

## Production Crisis Scenario

### Context: Navigation Randomly Breaks After iOS Update

#### Situation
- iOS 18 ships on Tuesday
- By Wednesday, support tickets surge: "navigation broken"
- 20% of users report tapping links does nothing
- Some users report navigation "resets randomly"
- CTO asks: "What's the ETA on a fix?"

#### Pressure signals
- 🚨 **Production issue** 20% of users affected
- ⏰ **Time pressure** "Users are leaving bad reviews"
- 👔 **Executive visibility** CTO personally tracking
- 📱 **Platform change** New iOS version

#### Rationalization traps (DO NOT fall into these)

1. *"It's an iOS 18 bug, wait for Apple to fix"*
   - If 80% of users work fine, it's not iOS
   - Apple's apps use same NavigationStack
   - Your code has an edge case exposed by iOS changes

2. *"Let's wrap UINavigationController"*
   - 2-3 week rewrite
   - Lose SwiftUI state management
   - UIKit has its own iOS 18 changes
   - Doesn't address root cause

3. *"Add retry logic for navigation"*
   - Navigation is synchronous — retries don't help
   - Masks symptom, doesn't fix cause
   - Makes debugging harder

4. *"Roll back to pre-iOS 18 version"*
   - Can't control user iOS version
   - App Store version must support iOS 18
   - Doesn't fix the issue

#### MANDATORY Diagnostic Protocol

You have 2 hours to provide CTO with:
1. Root cause
2. Fix timeline
3. Workaround for affected users

#### Step 1: Identify Pattern (30 minutes)

```swift
// Release build with diagnostic logging
#if DEBUG || DIAGNOSTIC
NavigationStack(path: $path) {
    // ...
}
.onChange(of: path.count) { old, new in
    Analytics.log("nav_path_change", ["old": old, "new": new])
}
#endif

// Check analytics for:
// - path.count going to 0 unexpectedly → Path recreation
// - path.count increasing but no push → Missing destination
// - No path changes at all → Link not firing
```

#### Step 2: Cross-Reference with iOS 18 Changes (15 minutes)

```swift
// iOS 18 changes that affect navigation:
// 1. Stricter MainActor enforcement
// 2. Changes to view identity in TabView
// 3. New navigation lifecycle timing

// Most common iOS 18 issue:
// Code that worked by accident now fails

// Check: Any path modifications in async contexts without @MainActor?
Task {
    let result = await fetch()
    path.append(result)  // ⚠️ iOS 18 stricter about this
}
```

#### Step 3: Apply Targeted Fix (30 minutes)

```swift
// Root cause found: NavigationPath modified from async context
// iOS 17 was lenient, iOS 18 enforces MainActor properly

// ❌ Old code (worked on iOS 17, breaks on iOS 18)
func loadAndNavigate() async {
    let recipe = await fetchRecipe()
    path.append(recipe)  // Race condition
}

// ✅ Fix: Explicit MainActor isolation
@MainActor
func loadAndNavigate() async {
    let recipe = await fetchRecipe()
    path.append(recipe)  // ✅ Safe
}

// OR: Annotate entire class
@Observable
@MainActor
class Router {
    var path = NavigationPath()

    func navigate(to value: any Hashable) {
        path.append(value)
    }
}
```

#### Step 4: Validate and Deploy (45 minutes)

```swift
// 1. Test on iOS 17 device — still works
// 2. Test on iOS 18 device — now works
// 3. Test all navigation paths
// 4. Submit expedited review

// Expedited review justification:
// "Critical bug fix for iOS 18 compatibility affecting 20% of users"
```

#### Professional Communication Templates

#### To CTO (45 minutes after starting)
```
Root cause identified: Navigation code wasn't properly isolated
to the main thread. iOS 18 enforces this more strictly than iOS 17.

Fix: Add @MainActor annotation to navigation code.
Already tested on iOS 17 (no regression) and iOS 18 (fixes issue).

Timeline:
- Fix ready: Now
- QA validation: 1 hour
- App Store submission: Today
- Available to users: 24-48 hours (expedited review)

Workaround for affected users: Force quit and relaunch app
often clears the issue temporarily.
```

#### To Engineering Team
```
iOS 18 Navigation Fix

Root cause: NavigationPath modifications in async contexts
without @MainActor isolation. iOS 17 was permissive, iOS 18 enforces.

Fix applied:
- Added @MainActor to Router class
- Updated all path.append/removeLast calls to be MainActor-isolated
- Added Swift 6 concurrency checking to catch future issues

Files changed: Router.swift, ContentView.swift, DeepLinkHandler.swift

Testing needed:
- All navigation flows
- Deep links from cold start
- Tab switching with navigation state
- Background/foreground with navigation state
```

---

## Quick Reference Table

| Symptom | Likely Cause | First Check | Pattern | Fix Time |
|---------|--------------|-------------|---------|----------|
| Link tap does nothing | Link outside stack | View hierarchy | 1a | 5-10 min |
| Intermittent navigation failure | Destination in lazy container | Destination placement | 1b | 10-15 min |
| Works for some types, not others | Type mismatch | Print type(of:) | 1c | 10 min |
| Push then immediate pop | Path recreated | @State location | 2a | 15-20 min |
| Random unexpected pops | External path modification | Add logging | 2b | 15-20 min |
| Works on MainActor, fails in Task | Threading issue | Check @MainActor | 2d | 10-15 min |
| Deep link doesn't navigate | Not on MainActor | Thread check | 3a | 15-20 min |
| Deep link from cold start fails | Timing/lifecycle | Add pendingDeepLink | 3b | 15-20 min |
| Deep link shows wrong screen | Path order wrong | Print path contents | 3c | 10-15 min |
| State lost on tab switch | Shared NavigationStack | Check Tab structure | 4a | 15-20 min |
| State lost on background | No persistence | Add SceneStorage | 4b | 20-25 min |
| Crash on launch (decode) | Force unwrap decode | Error handling | 5c | 15-20 min |
| "No destination found" crash | Missing registration | List all types | 5b | 10-15 min |

---

## Common Mistakes

### Mistake 1: Putting navigationDestination Inside ForEach

**Problem** Destination not loaded when needed (lazy evaluation).

**Why it fails** LazyVStack/ForEach don't evaluate all children. Destination may not exist when link is tapped.

#### Fix
```swift
// Move destination OUTSIDE lazy container
List {
    ForEach(items) { item in
        NavigationLink(item.name, value: item)
    }
}
.navigationDestination(for: Item.self) { item in
    ItemDetail(item: item)
}
```

### Mistake 2: Using NavigationView on iOS 16+

**Problem** NavigationView deprecated, different behavior across versions.

**Why it fails** No NavigationPath support, can't programmatically navigate or deep link reliably.

#### Fix
- Replace `NavigationView` with `NavigationStack` or `NavigationSplitView`
- Use value-based `NavigationLink(title, value:)` instead of view-based

### Mistake 3: Creating NavigationPath in computed property

**Problem** Path reset every access.

**Why it fails** `var body` is called repeatedly. Creating path there means it's reset constantly.

#### Fix
```swift
// Use @State, not computed
@State private var path = NavigationPath()  // ✅ Persists

// NOT
var path: NavigationPath { NavigationPath() }  // ❌ Reset every time
```

### Mistake 4: Not Handling Decode Errors in Restoration

**Problem** Crash when saved navigation data is invalid.

**Why it fails** Data model changes, items deleted, encoding format changes between app versions.

#### Fix
- Always use `try?` or `do/catch` for decode
- Provide fallback (empty path)
- Consider storing IDs and resolving to objects

### Mistake 5: Assuming Deep Links Work Immediately

**Problem** Deep link on cold start fails.

**Why it fails** `onOpenURL` may fire before `NavigationStack` is rendered.

#### Fix
- Queue deep link URL
- Process after `onAppear` of NavigationStack
- Use `isReady` flag pattern

---

## Cross-References

### For Preventive Patterns

**swiftui-nav skill** — Discipline-enforcing anti-patterns:
- Red Flags: NavigationView, view-based links, path in body
- Pattern 1a-7: Correct implementation patterns
- Pressure Scenarios: How to handle architecture pressure

### For API Reference

**swiftui-nav-ref skill** — Complete API documentation:
- NavigationStack, NavigationSplitView, NavigationPath full API
- All WWDC code examples with timestamps
- Router/Coordinator patterns with testing
- iOS 26+ features (Liquid Glass, bottom search)

### For Related Issues

**swift-concurrency skill** — If MainActor issues:
- Pattern 3: @MainActor isolation patterns
- Async/await with UI updates
- Task cancellation handling

---

**Last Updated** 2025-12-05
**Status** Production-ready diagnostics
**Tested** Diagnostic patterns validated against common navigation issues
