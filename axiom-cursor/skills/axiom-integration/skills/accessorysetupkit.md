
# AccessorySetupKit — Privacy-Friendly Accessory Pairing

AccessorySetupKit (iOS/iPadOS 18+) replaces the old "request broad Bluetooth permission, then scan for everything" flow with a one-tap, privacy-preserving picker. Your app declares exactly which accessories it can pair with; the system runs the scan in a separate process and shows a picker with *your* artwork and friendly name. One tap grants your app scoped Bluetooth **and** Wi-Fi access to that single accessory — with no broad Bluetooth permission prompt.

## Core mental model

There are three stages, and AccessorySetupKit only owns the first two:

1. **Discovery** — the system scans for accessories matching your `ASDiscoveryDescriptor` rules.
2. **Authorization** — the user taps your accessory in the picker; it's paired and scoped to your app.
3. **Communication** — you keep using **CoreBluetooth** and **NetworkExtension** exactly as before.

The win is privacy and friction: the picker runs out-of-process, the user sees only the accessories you can pair, and your app never asks for the system-wide Bluetooth permission. Your app receives a *scoped* identifier for the peripheral, not the real hardware UUID.

## When to Use This Skill

- Pairing a Bluetooth and/or Wi-Fi hardware accessory (wearable, sensor, smart-home device, toy)
- Replacing a `CBCentralManager`-scans-everything setup flow with the system picker
- Migrating accessories your app already manages onto the new permission model
- Wanting Bluetooth + Wi-Fi access from a single one-tap setup

For the full type/property surface (every descriptor field, event case, and the authorization-settings flow), see `skills/accessorysetupkit-ref.md`. For the CoreBluetooth/NetworkExtension communication that follows pairing, see axiom-networking. For the broader permission-prompt UX, see `skills/privacy-ux.md`.

## System Requirements

| Capability | Minimum |
|------------|---------|
| AccessorySetupKit (`ASAccessorySession`, Bluetooth + Wi-Fi) | iOS 18.0+, iPadOS 18.0+ |
| Bluetooth HID accessories | iOS 18.4+ |
| Wi-Fi Aware descriptor fields (`wifiAwareServiceName`, etc.) | iOS 26.0+ |

No macOS, watchOS, or tvOS. (If you saw "iOS 26" as the floor — that's wrong; the framework shipped in iOS 18.0.)

## Critical Gotchas

| Gotcha | Why it bites | Fix |
|--------|--------------|-----|
| Descriptor with only a name substring | A descriptor **must** include at least one of `bluetoothServiceUUID` or `bluetoothCompanyIdentifier`; a name alone is rejected | Always set a service UUID or company identifier |
| Picker finds nothing | Info.plist keys don't match your descriptors | The `NSAccessorySetup*` arrays must list every UUID/company/name your descriptors use |
| Querying accessories too early | The session isn't usable until it activates | Wait for the `.activated` event before `showPicker` or reading `accessories` |
| Expecting a Bluetooth permission prompt | With ASK declared, there is none — and `CBCentralManager` only reaches `.poweredOn` once you have a paired accessory | Drive connection off the `accessoryAdded` event / existing accessories, not a permission callback |
| Treating `bluetoothIdentifier` as the hardware UUID | It's a per-app **scoped** identifier | Use it only within your app; don't compare it across apps |
| Migration silently doesn't happen | Mixing migration items with normal display items defers migration until a new device is set up | Pass **only** `ASMigrationDisplayItem`s to migrate immediately |
| Accessory stuck in `.awaitingAuthorization` | A Wi-Fi or bridged accessory needs a post-pairing setup step | Collect what's needed in-app, then call `finishAuthorization(for:settings:)` (Part 4) |

## Part 1 — Declare what you can pair

Two halves that must agree: Info.plist entitlement-style keys, and the runtime `ASDiscoveryDescriptor`. If they disagree, discovery returns nothing.

```xml
<!-- Info.plist -->
<key>NSAccessorySetupSupports</key>
<array><string>Bluetooth</string><string>WiFi</string></array>

<key>NSAccessorySetupBluetoothServices</key>
<array><string>0000FFF0-0000-1000-8000-00805F9B34FB</string></array>
<!-- also: NSAccessorySetupBluetoothCompanyIdentifiers, NSAccessorySetupBluetoothNames -->
```

```swift
import AccessorySetupKit
import CoreBluetooth

let descriptor = ASDiscoveryDescriptor()
descriptor.bluetoothServiceUUID = CBUUID(string: "FFF0")   // must be listed in Info.plist
// Optional refinements (each still needs the UUID/company ID above):
descriptor.bluetoothNameSubstring = "Dice"
```

A descriptor needs **at least one** of `bluetoothServiceUUID` or `bluetoothCompanyIdentifier`. Add Wi-Fi rules (`ssid`, `ssidPrefix`) for Wi-Fi accessories.

## Part 2 — Session lifecycle

Activate, wait for `.activated`, then present the picker with one display item per accessory variant.

```swift
let session = ASAccessorySession()

session.activate(on: DispatchQueue.main) { event in
    switch event.eventType {
    case .activated:
        // safe to read session.accessories or present the picker now
    case .accessoryAdded:
        if let accessory = event.accessory { connect(to: accessory) }
    case .accessoryRemoved:
        break
    case .accessoryChanged:
        break          // e.g. user renamed it in Settings
    case .pickerDidPresent, .pickerDidDismiss:
        break          // your UI is occluded while the picker is up
    default:
        break
    }
}

func presentPicker() {
    let item = ASPickerDisplayItem(
        name: "Pink Dice",
        productImage: UIImage(named: "dice-pink")!,
        descriptor: descriptor)
    session.showPicker(for: [item]) { error in
        if let error { /* handle / log */ }
    }
}
```

Bind `showPicker` to an explicit user action (a button) and give context first — calling it unprompted surprises the user with a system sheet on top of your app.

## Part 3 — Connect after pairing

Pairing hands you an `ASAccessory`. Use its `bluetoothIdentifier` with ordinary CoreBluetooth — no permission prompt, because ASK already granted scoped access.

```swift
func connect(to accessory: ASAccessory) {
    guard let id = accessory.bluetoothIdentifier else { return }
    // central was created earlier; it reaches .poweredOn once an accessory is paired
    if let peripheral = central.retrievePeripherals(withIdentifiers: [id]).first {
        central.connect(peripheral)
    }
}
```

`central.scanForPeripherals` also works and returns **only** accessories paired with your app. `ASAccessory` exposes `displayName`, `state` (an `ASAccessory.AccessoryState`: `.unauthorized` / `.awaitingAuthorization` / `.authorized`), `descriptor`, `bluetoothIdentifier`, and `ssid`.

Once connected, on iOS 27 you can **measure the distance** to the accessory with Bluetooth Channel Sounding — `CBCentralManager.supports(.channelSounding)`, then `peripheral.startChannelSoundingSession(_:)` for distance, or feed `peripheral.identifier` into a NearbyInteraction `NISession` for distance *and* direction. Needs an N1-chip iPhone and a foreground app. Full surface: Part 7 of `skills/accessorysetupkit-ref.md`.

## Part 4 — Accessories that need post-pairing setup

Not every accessory is usable the instant the user taps the picker. A Wi-Fi accessory may need credentials; a bridged Bluetooth Classic accessory needs its transport identifier. These arrive in **`.awaitingAuthorization`**, not `.authorized` — you collect what you need in-app, then *finish* (or *fail*) the authorization.

```swift
case .accessoryAdded:
    guard let accessory = event.accessory else { break }
    if accessory.state == .awaitingAuthorization {
        let settings = ASAccessorySettings.defaultSettings
        settings.ssid = collectedHotspotSSID                          // Wi-Fi hotspot to join
        // settings.bluetoothTransportBridgingIdentifier = sixByteID  // bridge BT Classic profiles
        session.finishAuthorization(for: accessory, settings: settings) { _ in }
    } else {
        connect(to: accessory)
    }
```

If the user backs out or setup fails, call `session.failAuthorization(for: accessory) { _ in }`. To upgrade an already-authorized accessory's permissions (e.g. add Wi-Fi to a Bluetooth-only accessory), use `updateAuthorization(for:descriptor:)` with a broader descriptor. Drive the post-pairing path by setting `setupOptions` on your `ASPickerDisplayItem` (see `skills/accessorysetupkit-ref.md`).

## Part 5 — Migrate existing accessories

If your app already manages accessories via the old broad-permission model, upgrade them with `ASMigrationDisplayItem` (an `ASPickerDisplayItem` subclass) seeded with the known peripheral identifier or SSID.

```swift
let migration = ASMigrationDisplayItem(
    name: "My Sensor", productImage: image, descriptor: descriptor)
migration.peripheralIdentifier = knownPeripheralUUID   // or .hotspotSSID for Wi-Fi
session.showPicker(for: [migration]) { _ in }
```

A `showPicker` call containing **only** migration items shows an informational page and migrates immediately. Mix them with normal items and migration is deferred until a new accessory is set up.

## Part 6 — Picker assets

The picker box is 180×120 pt. Ship a high-resolution, transparent-background product image that reads well in light and dark mode; widen the transparent border to pad the artwork smaller. Don't update occluded UI while the picker is presented — gate UI changes on `pickerDidDismiss`.

## Common Mistakes

- A descriptor with only `bluetoothNameSubstring` and no service UUID / company ID — rejected.
- Info.plist `NSAccessorySetup*` arrays that don't list the UUIDs your descriptors use — empty picker.
- Reading `session.accessories` or calling `showPicker` before the `.activated` event.
- Waiting for a Bluetooth permission prompt that never comes (ASK suppresses it).
- Storing/comparing `bluetoothIdentifier` as if it were the global hardware UUID.
- Mixing migration and normal items and expecting immediate migration.
- Calling `showPicker` without user context, or not bound to a button.

## Resources

**WWDC**: 2024-10203, 2024-10123, 2025-228

**Docs**: /accessorysetupkit, /accessorysetupkit/asaccessorysession, /accessorysetupkit/asdiscoverydescriptor, /accessorysetupkit/aspickerdisplayitem, /accessorysetupkit/asaccessory, /accessorysetupkit/asaccessoryevent, /accessorysetupkit/asmigrationdisplayitem

**Skills**: skills/accessorysetupkit-ref.md (full API surface), axiom-networking (CoreBluetooth / NetworkExtension communication), skills/privacy-ux.md (permission UX), axiom-security (accessory data handling)
