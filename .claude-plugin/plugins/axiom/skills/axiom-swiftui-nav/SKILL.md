---
name: axiom-swiftui-nav
description: Use when implementing navigation patterns, choosing between NavigationStack and NavigationSplitView, handling deep links, adopting coordinator patterns, or requesting code review of navigation implementation - prevents navigation state corruption, deep link failures, and state restoration bugs for iOS 18+
user-invocable: true
skill_type: discipline
version: 1.0.0
last_updated: 2025-12-05
apple_platforms: iOS 18+ (Tab/Sidebar), iOS 26+ (Liquid Glass)
# MCP annotations (ignored by Claude Code)
mcp:
  category: swiftui
  tags: [swiftui, navigation, navigationstack, navigationsplitview, deep-links, state-restoration, coordinator-pattern]
  related: [swiftui-nav-diag, axiom-swiftui-nav-ref, axiom-swiftui-layout]
---

# SwiftUI Navigation

## When to Use This Skill

Use when:
- Choosing navigation architecture (NavigationStack vs NavigationSplitView vs TabView)
- Implementing programmatic navigation with NavigationPath
- Setting up deep linking and URL routing
- Implementing state restoration for navigation
- Adopting Tab/Sidebar patterns (iOS 18+)
- Implementing coordinator/router patterns
- Requesting code review of navigation implementation before shipping

#### Related Skills
- Use `axiom-swiftui-nav-diag` for systematic troubleshooting of navigation failures
- Use `axiom-swiftui-nav-ref` for comprehensive API reference (including Tab customization, iOS 26+ features) with all WWDC examples

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "Should I use NavigationStack or NavigationSplitView for my app?"
-> The skill provides a decision tree based on device targets, content hierarchy depth, and multiplatform requirements

#### 2. "How do I navigate programmatically in SwiftUI?"
-> The skill shows NavigationPath manipulation patterns for push, pop, pop-to-root, and deep linking

#### 3. "My deep links aren't working. The app opens but shows the wrong screen."
-> The skill covers URL parsing patterns, path construction order, and timing issues with onOpenURL

#### 4. "Navigation state is lost when my app goes to background."
-> The skill demonstrates Codable NavigationPath, SceneStorage persistence, and crash-resistant restoration

#### 5. "How do I implement a coordinator pattern in SwiftUI?"
-> The skill provides Router pattern examples alongside guidance on when coordinators add value vs complexity

---

## Red Flags — Anti-Patterns to Prevent

If you're doing ANY of these, STOP and use the patterns in this skill:

### ❌ CRITICAL — Never Do These

#### 1. Using deprecated NavigationView on iOS 16+
```swift
// ❌ WRONG — Deprecated, different behavior on iOS 16+
NavigationView {
    List { ... }
}
.navigationViewStyle(.stack)
```
**Why this fails** NavigationView is deprecated since iOS 16. It lacks NavigationPath support, making programmatic navigation and deep linking unreliable. Different behavior across iOS versions causes bugs.

#### 2. Using view-based NavigationLink for programmatic navigation
```swift
// ❌ WRONG — Cannot programmatically control
NavigationLink("Recipe") {
    RecipeDetail(recipe: recipe)  // View destination, no value
}
```
**Why this fails** View-based links cannot be controlled programmatically. No way to deep link or pop to this destination. Deprecated since iOS 16.

#### 3. Putting navigationDestination inside lazy containers
```swift
// ❌ WRONG — May not be loaded when needed
LazyVGrid(columns: columns) {
    ForEach(items) { item in
        NavigationLink(value: item) { ... }
            .navigationDestination(for: Item.self) { item in  // Don't do this
                ItemDetail(item: item)
            }
    }
}
```
**Why this fails** Lazy containers don't load all views immediately. navigationDestination may not be visible to NavigationStack, causing navigation to silently fail.

#### 4. Storing full model objects in NavigationPath for restoration
```swift
// ❌ WRONG — Duplicates data, stale on restore
class NavigationModel: Codable {
    var path: [Recipe] = []  // Full Recipe objects
}
```
**Why this fails** Duplicates data already in your model. On restore, Recipe data may be stale (edited/deleted elsewhere). Use IDs and resolve to current data.

#### 5. Modifying NavigationPath outside MainActor
```swift
// ❌ WRONG — UI update off main thread
Task.detached {
    await viewModel.path.append(recipe)  // Background thread
}
```
**Why this fails** NavigationPath binds to UI. Modifications must happen on MainActor or navigation state becomes corrupted. Can cause crashes or silent failures.

#### 6. Missing @MainActor isolation for navigation state
```swift
// ❌ WRONG — Not MainActor isolated
class Router: ObservableObject {
    @Published var path = NavigationPath()  // No @MainActor
}
```
**Why this fails** In Swift 6 strict concurrency, @Published properties accessed from SwiftUI views require MainActor isolation. Causes data race warnings and potential crashes.

#### 7. Not handling navigation state in multi-tab apps
```swift
// ❌ WRONG — Shared NavigationPath across tabs
TabView {
    Tab("Home") { HomeView() }
    Tab("Settings") { SettingsView() }
}
// All tabs share same NavigationStack — wrong!
```
**Why this fails** Each tab should have its own NavigationStack to preserve navigation state when switching tabs. Shared state causes confusing UX.

#### 8. Ignoring NavigationPath decoding errors
```swift
// ❌ WRONG — Crashes on invalid data
let path = NavigationPath(try! decoder.decode(NavigationPath.CodableRepresentation.self, from: data))
```
**Why this fails** User may have deleted items that were in the path. Schema may have changed. Force unwrap causes crash on restore.

---

## Mandatory First Steps

**ALWAYS complete these steps** before implementing navigation:

```swift
// Step 1: Identify your navigation structure
// Ask: Single stack? Multi-column? Tab-based with per-tab navigation?
// Record answer before writing any code

// Step 2: Choose container based on structure
// Single stack (iPhone-primary): NavigationStack
// Multi-column (iPad/Mac-primary): NavigationSplitView
// Tab-based: TabView with NavigationStack per tab

// Step 3: Define your value types for navigation
// All values pushed on NavigationStack must be Hashable
// For deep linking/restoration, also Codable
struct Recipe: Hashable, Codable, Identifiable { ... }

// Step 4: Plan deep link URLs (if needed)
// myapp://recipe/{id}
// myapp://category/{name}/recipe/{id}

// Step 5: Plan state restoration (if needed)
// Will you use SceneStorage? What data must be Codable?
```

---

## Quick Decision Tree

```
Need navigation?
├─ Multi-column interface (iPad/Mac primary)?
│  └─ NavigationSplitView
│     ├─ Need drill-down in detail column?
│     │  └─ NavigationStack inside detail (Pattern 3)
│     └─ Selection-only detail?
│        └─ Just selection binding (Pattern 2)
├─ Tab-based app?
│  └─ TabView
│     ├─ Each tab needs drill-down?
│     │  └─ NavigationStack per tab (Pattern 4)
│     └─ iPad sidebar experience?
│        └─ .tabViewStyle(.sidebarAdaptable) (Pattern 5)
└─ Single-column stack?
   └─ NavigationStack
      ├─ Need deep linking?
      │  └─ Use NavigationPath (Pattern 1b)
      └─ Simple push/pop?
         └─ Typed array path (Pattern 1a)

Need state restoration?
└─ SceneStorage + Codable NavigationPath (Pattern 6)

Need coordinator abstraction?
├─ Complex conditional flows?
├─ Navigation logic testing needed?
├─ Sharing navigation across many screens?
└─ YES to any → Router pattern (Pattern 7)
   NO to all → Use NavigationPath directly
```

---

## Pattern 1a: Basic NavigationStack

**When**: Simple push/pop navigation, all destinations same type

**Time cost**: 5-10 min

```swift
struct RecipeList: View {
    @State private var path: [Recipe] = []

    var body: some View {
        NavigationStack(path: $path) {
            List(recipes) { recipe in
                NavigationLink(recipe.name, value: recipe)
            }
            .navigationTitle("Recipes")
            .navigationDestination(for: Recipe.self) { recipe in
                RecipeDetail(recipe: recipe)
            }
        }
    }

    // Programmatic navigation
    func showRecipe(_ recipe: Recipe) {
        path.append(recipe)
    }

    func popToRoot() {
        path.removeAll()
    }
}
```

**Key points:**
- Typed array `[Recipe]` when all values are same type
- Value-based `NavigationLink(title, value:)`
- `navigationDestination(for:)` outside lazy containers

---

## Pattern 1b: NavigationStack with Deep Linking

**When**: Multiple destination types, URL-based deep linking

**Time cost**: 15-20 min

```swift
struct ContentView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HomeView()
                .navigationDestination(for: Category.self) { category in
                    CategoryView(category: category)
                }
                .navigationDestination(for: Recipe.self) { recipe in
                    RecipeDetail(recipe: recipe)
                }
        }
        .onOpenURL { url in
            handleDeepLink(url)
        }
    }

    func handleDeepLink(_ url: URL) {
        // URL: myapp://category/desserts/recipe/apple-pie
        path.removeLast(path.count)  // Pop to root first

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let segments = components.path.split(separator: "/").map(String.init)

        var index = 0
        while index < segments.count - 1 {
            switch segments[index] {
            case "category":
                if let category = Category(rawValue: segments[index + 1]) {
                    path.append(category)
                }
                index += 2
            case "recipe":
                if let recipe = dataModel.recipe(named: segments[index + 1]) {
                    path.append(recipe)
                }
                index += 2
            default:
                index += 1
            }
        }
    }
}
```

**Key points:**
- `NavigationPath` for heterogeneous types
- Pop to root before building deep link path
- Build path in correct order (parent → child)

---

## Pattern 2: NavigationSplitView Selection-Based

**When**: Multi-column layout where detail shows selected item

**Time cost**: 10-15 min

```swift
struct MultiColumnView: View {
    @State private var selectedCategory: Category?
    @State private var selectedRecipe: Recipe?

    var body: some View {
        NavigationSplitView {
            List(Category.allCases, selection: $selectedCategory) { category in
                NavigationLink(category.name, value: category)
            }
            .navigationTitle("Categories")
        } content: {
            if let category = selectedCategory {
                List(recipes(in: category), selection: $selectedRecipe) { recipe in
                    NavigationLink(recipe.name, value: recipe)
                }
                .navigationTitle(category.name)
            } else {
                Text("Select a category")
            }
        } detail: {
            if let recipe = selectedRecipe {
                RecipeDetail(recipe: recipe)
            } else {
                Text("Select a recipe")
            }
        }
    }
}
```

**Key points:**
- `selection: $binding` on List connects to column selection
- Value-presenting links update selection automatically
- Adapts to single stack on iPhone

---

## Pattern 3: NavigationSplitView with Stack in Detail

**When**: Multi-column with drill-down capability in detail

**Time cost**: 20-25 min

```swift
struct GridWithDrillDown: View {
    @State private var selectedCategory: Category?
    @State private var path: [Recipe] = []

    var body: some View {
        NavigationSplitView {
            List(Category.allCases, selection: $selectedCategory) { category in
                NavigationLink(category.name, value: category)
            }
            .navigationTitle("Categories")
        } detail: {
            NavigationStack(path: $path) {
                if let category = selectedCategory {
                    RecipeGrid(category: category)
                        .navigationDestination(for: Recipe.self) { recipe in
                            RecipeDetail(recipe: recipe)
                        }
                } else {
                    Text("Select a category")
                }
            }
        }
    }
}
```

**Key points:**
- NavigationStack inside detail column
- Grid → Detail drill-down while preserving sidebar
- Separate path for drill-down, selection for sidebar

---

## Pattern 4: TabView with Per-Tab NavigationStack

**When**: Tab-based app where each tab has its own navigation

**Time cost**: 15-20 min

```swift
struct TabBasedApp: View {
    var body: some View {
        TabView {
            Tab("Home", systemImage: "house") {
                NavigationStack {
                    HomeView()
                        .navigationDestination(for: Item.self) { item in
                            ItemDetail(item: item)
                        }
                }
            }

            Tab("Search", systemImage: "magnifyingglass") {
                NavigationStack {
                    SearchView()
                }
            }

            Tab("Settings", systemImage: "gear") {
                NavigationStack {
                    SettingsView()
                }
            }
        }
    }
}
```

**Key points:**
- Each Tab has its own NavigationStack
- Navigation state preserved when switching tabs
- iOS 18+ Tab syntax with systemImage

---

## Pattern 5: Sidebar-Adaptable TabView (iOS 18+)

**When**: Tab bar on iPhone, sidebar on iPad

**Time cost**: 20-25 min

```swift
struct AdaptableApp: View {
    var body: some View {
        TabView {
            Tab("Watch Now", systemImage: "play") {
                WatchNowView()
            }
            Tab("Library", systemImage: "books.vertical") {
                LibraryView()
            }

            TabSection("Collections") {
                Tab("Favorites", systemImage: "star") {
                    FavoritesView()
                }
                Tab("Recently Added", systemImage: "clock") {
                    RecentView()
                }
            }

            Tab(role: .search) {
                SearchView()
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }
}
```

**Key points:**
- `.tabViewStyle(.sidebarAdaptable)` enables sidebar on iPad
- `TabSection` creates collapsible groups in sidebar
- `Tab(role: .search)` gets special placement

---

## Pattern 6: State Restoration

**When**: Preserve navigation state across app launches

**Time cost**: 25-30 min

```swift
@MainActor
class NavigationModel: ObservableObject, Codable {
    @Published var selectedCategory: Category?
    @Published var recipePath: [Recipe.ID] = []  // Store IDs, not objects

    enum CodingKeys: String, CodingKey {
        case selectedCategory, recipePath
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(selectedCategory, forKey: .selectedCategory)
        try container.encode(recipePath, forKey: .recipePath)
    }

    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        selectedCategory = try container.decodeIfPresent(Category.self, forKey: .selectedCategory)
        recipePath = try container.decode([Recipe.ID].self, forKey: .recipePath)
    }

    init() {}

    var jsonData: Data? {
        get { try? JSONEncoder().encode(self) }
        set {
            guard let data = newValue,
                  let model = try? JSONDecoder().decode(NavigationModel.self, from: data)
            else { return }
            selectedCategory = model.selectedCategory
            recipePath = model.recipePath
        }
    }
}

struct ContentView: View {
    @StateObject private var navModel = NavigationModel()
    @SceneStorage("navigation") private var data: Data?

    var body: some View {
        NavigationStack(path: $navModel.recipePath) {
            // Content
        }
        .task {
            if let data { navModel.jsonData = data }
            for await _ in navModel.objectWillChange.values {
                data = navModel.jsonData
            }
        }
    }
}
```

**Key points:**
- Store IDs, resolve to current objects
- `@MainActor` for Swift 6 concurrency safety
- SceneStorage for automatic scene-scoped persistence
- Use `compactMap` when resolving IDs to handle deleted items

---

## Pattern 7: Router/Coordinator

**When**: Complex navigation logic, need testability

**Time cost**: 30-45 min

```swift
enum AppRoute: Hashable {
    case home
    case category(Category)
    case recipe(Recipe)
    case settings
}

@Observable
@MainActor
class Router {
    var path = NavigationPath()

    func navigate(to route: AppRoute) {
        path.append(route)
    }

    func pop() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }

    func popToRoot() {
        path.removeLast(path.count)
    }

    func showRecipeOfTheDay() {
        popToRoot()
        if let recipe = DataModel.shared.recipeOfTheDay {
            path.append(AppRoute.recipe(recipe))
        }
    }
}

struct ContentView: View {
    @State private var router = Router()

    var body: some View {
        NavigationStack(path: $router.path) {
            HomeView()
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .home: HomeView()
                    case .category(let cat): CategoryView(category: cat)
                    case .recipe(let recipe): RecipeDetail(recipe: recipe)
                    case .settings: SettingsView()
                    }
                }
        }
        .environment(router)
    }
}
```

**When coordinators add value:**
- Complex conditional navigation flows
- Navigation logic needs unit testing
- Multiple views trigger same navigation
- UIKit interop with custom transitions

**When coordinators add complexity without value:**
- Simple linear navigation
- < 5 navigation destinations
- No need for navigation testing
- NavigationPath already handles your deep linking

---

## Anti-Patterns (DO NOT DO THIS)

### ❌ Nesting NavigationStack inside NavigationStack

```swift
// ❌ WRONG — Nested stacks
NavigationStack {
    SomeView()
        .sheet(isPresented: $showSheet) {
            NavigationStack {  // Creates separate stack — confusing
                SheetContent()
            }
        }
}
```

**Issue** Two navigation stacks create confusing UX. Back button behavior unclear.
**Fix** Use single NavigationStack, present sheets without nested navigation when possible.

### ❌ Using NavigationLink inside Button

```swift
// ❌ WRONG — Double navigation triggers
Button("Go") {
    // Some action
} label: {
    NavigationLink(value: item) {  // Fires on button AND link
        Text("Item")
    }
}
```

**Issue** Both Button and NavigationLink respond to taps.
**Fix** Use only NavigationLink, put action in `.simultaneousGesture` if needed.

### ❌ Creating NavigationPath in view body

```swift
// ❌ WRONG — Recreated every render
var body: some View {
    let path = NavigationPath()  // Reset on every render!
    NavigationStack(path: .constant(path)) { ... }
}
```

**Issue** Path recreated each render, navigation state lost.
**Fix** Use `@State` or `@StateObject` for navigation state.

---

## Pressure Scenario: "Make Navigation Like Instagram"

### The Problem

Product/design asks for complex navigation like Instagram:
- "Tab bar with per-tab navigation stacks"
- "Smooth coordinator pattern for all flows"
- "Deep linking to any screen"
- "Profile accessible from anywhere"

### Red Flags — Recognize Over-Engineering Pressure

If you hear ANY of these, **STOP and evaluate**:

- 🚩 **"Let's build a full coordinator layer before any views"** → Usually YAGNI
- 🚩 **"We need a navigation architecture that handles anything"** → Scope creep
- 🚩 **"Instagram/TikTok does it this way"** → They have 100+ engineers

### Time Cost Comparison

#### Option A: Over-Engineered Coordinator
- Time to build coordinator layer: 3-5 days
- Time to maintain and debug: Ongoing
- Time when requirements change: Significant refactor

#### Option B: Built-in Navigation + Simple Router
- Time to implement Pattern 4 (TabView + NavigationStack): 2-3 hours
- Time to add Router if needed: 1-2 hours
- Time when requirements change: Incremental additions

### How to Push Back Professionally

#### Step 1: Quantify Current Needs
```
"Let's list our actual navigation flows:
1. Home → Item Detail
2. Search → Results → Item Detail
3. Profile → Settings

That's 6 destinations. NavigationPath handles this natively."
```

#### Step 2: Show the Built-in Solution
```
"Here's our navigation with NavigationStack + NavigationPath:
[Show Pattern 1b code]

This gives us:
- Programmatic navigation ✓
- Deep linking ✓
- State restoration ✓
- Type safety ✓

Without a coordinator layer."
```

#### Step 3: Offer Incremental Path
```
"If we find NavigationPath insufficient, we can add a Router
(Pattern 7) later. It's 30-45 minutes of work.

But let's start with the simpler solution and add complexity
only when we hit a real limitation."
```

### Real-World Example: 48-Hour Feature Push

**Scenario:**
- PM: "We need deep linking for the campaign launch in 2 days"
- Lead: "Let's build a proper coordinator first"
- Time available: 16 working hours

**Wrong approach:**
- 8 hours: Build coordinator infrastructure
- 4 hours: Debug coordinator edge cases
- 4 hours: Rush deep linking on broken foundation
- Result: Buggy, deadline missed

**Correct approach:**
- 2 hours: Implement Pattern 1b (NavigationStack with deep linking)
- 1 hour: Test all deep link URLs
- 1 hour: Add SceneStorage restoration (Pattern 6)
- Result: Working deep links in 4 hours, 12 hours for polish/testing

---

## Pressure Scenario: "NavigationView Backward Compatibility"

### The Problem

Team lead says: "Let's use NavigationView so we support iOS 15"

### Red Flags

- 🚩 NavigationView deprecated since iOS 16 (2022)
- 🚩 Different behavior across iOS versions causes bugs
- 🚩 No NavigationPath support — can't deep link properly

### Data to Share

```
iOS 16+ adoption: 95%+ of active devices (as of 2024)
iOS 15: < 5% and declining

NavigationView limitations:
- No programmatic path manipulation
- No type-safe navigation
- No built-in state restoration
- Behavior varies by iOS version
```

### Push-Back Script

```
"NavigationView was deprecated in iOS 16 (2022). Here's the impact:

1. We lose NavigationPath — can't implement deep linking reliably
2. Behavior differs between iOS 15 and 16 — more bugs to maintain
3. iOS 15 is < 5% of users — we're adding complexity for small audience

Recommendation: Set deployment target to iOS 16, use NavigationStack.
If iOS 15 support is required, use NavigationStack with @available
checks and fallback UI for older devices."
```

---

## Code Review Checklist

### Navigation Architecture
- [ ] Correct container for use case (Stack vs SplitView vs TabView)
- [ ] Value-based NavigationLink (not view-based)
- [ ] navigationDestination outside lazy containers
- [ ] Each tab has own NavigationStack (if tab-based)

### State Management
- [ ] NavigationPath in @State or @StateObject (not recreated in body)
- [ ] @MainActor isolation for navigation state (Swift 6)
- [ ] IDs stored for restoration (not full objects)
- [ ] Error handling for decode failures

### Deep Linking
- [ ] onOpenURL handler present
- [ ] Pop to root before building path
- [ ] Path built in correct order (parent → child)
- [ ] Missing data handled gracefully

### iOS 26+ Features
- [ ] No custom backgrounds interfering with Liquid Glass
- [ ] Bottom-aligned search working on iPhone
- [ ] Tab bar minimization if appropriate

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Pattern |
|---------|--------------|---------|
| Navigation doesn't respond to taps | NavigationLink outside NavigationStack | Check hierarchy |
| Double navigation on tap | Button wrapping NavigationLink | Remove Button wrapper |
| State lost on tab switch | Shared NavigationStack across tabs | Pattern 4 |
| State lost on background | No SceneStorage | Pattern 6 |
| Deep link shows wrong screen | Path built in wrong order | Pattern 1b |
| Crash on restore | Force unwrap decode | Handle errors gracefully |

---

## Resources

**WWDC**: 2022-10054, 2024-10147, 2025-256, 2025-323

**Skills**: axiom-swiftui-nav-diag, axiom-swiftui-nav-ref

---

**Last Updated** Based on WWDC 2022-2025 navigation sessions
**Platforms** iOS 18+, iPadOS 18+, macOS 15+, watchOS 11+, tvOS 18+
