---
name: networking-diag
description: Connection timeouts, TLS failures, data arrival issues — Network.framework diagnostics with production crisis defense
---

# Networking Diagnostics

Systematic Network.framework troubleshooting for connection failures, TLS issues, and data arrival problems with production crisis defense.

## Overview

Diagnostic workflows for debugging Network.framework connections using NWConnection (iOS 12-25) and NetworkConnection (iOS 26+). Includes systematic troubleshooting, production crisis scenarios, and network logging interpretation.

## What This Diagnostic Covers

### Connection State Issues

#### Never Reaches Ready
- Stuck in preparing → DNS failure
- Waiting state → No connectivity
- Posix 61 error → Connection refused
- Posix 50 error → Network down

#### Ready Then Fails
- After network change → Viability handler
- TLS -9806 → Certificate invalid
- Timeout → Receiver not processing
- Random drops → Network instability

### Data Transmission Problems

#### Data Missing or Corrupted
- Not received → Framing problem
- Partial data → Min/max bytes
- Corrupted → TLS disabled
- Intermittent → Race condition

#### Performance Issues
- High latency → TCP congestion
- Low throughput → Network transition
- High CPU → Missing batching
- Memory leaks → Handler retention

### Network-Specific Scenarios

- IPv6-only cellular (hardcoded IPv4)
- VPN/proxy interference
- Firewall port blocking
- NAT traversal for P2P

## When to Use This Diagnostic

Use this diagnostic when:
- Connection times out after 60 seconds
- TLS handshake fails with certificate errors
- Data sent but never arrives
- Works on WiFi, fails on cellular
- Connection drops during network transitions
- Performance degradation over time

## Diagnostic Workflow

```
1. Enable Network Logging (5 min)
   ├─ Add -NWLoggingEnabled 1 to scheme
   ├─ Run app and reproduce issue
   ├─ Check console for state transitions
   └─ Identify error codes

2. Analyze Connection States (10 min)
   ├─ Check state history
   ├─ Identify stuck states
   ├─ Match error codes to patterns
   └─ Review TLS configuration

3. Packet Capture (15 min)
   ├─ Use Instruments Network template
   ├─ Check DNS resolution
   ├─ Verify TLS handshake
   └─ Inspect data framing

4. Test Network Transitions (10 min)
   ├─ WiFi → Cellular
   ├─ Airplane Mode toggle
   ├─ VPN enable/disable
   └─ Check viability handler
```

## Production Crisis Defense

**Scenario**: iOS update causes 15% connection failures, 10K affected users, CEO asking for ETA

**Mandatory Protocol**:
1. **Establish Baseline** (5 min) - What worked before vs now
2. **Reproduce Production** (10 min) - Same iOS version, network conditions
3. **Check Recent Changes** (5 min) - Framework updates, API changes
4. **Apply Targeted Fix** (15 min) - Based on diagnostic pattern
5. **Deploy Hotfix** (20 min) - Fast-track release

**Communication Template**:
```
"Identified root cause: [specific issue].
Affects: [%] on [specific condition].
Deploying hotfix in [time].
Workaround: [if available]."
```

**Time Saved**: Panic rollback 1-2 hours vs proper diagnosis 30 minutes

## Diagnostic Patterns

### Pattern 1: DNS Failure (Preparing Stuck)
**Symptom**: Connection stuck in `.preparing` state
**Diagnosis**: `nslookup hostname` fails
**Fix**: Check hostname spelling, DNS configuration

### Pattern 2: TLS Certificate Error (-9806)
**Symptom**: Connection fails with posix error -9806
**Diagnosis**: `openssl s_client -connect host:port`
**Fix**: Update certificate, check date/time, validate chain

### Pattern 3: Framing Problem (Partial Data)
**Symptom**: Only partial messages received
**Diagnosis**: Check TLV framing configuration
**Fix**: Implement proper message boundaries

### Pattern 4: IPv6-Only Cellular
**Symptom**: Works on WiFi, fails on cellular
**Diagnosis**: Hardcoded IPv4 address
**Fix**: Use hostname, enable IPv6 support

## Network Logging Interpretation

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `preparing` | DNS resolution | Check hostname |
| `waiting` | No connectivity | Check network settings |
| `posix 61` | Connection refused | Check server running |
| `posix 50` | Network down | Check WiFi/cellular |
| `TLS -9806` | Certificate invalid | Check certificate |

## Tools and Resources

### Xcode Tools
- Network Instruments template
- Console app with NWLoggingEnabled
- System Log for debugging
- Network Link Conditioner

### Command Line
- `nslookup` - DNS resolution
- `openssl s_client` - TLS validation
- `netstat` - Port checking
- `tcpdump` - Packet capture

## Related Resources

- [networking](/skills/integration/networking) — Network.framework patterns and anti-patterns
- [network-framework-ref](/reference/network-framework-ref) — Complete API reference
- [audit-networking](/commands/integration/audit-networking) — Automated scan for deprecated APIs

## Documentation Scope

This is a **diagnostic skill** — mandatory workflows with production crisis defense.

#### Diagnostic includes
- 8+ diagnostic patterns with symptom/diagnosis/fix
- Production crisis scenario with communication templates
- Network logging interpretation guide
- Quick reference table for error codes
- Systematic troubleshooting workflows

**Vs Reference**: Diagnostic skills enforce specific workflows and handle pressure scenarios. Reference skills provide comprehensive information without mandatory steps.

## Size

27 KB - Systematic diagnostics with production crisis defense
