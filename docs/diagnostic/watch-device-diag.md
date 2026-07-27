---
name: watch-device-diag
description: Diagnose why Xcode cannot install, launch, or attach to an Apple Watch, and separate that from WatchConnectivity problems
---

# Apple Watch Connection Diagnostics

Getting an Apple Watch reliably attached to Xcode is its own discipline. This page covers the diagnostics for that connection — and, just as importantly, how to tell it apart from a WatchConnectivity problem in your own code.

## Symptoms This Diagnoses

Use when you're experiencing:

- Xcode won't install, launch, or attach the debugger to an Apple Watch
- The Watch is missing from Device Hub, the run-destination list, or `devicectl list devices`
- The Watch appears but shows `unavailable`
- The app installs and launches, but LLDB never attaches
- Data isn't moving between your iPhone and watchOS apps and you don't know which layer is at fault
- You're about to unpair the Watch, delete DerivedData, or run a CoreDevice command from a forum post

## Example Prompts

- "Xcode can't see my Apple Watch"
- "Why does my Watch show as unavailable in Device Hub?"
- "My watch app installs but the debugger won't attach"
- "Should I unpair my Watch to fix this?"
- "Is this a WatchConnectivity bug or an Xcode problem?"

## Diagnostic Workflow

The organizing idea is that **two independent connections** are usually confused for one:

1. **Mac/Xcode → Apple Watch** (CoreDevice) – installs, launches, attaches LLDB
2. **iPhone app ↔ watchOS app** (WatchConnectivity) – moves your app's data

A Watch can be perfectly connected to its iPhone while the CoreDevice tunnel is broken. The costly mistake is redesigning `WCSession` to compensate for a debugger problem, so the workflow proves which layer is broken before any code changes.

From there it covers:

- A symptom-to-layer table that routes each observation to the right place
- Reading `devicectl --json-output` correctly, because the summary table collapses independent states into one column — a Watch showing `unavailable` is very often fully paired with no tunnel
- Why Developer Mode is **not** inherited from the paired iPhone, and why `connected` still doesn't mean usable
- The most reliable physical-device setup, including the USB-connected-iPhone requirement for iOS 26 and earlier
- A recovery ladder ordered least-destructive-first, with an explicit list of what *not* to try first
- How to capture an actionable Feedback report before any destructive reset

## Documentation Scope

This page documents the `watch-device-diag` diagnostic skill in the `axiom-watchos` suite. The skill file holds the full workflow — the decision tables, the `devicectl` field reference, and the recovery ladder — and Claude loads it automatically when you describe a watch that Xcode cannot reach. You don't need to invoke anything by name.

## Related

- [watch-connectivity](/skills/watchos/watch-connectivity) – Owns the `WCSession` layer; go there once this page has proven the Xcode connection is healthy
- [device-control-ref](/reference/device-control-ref) – Where the `devicectl` fields this page reads are documented in full, for any device rather than just a watch
- [platform-basics](/skills/watchos/platform-basics) – Independent-app configuration, which changes what "installed" means
- [code-signing-diag](/diagnostic/code-signing-diag) – When the Watch is reachable but installation fails on signing
