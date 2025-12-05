---
name: audit-swiftui-nav
description: Scan SwiftUI navigation for architecture issues (launches swiftui-nav-auditor agent)
---

# SwiftUI Navigation Architecture Audit

Launches the **swiftui-nav-auditor** agent to scan for SwiftUI navigation architecture and correctness issues (not performance - see audit-swiftui-performance for that).

## What It Checks

**Critical Issues:**
- Deep link gaps (missing .onOpenURL, no URL scheme registration)

**High Priority:**
- Missing NavigationPath (can't navigate programmatically)
- State restoration issues (missing .navigationDestination)
- Type safety issues (multiple destinations with same type)
- Missing state preservation (no @SceneStorage)

**Medium Priority:**
- Wrong container (NavigationStack vs NavigationSplitView)
- Tab/Nav integration issues (iOS 18+ sidebar unification)

**Low Priority:**
- Coordinator pattern violations (navigation logic scattered)

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Check my navigation architecture"
- "My deep links aren't working"
- "Review my navigation state restoration"
