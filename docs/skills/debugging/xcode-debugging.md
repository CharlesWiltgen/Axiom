---
name: xcode-debugging
description: Use when encountering BUILD FAILED, test crashes, simulator hangs, stale builds, zombie xcodebuild processes, "Unable to boot simulator", "No such module" after SPM changes, or mysterious test failures despite no code changes — systematic environment-first diagnostics for iOS/macOS projects
---

# Xcode Debugging

Environment-first diagnostics for mysterious Xcode issues. Prevents 30+ minute rabbit holes by checking build environment before debugging code.

## When to Use This Skill

Use this skill when you're:
- Getting BUILD FAILED with no clear error
- Tests passed yesterday, failing today with no code changes
- Build succeeds but old code executes
- Simulator says "Unable to boot" or stuck at splash screen
- Getting "No such module" after SPM updates
- Experiencing intermittent build failures

**Core principle:** 80% of "mysterious" Xcode issues are environment problems (stale Derived Data, stuck simulators, zombie processes), not code bugs.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "My build fails with 'BUILD FAILED' but no error details. I haven't changed anything."
- "Tests passed yesterday, failing today with no code changes. What's going on?"
- "My app builds but runs old code from before my changes."
- "Simulator says 'Unable to boot simulator'. How do I recover?"
- "I'm getting 'No such module' errors after updating SPM dependencies."
- "Build sometimes succeeds, sometimes fails. Why?"
- "I have 20 xcodebuild processes running. Is that normal?"

## What's Covered

### Red Flags (Check Environment First)
- "It works on my machine but not CI"
- "Tests passed yesterday, failing today"
- "Build succeeds but old code executes"
- Intermittent success/failure
- Simulator stuck or unresponsive
- Multiple zombie xcodebuild processes

### Environment Diagnostics
- Derived Data state and cleanup
- Simulator health checks with simctl
- Zombie process detection and cleanup
- SPM cache verification

### Recovery Commands
- Safe Derived Data deletion
- Simulator reset and recovery
- Process cleanup without reboot
- SPM cache refresh

### Time Cost Transparency
- 2-5 minutes: Derived Data cleanup
- 5-10 minutes: Full environment reset
- 30+ minutes: Debugging code when problem is environment

## Key Pattern

### The Environment-First Checklist

```bash
# 1. Check for zombie processes (10+ or older than 30 min = problem)
ps aux | grep -E "xcodebuild|Simulator" | grep -v grep

# 2. Kill zombies if found
killall xcodebuild 2>/dev/null
killall Simulator 2>/dev/null

# 3. Clean Derived Data
rm -rf ~/Library/Developer/Xcode/DerivedData

# 4. Reset simulators if needed
xcrun simctl shutdown all
xcrun simctl erase all  # Nuclear option - erases all simulator data

# 5. Clean SPM cache if module errors persist
rm -rf ~/Library/Caches/org.swift.swiftpm
```

### When to Use Each Step

| Symptom | Fix | Time |
|---------|-----|------|
| Stale builds, old code runs | Delete Derived Data | 2 min |
| "No such module" | Delete Derived Data + SPM cache | 3 min |
| Simulator stuck | simctl shutdown + reboot | 2 min |
| Zombie processes | killall | 1 min |
| All of the above | Full reset + reboot | 10 min |

## Documentation Scope

This page documents the `axiom-xcode-debugging` skill—environment-first diagnostics Claude uses before investigating code issues. The skill contains complete command sequences, decision trees, and time-cost analysis.

**For build failures specifically:** Use [/axiom:fix-build](/commands/build/fix-build) for automated diagnosis and fixes.

## Related

- [/axiom:fix-build](/commands/build/fix-build) — Automated build failure diagnosis
- [build-fixer](/agents/build-fixer) — Autonomous agent that diagnoses and fixes build issues
- [build-debugging](/skills/debugging/build-debugging) — Dependency resolution for CocoaPods/SPM
- [testflight-triage](/skills/debugging/testflight-triage) — Use when issue is TestFlight crash, not build environment
- [performance-profiling](/skills/debugging/performance-profiling) — When issue is performance, not environment

## Resources

**WWDC**: 2021-10209, 2023-10164

**Docs**: /xcode/debugging-and-testing
