---
name: console
description: Capture iOS simulator console output (print + os_log) with xclog
disable-model-invocation: true
---

# Capture Simulator Console

Captures iOS simulator console output using **xclog**, combining print/debugPrint (stdout/stderr) with os_log/Logger into structured JSON.

## Steps

1. Run `${CLAUDE_PLUGIN_ROOT}/bin/xclog list` to discover installed apps
2. Ask the user which app to capture (or use the one they specified)
3. Run `${CLAUDE_PLUGIN_ROOT}/bin/xclog launch <bundle-id> --timeout 30s --max-lines 200`
4. Present the captured output, highlighting errors and faults

## Usage Tips

- Use `--filter "error|warning"` to focus on problems
- Use `--subsystem <name>` to filter by the app's logging subsystem
- Use `--timeout 60s` for longer capture sessions
- Pipe through `jq 'select(.level == "error")'` to extract only errors
- Use `--output /tmp/console.log` to save for later analysis

## For Full Reference

See the `axiom-xclog-ref` skill for complete documentation.
