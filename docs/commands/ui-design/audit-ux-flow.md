---
name: audit-ux-flow
description: Scan SwiftUI/UIKit flows for dead-end views, dismiss traps, buried CTAs, missing empty/loading/error states
---

# audit-ux-flow

Scan user-flow code for journey defects that lead to abandonment or stuck states.

## What This Command Does

Launches the **ux-flow-auditor** agent to find places where users get stuck — sheets without dismiss buttons, screens with no path forward, primary actions hidden three taps deep, missing states for empty/loading/error conditions.

## What It Checks

1. **Dead-end views** – screens reachable via push/sheet without a way back or forward
2. **Dismiss traps** – `.sheet`/`.fullScreenCover` without a dismiss control on the presented view
3. **Buried CTAs** – primary action behind a tap+scroll+tap chain instead of a fixed bottom button
4. **Missing empty/loading/error states** – list views that show blank when empty, no spinner during fetch, no recovery from network error
5. **Accessibility dead ends** – flows that work for sighted users but fail VoiceOver navigation

Findings include an Urgency × Blast-Radius × Fix-Effort × ROI rating to help prioritize fixes.

## Related Agent

- [ux-flow-auditor](/agents/ux-flow-auditor) – The agent that powers this command
