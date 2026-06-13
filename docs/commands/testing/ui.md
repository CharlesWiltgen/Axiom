# /axiom:ui

Drive and validate the iOS simulator UI and accessibility with `xcui` (plus AXe and `simctl`).

## Command

```bash
/axiom:ui
```

## What It Does

Guides you through scriptable simulator UI and accessibility testing:

1. **Preflights the environment** with `xcui doctor` — confirms AXe is installed (offers `xcui doctor --install` if missing) and a simulator is booted
2. **Drives input via AXe** – `axe tap --id <id>` (real HID touch), `axe type`, `axe swipe`
3. **Synchronizes with `xcui wait`** – `--for-element <id>` instead of sleeping or re-screenshotting
4. **Asserts on the accessibility tree** – `xcui assert --id <id> --label "…" --trait button --single` (exit 1 on failure)
5. **Sets accessibility state** – `xcui a11y set --toggle <name> --value on --app <bundle-id>`, then re-asserts

## When to Use

- Validating UI behavior on the simulator without a human driving it
- Tapping by accessibility identifier rather than fragile pixel coordinates
- Waiting for an element or app-idle instead of guessing with `sleep`
- Running accessibility checks live — Dynamic Type, Increase Contrast, Reduce Motion, Reduce Transparency — and asserting the result

## Usage Tips

- `xcui` auto-resolves the booted simulator; pass `--udid` to target a specific one
- Output is JSON by default; add `--human` for prose
- Exit codes: `0` pass · `1` assertion-fail/timeout · `2` environment error
- For taps and typing, call `axe` directly — `xcui` owns waiting, asserting, and accessibility config, not input

## Related

- [xcui Reference](/reference/xcui-ref) – full tool documentation, subcommand flags, and the verified accessibility toggles
- [simulator-tester](/agents/simulator-tester) – the agent that drives `xcui` live for test scenarios and accessibility validation
- [AXe (Simulator Automation)](/reference/axe-ref) – the input/tree engine `xcui` builds on
- [/axiom:test-simulator](/commands/testing/test-simulator) – scenario setup (location, push, deep links); `/axiom:ui` owns interaction, assertion, and accessibility config
