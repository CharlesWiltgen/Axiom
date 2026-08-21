---
name: axiom-ui
description: "Drive simulator UI with an external xcui or AXe installation when available"
---

# Drive and Validate Simulator UI

`xcui` is not bundled with the Cursor plugin and has no Axiom MCP wrapper.

1. Before UI automation, check `command -v xcui`. If present, run `xcui doctor` and follow its external installation's documented workflow.
2. If `xcui` is absent, AXe may be used only for compatible pass-through verbs: `tap`, `slider`, `type`, `swipe`, `drag`, `touch`, `gesture`, `button`, `key`, `key-sequence`, `key-combo`, and `screenshot`. Check `command -v axe` before using one of those verbs, use that verb's documented AXe arguments, and handle `DEVELOPER_DIR` explicitly if AXe reports a SimulatorKit loading error; wrapper-only device auto-resolution is unavailable.
3. The `wait`, `assert`, `a11y`, `dialog`, `voiceover`, and `resize` capabilities require external `xcui`. If `xcui` is unavailable for one of these capabilities, stop that UI step and report that external `xcui` is required; do not substitute AXe or timing guesses.
4. If neither tool is available, stop UI automation and give the user setup guidance for an external xcui or AXe installation. Do not claim the Cursor plugin installed either tool.
5. When UI automation is unavailable, continue with non-UI simulator and log checks that still answer the request, and label that result as degraded coverage.
6. Treat simulator erase, delete, shutdown, and boot operations as state-changing actions and preserve the user's authorization boundary.
