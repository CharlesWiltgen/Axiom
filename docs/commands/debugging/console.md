# /axiom:console

Capture iOS simulator console output (print + os_log) using xclog.

## Command

```bash
/axiom:console
```

## What It Does

Guides you through capturing simulator console output:

1. **Discovers installed apps** via `xclog list`
2. **Asks which app** to capture (or uses the one you specified)
3. **Launches capture** with bounded defaults (`--timeout 30s --max-lines 200`)
4. **Presents output** with errors and faults highlighted

## When to Use

- You need to see what an app is printing to the console
- Diagnosing a runtime crash — need logs leading up to it
- Investigating silent failures with no UI feedback
- Quick console check during development

## Usage Tips

- Use `--filter "error|warning"` to focus on problems
- Use `--subsystem com.example.MyApp` to filter by your app's logging subsystem
- Use `--timeout 60s` for longer capture sessions
- Use `--output /tmp/console.log` to save for later analysis

## Related

- [xclog Reference](/skills/debugging/xclog) — full tool documentation with JSON schema and workflows
- [Xcode Debugging](/skills/debugging/xcode-debugging) — for build-time issues (xclog is for runtime)
