---
name: app-launch
description: Diagnosing and fixing slow app launch — pre-main/dyld time, main-thread launch work, extended launch, and notification-launch performance
---

# App Launch Performance

Diagnose and fix slow app launch — from the moment the user taps the icon to the moment the first frame is interactive. Apple's target is a first frame within ~400 ms, with the app interactive by the time the launch animation finishes; iOS runs a watchdog that terminates apps that overrun the launch budget.

## When to Use

Use this skill when:
- The app takes more than ~1 s on a current device (or ~2 s on an old one) to show its first screen
- Launch is fine on your device but slow on users' older hardware
- The first screen appears but is frozen for a moment before it responds
- Xcode Organizer's "Launches" pane flags a launch-time regression
- The app is slow to come up after tapping a push notification

**Not a launch problem?** A slow return from the app switcher is a *resume*, not a launch — don't measure it as one. General sluggishness during use → [performance-profiling](/skills/debugging/performance-profiling). A UI that's completely frozen mid-session → [hang-diagnostics](/skills/debugging/hang-diagnostics).

## Example Prompts

- "My app takes about 3 seconds to launch on an older iPhone."
- "Xcode Organizer says my launch time regressed — how do I find what changed?"
- "How do I reduce pre-main / dyld time?"
- "My app is slow to open after tapping a push notification."
- "How do I write a launch performance regression test?"

## What This Skill Provides

### The launch phase model

Three phases, mapped to the App Life Cycle timeline in Instruments:
- **Phase 1 — pre-main** — dyld loads frameworks, then static initializers run (C++ constructors, Objective-C `+load`, `__attribute__((constructor))`)
- **Phase 2 — main → first frame** — `didFinishLaunchingWithOptions` / `scene(_:willConnectTo:)` / SwiftUI `App.init` and `App.body` / root `viewDidLoad` / first `View.body`
- **Phase 3 — first frame → interactive** — the "extended launch": the post-first-frame tail where async data loads behind placeholders and the app must already be responsive

### Launch types and how to reproduce each

- **Cold** — reboot, wait, launch
- **Warm** — force-quit, wait, launch (Apple's recommended measurement — most consistent)
- **Hot / resume** — background and return; *not a launch*, don't measure it as one
- **Notification launch** — background, send a push, tap it

### Measurement hygiene and a no-Instruments triage path

- Why an unstable baseline tells you nothing: reboot, Release build, airplane mode, stable iCloud, fixed mock data, oldest supported device, measure warm launches, and "profiling ≠ measuring"
- A deadline-mode path when you can't profile: `DYLD_PRINT_STATISTICS=1` for a zero-setup pre-main breakdown, a launch-path code-review checklist, device bisection, and a fast `XCTApplicationLaunchMetric` verify

### Tools

- App Launch instrument template and `dyld Activity` instrument
- `xctrace --template 'App Launch'` for headless/CI profiling
- Xcode Organizer Launch Time and Launches panes
- `XCTApplicationLaunchMetric` (XCTest regression gate)
- `MXAppLaunchMetric` field histograms; App Store Connect "App Extended Launch Usage"
- A custom "app is interactive" signpost (Swift / Objective-C / SwiftUI variants)

### Fixes by phase

- **Pre-main** — consolidate/static-link frameworks, mergeable libraries, move `+load` work to `+initialize`, no `dlopen` on the launch path
- **Main → first frame** — defer non-critical work out of the delegate / `App.init` / `viewDidLoad` / `View.body`, load only first-screen data, watch SwiftData/Core Data stack cost, fix priority inversions, flatten the first view hierarchy
- **First frame → interactive** — placeholders + async load, signpost the tail, no speculative pre-warming

### Push-notification launch

- Targets: tap → first pixel ≈ 200 ms, tap → interactive ≈ 1 s
- Keep heavy work out of `UNUserNotificationCenter` handlers; cache deep-link routing; treat background-app-refresh pre-warming as opportunistic; profile the notification path on a real device

### Common launch mistakes

A table of the recurring ones: measuring in the Simulator or a Debug build, measuring a resume as a launch, synchronous I/O in `didFinishLaunching`, loading all data at launch, heavy static init / too many dynamic frameworks, speculative pre-warming, big allocations at launch, and trusting profiler-inflated numbers.

## Related

- [performance-profiling](/skills/debugging/performance-profiling) — Instruments mechanics; this skill points you at the App Launch template and tells you which phase to profile. Also covers headless `xctrace` and the MetricKit/`MXAppLaunchMetric` reference material this skill cross-links.
- [hang-diagnostics](/skills/debugging/hang-diagnostics) — if launch reaches the first frame but the screen is frozen, switch to main-thread analysis here
- [swift-concurrency](/skills/concurrency/swift-concurrency) — moving heavy main-actor launch work off the critical path
- [energy](/skills/debugging/energy) — battery-drain diagnosis (launch work and energy issues share root causes)

## Resources

**WWDC**: 2019-423, 2019-411, 2021-10181, 2022-110362, 2023-10268, 2024-10181

**Docs**: /xcode/reducing-your-app-s-launch-time, /metrickit/mxapplaunchmetric, /xctest/xctapplicationlaunchmetric, /uikit/about-the-app-launch-sequence
