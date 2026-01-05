---
name: audit
description: Unified audit command with smart project analysis or direct audit area selection
---

# /axiom:audit

Unified audit command with two modes: **Smart mode** analyzes your project and suggests audits; **Direct mode** runs a specific audit immediately.

## Usage

```bash
# Smart mode — analyze project and suggest audits
/axiom:audit

# Direct mode — run specific audit
/axiom:audit [area]
```

## Smart Mode

When run without arguments, analyzes your project and recommends relevant audits based on:
- Project type (SwiftUI vs UIKit)
- Data models (Core Data, SwiftData)
- Framework imports (CloudKit, Network.framework)
- Deployment target
- Code patterns (async/await, Timer usage)

## Available Audit Areas

### UI & Design
| Area | What It Checks |
|------|----------------|
| `accessibility` | VoiceOver, Dynamic Type, WCAG compliance |
| `axiom-liquid-glass` | iOS 26 adoption opportunities |
| `axiom-swiftui-architecture` | Logic in views, testability |
| `axiom-swiftui-nav` | NavigationStack issues, deep linking |
| `axiom-swiftui-performance` | Expensive operations in view bodies |

### Code Quality
| Area | What It Checks |
|------|----------------|
| `concurrency` | Swift 6 data races, @MainActor violations |
| `memory` | Retain cycles, Timer leaks, closure captures |
| `axiom-codable` | Manual JSON building, error swallowing |

### Persistence & Storage
| Area | What It Checks |
|------|----------------|
| `axiom-core-data` | Thread violations, N+1 queries |
| `icloud` | File coordination, CloudKit errors |
| `axiom-storage` | File protection, backup exclusions |

### Integration
| Area | What It Checks |
|------|----------------|
| `axiom-networking` | Deprecated APIs, anti-patterns |

## Priority Levels

1. **CRITICAL** — core-data, storage, icloud (data corruption/loss risk)
2. **HIGH** — concurrency, memory, networking (crashes, App Store rejection)
3. **MEDIUM** — architecture, performance (quality issues)
4. **LOW** — accessibility, liquid-glass (enhancements)

## Batch Patterns

```bash
# Pre-release audit
/axiom:audit core-data
/axiom:audit concurrency
/axiom:audit memory

# Architecture review
/axiom:audit swiftui-architecture
/axiom:audit swiftui-performance
```

## Related

- [/axiom:status](/commands/utility/status) — Project environment health
- [/axiom:ask](/commands/utility/ask) — Natural language entry point
