---
name: carplay-navigation-ref
description: CarPlay turn-by-turn navigation reference — base view rules, route guidance lifecycle, map template, CarPlay Dashboard, instrument cluster, HUD metadata, voice prompts, multitouch (iOS 26+), map panels and EV charging (iOS 27), and testing
---

# CarPlay Navigation Reference

API and framework reference for CarPlay turn-by-turn navigation apps. Covers the base view contract, route guidance lifecycle, instrument cluster and HUD metadata, voice prompts, multitouch input (iOS 26+), and the additional displays that only navigation apps can drive.

## When to Use This Reference

Use this reference when:

- Implementing the `templateApplicationScene(_:didConnect:to:)` lifecycle for a navigation app
- Drawing into the CarPlay base view and you need to know what is and isn't allowed
- Wiring `CPMapTemplate` route previews, route choice panels, and trip start
- Driving turn-by-turn updates through `CPNavigationSession` (maneuvers, estimates, alerts, end/pause/resume)
- Populating the CarPlay Dashboard map (iOS 13.4+), instrument cluster (iOS 16.4+), or HUD metadata (iOS 17.4+)
- Handling multitouch zoom, pitch, and rotate callbacks on `CPMapTemplate` (iOS 26+, including CarPlay Ultra)
- Coordinating voice prompts with the vehicle's audio system without stealing the audio session
- Testing across the full range of CarPlay screen sizes and cluster configurations

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What exactly can I draw in the CarPlay navigation base view?"
- "How do I configure the `UIApplicationSceneManifest` for a navigation app with Dashboard and instrument cluster?"
- "What's the route guidance lifecycle from destination selection through trip end?"
- "How do I provide lane guidance using the second maneuver?"
- "Which maneuver metadata appears in the instrument cluster vs the HUD?"
- "How do I update trip estimates without spamming the system?"
- "What multitouch gestures does `CPMapTemplate` deliver on iOS 26+?"
- "How do I show a CarPlay map panel for route choices on iOS 27?"
- "How do I surface an EV charging stop with `CPChargingStationConnection`?"
- "How do I handle `mapTemplateDidCancelNavigation` when the car's native nav takes over?"

## What's Covered

- **Supported displays matrix** – center display (iOS 12), CarPlay Dashboard (iOS 13.4), instrument cluster (iOS 16.4), HUD metadata (iOS 17.4) — and the rule that you must support all capabilities your app's screens enable
- **Base view contract** – exclusively a map, no overlays or UI; how to receive `contentStyle` light/dark signals; safe area handling around buttons
- **Application scene manifest** for declaring main CarPlay, Dashboard, and instrument cluster scenes, plus the corresponding `CPTemplateApplicationScene` delegate roles
- **Scene delegate lifecycle** – receiving `CPInterfaceController` and `CPWindow`, retaining both for the session, setting the root map template
- **Route guidance lifecycle** – destination selection (via list/grid/search/voice-control templates with the 5-level depth rule), trip preview panel (up to 12 `CPTrip` objects, route choice descriptions in descending length order), choose-route-and-start-guidance, in-guidance maneuver updates, end guidance, re-route (iOS 17.4+ via `resumeTrip`)
- **`CPManeuver` content** – symbol set (light/dark variants), instruction variants in descending length order, attributed instruction variants with embedded images, maneuver metadata (maneuverType, maneuverState, junctionType, trafficSide, lane guidance)
- **Lane guidance via the second maneuver** – the 120×18 pt symbol-only convention and `CPManeuverDisplayStyleSymbolOnly`
- **Estimate updates** – `CPNavigationSession.updateEstimates(_:for:)` for per-maneuver, `CPMapTemplate.updateEstimates(_:for:)` for trip-level, and the "significant changes only" guidance
- **Navigation alerts** – `CPNavigationAlert` with title and subtitle variants, primary/secondary actions, auto-dismiss duration, and the iOS 16+ enhancements (longer subtitles, no-button alerts, custom colored buttons)
- **Cancellation from car's native nav** – `mapTemplateDidCancelNavigation` handling required by navigation rule #6
- **Instrument cluster and HUD metadata** – what content the cluster renders vs HUD, how maneuver metadata maps to each, and iOS 17.4+ HUD-specific patterns
- **Voice prompts and audio** – mixing with the vehicle's audio without activating an unnecessary session
- **Multitouch (iOS 26+)** – zoom (pinch, double-tap, two-finger double-tap), pitch (two-finger slide up/down), rotate (two-finger clockwise/counterclockwise), and the CarPlay Ultra implication that multitouch is always available
- **Map panels and EV charging (iOS 27)** – `CPMapPanel` overlay panels pushed over `CPMapTemplate` via `showPanel`/`pushPanel` (built from trips, travel estimates, route choices, route details, charging connections, and waypoints), and `CPChargingStationConnection` (connector, voltage, power) for surfacing EV charging stops
- **Testing matrix** – screen sizes from 748×456 to 1920×720, light/dark content style coverage, cluster configurations, CarPlay Simulator vs Xcode Simulator vs real-vehicle gaps

## Documentation Scope

This page documents the `carplay-navigation-ref` skill — the framework-and-API half for CarPlay navigation apps.

- For **the 10 navigation-specific design rules** (base-view restriction, voice control scope, audio handling, native-nav cancellation), see [CarPlay HIG](/skills/integration/carplay-hig). Start there before any navigation implementation work.
- For **template catalog and per-category availability** across all CarPlay app types, see [CarPlay Templates Reference](/reference/carplay-templates-ref)
- For **Now Playing in CarPlay** (audio apps and the `CPNowPlayingTemplate` mechanics), see [Now Playing CarPlay Reference](/reference/now-playing-carplay)

## Resources

**Primary sources:**

- CarPlay Developer Guide (Feb 2026) — base view (p.33), navigation rules (p.6), route guidance lifecycle (p.41-45), instrument cluster and HUD (p.32, p.46), multitouch (p.46), scene manifest (p.58-59)

**WWDC**: 2025-216, 2022-10016, 2020-10635, 2018-213
