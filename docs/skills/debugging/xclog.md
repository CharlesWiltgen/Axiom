# Console Capture (xclog)

Reference for `xclog`, an iOS simulator console capture tool that unifies print()/debugPrint() output with os_log/Logger into structured JSON — designed for LLM consumption.

## When to Use This Reference

Use this reference when:
- You need to see what an app is printing to the console
- Diagnosing runtime crashes (need logs leading up to the crash)
- Investigating silent failures (network, data, auth) with no UI feedback
- Capturing structured simulator logs for automated analysis

**Core problem solved:** No single external tool replicates Xcode's debug console. `xclog` combines `simctl launch --console` (captures print) with `log stream --style json` (captures os_log) into a single unified stream.

## Example Prompts

- "Show me what my app is logging"
- "Capture the simulator console while I reproduce this crash"
- "My app fails silently — I need to see the logs"
- "xclog to my usual simulator"

## What This Skill Provides

- **list / launch / attach** command reference with all flags
- **JSON output schema** with level, subsystem, category, process, pid fields
- **Crash diagnosis workflow** — list → launch with bounded capture → reproduce → filter errors
- **Silent failure workflow** — subsystem-filtered capture
- **Coverage table** — which Swift APIs are captured in each mode
- **Error behavior** — common error messages and fixes

## Key Concepts

- **launch mode** captures everything (print + os_log) but restarts the app
- **attach mode** preserves app state but only captures os_log
- **JSON is the default** output format — no flags needed for structured output
- **Always run `list` first** to discover the correct bundle ID
- **Always bound output** with `--timeout` and `--max-lines` to protect context

## Related

- [Xcode Debugging](/skills/debugging/xcode-debugging) — environment-first diagnostics (xclog is for runtime, xcode-debugging is for build-time)
- [Performance Profiling](/skills/debugging/performance-profiling) — capture logs before profiling to understand what to measure
- [LLDB Debugging](/skills/debugging/lldb) — xclog captures logs, LLDB inspects live state
- [/axiom:console](/commands/debugging/console) — guided capture command
