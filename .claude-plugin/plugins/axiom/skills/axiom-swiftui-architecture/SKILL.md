---
name: axiom-swiftui-architecture
description: Use when separating logic from SwiftUI views, choosing architecture patterns, refactoring view files, or asking 'where should this code go', 'how do I organize my SwiftUI app', 'MVVM vs TCA vs vanilla SwiftUI', 'how do I make SwiftUI testable' - comprehensive architecture patterns with refactoring workflows for iOS 26+
license: MIT
compatibility: iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, axiom-visionOS 26+. Xcode 26+
metadata:
  version: "1.0"
---

# SwiftUI Architecture

## When to Use This Skill

Use this skill when:
- You have logic in your SwiftUI view files and want to extract it
- Choosing between MVVM, TCA, vanilla SwiftUI patterns, or Coordinator
- Refactoring views to separate concerns
- Making SwiftUI code testable
- Asking "where should this code go?"
- Deciding which property wrapper to use (@State, @Environment, @Bindable)
- Organizing a SwiftUI codebase for team development

## Example Prompts

| What You Might Ask | Why This Skill Helps |
|--------------------|----------------------|
| "There's quite a bit of code in my model view files about logic things. How do I extract it?" | Provides refactoring workflow with decision trees for where logic belongs |
| "Should I use MVVM, TCA, or Apple's vanilla patterns?" | Decision criteria based on app complexity, team size, testability needs |
| "How do I make my SwiftUI code testable?" | Shows separation patterns that enable testing without SwiftUI imports |
| "Where should formatters and calculations go?" | Anti-patterns section prevents logic in view bodies |
| "Which property wrapper do I use?" | Decision tree for @State, @Environment, @Bindable, or plain properties |

## Quick Architecture Decision Tree

```
What's driving your architecture choice?
│
├─ Starting fresh, small/medium app, want Apple's patterns?
│  └─ Use Apple's Native Patterns (Part 1)
│     - @Observable models for business logic
│     - State-as-Bridge for async boundaries
│     - Property wrapper decision tree
│
├─ Familiar with MVVM from UIKit?
│  └─ Use MVVM Pattern (Part 2)
│     - ViewModels as presentation adapters
│     - Clear View/ViewModel/Model separation
│     - Works well with @Observable
│
├─ Complex app, need rigorous testability, team consistency?
│  └─ Consider TCA (Part 3)
│     - State/Action/Reducer/Store architecture
│     - Excellent testing story
│     - Learning curve + boilerplate trade-off
│
└─ Complex navigation, deep linking, multiple entry points?
   └─ Add Coordinator Pattern (Part 4)
      - Can combine with any of the above
      - Extracts navigation logic from views
      - NavigationPath + Coordinator objects
```

---

# Part 1: Apple's Native Patterns (iOS 26+)

## Core Principle

> "A data model provides separation between the data and the views that interact with the data. This separation promotes modularity, improves testability, and helps make it easier to reason about how the app works."
> — Apple Developer Documentation

Apple's modern SwiftUI patterns (WWDC 2023-2025) center on:
1. **@Observable** for data models (replaces ObservableObject)
2. **State-as-Bridge** for async boundaries (WWDC 2025)
3. **Three property wrappers**: @State, @Environment, @Bindable
4. **Synchronous UI updates** for animations

## The State-as-Bridge Pattern

### Problem

Async functions create suspension points that can break animations:

```swift
// ❌ Problematic: Animation might miss frame deadline
struct ColorExtractorView: View {
    @State private var isLoading = false

    var body: some View {
        Button("Extract Colors") {
            Task {
                isLoading = true  // Synchronous ✅
                await extractColors()  // ⚠️ Suspension point!
                isLoading = false  // ❌ Might happen too late
            }
        }
        .scaleEffect(isLoading ? 1.5 : 1.0)  // ⚠️ Animation timing uncertain
    }
}
```

### Solution: Use State as a Bridge

"Find the boundaries between UI code that requires time-sensitive changes, and long-running async logic."

```swift
// ✅ Correct: State bridges UI and async code
@Observable
class ColorExtractor {
    var isLoading = false
    var colors: [Color] = []

    func extract(from image: UIImage) async {
        // This method is async and can live in the model
        let extracted = await heavyComputation(image)
        // Synchronous mutation for UI update
        self.colors = extracted
    }
}

struct ColorExtractorView: View {
    let extractor: ColorExtractor

    var body: some View {
        Button("Extract Colors") {
            // Synchronous state change for animation
            withAnimation {
                extractor.isLoading = true
            }

            // Launch async work
            Task {
                await extractor.extract(from: currentImage)

                // Synchronous state change for animation
                withAnimation {
                    extractor.isLoading = false
                }
            }
        }
        .scaleEffect(extractor.isLoading ? 1.5 : 1.0)
    }
}
```

**Benefits**:
- UI logic stays synchronous (animations work correctly)
- Async code lives in the model (testable without SwiftUI)
- Clear boundary between time-sensitive UI and long-running work

## Property Wrapper Decision Tree

There are only **3 questions** to answer:

```
Which property wrapper should I use?
│
├─ Does this model need to be STATE OF THE VIEW ITSELF?
│  └─ YES → Use @State
│     Examples: Form inputs, local toggles, sheet presentations
│     Lifetime: Managed by the view's lifetime
│
├─ Does this model need to be part of the GLOBAL ENVIRONMENT?
│  └─ YES → Use @Environment
│     Examples: User account, app settings, dependency injection
│     Lifetime: Lives at app/scene level
│
├─ Does this model JUST NEED BINDINGS?
│  └─ YES → Use @Bindable
│     Examples: Editing a model passed from parent
│     Lightweight: Only enables $ syntax for bindings
│
└─ NONE OF THE ABOVE?
   └─ Use as plain property
      Examples: Immutable data, parent-owned models
      No wrapper needed: @Observable handles observation
```

### Examples

```swift
// ✅ @State — View owns the model
struct DonutEditor: View {
    @State private var donutToAdd = Donut()  // View's own state

    var body: some View {
        TextField("Name", text: $donutToAdd.name)
    }
}

// ✅ @Environment — App-wide model
struct MenuView: View {
    @Environment(Account.self) private var account  // Global

    var body: some View {
        Text("Welcome, \(account.userName)")
    }
}

// ✅ @Bindable — Need bindings to parent-owned model
struct DonutRow: View {
    @Bindable var donut: Donut  // Parent owns it

    var body: some View {
        TextField("Name", text: $donut.name)  // Need binding
    }
}

// ✅ Plain property — Just reading
struct DonutRow: View {
    let donut: Donut  // Parent owns, no binding needed

    var body: some View {
        Text(donut.name)  // Just reading
    }
}
```

## @Observable Model Pattern

Use `@Observable` for business logic that needs to trigger UI updates:

```swift
// ✅ Domain model with business logic
@Observable
class FoodTruckModel {
    var orders: [Order] = []
    var donuts = Donut.all

    var orderCount: Int {
        orders.count  // Computed properties work automatically
    }

    func addDonut() {
        donuts.append(Donut())
    }
}

// ✅ View automatically tracks accessed properties
struct DonutMenu: View {
    let model: FoodTruckModel  // No wrapper needed!

    var body: some View {
        List {
            Section("Donuts") {
                ForEach(model.donuts) { donut in
                    Text(donut.name)  // Tracks model.donuts
                }
                Button("Add") {
                    model.addDonut()
                }
            }
            Section("Orders") {
                Text("Count: \(model.orderCount)")  // Tracks model.orders
            }
        }
    }
}
```

**How it works** (WWDC 2023/10149):
- SwiftUI tracks which properties are accessed during `body` execution
- Only those properties trigger view updates when changed
- Granular dependency tracking = better performance

## ViewModel Adapter Pattern

Use ViewModels as **presentation adapters** when you need filtering, sorting, or view-specific logic:

```swift
// ✅ ViewModel as presentation adapter
@Observable
class PetStoreViewModel {
    let petStore: PetStore  // Domain model
    var searchText: String = ""

    // View-specific computed property
    var filteredPets: [Pet] {
        guard !searchText.isEmpty else { return petStore.myPets }
        return petStore.myPets.filter { $0.name.contains(searchText) }
    }
}

struct PetListView: View {
    @Bindable var viewModel: PetStoreViewModel

    var body: some View {
        List {
            ForEach(viewModel.filteredPets) { pet in
                PetRowView(pet: pet)
            }
        }
        .searchable(text: $viewModel.searchText)
    }
}
```

**When to use a ViewModel adapter**:
- Filtering, sorting, grouping for display
- Formatting for presentation (but NOT heavy computation)
- View-specific state that doesn't belong in domain model
- Bridging between domain model and SwiftUI conventions

**When NOT to use a ViewModel**:
- Simple views that just display model data
- Logic that belongs in the domain model
- Over-extraction just for "pattern purity"

---

# Part 2: MVVM Pattern

## When to Use MVVM

MVVM (Model-View-ViewModel) is appropriate when:

✅ **You're familiar with it from UIKit** — Easier onboarding for team
✅ **You want explicit View/ViewModel separation** — Clear contracts
✅ **You have complex presentation logic** — Multiple filtering/sorting operations
✅ **You're migrating from UIKit** — Familiar mental model

❌ **Avoid MVVM when**:
- Views are simple (just displaying data)
- You're starting fresh with SwiftUI (Apple's patterns are simpler)
- You're creating unnecessary abstraction layers

## MVVM Structure for SwiftUI

```swift
// Model — Domain data and business logic
struct Pet: Identifiable {
    let id: UUID
    var name: String
    var kind: Kind
    var trick: String
    var hasAward: Bool = false

    mutating func giveAward() {
        hasAward = true
    }
}

// ViewModel — Presentation logic
@Observable
class PetListViewModel {
    private let petStore: PetStore

    var pets: [Pet] { petStore.myPets }
    var searchText: String = ""
    var selectedSort: SortOption = .name

    var filteredSortedPets: [Pet] {
        let filtered = pets.filter { pet in
            searchText.isEmpty || pet.name.contains(searchText)
        }
        return filtered.sorted { lhs, rhs in
            switch selectedSort {
            case .name: lhs.name < rhs.name
            case .kind: lhs.kind.rawValue < rhs.kind.rawValue
            }
        }
    }

    init(petStore: PetStore) {
        self.petStore = petStore
    }

    func awardPet(_ pet: Pet) {
        petStore.awardPet(pet.id)
    }
}

// View — UI only
struct PetListView: View {
    @Bindable var viewModel: PetListViewModel

    var body: some View {
        List {
            ForEach(viewModel.filteredSortedPets) { pet in
                PetRow(pet: pet) {
                    viewModel.awardPet(pet)
                }
            }
        }
        .searchable(text: $viewModel.searchText)
    }
}
```

## Common MVVM Mistakes in SwiftUI

### ❌ Mistake 1: Duplicating @Observable in View and ViewModel

```swift
// ❌ @State + @Observable is redundant — @State creates its own storage
struct MyView: View {
    @State private var viewModel = MyViewModel()  // ❌ Redundant wrapper
}

// ✅ Pass @Observable directly — use @State only if the view OWNS the lifecycle
struct MyView: View {
    let viewModel: MyViewModel  // ✅ Or @State if view creates it
}
```

### ❌ Mistake 2: God ViewModel

```swift
// ❌ Don't do this
@Observable
class AppViewModel {
    // Settings
    var isDarkMode = false
    var notificationsEnabled = true

    // User
    var userName = ""
    var userEmail = ""

    // Content
    var posts: [Post] = []
    var comments: [Comment] = []

    // ... 50 more properties
}
```

```swift
// ✅ Correct: Separate concerns
@Observable
class SettingsViewModel {
    var isDarkMode = false
    var notificationsEnabled = true
}

@Observable
class UserProfileViewModel {
    var user: User
}

@Observable
class FeedViewModel {
    var posts: [Post] = []
}
```

### ❌ Mistake 3: Business Logic in ViewModel

```swift
// ❌ Business rules belong in the Model, not the ViewModel
@Observable class OrderViewModel {
    func calculateDiscount(for order: Order) -> Double { /* ... */ }  // ❌ Business logic
}

// ✅ Model owns business logic; ViewModel only formats for display
struct Order {
    func calculateDiscount() -> Double { /* business rules */ }
}
@Observable class OrderViewModel {
    let order: Order
    var displayDiscount: String {
        "$\(order.calculateDiscount(), specifier: "%.2f")"  // ✅ Just formatting
    }
}
```

---

# Part 3: TCA (Composable Architecture)

## When to Consider TCA

TCA is a third-party architecture from Point-Free. Consider it when:

✅ **Rigorous testability is critical** — TestStore makes testing deterministic
✅ **Large team needs consistency** — Strict patterns reduce variation
✅ **Complex state management** — Side effects, dependencies, composition
✅ **You value Redux-like patterns** — Unidirectional data flow

❌ **Avoid TCA when**:
- Small app or prototype (too much overhead)
- Team unfamiliar with functional programming
- You need rapid iteration (boilerplate slows development)
- You want minimal dependencies

## TCA Core Concepts

TCA has 4 building blocks — **State** (data), **Action** (events), **Reducer** (state evolution), and **Store** (runtime engine). Here they are in a single feature:

```swift
// STATE — Data your feature needs
@ObservableState
struct CounterFeature {
    var count = 0
    var fact: String?
    var isLoading = false
}

// ACTION — All possible events
enum Action {
    case incrementButtonTapped
    case decrementButtonTapped
    case factButtonTapped
    case factResponse(String)
}

// REDUCER — How state evolves in response to actions
struct CounterFeature: Reducer {
    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .incrementButtonTapped:
                state.count += 1
                return .none
            case .decrementButtonTapped:
                state.count -= 1
                return .none
            case .factButtonTapped:
                state.isLoading = true
                return .run { [count = state.count] send in
                    let fact = try await numberFact(count)
                    await send(.factResponse(fact))
                }
            case let .factResponse(fact):
                state.isLoading = false
                state.fact = fact
                return .none
            }
        }
    }
}

// STORE — Runtime that receives actions and executes reducer
struct CounterView: View {
    let store: StoreOf<CounterFeature>

    var body: some View {
        VStack {
            Text("\(store.count)")
            Button("Increment") { store.send(.incrementButtonTapped) }
        }
    }
}
```

## TCA Trade-offs

### ✅ Benefits

| Benefit | Description |
|---------|-------------|
| **Testability** | TestStore makes testing deterministic and exhaustive |
| **Consistency** | One pattern for all features reduces cognitive load |
| **Composition** | Small reducers combine into larger features |
| **Side effects** | Structured effect management (networking, timers, etc.) |

### ❌ Costs

| Cost | Description |
|------|-------------|
| **Boilerplate** | State/Action/Reducer for every feature |
| **Learning curve** | Concepts from functional programming (effects, dependencies) |
| **Dependency** | Third-party library, not Apple-supported |
| **Iteration speed** | More code to write for simple features |

## When to Choose TCA Over Apple Patterns

| Scenario | Recommendation |
|----------|----------------|
| Small app (< 10 screens) | Apple patterns (simpler) |
| Medium app, experienced team | TCA if testability is priority |
| Large app, multiple teams | TCA for consistency |
| Rapid prototyping | Apple patterns (faster) |
| Mission-critical (banking, health) | TCA for rigorous testing |

---

# Part 4: Coordinator Pattern

## When to Use Coordinators

Coordinators extract navigation logic from views. Use when:

✅ **Complex navigation** — Multiple paths, conditional flows
✅ **Deep linking** — URL-driven navigation to any screen
✅ **Multiple entry points** — Same screen from different contexts
✅ **Testable navigation** — Isolate navigation from UI

## SwiftUI Coordinator Implementation

```swift
// Minimal coordinator — Route enum + @Observable coordinator + NavigationStack binding
enum Route: Hashable {
    case detail(Pet)
    case settings
}

@Observable
class AppCoordinator {
    var path: [Route] = []

    func showDetail(for pet: Pet) { path.append(.detail(pet)) }
    func popToRoot() { path.removeAll() }
}

// Root view binds NavigationStack to coordinator's path
struct AppView: View {
    @State private var coordinator = AppCoordinator()

    var body: some View {
        NavigationStack(path: $coordinator.path) {
            PetListView(coordinator: coordinator)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .detail(let pet): PetDetailView(pet: pet, coordinator: coordinator)
                    case .settings: SettingsView(coordinator: coordinator)
                    }
                }
        }
    }
}
```

Add deep linking with `.onOpenURL` and URL-to-route parsing:

```swift
// Add to AppCoordinator
func handleDeepLink(_ url: URL) {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
    // Parse URL path into routes
    if components.path.hasPrefix("/pets/"), let id = components.path.split(separator: "/").last {
        path = [.detail(loadPet(id: String(id)))]
    }
}

// Add to AppView's body
.onOpenURL { url in coordinator.handleDeepLink(url) }
```

Coordinators are testable without SwiftUI — assert path state directly:

```swift
func testDeepLink() {
    let coordinator = AppCoordinator()
    coordinator.handleDeepLink(URL(string: "myapp://pets/123")!)
    XCTAssertEqual(coordinator.path.count, 1)  // Navigated to detail
}
```

For state restoration, advanced URL routing, and tab-based coordination, see `axiom-swiftui-nav` — Pattern 7 (Coordinator) for structure, Pattern 1b for URL-based deep linking.

## Coordinator + Architecture Combinations

You can combine Coordinators with any architecture:

| Pattern | Coordinator Role |
|---------|------------------|
| **Apple Native** | Coordinator manages path, @Observable models for data |
| **MVVM** | Coordinator manages path, ViewModels for presentation |
| **TCA** | Coordinator manages path, Reducers for features |

---

# Part 5: Refactoring Workflow

## Step 1: Identify Logic in Views

Run this checklist on your views:

**View body contains:**
- DateFormatter, NumberFormatter creation
- Calculations or data transformations
- API calls or async operations
- Business rules (discounts, validation, etc.)
- Data filtering or sorting
- Heavy string manipulation
- Task { } with complex logic inside

If ANY of these are present, that logic should likely move out.

## Step 2: Extract to Appropriate Layer

Use this decision tree:

```
Where does this logic belong?
│
├─ Pure domain logic (discounts, validation, business rules)?
│  └─ Extract to Model
│     Example: Order.calculateDiscount()
│
├─ Presentation logic (filtering, sorting, formatting)?
│  └─ Extract to ViewModel or computed property
│     Example: filteredItems, displayPrice
│
├─ External side effects (API, database, file system)?
│  └─ Extract to Service
│     Example: APIClient, DatabaseManager
│
└─ Just expensive computation?
   └─ Cache with @State or create once
      Example: let formatter = DateFormatter()
```

### Example: Refactoring Logic from View

```swift
// ❌ Before: Logic in view body
struct OrderListView: View {
    let orders: [Order]

    var body: some View {
        let formatter = NumberFormatter()  // ❌ Created every render
        formatter.numberStyle = .currency

        let discounted = orders.filter { order in  // ❌ Computed every render
            let discount = order.total * 0.1  // ❌ Business logic in view
            return discount > 10.0
        }

        return List(discounted) { order in
            Text(formatter.string(from: order.total)!)  // ❌ Force unwrap
        }
    }
}
```

```swift
// ✅ After: Logic extracted

// Model — Business logic
struct Order {
    let id: UUID
    let total: Decimal

    var discount: Decimal {
        total * 0.1
    }

    var qualifiesForDiscount: Bool {
        discount > 10.0
    }
}

// ViewModel — Presentation logic
@Observable
class OrderListViewModel {
    let orders: [Order]
    private let formatter: NumberFormatter  // ✅ Created once

    var discountedOrders: [Order] {  // ✅ Computed property
        orders.filter { $0.qualifiesForDiscount }
    }

    init(orders: [Order]) {
        self.orders = orders
        self.formatter = NumberFormatter()
        formatter.numberStyle = .currency
    }

    func formattedTotal(_ order: Order) -> String {
        formatter.string(from: order.total as NSNumber) ?? "$0.00"
    }
}

// View — UI only
struct OrderListView: View {
    let viewModel: OrderListViewModel

    var body: some View {
        List(viewModel.discountedOrders) { order in
            Text(viewModel.formattedTotal(order))
        }
    }
}
```

## Step 3: Verify Testability

Your refactoring succeeded if:

```swift
// ✅ Can test without importing SwiftUI
import XCTest

final class OrderTests: XCTestCase {
    func testDiscountCalculation() {
        let order = Order(id: UUID(), total: 100)
        XCTAssertEqual(order.discount, 10)
    }

    func testQualifiesForDiscount() {
        let order = Order(id: UUID(), total: 100)
        XCTAssertTrue(order.qualifiesForDiscount)
    }
}

final class OrderViewModelTests: XCTestCase {
    func testFilteredOrders() {
        let orders = [
            Order(id: UUID(), total: 50),   // Discount: 5 ❌
            Order(id: UUID(), total: 200),  // Discount: 20 ✅
        ]
        let viewModel = OrderListViewModel(orders: orders)

        XCTAssertEqual(viewModel.discountedOrders.count, 1)
    }
}
```

## Step 4: Update View Bindings

After extraction, update property wrappers:

```swift
// Before refactoring
struct OrderListView: View {
    @State private var orders: [Order] = []  // View owned
    // ... logic in body
}

// After refactoring
struct OrderListView: View {
    @State private var viewModel: OrderListViewModel  // View owns ViewModel

    init(orders: [Order]) {
        _viewModel = State(initialValue: OrderListViewModel(orders: orders))
    }
}

// Or if parent owns it
struct OrderListView: View {
    let viewModel: OrderListViewModel  // Parent owns, just reading
}

// Or if need bindings
struct OrderListView: View {
    @Bindable var viewModel: OrderListViewModel  // Parent owns, need $
}
```

---

# Anti-Patterns (DO NOT DO THIS)

## ❌ Anti-Pattern 1: Logic in View Body

```swift
// ❌ Don't do this
struct ProductListView: View {
    let products: [Product]

    var body: some View {
        let formatter = NumberFormatter()  // ❌ Created every render!
        formatter.numberStyle = .currency

        let sorted = products.sorted { $0.price > $1.price }  // ❌ Sorted every render!

        return List(sorted) { product in
            Text("\(product.name): \(formatter.string(from: product.price)!)")
        }
    }
}
```

**Why it's wrong**:
- `formatter` created on every render (performance)
- `sorted` computed on every render (performance)
- Business logic (`sorted`) lives in view (not testable)
- Force unwrap ('!') can crash

```swift
// ✅ Correct
@Observable
class ProductListViewModel {
    let products: [Product]
    private let formatter = NumberFormatter()

    var sortedProducts: [Product] {
        products.sorted { $0.price > $1.price }
    }

    init(products: [Product]) {
        self.products = products
        formatter.numberStyle = .currency
    }

    func formattedPrice(_ product: Product) -> String {
        formatter.string(from: product.price as NSNumber) ?? "$0.00"
    }
}

struct ProductListView: View {
    let viewModel: ProductListViewModel

    var body: some View {
        List(viewModel.sortedProducts) { product in
            Text("\(product.name): \(viewModel.formattedPrice(product))")
        }
    }
}
```

## ❌ Anti-Pattern 2: Async Code Without Boundaries

See the State-as-Bridge pattern in Part 1 above — keep UI state changes synchronous (inside `withAnimation`), launch async work separately via `Task`.

## ❌ Anti-Pattern 3: Wrong Property Wrapper

```swift
// ❌ Don't use @State for passed-in models
struct DetailView: View {
    @State var item: Item  // ❌ Creates a copy, loses parent changes
}

// ✅ Correct: No wrapper for passed-in models
struct DetailView: View {
    let item: Item  // ✅ Or @Bindable if you need $item
}
```

```swift
// ❌ Don't use @Environment for view-local state
struct FormView: View {
    @Environment(FormData.self) var formData  // ❌ Overkill for local form
}

// ✅ Correct: @State for view-local
struct FormView: View {
    @State private var formData = FormData()  // ✅ View owns it
}
```

## ❌ Anti-Pattern 4: God ViewModel

See MVVM Mistake 2 in Part 2 above — split by concern into separate ViewModels.

## ❌ Anti-Pattern 5: @AppStorage Inside @Observable

**Never use `@AppStorage` inside an `@Observable` class** — it silently breaks observation. `@AppStorage` is a property wrapper designed for SwiftUI views, not model classes.

```swift
// ❌ BROKEN — @AppStorage silently breaks @Observable
@Observable
class Settings {
    @AppStorage("theme") var theme = "light"  // Changes won't trigger view updates
}

// ✅ Read @AppStorage in view, pass to model
struct SettingsView: View {
    @AppStorage("theme") private var theme = "light"
    // ...
}
```

## ❌ Anti-Pattern 6: Binding(get:set:) in View Body

Creating `Binding(get:set:)` in the view body creates a new binding on every evaluation, breaking SwiftUI's identity tracking.

```swift
// ❌ New Binding created every body evaluation
var body: some View {
    TextField("Name", text: Binding(
        get: { model.name },
        set: { model.name = $0 }
    ))
}

// ✅ Use @Bindable or computed binding
var body: some View {
    @Bindable var model = model
    TextField("Name", text: $model.name)
}
```

## ❌ Anti-Pattern 7: Mutating Parent State That Flows Back as Child Init Params

Any `@ViewBuilder` closure (`.sheet`, `.fullScreenCover`, `NavigationStack` destination, `.popover`) re-evaluates when parent state changes. If a child callback mutates the same parent `@State` that's passed as a child init parameter, the child gets re-initialized with changed values mid-lifecycle.

```swift
// ❌ Callback mutates the same state passed as init param
.sheet(item: $sheetItem) { item in
    ChildView(
        savedResponse: cachedResponse,      // ❌ Parent state as init param
        onSuccess: { cachedResponse = $0 }  // ❌ Mutates same state
    )
}
// onSuccess fires → cachedResponse set → parent re-evaluates → closure re-evaluates
// → new ChildView struct with savedResponse now non-nil → loading/animations skipped

// ✅ Don't pass state that callbacks will mutate
.sheet(item: $sheetItem) { item in
    ChildView(
        onSuccess: { cachedResponse = $0 }  // Update parent, but don't read it back
    )
}
```

**Fixes**: (1) Don't pass the mutated state back as an init param. (2) Use a separate `@State` for the child's display logic. (3) Have the child query its own data source. See Root Cause 5 in `axiom-swiftui-debugging` for full diagnostic workflow.

---

# Code Review Checklist

Before merging SwiftUI code, verify:

### Views
- View bodies contain ONLY UI code (Text, Button, List, etc.)
- No formatters created in view body
- No calculations or transformations in view body
- No API calls or database queries in view body
- No business rules in view body

### Logic Separation
- Business logic is in models (testable without SwiftUI)
- Presentation logic is in ViewModels or computed properties
- Side effects are in services or model methods
- Heavy computations are cached or computed once

### Property Wrappers
- @State for view-owned models
- @Environment for app-wide models
- @Bindable when bindings are needed
- No wrapper when just reading

### Animations & Async
- State changes for animations are synchronous
- Async boundaries use State-as-Bridge pattern
- No `await` between `withAnimation { }` blocks

### Testability
- Can test business logic without importing SwiftUI
- Can test ViewModels without rendering views
- Navigation logic is isolated (if using Coordinators)

---

# Pressure Scenarios

## Scenario 1: "Just put it in the view for now"

### The Pressure

**Manager**: "We need this feature by Friday. Just put the logic in the view for now, we'll refactor later."

### Red Flags

If you hear:
- ❌ "We'll refactor later" (tech debt that never gets paid)
- ❌ "It's just one view" (views multiply)
- ❌ "We don't have time for architecture" (costs more later)

### Time Cost Comparison

**Option A: Put logic in view**
- Write feature in view: 2 hours
- Realize it's untestable: 1 hour
- Try to test it anyway: 2 hours
- Give up, ship with manual testing: 0 hours
- **Total: 5 hours, 0 tests**

**Option B: Extract logic properly**
- Create model/ViewModel: 30 min
- Write feature with separation: 2 hours
- Write tests: 1 hour
- **Total: 3.5 hours, full test coverage**

### How to Push Back Professionally

**Step 1**: Acknowledge the deadline
> "I understand Friday is the deadline. Let me show you why proper separation is actually faster."

**Step 2**: Show the time comparison
> "Putting logic in views takes 5 hours with no tests. Extracting it properly takes 3.5 hours with full tests. We save 1.5 hours AND get tests."

**Step 3**: Offer the compromise
> "If we're truly out of time, I can extract 80% now and mark the remaining 20% as tech debt with a ticket. But let's not skip extraction entirely."

**Step 4**: Document if pressured to proceed
```swift
// TODO: TECH DEBT - Extract business logic to ViewModel
// Ticket: PROJ-123
// Added: 2025-12-14
// Reason: Deadline pressure from manager
// Estimated refactor time: 2 hours
```

### When to Accept

Only skip extraction if:
1. This is a throwaway prototype (deleted next week)
2. You have explicit time budget for refactoring (scheduled ticket)
3. The view will never grow beyond 20 lines

## Scenario 2: "TCA is overkill, just use vanilla SwiftUI"

### The Pressure

**Tech Lead**: "TCA is too complex for this project. Just use vanilla SwiftUI with @Observable."

### Decision Criteria

Ask these questions:

| Question | TCA | Vanilla |
|----------|-----|---------|
| Is testability critical (medical, financial)? | ✅ | ❌ |
| Do you have < 5 screens? | ❌ | ✅ |
| Is team experienced with functional programming? | ✅ | ❌ |
| Do you need rapid prototyping? | ❌ | ✅ |
| Is consistency across large team critical? | ✅ | ❌ |
| Do you have complex side effects (sockets, timers)? | ✅ | ~ |

**Recommendation matrix**:
- 4+ checks for TCA → Use TCA
- 4+ checks for Vanilla → Use Vanilla
- Tie → Start with Vanilla, migrate to TCA if needed

### How to Push Back

**If arguing FOR TCA**:
> "I understand TCA feels heavy. But we're building a banking app. The TestStore gives us exhaustive testing that catches bugs before production. The 2-week learning curve is worth it for 2 years of maintenance."

**If arguing AGAINST TCA**:
> "I agree TCA is powerful, but we're prototyping features weekly. The boilerplate will slow us down. Let's use @Observable now and migrate to TCA if we prove the features are worth building."

## Scenario 3: "Refactoring will take too long"

### The Pressure

**PM**: "We have 3 features to ship this month. We can't spend 2 weeks refactoring existing views."

### Incremental Extraction Strategy

You don't have to refactor everything at once:

**Week 1**: Extract 1 view
- Pick the most painful view (lots of logic)
- Extract to ViewModel
- Write tests
- **Time**: 4 hours

**Week 2**: Extract 2 views
- Now you have a pattern to follow
- Faster than week 1
- **Time**: 6 hours

**Week 3**: New features use proper architecture
- Don't refactor old code yet
- All NEW code follows the pattern
- **Time**: 0 hours (same as before)

**Month 2**: Gradually refactor as you touch files
- Refactor when fixing bugs in old views
- Refactor when adding features to old views
- **Time**: Amortized over feature work

### How to Push Back

> "I'm not proposing we stop feature work for 2 weeks. I'm proposing:
> 1. Week 1: Extract our worst view (the OrdersView with 500 lines)
> 2. Week 2: Extract 2 more problematic views
> 3. Going forward: All NEW features use proper architecture
> 4. We refactor old views when we touch them anyway
>
> This costs 10 hours upfront and saves us 2+ hours per feature going forward."

---

# Real-World Impact

## Before: Logic in View

```swift
// 😰 200 lines of pain
struct OrderListView: View {
    @State private var orders: [Order] = []
    @State private var searchText = ""
    @State private var selectedFilter: FilterType = .all

    var body: some View {
        // ❌ Formatters created every render
        let currencyFormatter = NumberFormatter()
        currencyFormatter.numberStyle = .currency

        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium

        // ❌ Business logic in view
        let filtered = orders.filter { order in
            if !searchText.isEmpty && !order.customerName.contains(searchText) {
                return false
            }

            switch selectedFilter {
            case .all: return true
            case .pending: return !order.isCompleted
            case .completed: return order.isCompleted
            case .highValue: return order.total > 1000
            }
        }

        // ❌ More business logic
        let sorted = filtered.sorted { lhs, rhs in
            if selectedFilter == .highValue {
                return lhs.total > rhs.total
            } else {
                return lhs.date > rhs.date
            }
        }

        return List(sorted) { order in
            VStack(alignment: .leading) {
                Text(order.customerName)
                Text(currencyFormatter.string(from: order.total as NSNumber)!)
                Text(dateFormatter.string(from: order.date))

                if order.isCompleted {
                    Image(systemName: "checkmark.circle.fill")
                } else {
                    Button("Complete") {
                        // ❌ Async logic in view
                        Task {
                            do {
                                try await completeOrder(order)
                                await loadOrders()
                            } catch {
                                print(error)  // ❌ No error handling
                            }
                        }
                    }
                }
            }
        }
        .searchable(text: $searchText)
        .task {
            await loadOrders()
        }
    }

    func loadOrders() async {
        // ❌ API call in view
        // ... 50 more lines
    }

    func completeOrder(_ order: Order) async throws {
        // ❌ API call in view
        // ... 30 more lines
    }
}
```

**Problems**:
- 200+ lines in one file
- Formatters created every render (performance)
- Business logic untestable
- No error handling
- Hard to reason about

## After: Proper Architecture

```swift
// Model — 30 lines
struct Order {
    let id: UUID
    let customerName: String
    let total: Decimal
    let date: Date
    var isCompleted: Bool

    var isHighValue: Bool {
        total > 1000
    }
}

// ViewModel — 60 lines
@Observable
class OrderListViewModel {
    private let orderService: OrderService
    private let currencyFormatter = NumberFormatter()
    private let dateFormatter = DateFormatter()

    var orders: [Order] = []
    var searchText = ""
    var selectedFilter: FilterType = .all
    var error: Error?

    var filteredOrders: [Order] {
        orders
            .filter(matchesSearch)
            .filter(matchesFilter)
            .sorted(by: sortComparator)
    }

    init(orderService: OrderService) {
        self.orderService = orderService
        currencyFormatter.numberStyle = .currency
        dateFormatter.dateStyle = .medium
    }

    func loadOrders() async {
        do {
            orders = try await orderService.fetchOrders()
        } catch {
            self.error = error
        }
    }

    func completeOrder(_ order: Order) async {
        do {
            try await orderService.complete(order.id)
            await loadOrders()
        } catch {
            self.error = error
        }
    }

    func formattedTotal(_ order: Order) -> String {
        currencyFormatter.string(from: order.total as NSNumber) ?? "$0.00"
    }

    func formattedDate(_ order: Order) -> String {
        dateFormatter.string(from: order.date)
    }

    private func matchesSearch(_ order: Order) -> Bool {
        searchText.isEmpty || order.customerName.contains(searchText)
    }

    private func matchesFilter(_ order: Order) -> Bool {
        switch selectedFilter {
        case .all: true
        case .pending: !order.isCompleted
        case .completed: order.isCompleted
        case .highValue: order.isHighValue
        }
    }

    private func sortComparator(_ lhs: Order, _ rhs: Order) -> Bool {
        selectedFilter == .highValue
            ? lhs.total > rhs.total
            : lhs.date > rhs.date
    }
}

// View — 40 lines
struct OrderListView: View {
    @Bindable var viewModel: OrderListViewModel

    var body: some View {
        List(viewModel.filteredOrders) { order in
            OrderRow(order: order, viewModel: viewModel)
        }
        .searchable(text: $viewModel.searchText)
        .task {
            await viewModel.loadOrders()
        }
        .alert("Error", error: $viewModel.error) { }
    }
}

struct OrderRow: View {
    let order: Order
    let viewModel: OrderListViewModel

    var body: some View {
        VStack(alignment: .leading) {
            Text(order.customerName)
            Text(viewModel.formattedTotal(order))
            Text(viewModel.formattedDate(order))

            if order.isCompleted {
                Image(systemName: "checkmark.circle.fill")
            } else {
                Button("Complete") {
                    Task {
                        await viewModel.completeOrder(order)
                    }
                }
            }
        }
    }
}

// Tests — 100 lines
final class OrderViewModelTests: XCTestCase {
    func testFilterBySearch() async {
        let viewModel = OrderListViewModel(orderService: MockOrderService())
        await viewModel.loadOrders()

        viewModel.searchText = "John"
        XCTAssertEqual(viewModel.filteredOrders.count, 1)
    }

    func testFilterByHighValue() async {
        let viewModel = OrderListViewModel(orderService: MockOrderService())
        await viewModel.loadOrders()

        viewModel.selectedFilter = .highValue
        XCTAssertTrue(viewModel.filteredOrders.allSatisfy { $0.isHighValue })
    }

    // ... 10 more tests
}
```

**Benefits**:
- View: 40 lines (was 200)
- ViewModel: Fully testable without SwiftUI
- Model: Pure business logic
- Formatters: Created once, not every render
- Error handling: Proper with alerts
- Tests: 10+ tests covering all logic

---

## Resources

**WWDC**: 2025-266, 2024-10150, 2023-10149, 2023-10160

**Docs**: /swiftui/managing-model-data-in-your-app

**External**: github.com/pointfreeco/swift-composable-architecture

---

**Platforms**: iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, axiom-visionOS 26+
**Xcode**: 26+
**Status**: Production-ready (v1.0)
