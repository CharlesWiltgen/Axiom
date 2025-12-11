---
name: audit-swiftui-performance
description: Scan SwiftUI code for performance anti-patterns (launches swiftui-performance-analyzer agent)
---

# SwiftUI Performance Audit

Launches the **swiftui-performance-analyzer** agent to scan for SwiftUI performance anti-patterns that cause frame drops and poor scrolling performance.

## What It Checks

**Critical Issues:**
- File I/O in view body (blocking reads/writes)
- DateFormatter/NumberFormatter in view body (heavy initialization cost)

**High Priority:**
- Image processing in view body (resizing, filtering)
- Whole-collection dependencies (.count instead of id-based)

**Medium Priority:**
- Missing lazy loading in ScrollView/List
- Frequently changing environment values
- Missing view identity (implicit AnyView wrapping)

**Low Priority:**
- Old ObservableObject pattern (should use @Observable)

## Prefer Natural Language?

You can also trigger this agent by saying:
- "My SwiftUI views are janky"
- "Check my SwiftUI code for performance issues"
- "Why is my List scrolling so slow?"
