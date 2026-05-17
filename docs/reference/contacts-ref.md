---
name: contacts-ref
description: Complete Contacts, ContactsUI, and ContactProvider API reference — CNContactStore, key descriptors, CNMutableContact, CNSaveRequest, formatters, vCard, Contact Access Button, ContactProvider extensions, change history, error codes
---

# Contacts Reference

Complete API reference for the Contacts framework (programmatic access to the system contact database), ContactsUI (system view controllers for picking and displaying contacts), and ContactProvider (exposing your app's contacts to the system, iOS 18+).

**Platform**: iOS 9.0+, iPadOS 9.0+, macOS 10.11+, Mac Catalyst 13.1+, watchOS 2.0+, visionOS 1.0+

## When to Use This Reference

Use this reference when you need:
- The `CNContactStore` API surface (authorization, fetching, change tracking, save operations)
- `CNContact` key descriptors and the rule that you may only modify properties you fetched
- `CNMutableContact` construction and value-removal patterns
- `CNSaveRequest` for adding/updating/deleting contacts and groups
- `CNContactFormatter` and `CNContactVCardSerialization` APIs
- `CNContactPickerViewController` and `CNContactViewController` initialization and delegate methods
- `ContactAccessButton` (iOS 18+) and `contactAccessPicker` (iOS 18+) SwiftUI APIs
- The ContactProvider extension framework — `ContactProviderManager`, `ContactProviderExtension`, enumerators
- Change history (`CNChangeHistoryFetchRequest`, visitor protocol, drop-everything semantics)
- `CNError` codes for error handling
- Platform availability for each API

## Example Prompts

- "What's the signature of `enumerateContacts(with:)` and how do I stop iteration early?"
- "What's the difference between `CNContactGivenNameKey` and `CNContactFormatter.descriptorForRequiredKeys(for:)`?"
- "How do I use `CNSaveRequest` to delete a contact?"
- "What's the SwiftUI API for the Contact Access Button?"
- "How do I implement a ContactProvider extension?"
- "How do I detect contact changes since a previous sync?"
- "What `CNError` codes should I handle when saving?"
- "Which APIs are available on watchOS?"

## What's Covered

- **CNContactStore** — `authorizationStatus(for:)`, `requestAccess(for:)`, `unifiedContact(withIdentifier:keysToFetch:)`, `unifiedContacts(matching:keysToFetch:)`, `unifiedMeContact(withKeysToFetch:)`, `enumerateContacts(with:)`, container and group access, `currentHistoryToken`, `.CNContactStoreDidChange` notification
- **Built-in predicates** — `predicateForContacts(matchingName:)`, `predicateForContacts(matchingEmailAddress:)`, `predicateForContacts(matching:)` for phone numbers, `predicateForContacts(withIdentifiers:)`, in-group and in-container predicates
- **CNContact key descriptors** — `CNContactGivenNameKey`, `CNContactFamilyNameKey`, `CNContactPhoneNumbersKey`, `CNContactEmailAddressesKey`, `CNContactPostalAddressesKey`, image keys; `CNContactFormatter.descriptorForRequiredKeys(for:)` for locale-correct name formatting
- **CNMutableContact** — value construction (`CNLabeledValue`), removing fields by assigning empty arrays, thread-safety constraint
- **CNSaveRequest** — `add(_:toContainerWithIdentifier:)`, `update(_:)`, `delete(_:)` for contacts; analogous group operations; transaction-author and shouldRefetchContacts properties
- **CNContactFormatter** — styles (`.fullName`, `.phoneticFullName`, `.givenNameFamilyName`, etc.) and required-keys descriptor pattern
- **CNContactVCardSerialization** — encoding/decoding vCard data
- **ContactsUI controllers** — `CNContactPickerViewController` delegate, `CNContactViewController` modes (new/unknown/contact)
- **Contact Access Button (iOS 18+)** — `ContactAccessButton(queryString:)` SwiftUI view, customization modifiers (`.contactAccessButtonCaption`, `.contactAccessButtonStyle`), security requirements for legibility and obstruction
- **contactAccessPicker (iOS 18+)** — bulk contact selection under limited access
- **ContactProvider framework (iOS 18+)** — architecture, `ContactProviderManager` for main-app enable/signal flow, `ContactProviderExtension` protocol, enumerator pattern, App Group requirement, ContactProvider errors
- **Change history (TN3149)** — `CNChangeHistoryFetchRequest`, `CNChangeHistoryEventVisitor` protocol, the `DropEverything` → re-sync semantics, token persistence
- **Error reference** — `CNError` codes (`communicationError`, `dataAccessError`, `authorizationDenied`, `recordDoesNotExist`, `vCardMalformed`, etc.)
- **Platform availability matrix** — which APIs are available on iOS, macOS, watchOS, visionOS, and at which OS versions

## Documentation Scope

This page documents the `contacts-ref` skill — the API reference half of the Contacts pair.

- For **access-level decisions, permission UX, and pressure scenarios**, see [eventkit-contacts](/skills/integration/eventkit-contacts)
- For **general permission UX patterns** (just-in-time prompts, denial handling), see [privacy-ux](/skills/integration/privacy-ux)
- For **calendar and reminder APIs**, see [eventkit-ref](/reference/eventkit-ref)

## Resources

**WWDC**: 2024-10121

**Docs**: /contacts, /contactsui, /contactprovider, /technotes/tn3149
