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

Grouped to mirror the sidebar exactly — same group names, same group order, same items in the same order within each group.

### Build
| Area | What It Checks |
|------|----------------|
| `build` | Build time optimization opportunities |

### Debugging
| Area | What It Checks |
|------|----------------|
| `codable` | Manual JSON building, error swallowing, Sendable violations |
| `core-data` | Thread safety, schema migrations, N+1 queries |
| `energy` | Timer abuse, polling patterns, continuous location, animation leaks |
| `memory` | Retain cycles, Timer/observer leaks, closure captures |
| `modernization` | ObservableObject→@Observable, @StateObject→@State, deprecated APIs |
| `swift-performance` | ARC issues, allocation patterns, generic specialization |

### Testing
| Area | What It Checks |
|------|----------------|
| `testing` | Flaky tests, slow tests, Swift Testing migration |

### Concurrency
| Area | What It Checks |
|------|----------------|
| `concurrency` | Swift 6 data races, unsafe Task captures, actor isolation |

### UI & Design
| Area | What It Checks |
|------|----------------|
| `liquid-glass` | iOS 26 adoption opportunities, toolbar improvements |
| `swiftui-architecture` | Logic in views, MVVM/TCA boundary violations |
| `swiftui-layout` | GeometryReader misuse, deprecated screen APIs, hardcoded breakpoints |
| `swiftui-nav` | NavigationStack issues, path management, deep linking |
| `swiftui-performance` | Expensive body, formatters, missing lazy containers |
| `textkit` | TextKit issues, text rendering problems |
| `ux-flow` | Dead-end views, dismiss traps, missing empty/loading/error states |

### Integration
| Area | What It Checks |
|------|----------------|
| `camera` | Deprecated camera APIs, missing interruption handlers |
| `foundation-models` | Availability checks, main-thread blocking, guardrail handling |
| `networking` | Deprecated APIs (SCNetworkReachability), anti-patterns |

### Storage
| Area | What It Checks |
|------|----------------|
| `database-schema` | Unsafe ALTER TABLE, DROP operations, FK integrity |
| `icloud` | iCloud entitlements, file coordination, CloudKit errors |
| `storage` | File protection, backup exclusions, storage strategies |
| `swiftdata` | @Model correctness, VersionedSchema, relationship defaults |

### Accessibility
| Area | What It Checks |
|------|----------------|
| `accessibility` | VoiceOver, Dynamic Type, WCAG compliance |

### Games
| Area | What It Checks |
|------|----------------|
| `spritekit` | Physics bitmask issues, draw call waste, action leaks |

### Shipping
| Area | What It Checks |
|------|----------------|
| `screenshots` | Placeholder text, wrong dimensions, debug indicators |
| `security` | API keys in code, insecure storage, Privacy Manifests, ATS violations |

## Priority Levels

1. **CRITICAL** — `core-data`, `swiftdata`, `database-schema`, `storage`, `icloud` (data corruption/loss risk)
2. **HIGH** — `concurrency`, `memory`, `energy`, `networking`, `security`, `testing` (crashes, App Store rejection)
3. **MEDIUM** — `swiftui-architecture`, `ux-flow`, `swiftui-performance`, `swiftui-layout`, `swift-performance`, `foundation-models` (architecture, performance, UX)
4. **LOW** — `accessibility`, `liquid-glass`, `codable`, `modernization`, `camera`, `screenshots` (enhancement opportunities)

## Batch Patterns

```bash
# Pre-release audit (CRITICAL + HIGH)
/axiom:audit core-data
/axiom:audit concurrency
/axiom:audit memory
/axiom:audit security

# Architecture review
/axiom:audit swiftui-architecture
/axiom:audit swiftui-nav
/axiom:audit swiftui-layout
/axiom:audit swiftui-performance

# Data layer review
/axiom:audit swiftdata
/axiom:audit database-schema
/axiom:audit core-data
/axiom:audit storage

# Battery optimization
/axiom:audit energy
/axiom:audit memory
/axiom:audit networking
```

## Related

- [/axiom:status](/commands/utility/status) — Project environment health
- [/axiom:ask](/commands/utility/ask) — Natural language entry point
