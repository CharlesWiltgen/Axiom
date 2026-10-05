# /axiom:fix-build

Diagnose and fix Xcode build failures using environment-first diagnostics (launches the `build-fixer` agent).

## Command

```bash
/axiom:fix-build
```

## What It Does
Checks the build environment before looking at code, preventing "rabbit hole" debugging of ghost issues.

1. **Running Builds** – Lists running `xcodebuild` processes and checks who owns them before stopping anything
2. **Derived Data** – Clears only this project's Derived Data folder, and only for a confirmed stale-build cause
3. **Simulator State** – Resets only the stuck simulator, leaving other sessions' simulators alone
4. **SPM Cache** – Validates package resolution state
5. **Saved Build Log** – Reads the full build log (saved by axbuild, or a plain log file where axbuild isn't available) before deciding whether a rebuild is needed

Before anything destructive, it stops and shows you the cause, the evidence and the exact command, so you can approve it.

## When to Use
- You see `BUILD FAILED` but the error makes no sense
- "No such module" errors appear after switching branches
- "Unable to boot simulator" errors occur
- Xcode is stuck indexing or processing files indefinitely
- You suspect a "ghost in the machine" rather than a code error

## Related
- [build-fixer](/agents/build-fixer) – The agent this command launches
- [/axiom:optimize-build](./optimize-build.md) – Speed up builds after fixing them
- [xcode-debugging](../../skills/debugging/xcode-debugging.md) – The manual skill behind this agent
