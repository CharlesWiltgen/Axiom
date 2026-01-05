---
name: deep-link-debugging
description: Debug-only deep links for automated testing and simulator verification
skill_type: discipline
version: 1.0.0
---

# Deep Link Debugging

Debug-only deep links for automated testing and simulator-based verification. Enables programmatic navigation to specific screens without production deep link implementation.

## When to Use This Skill

Use this skill when you're:
- Adding debug-only deep links for simulator testing
- Enabling automated navigation to specific screens
- Integrating with the simulator-tester agent
- Testing navigation flows without manual tapping
- Need programmatic navigation without production deep links

**Do NOT use for:**
- Production deep linking (use [swiftui-nav](/skills/ui-design/swiftui-nav) instead)
- Universal links or App Clips
- Complex routing architectures

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I add a debug-only deep link to navigate to settings?"
- "I want to test a specific screen without manually tapping through the app."
- "How do I navigate programmatically from the simulator command line?"
- "I need to verify a fix with screenshots but don't want to tap through navigation."

## What's Covered

### Debug URL Scheme Setup
- SwiftUI .onOpenURL handler
- #if DEBUG conditional compilation
- URL parsing and routing
- NotificationCenter for navigation triggers

### Simulator Integration
- xcrun simctl openurl commands
- Query parameter passing
- Integration with screenshot capture

### Time Savings
- Without debug links: 2-3 minutes per test iteration
- With debug links: 45 seconds per iteration (60-75% faster)

## Key Pattern

### Add Debug URL Scheme (SwiftUI)

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
            NotificationCenter.default.post(name: .navigateToSettings, object: nil)

        case "profile":
            let userID = url.queryItems?["id"] ?? "current"
            NotificationCenter.default.post(name: .navigateToProfile, object: userID)

        default:
            print("⚠️ Unknown debug URL: \(url)")
        }
    }
    #endif
}
```

### Navigate from Simulator

```bash
# Navigate to settings
xcrun simctl openurl booted "debug://settings"

# Navigate to profile with parameter
xcrun simctl openurl booted "debug://profile?id=12345"
```

### Add URL Scheme to Info.plist

```xml
<!-- Only in Debug configuration -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>debug</string>
        </array>
    </dict>
</array>
```

## Documentation Scope

This page documents the `axiom-deep-link-debugging` skill—debug-only deep link patterns Claude uses for automated testing and simulator verification.

**For production deep links:** See [swiftui-nav](/skills/ui-design/swiftui-nav) for NavigationStack deep linking patterns.

## Related

- [swiftui-nav](/skills/ui-design/swiftui-nav) — Production navigation and deep linking
- [ui-testing](/skills/ui-design/ui-testing) — UI testing patterns
- [simulator-tester](/agents/simulator-tester) — Automated simulator testing agent

## Resources

**WWDC**: 2022-10054 (NavigationStack), 2024-10147 (SwiftUI Navigation)

**Docs**: /documentation/xcode/simctl
