
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
# 1. Check processes (zombie xcodebuild?)
# \bxcodebuild\b is word-bounded so it skips the `xcodebuildmcp` MCP server
ps aux | grep -E '\bxcodebuild\b|Simulator' | grep -v grep

# 2. Check Derived Data size (>10GB = stale)
du -sh ~/Library/Developer/Xcode/DerivedData

# 3. Check simulator states (stuck Booting?)
xcrun simctl list devices | grep -E "Booted|Booting|Shutting Down"
```

#### What these tell you
- **0 processes + small Derived Data + no booted sims** → Environment clean, investigate code
- **10+ processes OR >10GB Derived Data OR simulators stuck** → Environment problem, clean first
- **Stale code executing OR intermittent failures** → Clean Derived Data regardless of size

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
# Clean everything
xcodebuild clean -scheme YourScheme
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf .build/ build/

# Rebuild
xcodebuild build -scheme YourScheme \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

### For Simulator Issues
```bash
# Shutdown all simulators
xcrun simctl shutdown all

# If simctl command fails, shutdown and retry
xcrun simctl shutdown all
xcrun simctl list devices

# If still stuck, erase specific simulator
xcrun simctl erase <device-uuid>

# Nuclear option: force-quit Simulator.app
killall -9 Simulator
```

### For Zombie Processes
```bash
# Kill all xcodebuild (use cautiously)
killall -9 xcodebuild

# Check they're gone (-w skips the `xcodebuildmcp` MCP server)
ps aux | grep -w xcodebuild | grep -v grep
```

### For Test Failures
```bash
# Isolate failing test
xcodebuild test -scheme YourScheme \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:YourTests/SpecificTestClass
```

## Simulator Verification (Optional)

After applying fixes, verify in simulator with visual confirmation.

### Quick Screenshot Verification

```bash
# 1. Boot simulator (if not already)
xcrun simctl boot "iPhone 16 Pro"

# 2. Build and install app
xcodebuild build -scheme YourScheme \
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
│  └─ Clean Derived Data → rebuild
├─ Build intermittent (sometimes succeeds/fails)?
│  └─ Clean Derived Data → rebuild
├─ Build succeeds but old code executes?
│  └─ Delete Derived Data → rebuild (2-5 min fix)
├─ "Unable to boot simulator"?
│  └─ xcrun simctl shutdown all → erase simulator
├─ "No such module PackageName"?
│  └─ Clean + delete Derived Data → rebuild
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
| `BUILD FAILED` (no details) | Delete Derived Data |
| `Unable to boot simulator` | `xcrun simctl erase <uuid>` |
| `No such module` | Clean + delete Derived Data |
| Tests hang | Check simctl list, reboot simulator |
| Stale code executing | Delete Derived Data |

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

`devicectl` is the modern Core Device CLI (Xcode 15+, replaces legacy `idevice*` tools) for installing, launching, inspecting, and managing devices from the command line, with `--json-output` for CI.

`xcrun devicectl list devices` returns a **unified inventory of physical devices *and* simulators**, distinguished by a `Reality` column (`physical` / `simulated`) — the CLI counterpart to Device Hub (below). This is *not* new in Xcode 27: the devicectl CLI is byte-identical between Xcode 26 and 27 (binary 629.3 in both, same 85 subcommands and flags). Xcode 27's one devicectl-related change is service-side — per the release notes, `simctl` and `devicectl` now support rebooting a simulator via `reboot`. For richer simulator-only control (status bar, push, privacy permissions, media), `simctl` stays primary; to drive the simulator UI / accessibility tree, use the Axiom `xcui` tool (`axiom-tools (skills/xcui-ref.md)`).

```bash
# Unified inventory: physical + simulated (--json-output for CI)
xcrun devicectl list devices

# Install / launch / inspect a physical device by identifier
xcrun devicectl device install app --device <udid> MyApp.app
xcrun devicectl device process launch --device <udid> com.your.bundleid
xcrun devicectl device info apps --device <udid>
xcrun devicectl device info processes --device <udid>
```

**When to use**: CLI device operations when an issue doesn't reproduce in Simulator (install, launch, inspect) — and `list devices` as the single command that inventories devices and simulators together.

## Device Hub (OS27)

Xcode 27 unifies simulators and physical devices in **Device Hub** — a standalone app that ships alongside Xcode and auto-launches when you build and run to a simulator (you don't need to open Xcode to use it). It offers the same toolset for simulators and physical devices, in a *compact* window (live screen plus a few essentials) that expands to a *full window* with canvas, sidebar inventory, and inspector. Bottom controls are contextual — home/screenshot/rotate on iPhone, play/pause and navigation on Apple TV, environment/camera on Vision Pro, side button and Digital Crown on Apple Watch.

The **canvas** is a live, interactive screen (click, drag, scroll, trackpad gestures) for a device or simulator, with zoom, snap-to-1:1 physical size, *Resize mode* (transform app dimensions freely — see `axiom-uikit` for resizability), and *Capture keyboard* (routes Mac keystrokes to the device for key-command and hardware testing).

### Inspector panels

Five panels; two carry most of the debugging weight — Diagnostic reports (investigate) and Device settings (reproduce conditions).

| Panel | Use |
|---|---|
| Device settings | Appearance and accessibility applied instantly — dark mode, increased contrast, larger Dynamic Type, simulated location, audio (no digging through Settings) |
| Diagnostic reports | Start here when the app hangs or crashes — crashes, spins, and other logged diagnostics |
| Info | Storage, model, serial number |
| Apps | Install/uninstall; download and replace data containers |
| Profiles | Configuration and provisioning profiles |

### Reproduce a device-only bug on a simulator

The canonical Device Hub workflow when a bug reproduces on a physical device but not locally:

1. **Capture from the device** — *Pair Nearby Device* (wireless), install any needed configuration profile (e.g. a CoreLocation logging profile; reboot for privacy), reproduce the bug, then screenshot it, run a *sysdiagnose* for system-level diagnostics, and download the app's **data container**.
2. **Match on the simulator** — select the matching model, replace your data container with the device's (Apps panel), then mirror the triggering config: rotation, simulated location, Dynamic Type size.

Device-only bugs often need a *confluence* of conditions (e.g. landscape + a specific location + max text size, all at once); the inspector lets you reproduce every one of them in a single place.

### Automation and CI

`simctl` (simulators) and `devicectl` (devices — its `list devices` also inventories simulators via the `Reality` column) remain the scriptable path — Device Hub is a GUI over the same operations, not a replacement. `devicectl` lists devices, installs apps, changes settings (e.g. dark/light mode), and queries device info, with `--json-output` for clean integration into scripts and CI. Reach for the CLI in scripts, CI, and headless verification — and the Axiom `xcui` tool for driving the simulator UI (see `axiom-tools (skills/xcui-ref.md)`). On macOS27 the iPhone Mirroring window is resizable.

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
