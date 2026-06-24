# xcui Reference (Scriptable Simulator UI & Accessibility Testing)

xcui makes iOS-simulator UI and accessibility testing scriptable for coding harnesses. It owns the test-harness semantics AXe and simctl lack — waiting, asserting, accessibility config, dialogs, computed VoiceOver — and delegates input (tap/type/swipe) to AXe, which injects real HID touch.

## Invocation

`xcui` is on PATH as a bare command (plugin `bin/` is auto-resolved). Run `xcui <subcommand>`.

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
- `xcui a11y reset` — clear xcui-set overrides (delete the defaults keys, content_size → large, increase_contrast → disabled).
- `xcui dialog accept | dismiss [--udid <udid>]` — find the frontmost system alert and tap the right button: `accept` prefers the most-permissive standard grant (`Allow While Using App` › `Allow Once` › `Allow` › `OK` › `Open`), `dismiss` prefers the decline (`Don't Allow` › `Cancel` › `Not Now`). A one-button alert is tapped for either intent. Matching is case- and apostrophe-insensitive (curly `’` = straight `'`). The tap delegates to `axe tap` (by id when present, else by label). Exit `0` handled, `1` no actionable alert.
- `xcui dialog pregrant <bundle-id> <service>… [--udid <udid>]` — grant permissions ahead of time via `simctl privacy … grant`, so the dialog never appears. Services are `simctl privacy` names (`camera`, `photos`, `location`, `microphone`, `contacts`, …). Prefer this over `accept` when you control the test setup — no alert means nothing to race.
- `xcui voiceover traverse [--udid <udid>]` — emit the **computed** VoiceOver announcement sequence: walk the a11y tree in focus order (top-to-bottom, leading-to-trailing) and render each focusable element as `label, value, trait` (plus `dimmed` when disabled). Output is a `sequence` JSON array.
- `xcui voiceover assert --sequence <file> [--udid <udid>]` — compare the live announcement sequence to an expected one; the file may be a bare JSON string array **or** a saved `traverse` report (it round-trips). Reports every differing index (one entry per mismatched position, plus a length-mismatch note when counts differ); exit `1` on any mismatch.

> **VoiceOver scope (honest framing):** `voiceover` renders the *computed* announcement from the accessibility tree — what VoiceOver would say, derived deterministically. It is **not** captured audio/TTS, which the simulator does not expose to scripting. Use it to catch missing labels, wrong trait phrasing, bad focus order, and unannounced state — not to verify the speech synthesizer itself.

> **Not yet supported (a11y toggles):** the `voiceover`, `differentiate-without-color`, and `bold-text` *toggles* for `a11y set` had no confirmable simulator mechanism (no native `simctl ui` setter, and their candidate `defaults` keys are not populated/honored by iOS on the sim). They are intentionally omitted from v1 rather than shipped unverified. (This is distinct from the `xcui voiceover` command above, which reads the tree and needs no toggle.)

## Device state — biometrics, orientation, location: use `devicectl`

`xcui` drives the **in-app UI + accessibility tree** (`tap`/`assert`, VoiceOver order) and toggles **accessibility settings** (`a11y set`: Dynamic Type, contrast, motion). It does **not** drive hardware/device state. For **biometrics** (Face ID / Touch ID — neither `xcui` nor `simctl` can do this), orientation, location, status bar, and memory-pressure, use `devicectl`: it works on simulators in Xcode 26.6+, takes one `-d <udid>` selector across sim + device, and emits a stable `--json-output`. The two compose — `devicectl` sets the state, `xcui` asserts the resulting UI. Full verified catalog: `axiom-testing (skills/ui-testing.md)` → "Simulator control from CI: devicectl".

## For input, use AXe directly

```bash
axe tap --id loginButton --udid <udid>     # real HID touch, not pointer-hover
axe type "user@example.com" --udid <udid>
axe describe-ui --udid <udid>              # raw a11y tree (xcui assert/wait parse this)
```

## Output & exit codes

JSON by default (`tool`/`version` envelope); `--human` for prose. Exit: `0` pass · `1` assertion-fail/wait-timeout · `2` environment error · `8` output-write error.

> **CLI gotcha:** Go's flag parser stops at the first positional, so always put flags after the subcommand and use the all-flag forms shown above (`assert --id …`, not `assert <id> …`).

## Resources

**Tools**: `axe` (AXe — `brew install cameroncooke/axe/axe`), `xcrun simctl`

**Skills**: axiom-accessibility, axiom-testing

**Agents**: simulator-tester (drives xcui live), accessibility-auditor (static a11y scan)
