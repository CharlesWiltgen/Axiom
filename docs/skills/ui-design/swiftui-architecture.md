---
name: swiftui-architecture
description: Use when separating logic from SwiftUI views, choosing architecture patterns (MVVM, TCA, Coordinator), refactoring view files, or asking 'where should this code go', 'how do I organize my SwiftUI app', 'MVVM vs TCA', 'how do I make SwiftUI testable' - comprehensive architecture patterns with refactoring workflows for iOS 26+
skill_type: discipline
version: 1.0
last_updated: Based on WWDC 2023-2025 sessions
apple_platforms: iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, visionOS 26+
xcode_version: Xcode 26+
---

# SwiftUI Architecture

## When to Use This Skill

Use when:
- You have logic in your SwiftUI view files and want to extract it
- Choosing between MVVM, TCA, vanilla SwiftUI patterns, or Coordinator
- Refactoring views to separate concerns
- Making SwiftUI code testable
- Asking "where should this code go?"
- Deciding which property wrapper to use (@State, @Environment, @Bindable)
- Organizing a SwiftUI codebase for team development

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "There's quite a bit of code in my model view files about logic things. How do I extract it?"
→ The skill provides a refactoring workflow with decision trees for where logic belongs (Model vs ViewModel vs Service)

#### 2. "Should I use MVVM, TCA, or Apple's vanilla patterns?"
→ The skill offers decision criteria based on app complexity, team size, testability needs, and iteration speed

#### 3. "How do I make my SwiftUI code testable?"
→ The skill shows separation patterns that enable testing without SwiftUI imports, with concrete examples

#### 4. "Where should formatters and calculations go?"
→ The skill's anti-patterns section prevents logic in view bodies with before/after code comparisons

#### 5. "Which property wrapper do I use?"
→ The skill provides a decision tree for @State, @Environment, @Bindable, or plain properties from WWDC 2023

---

## Overview

**Core Principle**: "A data model provides separation between the data and the views that interact with the data. This separation promotes modularity, improves testability, and helps make it easier to reason about how the app works." — Apple Developer Documentation

**Based on**: WWDC 2023-2025 sessions covering modern SwiftUI architecture

Apple's modern SwiftUI patterns (WWDC 2023-2025) center on:
1. **@Observable** for data models (replaces ObservableObject)
2. **State-as-Bridge** for async boundaries (WWDC 2025)
3. **Three property wrappers**: @State, @Environment, @Bindable
4. **Synchronous UI updates** for animations

---

## Part 1: Apple's Native Patterns

### The State-as-Bridge Pattern (WWDC 2025/266)

From WWDC 2025's "Explore concurrency in SwiftUI":

> "Find the boundaries between UI code that requires time-sensitive changes, and long-running async logic."

**Key insight**: UI logic stays synchronous (for animations), async code lives in models (testable without SwiftUI), and state bridges the two.

```swift
// ✅ Correct: State bridges UI and async code
@Observable
class ColorExtractor {
    var isLoading = false
    var colors: [Color] = []

    func extract(from image: UIImage) async {
        let extracted = await heavyComputation(image)
        self.colors = extracted  // Synchronous mutation
    }
}

struct ColorExtractorView: View {
    let extractor: ColorExtractor

    var body: some View {
        Button("Extract Colors") {
            withAnimation {
                extractor.isLoading = true  // ✅ Synchronous
            }

            Task {
                await extractor.extract(from: currentImage)

                withAnimation {
                    extractor.isLoading = false  // ✅ Synchronous
                }
            }
        }
        .scaleEffect(extractor.isLoading ? 1.5 : 1.0)
    }
}
```

### Property Wrapper Decision Tree

From WWDC 2023/10149, there are only **3 questions** to answer:

| Question | Answer |
|----------|--------|
| Does this model need to be STATE OF THE VIEW ITSELF? | Use @State |
| Does this model need to be part of the GLOBAL ENVIRONMENT? | Use @Environment |
| Does this model JUST NEED BINDINGS? | Use @Bindable |
| NONE OF THE ABOVE? | Use as plain property |

---

## Part 2: MVVM Pattern

### When to Use MVVM

MVVM is appropriate when:

✅ You're familiar with it from UIKit — Easier onboarding for team
✅ You want explicit View/ViewModel separation — Clear contracts
✅ You have complex presentation logic — Multiple filtering/sorting operations
✅ You're migrating from UIKit — Familiar mental model

❌ Avoid MVVM when:
- Views are simple (just displaying data)
- You're starting fresh with SwiftUI (Apple's patterns are simpler)
- You're creating unnecessary abstraction layers

---

## Part 3: TCA (Composable Architecture)

### When to Consider TCA

TCA is a third-party architecture from Point-Free. Consider it when:

✅ Rigorous testability is critical — TestStore makes testing deterministic
✅ Large team needs consistency — Strict patterns reduce variation
✅ Complex state management — Side effects, dependencies, composition
✅ You value Redux-like patterns — Unidirectional data flow

❌ Avoid TCA when:
- Small app or prototype (too much overhead)
- Team unfamiliar with functional programming
- You need rapid iteration (boilerplate slows development)
- You want minimal dependencies

### TCA Trade-offs

**✅ Benefits**:
- Excellent testability with TestStore
- Consistency across features
- Composition of reducers
- Structured effect management

**❌ Costs**:
- Boilerplate (State/Action/Reducer for every feature)
- Learning curve (functional programming concepts)
- Third-party dependency (not Apple-supported)
- Slower iteration speed

---

## Part 4: Coordinator Pattern

Coordinators extract navigation logic from views. Use when:

✅ Complex navigation — Multiple paths, conditional flows
✅ Deep linking — URL-driven navigation to any screen
✅ Multiple entry points — Same screen from different contexts
✅ Testable navigation — Isolate navigation from UI

```swift
// Coordinator manages navigation state
@Observable
class AppCoordinator {
    var path: [Route] = []

    func showDetail(for pet: Pet) {
        path.append(.detail(pet))
    }

    func handleDeepLink(_ url: URL) {
        // Parse URL and build path
        if url.path == "/pets/123" {
            let pet = loadPet(id: "123")
            path = [.detail(pet)]
        }
    }
}
```

---

## Refactoring Workflow

### Step 1: Identify Logic in Views

Run this checklist on your views:

- DateFormatter, NumberFormatter creation
- Calculations or data transformations
- API calls or async operations
- Business rules (discounts, validation, etc.)
- Data filtering or sorting
- Heavy string manipulation
- Task { } with complex logic inside

If you checked ANY box, that logic should likely move out.

### Step 2: Extract to Appropriate Layer

| Logic Type | Extract To | Example |
|-----------|-----------|---------|
| Pure domain logic | Model | Order.calculateDiscount() |
| Presentation logic | ViewModel | filteredItems, displayPrice |
| External side effects | Service | APIClient, DatabaseManager |
| Expensive computation | Cache | let formatter = DateFormatter() |

### Step 3: Verify Testability

Your refactoring succeeded if:

```swift
// ✅ Can test without importing SwiftUI
import XCTest

final class OrderTests: XCTestCase {
    func testDiscountCalculation() {
        let order = Order(id: UUID(), total: 100)
        XCTAssertEqual(order.discount, 10)
    }
}
```

---

## Common Anti-Patterns

### ❌ Logic in View Body

**Problem**: Formatters created every render, calculations repeated, business logic untestable

```swift
// ❌ Don't do this
struct ProductListView: View {
    var body: some View {
        let formatter = NumberFormatter()  // ❌ Created every render!
        let sorted = products.sorted { $0.price > $1.price }  // ❌ Sorted every render!
        // ...
    }
}
```

**Solution**: Extract to ViewModel

```swift
// ✅ Correct
@Observable
class ProductListViewModel {
    private let formatter = NumberFormatter()  // ✅ Created once

    var sortedProducts: [Product] {
        products.sorted { $0.price > $1.price }
    }
}
```

### ❌ Async Code Without Boundaries

**Problem**: Suspension points can break animation timing

```swift
// ❌ Don't do this
Button("Extract") {
    Task {
        isLoading = true
        await heavyExtraction()  // ⚠️ Suspension point
        isLoading = false  // ❌ Animation might break
    }
}
```

**Solution**: State-as-Bridge pattern (see Part 1)

---

## Pressure Scenarios

### Scenario 1: "Just put it in the view for now"

**Manager**: "We need this feature by Friday. Just put the logic in the view for now, we'll refactor later."

**Time Cost Comparison**:

| Option | Time | Outcome |
|--------|------|---------|
| Logic in view | 5 hours | No tests, untestable |
| Extract properly | 3.5 hours | Full test coverage |

**How to Push Back**:
> "Putting logic in views takes 5 hours with no tests. Extracting it properly takes 3.5 hours with full tests. We save 1.5 hours AND get tests."

### Scenario 2: "TCA is overkill"

Use the decision matrix:

| App Size | Team Experience | Testability Need | Recommendation |
|----------|----------------|------------------|----------------|
| < 5 screens | Any | Any | Apple patterns |
| 5-20 screens | FP experience | Critical | TCA |
| 5-20 screens | No FP | Normal | Apple/MVVM |
| 20+ screens | Any | Critical | TCA |

---

## Real-World Impact

**Before**: 200-line view with logic
**After**: 40-line view + 60-line ViewModel + tests

**Benefits**:
- View: 40 lines (was 200)
- ViewModel: Fully testable without SwiftUI
- Model: Pure business logic
- Formatters: Created once, not every render
- Error handling: Proper with alerts
- Tests: 10+ tests covering all logic

---

## WWDC Sessions

**Required Viewing**:

- [Explore concurrency in SwiftUI](https://developer.apple.com/videos/play/wwdc2025/266/) (2025) — State-as-Bridge pattern
- [SwiftUI essentials](https://developer.apple.com/videos/play/wwdc2024/10150/) (2024) — @Observable models, ViewModel adapters
- [Discover Observation in SwiftUI](https://developer.apple.com/videos/play/wwdc2023/10149/) (2023) — @Observable macro, property wrappers
- [Demystify SwiftUI performance](https://developer.apple.com/videos/play/wwdc2023/10160/) (2023) — Performance optimization

**Additional Resources**:

- [Managing model data in your app](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app) — Apple's official guidance
- [The Composable Architecture](https://github.com/pointfreeco/swift-composable-architecture) — TCA documentation

---

**Status**: Production-ready (v1.0)
**Source**: Full skill at `.claude-plugin/plugins/axiom/skills/swiftui-architecture/skill.md`
