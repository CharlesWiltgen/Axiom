# Xcode Debugging

Environment-first diagnostics for mysterious Xcode issues. Prevents 30+ minute rabbit holes by checking build environment before debugging code.

**When to use**: BUILD FAILED, test crashes, simulator hangs, stale builds, zombie xcodebuild processes, "Unable to boot simulator", "No such module" after SPM changes, mysterious test failures

## Key Features

- Mandatory environment checks (Derived Data, processes, simulators)
- Quick fix workflows for common issues
- Decision tree for diagnosing problems
- Crash log analysis patterns
- Time cost transparency (prevents rabbit holes)

**Philosophy**: 80% of "mysterious" Xcode issues are environment problems, not code bugs. Check environment BEFORE debugging code.

**TDD Tested**: 6 refinements from pressure testing with Superpowers framework
