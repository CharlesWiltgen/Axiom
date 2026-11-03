---
name: xcui-ref
description: Complete reference for the `xcui` CLI that ships with Axiom — doctor/wait/assert/a11y/dialog/voiceover subcommands for scriptable iOS-simulator UI and accessibility testing, output envelope, exit codes, the verified accessibility toggles, system-dialog handling, computed VoiceOver, and how it divides labor with AXe
---

# xcui Reference (Scriptable Simulator UI and Accessibility Testing)

Reference for `xcui`, the simulator testing tool bundled with Axiom, which lets your assistant script UI and accessibility tests on the iOS simulator. It adds what AXe and `simctl` lack (waiting on conditions, asserting on the accessibility tree, toggling accessibility settings, handling permission dialogs, and computing VoiceOver announcements), and it forwards taps, typing, and swipes to AXe so input lands without you managing AXe's setup.

## When to Use This Reference

Use this reference when:
- Looking up the flags for `xcui doctor`, `wait`, `assert`, `a11y set`, `a11y reset`, `dialog`, `voiceover`, and `resize sweep`
- Interpreting an exit code (`0` pass, `1` assertion failure or wait timeout, `2` usage or environment error, `8` output-write error)
- Checking which accessibility toggles `a11y set` supports and how each is applied (native `simctl ui`, or `defaults write` plus a relaunch)
- Handling a system permission alert in a test, either by tapping the right button (`dialog accept` or `dismiss`) or by granting the permission in advance so the alert never appears (`dialog pregrant`)
- Validating VoiceOver announcements and focus order without capturing audio (`voiceover traverse` and `voiceover assert`)
- Understanding how `xcui` finds the booted simulator, and why it refuses to guess when more than one is booted
- Working out why a tap reported success but nothing happened
- Deciding what to drive with `xcui` and what to call on `axe` directly
- Switching between JSON (the default) and `--human` output
- Diagnosing why `doctor` exits 2 (AXe missing or too old, no booted simulator, or several booted without `--udid`)

## Example Prompts

Questions you can ask your assistant that will draw from this reference:

- "How do I wait for an element to appear on the simulator before asserting?"
- "How do I assert a VoiceOver label and trait on an element?"
- "How do I turn on Dynamic Type or Increase Contrast on the simulator?"
- "How do I dismiss the camera permission dialog in my test, or skip it entirely?"
- "How do I check the VoiceOver announcement order without listening to audio?"
- "What does `xcui doctor` check, and how do I install AXe?"
- "Why did `xcui assert` exit 1?"
- "Why isn't my accessibility toggle taking effect until I relaunch the app?"

## What's Covered

- **Invocation** – In Claude Code, `xcui` is on your `PATH` because Axiom's session hook adds the plugin's `tools/` folder; if the bare name isn't found, `<plugin-root>/tools/xcui` works, where `<plugin-root>` is the installed plugin's folder. Codex runs `<plugin-root>/tools/xcui` (there, the folder containing `.codex-plugin/plugin.json`) unless `command -v xcui` finds it on `PATH`. In Pi, `xcui` isn't on your `PATH` until you add it ([Pi setup](/start/pi-install#command-line-helpers)). MCP-only setups don't include `xcui`, and it has no MCP tool; without it, your assistant can still send input by calling AXe directly, but `wait`, `assert`, `a11y`, `dialog`, `voiceover`, and `resize sweep` have no AXe equivalent
- **`doctor` subcommand** – Verifies AXe, Homebrew, Xcode, and a booted simulator; `--install` runs `brew install cameroncooke/axe/axe`, only when you ask; `--human` for prose. Exit 0 means a device command can run now, so `doctor` also fails when several simulators are booted with no `--udid` (every other subcommand refuses in that state) or when AXe is older than 1.7.0, the first version with `--tap-style`. The `booted` array lists each device to pick a `--udid` from, and `--udid <id>` reports on a specific one
- **`wait` subcommand** – `--for-element <id>`, `--gone <id>`, or `--idle`, with `--timeout` and `--poll`. It polls the accessibility tree until the condition holds or the deadline passes, the command-line equivalent of `waitForExistence`
- **`assert` subcommand** – `--id <id>` plus optional `--label`, `--value`, `--trait`, and `--single`. `--single` asserts that the ID resolves to exactly one element, and `--trait` matches a bare word (`button`, `image`) against the accessibility role or type
- **`a11y set` and `a11y reset`** – The five verified toggles and how each is applied (see the table below); `--app <bundle-id>` relaunches the app for the toggles that need it
- **`dialog` subcommand** – `accept` and `dismiss` find the frontmost system alert and tap the right standard button with a physical touch (a permission grant, `OK`, `Cancel`); a one-button alert is tapped for either intent, and matching ignores case and apostrophe style. `pregrant <bundle-id> <service>…` grants permissions through `simctl privacy` so the alert never appears. Exit `0` means handled, `1` means no actionable alert
- **`voiceover` subcommand** – `traverse` walks the tree in focus order and emits the **computed** announcement sequence (`label, value, trait`, plus `dimmed` when disabled). `assert --sequence <file>` compares the live sequence with an expected one, given as a JSON string array or a saved `traverse` report, and reports every differing position, plus a note when the lengths differ. The sequence is computed from the accessibility tree, **not** captured speech (a simulator runs no screen reader), so use it to catch missing labels, wrong traits, and bad focus order
- **Input verbs** – `tap`, `slider`, `type`, `swipe`, `drag`, `touch`, `gesture`, `button`, `key`, `key-sequence`, `key-combo`, and `screenshot` forward to AXe with the same flags, output, and exit code. `xcui` adds `--udid` when you omit it and exactly one simulator is booted, and adds `--tap-style physical` to `tap` when you pass no style. Prefer `xcui tap` to `axe tap`: it sets `DEVELOPER_DIR` for you, so it keeps working under an Xcode whose SimulatorKit AXe can't load on its own. Only `axe describe-ui` (the raw tree `xcui` parses) and AXe's streaming verbs are called directly; if `xcui doctor` reports an `axe_developer_dir`, prefix those with `DEVELOPER_DIR=<value>`, which is rarely needed since AXe 1.8.0 finds SimulatorKit in Xcode 27 on its own
- **Tap styles** – A measured table of which SwiftUI targets each AXe tap style (`automatic`, `simulator`, `physical`) actually activates, why a tap that does nothing still prints ✓, and why selectors tap the accessibility frame rather than the visible pixels
- **`resize sweep` subcommand** – Needs an OS 27 simulator or device. It drives a resizable-app session across the breakpoints in `--sizes` and checks each one, in one JSON envelope: it holds the session and tears it down (even on SIGINT or SIGTERM), writes a PNG per breakpoint with `--screenshot-dir`, runs an accessibility check with `--assert-id`, fails on a clamped size with `--strict`, reports actual against requested size with an `honored` flag, retries each assertion through post-resize flakiness, and separates the three `appResize` CoreDeviceErrors (1001, 24001, 24004) into distinct fixes
- **Output envelope and exit codes** – One compact JSON object with `tool` and `version` first; every subcommand accepts `--human` for prose. Exit `0` pass, `1` assertion failure or wait timeout, `2` usage or environment error, `8` output-write error
- **Command-line grammar** – Flags may come in any order after the subcommand. Apart from the input verbs and `dialog pregrant`, subcommands take no positional argument, so `assert <id>` fails with exit `2` and names the unexpected argument; write `assert --id …`

## Accessibility Toggles

`a11y set --toggle <name> --value <…>` supports the following toggles, all verified against the booted simulator. `a11y reset` clears them: it deletes the `defaults` keys, sets `content_size` to `large`, and sets `increase_contrast` to `disabled`.

| Toggle | Mechanism | `--value` | Relaunch |
|--------|-----------|-----------|----------|
| `dynamic-type` | native `simctl ui content_size` | a size (`large` … `accessibility-extra-extra-extra-large`) | no |
| `increase-contrast` | native `simctl ui increase_contrast` | `on` / `off` | no |
| `reduce-motion` | `defaults write com.apple.Accessibility ReduceMotionEnabled` | `on` / `off` | yes (pass `--app`) |
| `reduce-transparency` | `defaults write com.apple.Accessibility ReduceTransparencyEnabled` | `on` / `off` | yes (pass `--app`) |
| `voiceover` | `devicectl device settings voiceover` | `on` / `off` | no |

`differentiate-without-color` and `bold-text` are **not supported**: `simctl ui` has no setter for them, the simulator ignores the candidate `defaults` keys, and `devicectl device settings` covers only appearance, audio, biometrics, reset, and VoiceOver. They are left out rather than shipped unverified.

::: tip Turning VoiceOver on is not the same as `xcui voiceover`
`a11y set --toggle voiceover` turns on the VoiceOver setting your app reads (`UIAccessibility.isVoiceOverRunning`), but on a simulator no screen reader runs: no focus cursor appears, and a single tap activates a button directly. `xcui voiceover traverse` **computes** the announcement sequence from the accessibility tree with VoiceOver off: it's deterministic, makes no speech, steals no focus, and is the one you want in CI. Use the toggle to test code that changes behavior for VoiceOver users, and a physical device to test the screen reader itself.
:::

## Documentation Scope

This page documents the `xcui-ref` skill in the `axiom-tools` suite. xcui is Axiom's bundled tool for scripted simulator UI and accessibility testing.

- For the input primitives `xcui` forwards to, see [AXe (Simulator Automation)](/reference/axe-ref)
- For device state such as biometrics, orientation, and location, use `devicectl`; see [Device Control](/reference/device-control-ref). `xcui` then checks the on-screen result that state produces

## Related

- [simulator-tester](/agents/simulator-tester) – The agent that drives `xcui` live: setting toggles, waiting, and asserting on the tree
- [accessibility-auditor](/agents/accessibility-auditor) – Scans your source code for accessibility problems, the static counterpart to live validation with `xcui`
- [/axiom:ui](/commands/testing/ui) – The command that runs `xcui` for you
- [xclog-ref](/reference/xclog-ref), [xcprof-ref](/reference/xcprof-ref), and [xcsym-ref](/reference/xcsym-ref) – References for the other bundled tools; the [Tools overview](/tools/) covers axbuild and xcproject
