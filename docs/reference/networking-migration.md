---
name: networking-migration
description: Migration guides from BSD sockets to NWConnection, NWConnection to NetworkConnection (iOS 26+), and URLSession StreamTask to NetworkConnection
---

# Networking Migration Reference

Step-by-step migration guides for moving between networking APIs. Covers three migration paths with before/after code examples, mapping tables, and benefit analysis.

## When to Use This Reference

Use this reference when you need to:
- Migrate from BSD sockets to NWConnection
- Upgrade from NWConnection (iOS 12-25) to NetworkConnection (iOS 26+)
- Replace URLSession StreamTask with NetworkConnection
- Understand the mapping between old and new APIs
- Decide whether to migrate or stay with your current API

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "How do I migrate from BSD sockets to NWConnection?"
- "What's the equivalent of NWConnection's stateUpdateHandler in NetworkConnection?"
- "How do I replace completion handlers with async/await for networking?"
- "Should I migrate from URLSession StreamTask to NetworkConnection?"
- "What are the benefits of moving to NetworkConnection on iOS 26?"
- "How do I replace [weak self] patterns when migrating to async/await?"

## What's Covered

- **BSD sockets to NWConnection** -- Mapping table for socket/connect/send/recv/bind/listen/accept to their NWConnection equivalents, with complete before/after code examples
- **NWConnection to NetworkConnection** -- Completion handlers to async/await, stateUpdateHandler to async sequences, manual JSON to built-in Coder protocol
- **URLSession StreamTask to NetworkConnection** -- When to migrate (need UDP, custom protocols) vs when to stay (HTTP, WebSocket, caching)
- **API mapping tables** -- Side-by-side equivalences for each migration path
- **Line count reductions** -- Quantified improvements (20 to 10 lines, 30 to 15 lines)
- **Memory management changes** -- Why `[weak self]` is eliminated with async/await

## Documentation Scope

This page documents the `axiom-networking-migration` reference skill -- migration guides Claude uses when helping you move between networking API generations. The skill contains complete before/after examples for each migration path.

- For current networking patterns, see [networking](/skills/integration/networking)
- For legacy iOS 12-25 patterns, see [networking-legacy](/skills/integration/networking-legacy)
- For troubleshooting connections, see [networking-diag](/diagnostic/networking-diag)

## Related

- [networking](/skills/integration/networking) — Modern networking patterns and architecture decisions
- [networking-legacy](/skills/integration/networking-legacy) — NWConnection patterns for iOS 12-25
- [network-framework-ref](/reference/network-framework-ref) — Complete Network.framework API reference
- [networking-diag](/diagnostic/networking-diag) — Connection failure troubleshooting

## Resources

**WWDC**: 2018-715, 2025-250

**Docs**: /network, /network/nwconnection
