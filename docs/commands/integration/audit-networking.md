---
name: audit-networking
description: Scan for deprecated networking APIs (SCNetworkReachability, CFSocket, NSStream) and anti-patterns with file:line references
---

# audit-networking

Quick automated scan to identify deprecated networking APIs and Network.framework anti-patterns in your Swift/Objective-C codebase.

## What This Command Checks

### Deprecated APIs (5 patterns)

1. **SCNetworkReachability** (WWDC 2018 deprecated)
   - Race condition between check and connect
   - Use NWConnection waiting state instead

2. **CFSocket** (Replaced by NWConnection)
   - Low-level socket API
   - Missing modern features

3. **NSStream, CFStream** (Replaced by NWConnection)
   - Complex state management
   - Error-prone

4. **NSNetService** (Replaced by NWBrowser)
   - Bonjour discovery
   - Missing Network.framework benefits

5. **getaddrinfo()** (Manual DNS resolution)
   - Blocking operation
   - NWConnection handles automatically

### Anti-Patterns (5 patterns)

6. **Reachability check before connect**
   - Race condition
   - Network state changes between check and connect

7. **Hardcoded IP addresses**
   - Breaks proxy/VPN compatibility
   - IPv4/IPv6 migration issues

8. **Missing [weak self] in callbacks**
   - Memory leaks
   - Connection retained indefinitely

9. **Blocking socket calls**
   - ANR (Application Not Responding)
   - Main thread violations

10. **Not handling waiting state**
    - Poor offline experience
    - Missing network change handling

## Example Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 NETWORKING AUDIT RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📛 DEPRECATED APIS (3 issues)

❌ SCNetworkReachability (DEPRECATED)
   NetworkManager.swift:45
   → Replace with NWConnection waiting state
   Fix: /skill axiom:networking → Pattern 2a

❌ CFSocket (DEPRECATED)
   LegacySocket.m:120
   → Migrate to NWConnection
   Fix: /skill axiom:networking → Pattern 1a

🚨 ANTI-PATTERNS (2 issues)

⚠️ Hardcoded IP Address
   Config.swift:15: let host = "192.168.1.1"
   → Use hostname for proxy/VPN compatibility
   Fix: Use NWEndpoint.hostPort with hostname

⚠️ Missing [weak self]
   ConnectionManager.swift:67: connection.stateUpdateHandler = { state in
   → Add [weak self] to prevent retain cycle
   Fix: connection.stateUpdateHandler = { [weak self] state in

✅ POSITIVE PATTERNS (5 found)

✓ NWConnection: 5 files
✓ URLSession: 12 files (HTTP — correct)
```

## How It Works

The command scans your codebase using grep patterns to detect:
- Deprecated API usage
- Common anti-patterns
- Missing best practices
- Positive patterns (for validation)

Results include:
- **File:line references** for each issue
- **Severity** (deprecated vs anti-pattern)
- **Fix recommendations** linking to skill patterns
- **Positive patterns** showing correct usage

## Usage

In Claude Code:

```bash
# Scan entire project
/audit-networking

# Scan specific file
/audit-networking NetworkManager.swift

# Scan specific directory
/audit-networking Sources/Networking/
```

## Detection Patterns

### Deprecated APIs
```bash
grep -rn "SCNetworkReachability" --include="*.swift" --include="*.m" .
grep -rn "CFSocket" --include="*.swift" --include="*.m" .
grep -rn "NSStream\|CFStream" --include="*.swift" .
grep -rn "getaddrinfo" --include="*.swift" --include="*.m" .
grep -rn "NSNetService" --include="*.swift" --include="*.m" .
```

### Anti-Patterns
```bash
# Hardcoded IPs
grep -rn "[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}" --include="*.swift" .

# Missing [weak self]
grep -rn "stateUpdateHandler.*self\." --include="*.swift" . | grep -v "\[weak self\]"

# Positive patterns
grep -rn "NWConnection\|NetworkConnection" --include="*.swift" .
```

## Fix Recommendations

Each issue links to specific patterns in related skills:

#### SCNetworkReachability
→ `/skill axiom:networking` → Pattern 2a (NWConnection waiting state)

#### CFSocket
→ `/skill axiom:networking` → Pattern 1a (NWConnection TCP+TLS)

#### Hardcoded IP
→ `/skill axiom:networking` → Pattern 1a (Use hostname)

#### Missing [weak self]
→ `/skill axiom:networking` → Checklist item 4

#### Data framing issues
→ `/skill axiom:networking-diag` → Pattern 3a (TLV framing)

## Limitations

**Cannot Detect**:
- Logic errors
- Incorrect state handling
- Race conditions
- Performance issues

**May Have False Positives**:
- IP literals in comments
- Test mocks
- Third-party dependencies

**Manual Review Recommended** for:
- Complex networking logic
- Custom protocols
- Integration patterns

## Next Steps

After running the audit:

1. **Review results** - Prioritize deprecated APIs (highest risk)
2. **Fix patterns** - Follow linked skill patterns
3. **Verify fixes** - Re-run audit to confirm
4. **Test thoroughly** - Real devices, network transitions
5. **Monitor** - Run periodically to prevent regressions

## Time Estimates

Most issues fixable quickly:
- Replace SCNetworkReachability: 5-10 minutes
- Add [weak self]: 1-2 minutes
- Replace hardcoded IP: 2-5 minutes
- Migrate from CFSocket: 30-60 minutes
- Full audit + fixes: 1-3 hours

## Related Resources

- [networking](/skills/integration/networking) — Patterns for each anti-pattern
- [networking-diag](/diagnostic/networking-diag) — Troubleshooting guide
- [network-framework-ref](/reference/network-framework-ref) — Complete API reference

## Command Scope

This is an **audit command** — automated scanning with file:line references.

#### Command provides
- 10 detection patterns
- File:line references for all issues
- Severity classification
- Fix recommendations
- Cross-references to skills

**For deeper analysis**: Use the related skills for implementation patterns and troubleshooting.

## Size

~5 KB - Automated scan with grep patterns
