# Skill Map

Visual overview of Axiom's two-layer routing architecture. 17 routers organize 154 skills, 35 agents, and 10 commands into discoverable domains.

## How It Works

Axiom uses **progressive disclosure** — you never need to memorize skill names. Ask a question, and the right router activates automatically:

1. **Your question** hits one of 17 domain routers
2. The **router** selects the right specialized skill, agent, or command
3. You get **expert guidance** tailored to your specific issue

## Color Legend

| Type | Role | Example |
|------|------|---------|
| <span style="background:#6f42c1;color:#fff;padding:2px 8px;border-radius:4px">Router</span> | Domain entry point | ios-ui, ios-data |
| <span style="background:#d4edda;color:#1b4332;padding:2px 8px;border-radius:4px">Discipline</span> | Workflow + best practices | swift-concurrency, liquid-glass |
| <span style="background:#cce5ff;color:#003366;padding:2px 8px;border-radius:4px">Reference</span> | Complete API guide | network-framework-ref, storekit-ref |
| <span style="background:#fff3cd;color:#664d03;padding:2px 8px;border-radius:4px">Diagnostic</span> | Troubleshooting trees | networking-diag, energy-diag |
| <span style="background:#f8d7da;color:#58151c;padding:2px 8px;border-radius:4px">Agent</span> | Autonomous scanner | memory-auditor, build-fixer |
| <span style="background:#e2e3e5;color:#383d41;padding:2px 8px;border-radius:4px">Command</span> | Explicit invocation | /axiom:fix-build, /axiom:audit |

## Overview

```mermaid
mindmap
  root((Axiom))
    Build & Environment
      6 discipline skills
      2 reference skills
      6 agents
      5 commands
    UI & Design
      15 discipline skills
      7 reference skills
      1 diagnostic skills
      5 agents
      4 commands
    Data & Persistence
      11 discipline skills
      6 reference skills
      4 diagnostic skills
      4 agents
      4 commands
    Concurrency
      6 discipline skills
      1 agents
      1 commands
    Performance
      8 discipline skills
      4 reference skills
      1 diagnostic skills
      3 agents
      4 commands
    Testing
      5 discipline skills
      1 reference skills
      5 agents
      1 commands
    Networking
      3 discipline skills
      1 reference skills
      1 diagnostic skills
      1 agents
      1 commands
    Integration
      13 discipline skills
      10 reference skills
      3 diagnostic skills
      3 agents
      1 commands
    Accessibility
      1 diagnostic skills
      1 agents
      1 commands
    Apple Intelligence
      1 discipline skills
      1 reference skills
      1 diagnostic skills
    Computer Vision
      1 discipline skills
      1 reference skills
      1 diagnostic skills
    Graphics & 3D
      3 discipline skills
      2 reference skills
      2 diagnostic skills
    Games
      3 discipline skills
      3 reference skills
      2 diagnostic skills
      1 agents
      1 commands
    Machine Learning
      2 discipline skills
      1 reference skills
      1 diagnostic skills
    Shipping
      2 discipline skills
      1 reference skills
      1 diagnostic skills
      2 agents
      1 commands
    Xcode MCP
      2 discipline skills
      1 reference skills
    Apple Docs
      20 Apple guides
      32 Swift diagnostics
```

## Domain Breakdown

| Domain | Contents |
|--------|----------|
| **Build & Environment** | 6 discipline, 2 reference, 6 agents, 5 commands |
| **UI & Design** | 15 discipline, 7 reference, 1 diagnostic, 5 agents, 4 commands |
| **Data & Persistence** | 11 discipline, 6 reference, 4 diagnostic, 4 agents, 4 commands |
| **Concurrency** | 6 discipline, 1 agents, 1 commands |
| **Performance** | 8 discipline, 4 reference, 1 diagnostic, 3 agents, 4 commands |
| **Testing** | 5 discipline, 1 reference, 5 agents, 1 commands |
| **Networking** | 3 discipline, 1 reference, 1 diagnostic, 1 agents, 1 commands |
| **Integration** | 13 discipline, 10 reference, 3 diagnostic, 3 agents, 1 commands |
| **Accessibility** | 1 diagnostic, 1 agents, 1 commands |
| **Apple Intelligence** | 1 discipline, 1 reference, 1 diagnostic |
| **Computer Vision** | 1 discipline, 1 reference, 1 diagnostic |
| **Graphics & 3D** | 3 discipline, 2 reference, 2 diagnostic |
| **Games** | 3 discipline, 3 reference, 2 diagnostic, 1 agents, 1 commands |
| **Machine Learning** | 2 discipline, 1 reference, 1 diagnostic |
| **Shipping** | 2 discipline, 1 reference, 1 diagnostic, 2 agents, 1 commands |
| **Xcode MCP** | 2 discipline, 1 reference |

**Apple Docs** provides access to 20 official Apple guides and 32 Swift compiler diagnostics bundled in Xcode.

## Counts

| Category | Count |
|----------|-------|
| Routers | 17 |
| Skills | 154 |
| Agents | 35 |
| Commands | 10 |

