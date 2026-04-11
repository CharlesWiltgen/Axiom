
# Contacts API Reference

## Overview

The Contacts framework provides programmatic access to the system contact database. ContactsUI provides system view controllers for contact selection and display. ContactProvider enables apps to expose their own contacts to the system.

**Platform**: iOS 9.0+, iPadOS 9.0+, macOS 10.11+, Mac Catalyst 13.1+, watchOS 2.0+, visionOS 1.0+

---

# Part 1: CNContactStore

The primary gateway for contact data. "Fetch methods perform I/O — avoid using the main thread."

## Authorization

```swift
// Check status (static method)
let status = CNContactStore.authorizationStatus(for: .contacts)
// Returns: .notDetermined, .restricted, .denied, .authorized, .limited (iOS 18+)

// Request access
let store = CNContactStore()
try await store.requestAccess(for: .contacts)  // Returns Bool
```

**Info.plist required**: `NSContactsUsageDescription` (crash without it).

**Special entitlement**: `com.apple.developer.contacts.notes` — required to read/write `note` field. Requires Apple approval.

## Fetching Contacts

```swift
// Single contact by identifier
let contact = try store.unifiedContact(
    withIdentifier: identifier,
    keysToFetch: keys
)

// Search by predicate
let contacts = try store.unifiedContacts(
    matching: predicate,
    keysToFetch: keys
)

// Current user's card
let me = try store.unifiedMeContact(withKeysToFetch: keys)

// Memory-efficient enumeration
let request = CNContactFetchRequest(keysToFetch: keys)
request.predicate = predicate  // Optional filter
request.sortOrder = .userDefault  // .none, .givenName, .familyName, .userDefault
try store.enumerateContacts(with: request) { contact, stop in
    // stop.pointee = true to break early
}
```

## Built-in Predicates

```swift
CNContact.predicateForContacts(matchingName: "John")
CNContact.predicateForContacts(matchingEmailAddress: "john@example.com")
CNContact.predicateForContacts(matching: CNPhoneNumber(stringValue: "+1555..."))
CNContact.predicateForContacts(withIdentifiers: [id1, id2])
CNContact.predicateForContactsInGroup(withIdentifier: groupId)
CNContact.predicateForContactsInContainer(withIdentifier: containerId)
```

## Containers and Groups

```swift
store.containers(matching: predicate)     // [CNContainer]
store.groups(matching: predicate)         // [CNGroup]
store.defaultContainerIdentifier          // String (property, not method)
```

**CNContainer types**: `.local`, `.exchange`, `.cardDAV`, `.unassigned`

## Change Tracking

```swift
store.currentHistoryToken  // Data? — save for incremental sync
```

## Change Notification

```swift
NotificationCenter.default.addObserver(
    forName: .CNContactStoreDidChange, object: nil, queue: .main
) { _ in
    // Refetch visible contacts
}
```

## Save Operations

```swift
let saveRequest = CNSaveRequest()
saveRequest.add(contact, toContainerWithIdentifier: nil)  // nil = default
saveRequest.update(contact)
saveRequest.delete(contact.mutableCopy() as! CNMutableContact)
try store.execute(saveRequest)
```

---

# Part 2: CNContact Key Descriptors

You MUST specify which properties to fetch. Accessing an unfetched property throws `CNContactPropertyNotFetchedException`.

## Common Key Constants

| Key | Property |
|-----|----------|
| `CNContactIdentifierKey` | `identifier` |
| `CNContactGivenNameKey` | `givenName` |
| `CNContactFamilyNameKey` | `familyName` |
| `CNContactMiddleNameKey` | `middleName` |
| `CNContactNamePrefixKey` | `namePrefix` |
| `CNContactNameSuffixKey` | `nameSuffix` |
| `CNContactNicknameKey` | `nickname` |
| `CNContactOrganizationNameKey` | `organizationName` |
| `CNContactJobTitleKey` | `jobTitle` |
| `CNContactDepartmentNameKey` | `departmentName` |
| `CNContactPhoneNumbersKey` | `phoneNumbers` |
| `CNContactEmailAddressesKey` | `emailAddresses` |
| `CNContactPostalAddressesKey` | `postalAddresses` |
| `CNContactUrlAddressesKey` | `urlAddresses` |
| `CNContactSocialProfilesKey` | `socialProfiles` |
| `CNContactInstantMessageAddressesKey` | `instantMessageAddresses` |
| `CNContactBirthdayKey` | `birthday` |
| `CNContactNonGregorianBirthdayKey` | `nonGregorianBirthday` |
| `CNContactDatesKey` | `dates` |
| `CNContactNoteKey` | `note` (requires entitlement) |
| `CNContactImageDataKey` | `imageData` |
| `CNContactThumbnailImageDataKey` | `thumbnailImageData` |
| `CNContactImageDataAvailableKey` | `imageDataAvailable` |
| `CNContactRelationsKey` | `contactRelations` |
| `CNContactTypeKey` | `contactType` (.person, .organization) |

## Convenience Descriptors

```swift
// All keys needed for name display (locale-aware)
CNContactFormatter.descriptorForRequiredKeys(for: .fullName)
CNContactFormatter.descriptorForRequiredKeys(for: .phoneticFullName)

// All keys needed for vCard export
CNContactVCardSerialization.descriptorForRequiredKeys()
```

**Always prefer formatter descriptors** over manual key lists for name display.

---

# Part 3: CNMutableContact

Mutable subclass of `CNContact`. **Not thread-safe** — use immutable `CNContact` for cross-thread access.

## Creating a Contact

```swift
let contact = CNMutableContact()
contact.givenName = "Jane"
contact.familyName = "Appleseed"
contact.organizationName = "Apple Inc."
contact.jobTitle = "Engineer"

// Phone numbers
contact.phoneNumbers = [
    CNLabeledValue(label: CNLabelPhoneNumberMobile,
                   value: CNPhoneNumber(stringValue: "+15551234567")),
    CNLabeledValue(label: CNLabelWork,
                   value: CNPhoneNumber(stringValue: "+15559876543"))
]

// Email addresses
contact.emailAddresses = [
    CNLabeledValue(label: CNLabelHome, value: "jane@example.com" as NSString),
    CNLabeledValue(label: CNLabelWork, value: "jane@apple.com" as NSString)
]

// Postal addresses
let address = CNMutablePostalAddress()
address.street = "1 Apple Park Way"
address.city = "Cupertino"
address.state = "CA"
address.postalCode = "95014"
address.country = "United States"
contact.postalAddresses = [CNLabeledValue(label: CNLabelWork, value: address)]

// Birthday
contact.birthday = DateComponents(year: 1990, month: 6, day: 15)

// Photo
contact.imageData = imageData
```

## Removing Values

Set strings/arrays to empty, other properties to `nil`.

## Constraint

"You may modify only those properties whose values you fetched from the contacts database."

---

# Part 4: CNSaveRequest

Batch operations for contacts, groups, and subgroups.

**Platform**: iOS 9.0+, iPadOS 9.0+, macOS 10.11+, Mac Catalyst 13.1+ (no watchOS)

## Contact Operations

```swift
let request = CNSaveRequest()
request.add(contact, toContainerWithIdentifier: containerId)  // nil = default
request.update(contact)
request.delete(contact)
```

## Group Operations

```swift
request.add(group, toContainerWithIdentifier: containerId)
request.update(group)
request.delete(group)
request.addMember(contact, to: group)
request.removeMember(contact, from: group)
request.addSubgroup(subgroup, to: parentGroup)
request.removeSubgroup(subgroup, from: parentGroup)
```

## Properties

| Property | Type | Notes |
|----------|------|-------|
| `shouldRefetchContacts` | `Bool` | Refetch added/updated contacts post-execution |
| `transactionAuthor` | `String?` | Identifies who made the change (for change history filtering) |

## Execution

```swift
try store.execute(request)
```

**Concurrency**: "Last change wins" for overlapping concurrent changes.

---

# Part 5: CNContactFormatter

Locale-aware name formatting.

```swift
let formatter = CNContactFormatter()

// Format name
let name = formatter.string(from: contact)  // String?
let name = CNContactFormatter.string(from: contact, style: .fullName)

// Attributed string variants
let attributed = formatter.attributedString(from: contact)

// Locale information
let order = CNContactFormatter.nameOrder(for: contact)  // .givenNameFirst, .familyNameFirst
let delimiter = CNContactFormatter.delimiter(for: contact)  // Locale-appropriate separator
```

## Styles

| Style | Example |
|-------|---------|
| `.fullName` | "Jane Appleseed" or "Appleseed Jane" (per locale) |
| `.phoneticFullName` | Phonetic representation |

---

# Part 6: CNContactVCardSerialization

```swift
// Export contacts to vCard data
let data = try CNContactVCardSerialization.data(with: contacts)

// Import contacts from vCard data
let contacts = try CNContactVCardSerialization.contacts(with: data)

// Required keys for export
let keys = CNContactVCardSerialization.descriptorForRequiredKeys()
```

---

# Part 7: ContactsUI

## CNContactPickerViewController (iOS 9+)

Lets users pick contacts **without requiring app-level authorization**. App receives one-time snapshot.

```swift
let picker = CNContactPickerViewController()
picker.delegate = self
picker.displayedPropertyKeys = [CNContactPhoneNumbersKey, CNContactEmailAddressesKey]
present(picker, animated: true)
```

### Predicates (set BEFORE presentation)

```swift
// Which contacts are selectable
picker.predicateForEnablingContact = NSPredicate(
    format: "phoneNumbers.@count > 0"
)

// Auto-select whole contact (skip property selection)
picker.predicateForSelectionOfContact = NSPredicate(
    format: "emailAddresses.@count > 0"
)

// Which properties can be selected individually
picker.predicateForSelectionOfProperty = NSPredicate(
    format: "key == 'phoneNumbers'"
)
```

**Gotcha**: Changing predicates only takes effect before the view is presented.

### Delegate (CNContactPickerDelegate)

```swift
func contactPicker(_ picker: CNContactPickerViewController,
                   didSelect contact: CNContact) { }
func contactPicker(_ picker: CNContactPickerViewController,
                   didSelect contacts: [CNContact]) { }  // Multi-selection
func contactPicker(_ picker: CNContactPickerViewController,
                   didSelect contactProperty: CNContactProperty) { }
func contactPickerDidCancel(_ picker: CNContactPickerViewController) { }
```

## CNContactViewController (iOS 9+)

Display a single contact with three initialization modes:

```swift
// Existing contact
let vc = CNContactViewController(for: contact)

// Unknown contact (partial data)
let vc = CNContactViewController(forUnknownContact: partialContact)

// New contact
let vc = CNContactViewController(forNewContact: nil)

// Display mode
vc.allowsEditing = true
vc.allowsActions = true  // Call, message, email buttons
vc.displayedPropertyKeys = [CNContactPhoneNumbersKey]
vc.highlightProperty(withKey: CNContactPhoneNumbersKey, identifier: nil)
```

---

# Part 8: Contact Access Button (iOS 18+)

SwiftUI component for privacy-conscious contact access.

```swift
ContactAccessButton(queryString: searchText) { identifiers in
    let contacts = await fetchContacts(withIdentifiers: identifiers)
}
```

### Caption Options

| Value | Shows |
|-------|-------|
| `.defaultText` | Default text |
| `.email` | Email address |
| `.phone` | Phone number |

### Modifiers

```swift
.font(.system(weight: .bold))
.foregroundStyle(.gray)
.tint(.green)
.contactAccessButtonCaption(.phone)
.contactAccessButtonStyle(ContactAccessButton.Style(imageWidth: 30))
```

### Security

Button only grants access when:
- **Legible**: Sufficient contrast between text and background
- **Unobstructed**: Entire button visible, not clipped
- **Validated tap**: Real user interaction, not simulated

---

# Part 9: contactAccessPicker (iOS 18+)

Modal sheet for managing limited access contact set. For bulk or non-immediate use cases.

```swift
@State private var isPresented = false

Button("Share More Contacts") {
    isPresented.toggle()
}
.contactAccessPicker(isPresented: $isPresented) { identifiers in
    // identifiers: [String] — newly permitted contacts only
    let contacts = await fetchContacts(withIdentifiers: identifiers)
}
```

**Difference from CNContactPickerViewController**: `contactAccessPicker` changes persistent access. `CNContactPickerViewController` provides one-time snapshots.

---

# Part 10: ContactProvider Framework (iOS 18+)

Enables apps to expose contacts to the system Contacts ecosystem from third-party sources.

## Architecture

1. **Main app** controls the extension via `ContactProviderManager`
2. **Extension** enumerates contacts to the system
3. Communication via **App Group** shared container

## ContactProviderManager (Main App Only)

```swift
let manager = try ContactProviderManager(domainIdentifier: "com.myapp.contacts")

try await manager.enable()            // Async — may prompt user
try await manager.disable()           // Deactivate
try await manager.reset()             // Clear all provider contacts
try await manager.invalidate()        // Terminate extension
try await manager.signalEnumerator(for: .default)  // Trigger enumeration

manager.isEnabled                     // Bool — activation state
```

**Cannot be used in app extensions** — main app only.

## ContactProviderExtension Protocol

```swift
@main
class Provider: ContactProviderExtension {
    func configure(for domain: ContactProviderDomain) {
        // Setup data access
    }

    func enumerator(for collection: ContactItem.Identifier)
        -> ContactItemEnumerator {
        return MyEnumerator()
    }

    func invalidate() async throws {
        // Cleanup
    }
}
```

**Info.plist**: Extension point `com.apple.contact.provider.extension`

## Enumeration

Two patterns:
1. **Content enumeration** — full initial sync via `ContactItemContentObserver`
2. **Change enumeration** — incremental updates via `ContactItemChangeObserver` and `ContactItemSyncAnchor`

```swift
class MyEnumerator: ContactItemEnumerator {
    func enumerateContent(
        in page: ContactItemPage,
        for observer: ContactItemContentObserver
    ) {
        let contact = CNMutableContact()
        contact.givenName = "Jane"
        contact.familyName = "Appleseed"
        let item = ContactItem.contact(contact, ContactItem.Identifier("jane-001"))
        observer.didEnumerate([item])
        observer.didFinishEnumeratingContent(upTo: generationMarker)
    }

    func enumerateChanges(
        startingAt anchor: ContactItemSyncAnchor,
        for observer: ContactItemChangeObserver
    ) {
        // Incremental updates since anchor
        observer.didFinishEnumeratingChanges(upTo: newAnchor)
    }
}
```

## ContactProvider Errors

| Code | Meaning |
|------|---------|
| `featureNotAvailable` | Framework not available |
| `deniedByUser` | User rejected |
| `extensionNotFound` | Extension not registered |
| `enumerationTimeout` | Extension too slow |
| `cannotEnumerate` | Enumeration failed |
| `pageExpired` | Content page expired |
| `changeAnchorExpired` | Sync anchor expired |
| `itemsLimitReached` | Too many contacts |

---

# Part 11: Change History (TN3149)

## CNChangeHistoryFetchRequest

```swift
let request = CNChangeHistoryFetchRequest()
request.startingToken = savedToken           // nil = full fetch
request.includeGroupChanges = false          // Default NO
request.mutableObjects = false               // Default NO
request.shouldUnifyResults = true            // Default YES
request.additionalContactKeyDescriptors = [
    CNContactFormatter.descriptorForRequiredKeys(for: .fullName)
]
request.excludedTransactionAuthors = [Bundle.main.bundleIdentifier!]
```

## CNChangeHistoryEventVisitor Protocol

```swift
// Required
func visit(_ event: CNChangeHistoryDropEverythingEvent)   // Full re-sync
func visit(_ event: CNChangeHistoryAddContactEvent)        // New contact
func visit(_ event: CNChangeHistoryUpdateContactEvent)     // Modified
func visit(_ event: CNChangeHistoryDeleteContactEvent)     // Deleted

// Optional (when includeGroupChanges = true)
func visit(_ event: CNChangeHistoryAddGroupEvent)
func visit(_ event: CNChangeHistoryUpdateGroupEvent)
func visit(_ event: CNChangeHistoryDeleteGroupEvent)
func visit(_ event: CNChangeHistoryAddMemberToGroupEvent)
func visit(_ event: CNChangeHistoryRemoveMemberFromGroupEvent)
func visit(_ event: CNChangeHistoryAddSubgroupToGroupEvent)
func visit(_ event: CNChangeHistoryRemoveSubgroupFromGroupEvent)
```

**Must use visitor pattern** — do NOT use `isKindOfClass:` to determine event type.

**Gotcha**: `enumeratorForChangeHistoryFetchRequest:error:` is **Objective-C only** — unavailable in Swift.

**Token expiration**: Returns `DropEverything` + `Add` events for all contacts — same code handles full and incremental sync.

**Transaction authors**: Use reverse-domain notation (bundle identifier). Filters results but doesn't provide attribution.

---

# Part 12: Error Reference

## CNError Codes

| Category | Code | Meaning |
|----------|------|---------|
| Authorization | `authorizationDenied` | No permission |
| Authorization | `featureDisabledByUser` | Feature turned off |
| Data | `recordDoesNotExist` | Contact/group deleted |
| Data | `recordNotWritable` | Read-only contact |
| Data | `insertedRecordAlreadyExists` | Duplicate insert |
| Validation | `validationTypeMismatch` | Wrong value type |
| Validation | `validationMultipleErrors` | Multiple validation failures |
| History | `changeHistoryExpired` | Sync token expired |
| History | `changeHistoryInvalidAnchor` | Bad sync anchor |
| History | `changeHistoryInvalidFetchRequest` | Invalid request |

Error `userInfo` provides: `affectedRecords`, `affectedRecordIdentifiers`, `keyPaths`.

---

# Part 13: Platform Availability

| API | iOS | macOS | watchOS | visionOS |
|-----|-----|-------|---------|----------|
| CNContactStore | 9.0+ | 10.11+ | 2.0+ | 1.0+ |
| Limited access | 18.0+ | — | — | — |
| CNContactPickerViewController | 9.0+ | (Catalyst 13.1+) | — | 1.0+ |
| CNContactViewController | 9.0+ | (Catalyst 13.1+) | — | 1.0+ |
| ContactAccessButton | 18.0+ | — | — | — |
| contactAccessPicker | 18.0+ | — | — | — |
| ContactProvider | 18.0+ | — | — | — |
| CNChangeHistoryFetchRequest | 13.0+ | 10.15+ | — | 1.0+ |
| CNSaveRequest | 9.0+ | 10.11+ | — | 1.0+ |

---

## Resources

**WWDC**: 2024-10121

**Docs**: /contacts, /contacts/cncontactstore, /contacts/cnmutablecontact, /contactsui, /contactsui/cncontactpickerviewcontroller, /contactprovider, /technotes/tn3149

**Skills**: contacts, eventkit-ref, privacy-ux
