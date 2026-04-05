# energy-auditor

Scans for energy anti-patterns — from known battery drains like timer abuse and continuous location to unnecessary background work like timers running for inactive features and location tracking when no UI consumes the data.

## What It Does

- Detects 8 known anti-patterns (timer abuse, polling, continuous location, animation leaks, background mode misuse, network inefficiency, GPU waste, disk I/O)
- Identifies unnecessary work (timers for off-screen features, location when not on map, unused background modes, always-active audio sessions)
- Correlates findings that compound into higher severity
- Produces an Energy Health Score (EFFICIENT / WASTEFUL / DRAINING)

## How to Use

**Natural language:**
- "Can you check my app for battery drain issues?"
- "Audit my code for energy efficiency"
- "My app drains battery fast, can you scan for problems?"

**Explicit command:**
```bash
/axiom:audit energy
```

## Related

- **energy** skill — use to diagnose and fix the issues this auditor finds, including Power Profiler workflows
- **energy-diag** skill — decision trees for battery drain symptom diagnosis
- **memory-auditor** agent — overlaps on timer/animation lifecycle cleanup
