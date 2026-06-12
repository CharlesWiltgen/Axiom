
# AccessorySetupKit — API Reference

Comprehensive API reference for AccessorySetupKit: the session, discovery descriptors, picker items, events, accessories, and the post-pairing authorization flow. For the discipline (the three-stage model, gotchas, debugging), see `skills/accessorysetupkit.md`.

## Key Terminology

- **ASAccessorySession** — Central object; displays the picker, delivers events, manages accessories.
- **ASDiscoveryDescriptor** — Rules describing what the picker scans for (Bluetooth/Wi-Fi).
- **ASPickerDisplayItem** — One accessory variant to show in the picker (name, image, descriptor).
- **ASAccessory** — A paired accessory and its scoped identifiers.
- **ASAccessoryEvent** — Delivered to the session's event handler (`eventType`, `accessory`, `error`).
- **ASAccessorySettings** — Configuration applied when finishing a multi-step authorization.

Availability: iOS 18.0+, iPadOS 18.0+. No macOS / watchOS / tvOS. Bluetooth HID accessories iOS 18.4+. Wi-Fi Aware descriptor fields iOS 26.0+. Channel Sounding (Part 7) iOS 27.0+.

---

# Part 1: ASAccessorySession

```swift
let session = ASAccessorySession()

session.activate(on: DispatchQueue.main) { (event: ASAccessoryEvent) in /* ... */ }

session.showPicker(for: [pickerItem]) { (error: Error?) in /* ... */ }

// Multi-step authorization (accessories needing post-pairing setup — see Part 5)
session.finishAuthorization(for: accessory, settings: settings) { error in /* ... */ }
session.failAuthorization(for: accessory) { error in /* ... */ }

// Upgrade an authorized accessory's permissions (e.g. add Wi-Fi) with a broader descriptor
session.updateAuthorization(for: accessory, descriptor: broaderDescriptor) { error in /* ... */ }

// Lifecycle management
session.removeAccessory(accessory) { error in /* ... */ }
session.renameAccessory(accessory, options: []) { error in /* ... */ }   // ASAccessory.RenameOptions

session.accessories   // [ASAccessory] — previously paired accessories for this app
```

`activate(on:eventHandler:)` must complete (the `.activated` event) before reading `accessories` or calling `showPicker`.

---

# Part 2: ASDiscoveryDescriptor

A descriptor needs **at least one** of `bluetoothServiceUUID` or `bluetoothCompanyIdentifier`. Everything else refines the match.

```swift
let d = ASDiscoveryDescriptor()

// Bluetooth (one of the first two is required)
d.bluetoothServiceUUID = CBUUID(string: "FFF0")
d.bluetoothCompanyIdentifier = 0x004C
d.bluetoothNameSubstring = "Dice"
d.bluetoothManufacturerDataBlob = manufacturerData       // with matching mask
d.bluetoothManufacturerDataMask = manufacturerMask
d.bluetoothServiceDataBlob = serviceData
d.bluetoothServiceDataMask = serviceMask
d.bluetoothRange = .default                              // ASDiscoveryDescriptor.Range

// Wi-Fi
d.ssid = "MyAccessoryNet"
d.ssidPrefix = "Accessory-"

// Wi-Fi Aware (iOS 26+)
d.wifiAwareServiceName = "_service._udp"
d.wifiAwareServiceRole = .subscriber
d.wifiAwareModelNameMatch = .init(/* ... */)
d.wifiAwareVendorNameMatch = .init(/* ... */)

d.supportedOptions = []                                  // ASAccessory.SupportOptions (e.g. .bluetoothPairingLE, .bluetoothHID)
```

Every UUID, company identifier, and name used here must also appear in the matching `NSAccessorySetup*` Info.plist array (Part 6) or discovery returns nothing.

---

# Part 3: Picker items

```swift
let item = ASPickerDisplayItem(name: "Pink Dice", productImage: image, descriptor: descriptor)
item.setupOptions = []        // ASPickerDisplayItem.SetupOptions — drives the confirmation + in-app-finish flow
item.renameOptions = []       // ASAccessory.RenameOptions

// Migration of an already-paired accessory (subclass of ASPickerDisplayItem)
let migration = ASMigrationDisplayItem(name: "My Sensor", productImage: image, descriptor: descriptor)
migration.peripheralIdentifier = knownPeripheralUUID    // CoreBluetooth peripheral UUID
migration.hotspotSSID = "MyAccessoryNet"                // Wi-Fi accessory
migration.wifiAwarePairedDeviceID = pairedID            // Wi-Fi Aware (iOS 26+)
```

`setupOptions` controls whether the system asks for an extra authorization confirmation and whether final setup happens in-app (which drives the Part 5 `finishAuthorization` flow).

---

# Part 4: Events and accessories

```swift
// ASAccessoryEvent
event.eventType   // ASAccessoryEvent.EventType
event.accessory   // ASAccessory?
event.error       // Error?
```

`EventType` cases you'll handle most often: `.activated`, `.accessoryAdded`, `.accessoryChanged`, `.accessoryRemoved`, `.pickerDidPresent`, `.pickerDidDismiss`. The remaining cases are `.invalidated`, `.accessoryDiscovered`, `.migrationComplete`, `.pickerSetupBridging`, `.pickerSetupPairing`, `.pickerSetupFailed`, `.pickerSetupRename`, and `.unknown` — **always include a `default` case** so new cases don't break your switch.

```swift
// ASAccessory
accessory.displayName        // String
accessory.state              // ASAccessory.AccessoryState: .unauthorized | .awaitingAuthorization | .authorized
accessory.descriptor         // ASDiscoveryDescriptor
accessory.bluetoothIdentifier  // UUID? — per-app SCOPED id, not the hardware UUID
accessory.ssid               // String?
```

Use `bluetoothIdentifier` with `CBCentralManager.retrievePeripherals(withIdentifiers:)` only within your app.

---

# Part 5: Post-pairing setup (multi-step authorization)

Some accessories aren't fully usable the instant the user taps the picker — a Wi-Fi accessory may need credentials, a bridged Bluetooth Classic accessory needs its transport identifier. For these, the accessory arrives in `.awaitingAuthorization`; you collect what you need in-app, then **finish** (or **fail**) the authorization.

```swift
// In your event handler, an accessory may be .awaitingAuthorization rather than .authorized
let settings = ASAccessorySettings.defaultSettings
settings.ssid = collectedHotspotSSID                        // Wi-Fi hotspot to join
settings.bluetoothTransportBridgingIdentifier = sixByteID   // bridge Bluetooth Classic profiles

session.finishAuthorization(for: accessory, settings: settings) { error in /* now authorized */ }
// or, if the user backs out / setup fails:
session.failAuthorization(for: accessory) { error in /* ... */ }
```

`ASAccessorySettings` properties: `ssid` (hotspot to connect to), `bluetoothTransportBridgingIdentifier` (6-byte classic-transport bridge ID), and the `defaultSettings` empty settings object (the class accessor — `ASAccessorySettings.default` does not exist). Separately, `updateAuthorization(for:descriptor:)` **upgrades an authorized accessory's permissions** — e.g. grant Wi-Fi to a Bluetooth-only accessory by passing a broader `ASDiscoveryDescriptor` (it does not mutate `ASAccessorySettings`).

---

# Part 6: Info.plist keys

| Key | Value |
|-----|-------|
| `NSAccessorySetupSupports` | array of `"Bluetooth"` / `"WiFi"` |
| `NSAccessorySetupBluetoothServices` | array of service UUID strings |
| `NSAccessorySetupBluetoothCompanyIdentifiers` | array of company-ID numbers |
| `NSAccessorySetupBluetoothNames` | array of name strings |

Every value referenced by an `ASDiscoveryDescriptor` must be declared here.

---

# Part 7: Channel Sounding — measure distance to a paired accessory `iOS27`

Once an accessory is paired through AccessorySetupKit and connected over CoreBluetooth (Part 3 of `skills/accessorysetupkit.md`), **Bluetooth Channel Sounding** measures the *actual* distance to it — a real measurement, not an RSSI estimate. The iPhone (the **initiator**) exchanges tones with the accessory (the **reflector**) across the 2.4 GHz band and derives distance from how the signal's phase changes from one channel to the next; each measurement is a *procedure*. ("Reflector" is the accessory's protocol role, not an SDK `Role` case — the config exposes only `.initiator`.)

Requires an iPhone with the **N1 chip**, a foreground app (the session pauses when the app backgrounds on iOS 27), and accessory hardware supporting Bluetooth 6.3 with inline PCT, phase-ranging modes 0 and 2, and a T_FCS of at least 100 µs. iOS only — `API_UNAVAILABLE` on macOS, watchOS, tvOS, visionOS.

## Distance only — CoreBluetooth

```swift
import CoreBluetooth

// 1. Gate on hardware + region support (central must be .poweredOn first)
guard CBCentralManager.supports(.channelSounding) else { return }   // CBCentralManager.Feature

// 2. Start a session on an already-connected CBPeripheral
let config = CBChannelSoundingSessionConfiguration(role: .initiator)   // .initiator is the only Role case in this SDK
peripheral.startChannelSoundingSession(config)

// 3. Each completed procedure delivers a distance in meters
func peripheral(_ peripheral: CBPeripheral,
                didReceiveChannelSoundingProcedureResults results: CBChannelSoundingProcedureResults?,
                error: Error?) {
    guard let results else { return }
    let meters = results.distance      // Double
}

// 4. Stop — cancelChannelSoundingSession takes NO argument
peripheral.cancelChannelSoundingSession()

func peripheral(_ peripheral: CBPeripheral,
                didCompleteChannelSoundingSession error: Error?) { /* session ended */ }
```

iOS keeps running procedures until you cancel; it filters outliers and smooths the stream, and may lower measurement frequency when other Bluetooth/Wi-Fi traffic is heavy. Failures surface as `CBError.channelSoundingConfigurationFailed` or `CBError.channelSoundingProcedureFailed`.

## Distance + direction — Nearby Interaction

For direction as well as distance, hand the same paired peripheral to a `NISession` (NearbyInteraction). Direction additionally needs camera assistance.

```swift
import NearbyInteraction

guard NISession.deviceCapabilities.supportsBluetoothChannelSounding else { return }   // iOS 27

let config = NINearbyAccessoryConfiguration(
    bluetoothChannelSoundingIdentifier: peripheral.identifier,   // the CoreBluetooth peripheral UUID
    previousBluetoothIdentifier: nil)                            // non-nil only to resume across reconnects
if NISession.deviceCapabilities.supportsCameraAssistance {
    config.isCameraAssistanceEnabled = true                     // required for direction
}

let session = NISession()
session.delegate = self
session.run(config)
// Hint motion for better direction: session.updateMotionState(.stationary, forObjectWithToken: object.discoveryToken)
// session(_:didUpdate:) delivers NINearbyObject .distance and .horizontalAngle (both optional — nil on a failed measurement)
```

NearbyInteraction has no other Axiom coverage; this is the AccessorySetupKit-adjacent ranging path only. For full UWB Nearby Interaction, see WWDC's "Explore Nearby Interaction with third-party accessories".

---

## Resources

**WWDC**: 2024-10203, 2024-10123, 2025-228, 2026-369

**Docs**: /accessorysetupkit, /accessorysetupkit/asaccessorysession, /accessorysetupkit/asdiscoverydescriptor, /accessorysetupkit/aspickerdisplayitem, /accessorysetupkit/asmigrationdisplayitem, /accessorysetupkit/asaccessory, /accessorysetupkit/asaccessoryevent, /accessorysetupkit/asaccessorysettings, /corebluetooth/cbchannelsoundingsessionconfiguration, /corebluetooth/cbchannelsoundingprocedureresults

**Skills**: skills/accessorysetupkit.md, axiom-networking (CoreBluetooth / NetworkExtension), skills/privacy-ux.md
