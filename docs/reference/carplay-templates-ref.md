---
name: carplay-templates-ref
description: CarPlay template catalog reference — all 12 templates with purpose, per-category availability, iOS version gates, depth limits, and key API signatures
---

# CarPlay Templates Reference

Catalog reference for the 12 CarPlay templates that iOS renders on your behalf. Each template entry covers its purpose, the categories that can use it, the iOS version it became available, key constraints, and the most important properties.

## When to Use This Reference

Use this reference when:

- Picking the right template for a CarPlay screen you need to build
- Checking whether a template is available for your app's category
- Looking up the depth limit before pushing another template onto the stack
- Confirming the iOS version gate for a specific template or template feature (image row item styles, message item, pinned elements, sports mode)
- Inspecting the constraints on a template (max items, max characters, asset sizes)
- Wiring up a `CPListTemplate` with sections, image rows, or limited-list mode
- Configuring `CPNowPlayingTemplate.shared` buttons at scene connection time
- Building a search experience with `CPSearchTemplate` and async results

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "Which CarPlay templates can my audio app use?"
- "What's the maximum template stack depth for a driving task app?"
- "How many items can I show in a grid template?"
- "When does limited list mode activate and how do I handle the 12-item cap?"
- "What's the difference between the action sheet and alert templates?"
- "How do I configure the Now Playing template's custom buttons?"
- "Which templates support pinned elements on iOS 26?"
- "What are the iOS version requirements for the new image row styles?"

## What's Covered

- **Template × category availability matrix** — for each of the 12 templates, which of the 10 CarPlay app categories may use it (with iOS version footnotes for iOS 17+ and iOS 26.4+ additions)
- **Template depth limits** — per-category maximum push depth (5 for audio/communication/EV/parking/public-safety/navigation; 3 for fueling and voice-based conversational; 2-or-3 for driving task and quick-food-ordering depending on iOS version)
- **Action sheet template (`CPActionSheetTemplate`)** — modal with 2+ choices, when to use vs alert, iOS 12+ (audio iOS 17+)
- **Alert template (`CPAlertTemplate`)** — modal with one or more buttons, title-length-variant behavior, all categories, iOS 12+
- **Contact template (`CPContactTemplate`)** — caller/messaging-contact/POI presentation, action buttons, optional Siri compose-message bar button, Communication/Public Safety/Navigation only
- **Grid template (`CPGridTemplate`)** — up to 8 icon+title choices, 40×40 pt icon max, all categories, iOS 12+
- **Information template (`CPInformationTemplate`)** — single or two-column static labels with optional footer actions, all except Audio, iOS 12+ (nav bar buttons iOS 16+)
- **List template (`CPListTemplate`)** — the workhorse — sections, standard items, image row items (5 element styles new in iOS 26), message items (iOS 26+), assistant cell, pinned elements (iOS 26+), limited list mode (12-item dynamic cap), and the `completion()` spinner pattern for async handlers
- **Map template (`CPMapTemplate`)** — control layer over the navigation base view, up to 2 leading + 2 trailing nav bar buttons and 4 map buttons, multitouch callbacks on iOS 26+, Navigation only
- **Now Playing template (`CPNowPlayingTemplate`)** — shared instance configured at scene connection, `isAlbumArtistButtonEnabled` and `isUpNextButtonEnabled` toggles, `updateNowPlayingButtons` with `CPNowPlayingPlaybackRateButton`, `CPNowPlayingShuffleButton`, `CPNowPlayingRepeatButton`, `CPNowPlayingAddToLibraryButton`, `CPNowPlayingMoreButton`, plus sports mode (iOS 18.4+) and the `allowsMiniPlayer` MiniPlayer opt-out (iOS 27) — Audio, Communication (iOS 17+), Public Safety
- **Point of interest template (`CPPointOfInterestTemplate`)** — MapKit-backed map with up to 12 location overlays, customizable pins, larger pin for selected location (iOS 16+), Driving Task/EV/Fueling/Parking/Public Safety/QSR
- **Search template (`CPSearchTemplate`)** — async-results search bar with handler delivery, Navigation only
- **Tab bar template (`CPTabBarTemplate`)** — top-level navigation with tab icons (24×24 pt; prefer SF Symbols), all categories
- **Voice control template (`CPVoiceControlTemplate`)** — voice control UI for navigation apps and (iOS 26.4+) driving task and voice-based conversational apps; iOS 27 adds a `backgroundImage` and overlay presentation over another template via `CPInterfaceController.showOverlayTemplate(_:animated:completion:)`
- **Push and pop conventions** — `CPInterfaceController.pushTemplate(_:animated:)` and `popTemplate(animated:)`, the runtime exception you get for exceeding depth, and the runtime exception you get for using an unsupported template in your category

## Documentation Scope

This page documents the `carplay-templates-ref` skill — the template catalog half for CarPlay apps.

- For **app design discipline** (category selection, the 8 Universal Guidelines, per-category rules, entitlement review), see [CarPlay HIG](/skills/integration/carplay-hig). Start there before picking templates.
- For **navigation-specific framework details** (base view, route guidance lifecycle, instrument cluster, HUD metadata, multitouch), see [CarPlay Navigation Reference](/reference/carplay-navigation-ref)
- For **`CPNowPlayingTemplate` customization specifics** (sports mode schema, custom button setup at connection time, CarPlay-specific gotchas), see [Now Playing CarPlay Reference](/reference/now-playing-carplay)

## Resources

**Primary sources:**

- CarPlay Developer Guide (Feb 2026) — template × category matrix and depth limits (p.13), per-template specs (p.14-21), asset sizes (p.26, p.38), Now Playing template code (p.31)

**WWDC**: 2025-216, 2022-10016, 2020-10635, 2018-213
