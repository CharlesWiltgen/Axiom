---
name: console
description: Capture iOS simulator console output (print + os_log) with xclog
disable-model-invocation: true
---

# Capture Simulator Console

Captures iOS simulator console output using **xclog**, combining print/debugPrint (stdout/stderr) with os_log/Logger into structured JSON.

## Steps

1. Read `.axiom/preferences.yaml` — if it exists and has a `simulator` section, use saved `device`, `deviceUDID`, and `bundleId`. If the file exists but is malformed, skip and fall back to discovery
2. If no saved preferences, run `${CLAUDE_PLUGIN_ROOT}/bin/xclog list` to discover installed apps
3. Ask the user which app to capture (or use the saved/specified one)
4. Run `${CLAUDE_PLUGIN_ROOT}/bin/xclog launch <bundle-id> --timeout 30s --max-lines 200`
5. Present the captured output, highlighting errors and faults
6. If the device or bundle ID changed from saved preferences, save to `.axiom/preferences.yaml` (see `axiom-tools (skills/xclog-ref.md)` skill for write instructions)

## Usage Tips

- Use `--filter "error|warning"` to focus on problems
- Use `--subsystem <name>` to filter by the app's logging subsystem
- Use `--timeout 60s` for longer capture sessions
- Pipe through `jq 'select(.level == "error")'` to extract only errors
- Use `--output /tmp/console.log` to save for later analysis

## For Full Reference

See the `axiom-tools (skills/xclog-ref.md)` skill for complete documentation.
