---
name: swiftui-nav-ref
description: Reference — Comprehensive SwiftUI navigation guide covering NavigationStack (iOS 16+), NavigationSplitView (iOS 16+), NavigationPath, deep linking, state restoration, Tab+Navigation integration (iOS 18+), Liquid Glass navigation (iOS 26+), and coordinator patterns
version: 1.0.0
skill_type: reference
apple_platforms: iOS 16+ (NavigationStack), iOS 18+ (Tab/Sidebar), iOS 26+ (Liquid Glass)
last_updated: 2025-12-05
---

# SwiftUI Navigation API Reference

## Overview

SwiftUI's navigation APIs provide data-driven, programmatic navigation that scales from simple stacks to complex multi-column layouts. Introduced in iOS 16 (2022) with NavigationStack and NavigationSplitView, evolved in iOS 18 (2024) with Tab/Sidebar unification, and refined in iOS 26 (2025) with Liquid Glass design.

#### Evolution timeline
- **2022 (iOS 16)** NavigationStack, NavigationSplitView, NavigationPath, value-based NavigationLink
- **2024 (iOS 18)** Tab/Sidebar unification, sidebarAdaptable style, zoom navigation transition
- **2025 (iOS 26)** Liquid Glass navigation chrome, bottom-aligned search, floating tab bars, backgroundExtensionEffect

#### Key capabilities
- **Data-driven navigation** NavigationPath represents stack state, enabling programmatic push/pop and deep linking
- **Multi-column layouts** NavigationSplitView adapts automatically (3-column on iPad → single stack on iPhone)
- **State restoration** Codable NavigationPath + SceneStorage for persistence across app launches
- **Tab integration** Per-tab NavigationStack with state preservation on tab switch (iOS 18+)
- **Liquid Glass** Automatic glass navigation bars, sidebars, and toolbars (iOS 26+)

#### When to use vs UIKit
- **SwiftUI navigation** New apps, multiplatform, simpler navigation flows → Use NavigationStack/SplitView
- **UINavigationController** Complex coordinator patterns, legacy code, specific UIKit features → Consider UIKit

#### Related Skills
- Use `swiftui-nav` for anti-patterns, decision trees, pressure scenarios
- Use `swiftui-nav-diag` for systematic troubleshooting of navigation issues

---

## When to Use This Skill

Use this skill when:
- **Learning navigation APIs** from NavigationStack to NavigationSplitView to NavigationPath
- **Implementing WWDC examples** (all 4 sessions with code examples included)
- **Planning deep linking** with URL routing and NavigationPath manipulation
- **Setting up state restoration** with Codable NavigationPath and SceneStorage
- **Adopting iOS 26+ features** Liquid Glass navigation, bottom-aligned search, tab bar minimization
- **Choosing navigation architecture** Stack vs SplitView vs Tab+Navigation patterns
- **Implementing coordinator/router patterns** alongside SwiftUI's built-in navigation

---

## API Evolution

### Timeline

| Year | iOS Version | Key Features |
|------|-------------|--------------|
| 2020 | iOS 14 | NavigationView (deprecated iOS 16) |
| 2022 | iOS 16 | NavigationStack, NavigationSplitView, NavigationPath, value-based NavigationLink |
| 2024 | iOS 18 | Tab/Sidebar unification, sidebarAdaptable, TabSection, zoom transitions |
| 2025 | iOS 26 | Liquid Glass navigation, backgroundExtensionEffect, tabBarMinimizeBehavior |

### NavigationView (Deprecated) vs NavigationStack/SplitView

| Feature | NavigationView (iOS 13-15) | NavigationStack/SplitView (iOS 16+) |
|---------|---------------------------|-------------------------------------|
| **Programmatic navigation** | Per-link `isActive` bindings | Single NavigationPath for entire stack |
| **Deep linking** | Complex, error-prone | Simple path manipulation |
| **Type safety** | View-based, runtime checks | Value-based, compile-time checks |
| **State restoration** | Manual, difficult | Built-in Codable support |
| **Multi-column** | NavigationStyle enum | Dedicated NavigationSplitView |
| **Status** | Deprecated iOS 16 | Current API |

#### Recommendation
- New apps: Use NavigationStack and NavigationSplitView exclusively
- Existing apps: Migrate from NavigationView (deprecated)
- See "Migrating to new navigation types" documentation

---

## NavigationStack Complete Reference

NavigationStack represents a push-pop interface like Settings on iPhone or System Settings on macOS.

### 1.1 Creating NavigationStack

#### Basic NavigationStack

```swift
NavigationStack {
    List(Category.allCases) { category in
        NavigationLink(category.name, value: category)
    }
    .navigationTitle("Categories")
    .navigationDestination(for: Category.self) { category in
        CategoryDetail(category: category)
    }
}
```

#### With Path Binding (WWDC 2022, 6:05)

```swift
struct PushableStack: View {
    @State private var path: [Recipe] = []
    @StateObject private var dataModel = DataModel()

    var body: some View {
        NavigationStack(path: $path) {
            List(Category.allCases) { category in
                Section(category.localizedName) {
                    ForEach(dataModel.recipes(in: category)) { recipe in
                        NavigationLink(recipe.name, value: recipe)
                    }
                }
            }
            .navigationTitle("Categories")
            .navigationDestination(for: Recipe.self) { recipe in
                RecipeDetail(recipe: recipe)
            }
        }
        .environmentObject(dataModel)
    }
}
```

**Key points:**
- `path: $path` binds the navigation state to a collection
- Value-presenting `NavigationLink` appends values to the path
- `navigationDestination(for:)` maps values to views

### 1.2 NavigationLink (Value-Based)

#### Value-presenting NavigationLink

```swift
// Correct: Value-based (iOS 16+)
NavigationLink(recipe.name, value: recipe)

// Correct: With custom label
NavigationLink(value: recipe) {
    RecipeTile(recipe: recipe)
}

// Deprecated: View-based (iOS 13-15)
NavigationLink(recipe.name) {
    RecipeDetail(recipe: recipe)  // Don't use in new code
}
```

#### How NavigationLink works with NavigationStack

1. NavigationStack maintains a `path` collection
2. Tapping a value-presenting link appends the value to the path
3. NavigationStack maps `navigationDestination` modifiers over path values
4. Views are pushed onto the stack based on destination mappings

### 1.3 navigationDestination Modifier

#### Single Type

```swift
.navigationDestination(for: Recipe.self) { recipe in
    RecipeDetail(recipe: recipe)
}
```

#### Multiple Types

```swift
NavigationStack(path: $path) {
    RootView()
        .navigationDestination(for: Recipe.self) { recipe in
            RecipeDetail(recipe: recipe)
        }
        .navigationDestination(for: Category.self) { category in
            CategoryList(category: category)
        }
        .navigationDestination(for: Chef.self) { chef in
            ChefProfile(chef: chef)
        }
}
```

#### Placement rules
- Place `navigationDestination` outside lazy containers (not inside ForEach)
- Place near related NavigationLinks for code organization
- Must be inside NavigationStack hierarchy

```swift
// Correct: Outside lazy container
ScrollView {
    LazyVGrid(columns: columns) {
        ForEach(recipes) { recipe in
            NavigationLink(value: recipe) {
                RecipeTile(recipe: recipe)
            }
        }
    }
}
.navigationDestination(for: Recipe.self) { recipe in
    RecipeDetail(recipe: recipe)
}

// Wrong: Inside ForEach (may not be loaded)
ForEach(recipes) { recipe in
    NavigationLink(value: recipe) { RecipeTile(recipe: recipe) }
        .navigationDestination(for: Recipe.self) { r in  // Don't do this
            RecipeDetail(recipe: r)
        }
}
```

### 1.4 NavigationPath

NavigationPath is a type-erased collection for heterogeneous navigation stacks.

#### Typed Array vs NavigationPath

```swift
// Typed array: All values same type
@State private var path: [Recipe] = []

// NavigationPath: Mixed types
@State private var path = NavigationPath()
```

#### NavigationPath Operations

```swift
// Append value
path.append(recipe)

// Pop to previous
path.removeLast()

// Pop to root
path.removeLast(path.count)
// or
path = NavigationPath()

// Check count
if path.count > 0 { ... }

// Deep link: Set multiple values
path.append(category)
path.append(recipe)
```

#### Codable Support

```swift
// NavigationPath is Codable when all values are Codable
@State private var path = NavigationPath()

// Encode
let data = try JSONEncoder().encode(path.codable)

// Decode
let codableRep = try JSONDecoder().decode(NavigationPath.CodableRepresentation.self, from: data)
path = NavigationPath(codableRep)
```

---

## NavigationSplitView Complete Reference

NavigationSplitView creates multi-column layouts that adapt to device size.

### 2.1 Two-Column Layout

#### Basic Two-Column (WWDC 2022, 10:40)

```swift
struct MultipleColumns: View {
    @State private var selectedCategory: Category?
    @State private var selectedRecipe: Recipe?
    @StateObject private var dataModel = DataModel()

    var body: some View {
        NavigationSplitView {
            List(Category.allCases, selection: $selectedCategory) { category in
                NavigationLink(category.localizedName, value: category)
            }
            .navigationTitle("Categories")
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

### 2.2 Three-Column Layout

#### Three-Column with Content Column

```swift
NavigationSplitView {
    // Sidebar
    List(Category.allCases, selection: $selectedCategory) { category in
        NavigationLink(category.localizedName, value: category)
    }
    .navigationTitle("Categories")
} content: {
    // Content column
    List(dataModel.recipes(in: selectedCategory), selection: $selectedRecipe) { recipe in
        NavigationLink(recipe.name, value: recipe)
    }
    .navigationTitle(selectedCategory?.localizedName ?? "Recipes")
} detail: {
    // Detail column
    RecipeDetail(recipe: selectedRecipe)
}
```

### 2.3 NavigationSplitView with NavigationStack (WWDC 2022, 14:10)

Combine split view selection with stack-based drill-down:

```swift
struct MultipleColumnsWithStack: View {
    @State private var selectedCategory: Category?
    @State private var path: [Recipe] = []
    @StateObject private var dataModel = DataModel()

    var body: some View {
        NavigationSplitView {
            List(Category.allCases, selection: $selectedCategory) { category in
                NavigationLink(category.localizedName, value: category)
            }
            .navigationTitle("Categories")
        } detail: {
            NavigationStack(path: $path) {
                RecipeGrid(category: selectedCategory)
                    .navigationDestination(for: Recipe.self) { recipe in
                        RecipeDetail(recipe: recipe)
                    }
            }
        }
        .environmentObject(dataModel)
    }
}
```

**Key pattern:** NavigationStack inside NavigationSplitView detail column enables grid-to-detail drill-down while preserving sidebar selection.

### 2.4 Column Visibility

```swift
@State private var columnVisibility: NavigationSplitViewVisibility = .all

NavigationSplitView(columnVisibility: $columnVisibility) {
    Sidebar()
} content: {
    Content()
} detail: {
    Detail()
}

// Programmatically control visibility
columnVisibility = .detailOnly  // Hide sidebar and content
columnVisibility = .all          // Show all columns
columnVisibility = .automatic    // System decides
```

### 2.5 Automatic Adaptation

NavigationSplitView automatically adapts:
- **iPad landscape** All columns visible (depending on configuration)
- **iPad portrait/Slide Over** Collapses to overlay or single column
- **iPhone** Single navigation stack
- **Apple Watch/TV** Single navigation stack

Selection changes automatically translate to push/pop on iPhone.

### 2.6 iOS 26+ Liquid Glass Sidebar (WWDC 2025, 323)

```swift
NavigationSplitView {
    List { ... }
} detail: {
    DetailView()
}
// Sidebar automatically gets Liquid Glass appearance on iPad/macOS

// Extend content behind glass sidebar
.backgroundExtensionEffect()  // Mirrors and blurs content outside safe area
```

---

## Deep Linking and URL Routing

### 3.1 Basic Deep Link Handling

```swift
struct ContentView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HomeView()
                .navigationDestination(for: Recipe.self) { recipe in
                    RecipeDetail(recipe: recipe)
                }
                .navigationDestination(for: Category.self) { category in
                    CategoryView(category: category)
                }
        }
        .onOpenURL { url in
            handleDeepLink(url)
        }
    }

    func handleDeepLink(_ url: URL) {
        // Parse URL: myapp://recipe/apple-pie
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let host = components.host else { return }

        switch host {
        case "recipe":
            if let recipeName = components.path.dropFirst().description,
               let recipe = dataModel.recipe(named: recipeName) {
                path.removeLast(path.count)  // Pop to root
                path.append(recipe)           // Push recipe
            }
        case "category":
            if let categoryName = components.path.dropFirst().description,
               let category = Category(rawValue: categoryName) {
                path.removeLast(path.count)
                path.append(category)
            }
        default:
            break
        }
    }
}
```

### 3.2 Multi-Step Deep Links

```swift
// URL: myapp://category/desserts/recipe/apple-pie
func handleDeepLink(_ url: URL) {
    let pathComponents = url.pathComponents.filter { $0 != "/" }

    path.removeLast(path.count)  // Reset to root

    var index = 0
    while index < pathComponents.count {
        let component = pathComponents[index]

        switch component {
        case "category":
            if index + 1 < pathComponents.count,
               let category = Category(rawValue: pathComponents[index + 1]) {
                path.append(category)
                index += 2
            }
        case "recipe":
            if index + 1 < pathComponents.count,
               let recipe = dataModel.recipe(named: pathComponents[index + 1]) {
                path.append(recipe)
                index += 2
            }
        default:
            index += 1
        }
    }
}
```

---

## State Restoration

### 4.1 Complete State Restoration (WWDC 2022, 18:12)

```swift
struct UseSceneStorage: View {
    @StateObject private var navModel = NavigationModel()
    @SceneStorage("navigation") private var data: Data?
    @StateObject private var dataModel = DataModel()

    var body: some View {
        NavigationSplitView {
            List(Category.allCases, selection: $navModel.selectedCategory) { category in
                NavigationLink(category.localizedName, value: category)
            }
            .navigationTitle("Categories")
        } detail: {
            NavigationStack(path: $navModel.recipePath) {
                RecipeGrid(category: navModel.selectedCategory)
            }
        }
        .task {
            // Restore on appear
            if let data = data {
                navModel.jsonData = data
            }
            // Save on changes
            for await _ in navModel.objectWillChangeSequence {
                data = navModel.jsonData
            }
        }
        .environmentObject(dataModel)
    }
}
```

### 4.2 Codable NavigationModel

```swift
class NavigationModel: ObservableObject, Codable {
    @Published var selectedCategory: Category?
    @Published var recipePath: [Recipe] = []

    enum CodingKeys: String, CodingKey {
        case selectedCategory
        case recipePathIds  // Store IDs, not full objects
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(selectedCategory, forKey: .selectedCategory)
        try container.encode(recipePath.map(\.id), forKey: .recipePathIds)
    }

    init() {}

    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.selectedCategory = try container.decodeIfPresent(Category.self, forKey: .selectedCategory)

        // Convert IDs back to objects, discarding deleted items
        let recipePathIds = try container.decode([Recipe.ID].self, forKey: .recipePathIds)
        self.recipePath = recipePathIds.compactMap { DataModel.shared[$0] }
    }

    var jsonData: Data? {
        get { try? JSONEncoder().encode(self) }
        set {
            guard let data = newValue,
                  let model = try? JSONDecoder().decode(NavigationModel.self, from: data)
            else { return }
            self.selectedCategory = model.selectedCategory
            self.recipePath = model.recipePath
        }
    }

    var objectWillChangeSequence: AsyncPublisher<Publishers.Buffer<ObservableObjectPublisher>> {
        objectWillChange
            .buffer(size: 1, prefetch: .byRequest, whenFull: .dropOldest)
            .values
    }
}
```

**Key pattern:** Store IDs, not full model objects. Use `compactMap` to handle deleted items gracefully.

---

## Tab + Navigation Integration

### 5.1 Tab Syntax (iOS 18+) (WWDC 2024, 4:27)

```swift
TabView {
    Tab("Watch Now", systemImage: "play") {
        WatchNowView()
    }
    Tab("Library", systemImage: "books.vertical") {
        LibraryView()
    }
    Tab(role: .search) {
        SearchView()
    }
}
```

### 5.2 TabView with NavigationStack Per Tab

```swift
TabView {
    Tab("Home", systemImage: "house") {
        NavigationStack {
            HomeView()
                .navigationDestination(for: Item.self) { item in
                    ItemDetail(item: item)
                }
        }
    }
    Tab("Settings", systemImage: "gear") {
        NavigationStack {
            SettingsView()
        }
    }
}
```

**Key pattern:** Each tab has its own NavigationStack to preserve navigation state when switching tabs.

### 5.3 Sidebar-Adaptable TabView (WWDC 2024, 6:41)

```swift
TabView {
    Tab("Watch Now", systemImage: "play") {
        WatchNowView()
    }
    Tab("Library", systemImage: "books.vertical") {
        LibraryView()
    }
    TabSection("Collections") {
        Tab("Cinematic Shots", systemImage: "list.and.film") {
            CinematicShotsView()
        }
        Tab("Forest Life", systemImage: "list.and.film") {
            ForestLifeView()
        }
    }
    TabSection("Animations") {
        // More tabs...
    }
    Tab(role: .search) {
        SearchView()
    }
}
.tabViewStyle(.sidebarAdaptable)
```

**Key features:**
- `TabSection` creates groups visible in sidebar
- `.sidebarAdaptable` enables sidebar on iPad, tab bar on iPhone
- Search tab with `.search` role gets special placement

### 5.4 Tab Customization (WWDC 2024, 10:45)

```swift
@AppStorage("MyTabViewCustomization")
private var customization: TabViewCustomization

TabView {
    Tab("Watch Now", systemImage: "play", value: .watchNow) {
        WatchNowView()
    }
    .customizationID("Tab.watchNow")
    .customizationBehavior(.disabled, for: .sidebar, .tabBar)  // Can't be hidden

    Tab("Optional Tab", systemImage: "star", value: .optional) {
        OptionalView()
    }
    .customizationID("Tab.optional")
    .defaultVisibility(.hidden, for: .tabBar)  // Hidden by default
}
.tabViewCustomization($customization)
```

### 5.5 Programmatic Tab Visibility

Use `.hidden(_:)` to show/hide tabs based on app state while preserving their navigation state.

#### State-Driven Tab Visibility

```swift
enum AppContext { case home, browse }

struct ContentView: View {
    @State private var context: AppContext = .home
    @State private var selection: TabID = .home

    var body: some View {
        TabView(selection: $selection) {
            Tab("Home", systemImage: "house") {
                HomeView()
            }
            .tag(TabID.home)

            Tab("Libraries", systemImage: "square.stack") {
                LibrariesView()
            }
            .tag(TabID.libraries)
            .hidden(context == .browse)  // Hide in browse context

            Tab("Playlists", systemImage: "music.note.list") {
                PlaylistsView()
            }
            .tag(TabID.playlists)
            .hidden(context == .browse)

            Tab("Tracks", systemImage: "music.note") {
                TracksView()
            }
            .tag(TabID.tracks)
            .hidden(context == .home)    // Hide in home context
        }
        .tabViewStyle(.sidebarAdaptable)
    }
}
```

#### State Preservation

**Key difference**: `.hidden(_:)` preserves tab state, conditional rendering does not.

```swift
// ✅ State preserved when hidden
Tab("Settings", systemImage: "gear") {
    SettingsView()  // Navigation stack preserved
}
.hidden(!showSettings)

// ❌ State lost when condition changes
if showSettings {
    Tab("Settings", systemImage: "gear") {
        SettingsView()  // Navigation stack recreated
    }
}
```

#### Common Patterns

**Feature Flags**
```swift
Tab("Beta Features", systemImage: "flask") {
    BetaView()
}
.hidden(!UserDefaults.standard.bool(forKey: "enableBetaFeatures"))
```

**Authentication State**
```swift
Tab("Profile", systemImage: "person.circle") {
    ProfileView()
}
.hidden(!authManager.isAuthenticated)
```

**Purchase Status**
```swift
Tab("Pro Features", systemImage: "star.circle.fill") {
    ProFeaturesView()
}
.hidden(!purchaseManager.isPro)
```

**Development Builds**
```swift
Tab("Debug", systemImage: "hammer") {
    DebugView()
}
.hidden(!isDevelopmentBuild)

private var isDevelopmentBuild: Bool {
    #if DEBUG
    return true
    #else
    return false
    #endif
}
```

#### Animated Transitions

Wrap state changes in `withAnimation` for smooth tab bar layout transitions:

```swift
Button("Switch to Browse") {
    withAnimation {
        context = .browse
        selection = .tracks  // Switch to first visible tab
    }
}
// Tab bar animates as tabs appear/disappear
// Uses system motion curves automatically
```

### 5.6 iOS 26+ Tab Features (WWDC 2025, 256)

```swift
// Tab bar minimization on scroll
TabView { ... }
    .tabBarMinimizeBehavior(.onScrollDown)

// Bottom accessory view (always visible)
TabView { ... }
    .tabViewBottomAccessory {
        PlaybackControls()
    }

// Dynamic visibility (recommended for mini-players)
TabView { ... }
    .tabViewBottomAccessory(isEnabled: showMiniPlayer) {
        MiniPlayerView()
            .transition(.opacity)
    }
// isEnabled: true = shows accessory
// isEnabled: false = hides AND removes reserved space

// Search tab with dedicated search field
Tab(role: .search) {
    SearchView()
}
// Morphs into search field when selected
```

### 5.7 Tab API Quick Reference

| Modifier | Target | iOS | Purpose |
|----------|--------|-----|---------|
| `Tab(_:systemImage:value:content:)` | — | 18+ | New tab syntax with selection value |
| `Tab(role: .search)` | — | 18+ | Semantic search tab with morph behavior |
| `TabSection(_:content:)` | — | 18+ | Group tabs in sidebar view |
| `.customizationID(_:)` | Tab | 18+ | Enable user customization |
| `.customizationBehavior(_:for:)` | Tab | 18+ | Control hide/reorder permissions |
| `.defaultVisibility(_:for:)` | Tab | 18+ | Set initial visibility state |
| `.hidden(_:)` | Tab | 18+ | Programmatic visibility with state preservation |
| `.tabViewStyle(.sidebarAdaptable)` | TabView | 18+ | Sidebar on iPad, tabs on iPhone |
| `.tabViewCustomization($binding)` | TabView | 18+ | Persist user tab arrangement |
| `.tabBarMinimizeBehavior(_:)` | TabView | 26+ | Auto-hide on scroll |
| `.tabViewBottomAccessory(isEnabled:content:)` | TabView | 26+ | Dynamic content below tab bar |

---

## iOS 26+ Navigation Features

### 6.1 Liquid Glass Navigation (WWDC 2025, 323)

Automatic adoption when building with Xcode 26:
- Navigation bars become Liquid Glass
- Sidebars float above content with glass effect
- Tab bars float with new compact appearance
- Toolbars get automatic grouping

### 6.2 Background Extension Effect

```swift
NavigationSplitView {
    Sidebar()
} detail: {
    HeroImage()
        .backgroundExtensionEffect()  // Content extends behind sidebar
}
```

### 6.3 Bottom-Aligned Search (WWDC 2025, 256)

```swift
NavigationSplitView {
    Sidebar()
} detail: {
    DetailView()
}
.searchable(text: $query, prompt: "What are you looking for?")
// Automatically bottom-aligned on iPhone, top-trailing on iPad
```

### 6.4 Scroll Edge Effect

```swift
// Automatic blur effect when content scrolls under toolbar
// Remove any custom darkening backgrounds - they interfere

// For dense UIs, adjust sharpness
ScrollView { ... }
    .scrollEdgeEffectStyle(.soft)  // .sharp, .soft
```

### 6.5 Tab Bar Minimization

```swift
TabView {
    Tab("Home", systemImage: "house") {
        NavigationStack {
            ScrollView {
                // Content
            }
        }
    }
}
.tabBarMinimizeBehavior(.onScrollDown)  // Minimizes on scroll
```

### 6.6 Sheet Presentations with Zoom Transition

```swift
// Sheet morphs out of presenting button
.toolbar {
    ToolbarItem {
        Button("Settings") { showSettings = true }
            .matchedTransitionSource(id: "settings", in: namespace)
    }
}
.sheet(isPresented: $showSettings) {
    SettingsView()
        .navigationTransition(.zoom(sourceID: "settings", in: namespace))
}
```

---

## Router/Coordinator Patterns

### 7.1 When to Use Coordinators

**Use coordinators when:**
- Navigation logic is complex with conditional flows
- Testing navigation in isolation
- Sharing navigation logic across multiple screens
- UIKit interop with heavy navigation requirements

**Use built-in navigation when:**
- Simple linear or hierarchical navigation
- State restoration is primary concern
- Fewer than 5-10 navigation destinations
- No need for navigation unit testing

### 7.2 Simple Router Pattern

```swift
// Route enum defines all possible destinations
enum AppRoute: Hashable {
    case home
    case category(Category)
    case recipe(Recipe)
    case settings
}

// Router class manages navigation
@Observable
class Router {
    var path = NavigationPath()

    func navigate(to route: AppRoute) {
        path.append(route)
    }

    func popToRoot() {
        path.removeLast(path.count)
    }

    func pop() {
        if !path.isEmpty {
            path.removeLast()
        }
    }
}

// Usage in views
struct ContentView: View {
    @State private var router = Router()

    var body: some View {
        NavigationStack(path: $router.path) {
            HomeView()
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .home:
                        HomeView()
                    case .category(let category):
                        CategoryView(category: category)
                    case .recipe(let recipe):
                        RecipeDetail(recipe: recipe)
                    case .settings:
                        SettingsView()
                    }
                }
        }
        .environment(router)
    }
}

// In child views
struct RecipeCard: View {
    let recipe: Recipe
    @Environment(Router.self) private var router

    var body: some View {
        Button(recipe.name) {
            router.navigate(to: .recipe(recipe))
        }
    }
}
```

### 7.3 Coordinator Pattern with Protocol

```swift
protocol Coordinator {
    associatedtype Route: Hashable
    var path: NavigationPath { get set }
    func navigate(to route: Route)
}

@Observable
class RecipeCoordinator: Coordinator {
    typealias Route = RecipeRoute
    var path = NavigationPath()

    enum RecipeRoute: Hashable {
        case list(Category)
        case detail(Recipe)
        case edit(Recipe)
        case relatedRecipes(Recipe)
    }

    func navigate(to route: RecipeRoute) {
        path.append(route)
    }

    func showRecipeOfTheDay() {
        path.removeLast(path.count)
        if let recipe = DataModel.shared.recipeOfTheDay {
            path.append(RecipeRoute.detail(recipe))
        }
    }
}
```

### 7.4 Testing Navigation

```swift
// Router is easily testable
func testNavigateToRecipe() {
    let router = Router()
    let recipe = Recipe(name: "Apple Pie")

    router.navigate(to: .recipe(recipe))

    XCTAssertEqual(router.path.count, 1)
}

func testPopToRoot() {
    let router = Router()
    router.navigate(to: .category(.desserts))
    router.navigate(to: .recipe(Recipe(name: "Apple Pie")))

    router.popToRoot()

    XCTAssertTrue(router.path.isEmpty)
}
```

---

## Testing Checklist

### Navigation Flow Testing
- [ ] All NavigationLinks navigate to correct destination
- [ ] Back button returns to previous view
- [ ] Pop to root clears entire stack
- [ ] Deep links navigate correctly from cold start
- [ ] Deep links navigate correctly when app is running

### State Restoration Testing
- [ ] Navigation state persists when app backgrounds
- [ ] Navigation state restores on app launch
- [ ] Deleted items handled gracefully (compactMap)
- [ ] SceneStorage key is unique per scene

### Multi-Platform Testing
- [ ] NavigationSplitView collapses correctly on iPhone
- [ ] Selection in sidebar pushes on iPhone
- [ ] Tab bar visible and functional on all platforms
- [ ] Sidebar toggle works on iPad

### iOS 26+ Testing
- [ ] Liquid Glass appearance correct
- [ ] Bottom-aligned search on iPhone
- [ ] Tab bar minimization works
- [ ] Scroll edge effect not interfering with custom backgrounds

---

## API Quick Reference

### NavigationStack

```swift
NavigationStack { content }
NavigationStack(path: $path) { content }
```

### NavigationSplitView

```swift
NavigationSplitView { sidebar } detail: { detail }
NavigationSplitView { sidebar } content: { content } detail: { detail }
NavigationSplitView(columnVisibility: $visibility) { ... }
```

### NavigationLink

```swift
NavigationLink(title, value: value)
NavigationLink(value: value) { label }
```

### NavigationPath

```swift
path.append(value)
path.removeLast()
path.removeLast(path.count)
path.count
path.codable  // For encoding
NavigationPath(codableRepresentation)  // For decoding
```

### Modifiers

```swift
.navigationTitle("Title")
.navigationDestination(for: Type.self) { value in View }
.searchable(text: $query)
.tabViewStyle(.sidebarAdaptable)
.tabBarMinimizeBehavior(.onScrollDown)
.backgroundExtensionEffect()
```

---

## Resources

**WWDC**: 2022-10054, 2024-10147, 2025-256, 2025-323

**Skills**: swiftui-nav, swiftui-nav-diag, swiftui-26-ref, liquid-glass

---

**Last Updated** Based on WWDC 2022-10054, WWDC 2024-10147, WWDC 2025-256, WWDC 2025-323
**Platforms** iOS 16+, iPadOS 16+, macOS 13+, watchOS 9+, tvOS 16+
