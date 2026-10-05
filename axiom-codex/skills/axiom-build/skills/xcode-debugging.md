
# Xcode Debugging

## Overview

Check build environment BEFORE debugging code. **Core principle** 80% of "mysterious" Xcode issues are environment problems (stale Derived Data, stuck simulators, zombie processes), not code bugs.

## Example Prompts

These are real questions developers ask that this skill is designed to answer:

#### 1. "My build is failing with 'BUILD FAILED' but no error details. I haven't changed anything. What's going on?"
→ The skill shows environment-first diagnostics: check Derived Data, simulator states, and zombie processes before investigating code

#### 2. "Tests passed yesterday with no code changes, but now they're failing. This is frustrating. How do I fix this?"
→ The skill explains stale Derived Data and intermittent failures, shows the 2-5 minute fix (clean Derived Data)

#### 3. "My app builds fine but it's running the old code from before my changes. I restarted Xcode but it still happens."
→ The skill demonstrates that Derived Data caches old builds, shows how deletion forces a clean rebuild

#### 4. "The simulator says 'Unable to boot simulator' and I can't run tests. How do I recover?"
→ The skill covers simulator state diagnosis with simctl and safe recovery patterns (erase/shutdown/reboot)

#### 5. "I'm getting 'No such module: SomePackage' errors after updating SPM dependencies. How do I fix this?"
→ The skill explains SPM caching issues and the clean Derived Data workflow that resolves "phantom" module errors

---

## Red Flags — Check Environment First

If you see ANY of these, suspect environment not code:
- "It works on my machine but not CI"
- "Tests passed yesterday, failing today with no code changes"
- "Build succeeds but old code executes"
- "Build sometimes succeeds, sometimes fails" (intermittent failures)
- "Simulator stuck at splash screen" or "Unable to install app"
- Multiple xcodebuild processes (10+) older than 30 minutes

## Mandatory First Steps

**ALWAYS run these commands FIRST** (before reading code):

```bash
# 1. Check processes (exit 1 = none, 0 = listed, 2/3 = inventory failed).
#    -x matches exact names, so the `xcodebuildmcp` MCP server and CoreSimulator services are skipped
pgrep -lx xcodebuild; echo "pgrep exit=$?"
pgrep -lx 'Simulator|DeviceHub'; echo "pgrep exit=$?"

# 2. Check Derived Data size (size alone does not prove it is stale)
du -sh ~/Library/Developer/Xcode/DerivedData

# 3. Check simulator states (stuck Booting?)
xcrun simctl list devices | grep -E "Booted|Booting|Shutting Down"
```

#### What these tell you
- **0 processes + small Derived Data + no booted sims** → Environment clean, investigate code
- **Unaccounted-for xcodebuild processes OR simulators stuck** → Environment problem; investigate, then clean only what is confirmed
- **Stale code executing OR intermittent failures** → Clean this project's Derived Data regardless of size

#### Why environment first
- Environment cleanup: 2-5 minutes → problem solved
- Code debugging for environment issues: 30-120 minutes → wasted time

## Quick Fix Workflow

### Finding Your Scheme Name

If you don't know your scheme name:
```bash
# List available schemes
xcodebuild -list
```

### For Stale Builds / "No such module" Errors
```bash
# Clean this project
xcodebuild clean -scheme YourScheme
# Remove only THIS project's DerivedData folder; other projects and running builds use the rest
DD_SETTINGS=$(mktemp "${TMPDIR:-/tmp}/axiom-settings.XXXXXX")
# Pass the same -workspace or -project as the build (a CocoaPods folder has both)
xcodebuild -showBuildSettings -workspace YourApp.xcworkspace -scheme YourScheme > "$DD_SETTINGS"
PROJECT_DD=$(sed -n 's/^ *BUILD_DIR = \(.*\)\/Build\/Products$/\1/p' "$DD_SETTINGS" | head -1)
case "$PROJECT_DD" in
  "$HOME/Library/Developer/Xcode/DerivedData/"?*) rm -rf "$PROJECT_DD" ;;
  *) echo "Not under the default DerivedData: '$PROJECT_DD'; inspect before deleting" ;;
esac
rm -rf .build/ build/

# Rebuild, captured with axbuild (see axiom-build "Capture Build and Test Diagnostics")
"$AXBUILD" xcodebuild build -workspace YourApp.xcworkspace -scheme YourScheme \
  -destination "<ACTUAL_DESTINATION>"
```

### For Simulator Issues
```bash
# Shut down only the affected simulator; other sessions may be using the rest
xcrun simctl shutdown <device-uuid>

# If simctl command fails, retry and check its state
xcrun simctl shutdown <device-uuid>
xcrun simctl list devices

# If still stuck, erase specific simulator
xcrun simctl erase <device-uuid>

# Nuclear option, only when no other session or person is using simulators on this Mac:
# force-quit the simulator GUI.
# Xcode 26 ships Simulator.app; Xcode 27 ships DeviceHub.app instead and has no
# Simulator.app at all — name both or this silently does nothing on 27.
killall -9 Simulator DeviceHub

# Verify against the PROCESS, not $?. killall exits 0 when EITHER name matched, so
# with both Xcodes installed a 0 can mean "killed Simulator, DeviceHub still running".
pgrep -lx 'Simulator|DeviceHub'    # exact names; must print nothing (exit 1)
```

### For Suspected Zombie Processes
```bash
# Inventory first: exit 1 = none, 0 = listed, 2/3 = inventory failed
pgrep -lx xcodebuild; echo "pgrep exit=$?"

# Inspect each PID: owner, parent, state, start time and CPU time. Age alone proves nothing.
ps -ww -o pid,ppid,user,stat,lstart,etime,time,command -p <PID>

# Stop only a confirmed abandoned build this task started; TERM first, then verify
kill -TERM <PID>
pgrep -lx xcodebuild
```
Never `killall xcodebuild`: other sessions, CI jobs and archives on the same Mac are killed with it.

### For Test Failures
```bash
# Isolate failing test
"$AXBUILD" xcodebuild test -workspace YourApp.xcworkspace -scheme YourScheme \
  -destination "<ACTUAL_DESTINATION>" \
  -only-testing:YourTests/SpecificTestClass
```

## Simulator Verification (Optional)

After applying fixes, verify in simulator with visual confirmation.

### Quick Screenshot Verification

```bash
# 1. Boot simulator (if not already)
xcrun simctl boot "iPhone 16 Pro"

# 2. Build and install app
"$AXBUILD" xcodebuild build -workspace YourApp.xcworkspace -scheme YourScheme \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'

# 3. Launch app
xcrun simctl launch booted com.your.bundleid

# 4. Wait for UI to stabilize
sleep 2

# 5. Capture screenshot
xcrun simctl io booted screenshot /tmp/verify-build-$(date +%s).png
```

### Using Axiom Tools

**Quick screenshot**:
```bash
/axiom:screenshot
```

**Full simulator testing** (with navigation, state setup):
```bash
/axiom:test-simulator
```

### When to Use Simulator Verification

Use when:
- **Visual fixes** — Layout changes, UI updates, styling tweaks
- **State-dependent bugs** — "Only happens in this specific screen"
- **Intermittent failures** — Need to reproduce specific conditions
- **Before shipping** — Final verification that fix actually works

**Pro tip**: If you have debug deep links (see `axiom-swift (skills/deep-link-debugging.md)` skill), you can navigate directly to the screen that was broken:
```bash
xcrun simctl openurl booted "debug://problem-screen"
sleep 1
xcrun simctl io booted screenshot /tmp/fix-verification.png
```

## Decision Tree

```
Test/build failing?
├─ BUILD FAILED with no details?
│  └─ Delete this project's Derived Data → rebuild
├─ Build intermittent (sometimes succeeds/fails)?
│  └─ Delete this project's Derived Data → rebuild
├─ Build succeeds but old code executes?
│  └─ Delete this project's Derived Data → rebuild (2-5 min fix)
├─ "Unable to boot simulator"?
│  └─ xcrun simctl shutdown <device-uuid> → erase that simulator
├─ "No such module PackageName"?
│  └─ Clean + delete this project's Derived Data → rebuild
├─ Tests hang indefinitely?
│  └─ Check simctl list → reboot simulator
├─ Tests crash?
│  └─ Check ~/Library/Logs/DiagnosticReports/*.crash
└─ Code logic bug?
   └─ Use systematic-debugging skill instead
```

## Common Error Patterns

| Error | Fix |
|-------|-----|
| `BUILD FAILED` (no details) | Delete this project's Derived Data |
| `Unable to boot simulator` | `xcrun simctl erase <uuid>` |
| `No such module` | Clean + delete this project's Derived Data |
| Tests hang | Check simctl list, reboot simulator |
| Stale code executing | Delete this project's Derived Data |

**Predicted vs. built issues (OS27)**: Xcode 27 surfaces *predicted* issues inline **before** you build, rendered with a subtle, theme-blended style. They firm up into full-color warnings/errors when you build — or vanish if already resolved. A predicted issue is not yet a confirmed build failure: build (or check the build log) before treating an inline marker as real, so environment-first triage stays honest.

## Useful CLI Tools

```bash
# Show build settings
xcodebuild -showBuildSettings -scheme YourScheme

# List schemes/targets
xcodebuild -list

# Verbose output
xcodebuild -verbose build -scheme YourScheme

# Build without testing (faster)
xcodebuild build-for-testing -scheme YourScheme
xcodebuild test-without-building -scheme YourScheme

# Version and build number management (agvtool)
xcrun agvtool what-marketing-version          # Current version (e.g., 2.0)
xcrun agvtool what-version                    # Current build number
xcrun agvtool next-version -all               # Bump build number
xcrun agvtool new-version -all 42             # Set specific build number
xcrun agvtool new-marketing-version 2.1       # Set marketing version

# Validate asset catalogs (actool surfaces warnings during compile — no bare "lint" subcommand)
xcrun actool Assets.xcassets --compile /tmp/actool-out \
  --platform iphoneos --minimum-deployment-target 26.0 \
  --app-icon AppIcon --output-partial-info-plist /tmp/partial.plist
```

- `xcsym crash <file>` — Structured crash symbolication with LLM-friendly JSON output. Use for any `.ips`, MetricKit, or legacy `.crash` text file. See `axiom-tools (skills/xcsym-ref.md)`.

## Device Management (devicectl)

`devicectl` is the modern Core Device CLI (Xcode 15+, replaces legacy `idevice*` tools) for installing, launching, and inspecting devices from the command line. Reach for it when an issue doesn't reproduce in Simulator:

```bash
xcrun devicectl device install app --device <udid> MyApp.app
xcrun devicectl device process launch --device <udid> com.your.bundleid
xcrun devicectl device info apps --device <udid>
xcrun devicectl device info processes --device <udid>
```

`xcrun devicectl list devices` inventories physical devices *and* simulators together (a `Reality` column distinguishes them). For the full tool map, the verified simulator-capable subcommand matrix, `--json-output` parsing keys, and the devicectl-vs-simctl division of labor, see `axiom-tools (skills/device-control-ref.md)`.

## Device Hub (OS27)

Xcode 27 unifies simulators and physical devices in **Device Hub** — a standalone app that auto-launches when you build and run to a simulator (you don't need to open Xcode). Its canvas, the five-panel inspector, and the full GUI reference live in `axiom-tools (skills/device-control-ref.md)`. The canonical *debugging* use is reproducing a device-only bug on a simulator:

1. **Capture from the device** — *Pair Nearby Device* (wireless), install any needed configuration profile (e.g. a CoreLocation logging profile; reboot for privacy), reproduce the bug, then screenshot it, run a *sysdiagnose* for system-level diagnostics, and download the app's **data container**.
2. **Match on the simulator** — select the matching model, replace your data container with the device's (Apps panel), then mirror the triggering config: rotation, simulated location, Dynamic Type size.

Device-only bugs often need a *confluence* of conditions (e.g. landscape + a specific location + max text size, all at once); the inspector lets you reproduce every one of them in a single place. `simctl` and `devicectl` remain the scriptable path for CI and headless verification — Device Hub is a GUI over the same operations.

## Crash Log Analysis

```bash
# Recent crashes
ls -lt ~/Library/Logs/DiagnosticReports/*.crash | head -5

# Symbolicate a single address (if you have .dSYM)
xcrun atos -o YourApp.app.dSYM/Contents/Resources/DWARF/YourApp \
  -arch arm64 -l 0x100000000 0x<address>

# Symbolicate an entire crash log at once (LLDB Python script, may vary by Xcode version)
xcrun crashlog MyCrash.ips
```

## Common Mistakes

❌ **Debugging code before checking environment** — Always run mandatory steps first

❌ **Ignoring simulator states** — "Booting" can hang 10+ minutes, shutdown/reboot immediately

❌ **Assuming git changes caused the problem** — Derived Data caches old builds despite code changes

❌ **Running full test suite when one test fails** — Use `-only-testing` to isolate

## Real-World Impact

**Before** 30+ min debugging "why is old code running"
**After** 2 min environment check → clean Derived Data → problem solved

**Key insight** Check environment first, debug code second.
