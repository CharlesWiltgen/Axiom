---
name: fix-build
description: Diagnose and fix Xcode build failures (launches build-fixer agent)
---

# Fix Build Issues

Launches the **build-fixer** agent to diagnose and fix Xcode build failures using environment-first diagnostics.

## What It Does

The agent will:
1. Check for zombie xcodebuild processes
2. Verify Derived Data size
3. Check simulator state
4. Apply appropriate fixes automatically
5. Verify the fixes worked

## Prefer Natural Language?

You can also trigger this agent by saying:
- "My build is failing"
- "BUILD FAILED but no error details"
- "Xcode says 'No such module'"
- "Getting 'Unable to boot simulator' error"
