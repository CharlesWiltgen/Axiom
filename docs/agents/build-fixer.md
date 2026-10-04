# build-fixer

Diagnoses Xcode build failures with environment checks and retained build evidence. It verifies the project, process ownership, caches and simulator state before choosing a fix.

## What It Does

- Discovers the actual project, scheme and destination
- Investigates existing build activity; process age and count alone do not prove a zombie
- Captures necessary builds with axbuild, preserving compiler logs and test artifacts
- Separates native command failure from incomplete diagnostic collection
- Reads omitted records from the saved report before considering another build
- Scopes cleanup to confirmed causes and requests authorization for destructive actions

Claude Code and the full Codex plugin bundle axbuild. Pi discovers an installed helper on PATH. Cursor and MCP clients retain a saved-log fallback; they do not bundle axbuild or expose an axbuild MCP tool.

## How to Use

Ask your assistant:

- "My build failed. Find the cause from the saved report before rebuilding."
- "The output was truncated. Show the actionable error and its source location."
- "Check whether the build failed or diagnostic collection was incomplete."

In Claude Code, run `/axiom:fix-build` for the autonomous agent.

## Related

- [xcode-debugging](/skills/debugging/xcode-debugging) – Environment checks and recovery procedures
- [Build debugging](/skills/debugging/build-debugging) – Dependency and build configuration issues
- [Tools](/tools/) – axbuild availability and report handling
