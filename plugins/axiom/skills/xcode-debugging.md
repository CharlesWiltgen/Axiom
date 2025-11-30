---
name: xcode-debugging
description: Use when encountering BUILD FAILED, test crashes, simulator hangs, stale builds, zombie xcodebuild processes, "Unable to boot simulator", "No such module" after SPM changes, or mysterious test failures despite no code changes - systematic environment-first diagnostics for iOS/macOS projects
---

# Xcode Debugging

## Overview

Check build environment BEFORE debugging code. **Core principle:** 80% of "mysterious" Xcode issues are environment problems (stale Derived Data, stuck simulators, zombie processes), not code bugs.

## Red Flags - Check Environment First

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
ps aux | grep -E "xcodebuild|Simulator" | grep -v grep

# 2. Check Derived Data size (>10GB = stale)
du -sh ~/Library/Developer/Xcode/DerivedData

# 3. Check simulator states (stuck Booting?)
xcrun simctl list devices | grep -E "Booted|Booting|Shutting Down"
```

**What these tell you:**
- **0 processes + small Derived Data + no booted sims** → Environment clean, investigate code
- **10+ processes OR >10GB Derived Data OR simulators stuck** → Environment problem, clean first
- **Stale code executing OR intermittent failures** → Clean Derived Data regardless of size

**Why environment first:**
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

# Check they're gone
ps aux | grep xcodebuild | grep -v grep
```

### For Test Failures
```bash
# Isolate failing test
xcodebuild test -scheme YourScheme \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:YourTests/SpecificTestClass
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

## Useful Flags

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
```

## Crash Log Analysis

```bash
# Recent crashes
ls -lt ~/Library/Logs/DiagnosticReports/*.crash | head -5

# Symbolicate address (if you have .dSYM)
atos -o YourApp.app.dSYM/Contents/Resources/DWARF/YourApp \
  -arch arm64 0x<address>
```

## Common Mistakes

❌ **Debugging code before checking environment** - Always run mandatory steps first

❌ **Ignoring simulator states** - "Booting" can hang 10+ minutes, shutdown/reboot immediately

❌ **Assuming git changes caused the problem** - Derived Data caches old builds despite code changes

❌ **Running full test suite when one test fails** - Use `-only-testing` to isolate

## Real-World Impact

**Before:** 30+ min debugging "why is old code running"
**After:** 2 min environment check → clean Derived Data → problem solved

**Key insight:** Check environment first, debug code second.
