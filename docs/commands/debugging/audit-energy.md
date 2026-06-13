---
name: audit-energy
description: Scan for battery-drain anti-patterns — timer abuse, polling, continuous location, background-mode misuse
---

# audit-energy

Scan the codebase for battery-drain anti-patterns and energy-inefficient APIs.

## What This Command Does

Launches the **energy-auditor** agent to flag patterns that quietly burn battery — timers that never fire usefully, polling where push would do, continuous location requests, and background modes used where a one-shot suffices.

## What It Checks

1. **Timer abuse** – high-frequency `Timer.scheduledTimer` calls and `RunLoop` polling
2. **Polling instead of push** – repeated network fetches where a server-push or `URLSession` listener would suffice
3. **Continuous location** – `startUpdatingLocation` without `stop`, or `desiredAccuracy` set higher than the use-case needs
4. **Animation leaks** – running animations on hidden views, infinite repeats not cancelled in `viewWillDisappear`
5. **Background mode misuse** – declared background modes that aren't actually needed for the feature

## Related Agent

- [energy-auditor](/agents/energy-auditor) – The agent that powers this command
- [energy-ref](/reference/energy-ref) – Energy optimization reference
