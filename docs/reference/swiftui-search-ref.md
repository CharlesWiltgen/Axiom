# SwiftUI Search API Reference

Comprehensive reference for SwiftUI's search APIs, from the `.searchable` modifier (iOS 15) through search tokens and programmatic focus control (iOS 18). This skill covers the foundational search layer that iOS 26 refinements build upon.

## When to Use This Reference

Use this reference when:
- Adding search to a SwiftUI list or collection
- Implementing filter-as-you-type or submit-based search
- Adding search suggestions with auto-completion
- Using search scopes to narrow results by category
- Using search tokens for structured queries
- Controlling search focus programmatically
- Debugging "search field doesn't appear" issues

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I add search to my SwiftUI list?"
- "Why isn't my search field showing up?"
- "How do I add search suggestions with auto-completion?"
- "What's the difference between filter-as-you-type and onSubmit search?"
- "How do I add search scopes like Mail's inbox/sent/all filter?"
- "How do I use search tokens in SwiftUI?"
- "How do I programmatically open the search field?"

## What's Covered

- **The searchable modifier** — Core API, placement options, column association in NavigationSplitView
- **Search results** — `isSearching` environment, `dismissSearch` action, overlay pattern
- **Search suggestions** — Suggestions closure, `.searchCompletion()` for auto-fill
- **Search submission** — `onSubmit(of: .search)`, filter vs submit decision
- **Search scopes** (iOS 16+) — Category picker with `SearchScopeActivation` control
- **Search tokens** (iOS 16+) — Structured "pill" elements with suggested tokens (iOS 17+)
- **Programmatic control** (iOS 18+) — `.searchFocused()` for activating/dismissing search
- **Platform behavior** — How search adapts across iOS, macOS, watchOS, tvOS
- **Common gotchas** — 6 documented pitfalls with before/after fixes
- **API quick reference** — All modifiers, environment values, and types with iOS versions

## Key Patterns

### Filter-as-you-type

```swift
NavigationStack {
    List(filteredRecipes) { recipe in
        RecipeRow(recipe: recipe)
    }
    .navigationTitle("Recipes")
    .searchable(text: $searchText, prompt: "Find a recipe")
}

var filteredRecipes: [Recipe] {
    if searchText.isEmpty { return recipes }
    return recipes.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
}
```

### Suggestions with auto-completion

```swift
.searchable(text: $searchText, prompt: "Search colors") {
    ForEach(suggestedColors) { color in
        Label(color.name, systemImage: "paintpalette")
            .searchCompletion(color.name)  // Required for auto-fill
    }
}
```

## Documentation Scope

This page documents the `axiom-swiftui-search-ref` skill. It covers foundational search APIs (iOS 15-18).

- For iOS 26 search refinements (bottom-aligned, minimized toolbar, search tab role), see [swiftui-26-ref](./swiftui-26-ref)
- For navigation architecture that contains search, see [swiftui-nav-ref](../reference/swiftui-nav-ref)
- For automated SwiftUI navigation scanning, use the [swiftui-nav-auditor](/agents/swiftui-nav-auditor) agent

## Related

- [swiftui-26-ref](./swiftui-26-ref) — iOS 26 search refinements that build on these foundational APIs
- [swiftui-nav-ref](../reference/swiftui-nav-ref) — Navigation containers that render search fields
- [swiftui-nav](/skills/ui-design/swiftui-nav) — Anti-patterns and pressure scenarios for navigation including search
