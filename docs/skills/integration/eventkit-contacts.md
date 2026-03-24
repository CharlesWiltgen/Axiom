---
name: eventkit-contacts
description: Calendar events, reminders, and contacts skill suite
skill_type: suite
version: 1.0
apple_platforms: iOS 4+, iPadOS 4+, macOS 10.8+, watchOS 2+
---

# EventKit & Contacts

Four skills covering calendar events, reminders, and contact access for iOS. Built around the permission models that changed significantly in iOS 17 (EventKit) and iOS 18 (Contacts).

## Skills in This Suite

| Skill | Type | What It Covers |
|-------|------|----------------|
| **axiom-eventkit** | Discipline | Access tier decision tree, permission model, EventKitUI patterns, reminder patterns, store lifecycle, migration, pressure scenarios |
| **axiom-eventkit-ref** | Reference | EKEventStore, EKEvent, EKReminder, EKAlarm, EKRecurrenceRule, EventKitUI controllers, Siri Event Suggestions, virtual conference extensions, error codes |
| **axiom-contacts** | Discipline | Access level decision tree, Contact Access Button, picker vs store decisions, key fetching discipline, ContactProvider, pressure scenarios |
| **axiom-contacts-ref** | Reference | CNContactStore, CNMutableContact, CNSaveRequest, CNContactFormatter, ContactsUI, ContactProvider, change history sync, error codes |

## When to Use

**EventKit skills** when you're:
- Adding events to the user's calendar
- Creating or managing reminders
- Choosing between EventKitUI, write-only, or full access
- Migrating from pre-iOS 17 permission APIs
- Implementing Siri Event Suggestions or virtual conference extensions

**Contacts skills** when you're:
- Reading or writing contacts
- Choosing between picker, Contact Access Button, or full store access
- Implementing contact search or selection UIs
- Migrating to iOS 18 limited access
- Building a Contact Provider extension

## Example Prompts

- "How do I add an event to the user's calendar?"
- "What's the difference between write-only and full Calendar access?"
- "How do I create reminders programmatically?"
- "How do I let users pick a contact in SwiftUI?"
- "What's the Contact Access Button and when should I use it?"
- "How do I implement Siri Event Suggestions for restaurant reservations?"
- "How do I handle iOS 18 limited contact access?"
- "How do I detect contact changes for sync?"

## Key Concepts

### EventKit: Three Access Tiers

Most apps only need **Tier 1** — zero permission prompts.

| Tier | Method | Use Case |
|------|--------|----------|
| No access | `EKEventEditViewController` | Add single events via system UI (iOS 17+ out-of-process) |
| No access | Siri Event Suggestions | Reservation-style events (restaurant, flight, hotel) |
| Write-only | `requestWriteOnlyAccessToEvents()` | Custom UI, batch saves, silent creation |
| Full access | `requestFullAccessToEvents()` | Read, modify, delete existing events |
| Full access | `requestFullAccessToReminders()` | All reminder operations (no write-only tier) |

### Contacts: Four Authorization Levels

Most apps should use **Contact Access Button** or **CNContactPickerViewController** — no authorization needed.

| Level | Behavior |
|-------|----------|
| Not Determined | ContactAccessButton works — auto-triggers simplified prompt on tap |
| Limited (iOS 18+) | App sees only user-selected contacts. Same API surface, different visibility. |
| Full | Read/write all contacts. Reserve for apps where contacts are the core feature. |
| Denied | No access to contact data. |

### Key Pattern: Adding a Calendar Event (Zero Permissions)

```swift
let store = EKEventStore()
let event = EKEvent(eventStore: store)
event.title = "Team Standup"
event.startDate = startDate
event.endDate = Calendar.current.date(byAdding: .hour, value: 1, to: startDate) ?? startDate

let editVC = EKEventEditViewController()
editVC.event = event
editVC.eventStore = store
editVC.editViewDelegate = self
present(editVC, animated: true)  // No permission prompt needed
```

### Key Pattern: Contact Access Button (iOS 18+)

```swift
ContactAccessButton(queryString: searchText) { identifiers in
    let contacts = await fetchContacts(withIdentifiers: identifiers)
}
```

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Requesting full Calendar access for "add to calendar" | 30%+ denial rate | Use EventKitUI (zero permissions) |
| Calling deprecated `requestAccess(to:)` on iOS 17 | Throws error, no prompt | Use `requestFullAccessToEvents()` |
| Missing Info.plist key on iOS 17+ | Silent denial | Add `NSCalendarsFullAccessUsageDescription` |
| Accessing unfetched key on CNContact | Crash | Always specify `keysToFetch` |
| Using CNContactStore for one-time picking | Unnecessary permission prompt | Use CNContactPickerViewController |
| Ignoring `.limited` contact status | "Missing contacts" bug | Show ContactAccessButton |

## Related

- [extensions-widgets](/skills/integration/extensions-widgets) — If combining calendar data with widgets
- [privacy-ux](/reference/privacy-ux) — General iOS privacy and permission UX patterns
- [background-processing](/skills/integration/background-processing) — If scheduling background calendar sync

## Resources

**WWDC**: 2023-10052, 2024-10121, 2020-10197

**Docs**: /eventkit, /eventkitui, /contacts, /contactsui, /contactprovider, /technotes/tn3152, /technotes/tn3153, /technotes/tn3149
