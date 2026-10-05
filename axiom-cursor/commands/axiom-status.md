---
name: axiom-status
description: "Project health dashboard - shows environment status and suggests improvements"
---


You are a project health analyzer. Provide a quick dashboard of the iOS project state.

## Gather Information

Run these checks and format as a dashboard:

### Environment Health
```bash
# Running xcodebuild processes (-x = exact process name; -f would also match the
# long-running `xcodebuildmcp` MCP server). Exit 1 = none, 0 = listed, 2/3 = inventory
# failed. A listed process is not a zombie until its owner and state are checked.
pgrep -lx xcodebuild; echo "pgrep exit=$?"

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

```

### Deployment Target Selection

Check `command -v xcproject`. If unavailable, use Glob for `**/*.xcodeproj/project.pbxproj` and `**/*.xcodeproj/project.xcproj`, then Read the project and xcconfig declarations. Report the target/configuration and label the value "declared; effective value unverified". JSON5 has conditional keys and trailing commas; `jq` and `plutil` are not JSON5 readers. Do not substitute the first grep match for a deployment target.

With `xcproject` available, inventory projects at any depth (dependency/cache directories are excluded):

```bash
xcproject inspect --root .
```

Multiple projects require an explicit `--project`. From the inventory, select the actual project, target, configuration and SDK; clarify ambiguity. A `.xcodeproj` may contain either inner filename. A container with neither is incomplete; both present require choosing the authoritative format rather than guessing.

Use an existing matching Xcode settings capture, or follow `axiom-build (skills/build-performance.md)`, "Project selection and effective settings", to obtain one under authorized scope. A settings query can resolve packages or write build-system state; file-read permission alone does not authorize it. Set `PROJECT`, `TARGET`, `CONFIGURATION`, `SDK` and `SETTINGS_JSON` explicitly in the same shell call as the reader (shell variables do not persist across tool calls). Verify capture freshness after project/xcconfig changes.

```bash
xcproject settings --project "$PROJECT" --input "$SETTINGS_JSON" --target "$TARGET" --configuration "$CONFIGURATION" --sdk "$SDK" --key IPHONEOS_DEPLOYMENT_TARGET --value-only
```

### Format as Dashboard

```
Axiom Project Status
=====================

Environment
   Xcodebuild processes: [count] [list PIDs; flag one only after checking its owner and state]
   Derived Data: [size] [warning if > 10GB]
   Simulators running: [count]
   jq: [installed/NOT INSTALLED]
   axe: [installed/not installed (optional)]

Project Analysis
   SwiftUI views: [count]
   Potential memory patterns: [count] [warning if > 0]
   Deployment target: iOS [version] ([project]/[target]/[configuration]/[SDK]; effective or declared/unverified)

Suggested Actions
   [Based on findings, suggest 2-3 most relevant audits or skills]
   [If jq not installed: "Install jq for reliable simulator control: brew install jq"]
   [If axe installed: "AXe UI automation available for simulator-tester agent"]
```
