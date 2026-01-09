---
name: testflight-triage
description: Systematic workflow for investigating TestFlight crashes and reviewing beta feedback using Xcode Organizer
---

# TestFlight Crash & Feedback Triage

Systematic workflow for investigating TestFlight crashes and reviewing beta feedback using Xcode Organizer. Understand crashes before writing fixes — 15 minutes of triage prevents hours of debugging.

## When to Use This Skill

Use this skill when you're:
- A beta tester reports that your app crashed
- You see crash counts in App Store Connect but don't know how to investigate
- Crash logs in Organizer aren't symbolicated (showing hex addresses)
- A user reports the app "just closed" but you can't find a crash report
- You need to review TestFlight feedback screenshots and comments
- Crash rate spiked after a new TestFlight build

**Core principle:** Understand the crash before writing any fix. Rushed guesses often miss the real issue or introduce new bugs.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "A beta tester said my app crashed. How do I find and understand the crash?"
- "I see crashes in App Store Connect but don't know how to investigate them."
- "My crash logs aren't symbolicated. How do I fix that?"
- "The app was killed but there's no crash report. What happened?"
- "How do I review TestFlight feedback in Xcode?"
- "What does EXC_BAD_ACCESS mean and how do I fix it?"
- "Our crash rate spiked after the latest build. How do I triage this?"

## What's Covered

### Xcode Organizer Walkthrough
- Opening Organizer (Window → Organizer)
- UI layout: sidebar, crashes list, log view, inspector
- Filters: time period, version, product, release type
- Crash entry badges (App Clip, Watch, Extension)
- Feedback Inspector for tester comments

### Triage Questions Workflow
Before diving into code, ask yourself:
1. How long has this been an issue? (check inspector graph)
2. Is this affecting production or just TestFlight? (use Release filter)
3. What was the user doing? (check Feedback Inspector)

### Symbolication
- Why crashes aren't symbolicated (missing dSYM)
- Quick check: symbolicated vs unsymbolicated
- Manual symbolication with `atos`
- Common failures and fixes

### Common Crash Patterns
- **EXC_BAD_ACCESS** — null pointer, deallocated object
- **EXC_CRASH (SIGABRT)** — assertions, uncaught exceptions
- **Watchdog (0x8badf00d)** — main thread blocked too long
- **Jetsam** — memory pressure kill (no crash report)

### Terminations Without Crash Reports
- Terminations Organizer for non-crash kills
- Launch timeout, memory limit, CPU limit categories
- MetricKit integration for better diagnostics

### Claude-Assisted Interpretation
- Effective prompts for crash analysis
- What to include (full report, user context, code)
- What Claude helps with vs. what requires your judgment

## Key Pattern

### The Triage Questions

When a crash is reported, ask these questions before touching code:

| Question | Where to Look | Why It Matters |
|----------|---------------|----------------|
| How long has this been an issue? | Inspector graph area | Identifies when crash was introduced |
| Is it TestFlight only or production too? | Release filter | Determines urgency and scope |
| What was the user doing? | Feedback Inspector | Provides reproduction context |

### Reading a Crash Report

```
Exception Type:  EXC_BAD_ACCESS (SIGSEGV)
Exception Codes: KERN_INVALID_ADDRESS at 0x0000000000000010

Thread 0 Crashed:
0   MyApp    UserManager.currentUser.getter + 45
1   MyApp    ProfileViewController.viewDidLoad() + 123
```

**Translation:**
- `EXC_BAD_ACCESS` with low address (0x10) = nil dereference
- Crashed accessing `currentUser` property
- Called during view setup
- **Fix:** Guard against nil or check optional handling

## Documentation Scope

This page documents the `axiom-testflight-triage` skill — systematic crash investigation workflow that Claude uses when you report TestFlight issues. The skill contains complete Organizer walkthroughs, symbolication commands, crash pattern guides, and pressure scenarios.

The skill routes through the `ios-build` router, so asking about TestFlight crashes will automatically invoke this guidance.

## Related

- [xcode-debugging](/skills/debugging/xcode-debugging) — Use when the issue is build/environment, not a runtime crash
- [memory-debugging](/skills/debugging/memory-debugging) — Use when crash pattern suggests memory leak (jetsam, progressive growth)
- [performance-profiling](/skills/debugging/performance-profiling) — Use when crash is performance-related (watchdog timeout, high CPU)

## Resources

**WWDC**: 2018-414, 2020-10076, 2020-10078, 2020-10081, 2021-10203, 2021-10258

**Docs**: /xcode/diagnosing-issues-using-crash-reports-and-device-logs, /xcode/examining-the-fields-in-a-crash-report, /xcode/adding-identifiable-symbol-names-to-a-crash-report
