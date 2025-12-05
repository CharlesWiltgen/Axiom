---
name: audit-memory
description: Scan for memory leaks (launches memory-audit-runner agent)
---

# Memory Leak Audit

Launches the **memory-audit-runner** agent to scan for the 6 most common memory leak patterns.

## What It Checks

- Timer leaks (Timer without .invalidate())
- Observer/notification leaks (addObserver without removeObserver)
- Closure capture leaks (closures in arrays capturing self strongly)
- Strong delegate cycles (delegate properties without weak)
- View callback leaks (SwiftUI callbacks capturing self)
- PhotoKit accumulation (PHImageManager requests without cancellation)

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Scan for memory leaks"
- "Check my code for memory leaks"
- "Review my code for retain cycles"
