---
name: axiom-xclog-ref
description: Use when capturing iOS simulator console output, diagnosing runtime crashes, viewing print/os_log output, or needing structured app logs for analysis. Reference for xclog CLI covering launch, attach, list modes with JSON output.
license: MIT
metadata:
  version: "1.0.0"
---

# xclog Reference (iOS Simulator Console Capture)

xclog captures iOS simulator console output by combining `simctl launch --console` (print/debugPrint/NSLog) with `log stream --style json` (os_log/Logger). Single binary, no dependencies.

## Binary Location

```bash
${CLAUDE_PLUGIN_ROOT}/bin/xclog
```

## When to Use

- **Runtime crashes** — capture what the app logged before crashing
- **Silent failures** — network calls, data operations that fail without UI feedback
- **Debugging print() output** — see what the app is printing to stdout/stderr
- **os_log analysis** — structured logging with subsystem, category, and level filtering
- **Automated log capture** — `--timeout` and `--max-lines` for bounded collection

## Critical Best Practices

**Check `.axiom/preferences.yaml` first.** If no saved preferences, run `list` before `launch` to discover the correct bundle ID.

**App already running?** `launch` will terminate it and relaunch. Use `attach` if you need to preserve current state (os_log only — no print() capture).

```bash
# 1. FIRST: Check .axiom/preferences.yaml for saved device and bundle ID
# 2. If no preferences: Discover installed apps
${CLAUDE_PLUGIN_ROOT}/bin/xclog list

# 3. Find the target app's bundle_id from output
# 4. THEN: Launch with the correct bundle ID (restarts app)
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch com.example.MyApp --timeout 30s --max-lines 200

# OR: Attach to running app without restarting (os_log only)
${CLAUDE_PLUGIN_ROOT}/bin/xclog attach MyApp --timeout 30s --max-lines 200
```

## Preferences

Axiom saves simulator preferences to `.axiom/preferences.yaml` in the project root. **Check this file before running `xclog list`** — if preferences exist, use the saved device and bundle ID directly.

### Reading Preferences

Before running `xclog list`, read `.axiom/preferences.yaml`:

```yaml
simulator:
  device: iPhone 16 Pro
  deviceUDID: 1A2B3C4D-5E6F-7890-ABCD-EF1234567890
  bundleId: com.example.MyApp
```

If the file exists and contains a `simulator` section, use the saved `deviceUDID` and `bundleId` for xclog commands. Skip `xclog list` unless the user asks for a different app or the saved values fail.

```bash
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch <bundleId> --device <deviceUDID> --timeout 30s --max-lines 200
```

If the file doesn't exist or the `simulator` section is missing, fall back to `xclog list` discovery.

If the saved `deviceUDID` is not found among available simulators (xclog or simctl fails), fall back to discovery and save the new selection.

If the YAML is malformed, warn the developer and fall back to discovery. Do not overwrite a malformed file.

### Writing Preferences

After a successful `xclog launch` or when the user selects a target app from `xclog list` output, save the device and bundle ID:

1. If `.axiom/` doesn't exist, create it. Ensure `.axiom/` is in `.gitignore`. If `.gitignore` doesn't exist, create it.
2. Read `.axiom/preferences.yaml` if it exists (to preserve other keys)
3. Update the `simulator:` section with `device`, `deviceUDID`, and `bundleId`
4. Write the merged YAML back using the Write tool

Write the same `simulator:` structure shown in Reading Preferences above.

## Commands

### list — Discover Installed Apps

```bash
${CLAUDE_PLUGIN_ROOT}/bin/xclog list
${CLAUDE_PLUGIN_ROOT}/bin/xclog list --device <udid>
```

Output (JSON lines):
```json
{"bundle_id":"com.example.MyApp","name":"MyApp","version":"1.2.0"}
{"bundle_id":"com.apple.mobilesafari","name":"Safari","version":"18.0"}
```

### launch — Full Console Capture

Launches the app and captures ALL output: print(), debugPrint(), NSLog(), os_log(), Logger.

```bash
# Basic launch (JSON output, runs until app exits or Ctrl-C)
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch com.example.MyApp

# Bounded capture (recommended for LLM use)
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch com.example.MyApp --timeout 30s --max-lines 200

# Filter by subsystem
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch com.example.MyApp --subsystem com.example.MyApp.networking

# Filter by regex
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch com.example.MyApp --filter "error|warning|crash"

# Save to file
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch com.example.MyApp --output /tmp/console.log --timeout 60s
```

### attach — Monitor Running Process

Attaches to a running process via os_log only. Does NOT capture print()/debugPrint(). Simulator only.

```bash
# By process name
${CLAUDE_PLUGIN_ROOT}/bin/xclog attach MyApp --timeout 30s

# By PID
${CLAUDE_PLUGIN_ROOT}/bin/xclog attach 12345 --max-lines 100

# Filter for errors only
${CLAUDE_PLUGIN_ROOT}/bin/xclog attach MyApp --filter "(?i)error|fault"
```

### show — Historical Log Search (Simulator + Physical Device)

Searches recent logs without needing proactive capture. Works with both simulator and connected physical devices.

```bash
# Simulator: show last 5 minutes of MyApp logs
${CLAUDE_PLUGIN_ROOT}/bin/xclog show MyApp --last 5m --max-lines 200

# Simulator: show last 10 minutes, errors only
${CLAUDE_PLUGIN_ROOT}/bin/xclog show MyApp --last 10m --max-lines 100 --filter "(?i)error|fault"

# Physical device: collect and show logs (device must be connected + unlocked)
${CLAUDE_PLUGIN_ROOT}/bin/xclog show MyApp --device-udid 00008101-... --last 5m --max-lines 200

# By PID
${CLAUDE_PLUGIN_ROOT}/bin/xclog show 12345 --last 2m
```

**Physical device workflow**: `show --device-udid` runs `log collect` to pull a log archive from the device over USB, then parses it locally. The device must be connected and unlocked.

**When to use `show` vs `attach`**:
- `show` — "What just happened?" (post-mortem, no setup needed)
- `attach` — "What's happening now?" (live streaming, must be running before the event)

## Output Format

Default output is JSON lines (one JSON object per line).

### JSON Schema (Default)

```json
{
  "time": "10:30:45.123",
  "source": "os_log",
  "level": "error",
  "subsystem": "com.example.MyApp",
  "category": "networking",
  "process": "MyApp",
  "pid": 12345,
  "text": "Connection failed: timeout"
}
```

| Field | Type | Present | Description |
|-------|------|---------|-------------|
| time | string | Always | HH:MM:SS.mmm timestamp |
| source | string | Always | `"print"`, `"stderr"`, or `"os_log"` |
| level | string | os_log only | `"debug"`, `"default"`, `"info"`, `"error"`, `"fault"` |
| subsystem | string | os_log only | Reverse-DNS subsystem (e.g. `com.example.MyApp`) |
| category | string | os_log only | Log category within subsystem |
| process | string | os_log only | Process binary name |
| pid | int | os_log only | Process ID |
| text | string | Always | The log message content |

Fields not applicable to a source are omitted (not null).

### Human-Readable Mode

```bash
${CLAUDE_PLUGIN_ROOT}/bin/xclog attach MyApp --human
${CLAUDE_PLUGIN_ROOT}/bin/xclog attach MyApp --human --no-color
```

## Options Reference

| Option | Default | Description |
|--------|---------|-------------|
| `--device <udid>` | `booted` | Target simulator UDID |
| `--device-udid <udid>` | none | Physical device UDID (show command) |
| `--output <file>` | stdout | Also write to file |
| `--human` | off | Human-readable colored output |
| `--no-color` | off | Disable ANSI colors (--human mode) |
| `--filter <regex>` | none | Filter lines by Go regex |
| `--subsystem <name>` | none | Filter os_log by subsystem |
| `--max-lines <n>` | 0 (unlimited) | Stop after n lines |
| `--timeout <duration>` | 0 (unlimited) | Stop after duration (e.g. `30s`, `5m`) |
| `--last <duration>` | `5m` | How far back to search (show command) |

## Coverage by Source

| Swift API | launch | attach | show |
|-----------|:------:|:------:|:----:|
| `print()` | yes | no | no |
| `debugPrint()` | yes | no | no |
| `NSLog()` | yes | yes | yes |
| `os_log()` | yes | yes | yes |
| `Logger` | yes | yes | yes |

| | Simulator | Physical Device |
|---|:-:|:-:|
| `launch` | yes | no |
| `attach` | yes | no |
| `show` | yes | yes |
| `Logger` | yes | yes |

**Use `launch` for full coverage.** `attach` is for monitoring already-running processes.

**Note**: `launch` terminates any existing instance of the app before relaunching. If the app is already running and you don't want to restart it, use `attach` (os_log only).

## Error Behavior

xclog prints errors to stderr and exits with code 1. Common errors:

| Error | Cause | Fix |
|-------|-------|-----|
| `simctl launch: ...` | Bad bundle ID or no booted simulator | Run `xclog list` to verify bundle ID; check `xcrun simctl list devices booted` |
| `could not parse PID from simctl output` | App failed to launch | Check the app builds and runs in the simulator |
| `invalid filter regex` | Bad `--filter` pattern | Check Go regex syntax (similar to RE2) |
| `invalid subsystem` | Subsystem contains spaces or special characters | Use reverse-DNS format: `com.example.MyApp` (alphanumeric, dots, underscores, hyphens only) |

## Interpreting Output

### Filtering by Level

os_log levels indicate severity. For crash diagnosis, focus on `error` and `fault`.

**Note**: `--filter` matches against the **message text**, not the JSON output. To filter by level, use jq:

```bash
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch com.example.MyApp --timeout 30s 2>/dev/null | jq -c 'select(.level == "error" or .level == "fault")'
```

For text-based filtering, `--filter` works on message content:
```bash
# Filter messages containing "error" or "failed" (case-insensitive)
${CLAUDE_PLUGIN_ROOT}/bin/xclog launch com.example.MyApp --filter "(?i)error|failed"
```

### Common Subsystem Patterns

| Subsystem | What it indicates |
|-----------|------------------|
| `com.apple.network` | URLSession / networking layer |
| `com.apple.coredata` | Core Data / persistence |
| `com.apple.swiftui` | SwiftUI framework |
| `com.apple.uikit` | UIKit framework |
| App's own subsystem | Application-level logging |

### Workflow: Diagnose a Runtime Crash

1. `xclog list` → find bundle ID
2. `xclog launch <bundle-id> --timeout 60s --max-lines 500 --output /tmp/crash.log` → start capture (this restarts the app — expected)
3. Reproduce the crash in the simulator
4. Read `/tmp/crash.log` and filter for errors: `jq 'select(.level == "error" or .level == "fault")' /tmp/crash.log`
5. Check the last few lines before the stream ended (crash point)

If the crash is intermittent, increase bounds: `--timeout 120s --max-lines 1000` and repeat.

### Workflow: Investigate Silent Failure

1. `xclog launch <bundle-id> --subsystem com.example.MyApp --timeout 30s`
2. Trigger the failing operation
3. Look for error-level messages in the app's subsystem
4. Cross-reference with network or data subsystems if app logs are silent

## Resources

**Skills**: axiom-xcode-debugging, axiom-performance-profiling, axiom-lldb
