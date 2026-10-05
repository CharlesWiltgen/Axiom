# build-fixer

Diagnoses Xcode build failures by checking your environment first and reading the saved build log, so it finds the real error without guessing or rebuilding. It checks the project, running build processes, caches and simulator state before choosing a fix.

## What It Does

- Discovers the actual project, scheme and destination
- Checks for build processes that are already running and investigates them instead of assuming they're stuck
- Runs necessary builds through axbuild, which saves the full compiler log and test results
- Tells you whether the build itself failed or axbuild just couldn't collect every detail
- Reads details left out of the summary from the saved report instead of rebuilding
- Cleans caches or stops processes only for a confirmed cause, and asks before anything destructive

axbuild is included with the Claude Code and Codex plugins. In Pi, put it on your PATH ([Pi setup](/start/pi-install#command-line-helpers)). Cursor and MCP setups don't include it, so the agent saves build output to a log file instead.

## How to Use This Agent

**Natural language (automatic triggering):**
- "My build is failing with 'No such module'"
- "BUILD FAILED but the error scrolled away"
- "Tests passed yesterday but the build fails today with no code changes"
- "Getting 'Unable to boot simulator' error"

**Explicit command:**
```bash
/axiom:fix-build
```

In Pi, use `/axiom-fix-build`.

## Related

- [xcode-debugging](/skills/debugging/xcode-debugging) – Environment checks and recovery procedures
- [Build debugging](/skills/debugging/build-debugging) – Dependency and build configuration issues
- [Tools](/tools/) – axbuild availability and report handling
