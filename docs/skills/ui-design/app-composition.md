---
name: app-composition
description: App-level composition patterns for @main, authentication flows, and scene lifecycle
skill_type: discipline
version: 1.0
apple_platforms: iOS 26+
---

# App Composition

App-level composition patterns for iOS. Covers @main entry points, authentication state machines, root view switching, and scene lifecycle.

## When to Use This Skill

Use this skill when you're:
- Structuring your @main entry point and root view
- Managing authentication state (login → onboarding → main)
- Switching between app-level states without flicker
- Handling scene lifecycle events (scenePhase)
- Restoring app state after termination
- Deciding when to split into feature modules
- Coordinating between multiple windows (iPad, visionOS)

**Core principle:** Apps have discrete states. Model them with enums, not scattered booleans.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I switch between login and main screens?"
- "My app flickers when switching from splash to main."
- "Where should auth state live?"
- "How do I handle app going to background?"
- "When should I split my app into modules?"

## What's Covered

### App-Level State Machines
- AppState enum pattern (loading, unauthenticated, authenticated, error)
- Avoiding "boolean soup" (scattered isLoading, isLoggedIn, hasError)
- State transitions with validation
- Centralized state management

### Root View Switching
- Clean transitions between app states
- Animation coordination
- Preventing screen flicker on launch
- Minimum loading duration patterns

### Scene Lifecycle
- scenePhase handling (active, inactive, background)
- Session validation on foreground
- Resource cleanup on background
- State restoration

### Modularization
- Decision tree for when to split
- Feature module patterns
- Dependency injection between modules

## Key Pattern

### AppState Enum Pattern

```swift
// ❌ Boolean soup — impossible to validate
class AppState {
    var isLoading = true
    var isLoggedIn = false
    var hasCompletedOnboarding = false
    var hasError = false
}
// What if isLoading && isLoggedIn && hasError are all true?

// ✅ Explicit states — compiler prevents invalid combinations
enum AppState: Equatable {
    case loading
    case unauthenticated
    case onboarding(OnboardingStep)
    case authenticated(User)
    case error(AppError)
}

@Observable
class AppStateController {
    private(set) var state: AppState = .loading

    func transition(to newState: AppState) {
        // Validate transition is legal
        state = newState
    }
}
```

### Root View Switching

```swift
@main
struct MyApp: App {
    @State private var controller = AppStateController()

    var body: some Scene {
        WindowGroup {
            Group {
                switch controller.state {
                case .loading:
                    SplashView()
                case .unauthenticated:
                    LoginView()
                case .onboarding(let step):
                    OnboardingView(step: step)
                case .authenticated(let user):
                    MainView(user: user)
                case .error(let error):
                    ErrorView(error: error)
                }
            }
            .animation(.default, value: controller.state)
        }
    }
}
```

### Scene Lifecycle

```swift
struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        MainContent()
            .onChange(of: scenePhase) { _, newPhase in
                switch newPhase {
                case .active:
                    // Validate session, refresh data
                case .inactive:
                    // Pause updates
                case .background:
                    // Clean up resources, save state
                @unknown default:
                    break
                }
            }
    }
}
```

## Documentation Scope

This page documents the `axiom-app-composition` skill—app-level patterns Claude uses when you're structuring @main, managing authentication flows, or handling scene lifecycle.

**For feature architecture:** See [swiftui-architecture](/skills/ui-design/swiftui-architecture) for MVVM, TCA, and property wrapper patterns.

**For navigation:** See [swiftui-nav](/skills/ui-design/swiftui-nav) for NavigationStack patterns.

## Related

- [swiftui-architecture](/skills/ui-design/swiftui-architecture) — Feature-level patterns (MVVM, TCA)
- [swiftui-nav](/skills/ui-design/swiftui-nav) — Navigation patterns
- [swift-concurrency](/skills/concurrency/swift-concurrency) — Async patterns for state management

## Resources

**WWDC**: 2022-10072 (Scene lifecycle), 2023-10149 (@Observable)

**Docs**: /swiftui/app-structure-and-behavior, /swiftui/scenephase
