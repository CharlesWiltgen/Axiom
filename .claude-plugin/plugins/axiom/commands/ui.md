---
name: ui
description: Drive and validate the iOS simulator UI and accessibility with xcui
disable-model-invocation: true
---

# Drive & Validate Simulator UI

Uses **xcui** (+ AXe + simctl) to make simulator UI and accessibility testing scriptable: tap by accessibility id, wait on conditions, assert on the a11y tree, toggle accessibility settings, dismiss dialogs.

## Steps

1. Run `xcui doctor` — confirms AXe is installed (offer `xcui doctor --install` if missing) and a simulator is booted
2. For input, use AXe directly: `axe tap --id <id> --udid <udid>` (real HID touch), `axe type`, `axe swipe`
3. To synchronize, use `xcui wait --for-element <id>` instead of sleeping or re-screenshotting
4. To validate, use `xcui assert --id <id> --label "…" --trait button --single`
5. For accessibility runs, set state with `xcui a11y set --toggle <name> --value on --app <bundle-id>` then assert

## Usage Tips

- `xcui` auto-resolves the booted sim; pass `--udid` to target a specific one
- Output is JSON by default; add `--human` for prose
- Exit codes: 0 pass · 1 assertion-fail/timeout · 2 environment error

## For Full Reference

See the `axiom-tools (skills/xcui-ref.md)` skill.
