# energy-auditor

Scans codebase for the 8 most common energy anti-patterns that cause excessive battery drain and device heating.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my app for battery drain issues?"
- "Audit my code for energy efficiency"
- "My app drains battery fast, can you scan for problems?"
- "Check for power consumption issues before release"

**Explicit command:**
```bash
/axiom:audit energy
```

## What It Does

### Critical (10-40% battery drain/hour)
- **Timer abuse** — Timers without tolerance, high-frequency repeating timers
- **Polling instead of push** — URLSession on timer instead of push notifications
- **Continuous location** — `startUpdatingLocation` without stop, unnecessary high accuracy

### High Priority (5-15% drain/hour)
- **Animation leaks** — Animations running when view not visible
- **Background mode misuse** — Unused background modes, always-active audio session

### Medium Priority (5-10% drain/hour)
- **Network inefficiency** — Many small requests, no `waitsForConnectivity`
- **GPU waste** — Blur over dynamic content, excessive shadows/masks

### Low Priority (1-5% drain/hour)
- **Disk I/O patterns** — Frequent small writes, SQLite without WAL mode

## Example Output

```markdown
## Energy Audit Results

### Summary
- **CRITICAL Issues**: 3 (Estimated 25% battery drain/hour)
- **HIGH Issues**: 2
- **MEDIUM Issues**: 4

### CRITICAL: Timer Abuse
**File**: `Services/SyncService.swift:45`
**Issue**: Timer without tolerance, 0.5s interval
**Impact**: CPU stays awake, ~15% drain/hour
**Fix**: Add 10% tolerance minimum
```

## Related

- [energy](/skills/debugging/energy) — Power Profiler workflows and subsystem diagnosis
- [energy-diag](/diagnostic/energy-diag) — Decision trees for battery drain issues
