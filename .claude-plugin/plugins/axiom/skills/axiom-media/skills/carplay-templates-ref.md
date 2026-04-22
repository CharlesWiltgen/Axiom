
# CarPlay Templates Reference

Reference for all 12 CarPlay templates — purpose, per-category availability, iOS version gates, API signatures, and constraints.

**Start with `carplay-hig.md`** for app category selection and design rules. This file documents the template catalog.

## Overview

CarPlay apps are built from a fixed set of UI templates that iOS renders onto the CarPlay screen. Your app selects which template to show (the controller) and supplies data (the model); iOS handles the view. Attempting to use an unsupported template for your app category triggers a runtime exception. Source: *CarPlay Developer Guide*, Feb 2026, p.13.

Your app stacks templates on the screen using `CPInterfaceController.pushTemplate(_:animated:)` and navigates back with `popTemplate(animated:)`. Each category has a maximum depth; attempts to push beyond the depth throw a runtime exception.

## Template × Category Availability

Source: *CarPlay Developer Guide*, Feb 2026, p.13.

| Template | Audio | Comm | Driving task / Voice conv. | EV / Fueling / Parking / QSR | Public safety | Navigation |
|---|---|---|---|---|---|---|
| Action sheet | ●¹ | ● | ● | ● | ● | ● |
| Alert | ● | ● | ● | ● | ● | ● |
| Grid | ● | ● | ● | ● | ● | ● |
| List | ● | ● | ● | ● | ● | ● |
| Tab bar | ● | ● | ● | ● | ● | ● |
| Information |   | ● | ● | ● | ● | ● |
| Point of interest |   |   | ● | ● | ● |   |
| Now playing | ● | ●¹ |   |   | ● |   |
| Contact |   | ● |   |   | ● | ● |
| Map |   |   |   |   |   | ● |
| Search |   |   |   |   |   | ● |
| Voice control |   |   | ●² |   |   | ● |

*¹ iOS 17 or later. ² iOS 26.4 or later (new for driving-task apps; voice-based conversational apps are iOS 26.4+ by definition).*

## Template Depth Limits

Source: *CarPlay Developer Guide*, Feb 2026, p.13.

| Category | Max template depth |
|---|---|
| Audio | 5 |
| Communication | 5 |
| EV charging | 5 |
| Parking | 5 |
| Public safety | 5 |
| Navigation | 5 |
| Fueling | 3 |
| Voice-based conversational | 3 |
| Driving task | 2 (iOS ≤ 26.3) / 3 (iOS 26.4+) |
| Quick food ordering | 2 (iOS ≤ 26.3) / 3 (iOS 26.4+) |

The depth includes the root template. Push beyond the limit and CarPlay throws at runtime.

---

## Action sheet template — `CPActionSheetTemplate`

**Purpose**: Modal alert in response to a control or action, presenting 2+ choices. Title, message, buttons.

**Use when**: You need confirmation before a potentially destructive operation, or to offer 2+ related choices from a control.

**Don't use for**: Informational messages with a single acknowledgment — use an alert instead.

**Category availability**: all (audio requires iOS 17+).

**iOS version**: iOS 12+ (audio iOS 17+).

Source: *Developer Guide* p.14.

---

## Alert template — `CPAlertTemplate`

**Purpose**: Modal conveying important state information. Title plus one or more buttons.

**Use when**: The user must acknowledge or make a single simple choice.

**Key behavior**: You may provide titles of varying lengths; CarPlay chooses the title that fits the available screen space.

**Category availability**: all.

**iOS version**: iOS 12+.

Source: *Developer Guide* p.14.

---

## Contact template — `CPContactTemplate`

**Purpose**: Present information about a person or business. Image, title, subtitle, action buttons.

**Use when**: Showing a caller, a messaging contact, a place of interest along a route.

**Key features**:
- Action buttons for tasks related to the contact (call, message, navigate).
- Optional bar button to activate Siri and initiate the compose-message flow (communication apps).

**Category availability**: Communication, Public safety, Navigation.

**iOS version**: iOS 12+.

Source: *Developer Guide* p.15.

---

## Grid template — `CPGridTemplate`

**Purpose**: Present **up to 8** icon+title choices in a grid.

**Use when**: The user is selecting from a small fixed set of categories (genres, playlists, quick actions).

**Constraints**:
- Maximum 8 grid items.
- Navigation bar with title, leading buttons, and trailing buttons (icons or text).
- Grid icon max size: 40×40 pt (120×120 @3x / 80×80 @2x).

**Category availability**: all.

**iOS version**: iOS 12+.

Source: *Developer Guide* p.15, p.26.

---

## Information template — `CPInformationTemplate`

**Purpose**: Show important summary information as static labels, optionally with footer action buttons.

**Use when**: Displaying summary state — EV charging station availability, order summary for a QSR app, trip overview.

**Constraints**:
- Labels appear in a single column or in two columns.
- Limited label count — show only the most important summary info.
- Leading and trailing navigation bar buttons supported iOS 16+.

**Category availability**: all except Audio.

**iOS version**: iOS 12+ (nav bar buttons iOS 16+).

Source: *Developer Guide* p.16.

---

## List template — `CPListTemplate`

**Purpose**: Scrolling single-column table divided into sections. The most commonly used navigation template.

**Use when**: Presenting hierarchical content, playback queues, search results, contacts, order history.

### List item types

| Item type | Purpose | iOS |
|---|---|---|
| Standard list item (`CPListItem`) | Icon + title + optional subtitle + optional disclosure/progress/status indicator | 12+ |
| Image row item (`CPListImageRowItem`) | Row of images (e.g. album artwork) in 5 element styles — row, card, condensed, grid, image grid | Row: 12+; other styles: 26+ |
| Message item | Contact/conversation for communication apps | 26+ |
| Assistant cell | Siri prompt cell (top or bottom of list) to start media playback or place a call | 12+ |

### Pinned elements (iOS 26+)

The list template supports **pinned elements** that always appear at the top. Pinned elements are a set of grid elements with image and title. Communication apps can additionally support a message configuration for pinned elements (with or without unread indicator).

### Limited list mode

Some cars dynamically limit lists to **12 list items**. You can check the maximum, but always be prepared to handle the 12-item case. The vehicle decides when limited mode activates (e.g. when moving or shifted out of Park).

Check limited mode via `CPSessionConfiguration.limitedUserInterfaces` — observe changes and adapt.

### Code example — creating a simple list

```swift
import CarPlay

let item = CPListItem(text: "My title", detailText: "My subtitle")
item.handler = { [weak self] _, completion in
    // Start playback asynchronously…
    self?.interfaceController?.pushTemplate(CPNowPlayingTemplate.shared, animated: true)
    completion()
}

let section = CPListSection(items: [item])
let listTemplate = CPListTemplate(title: "Albums", sections: [section])
interfaceController.pushTemplate(listTemplate, animated: true)
```

If your list handler initiates async work and doesn't immediately call `completion()`, CarPlay shows a spinner. Call `completion()` when the work finishes so the spinner dismisses.

**Category availability**: all.

**iOS version**: iOS 12+ (element styles and pinned elements iOS 26+; message item iOS 26+).

Source: *Developer Guide* p.17-19, p.30.

---

## Map template — `CPMapTemplate`

**Purpose**: Control layer over the navigation base view. Not a map itself — the map is drawn in the base view. The map template provides a navigation bar and map buttons as overlays.

**Use when**: Always — this is the root template for navigation apps.

**Constraints**:
- Navigation bar: up to 2 leading buttons + 2 trailing buttons (icons or text).
- Map buttons: up to 4, shown as icons.
- Panning mode required if your app supports panning (for vehicles without touchscreen drag).
- Touch gestures for intended purpose only: pan, zoom, pitch, rotate.

**Multitouch** (iOS 26+): receives callbacks for zoom (pinch + double-tap), pitch (two-finger slide up/down), rotate (two-finger rotate).

**Category availability**: Navigation only.

**iOS version**: iOS 12+ (multitouch iOS 26+).

Source: *Developer Guide* p.34, p.46. For the full navigation-app lifecycle (startup, route guidance, instrument cluster/HUD, metadata), see `carplay-navigation-ref.md`.

---

## Now playing template — `CPNowPlayingTemplate`

**Purpose**: Display currently playing audio — title, artist, elapsed time, album artwork, plus customizable playback controls.

**Use when**: Any audio playback. The template is a **shared instance** (`CPNowPlayingTemplate.shared`) that you configure; iOS can push it on your behalf (tap of the Now Playing button from the home screen or your app's tab bar).

**Special features**:
- Direct access from the CarPlay home screen or your navigation bar's Now Playing button.
- Only the list template may be pushed on top of now playing (e.g. for a "Playing Next" queue).
- **Sports mode** (iOS 18.4+) — see `now-playing-carplay.md` for the full schema.

**Key properties**:
- `isAlbumArtistButtonEnabled` — shows a button that navigates to album/artist view in your app
- `isUpNextButtonEnabled` — shows a button that displays upcoming tracks
- `updateNowPlayingButtons([CPNowPlayingButton])` — custom playback buttons

**Common custom buttons**:
- `CPNowPlayingPlaybackRateButton`
- `CPNowPlayingShuffleButton`
- `CPNowPlayingRepeatButton`
- `CPNowPlayingAddToLibraryButton`
- `CPNowPlayingMoreButton`

### Code example — configuring at connection

```swift
func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
) {
    let nowPlayingTemplate = CPNowPlayingTemplate.shared

    let rateButton = CPNowPlayingPlaybackRateButton { _ in
        // Change the playback rate
    }
    nowPlayingTemplate.updateNowPlayingButtons([rateButton])
}
```

Configure at connection time, not when pushed — iOS may display the template on your behalf before your code ever calls `pushTemplate`.

**Category availability**: Audio, Communication (iOS 17+), Public safety.

**iOS version**: iOS 12+ (sports mode iOS 18.4+).

Source: *Developer Guide* p.20-21, p.31.

---

## Point of interest template — `CPPointOfInterestTemplate`

**Purpose**: Browse nearby locations on a map and choose one for action.

**Use when**: EV charger finder, QSR location picker, public-safety vehicle/location search.

**Constraints**:
- Map provided by MapKit.
- Overlay list of **up to 12 locations** with customizable pin images.
- Larger pin image for the currently selected location (iOS 16+).
- Limit the location list to those most relevant or nearby.

**Category availability**: Driving task, EV charging, Fueling, Parking, Public safety, Quick food ordering.

**iOS version**: iOS 12+ (selected-location large pin iOS 16+).

Source: *Developer Guide* p.22.

---

## Search template — `CPSearchTemplate`

**Purpose**: Text entry + keyboard + results list. The search template adapts its keyboard style (touchscreen vs linear/rotary) based on vehicle hardware.

**Use when**: Searching for destinations in a navigation app.

**Key delegate methods**:
- `updatedSearchText(_:completionHandler:)` — respond with `[CPListItem]`
- `selectedResult(_:completionHandler:)` — act on selection

**Constraints**:
- Many cars limit when the keyboard may be shown (see *Keyboard and list restrictions* in `carplay-navigation-ref.md`).
- Results are `CPListItem` elements.

**Category availability**: Navigation only.

**iOS version**: iOS 12+.

Source: *Developer Guide* p.35.

---

## Tab bar template — `CPTabBarTemplate`

**Purpose**: Container for other templates. Each tab hosts one template; tabs switch between them.

**Use when**: Top-level app structure has multiple modes (library, browse, search, radio).

**Constraints**:
- Up to **4 tabs for audio apps**; up to **5 tabs for all other categories**. These limits may change — observe the maximum tab count returned by iOS rather than hard-coding.
- Tab title can include text or an image (prefer SF Symbols for system font integration).
- Tabs may optionally be marked with a small red indicator to signal they require action or show ephemeral info.
- When your app is playing audio, CarPlay displays a Now Playing button in the top right of the tab bar (hidden if tab bar has more than 4 tabs).

**Asset size** (tab bar icon): 24×24 pt (72×72 @3x / 48×48 @2x).

**Category availability**: all.

**iOS version**: iOS 12+.

Source: *Developer Guide* p.23, p.26.

---

## Voice control template — `CPVoiceControlTemplate`

**Purpose**: Visual feedback for voice-based services during active voice interaction.

**Use when**:
- CarPlay navigation apps: voice-based services limited to navigation functions.
- Voice-based conversational apps (iOS 26.4+).

**Constraints**:
- Must be displayed while voice-based services are active.
- To work well with other car audio, activate the audio session only when voice is in use (see *Audio handling* in the Developer Guide).
- iOS 26.4+: up to 4 action buttons + leading and trailing navigation bar buttons.
- All other CarPlay app categories must use SiriKit or Siri Shortcuts for voice features — not this template.

**Category availability**: Voice-based conversational (iOS 26.4+), Navigation.

**iOS version**: iOS 12+ for navigation; iOS 26.4+ for voice-based conversational.

Source: *Developer Guide* p.24.

---

## Asset Size Reference

Source: *Developer Guide* p.26. All sizes are maximum; smaller icons render fine.

| Element | Max points | 3x pixels | 2x pixels |
|---|---|---|---|
| Contact action button | 50 × 50 | 150 × 150 | 100 × 100 |
| Grid icon | 40 × 40 | 120 × 120 | 80 × 80 |
| Now playing action button | 20 × 20 | 60 × 60 | 40 × 40 |
| Tab bar icon | 24 × 24 | 72 × 72 | 48 × 48 |

For navigation-specific maneuver symbols and dashboard junction images, see `carplay-navigation-ref.md` (Developer Guide p.38).

### Trait collection and runtime scale

If you need the CarPlay screen scale at runtime, use `carTraitCollection` (not `traitCollection` — that returns the iPhone screen scale). **Only use `carTraitCollection` for display scale**; other parameters on it return iPhone values, not car values (Dev Guide p.26). For list item image sizing, read `maximumImageSize` on `CPListItem` or `CPListImageRowItem`.

### Dark / light adaptation

CarPlay signals light/dark via `contentStyle` on your scene. Observe `contentStyleDidChange` to adapt — the car may transition to dark mode at night or when headlights activate.

---

## Common Mistakes

| Mistake | Why it fails | Fix |
|---|---|---|
| Pushing a template not allowed for your category | Runtime exception | Check the availability matrix before designing flows |
| Exceeding the template depth limit | Runtime exception | Flatten hierarchy; use tab bar or now-playing as effective root |
| Hardcoding 4 tabs for a non-audio app (thinking 4 is the max) | Audio is 4, others are 5 — observe the system max | Read `maximumTabCount` returned by iOS; don't rely on fixed values |
| Configuring `CPNowPlayingTemplate` after `pushTemplate` | iOS may present the template before you push it | Configure at `templateApplicationScene(_:didConnect:)` |
| Assuming lists always show all items | Limited-list mode caps at 12 items while driving | Handle the 12-item case — prioritize what appears |
| Using `traitCollection` for scale | Returns iPhone scale, not car scale | Use `carTraitCollection` |
| Drawing route overlays in the base view (navigation) | "Base view must be used exclusively to draw a map" | Use templates (navigation alert, list, information) for overlays — see navigation-ref |

---

## Resources

**Primary source**: *CarPlay Developer Guide*, Feb 2026, pp.13-31.

**Related Axiom skills:**

- `carplay-hig.md` — category selection, 8 Universal Guidelines + per-category design rules (**start here**)
- `carplay-navigation-ref.md` — nav-specific: base view, route guidance lifecycle, instrument cluster/HUD, metadata, multitouch
- `now-playing-carplay.md` — Now Playing template customization + sports mode API mechanics

**WWDC:**

- WWDC25-216 "Turbocharge your app for CarPlay" — iOS 26 list element styles, pinned elements, message item, voice control additions
- WWDC22-10016 "Get more mileage out of your app with CarPlay" — iOS 16 template additions
- WWDC20-10635 "Accelerate your app with CarPlay" — framework overview
- WWDC18-213 "CarPlay Audio and Navigation Apps" — template types and lifecycle origins
