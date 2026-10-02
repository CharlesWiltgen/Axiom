# build-optimizer

Automatically scans Xcode projects for build performance optimizations and provides quick wins with measurable time savings.

## Project Formats and Settings

Project discovery supports both `project.pbxproj` and JSON5 `project.xcproj` inside `.xcodeproj`, including nested layouts. Select the project, target, configuration and SDK explicitly. `xcproject` provides structural inspection when available; otherwise the agent reads declarations and xcconfig files and labels unresolved values. Effective settings require a fresh matching Xcode capture obtained within authorized scope. File-read permission permits inspection; an Xcode query can resolve packages or write build-system state. Source findings retain target membership and synchronized-folder exclusions.

Script analysis preserves complete scalar or array bodies and string or object build-phase entries. General settings output does not prove architecture-conditioned compiler flags.

## How to Use This Agent

**Natural language (automatic triggering):**

- "My builds are slow"
- "How can I speed up build times?"
- "Optimize my Xcode build performance"
- "Builds are taking forever"
- "Can you make my builds faster?"

**Explicit command:**

```bash
/axiom:optimize-build
```

## What It Does

1. **Build Settings** (HIGH) — Compilation mode, architecture settings, debug info format
2. **Build Phase Scripts** (HIGH) — Conditional execution, sandboxing, unnecessary scripts in Debug
3. **Type Checking Performance** (MEDIUM) — Slow-compiling functions, complex type inference
4. **Compiler Flags** (MEDIUM) — Suboptimal Swift compiler flags

## Expected Results

Based on typical findings:

- **30-50% faster** incremental debug builds
- **5-10 seconds saved** per build from conditional scripts
- **Measurable improvements** in Build Timeline

## Related

- **build-performance** skill — Comprehensive build optimization workflows with Build Timeline analysis, WWDC 2018-408 and WWDC 2022-110364 guidance
