---
name: app-composition
description: Use when structuring app entry points, managing authentication flows, switching root views, handling scene lifecycle, or asking 'how do I structure my @main', 'where does auth state live', 'how do I prevent screen flicker on launch', 'when should I modularize' - app-level composition patterns for iOS 26+
skill_type: discipline
version: 1.0
last_updated: Based on WWDC 2022-2025 sessions
apple_platforms: iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, visionOS 26+
xcode_version: Xcode 26+
---

# App Composition

## When to Use This Skill

Use when:
- Structuring your @main entry point and root view
- Managing authentication state (login → onboarding → main)
- Switching between app-level states without flicker
- Handling scene lifecycle events (scenePhase)
- Restoring app state after termination
- Deciding when to split into feature modules
- Coordinating between multiple windows (iPad, visionOS)

## Example Prompts

#### "How do I switch between login and main screens?"
Use the AppStateController pattern with validated state transitions.

#### "My app flickers when switching from splash to main"
Add animation coordination and minimum loading duration.

#### "Where should auth state live?"
Model app state as an enum, not scattered booleans.

#### "How do I handle app going to background?"
Use scenePhase lifecycle for session validation and resource cleanup.

#### "When should I split my app into modules?"
Follow the decision tree based on codebase size and team count.

---

## Overview

**Core Principle**: Apps have discrete states. Model them with enums, not scattered booleans.

Every app beyond trivial has distinct states: loading, unauthenticated, onboarding, authenticated, error. This skill covers centralized state management and clean transitions.

**Related Skills**
- **swiftui-architecture** — Feature-level patterns (MVVM, TCA, property wrappers)
- **swiftui-nav** — Navigation patterns (NavigationStack, deep linking)
- **app-composition** — App-level patterns (@main, root switching, scene lifecycle)

---

## Part 1: App-Level State Machines

### The Boolean Soup Problem

```swift
// ❌ Boolean soup — impossible to validate
class AppState {
    var isLoading = true
    var isLoggedIn = false
    var hasCompletedOnboarding = false
    var hasError = false
}
// What if isLoading && isLoggedIn && hasError are all true?
```

### The AppStateController Pattern

```swift
// ✅ Explicit states — compiler prevents invalid combinations
enum AppState: Equatable {
    case loading
    case unauthenticated
    case onboarding(OnboardingStep)
    case authenticated(User)
    case error(AppError)
}

@Observable @MainActor
class AppStateController {
    private(set) var state: AppState = .loading

    func transition(to newState: AppState) {
        guard isValidTransition(from: state, to: newState) else {
            assertionFailure("Invalid transition: \(state) → \(newState)")
            return
        }
        state = newState
    }

    private func isValidTransition(from: AppState, to: AppState) -> Bool {
        switch (from, to) {
        case (.loading, .unauthenticated): return true
        case (.loading, .authenticated): return true
        case (.unauthenticated, .onboarding): return true
        case (.onboarding, .authenticated): return true
        case (.authenticated, .unauthenticated): return true  // Logout
        // ...
        default: return false
        }
    }
}
```

---

## Part 2: Root View Switching

### The Clean @main Pattern

```swift
@main
struct MyApp: App {
    @State private var appState = AppStateController()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .task { await appState.initialize() }
        }
    }
}

struct RootView: View {
    @Environment(AppStateController.self) private var appState

    var body: some View {
        Group {
            switch appState.state {
            case .loading:
                LaunchView()
            case .unauthenticated:
                AuthenticationFlow()
            case .onboarding(let step):
                OnboardingFlow(step: step)
            case .authenticated(let user):
                MainTabView(user: user)
            case .error(let error):
                ErrorRecoveryView(error: error)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appState.state)
    }
}
```

**Key Principles**
- @main stays a thin shell — logic lives in AppStateController
- RootView switches on a single source of truth
- Animated transitions prevent flicker

---

## Part 3: Scene Lifecycle Integration

```swift
@main
struct MyApp: App {
    @State private var appState = AppStateController()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                Task { await appState.validateSession() }
            case .background:
                appState.releaseResources()
            default: break
            }
        }
    }
}
```

**Key Principles**
- Validate session on `.active` — never trust restored state blindly
- Release resources on `.background`
- Handle multi-window with `WindowGroup(id:for:)`

---

## Part 4: Feature Module Basics

### When to Modularize Decision Tree

| Codebase | Team | Recommendation |
|----------|------|----------------|
| < 5,000 lines | 1-2 devs | Single target is fine |
| 5,000-20,000 lines | 3+ devs | Consider modules |
| > 20,000 lines | Any | Modules essential |

### Module Boundary Pattern

```swift
// Feature exposes public API protocol
public protocol FeatureAPI {
    @MainActor func makeMainView() -> AnyView
}

// Main app uses protocol, not implementation
struct MainTabView: View {
    let profileFeature: FeatureAPI

    var body: some View {
        profileFeature.makeMainView()
    }
}
```

---

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Boolean-based state | Invalid states possible | Use enum (Part 1) |
| Logic in @main | Bloated, untestable | Delegate to AppStateController (Part 2) |
| Blind state restoration | Expired sessions, deleted data | Validate before applying (Part 3) |
| Scattered navigation logic | Circular dependencies | Scoped coordinators (Part 4) |

---

## Pressure Scenarios

### "Just hardcode the root for now"

| Option | Initial | Adding Auth Later | Total |
|--------|---------|-------------------|-------|
| Hardcode | 0 min | 2-4 hours refactor | 2-4 hours |
| AppStateController | 30 min | 30 min | 1 hour |

> "AppStateController takes 30 minutes now, 30 more when we add auth. Hardcoding costs 2-4 hours refactoring later."

### "We don't need modules yet"

Check codebase size and team count against the decision tree. If under threshold, document the decision and set a threshold for revisiting.

### "Navigation is too complex to test"

Test the state machine without UI:

```swift
@Test func testLoginTransition() async {
    let controller = AppStateController()
    controller.transition(to: .unauthenticated)
    await controller.handleLogin(user: mockUser)
    #expect(controller.state == .authenticated(mockUser))
}
```

---

## Code Review Checklist

### App State
- [ ] App state is an enum, not booleans
- [ ] State transitions are validated
- [ ] Invalid transitions are caught and logged

### Root View
- [ ] @main delegates to AppStateController
- [ ] No business logic in @main
- [ ] Transitions are animated

### Scene Lifecycle
- [ ] scenePhase changes handled centrally
- [ ] Session validated on .active
- [ ] Restored state validated before applying

### Module Boundaries
- [ ] Features have public API protocols
- [ ] No circular dependencies
- [ ] Navigation delegates to coordinators

---

## WWDC Sessions

- [Explore concurrency in SwiftUI](https://developer.apple.com/videos/play/wwdc2025/266/) (2025) — State-as-Bridge pattern
- [SwiftUI essentials](https://developer.apple.com/videos/play/wwdc2024/10150/) (2024) — @Observable models
- [What's new in SwiftUI](https://developer.apple.com/videos/play/wwdc2025/256/) (2025) — Scene bridging
- [The SwiftUI cookbook for navigation](https://developer.apple.com/videos/play/wwdc2022/10054/) (2022) — NavigationStack patterns

---

**Status**: Production-ready (v1.0)
**Source**: Full skill at `.claude-plugin/plugins/axiom/skills/app-composition/SKILL.md`
