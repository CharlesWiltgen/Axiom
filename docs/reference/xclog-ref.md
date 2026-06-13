---
name: xclog-ref
description: Complete reference for the `xclog` CLI that ships with Axiom — list/launch/attach/show subcommands, JSON output schema, simulator and physical-device coverage, preferences file
---

# xclog Reference (iOS Console Capture)

Complete reference for `xclog`, the Axiom-bundled CLI that captures iOS simulator and physical-device console output. Combines `simctl launch --console` (print/debugPrint/NSLog) with `log stream --style json` (os_log/Logger) into a single LLM-friendly stream.

## When to Use This Reference

Use this reference when:
- Looking up `xclog list` / `launch` / `attach` / `show` subcommand flags and semantics
- Checking which Swift logging APIs are captured by each mode (the coverage table)
- Reading the JSON output schema (`time`, `source`, `level`, `subsystem`, `category`, `process`, `pid`, `text`)
- Configuring `--timeout`, `--max-lines`, `--filter`, `--subsystem`, `--output`, `--human`, `--no-color`
- Targeting a specific simulator with `--device <udid>` or a physical device with `--device-udid <udid>`
- Reading or writing `.axiom/preferences.yaml` so saved simulator + bundle ID are reused between sessions
- Understanding why `attach` skips `print()` output (it streams `os_log` only)
- Diagnosing common errors (bad bundle ID, no booted simulator, invalid regex, invalid subsystem)

## Example Prompts

- "What flags does `xclog launch` accept?"
- "What's the JSON schema xclog emits?"
- "Can xclog read logs from a physical device?"
- "How do I capture errors only from my app's subsystem?"
- "How does the `.axiom/preferences.yaml` file work?"
- "Why doesn't `xclog attach` show my `print()` output?"
- "How do I bound output so I don't blow context?"

## What's Covered

- **Invocation** – `xclog` is on PATH as a bare command (Claude Code 2.1.91+ resolves plugin `bin/` entries automatically); no prefix or path lookup needed
- **`list` subcommand** – discover installed apps, JSON-lines output (`bundle_id`, `name`, `version`)
- **`launch` subcommand** – full capture (print + debugPrint + NSLog + os_log + Logger), simulator only, terminates any running instance of the target app
- **`attach` subcommand** – monitor an already-running process via os_log only, simulator only, preserves app state but no `print()` capture
- **`show` subcommand** – historical log search, simulator and physical device (uses `log collect` over USB for physical devices)
- **JSON output schema** – `time`, `source` (`print`/`stderr`/`os_log`), `level` (`debug`/`default`/`info`/`error`/`fault`), `subsystem`, `category`, `process`, `pid`, `text`; fields omitted (not null) when not applicable
- **Human-readable mode** – `--human` plus optional `--no-color`
- **Options reference table** – `--device`, `--device-udid`, `--output`, `--filter`, `--subsystem`, `--max-lines`, `--timeout`, `--last`
- **Coverage tables** – Swift API by mode (`print`, `debugPrint`, `NSLog`, `os_log`, `Logger`) and platform by command (simulator vs physical device)
- **Preferences file** – `.axiom/preferences.yaml` schema with `simulator.device` / `deviceUDID` / `bundleId`, read/write protocol, `.gitignore` augmentation
- **Filtering nuance** – `--filter` matches message text; level/JSON-field filtering needs `jq`
- **Common subsystem patterns** – `com.apple.network`, `com.apple.coredata`, `com.apple.swiftui`, `com.apple.uikit`
- **Error behavior** – common error messages and fixes
- **Crash and silent-failure workflows** – end-to-end command sequences

## Documentation Scope

This page documents the `xclog-ref` reference skill — the bundled Axiom CLI for runtime console capture.

- For end-to-end usage guidance and best practices, see [Console Capture (xclog)](/skills/debugging/xclog)
- For post-mortem crash file analysis, see [Crash Symbolication (xcsym)](/skills/debugging/xcsym) — `xcsym` is the static counterpart to `xclog`'s live capture
- For environment-first build diagnostics, see [Xcode Debugging](/skills/debugging/xcode-debugging)
- For the guided capture command, see [/axiom:console](/commands/debugging/console)
