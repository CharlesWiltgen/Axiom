# Networking References

## WWDC Sessions

- **WWDC 2018-715** — Introducing Network.framework: User-space networking demo (30% CPU reduction), deprecation of CFSocket/NSStream/SCNetworkReachability, smart connection establishment, mobility support

- **WWDC 2025-250** — Use structured concurrency with Network framework: NetworkConnection with async/await (iOS 26+), TLV framing and Coder protocol, NetworkListener and NetworkBrowser, Wi-Fi Aware peer-to-peer discovery

## Apple Documentation

- [Network Framework Documentation](https://developer.apple.com/documentation/network)
- [NWConnection](https://developer.apple.com/documentation/network/nwconnection)
- [NetworkConnection (iOS 26+)](https://developer.apple.com/documentation/Network/NetworkConnection)
- [Building a Custom Peer-to-Peer Protocol](https://developer.apple.com/documentation/Network/building-a-custom-peer-to-peer-protocol)

## Related Axiom Skills

- **networking-diag** — Systematic troubleshooting for connection timeouts, TLS failures, data not arriving, performance issues
- **network-framework-ref** — Comprehensive API reference with all 12 WWDC 2025 code examples, migration strategies, testing checklists
- **swift-concurrency** — Async/await patterns, @MainActor usage, Task cancellation (needed for NetworkConnection)
