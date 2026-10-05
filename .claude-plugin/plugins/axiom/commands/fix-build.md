---
name: fix-build
description: Diagnose and fix Xcode build failures (launches build-fixer agent)
disable-model-invocation: true
---

# Fix Build Issues

Launches the **build-fixer** agent to diagnose and fix Xcode build failures using environment-first diagnostics.

## What It Does

The agent will:
1. Verify the project directory, then inventory running xcodebuild processes and check their ownership
2. Check Derived Data, package resolution and simulator state
3. Read the saved build log or axbuild report before rebuilding
4. Fix the confirmed cause, stopping for your approval before anything destructive
5. Verify the fixes worked

## Prefer Natural Language?

You can also trigger this agent by saying:
- "My build is failing"
- "BUILD FAILED but no error details"
- "Xcode says 'No such module'"
- "Getting 'Unable to boot simulator' error"
