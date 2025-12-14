---
name: audit-codable
description: Scan for Codable anti-patterns and JSON serialization issues (launches codable-auditor agent)
---

# Codable Audit

Launches the **codable-auditor** agent to scan for Codable anti-patterns and JSON serialization issues that cause silent data loss and production bugs.

## What It Checks

**High-Severity Anti-Patterns:**
- Manual JSON string building (injection risk)
- try? swallowing DecodingError (silent failures)
- String interpolation in JSON (escaping bugs)

**Medium-Severity Issues:**
- JSONSerialization instead of Codable (technical debt)
- Date properties without explicit strategy (timezone bugs)
- DateFormatter without locale/timezone (locale issues)
- Optional properties to avoid decode errors (masks problems)

**Low-Severity Issues:**
- Missing error context in catch blocks

## Prefer Natural Language?

You can also trigger this agent by saying:
- "Scan for Codable anti-patterns"
- "Check my JSON encoding/decoding for issues"
- "Review my Codable code for best practices"
- "Audit for try? decoder problems"
