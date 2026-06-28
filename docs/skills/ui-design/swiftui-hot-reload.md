---
name: swiftui-hot-reload
description: Discipline for hot-reloading a running app with InjectionNext + Inject — two-layer setup, the device codesigning flow, verifying with xclog, and the inject-vs-rebuild boundary
skill_type: discipline
version: 1.0.0
---

# SwiftUI Hot Reload

Discipline for "live editing" a running app — editing a SwiftUI view on your Mac and watching the app you're actively using update in place, with navigation and state preserved, no rebuild and no relaunch. This is the **InjectionNext + Inject** toolchain; it is debug-only and works on the simulator and on a physical device.

This is *not* the Xcode preview canvas. Previews render a view in isolation; hot reload changes the real running app in its real context. For the canvas loop, see [swiftui-previews](/skills/ui-design/swiftui-previews).

## When to Use

Use this skill when:

- The build → install → relaunch → navigate-back loop is too slow and breaking your flow
- You want to iterate on a view *inside the running app*, with real navigation depth and model state intact
- You're iterating against a real physical device, not just the simulator
- A teammate set up "Inject" or "InjectionIII" and it isn't reloading, and you need to diagnose why
- You want to know which edits reload live and which still force a rebuild

**Core principle**: hot reload is the tightest loop for iterating on a view in its real app context — the thing the preview canvas deliberately isolates away. Its setup is the failure-prone part, and it fails *silently*, so verify rather than assume.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I set up live editing so the app updates on my iPhone while I use it?"
- "What's the difference between InjectionIII and InjectionNext, and which do I use?"
- "I added Inject but my view isn't reloading when I save. What's wrong?"
- "What linker flag do I need for hot reload, and which build configuration?"
- "Why won't injection connect on my physical device?"
- "Which kinds of edits reload live and which need a full rebuild?"
- "How do I confirm hot reload is actually working?"

## What This Skill Provides

### The two layers

Keep them straight or debugging is miserable:

- **Engine (`InjectionNext.app`)** – the current-generation injection engine (successor to the legacy `InjectionIII` / `HotReloading`). It recompiles the one file you saved and injects it into the running process via the `-interposable` linker feature.
- **Ergonomics (the `Inject` package)** – `@ObserveInjection` + `.enableInjection()`, which make SwiftUI views re-render on injection. The `Inject` README still calls itself a wrapper around InjectionIII, which is naming lag; it sits on InjectionNext fine.

### Setup, in order

- The Debug-only `-Xlinker -interposable` flag (project and Swift-package forms), plus the Xcode-version gotchas (`EMIT_FRONTEND_COMMAND_LINES` and the env-gated workaround for the local-package linker bug).
- The **physical-device flow** — Enable Devices, the copied Run Script build phase, and selecting your expanded codesigning identity. The signing match is the most common device trap: get it wrong and the injection bundle silently fails to load.
- The two-line view change (`@ObserveInjection` + `.enableInjection()`), which needs no `#if DEBUG` — it compiles to a no-op stripped from release builds.

### Verifying with xclog

Setup failures are silent, so confirm rather than guess. InjectionNext prints injection events to the running app's console; capture them with the [xclog](/skills/debugging/xclog) tool, then edit a view, save, and watch for the injection-confirmation line. Compile-failure text means your edit is bad; no line at all means the wiring is wrong. The menu-bar icon (orange = connected, green = recompiling, yellow = failed) is the human-eye fallback.

### The inject-vs-rebuild boundary

Body changes, layout, modifiers, and in-method logic reload live. Adding or removing stored properties, reordering methods in a non-`final` class, and changing a function signature force a normal rebuild. Knowing the line saves you from chasing a "broken" setup that's actually working.

## Documentation Scope

This page documents the `axiom-swiftui--hot-reload` skill — discipline for hot-reloading a running app with the third-party InjectionNext + Inject stack.

**For the preview loop:** Use [swiftui-previews](/skills/ui-design/swiftui-previews) for the canvas loop and on-device previews — a preview harness, distinct from editing the running app.

**For Apple's untethered-device tooling:** Device Hub and `devicectl` (Xcode 27) give you live device control and diagnostics — not code injection, but the native way to drive a device from your Mac. See [xcode-debugging](/skills/debugging/xcode-debugging).

## Related

- [swiftui-previews](/skills/ui-design/swiftui-previews) – The complementary canvas/on-device loop; use it for isolated view iteration, hot reload for in-app iteration
- [xclog](/skills/debugging/xclog) – The console-capture tool used to verify injection autonomously
- [xcode-debugging](/skills/debugging/xcode-debugging) – Covers Device Hub and `devicectl`, Apple's native untethered-device path that complements hot reload

## Resources

**Tools**: [InjectionNext](https://github.com/johnno1962/InjectionNext) (engine), [Inject](https://github.com/krzysztofzablocki/Inject) (SwiftUI ergonomics)
