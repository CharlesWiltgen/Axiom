
# Hot Reload — Live-Editing a Running App (InjectionNext + Inject)

## Overview

**This skill covers editing a *running* app in place** — change a view body, save, and watch the live app update on the simulator or a real device with state preserved, no rebuild and no relaunch. For the *preview* canvas loop see `skills/previews.md`; for the agent-driven build/drive/screenshot loop see the `xcui` tool + `simulator-tester` agent.

**Core principle**: hot reload is the tightest loop for iterating on a view *inside its real app context* — real navigation depth, real model state, real device sensors — exactly what the preview canvas isolates away. It is a **debug-only** development tool and never ships in a release build.

**This is third-party**, not an Apple feature. Apple's native motion is toward untethered device *control* (Device Hub / `devicectl`, Xcode 27 — see `axiom-tools (skills/device-control-ref.md)`) and agent-driven iteration, not in-place code injection. For genuine "edit the running app," InjectionNext is the current tool.

## The Two Layers — Keep Them Straight

Debugging is miserable if you conflate these:

| Layer | What it is | Role |
|---|---|---|
| **Engine — `InjectionNext.app`** | John Holdsworth's current-gen injection engine (successor to `InjectionIII` / `HotReloading`) | Watches saved files, recompiles the one changed file, injects it into the running process via the `-interposable` linker feature |
| **Ergonomics — `Inject` SPM package** | Krzysztof Zabłocki's thin wrapper (`@ObserveInjection`, `.enableInjection()`) | Makes SwiftUI views re-render on injection; optional but recommended |

**Naming-lag caveat**: the `Inject` README still describes itself as "a thin wrapper around InjectionIII." InjectionNext is backward-compatible with that protocol, so `Inject` sits on top of **InjectionNext** fine — do not install the legacy InjectionIII because a doc said so.

## Setup — Engine (InjectionNext)

1. Install `InjectionNext.app` (download a release, or build from the repo's `App/` dir). Move it to `/Applications`, quit Xcode, run it.
2. **Launch Xcode from InjectionNext's "Launch Xcode" menu item** — this is how it hooks the build. Not optional.
3. Add to **Other Linker Flags, Debug configuration only** (two separate entries):
   ```
   -Xlinker
   -interposable
   ```
4. For a local Swift Package target, put the flag in `Package.swift` instead:
   ```swift
   linkerSettings: [
       .unsafeFlags(["-Xlinker", "-interposable"], .when(configuration: .debug))
   ]
   ```
5. **Xcode 16.2+ workaround** — a linker bug means the SPM flag should be gated behind InjectionNext's env var rather than always-on:
   ```swift
   var linkerSettings: [LinkerSetting] {
       let running = ProcessInfo.processInfo.environment["RUNNING_VIA_INJECTION_NEXT"] != nil
       return running ? [.unsafeFlags(["-Xlinker", "-interposable"])] : []
   }
   ```
6. **Xcode 16.3+** — add a user-defined build setting `EMIT_FRONTEND_COMMAND_LINES = YES` so InjectionNext's log-parsing mode keeps working.

**Menu-bar icon = engine status**: blue (app first run) → purple (Xcode launched via the app) → orange (client app connected) → green (recompiling a save) → yellow (compile failed).

## Setup — Device Flow (the part that differs from simulator)

Injecting into a **physical device** needs two things the simulator does not:

1. InjectionNext menu → **"Enable Devices"** (the same switch lives in the app's settings as **Device Support → Enable Device Injection**).
2. In the window that pops up, select your project's **"expanded codesigning identity"** (read it from the codesigning phase of your build logs).
3. Run the app → the icon turns **orange**.

**Don't confuse this with on-device *test* injection.** **On-Device Test Injection → Enable Device Testing** is a separate toggle for injecting XCTest bundles: turning it on puts a `copy_bundle.sh` snippet on your clipboard to paste into your target as a **Run Script build phase**. Leave it off unless you add that phase — with the toggle on and `copy_bundle.sh` not shipping the frameworks, an app that doesn't itself link XCTest crashes at `dlopen` (`Library not loaded: @rpath/XCTest.framework/XCTest`).

**Why the codesigning step matters**: the dylibs InjectionNext injects must be signed to match the running app, so the Debug build needs a **valid development identity** (the same one the project uses). If the signing doesn't match, the injection bundle silently fails to load and the icon stays purple (never reaches orange). This is the most common device setup trap.

**Quirk to expect** (from the docs): *"Sometimes a device will not connect to the app first time after unlocking it. If at first it doesn't succeed, try again."*

## Setup — Ergonomics (Inject, for SwiftUI)

1. Add the `Inject` Swift package.
2. In each view you want live:
   ```swift
   import Inject

   struct ProductView: View {
       @ObserveInjection var inject
       var body: some View {
           VStack { /* ... */ }
           .enableInjection()        // last modifier in body
       }
   }
   ```
3. **No `#if DEBUG` needed** — `Inject` compiles to no-op inlined code that LLVM strips in non-debug builds, so it's safe to leave in permanently.

## Verification via `xclog` (don't fly blind)

Setup fails *silently*: a flag on the wrong config, a missing run-script, or wrong signing leaves the app running normally with **no error** — it just never injects. Verify with InjectionNext's own signals; the agent does not need to ask "is the icon orange?":

- The injected code prints **`🔥`-prefixed** messages to the *running app's console* — `🔥 Platform connected: iPhoneSimulator` (or `iPhoneOS` on a device) when the app connects, `🔥 Recompiling: /path/to/File.swift` on each save — and compile failures as **`🔥 ⚠️ …`**. That console stream is exactly what **`xclog` captures**.
- **Verify loop**: start `xclog` on the running app → edit a view body → save → watch for the `🔥 Recompiling:` line. No `🔥` after a save = injection isn't wired (check the gotchas below). A `🔥 ⚠️` line = the edit is bad, not the setup.
- **Key on the `🔥` prefix**, not exact strings — markers can shift between versions; the prefix is the stable convention, and the icon (orange/green/yellow) is the human fallback. The `💉` marker in older InjectionIII writeups belongs to that engine, not this one.

## What Injects vs What Forces a Rebuild

| Injects live | Forces a normal rebuild |
|---|---|
| View `body` changes, layout, modifiers | Adding/removing **stored properties** |
| Logic inside an existing method | **Reordering methods** in a non-`final` class |
| Constant/literal values | **Changing a function signature** |
| New code paths in an existing function | New types, new protocol conformances |

When an edit doesn't take and the console shows no compile error, assume you changed something in the right column — rebuild once, then resume injecting.

## Gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| Flag on Release (or all configs) | Release build keeps interposable symbols and skips those optimizations | `-Xlinker -interposable` on **Debug only** |
| Flag missing from SPM target | Views in that package never inject | Add `unsafeFlags` to the package target (Setup step 4) |
| Wrong/absent codesigning identity (device) | Bundle won't load; icon stays purple | Select the project's expanded dev identity (Device step 2) |
| `@ObserveInjection` without `.enableInjection()` | Code injects but view doesn't refresh | Add `.enableInjection()` as the last modifier |
| Expecting a stored-property/signature change to inject | Save does nothing, no error | Rebuild once (see table above) |
| Xcode 16.3+ without `EMIT_FRONTEND_COMMAND_LINES` | Saves stop triggering recompiles | Add the user-defined build setting (Engine step 6) |
| Installed legacy InjectionIII per the Inject README | Outdated engine | Use **InjectionNext**; `Inject` works on it |

## When to Reach for Hot Reload

Match the loop to the task — they are complementary, not competing:

| You're iterating on… | Best loop |
|---|---|
| A leaf view's look in isolation | **Previews canvas** (`skills/previews.md`) |
| A view that needs real sensors / perf / Dynamic Type on hardware | **On-device previews** (`skills/previews.md`) or hot reload |
| A view *inside the running app* with real navigation + model state | **Hot reload** (this skill) |
| Untethered device control + diagnostics (no code injection) | **Device Hub / `devicectl`** (`axiom-tools (skills/device-control-ref.md)`) |
| Agent drives the app and screenshots each change | **`xcui` + `simulator-tester` + `xclog`** |

## Resources

**Tools**: github.com/johnno1962/InjectionNext, github.com/krzysztofzablocki/Inject

**Skills**: skills/previews.md, axiom-tools (device-control-ref.md — Device Hub / devicectl), axiom-tools (xclog)
