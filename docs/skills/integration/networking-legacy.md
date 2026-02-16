---
name: networking-legacy
description: NWConnection patterns for iOS 12-25 with completion handlers, UDP batching, NWListener, and NWBrowser service discovery
---

# Networking Legacy

NWConnection patterns for apps supporting iOS 12-25 that can't use async/await yet. Covers TLS connections, UDP batching, server listeners, and Bonjour service discovery using completion-handler-based APIs.

## When to Use

Use this skill when you're:
- Supporting iOS 12-25 and can't use NetworkConnection (iOS 26+)
- Maintaining codebases that haven't adopted async/await
- Building libraries that need backward compatibility
- Implementing UDP batching for real-time streaming
- Setting up NWListener for incoming connections
- Using NWBrowser for Bonjour service discovery

**Note:** If your app targets iOS 26+, use the modern NetworkConnection API instead. See [network-framework-ref](/reference/network-framework-ref).

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I create a TLS connection with NWConnection for iOS 12+?"
- "How do I batch UDP sends for better CPU performance?"
- "How do I accept incoming connections with NWListener?"
- "How do I discover services on the local network with NWBrowser?"
- "What's the completion handler pattern for NWConnection send/receive?"
- "How do I handle connection state changes with NWConnection?"

## What This Skill Provides

- **TLS connections** with NWConnection using completion handlers and proper `[weak self]` patterns
- **UDP batch sending** that reduces CPU by ~30% compared to individual sends (one syscall instead of N)
- **NWListener** for accepting incoming connections with Bonjour advertising
- **NWBrowser** for discovering services on the local network without hardcoded IPs
- **Migration pointers** showing the path from each legacy pattern to its iOS 26+ equivalent
- **When-to-use guidance** for real-time streaming, peer-to-peer, and backward-compatible libraries

## Key Differences from iOS 26+

| NWConnection (iOS 12-25) | NetworkConnection (iOS 26+) |
|--------------------------|----------------------------|
| Completion handlers | async/await |
| `[weak self]` required | No `[weak self]` needed |
| stateUpdateHandler callback | Async sequence of states |
| Manual JSON encode/decode | Built-in Coder protocol |

## Related

- [networking](/skills/integration/networking) — Network architecture decisions and modern patterns
- [networking-migration](/reference/networking-migration) — Step-by-step migration guides from legacy to modern APIs
- [network-framework-ref](/reference/network-framework-ref) — Complete Network.framework API reference including iOS 26+
- [networking-diag](/diagnostic/networking-diag) — Connection failure troubleshooting

## Resources

**WWDC**: 2018-715

**Docs**: /network, /network/nwconnection
