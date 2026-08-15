# xcui Reference (Scriptable Simulator UI & Accessibility Testing)

xcui makes iOS-simulator UI and accessibility testing scriptable for coding harnesses. It owns the test-harness semantics AXe and simctl lack — waiting, asserting, accessibility config, dialogs, computed VoiceOver — and is also the front door for input: `xcui tap`/`type`/`swipe` forward to AXe verbatim, so you get AXe's real HID touch without having to manage its environment yourself.

## Invocation

On **Claude Code**, `xcui` is already on PATH — the plugin's `bin/` is auto-resolved. Run `xcui <subcommand>`.

On **Codex, Pi, and MCP installs there is no bundled binary**: those install skills only, and no install path puts Axiom's tools on `PATH`. Check with `command -v xcui` before using any `xcui` command in this file.

If it is absent, you have two working options and should say which you took:
- Put it on PATH — clone the repo and symlink `.claude-plugin/plugins/axiom/bin/xcui` (see the Pi install guide). This is the only way to get `resize sweep`, `wait`, `assert`, `a11y`, `dialog`, and `voiceover`, which have no AXe equivalent.
- For **input only**, call AXe directly: `axe tap`/`type`/`swipe` take the same flags the `xcui` passthrough forwards, and AXe installs with `brew install cameroncooke/axe/axe`. You then own the `DEVELOPER_DIR` handling yourself — rare, since AXe 1.8.0 loads SimulatorKit under Xcode 27 unaided.

## Prerequisite: run `xcui doctor`

`xcui doctor` verifies AXe (the input/tree engine), Homebrew, Xcode, and a booted sim. If AXe is missing and brew is present, `xcui doctor --install` runs `brew install cameroncooke/axe/axe` (explicit/consented — never silent). Exit 0 = ready; exit 2 = AXe missing or no booted sim (see `problems`/`next_steps` in the JSON). When several sims are booted, every verb targets the lowest UDID deterministically; `doctor` adds a `note` listing them, and `--udid <id>` (accepted by every verb, `doctor` included) targets a specific one.

## Subcommands

- `xcui wait --for-element <id> | --gone <id> | --idle [--timeout 10s] [--poll 250ms]` — poll the a11y tree until a condition holds. Replaces sleep/re-screenshot guesswork (CLI `waitForExistence`).
- `xcui assert --id <id> [--label <s>] [--value <s>] [--trait <role>] [--single]` — assert on an element. `--single` checks the id resolves to exactly one element (e.g. "hero announces as one element").
- `xcui a11y set --toggle <name> --value <on/off> [--app <bundle-id>]` — set an accessibility setting. Supported toggles (all verified against the simulator):
  - `dynamic-type` — native `simctl ui content_size`; `--value` is a size (`large`, `accessibility-extra-large`, … up to `accessibility-extra-extra-extra-large`). Applies live; no relaunch.
  - `increase-contrast` — native `simctl ui increase_contrast`; `--value` is `on`/`off`. Applies live; no relaunch.
  - `reduce-motion` — `defaults write com.apple.Accessibility ReduceMotionEnabled`; needs relaunch, so pass `--app <bundle-id>` to have xcui terminate + relaunch the app.
  - `reduce-transparency` — `defaults write com.apple.Accessibility ReduceTransparencyEnabled`; needs relaunch (pass `--app`).
  - `voiceover` — `devicectl device settings voiceover --enable|--disable`; `--value` is `on`/`off`. Applies live; no relaunch. The only toggle that leaves the simctl/defaults world — simctl has no VoiceOver setter. Read the state back with `xcrun devicectl device info voiceover -d <udid>`.
- `xcui a11y reset` — clear xcui-set overrides (delete the defaults keys, content_size → large, increase_contrast → disabled).
- `xcui dialog accept | dismiss [--udid <udid>]` — find the frontmost system alert and tap the right button: `accept` prefers the most-permissive standard grant (`Allow While Using App` › `Allow Once` › `Allow` › `OK` › `Open`), `dismiss` prefers the decline (`Don't Allow` › `Cancel` › `Not Now`). A one-button alert is tapped for either intent. Matching is case- and apostrophe-insensitive (curly `’` = straight `'`). The tap delegates to `axe tap` (by id when present, else by label). Exit `0` handled, `1` no actionable alert.
- `xcui dialog pregrant <bundle-id> <service>… [--udid <udid>]` — grant permissions ahead of time via `simctl privacy … grant`, so the dialog never appears. Services are `simctl privacy` names (`camera`, `photos`, `location`, `microphone`, `contacts`, …). Prefer this over `accept` when you control the test setup — no alert means nothing to race.
- `xcui voiceover traverse [--udid <udid>]` — emit the **computed** VoiceOver announcement sequence: walk the a11y tree in focus order (top-to-bottom, leading-to-trailing) and render each focusable element as `label, value, trait` (plus `dimmed` when disabled). Output is a `sequence` JSON array.
- `xcui voiceover assert --sequence <file> [--udid <udid>]` — compare the live announcement sequence to an expected one; the file may be a bare JSON string array **or** a saved `traverse` report (it round-trips). Reports every differing index (one entry per mismatched position, plus a length-mismatch note when counts differ); exit `1` on any mismatch.

> **VoiceOver scope (honest framing):** `voiceover` renders the *computed* announcement from the accessibility tree — what VoiceOver would say, derived deterministically. It is **not** captured audio/TTS, which the simulator does not expose to scripting. Use it to catch missing labels, wrong trait phrasing, bad focus order, and unannounced state — not to verify the speech synthesizer itself.

> **Turning VoiceOver ON is not the same as `xcui voiceover`.** Two different things, easy to conflate:
> - `xcui a11y set --toggle voiceover --value on` — actually starts the screen reader on the device.
> - `xcui voiceover traverse` / `assert` — **computes** the announcement sequence from the accessibility tree, with VoiceOver *off*. This is the one you want in CI: deterministic, no speech, no focus stealing.
>
> You do not need the toggle to run `traverse`. Reach for the toggle when you need the device in a real VoiceOver state — verifying that your app behaves correctly while a screen reader is actually running.

> **Still not supported (a11y toggles):** `differentiate-without-color` and `bold-text` have no confirmable simulator mechanism — no native `simctl ui` setter, candidate `defaults` keys not honored by iOS on the sim, and `devicectl device settings` offers only appearance, audio, biometrics, reset, and voiceover. Omitted rather than shipped unverified.

## Resize sweeps `OS27`

`xcui resize sweep --sizes 400x900,900x600,1100x500 [--assert-id <id>] [--corner-radius R] [--settle 3s]` drives a resizable-app session across breakpoints and asserts at each one, in a single JSON envelope. It wraps the three tedious parts of `devicectl device appResize`:

- **Session lifecycle.** `appResize start` holds the session only while it runs, so it must be backgrounded and killed. xcui owns that; interrupting a sweep does not strand the app on the Resizable display.
- **Actual vs requested size.** xcui reports both and flags `honored: false` when they differ. Some devices clamp — an iPhone 17 turned a requested `1100x500` into `1100x550`. A sweep that trusted the request would report a clean pass for a width it never exercised.
- **Post-resize flakiness.** The automation session can time out once while the display transitions, so each assertion retries before failing.

`--screenshot-dir <dir>` writes `<W>x<H>.png` per breakpoint, captured from the Resizable display. **Reach for this before `--assert-id`**: an id-presence check catches "the element vanished", but resizing breaks layouts by overlap, truncation, and clipping — which only a picture shows.

`--strict` fails any step the device clamped. Without it a clamped sweep still exits `0` when the assertions pass, so an exit-code-only consumer reads "all breakpoints validated" for breakpoints that were never produced; the `clamped` count and a `note` say so either way.

Exit `0` all sizes passed · `1` an assertion, screenshot, or (under `--strict`) a clamp failed · `2` environment error.

Three `devicectl` failures are separated, because they need different fixes:

| CoreDeviceError | Means | Fix |
|---|---|---|
| 1001 | device has no Resizable App Management | use an OS 27 simulator or device |
| 24001 | nothing in the foreground to move | launch the app first |
| 24004 | no session active | not an error during startup — xcui polls through it |

## Device state — biometrics, orientation, location: use `devicectl`

`xcui` drives the **in-app UI + accessibility tree** (`tap`/`assert`, VoiceOver order) and toggles **accessibility settings** (`a11y set`: Dynamic Type, contrast, motion). It does **not** drive hardware/device state. For **biometrics** (Face ID / Touch ID — neither `xcui` nor `simctl` can do this), orientation, location, status bar, and memory-pressure, use `devicectl`: it works on simulators in Xcode 26.6+, takes one `-d <udid>` selector across sim + device, and emits a stable `--json-output`. The two compose — `devicectl` sets the state, `xcui` asserts the resulting UI. Full verified catalog: `skills/device-control-ref.md`.

## Input — `xcui tap`, not `axe tap`

Input verbs forward to AXe verbatim: same flags, same output, same exit code. Use them instead of calling `axe` directly and the SimulatorKit/`DEVELOPER_DIR` handling comes along automatically, so guidance can't drift out of it.

Forwarded: `tap`, `slider`, `type`, `swipe`, `drag`, `touch`, `gesture`, `button`, `key`, `key-sequence`, `key-combo`, `screenshot`. `--udid` is injected when omitted. `xcui tap --help` shows AXe's own flags.

```bash
xcui tap --id loginButton --udid <udid>     # real HID touch, not pointer-hover
xcui type "user@example.com" --udid <udid>
axe describe-ui --udid <udid>              # raw a11y tree (xcui assert/wait parse this)
```

> **Still calling `axe` directly?** `describe-ui`, `stream-video`, and `record-video` stay bare — the first is what xcui itself parses, and the two streaming verbs outlive any request timeout. Those are the only calls that need a `DEVELOPER_DIR=` prefix, and only when `xcui doctor` reports an `axe_developer_dir` (rare — AXe 1.8.0 loads SimulatorKit under Xcode 27 unaided).

## Output & exit codes

JSON by default (`tool`/`version` envelope); `--human` for prose. Exit: `0` pass · `1` assertion-fail/wait-timeout · `2` environment error · `8` output-write error.

> **CLI gotcha:** Go's flag parser stops at the first positional, so always put flags after the subcommand and use the all-flag forms shown above (`assert --id …`, not `assert <id> …`).

## Resources

**Tools**: `axe` (AXe — `brew install cameroncooke/axe/axe`), `xcrun simctl`

**Skills**: axiom-accessibility, axiom-testing

**Agents**: simulator-tester (drives xcui live), accessibility-auditor (static a11y scan)
