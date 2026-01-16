---
name: axiom-app-composition
description: Use when structuring app entry points, managing authentication flows, switching root views, handling scene lifecycle, or asking 'how do I structure my @main', 'where does auth state live', 'how do I prevent screen flicker on launch', 'when should I modularize' - app-level composition patterns for iOS 26+
user-invocable: true
skill_type: discipline
version: 1.0
apple_platforms: iOS 26+, iPadOS 26+, macOS Tahoe+, watchOS 26+, axiom-visionOS 26+
xcode_version: Xcode 26+
---

# App Composition

## When to Use This Skill

Use this skill when:
- Structuring your @main entry point and root view
- Managing authentication state (login → onboarding → main)
- Switching between app-level states without flicker
- Handling scene lifecycle events (scenePhase)
- Restoring app state after termination
- Deciding when to split into feature modules
- Coordinating between multiple windows (iPad, axiom-visionOS)

## Example Prompts

| What You Might Ask | Why This Skill Helps |
|--------------------|----------------------|
| "How do I switch between login and main screens?" | AppStateController pattern with validated transitions |
| "My app flickers when switching from splash to main" | Flicker prevention with animation coordination |
| "Where should auth state live?" | App-level state machine, not scattered booleans |
| "How do I handle app going to background?" | scenePhase lifecycle patterns |
| "When should I split my app into modules?" | Decision tree based on codebase size and team |
| "How do I restore state after app is killed?" | SceneStorage and state validation patterns |

## Quick Decision Tree

```
What app-level architecture question are you solving?
│
├─ How do I manage app states (loading, auth, main)?
│  └─ Part 1: App-Level State Machines
│     - Enum-based state with validated transitions
│     - AppStateController pattern
│     - Prevents "boolean soup" anti-pattern
│
├─ How do I structure @main and root view switching?
│  └─ Part 2: Root View Switching Patterns
│     - Delegate to AppStateController (no logic in @main)
│     - Flicker prevention with animation
│     - Coordinator integration
│
├─ How do I handle scene lifecycle?
│  └─ Part 3: Scene Lifecycle Integration
│     - scenePhase for session validation
│     - SceneStorage for restoration
│     - Multi-window coordination
│
├─ When should I modularize?
│  └─ Part 4: Feature Module Basics
│     - Decision tree by size/team
│     - Module boundaries and DI
│     - Navigation coordination
│
└─ What mistakes should I avoid?
   └─ Part 5: Anti-Patterns + Part 6: Pressure Scenarios
      - Boolean-based state
      - Logic in @main
      - Missing restoration validation
```

---

# Part 1: App-Level State Machines

## Core Principle

> "Apps have discrete states. Model them explicitly with enums, not scattered booleans."

Every non-trivial app has distinct states: loading, unauthenticated, onboarding, authenticated, error recovery. These states should be:
1. **Explicit** — An enum, not multiple booleans
2. **Validated** — Transitions are checked and logged
3. **Centralized** — One source of truth
4. **Observable** — Views react to state changes

## The Boolean Soup Problem

```swift
// ❌ Boolean soup — impossible to validate, prone to invalid states
class AppState {
    var isLoading = true
    var isLoggedIn = false
    var hasCompletedOnboarding = false
    var hasError = false
    var user: User?

    // What if isLoading && isLoggedIn && hasError are all true?
    // Invalid state, but nothing prevents it
}
```

**Problems**
- No compile-time guarantee of valid states
- Easy to forget to update one boolean
- Testing requires checking all combinations
- Race conditions create impossible states

## The AppStateController Pattern

### Step 1: Define Explicit States

```swift
enum AppState: Equatable {
    case loading
    case unauthenticated
    case onboarding(OnboardingStep)
    case authenticated(User)
    case error(AppError)
}

enum OnboardingStep: Equatable {
    case welcome
    case permissions
    case profileSetup
    case complete
}

enum AppError: Equatable {
    case networkUnavailable
    case sessionExpired
    case maintenanceMode
}
```

### Step 2: Create the Controller

```swift
@Observable
@MainActor
class AppStateController {
    private(set) var state: AppState = .loading

    // MARK: - State Transitions

    func transition(to newState: AppState) {
        guard isValidTransition(from: state, to: newState) else {
            assertionFailure("Invalid transition: \(state) → \(newState)")
            logInvalidTransition(from: state, to: newState)
            return
        }

        let oldState = state
        state = newState
        logTransition(from: oldState, to: newState)
    }

    // MARK: - Validation

    private func isValidTransition(from: AppState, to: AppState) -> Bool {
        switch (from, to) {
        // From loading
        case (.loading, .unauthenticated): return true
        case (.loading, .authenticated): return true
        case (.loading, .error): return true

        // From unauthenticated
        case (.unauthenticated, .onboarding): return true
        case (.unauthenticated, .authenticated): return true
        case (.unauthenticated, .error): return true

        // From onboarding
        case (.onboarding, .onboarding): return true  // Step changes
        case (.onboarding, .authenticated): return true
        case (.onboarding, .unauthenticated): return true  // Cancelled

        // From authenticated
        case (.authenticated, .unauthenticated): return true  // Logout
        case (.authenticated, .error): return true

        // From error
        case (.error, .loading): return true  // Retry
        case (.error, .unauthenticated): return true

        default: return false
        }
    }

    // MARK: - Logging

    private func logTransition(from: AppState, to: AppState) {
        #if DEBUG
        print("AppState: \(from) → \(to)")
        #endif
    }

    private func logInvalidTransition(from: AppState, to: AppState) {
        // Log to analytics for debugging
        Analytics.log("InvalidStateTransition", properties: [
            "from": String(describing: from),
            "to": String(describing: to)
        ])
    }
}
```

### Step 3: Initialize from Storage

```swift
extension AppStateController {
    func initialize() async {
        // Check for stored session
        if let session = await SessionStorage.loadSession() {
            // Validate session is still valid
            do {
                let user = try await AuthService.validateSession(session)
                transition(to: .authenticated(user))
            } catch {
                // Session expired or invalid
                await SessionStorage.clearSession()
                transition(to: .unauthenticated)
            }
        } else {
            transition(to: .unauthenticated)
        }
    }
}
```

## State Machine Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        .loading                              │
└────────────┬───────────────┬────────────────┬───────────────┘
             │               │                │
             ▼               ▼                ▼
    .unauthenticated   .authenticated     .error
             │               │                │
             ▼               │                │
       .onboarding ─────────►│◄───────────────┘
             │               │
             └───────────────┘
```

## Testing State Machines

```swift
@Test func testValidTransitions() async {
    let controller = AppStateController()

    // Loading → Unauthenticated (valid)
    controller.transition(to: .unauthenticated)
    #expect(controller.state == .unauthenticated)

    // Unauthenticated → Authenticated (valid)
    let user = User(id: "1", name: "Test")
    controller.transition(to: .authenticated(user))
    #expect(controller.state == .authenticated(user))
}

@Test func testInvalidTransitionRejected() async {
    let controller = AppStateController()

    // Loading → Onboarding (invalid — must go through unauthenticated)
    controller.transition(to: .onboarding(.welcome))
    #expect(controller.state == .loading)  // Unchanged
}

@Test func testSessionExpiredTransition() async {
    let controller = AppStateController()
    let user = User(id: "1", name: "Test")
    controller.transition(to: .authenticated(user))

    // Authenticated → Error (session expired)
    controller.transition(to: .error(.sessionExpired))
    #expect(controller.state == .error(.sessionExpired))

    // Error → Unauthenticated (force re-login)
    controller.transition(to: .unauthenticated)
    #expect(controller.state == .unauthenticated)
}
```

## The State-as-Bridge Pattern (WWDC 2025/266)

From WWDC 2025's "Explore concurrency in SwiftUI":

> "Find the boundaries between UI code that requires time-sensitive changes, and long-running async logic."

The key insight: **synchronous state changes drive UI** (for animations), **async code lives in the model** (testable without SwiftUI), and **state bridges the two**.

```swift
// ✅ State-as-Bridge: UI triggers state, model does async work
struct ColorExtractorView: View {
    @State private var model = ColorExtractor()

    var body: some View {
        Button("Extract Colors") {
            // ✅ Synchronous state change triggers animation
            withAnimation { model.isExtracting = true }

            // Async work happens in Task
            Task {
                await model.extractColors()

                // ✅ Synchronous state change ends animation
                withAnimation { model.isExtracting = false }
            }
        }
        .scaleEffect(model.isExtracting ? 1.5 : 1.0)
    }
}

@Observable
class ColorExtractor {
    var isExtracting = false
    var colors: [Color] = []

    func extractColors() async {
        // Heavy computation happens here, testable without SwiftUI
        let extracted = await heavyComputation()
        colors = extracted
    }
}
```

**Why this matters for app composition**
- App-level state changes (loading → authenticated) should be **synchronous**
- Heavy work (session validation, data loading) should be **async in the model**
- This separation makes state machines testable without SwiftUI imports

---

# Part 2: Root View Switching Patterns

## Core Principle

> "The @main entry point should be a thin shell. All logic belongs in AppStateController."

## The Clean @main Pattern

```swift
@main
struct MyApp: App {
    @State private var appState = AppStateController()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .task {
                    await appState.initialize()
                }
        }
    }
}
```

**What @main does**
- Creates AppStateController
- Injects it via environment
- Triggers initialization

**What @main does NOT do**
- Business logic
- Auth checks
- Conditional rendering
- Navigation decisions

## RootView: The State Switch

```swift
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
    }
}
```

## Preventing Flicker During Transitions

### Problem: Flash of Wrong Content

When app state changes, you might see a flash of the old screen before the new one appears. This happens when:
- State changes before view is ready
- No transition animation
- Loading state too short to perceive

### Solution: Animated Transitions

```swift
struct RootView: View {
    @Environment(AppStateController.self) private var appState

    var body: some View {
        ZStack {
            switch appState.state {
            case .loading:
                LaunchView()
                    .transition(.opacity)
            case .unauthenticated:
                AuthenticationFlow()
                    .transition(.opacity)
            case .onboarding(let step):
                OnboardingFlow(step: step)
                    .transition(.opacity)
            case .authenticated(let user):
                MainTabView(user: user)
                    .transition(.opacity)
            case .error(let error):
                ErrorRecoveryView(error: error)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appState.state)
    }
}
```

### Minimum Loading Duration

For a polished experience, ensure the loading screen is visible long enough:

```swift
extension AppStateController {
    func initialize() async {
        let startTime = Date()

        // Do actual initialization
        await performInitialization()

        // Ensure minimum display time for loading screen
        let elapsed = Date().timeIntervalSince(startTime)
        let minimumDuration: TimeInterval = 0.5
        if elapsed < minimumDuration {
            try? await Task.sleep(for: .seconds(minimumDuration - elapsed))
        }
    }
}
```

## Coordinator Integration

If using coordinators, integrate them at the root level:

```swift
struct RootView: View {
    @Environment(AppStateController.self) private var appState
    @State private var authCoordinator = AuthCoordinator()
    @State private var mainCoordinator = MainCoordinator()

    var body: some View {
        Group {
            switch appState.state {
            case .loading:
                LaunchView()
            case .unauthenticated, .onboarding:
                AuthenticationFlow()
                    .environment(authCoordinator)
            case .authenticated(let user):
                MainTabView(user: user)
                    .environment(mainCoordinator)
            case .error(let error):
                ErrorRecoveryView(error: error)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appState.state)
    }
}
```

---

# Part 3: Scene Lifecycle Integration

## Core Principle

> "Scene lifecycle events are app-wide concerns handled centrally, not scattered across features."

## Understanding ScenePhase (Apple Documentation)

ScenePhase indicates a scene's operational state. How you interpret the value depends on **where it's read**.

**Read from a View** → Returns the phase of the enclosing scene
**Read from App** → Returns an **aggregate** value reflecting all scenes

| Phase | Description |
|-------|-------------|
| `.active` | Scene is in the foreground and interactive |
| `.inactive` | Scene is in the foreground but should pause work |
| `.background` | Scene isn't visible; app may terminate soon |

**Critical insight from Apple docs** When reading at the App level, `.active` means *any* scene is active, and `.background` means *all* scenes are in background.

## scenePhase Handling

```swift
@main
struct MyApp: App {
    @State private var appState = AppStateController()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .task {
                    await appState.initialize()
                }
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            handleScenePhaseChange(from: oldPhase, to: newPhase)
        }
    }

    private func handleScenePhaseChange(from: ScenePhase, to: ScenePhase) {
        switch to {
        case .active:
            // App became active — validate session, refresh data
            Task {
                await appState.validateSession()
                await appState.refreshIfNeeded()
            }

        case .inactive:
            // App about to go inactive — save state
            appState.prepareForBackground()

        case .background:
            // App in background — release resources
            appState.releaseResources()

        @unknown default:
            break
        }
    }
}
```

## Session Validation on Active

```swift
extension AppStateController {
    func validateSession() async {
        guard case .authenticated(let user) = state else { return }

        do {
            // Check if token is still valid
            let isValid = try await AuthService.validateToken(user.token)
            if !isValid {
                transition(to: .error(.sessionExpired))
            }
        } catch {
            // Network error — keep authenticated but show warning
            // Don't immediately log out on transient network issues
        }
    }

    func prepareForBackground() {
        // Save any pending data
        // Cancel non-essential network requests
        // Prepare for potential termination
    }

    func releaseResources() {
        // Release cached images
        // Stop location updates if not essential
        // Reduce memory footprint
    }
}
```

## SceneStorage for State Restoration

From Apple documentation: SceneStorage provides automatic state restoration. The system manages saving and restoring on your behalf.

**Key constraints**
- Keep data lightweight (not full models)
- Each Scene has its own storage (not shared)
- Data destroyed when scene is explicitly destroyed

```swift
struct MainTabView: View {
    @SceneStorage("selectedTab") private var selectedTab = 0
    @SceneStorage("lastViewedItemID") private var lastViewedItemID: String?

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeTab()
                .tag(0)
            SearchTab()
                .tag(1)
            ProfileTab()
                .tag(2)
        }
        .onAppear {
            if let itemID = lastViewedItemID {
                // Restore to last viewed item
                navigateToItem(itemID)
            }
        }
    }
}
```

### Navigation State Restoration (WWDC 2022/10054)

For complex navigation, use a Codable NavigationModel:

```swift
// Encapsulate navigation state with Codable conformance
class NavigationModel: ObservableObject, Codable {
    @Published var selectedCategory: Category?
    @Published var recipePath: [Recipe] = []

    enum CodingKeys: String, CodingKey {
        case selectedCategory
        case recipePathIds
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(selectedCategory, forKey: .selectedCategory)
        // Store only IDs, not full models
        try container.encode(recipePath.map(\.id), forKey: .recipePathIds)
    }

    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.selectedCategory = try container.decodeIfPresent(
            Category.self, forKey: .selectedCategory)

        let recipePathIds = try container.decode([Recipe.ID].self, forKey: .recipePathIds)
        // compactMap discards deleted items gracefully
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
}

// Use with SceneStorage
struct ContentView: View {
    @StateObject private var navModel = NavigationModel()
    @SceneStorage("navigation") private var data: Data?

    var body: some View {
        NavigationSplitView { /* ... */ }
        .task {
            if let data = data {
                navModel.jsonData = data
            }
            for await _ in navModel.objectWillChangeSequence {
                data = navModel.jsonData
            }
        }
    }
}
```

**Key patterns from WWDC**
- Store **IDs only**, not full model objects
- Use `compactMap` to handle deleted items gracefully
- Save on every `objectWillChange` for real-time persistence

### Validating Restored State

Never trust restored state blindly:

```swift
struct DetailView: View {
    @SceneStorage("detailItemID") private var restoredItemID: String?
    @State private var item: Item?

    var body: some View {
        Group {
            if let item {
                ItemContent(item: item)
            } else {
                ProgressView()
            }
        }
        .task {
            if let itemID = restoredItemID {
                // Validate item still exists
                item = await ItemService.fetch(itemID)
                if item == nil {
                    // Item was deleted — clear restoration
                    restoredItemID = nil
                }
            }
        }
    }
}
```

## Multi-Window Coordination (iPad, axiom-visionOS)

From Apple documentation: Every window in a WindowGroup maintains **independent state**. The system allocates new storage for @State and @StateObject for each window.

```swift
@main
struct MyApp: App {
    @State private var appState = AppStateController()

    var body: some Scene {
        // Primary window
        WindowGroup {
            MainView()
                .environment(appState)
        }

        // Data-presenting window (iPad)
        // Prefer lightweight data (IDs, not full models)
        WindowGroup("Detail", id: "detail", for: Item.ID.self) { $itemID in
            if let itemID {
                DetailView(itemID: itemID)
                    .environment(appState)
            }
        }

        #if os(visionOS)
        // Immersive space
        ImmersiveSpace(id: "immersive") {
            ImmersiveView()
                .environment(appState)
        }
        #endif
    }
}
```

**Key behaviors from Apple docs**
- If a window with the same value already exists, the system **brings it to front** instead of opening a new one
- SwiftUI persists the binding value for state restoration
- Use unique identifier strings for each window group

### Opening Additional Windows

```swift
struct ItemRow: View {
    let item: Item
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button(item.title) {
            // Open in new window on iPad
            // Use ID to match window group, value to pass data
            openWindow(id: "detail", value: item.id)
        }
    }
}
```

### Dismissing Windows Programmatically

```swift
struct DetailView: View {
    var itemID: Item.ID?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack {
            // ...
            Button("Done") {
                dismiss()  // Closes this window
            }
        }
    }
}
```

---

# Part 4: Feature Module Basics

## Core Principle

> "Split into modules when features have clear boundaries. Not before."

Premature modularization creates overhead. Late modularization creates pain. Use this decision tree.

## When to Modularize Decision Tree

```
Should I extract this feature into a module?
│
├─ Is the codebase under 5,000 lines with 1-2 developers?
│  └─ NO modularization needed yet
│     Single target is fine, revisit at 10,000 lines
│
├─ Is the codebase 5,000-20,000 lines with 3+ developers?
│  └─ CONSIDER modularization
│     Look for natural boundaries
│
├─ Is the codebase over 20,000 lines?
│  └─ MODULARIZE for build times
│     Parallel compilation essential
│
├─ Could this feature be used in multiple apps?
│  └─ EXTRACT to reusable module
│     Shared authentication, analytics, axiom-networking
│
├─ Do multiple developers work on this feature daily?
│  └─ EXTRACT for merge conflict reduction
│     Isolated codebases = parallel work
│
└─ Does the feature have clear input/output boundaries?
   ├─ YES → Good candidate for module
   └─ NO → Refactor boundaries first, then extract
```

## Module Boundary Pattern

### Define a Public API

```swift
// FeatureModule/Sources/FeatureModule/FeatureAPI.swift

/// Public interface for the feature module
public protocol FeatureAPI {
    /// Show the feature's main view
    @MainActor
    func makeMainView() -> AnyView

    /// Handle deep link into feature
    @MainActor
    func handleDeepLink(_ url: URL) -> Bool
}

/// Factory to create feature with dependencies
public struct FeatureFactory {
    public static func create(
        analytics: AnalyticsProtocol,
        networking: NetworkingProtocol
    ) -> FeatureAPI {
        FeatureImplementation(
            analytics: analytics,
            networking: axiom-networking
        )
    }
}
```

### Internal Implementation

```swift
// FeatureModule/Sources/FeatureModule/Internal/FeatureImplementation.swift

internal class FeatureImplementation: FeatureAPI {
    private let analytics: AnalyticsProtocol
    private let networking: NetworkingProtocol

    internal init(
        analytics: AnalyticsProtocol,
        networking: NetworkingProtocol
    ) {
        self.analytics = analytics
        self.networking = networking
    }

    @MainActor
    public func makeMainView() -> AnyView {
        AnyView(FeatureMainView(viewModel: makeViewModel()))
    }

    public func handleDeepLink(_ url: URL) -> Bool {
        // Handle feature-specific deep links
        return false
    }

    private func makeViewModel() -> FeatureViewModel {
        FeatureViewModel(analytics: analytics, axiom-networking: axiom-networking)
    }
}
```

### Use in Main App

```swift
// MainApp/Sources/App/AppDependencies.swift

@Observable
class AppDependencies {
    let analytics: AnalyticsProtocol
    let networking: NetworkingProtocol

    // Lazy-created feature modules
    lazy var profileFeature: FeatureAPI = {
        ProfileFeatureFactory.create(
            analytics: analytics,
            networking: axiom-networking
        )
    }()

    lazy var settingsFeature: FeatureAPI = {
        SettingsFeatureFactory.create(
            analytics: analytics,
            networking: axiom-networking
        )
    }()
}

// MainApp/Sources/App/MainTabView.swift

struct MainTabView: View {
    @Environment(AppDependencies.self) private var dependencies

    var body: some View {
        TabView {
            dependencies.profileFeature.makeMainView()
                .tabItem { Label("Profile", systemImage: "person") }

            dependencies.settingsFeature.makeMainView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
    }
}
```

## Navigation Coordination Between Modules

Features should not know about each other directly:

```swift
// ❌ Feature knows about other features
struct ProfileView: View {
    func showSettings() {
        // ProfileView imports SettingsFeature — circular dependency risk
        NavigationLink(value: SettingsDestination())
    }
}

// ✅ Feature delegates navigation to coordinator
struct ProfileView: View {
    let onShowSettings: () -> Void

    func showSettings() {
        onShowSettings()  // ProfileView doesn't know what happens
    }
}

// Coordinator wires features together
class MainCoordinator {
    func showSettings(from profile: ProfileFeatureAPI) {
        // Coordinator knows about both features
        navigationPath.append(SettingsRoute())
    }
}
```

## Module Folder Structure

```
MyApp/
├── App/                          # Main app target
│   ├── MyApp.swift               # @main entry point
│   ├── AppDependencies.swift     # Dependency container
│   ├── AppStateController.swift  # App state machine
│   └── Coordinators/             # Navigation coordinators
│
├── Packages/
│   ├── Core/                     # Shared utilities
│   │   ├── Networking/
│   │   ├── Analytics/
│   │   └── Design/               # Design system
│   │
│   ├── Features/                 # Feature modules
│   │   ├── Profile/
│   │   ├── Settings/
│   │   └── Onboarding/
│   │
│   └── Domain/                   # Business logic
│       ├── Models/
│       └── Services/
```

---

# Part 5: Anti-Patterns

## Anti-Pattern 1: Boolean-Based State

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

**Fix** Use enum-based state (Part 1)

```swift
// ✅ Explicit states — compiler prevents invalid combinations
enum AppState {
    case loading
    case unauthenticated
    case onboarding(OnboardingStep)
    case authenticated(User)
    case error(AppError)
}
```

## Anti-Pattern 2: Logic in @main

```swift
// ❌ Business logic in App entry point
@main
struct MyApp: App {
    @State private var user: User?
    @State private var isLoading = true

    var body: some Scene {
        WindowGroup {
            if isLoading {
                LoadingView()
            } else if let user {
                MainView(user: user)
            } else {
                LoginView(onLogin: { self.user = $0 })
            }
        }
        .task {
            user = await AuthService.getCurrentUser()
            isLoading = false
        }
    }
}
```

**Problems**
- @main becomes bloated with logic
- Hard to test without launching app
- State scattered across multiple @State

**Fix** Delegate to AppStateController (Part 2)

```swift
// ✅ @main is a thin shell
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
```

## Anti-Pattern 3: Missing State Validation on Restore

```swift
// ❌ Trusts restored state blindly
.onAppear {
    if let savedState = SceneStorage.appState {
        appState.state = savedState  // Token might be expired!
    }
}
```

**Problems**
- Session could have expired
- User could have been logged out on another device
- Data could have been deleted

**Fix** Validate before applying (Part 3)

```swift
// ✅ Validates restored state
.task {
    if let savedSession = await SessionStorage.loadSession() {
        do {
            let user = try await AuthService.validateSession(savedSession)
            appState.transition(to: .authenticated(user))
        } catch {
            // Session invalid — force re-login
            await SessionStorage.clearSession()
            appState.transition(to: .unauthenticated)
        }
    }
}
```

## Anti-Pattern 4: Navigation Logic Scattered Across Features

```swift
// ❌ Every feature knows about every other feature
struct ProfileView: View {
    @Environment(\.navigationPath) private var path

    func showSettings() {
        path.append(SettingsDestination())  // ProfileView imports Settings
    }

    func showOrderHistory() {
        path.append(OrderHistoryDestination())  // ProfileView imports Orders
    }
}
```

**Problems**
- Circular dependencies
- Hard to test navigation
- Changes ripple across modules

**Fix** Delegate to coordinator (Part 4)

```swift
// ✅ Feature delegates navigation decisions
struct ProfileView: View {
    let onShowSettings: () -> Void
    let onShowOrderHistory: () -> Void

    // ProfileView doesn't know what these do
}
```

## Anti-Pattern 5: God Coordinator

```swift
// ❌ Single coordinator knows all features
class AppCoordinator {
    func showProfile() { }
    func showSettings() { }
    func showOnboarding() { }
    func showPayment() { }
    func showChat() { }
    func showOrderHistory() { }
    func showNotifications() { }
    // ... 50 more methods
}
```

**Problems**
- Massive file that everyone touches
- Merge conflicts
- Single point of failure

**Fix** Scoped coordinators

```swift
// ✅ Scoped coordinators for each domain
class AuthCoordinator { }      // Login, signup, forgot password
class MainCoordinator { }      // Tab navigation, main flows
class SettingsCoordinator { }  // Settings navigation tree
class OrderCoordinator { }     // Order flow, history, details
```

---

# Part 6: Pressure Scenarios

## Scenario 1: "Just hardcode the root for now"

### The Pressure

> "We only have one flow right now. Just show MainView directly, we'll add auth later."

### Red Flags
- "We'll add X later" → Tech debt that compounds
- "It's just one flow" → Flows multiply
- "Keep it simple" → Simplicity now, complexity later

### Time Cost Comparison

| Option | Initial | When Adding Auth | Total |
|--------|---------|------------------|-------|
| Hardcode MainView | 0 min | 2-4 hours refactor | 2-4 hours |
| AppStateController | 30 min | 30 min add state | 1 hour |

### Push-Back Script

> "The AppStateController pattern takes 30 minutes now. When we add auth later — and we will — it'll take another 30 minutes to add the state. Hardcoding now saves 0 minutes because we'll spend 2-4 hours refactoring when we need auth. Let's invest 30 minutes now."

### What to Do

1. Create minimal AppStateController with two states:
   ```swift
   enum AppState {
       case loading
       case ready
   }
   ```

2. When auth is needed, add states:
   ```swift
   enum AppState {
       case loading
       case unauthenticated  // Added
       case authenticated(User)  // Added
   }
   ```

3. Total effort: 1 hour instead of 4 hours

---

## Scenario 2: "We don't need modules yet"

### The Pressure

> "Let's keep everything in one target. Modules are over-engineering."

### Decision Framework

| Codebase | Team | Recommendation |
|----------|------|----------------|
| < 5,000 lines | 1-2 devs | Single target is fine |
| 5,000-20,000 lines | 3+ devs | Consider modules |
| > 20,000 lines | Any | Modules essential |

### Push-Back Script

> "I agree modules add overhead. Let's use this decision tree: We have [X] lines and [Y] developers. Based on that, we [should/shouldn't] modularize yet. If we hit [threshold], we'll revisit. Sound good?"

### What to Do

1. Check codebase size: `find . -name "*.swift" | xargs wc -l`
2. If under threshold, document decision and threshold for revisit
3. If over threshold, identify natural boundaries first

---

## Scenario 3: "Navigation is too complex to test"

### The Pressure

> "Testing navigation state is too hard. Let's just do manual QA."

### Why This Fails

- Navigation bugs are #1 "works on my machine" cause
- Deep linking requires automated verification
- State restoration needs regression testing
- Manual QA misses edge cases

### Solution: Test the State Machine

```swift
// ✅ Test navigation state without UI
@Test func testLoginCompletesOnboarding() async {
    let controller = AppStateController()
    controller.transition(to: .unauthenticated)

    // Simulate login
    await controller.handleLogin(user: mockUser)

    // First-time user goes to onboarding
    #expect(controller.state == .onboarding(.welcome))
}

@Test func testDeepLinkWhileUnauthenticated() async {
    let controller = AppStateController()
    controller.transition(to: .unauthenticated)

    // Deep link to order
    let handled = controller.handleDeepLink(URL(string: "app://order/123")!)

    // Should not navigate — requires auth
    #expect(handled == false)
    #expect(controller.state == .unauthenticated)
}
```

### Push-Back Script

> "Navigation is complex, which is exactly why we need automated tests. The AppStateController pattern lets us test state transitions without launching the UI. We can verify deep linking, auth flows, and restoration in seconds. Manual QA can't catch all the combinations."

---

# Part 7: Code Review Checklist

## App State

- [ ] App state is an enum, not booleans
- [ ] All valid states are explicitly defined
- [ ] State transitions are validated in `isValidTransition`
- [ ] Invalid transitions are caught (assertion in debug, logged in prod)
- [ ] State changes are logged for debugging

## Root View

- [ ] @main delegates to AppStateController
- [ ] No business logic in @main
- [ ] RootView switches on single source of truth
- [ ] Transitions are animated (no flicker)
- [ ] Loading state has minimum display duration

## Scene Lifecycle

- [ ] scenePhase changes handled in one place
- [ ] Session validated on .active (not blindly trusted)
- [ ] Resources released on .background
- [ ] SceneStorage used for tab selection / navigation state
- [ ] Restored state validated before applying

## Module Boundaries

- [ ] Features have public API protocols
- [ ] No circular dependencies between modules
- [ ] Navigation delegates to coordinators
- [ ] Dependencies injected, not singletons
- [ ] Module decision documented (why split / not split)

## Testing

- [ ] State transitions tested without UI
- [ ] Invalid transitions tested
- [ ] Deep link handling tested
- [ ] Restoration validation tested

---

## Resources

**WWDC**: 2025-266, 2024-10150, 2023-10149, 2025-256, 2022-10054

**Docs**: /swiftui/scenephase, /swiftui/scene, /swiftui/scenestorage, /swiftui/windowgroup, /observation/observable()

**Skills**: axiom-swiftui-architecture, axiom-swiftui-nav, axiom-swift-concurrency
