# deep-link-debugging

Add debug-only deep links for automated testing and closed-loop debugging with visual verification.

##When to Use

- Adding debug-only deep links for simulator testing
- Enabling automated navigation to specific screens
- Integrating with `simulator-tester` agent
- Testing navigation flows without manual tapping
- Need to navigate programmatically without production deep link implementation

**Do NOT use for**:
- Production deep linking (use `swiftui-nav` skill instead)
- Universal links or App Clips
- Complex routing architectures

## Problem This Solves

**Without debug deep links**:
- Manual navigation required for every test
- Screenshot capture can't reach specific screens
- 2-3 minutes per testing iteration

**With debug deep links**:
- Automated navigation: `xcrun simctl openurl booted "debug://settings"`
- Claude Code can verify fixes with screenshots
- 45 seconds per iteration (60-75% faster)

## Quick Start

### 1. Add Debug URL Scheme (SwiftUI)

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

        switch url.host {
        case "settings":
            NotificationCenter.default.post(
                name: .navigateToSettings,
                object: nil
            )

        case "profile":
            let userID = url.queryItems?["id"] ?? "current"
            NotificationCenter.default.post(
                name: .navigateToProfile,
                object: userID
            )

        default:
            print("⚠️ Unknown debug URL: \(url)")
        }
    }
    #endif
}
```

### 2. Navigate from Simulator

```bash
# Navigate to settings
xcrun simctl openurl booted "debug://settings"

# Navigate to specific profile
xcrun simctl openurl booted "debug://profile?id=123"
```

### 3. Integration with Testing

```bash
# Take screenshot of specific screen
xcrun simctl openurl booted "debug://settings"
sleep 1
/axiom:screenshot
```

## Patterns

### Pattern 1: Basic Navigation

Simple screen navigation without parameters.

```swift
#if DEBUG
switch url.host {
case "home": path.append(Destination.home)
case "settings": path.append(Destination.settings)
case "profile": path.append(Destination.profile)
}
#endif
```

**Usage**: `xcrun simctl openurl booted "debug://settings"`

---

### Pattern 2: Parameterized Navigation

Navigate with specific IDs or configuration.

```swift
#if DEBUG
case "recipe":
    if let id = url.queryItems?["id"], let recipeID = Int(id) {
        path.append(Destination.recipe(id: recipeID))
    }
#endif
```

**Usage**: `xcrun simctl openurl booted "debug://recipe?id=42"`

---

### Pattern 3: State Configuration

Navigate AND configure state for testing.

```swift
#if DEBUG
case "login-error":
    path.append(Destination.login)
    UserDefaults.standard.set(true, forKey: "debug_showError")
    NotificationCenter.default.post(
        name: .showLoginError,
        object: "Invalid credentials"
    )
#endif
```

**Usage**: `xcrun simctl openurl booted "debug://login-error"`

---

### Pattern 4: NavigationPath Integration (iOS 16+)

Integrate with NavigationStack for robust navigation.

```swift
@MainActor
class DebugRouter: ObservableObject {
    @Published var path = NavigationPath()

    #if DEBUG
    func handleDebugURL(_ url: URL) {
        guard url.scheme == "debug" else { return }

        switch url.host {
        case "settings":
            path.append(Destination.settings)
        case "reset":
            path = NavigationPath() // Pop to root
        default:
            print("⚠️ Unknown debug URL: \(url)")
        }
    }
    #endif
}
```

---

## Info.plist Configuration

### Option 1: Always Include (Simplest)

Add to Info.plist:

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

### Option 2: Strip from Release Builds

Add Run Script phase (before "Copy Bundle Resources"):

```bash
# Strip debug URL scheme from Release builds
if [ "${CONFIGURATION}" = "Release" ]; then
    echo "Removing debug URL scheme from Info.plist"
    /usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes:0" \
        "${BUILT_PRODUCTS_DIR}/${INFOPLIST_PATH}" 2>/dev/null || true
fi
```

---

## Common Mistakes

### ❌ Leaving Debug Code in Production

```swift
// ❌ WRONG — No #if DEBUG
func handleDebugURL(_ url: URL) {
    // This ships to users!
}
```

**✅ RIGHT — Wrap in #if DEBUG**:
```swift
#if DEBUG
func handleDebugURL(_ url: URL) {
    // Stripped from release builds
}
#endif
```

---

### ❌ Hardcoding Navigation Logic

```swift
#if DEBUG
func handleDebugURL(_ url: URL) {
    if url.host == "settings" {
        // ❌ WRONG — Duplicates router logic
        self.showingSettings = true
    }
}
#endif
```

**✅ RIGHT — Use Existing Navigation**:
```swift
#if DEBUG
func handleDebugURL(_ url: URL) {
    if url.host == "settings" {
        path.append(Destination.settings)  // Use existing NavigationPath
    }
}
#endif
```

---

### ❌ Missing Parameter Validation

```swift
#if DEBUG
case "profile":
    let userID = Int(url.queryItems?["id"] ?? "0")!  // ❌ Force unwrap
    path.append(Destination.profile(id: userID))
#endif
```

**✅ RIGHT — Validate Parameters**:
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

Before using in automated workflows:

- [ ] URL handler wrapped in `#if DEBUG`
- [ ] All deep links tested manually in simulator
- [ ] Parameters validated (no force unwraps)
- [ ] Deep links use existing navigation (no duplicate logic)
- [ ] URL scheme stripped from Release builds
- [ ] Works with `/axiom:screenshot` command
- [ ] Works with `simulator-tester` agent

---

## Integration Examples

### With /axiom:screenshot

```bash
# Navigate + screenshot
xcrun simctl openurl booted "debug://settings"
sleep 1
/axiom:screenshot
```

### With simulator-tester Agent

```
User: "Navigate to Settings and take a screenshot"

Agent:
1. Opens deep link: debug://settings
2. Waits for render
3. Captures screenshot
4. Analyzes: "Settings screen shows..."
```

---

## Real-World Example

**Scenario**: Debugging recipe editor layout

**Before** (manual):
1. Build → 30s
2. Launch simulator
3. Tap "Recipes"
4. Scroll to recipe #42
5. Tap to open
6. Tap "Edit"
7. Check layout
**Total**: 2-3 minutes per iteration

**After** (with debug links):
1. Build → 30s
2. `xcrun simctl openurl booted "debug://recipe-edit?id=42"`
3. `/axiom:screenshot`
4. Claude verifies layout
**Total**: 45 seconds per iteration

**Time savings**: 60-75%

---

## Related

- **`simulator-tester` agent** — Uses deep links for automated testing
- **`xcode-debugging` skill** — Environment-first debugging
- **`swiftui-nav` skill** — Production navigation patterns
- **`/axiom:screenshot`** — Quick screenshot capture
- **`/axiom:test-simulator`** — Full simulator testing

## Requirements

- iOS 13+ (for `onOpenURL`)
- iOS 16+ for NavigationPath integration (recommended)

---

**Key insight**: Debug deep links enable closed-loop debugging with 60-75% faster iteration.
