---
name: axiom-swiftui-search-ref
description: Use when implementing SwiftUI search — .searchable, isSearching, search suggestions, scopes, tokens, programmatic search control (iOS 15-18). For iOS 26 search refinements (bottom-aligned, minimized toolbar, search tab role), see swiftui-26-ref.
license: MIT
metadata:
  version: "1.0.0"
---

# SwiftUI Search API Reference

## Overview

SwiftUI search is **environment-based and navigation-consumed**. You attach `.searchable()` to a view, but a *navigation container* (NavigationStack, NavigationSplitView, or TabView) renders the actual search field. This indirection is the source of most search bugs.

#### API Evolution

| iOS | Key Additions |
|-----|---------------|
| 15 | `.searchable(text:)`, `isSearching`, `dismissSearch`, suggestions, `.searchCompletion()`, `onSubmit(of: .search)` |
| 16 | Search scopes (`.searchScopes`), search tokens (`.searchable(text:tokens:)`), `SearchScopeActivation` |
| 16.4 | Search scope `activation` parameter (`.onTextEntry`, `.onSearchPresentation`) |
| 17 | `isPresented` parameter, `suggestedTokens` parameter |
| 17.1 | `.searchPresentationToolbarBehavior(.avoidHidingContent)` |
| 18 | `.searchFocused($isFocused)` for programmatic focus control |
| 26 | Bottom-aligned search, `.searchToolbarBehavior(.minimize)`, `Tab(role: .search)`, `DefaultToolbarItem(kind: .search)` — see `axiom-swiftui-26-ref` |

## When to Use This Skill

- Adding search to a SwiftUI list or collection
- Implementing filter-as-you-type or submit-based search
- Adding search suggestions with auto-completion
- Using search scopes to narrow results by category
- Using search tokens for structured queries
- Controlling search focus programmatically
- Debugging "search field doesn't appear" issues

For iOS 26 search features (bottom-aligned, minimized toolbar, search tab role), see `axiom-swiftui-26-ref`.

---

## Part 1: The searchable Modifier

### Core API

```swift
.searchable(
    text: Binding<String>,
    placement: SearchFieldPlacement = .automatic,
    prompt: LocalizedStringKey
)
```

**Availability**: iOS 15+, macOS 12+, tvOS 15+, watchOS 8+

### How It Works

1. You attach `.searchable(text: $query)` to a view
2. The **nearest navigation container** (NavigationStack, NavigationSplitView) renders the search field
3. The view receives `isSearching` and `dismissSearch` through the environment
4. Your view filters or queries based on the bound text

```swift
struct RecipeListView: View {
    @State private var searchText = ""
    let recipes: [Recipe]

    var body: some View {
        NavigationStack {
            List(filteredRecipes) { recipe in
                NavigationLink(recipe.name, value: recipe)
            }
            .navigationTitle("Recipes")
            .searchable(text: $searchText, prompt: "Find a recipe")
        }
    }

    var filteredRecipes: [Recipe] {
        if searchText.isEmpty { return recipes }
        return recipes.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }
}
```

### Placement Options

| Placement | Behavior |
|-----------|----------|
| `.automatic` | System decides (recommended) |
| `.navigationBarDrawer` | Below navigation bar title (iOS) |
| `.navigationBarDrawer(displayMode: .always)` | Always visible, not hidden on scroll |
| `.sidebar` | In the sidebar column (NavigationSplitView) |
| `.toolbar` | In the toolbar area |
| `.toolbarPrincipal` | In toolbar's principal section |

**Gotcha**: SwiftUI may ignore your placement preference if the view hierarchy doesn't support it. Always test on the target platform.

### Column Association in NavigationSplitView

Where you attach `.searchable` determines which column displays the search field:

```swift
NavigationSplitView {
    SidebarView()
        .searchable(text: $query)  // Search in sidebar
} detail: {
    DetailView()
}

// vs.

NavigationSplitView {
    SidebarView()
} detail: {
    DetailView()
        .searchable(text: $query)  // Search in detail
}

// vs.

NavigationSplitView {
    SidebarView()
} detail: {
    DetailView()
}
.searchable(text: $query)  // System decides column
```

---

## Part 2: Displaying Search Results

### isSearching Environment

```swift
@Environment(\.isSearching) private var isSearching
```

**Availability**: iOS 15+

Becomes `true` when the user activates search (taps the field), `false` when they cancel or you call `dismissSearch`.

**Critical rule**: `isSearching` must be read from a **child** of the view that has `.searchable`. SwiftUI sets the value in the searchable view's environment and does not propagate it upward.

```swift
// Pattern: Overlay search results when searching
struct WeatherCityList: View {
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            // SearchResultsOverlay reads isSearching
            SearchResultsOverlay(searchText: searchText) {
                List(favoriteCities) { city in
                    CityRow(city: city)
                }
            }
            .searchable(text: $searchText)
            .navigationTitle("Weather")
        }
    }
}

struct SearchResultsOverlay<Content: View>: View {
    let searchText: String
    @ViewBuilder let content: Content
    @Environment(\.isSearching) private var isSearching

    var body: some View {
        if isSearching {
            // Show search results
            SearchResults(query: searchText)
        } else {
            content
        }
    }
}
```

### dismissSearch Environment

```swift
@Environment(\.dismissSearch) private var dismissSearch
```

**Availability**: iOS 15+

Calling `dismissSearch()` clears the search text, removes focus, and sets `isSearching` to `false`. Must be called from inside the searchable view hierarchy.

```swift
struct SearchResults: View {
    @Environment(\.dismissSearch) private var dismissSearch

    var body: some View {
        List(results) { result in
            Button(result.name) {
                selectResult(result)
                dismissSearch()  // Close search after selection
            }
        }
    }
}
```

---

## Part 3: Search Suggestions

### Adding Suggestions

Pass a `suggestions` closure to `.searchable`:

```swift
.searchable(text: $searchText) {
    ForEach(suggestedResults) { suggestion in
        Text(suggestion.name)
            .searchCompletion(suggestion.name)
    }
}
```

**Availability**: iOS 15+

Suggestions appear in a list below the search field when the user is typing.

### searchCompletion Modifier

`.searchCompletion(_:)` binds a suggestion to a completion value. When the user taps the suggestion, the search text is replaced with the completion value.

```swift
.searchable(text: $searchText) {
    ForEach(matchingColors) { color in
        HStack {
            Circle()
                .fill(color.value)
                .frame(width: 16, height: 16)
            Text(color.name)
        }
        .searchCompletion(color.name)  // Tapping fills search with color name
    }
}
```

**Without `.searchCompletion()`**: Suggestions display but tapping them does nothing to the search field. This is the most common suggestions bug.

### Complete Suggestion Pattern

```swift
struct ColorSearchView: View {
    @State private var searchText = ""
    let allColors: [NamedColor]

    var body: some View {
        NavigationStack {
            List(filteredColors) { color in
                ColorRow(color: color)
            }
            .navigationTitle("Colors")
            .searchable(text: $searchText, prompt: "Search colors") {
                ForEach(suggestedColors) { color in
                    Label(color.name, systemImage: "paintpalette")
                        .searchCompletion(color.name)
                }
            }
        }
    }

    var suggestedColors: [NamedColor] {
        guard !searchText.isEmpty else { return [] }
        return allColors.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
        .prefix(5)
        .map { $0 }  // Convert ArraySlice to Array
    }

    var filteredColors: [NamedColor] {
        if searchText.isEmpty { return allColors }
        return allColors.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }
}
```

---

## Part 4: Search Submission

### onSubmit(of: .search)

Triggers when the user presses Return/Enter in the search field:

```swift
.searchable(text: $searchText)
.onSubmit(of: .search) {
    performSearch(searchText)
}
```

**Availability**: iOS 15+

### Filter vs Submit Decision

| Pattern | Use When | Example |
|---------|----------|---------|
| Filter-as-you-type | Local data, fast filtering | Contacts, settings |
| Submit-based search | Network requests, expensive queries | App Store, web search |
| Combined | Suggestions filter locally, submit triggers server | Maps, shopping |

### Combined Suggestions + Submit Pattern

```swift
struct StoreSearchView: View {
    @State private var searchText = ""
    @State private var searchResults: [Product] = []
    let recentSearches: [String]

    var body: some View {
        NavigationStack {
            List(searchResults) { product in
                ProductRow(product: product)
            }
            .navigationTitle("Store")
            .searchable(text: $searchText, prompt: "Search products") {
                // Local suggestions from recent searches
                ForEach(matchingRecent, id: \.self) { term in
                    Label(term, systemImage: "clock")
                        .searchCompletion(term)
                }
            }
            .onSubmit(of: .search) {
                // Server search on submit
                Task {
                    searchResults = await ProductAPI.search(searchText)
                }
            }
        }
    }

    var matchingRecent: [String] {
        guard !searchText.isEmpty else { return recentSearches }
        return recentSearches.filter {
            $0.localizedCaseInsensitiveContains(searchText)
        }
    }
}
```

---

## Part 5: Search Scopes (iOS 16+)

### Adding Scopes

Scopes add a segmented picker below the search field for narrowing results by category:

```swift
enum SearchScope: String, CaseIterable {
    case all = "All"
    case recipes = "Recipes"
    case ingredients = "Ingredients"
}

struct ScopedSearchView: View {
    @State private var searchText = ""
    @State private var searchScope: SearchScope = .all

    var body: some View {
        NavigationStack {
            List(filteredResults) { result in
                ResultRow(result: result)
            }
            .navigationTitle("Cookbook")
            .searchable(text: $searchText)
            .searchScopes($searchScope) {
                ForEach(SearchScope.allCases, id: \.self) { scope in
                    Text(scope.rawValue).tag(scope)
                }
            }
        }
    }
}
```

**Availability**: iOS 16+, macOS 13+

### Scope Activation (iOS 16.4+)

Control when scopes appear:

```swift
.searchScopes($searchScope, activation: .onTextEntry) {
    // Scopes appear only when user starts typing
    ForEach(SearchScope.allCases, id: \.self) { scope in
        Text(scope.rawValue).tag(scope)
    }
}
```

| Activation | Behavior |
|------------|----------|
| `.automatic` | System default |
| `.onTextEntry` | Scopes appear when user types text |
| `.onSearchPresentation` | Scopes appear when search is activated |

**Platform differences**:
- **iOS/iPadOS**: Scopes appear on text entry by default, dismiss on cancel
- **macOS**: Scopes appear when search is presented, dismiss on cancel

---

## Part 6: Search Tokens (iOS 16+)

Tokens are structured search elements that appear as "pills" in the search field alongside free text.

### Basic Tokens

```swift
enum RecipeToken: Identifiable, Hashable {
    case cuisine(String)
    case difficulty(String)

    var id: Self { self }
}

struct TokenSearchView: View {
    @State private var searchText = ""
    @State private var tokens: [RecipeToken] = []

    var body: some View {
        NavigationStack {
            List(filteredRecipes) { recipe in
                RecipeRow(recipe: recipe)
            }
            .navigationTitle("Recipes")
            .searchable(text: $searchText, tokens: $tokens) { token in
                switch token {
                case .cuisine(let name):
                    Label(name, systemImage: "globe")
                case .difficulty(let name):
                    Label(name, systemImage: "star")
                }
            }
        }
    }
}
```

**Availability**: iOS 16+

**Token model requirements**: Each token element must conform to `Identifiable`.

### Suggested Tokens (iOS 17+)

```swift
.searchable(
    text: $searchText,
    tokens: $tokens,
    suggestedTokens: $suggestedTokens,
    prompt: "Search recipes"
) { token in
    Label(token.displayName, systemImage: token.icon)
}
```

**Availability**: iOS 17+ adds `suggestedTokens` and `isPresented` parameters.

### Combined Tokens + Text Filtering

```swift
var filteredRecipes: [Recipe] {
    var results = allRecipes

    // Apply token filters
    for token in tokens {
        switch token {
        case .cuisine(let cuisine):
            results = results.filter { $0.cuisine == cuisine }
        case .difficulty(let difficulty):
            results = results.filter { $0.difficulty == difficulty }
        }
    }

    // Apply text filter
    if !searchText.isEmpty {
        results = results.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    return results
}
```

---

## Part 7: Programmatic Search Control (iOS 18+)

### searchFocused

Bind a `FocusState<Bool>` to the search field to activate or dismiss search programmatically:

```swift
struct ProgrammaticSearchView: View {
    @State private var searchText = ""
    @FocusState private var isSearchFocused: Bool

    var body: some View {
        NavigationStack {
            VStack {
                Button("Start Search") {
                    isSearchFocused = true  // Activate search field
                }

                List(filteredItems) { item in
                    Text(item.name)
                }
            }
            .navigationTitle("Items")
            .searchable(text: $searchText)
            .searchFocused($isSearchFocused)
        }
    }
}
```

**Availability**: iOS 18+, macOS 15+, visionOS 2+

**Note**: For a non-boolean variant, use `.searchFocused(_:equals:)` to match specific focus values.

### Comparison with dismissSearch

| API | Direction | iOS |
|-----|-----------|-----|
| `dismissSearch` | Dismiss only | 15+ |
| `.searchFocused($bool)` | Activate or dismiss | 18+ |

Use `dismissSearch` if you only need to close search. Use `searchFocused` when you need to programmatically *open* search (e.g., a floating action button that opens search).

---

## Part 8: Platform Behavior

SwiftUI search adapts automatically per platform:

| Platform | Default Behavior |
|----------|-----------------|
| **iOS** | Search bar in navigation bar. Scrolls out of view by default; pull down to reveal. |
| **iPadOS** | Same as iOS in compact; may appear in toolbar in regular width. |
| **macOS** | Trailing toolbar search field. Always visible. |
| **watchOS** | Dictation-first input. Search bar at top of list. |
| **tvOS** | Tab-based search with on-screen keyboard. |

### iOS-Specific Behavior

```swift
// Always-visible search field (doesn't scroll away)
.searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always))

// Default: search field scrolls out, pull down to reveal
.searchable(text: $searchText)
```

### macOS-Specific Behavior

```swift
// Search in toolbar (default on macOS)
.searchable(text: $searchText, placement: .toolbar)

// Search in sidebar
.searchable(text: $searchText, placement: .sidebar)
```

---

## Part 9: Common Gotchas

### 1. Search Field Doesn't Appear

**Cause**: `.searchable` is not inside a navigation container.

```swift
// WRONG: No navigation container
List { ... }
    .searchable(text: $query)

// CORRECT: Inside NavigationStack
NavigationStack {
    List { ... }
        .searchable(text: $query)
}
```

### 2. isSearching Always Returns false

**Cause**: Reading `isSearching` from the wrong view level.

```swift
// WRONG: Reading from parent of searchable view
struct ParentView: View {
    @Environment(\.isSearching) var isSearching  // Always false
    @State private var query = ""

    var body: some View {
        NavigationStack {
            ChildView(isSearching: isSearching)
                .searchable(text: $query)
        }
    }
}

// CORRECT: Reading from child view
struct ChildView: View {
    @Environment(\.isSearching) var isSearching  // Works

    var body: some View {
        if isSearching {
            SearchResults()
        } else {
            DefaultContent()
        }
    }
}
```

### 3. Suggestions Don't Fill Search Field

**Cause**: Missing `.searchCompletion()` on suggestion views.

```swift
// WRONG: No searchCompletion
.searchable(text: $query) {
    ForEach(suggestions) { s in
        Text(s.name)  // Displays but tapping does nothing
    }
}

// CORRECT: With searchCompletion
.searchable(text: $query) {
    ForEach(suggestions) { s in
        Text(s.name)
            .searchCompletion(s.name)  // Fills search field on tap
    }
}
```

### 4. Placement on Wrong Navigation Level

**Cause**: Attaching `.searchable` to the wrong column in NavigationSplitView.

```swift
// Might not appear where expected
NavigationSplitView {
    SidebarView()
} detail: {
    DetailView()
}
.searchable(text: $query)  // System chooses column

// Explicit placement
NavigationSplitView {
    SidebarView()
        .searchable(text: $query, placement: .sidebar)  // In sidebar
} detail: {
    DetailView()
}
```

### 5. Search Scopes Don't Appear

**Cause**: Scopes require `.searchable` on the same view. They also require a navigation container.

```swift
// WRONG: Scopes without searchable
List { ... }
    .searchScopes($scope) { ... }

// CORRECT: Scopes alongside searchable
List { ... }
    .searchable(text: $query)
    .searchScopes($scope) {
        Text("All").tag(Scope.all)
        Text("Recent").tag(Scope.recent)
    }
```

### 6. iOS 26 Refinements

For bottom-aligned search, `.searchToolbarBehavior(.minimize)`, `Tab(role: .search)`, and `DefaultToolbarItem(kind: .search)`, see `axiom-swiftui-26-ref`. These build on the foundational APIs documented here.

---

## Part 10: API Quick Reference

### Modifiers

| Modifier | iOS | Purpose |
|----------|-----|---------|
| `.searchable(text:placement:prompt:)` | 15+ | Add search field |
| `.searchable(text:tokens:token:)` | 16+ | Search with tokens |
| `.searchable(text:tokens:suggestedTokens:isPresented:token:)` | 17+ | Tokens + suggested tokens + presentation control |
| `.searchCompletion(_:)` | 15+ | Auto-fill search on suggestion tap |
| `.searchScopes(_:_:)` | 16+ | Category picker below search |
| `.searchScopes(_:activation:_:)` | 16.4+ | Scopes with activation control |
| `.searchFocused(_:)` | 18+ | Programmatic search focus |
| `.searchPresentationToolbarBehavior(_:)` | 17.1+ | Keep title visible during search |
| `.searchToolbarBehavior(_:)` | 26+ | Compact/minimize search field |
| `onSubmit(of: .search)` | 15+ | Handle search submission |

### Environment Values

| Value | iOS | Purpose |
|-------|-----|---------|
| `isSearching` | 15+ | Is user actively searching |
| `dismissSearch` | 15+ | Action to dismiss search |

### Types

| Type | iOS | Purpose |
|------|-----|---------|
| `SearchFieldPlacement` | 15+ | Where search field renders |
| `SearchScopeActivation` | 16.4+ | When scopes appear |

---

## Resources

**WWDC**: 2021-10176, 2022-10023

**Docs**: /swiftui/view/searchable(text:placement:prompt:), /swiftui/environmentvalues/issearching, /swiftui/view/searchscopes(_:activation:_:), /swiftui/view/searchfocused(_:), /swiftui/searchfieldplacement

**Skills**: axiom-swiftui-26-ref, axiom-swiftui-nav-ref, axiom-swiftui-nav

---

**Last Updated** Based on WWDC 2021-10176 "Searchable modifier", sosumi.ai API reference
**Platforms** iOS 15+, iPadOS 15+, macOS 12+, watchOS 8+, tvOS 15+
