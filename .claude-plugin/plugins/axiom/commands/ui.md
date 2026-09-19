---
name: ui
description: Drive and validate the iOS simulator UI and accessibility with xcui
disable-model-invocation: true
---

# Drive & Validate Simulator UI

Uses **xcui** (+ AXe + simctl) to make simulator UI and accessibility testing scriptable: tap by accessibility id, wait on conditions, assert on the a11y tree, toggle accessibility settings, dismiss dialogs.

## Steps

1. Run `xcui doctor` — confirms AXe is installed (offer `xcui doctor --install` if missing) and a simulator is booted
2. For input, use `xcui`: `xcui tap --id <id> --udid <udid>` (a physical touch — AXe's default tap style is ignored by SwiftUI controls), `xcui type`, `xcui swipe`. These forward to AXe — same flags, same exit code — and carry xcui's SimulatorKit/`DEVELOPER_DIR` handling, so there is nothing to remember to prefix. A tap prints ✓ whether or not anything happened; confirm with step 3 or 4. (This command is Claude Code-only, where `xcui` is always on PATH.)
3. To synchronize, use `xcui wait --for-element <id>` instead of sleeping or re-screenshotting
4. To validate, use `xcui assert --id <id> --label "…" --trait button --single`
5. For accessibility runs, set state with `xcui a11y set --toggle <name> --value on --app <bundle-id>` then assert

## Usage Tips

- `xcui` auto-resolves the booted sim when exactly one is booted; with more, every command refuses without `--udid` and lists the booted devices
- Output is JSON by default; add `--human` for prose
- Exit codes: 0 pass · 1 assertion-fail/timeout · 2 environment error

## For Full Reference

See the `axiom-tools (skills/xcui-ref.md)` skill.
