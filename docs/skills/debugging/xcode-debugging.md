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
- "What's Device Hub in Xcode 27, and how does it relate to simctl/devicectl?" (iOS 27)
- "Xcode shows an inline issue before I build — is that a real build failure?" (iOS 27)
- "A bug only reproduces on my physical device — how do I recreate it on a simulator with Device Hub?" (iOS 27)

## What This Skill Provides

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
# 1. Check for running builds (exit 1 = none, 0 = listed, 2/3 = the check itself failed)
pgrep -lx xcodebuild; echo "pgrep exit=$?"
# Inspect a listed build before stopping anything; count and age don't prove it's stuck
ps -ww -o pid,ppid,user,stat,lstart,etime,command -p <PID>

# 2. Stop only a confirmed abandoned build you started
#    (never killall: it also kills other people's builds, CI jobs and archives)
kill -TERM <PID>

# 3. Clean this project's Derived Data folder, not all of DerivedData
#    (the build-debugging skill includes a script that finds the right folder)

# 4. Reset only the stuck simulator
xcrun simctl shutdown <device-uuid>
xcrun simctl erase <device-uuid>   # erases that simulator's data

# 5. Clear the SwiftPM cache (shared by every project) only if package
#    resolution still fails after resolving again
rm -rf ~/Library/Caches/org.swift.swiftpm
```

### When to Use Each Step

| Symptom | Fix | Time |
|---------|-----|------|
| Stale builds, old code runs | Delete this project's Derived Data | 2 min |
| "No such module" | Delete this project's Derived Data; SPM cache only if still failing | 3 min |
| Simulator stuck | Shut down and reboot that simulator | 2 min |
| Abandoned build process | Inspect it, then stop that one PID | 1 min |
| All of the above | Each step above for this project and device, then reboot | 10 min |

## Documentation Scope

This page documents the `axiom-build` skill — environment-first diagnostics Claude uses before investigating code issues. The skill contains complete command sequences, decision trees, and time-cost analysis.

**For build failures specifically:** Use [/axiom:fix-build](/commands/build/fix-build) for automated diagnosis and fixes.

## Related

- [/axiom:fix-build](/commands/build/fix-build) – Automated build failure diagnosis
- [build-fixer](/agents/build-fixer) – Autonomous agent that diagnoses and fixes build issues
- [build-debugging](/skills/debugging/build-debugging) – Dependency resolution for CocoaPods/SPM
- [testflight-triage](/skills/debugging/testflight-triage) – Use when issue is TestFlight crash, not build environment
- [performance-profiling](/skills/debugging/performance-profiling) – When issue is performance, not environment

## Resources

**WWDC**: 2021-10209, 2023-10164, 2026-258

**Docs**: /xcode/debugging-and-testing
