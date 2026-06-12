---
name: accessorysetupkit
description: Privacy-friendly one-tap Bluetooth and Wi-Fi accessory pairing without a broad Bluetooth permission prompt
skill_type: skill
version: 1.0
apple_platforms: iOS 18+, iPadOS 18+
---

# AccessorySetupKit

AccessorySetupKit (iOS/iPadOS 18+) replaces the old "request broad Bluetooth permission, then scan for everything" flow with a one-tap, privacy-preserving picker. Your app declares which accessories it can pair with; the system runs the scan out-of-process and shows a picker with your artwork. One tap grants scoped Bluetooth **and** Wi-Fi access to that single accessory — with no broad Bluetooth permission prompt.

Part of the **axiom-integration** suite (`skills/accessorysetupkit.md` and `skills/accessorysetupkit-ref.md`).

## When to Use

Use this skill when you're:
- Pairing a Bluetooth and/or Wi-Fi hardware accessory (wearable, sensor, smart-home device, toy)
- Replacing a `CBCentralManager`-scans-everything setup flow with the system picker
- Migrating accessories your app already manages onto the new permission model
- Wanting Bluetooth + Wi-Fi access from a single one-tap setup

## Example Prompts

- "How do I pair a Bluetooth accessory without the permission prompt?"
- "Why is my AccessorySetupKit picker showing no devices?"
- "How do I use AccessorySetupKit with CoreBluetooth?"
- "How do I measure the distance to a paired accessory with Bluetooth Channel Sounding? (iOS 27)"
- "How do I migrate my existing paired accessories to AccessorySetupKit?"
- "What Info.plist keys does AccessorySetupKit need?"

## Key Concepts

### Three stages, two owned by the framework

Discovery and authorization are handled by AccessorySetupKit; communication stays on CoreBluetooth / NetworkExtension. The picker runs out-of-process, so the user sees only the accessories you can pair, and your app never requests system-wide Bluetooth.

### Info.plist and descriptor must agree

The `NSAccessorySetupSupports` / `NSAccessorySetupBluetoothServices` / `...CompanyIdentifiers` / `...Names` arrays must list every UUID, company ID, or name your `ASDiscoveryDescriptor` uses — or the picker finds nothing. A descriptor needs at least one of `bluetoothServiceUUID` or `bluetoothCompanyIdentifier`; a name substring alone is rejected.

### Wait for `.activated`, then present

`ASAccessorySession.activate(on:eventHandler:)` is asynchronous. Don't read `accessories` or call `showPicker(for:)` until the `.activated` event arrives. Connection is driven by the `accessoryAdded` event, not a Bluetooth permission callback — there isn't one.

### Scoped identifiers

`ASAccessory.bluetoothIdentifier` is a per-app scoped UUID, not the real hardware UUID. Use it with `CBCentralManager.retrievePeripherals(withIdentifiers:)`; don't compare it across apps.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Descriptor with only a name substring | Rejected | Add a service UUID or company ID |
| Info.plist doesn't match descriptors | Empty picker | List every UUID/company/name |
| Acting before `.activated` | No accessories, no picker | Wait for the activated event |
| Expecting a Bluetooth prompt | Connection logic never runs | Drive off `accessoryAdded` |
| Mixing migration + normal items | Migration deferred | Pass only migration items to migrate now |

## Related

- For CoreBluetooth / NetworkExtension communication after pairing, see the axiom-networking suite
- [Privacy UX](/skills/integration/privacy-ux) — Permission-prompt patterns this flow avoids

## Resources

**WWDC**: 2024-10203, 2024-10123, 2025-228

**Docs**: /accessorysetupkit, /accessorysetupkit/asaccessorysession, /accessorysetupkit/asdiscoverydescriptor, /accessorysetupkit/aspickerdisplayitem, /accessorysetupkit/asaccessory, /accessorysetupkit/asmigrationdisplayitem
