---
name: axiom-deep-link-debugging
description: Use when adding debug-only deep links for testing, enabling simulator navigation to specific screens, or integrating with automated testing workflows - enables closed-loop debugging without production deep link implementation
license: MIT
compatibility: iOS 13+
metadata:
  version: "1.0.0"
  last-updated: "2025-12-08"
---

# Deep Link Debugging

## When to Use This Skill

Use when:
- Adding debug-only deep links for simulator testing
- Enabling automated navigation to specific screens for screenshot/testing
- Integrating with `simulator-tester` agent or `/axiom:screenshot`
- Need to navigate programmatically without production deep link implementation
- Testing navigation flows without manual tapping

**Do NOT use for**:
- Production deep linking (use `axiom-swiftui-nav` skill instead)
- Universal links or App Clips
- Complex routing architectures

## Example Prompts

#### 1. "Claude Code can't navigate to specific screens for testing"
→ Add debug-only URL scheme to enable `xcrun simctl openurl` navigation

#### 2. "I want to take screenshots of different screens automatically"
→ Create debug deep links for each screen, callable from simulator

#### 3. "Automated testing needs to set up specific app states"
→ Add debug links that navigate AND configure state

---

## Red Flags — When You Need Debug Deep Links

If you're experiencing ANY of these, add debug deep links:

**Testing friction**:
- ❌ "I have to manually tap through 5 screens to test this feature"
- ❌ "Screenshot capture can't show the screen I need to debug"
- ❌ "Automated tests can't reach the error state without complex setup"

**Debugging inefficiency**:
- ❌ "I make a fix, rebuild, manually navigate, check — takes 3 minutes per iteration"
- ❌ "Can't visually verify fixes because Claude Code can't navigate there"

**Solution**: Add debug deep links that let you (and Claude Code) jump directly to any screen with any state configuration.

---

## Implementation

### Pattern 1: Basic Debug URL Scheme (SwiftUI)

Add a debug-only URL scheme that routes to screens.

```swift
import SwiftUI

struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                #if DEBUG
                .onOpenURL { url in
                    handleDebugURL(url)
                }
                #endif
        }
    }

    #if DEBUG
    private func handleDebugURL(_ url: URL) {
        guard url.scheme == "debug" else { return }

        // Route based on host
        switch url.host {
        case "settings":
            // Navigate to settings
            NotificationCenter.default.post(
                name: .navigateToSettings,
                object: nil
            )

        case "profile":
            // Navigate to profile
            let userID = url.queryItems?["id"] ?? "current"
            NotificationCenter.default.post(
                name: .navigateToProfile,
                object: userID
            )

        case "reset":
            // Reset app to initial state
            resetApp()

        default:
            print("⚠️ Unknown debug URL: \(url)")
        }
    }
    #endif
}

#if DEBUG
extension Notification.Name {
    static let navigateToSettings = Notification.Name("navigateToSettings")
    static let navigateToProfile = Notification.Name("navigateToProfile")
}

extension URL {
    var queryItems: [String: String]? {
        guard let components = URLComponents(url: self, resolvingAgainstBaseURL: false),
              let items = components.queryItems else {
            return nil
        }
        return Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
    }
}
#endif
```

**Usage**:
```bash
# From simulator
xcrun simctl openurl booted "debug://settings"
xcrun simctl openurl booted "debug://profile?id=123"
xcrun simctl openurl booted "debug://reset"
```

---

### Pattern 2: NavigationPath Integration (iOS 16+)

Integrate debug deep links with NavigationStack for robust navigation.

```swift
import SwiftUI

@MainActor
class DebugRouter: ObservableObject {
    @Published var path = NavigationPath()

    #if DEBUG
    func handleDebugURL(_ url: URL) {
        guard url.scheme == "debug" else { return }

        switch url.host {
        case "settings":
            path.append(Destination.settings)

        case "recipe":
            if let id = url.queryItems?["id"], let recipeID = Int(id) {
                path.append(Destination.recipe(id: recipeID))
            }

        case "recipe-edit":
            if let id = url.queryItems?["id"], let recipeID = Int(id) {
                // Navigate to recipe, then to edit
                path.append(Destination.recipe(id: recipeID))
                path.append(Destination.recipeEdit(id: recipeID))
            }

        case "reset":
            path = NavigationPath() // Pop to root

        default:
            print("⚠️ Unknown debug URL: \(url)")
        }
    }
    #endif
}

struct ContentView: View {
    @StateObject private var router = DebugRouter()

    var body: some View {
        NavigationStack(path: $router.path) {
            HomeView()
                .navigationDestination(for: Destination.self) { destination in
                    destinationView(for: destination)
                }
        }
        #if DEBUG
        .onOpenURL { url in
            router.handleDebugURL(url)
        }
        #endif
    }

    @ViewBuilder
    private func destinationView(for destination: Destination) -> some View {
        switch destination {
        case .settings:
            SettingsView()
        case .recipe(let id):
            RecipeDetailView(recipeID: id)
        case .recipeEdit(let id):
            RecipeEditView(recipeID: id)
        }
    }
}

enum Destination: Hashable {
    case settings
    case recipe(id: Int)
    case recipeEdit(id: Int)
}
```

**Usage**:
```bash
# Navigate to settings
xcrun simctl openurl booted "debug://settings"

# Navigate to recipe #42
xcrun simctl openurl booted "debug://recipe?id=42"

# Navigate to recipe #42 edit screen
xcrun simctl openurl booted "debug://recipe-edit?id=42"

# Pop to root
xcrun simctl openurl booted "debug://reset"
```

---

### Pattern 3: State Configuration Links

Debug links that both navigate AND configure state.

```swift
#if DEBUG
extension DebugRouter {
    func handleDebugURL(_ url: URL) {
        guard url.scheme == "debug" else { return }

        switch url.host {
        case "login":
            // Show login screen
            path.append(Destination.login)

        case "login-error":
            // Show login screen WITH error state
            path.append(Destination.login)
            // Trigger error state
            NotificationCenter.default.post(
                name: .showLoginError,
                object: "Invalid credentials"
            )

        case "recipe-empty":
            // Show recipe list in empty state
            UserDefaults.standard.set(true, forKey: "debug_emptyRecipeList")
            path.append(Destination.recipes)

        case "recipe-error":
            // Show recipe list with network error
            UserDefaults.standard.set(true, forKey: "debug_networkError")
            path.append(Destination.recipes)

        default:
            print("⚠️ Unknown debug URL: \(url)")
        }
    }
}
#endif
```

**Usage**:
```bash
# Test login error state
xcrun simctl openurl booted "debug://login-error"

# Test empty recipe list
xcrun simctl openurl booted "debug://recipe-empty"

# Test network error handling
xcrun simctl openurl booted "debug://recipe-error"
```

---

### Pattern 4: Info.plist Configuration (DEBUG only)

Register the debug URL scheme ONLY in debug builds.

**Step 1**: Add scheme to Info.plist

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>debug</string>
        </array>
        <key>CFBundleURLName</key>
        <string>com.example.debug</string>
    </dict>
</array>
```

**Step 2**: Strip from release builds

Add a Run Script phase to your target's Build Phases (runs BEFORE "Copy Bundle Resources"):

```bash
# Strip debug URL scheme from Release builds
if [ "${CONFIGURATION}" = "Release" ]; then
    echo "Removing debug URL scheme from Info.plist"

    /usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes:0" "${BUILT_PRODUCTS_DIR}/${INFOPLIST_PATH}" 2>/dev/null || true
fi
```

**Alternative**: Use separate Info.plist files for Debug vs Release configurations in Build Settings.

---

## Integration with Simulator Testing

### With `/axiom:screenshot` Command

```bash
# 1. Navigate to screen
xcrun simctl openurl booted "debug://settings"

# 2. Wait for navigation
sleep 1

# 3. Capture screenshot
/axiom:screenshot
```

### With `simulator-tester` Agent

Simply tell the agent:
- "Navigate to Settings and take a screenshot"
- "Open the recipe editor and verify the layout"
- "Go to the error state and show me what it looks like"

The agent will use your debug deep links to navigate.

---

## Mandatory First Steps

**ALWAYS complete these steps** before adding debug deep links:

### Step 1: Define Navigation Needs

List all screens you need to reach for testing:
```
- Settings screen
- Profile screen (with specific user ID)
- Recipe detail (with specific recipe ID)
- Error states (login error, network error, etc.)
- Empty states (no recipes, no favorites)
```

### Step 2: Choose URL Scheme Pattern

```
debug://screen-name              # Simple screen navigation
debug://screen-name?param=value  # Navigation with parameters
debug://state-name               # State configuration
```

### Step 3: Add URL Handler

Use `#if DEBUG` to ensure code is stripped from release builds.

### Step 4: Test Deep Links

```bash
# Boot simulator
xcrun simctl boot "iPhone 16 Pro"

# Launch app
xcrun simctl launch booted com.example.YourApp

# Test each deep link
xcrun simctl openurl booted "debug://settings"
xcrun simctl openurl booted "debug://profile?id=123"
```

---

## Common Mistakes

### ❌ WRONG — Hardcoding navigation in URL handler

```swift
#if DEBUG
func handleDebugURL(_ url: URL) {
    if url.host == "settings" {
        // ❌ WRONG — Creates tight coupling
        self.showingSettings = true
    }
}
#endif
```

**Problem**: URL handler now owns navigation logic, duplicating coordinator/router patterns.

**✅ RIGHT — Use existing navigation system**:
```swift
#if DEBUG
func handleDebugURL(_ url: URL) {
    if url.host == "settings" {
        // Use existing NavigationPath
        path.append(Destination.settings)
    }
}
#endif
```

---

### ❌ WRONG — Leaving debug code in production

```swift
// ❌ WRONG — No #if DEBUG
func handleDebugURL(_ url: URL) {
    // This ships to users!
}
```

**Problem**: Debug endpoints exposed in production. Security risk.

**✅ RIGHT — Wrap in #if DEBUG**:
```swift
#if DEBUG
func handleDebugURL(_ url: URL) {
    // Stripped from release builds
}
#endif
```

---

### ❌ WRONG — Using query parameters without validation

```swift
#if DEBUG
case "profile":
    let userID = Int(url.queryItems?["id"] ?? "0")! // ❌ Force unwrap
    path.append(Destination.profile(id: userID))
#endif
```

**Problem**: Crashes if `id` is missing or invalid.

**✅ RIGHT — Validate parameters**:
```swift
#if DEBUG
case "profile":
    guard let idString = url.queryItems?["id"],
          let userID = Int(idString) else {
        print("⚠️ Invalid profile ID")
        return
    }
    path.append(Destination.profile(id: userID))
#endif
```

---

## Testing Checklist

Before using debug deep links in automated workflows:

- [ ] URL handler wrapped in `#if DEBUG`
- [ ] All deep links tested manually in simulator
- [ ] Parameters validated (don't force unwrap)
- [ ] Deep links integrate with existing navigation (don't duplicate logic)
- [ ] URL scheme stripped from Release builds (script or separate Info.plist)
- [ ] Documented in README or comments for other developers
- [ ] Works with `/axiom:screenshot` command
- [ ] Works with `simulator-tester` agent

---

## Real-World Example

**Scenario**: You're debugging a recipe app layout issue in the editor screen.

**Before** (manual testing):
1. Build app → 30 seconds
2. Launch simulator
3. Tap "Recipes" → wait for load
4. Scroll to recipe #42
5. Tap to open detail
6. Tap "Edit"
7. Check if layout is fixed
8. Make change, rebuild → repeat from step 1
**Total**: 2-3 minutes per iteration

**After** (with debug deep links):
1. Build app → 30 seconds
2. Run: `xcrun simctl openurl booted "debug://recipe-edit?id=42"`
3. Run: `/axiom:screenshot`
4. Claude analyzes screenshot and confirms layout fix
5. Make change if needed, rebuild → repeat from step 2
**Total**: 45 seconds per iteration

**Time savings**: 60-75% faster iteration with visual verification

---

## Integration with Existing Navigation

### For Apps Using NavigationStack

Add debug URL handler that appends to existing NavigationPath:

```swift
router.path.append(Destination.fromDebugURL(url))
```

### For Apps Using Coordinator Pattern

Trigger coordinator methods from debug URL handler:

```swift
coordinator.navigate(to: .fromDebugURL(url))
```

### For Apps Using Custom Routing

Integrate with your router's navigation API:

```swift
AppRouter.shared.push(Screen.fromDebugURL(url))
```

**Key principle**: Debug deep links should USE existing navigation, not replace it.

---

## Advanced Patterns

### Pattern 5: Parameterized State Setup

```swift
#if DEBUG
case "test-scenario":
    // Parse complex test scenario from URL
    // Example: debug://test-scenario?user=premium&recipes=empty&network=slow

    if let userType = url.queryItems?["user"] {
        configureUser(type: userType) // "premium", "free", "trial"
    }

    if let recipesState = url.queryItems?["recipes"] {
        configureRecipes(state: recipesState) // "empty", "full", "error"
    }

    if let networkState = url.queryItems?["network"] {
        configureNetwork(state: networkState) // "fast", "slow", "offline"
    }

    // Now navigate
    path.append(Destination.recipes)
#endif
```

**Usage**:
```bash
# Test premium user with empty recipe list
xcrun simctl openurl booted "debug://test-scenario?user=premium&recipes=empty"

# Test slow network with error handling
xcrun simctl openurl booted "debug://test-scenario?network=slow&recipes=error"
```

---

### Pattern 6: Screenshot Automation Helper

Create a single URL that sets up AND captures state:

```swift
#if DEBUG
case "screenshot":
    // Parse screen and configuration
    guard let screen = url.queryItems?["screen"] else { return }

    // Configure state
    if let state = url.queryItems?["state"] {
        applyState(state)
    }

    // Navigate
    navigate(to: screen)

    // Post notification for external capture
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
        NotificationCenter.default.post(
            name: .readyForScreenshot,
            object: screen
        )
    }
#endif
```

**Usage**:
```bash
# Navigate to login screen with error state, wait, then screenshot
xcrun simctl openurl booted "debug://screenshot?screen=login&state=error"
sleep 2
xcrun simctl io booted screenshot login-error.png
```

---

## Related Skills

- `axiom-swiftui-nav` — Production deep linking and NavigationStack patterns
- `simulator-tester` — Automated simulator testing using debug deep links
- `axiom-xcode-debugging` — Environment-first debugging workflows

---

## Summary

Debug deep links enable:
- **Closed-loop debugging** with visual verification
- **60-75% faster iteration** on visual fixes
- **Automated testing** without manual navigation
- **Screenshot automation** for any app state

**Remember**:
1. Wrap ALL debug code in `#if DEBUG`
2. Strip URL scheme from release builds
3. Integrate with existing navigation, don't duplicate
4. Validate all parameters (no force unwraps)
5. Document for team members
