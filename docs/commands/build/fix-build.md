# /axiom:fix-build

Diagnose and fix Xcode build failures using environment-first diagnostics (launches the `build-fixer` agent).

## Command

```bash
/axiom:fix-build
```

## What It Does
Checks the build environment before looking at code, preventing "rabbit hole" debugging of ghost issues.

1. **Zombie Processes**: Kills stuck `xcodebuild` or `swift-frontend` processes
2. **Derived Data**: Checks for corruption and offers safe cleaning
3. **Simulator State**: Resets stuck or unresponsive simulators
4. **SPM Cache**: Validates package resolution state

## When to Use
- You see `BUILD FAILED` but the error makes no sense
- "No such module" errors appear after switching branches
- "Unable to boot simulator" errors occur
- Xcode is stuck indexing or processing files indefinitely
- You suspect a "ghost in the machine" rather than a code error

## Related
- [/axiom:optimize-build](./optimize-build.md) - Speed up builds after fixing them
- [xcode-debugging](../../skills/debugging/xcode-debugging.md) - The manual skill behind this agent
