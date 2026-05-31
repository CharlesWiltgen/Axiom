# xcui Reference (Scriptable Simulator UI & Accessibility Testing)

xcui makes iOS-simulator UI and accessibility testing scriptable for coding harnesses. It owns the test-harness semantics AXe and simctl lack — waiting, asserting, accessibility config, dialogs, computed VoiceOver — and delegates input (tap/type/swipe) to AXe, which injects real HID touch.

## Invocation

`xcui` is on PATH as a bare command (plugin `bin/` is auto-resolved). Run `xcui <subcommand>`.

## Prerequisite: run `xcui doctor`

`xcui doctor` verifies AXe (the input/tree engine), Homebrew, Xcode, and a booted sim. If AXe is missing and brew is present, `xcui doctor --install` runs `brew install cameroncooke/axe/axe` (explicit/consented — never silent). Exit 0 = ready; exit 2 = AXe missing or no booted sim (see `problems`/`next_steps` in the JSON).

## Subcommands

- `xcui wait --for-element <id> | --gone <id> | --idle [--timeout 10s] [--poll 250ms]` — poll the a11y tree until a condition holds. Replaces sleep/re-screenshot guesswork (CLI `waitForExistence`).
- `xcui assert --id <id> [--label <s>] [--value <s>] [--trait <role>] [--single]` — assert on an element. `--single` checks the id resolves to exactly one element (e.g. "hero announces as one element").
- `xcui a11y set --toggle <name> --value <on/off> [--app <bundle-id>]` — set an accessibility setting. Supported toggles (all verified against the simulator):
  - `dynamic-type` — native `simctl ui content_size`; `--value` is a size (`large`, `accessibility-extra-large`, … up to `accessibility-extra-extra-extra-large`). Applies live; no relaunch.
  - `increase-contrast` — native `simctl ui increase_contrast`; `--value` is `on`/`off`. Applies live; no relaunch.
  - `reduce-motion` — `defaults write com.apple.Accessibility ReduceMotionEnabled`; needs relaunch, so pass `--app <bundle-id>` to have xcui terminate + relaunch the app.
  - `reduce-transparency` — `defaults write com.apple.Accessibility ReduceTransparencyEnabled`; needs relaunch (pass `--app`).
- `xcui a11y reset` — clear xcui-set overrides (delete the defaults keys, content_size → large, increase_contrast → disabled).

> **Not yet supported:** `voiceover`, `differentiate-without-color`, and `bold-text` had no confirmable simulator mechanism (no native `simctl ui` setter, and their candidate `defaults` keys are not populated/honored by iOS on the sim). They are intentionally omitted from v1 rather than shipped unverified.

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
