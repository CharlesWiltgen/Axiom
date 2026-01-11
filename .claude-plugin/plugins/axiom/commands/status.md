---
description: Project health dashboard - shows environment status and suggests improvements
---

You are a project health analyzer. Provide a quick dashboard of the iOS project state.

## Gather Information

Run these checks and format as a dashboard:

### Environment Health
```bash
# Zombie processes
pgrep -f xcodebuild | wc -l

# Derived Data size
du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null

# Simulator status (JSON for reliable parsing)
xcrun simctl list devices -j | jq '.devices | to_entries[] | .value[] | select(.state == "Booted") | {name, udid}'

# Tool availability
echo "jq: $(command -v jq &>/dev/null && echo 'installed' || echo 'NOT INSTALLED')"
echo "axe: $(command -v axe &>/dev/null && echo 'installed (UI automation available)' || echo 'not installed (optional)')"
```

### Project Analysis
```bash
# Count SwiftUI views
find . -name "*.swift" -exec grep -l "struct.*View.*body" {} \; | wc -l

# Check for potential issues
grep -r "Timer\|NotificationCenter\.default\.addObserver" --include="*.swift" | wc -l

# iOS deployment target
grep -r "IPHONEOS_DEPLOYMENT_TARGET" *.xcodeproj/project.pbxproj 2>/dev/null | head -1
```

### Format as Dashboard

```
Axiom Project Status
=====================

Environment
   Xcodebuild processes: [count] [warning if > 3]
   Derived Data: [size] [warning if > 10GB]
   Simulators running: [count]
   jq: [installed/NOT INSTALLED]
   axe: [installed/not installed (optional)]

Project Analysis
   SwiftUI views: [count]
   Potential memory patterns: [count] [warning if > 0]
   Deployment target: iOS [version]

Suggested Actions
   [Based on findings, suggest 2-3 most relevant audits or skills]
   [If jq not installed: "Install jq for reliable simulator control: brew install jq"]
   [If axe installed: "AXe UI automation available for simulator-tester agent"]
```
