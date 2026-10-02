# /axiom:status

Project health dashboard that shows environment status and potential issues at a glance.

## Command

```bash
/axiom:status
```

## What It Checks

### Environment Health

- **Xcodebuild processes**: Detects zombie processes that slow down builds
- **Derived Data**: Checks directory size (warns if > 10GB)
- **Simulators**: Lists booted simulators that consume system resources

### Project Analysis

- **SwiftUI adoption**: Counts views to gauge modernization
- **Memory risks**: Quick scan for raw `Timer` or `NotificationCenter` usage
- **Deployment target**: Reports the selected project/target/configuration/SDK and distinguishes effective from declared, unverified values

## Project Selection

Status discovers `.xcodeproj` containers at any depth and supports either `project.pbxproj` or JSON5 `project.xcproj`. Multiple projects or targets require explicit selection. A first text match is a declaration; effective deployment values come from a matching Xcode settings capture. `xcproject` validates the capture when available. Without it, status reads the project and xcconfig declarations and labels the effective value unverified.

Xcode settings queries can resolve packages or write build-system state, so they require scope beyond file reads. The command uses an existing fresh capture or obtains an authorized one; missing or ambiguous data is reported explicitly.

## Example Output

```text
📊 Axiom Project Status
═══════════════════════

🔧 Environment
   Xcodebuild processes: 0
   Derived Data: 2.4GB
   Simulators running: 1 (iPhone 15 Pro)

📱 Project Analysis
   SwiftUI views: 42
   Potential memory patterns: 3 [⚠️]
   Deployment target: iOS 16.0 (App/App/Debug/iphoneos; effective)

💡 Suggested Actions
   Based on findings:
   - Run /axiom:audit memory to check the 3 potential memory patterns
```

## When to Use

- Before starting a debugging session
- When your machine feels slow (check for zombie processes/simulators)
- To get a quick overview of a new codebase

## Related

- [/axiom:fix-build](../build/fix-build.md) – Fix environment issues automatically
- [/axiom:audit](../utility/audit.md) – Run deep scans based on status findings
