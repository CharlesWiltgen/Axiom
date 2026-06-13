---
name: audit-screenshots
description: Scan App Store screenshots for placeholder text, wrong dimensions, debug indicators, broken UI, competitor refs
---

# audit-screenshots

Scan the App Store screenshot folder for content that would trigger reviewer rejection or look unprofessional in the listing.

## What This Command Does

Launches the **screenshot-validator** agent to visually inspect each screenshot for issues that App Review catches — placeholder text, wrong dimensions, debug overlays, broken UI states, or references to competitor brands.

## What It Checks

1. **Placeholder text** – "Lorem ipsum", "TODO", "REPLACE ME" left in marketing screenshots
2. **Wrong dimensions** – screenshots not matching the required device-class resolution for App Store Connect
3. **Debug indicators** – `print` overlays, `UIDebuggingInformationOverlay`, performance HUDs, simulator status bars
4. **Broken UI** – clipped text, overlapping views, missing assets, images in loading state
5. **Competitor references** – logos or brand names of competing apps visible in the frame

## Related Agent

- [screenshot-validator](/agents/screenshot-validator) – The agent that powers this command
