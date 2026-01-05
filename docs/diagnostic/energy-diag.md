---
name: energy-diag
description: Symptom-based energy troubleshooting for battery drain, overheating, and background power issues
version: 1.0.0
---

# Energy Diagnostics

Symptom-based troubleshooting for iOS energy issues. Start with your symptom, follow the decision tree, get the fix.

## Symptoms This Diagnoses

Use when you're experiencing:
- App at top of Battery Settings
- Device gets hot during app use
- High background battery drain
- Battery drains faster on cellular than WiFi
- Energy spike during specific action
- "Phone gets hot" user complaints

## Example Prompts

- "My app is at the top of Battery Settings"
- "Users say their phone gets hot when using my app"
- "High background battery drain reported"
- "App drains battery more on cellular than WiFi"
- "Energy spikes when user taps this button"
- "How do I diagnose battery drain?"

## Diagnostic Workflow

Claude guides you through symptom-based diagnosis:

### Symptom 1: App at Top of Battery Settings

**Power Profiler reveals which subsystem:**
- CPU high → Timer leak or polling loop
- Network high → Batching issue or polling
- GPU high → Animations running when not visible
- Display high → Light backgrounds on OLED

### Symptom 2: Device Gets Hot

**During specific action:**
- Video/camera → Check encoding efficiency
- Scroll/animation → Reduce effects, check frame rate
- Data processing → Move to background, cache results

**During normal use:**
- Run Power Profiler to identify continuous drain
- Check for infinite loops or runaway recursion

### Symptom 3: Background Drain

**Check Info.plist background modes:**
- Location → Use significant-change, not continuous
- Audio → Deactivate session when not playing
- Fetch → Reasonable earliestBeginDate
- BGTask → Complete tasks promptly

### Symptom 4: Cellular-Only Drain

**Check URLSession configuration:**
- `allowsExpensiveNetworkAccess` → Set false for non-urgent
- `isDiscretionary` → Set true for background downloads
- Request patterns → Batch small requests

## Quick Diagnostic Checklist

### 30-Second Check
- Device plugged in? (Power metrics show 0)
- Debug build? (Less optimized)
- Low Power Mode on? (Affects measurements)

### 5-Minute Check
- Which subsystem dominant? (CPU/GPU/Network/Display)
- Sustained or spiky?
- Foreground or background?

### Common Quick Fixes

| Finding | Fix | Time |
|---------|-----|------|
| Timer without tolerance | Add `.tolerance = 0.1` | 1 min |
| VStack with large ForEach | Change to LazyVStack | 1 min |
| Missing stopUpdatingLocation | Add stop call | 2 min |
| No Dark Mode | Add asset variants | 30 min |

## Documentation Scope

This page documents the `axiom-energy-diag` diagnostic skill—symptom-based troubleshooting Claude uses when you report battery or energy issues.

**For optimization patterns:** See [energy](/skills/debugging/energy) for Power Profiler workflows.

**For API reference:** See [energy-ref](/reference/energy-ref) for timer, network, and location APIs.

## Related

- [energy](/skills/debugging/energy) — Energy optimization patterns and workflows
- [energy-ref](/reference/energy-ref) — Complete energy API reference

## Resources

**WWDC**: 2025-226, 2025-227, 2022-10083

**Docs**: /instruments, /xcode/improving-your-app-s-performance
