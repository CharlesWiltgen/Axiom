
# EventKit API Reference

## Overview

EventKit provides programmatic access to the Calendar and Reminders databases. EventKitUI provides system view controllers for calendar UI. This reference covers the complete API surface for both frameworks.

For access tier decision tree and best practices, see the **eventkit** discipline skill.

**Platform**: iOS 4.0+, iPadOS 4.0+, macOS 10.8+, Mac Catalyst 13.1+, watchOS 2.0+, visionOS 1.0+

---

# Part 1: EKEventStore

The central hub for all calendar and reminder operations. Create one per app and reuse it.

## Initialization

```swift
let store = EKEventStore()           // Standard
let store = EKEventStore(sources: [source])  // Scoped to specific sources
```

## Authorization (iOS 17+)

```swift
// Events
try await store.requestWriteOnlyAccessToEvents()  // Returns Bool
try await store.requestFullAccessToEvents()         // Returns Bool

// Reminders (full access only)
try await store.requestFullAccessToReminders()      // Returns Bool

// Check status
let status = EKEventStore.authorizationStatus(for: .event)  // Static method
// Returns: .notDetermined, .restricted, .denied, .fullAccess, .writeOnly
// Deprecated: .authorized (maps to .fullAccess conceptually)
```

## Info.plist Keys

| Key | When Required |
|-----|---------------|
| `NSCalendarsWriteOnlyAccessUsageDescription` | Write-only access, iOS 17+ |
| `NSCalendarsFullAccessUsageDescription` | Full event access, iOS 17+ |
| `NSRemindersFullAccessUsageDescription` | Reminder access, iOS 17+ |
| `NSCalendarsUsageDescription` | Calendar access, iOS 10-16 (keep for backward compat) |
| `NSRemindersUsageDescription` | Reminder access, iOS 10-16 (keep for backward compat) |
| `NSContactsUsageDescription` | Required if using EventKitUI on iOS <17 |

**Missing key on iOS 17+**: Silent denial (no prompt, no error, no crash).
**Missing key on iOS 10-16**: Crash.

## Calendar & Source Access

```swift
store.calendars(for: .event)              // [EKCalendar] — all event calendars
store.calendars(for: .reminder)           // [EKCalendar] — all reminder calendars
store.calendar(withIdentifier: id)        // EKCalendar?
store.defaultCalendarForNewEvents         // EKCalendar? — user's default
store.defaultCalendarForNewReminders()    // EKCalendar?
store.sources                             // [EKSource] — all accounts
store.delegateSources                     // [EKSource] — delegate accounts
```

## Calendar Management

```swift
try store.saveCalendar(calendar, commit: true)
try store.removeCalendar(calendar, commit: true)
```

## Event Operations

```swift
// Fetch by identifier
store.event(withIdentifier: id)           // EKEvent? — first occurrence for recurring
store.calendarItem(withIdentifier: id)    // EKCalendarItem? — event or reminder
store.calendarItems(withExternalIdentifier: extId)  // [EKCalendarItem]

// Save and remove
try store.save(event, span: .thisEvent, commit: true)
try store.remove(event, span: .thisEvent, commit: true)
// span: .thisEvent | .futureEvents (controls recurring event behavior)
```

## Event Fetching (Synchronous — run on background thread)

```swift
let predicate = store.predicateForEvents(
    withStart: startDate, end: endDate, calendars: nil  // nil = all calendars
)
let events = store.events(matching: predicate)
// Results are NOT sorted — sort manually:
let sorted = events.sorted { $0.compareStartDate(with: $1) == .orderedAscending }
```

**Only Apple-provided predicates work.** Custom `NSPredicate` instances are rejected.

## Reminder Fetching (Asynchronous)

```swift
// Predicates
store.predicateForReminders(in: calendars)  // nil = all
store.predicateForIncompleteReminders(
    withDueDateStarting: start, ending: end, calendars: nil
)
store.predicateForCompletedReminders(
    withCompletionDateStarting: start, ending: end, calendars: nil
)

// Fetch (async callback)
let fetchId = store.fetchReminders(matching: predicate) { reminders in
    // reminders: [EKReminder]?
}
store.cancelFetchRequest(fetchId)  // Cancel if needed
```

## Batch Operations

```swift
try store.save(event1, span: .thisEvent, commit: false)
try store.save(event2, span: .thisEvent, commit: false)
try store.commit()    // Atomic commit
store.reset()         // Rollback on failure
```

## Change Notifications

```swift
NotificationCenter.default.addObserver(
    self, selector: #selector(storeChanged),
    name: .EKEventStoreChanged, object: store
)
// Posted when external processes modify the calendar database
// Call event.refresh() on cached objects — returns false if deleted
```

---

# Part 2: EKEvent

Represents a calendar event. Inherits from `EKCalendarItem`.

## Creation

```swift
let event = EKEvent(eventStore: store)
```

## Key Properties

| Property | Type | Notes |
|----------|------|-------|
| `title` | `String` | Required for save |
| `startDate` | `Date` | Required for save |
| `endDate` | `Date` | Required for save |
| `calendar` | `EKCalendar` | Required for direct save (not EventKitUI) |
| `isAllDay` | `Bool` | |
| `timeZone` | `TimeZone?` | Defaults to system time zone |
| `location` | `String?` | Full address enables Maps features |
| `structuredLocation` | `EKStructuredLocation?` | Geo-precise location |
| `notes` | `String?` | |
| `url` | `URL?` | |
| `eventIdentifier` | `String` | Stable across fetches |
| `status` | `EKEventStatus` | `.none`, `.confirmed`, `.tentative`, `.canceled` |
| `availability` | `EKEventAvailability` | `.notSupported` (default), `.busy`, `.free`, `.tentative`, `.unavailable` |
| `occurrenceDate` | `Date` | For recurring event instances |
| `isDetached` | `Bool` | True if modified from recurring series |
| `organizer` | `EKParticipant?` | Read-only |
| `birthdayContactIdentifier` | `String?` | For birthday calendar events |

## Inherited from EKCalendarItem

| Property | Type | Notes |
|----------|------|-------|
| `calendarItemIdentifier` | `String` | Unique identifier |
| `calendarItemExternalIdentifier` | `String` | External (sync) identifier |
| `creationDate` | `Date?` | |
| `lastModifiedDate` | `Date?` | |
| `alarms` | `[EKAlarm]?` | |
| `recurrenceRules` | `[EKRecurrenceRule]?` | |
| `hasAlarms` | `Bool` | |
| `hasRecurrenceRules` | `Bool` | |
| `attendees` | `[EKParticipant]?` | Read-only |

## Methods

```swift
event.compareStartDate(with: otherEvent)  // ComparisonResult
event.refresh()                            // Bool — false if deleted
```

---

# Part 3: EKReminder

Represents a reminder. Inherits from `EKCalendarItem`.

## Creation

```swift
let reminder = EKReminder(eventStore: store)
reminder.title = "Review PR"
reminder.calendar = store.defaultCalendarForNewReminders()  // Required
```

## Key Properties

| Property | Type | Notes |
|----------|------|-------|
| `startDateComponents` | `DateComponents?` | Task start |
| `dueDateComponents` | `DateComponents?` | Due date — use `DateComponents`, NOT `Date` |
| `isCompleted` | `Bool` | Setting true auto-populates `completionDate` |
| `completionDate` | `Date?` | Auto-set when `isCompleted = true` |
| `priority` | `Int` | Use `EKReminderPriority` raw values |

## EKReminderPriority

| Case | Raw Value |
|------|-----------|
| `.none` | 0 |
| `.high` | 1 |
| `.medium` | 5 |
| `.low` | 9 |

## Save/Remove

```swift
try store.save(reminder, commit: true)
try store.remove(reminder, commit: true)
// No span parameter — reminders don't have recurring instances like events
```

---

# Part 4: EKAlarm

Notification alarm for events or reminders.

```swift
// Time-based
let absoluteAlarm = EKAlarm(absoluteDate: date)       // Specific date/time
let relativeAlarm = EKAlarm(relativeOffset: -3600)    // 1 hour before (seconds)

// Location-based (EKAlarm.proximity available since iOS 6.0+)
let location = EKStructuredLocation(title: "Office")
location.geoLocation = CLLocation(latitude: 37.33, longitude: -122.03)
location.radius = 500  // meters

let locationAlarm = EKAlarm()
locationAlarm.structuredLocation = location
locationAlarm.proximity = .enter  // .enter or .leave

reminder.addAlarm(locationAlarm)
```

---

# Part 5: EKRecurrenceRule

```swift
let rule = EKRecurrenceRule(
    recurrenceWith: .weekly,                    // .daily, .weekly, .monthly, .yearly
    interval: 1,                                 // Every 1 week
    daysOfTheWeek: [EKRecurrenceDayOfWeek(.monday), EKRecurrenceDayOfWeek(.wednesday)],
    daysOfTheMonth: nil,
    monthsOfTheYear: nil,
    weeksOfTheYear: nil,
    daysOfTheYear: nil,
    setPositions: nil,
    end: EKRecurrenceEnd(occurrenceCount: 10)   // or EKRecurrenceEnd(end: Date)
)
event.addRecurrenceRule(rule)
```

---

# Part 6: EKCalendar and EKSource

## EKCalendar Properties

| Property | Type | Notes |
|----------|------|-------|
| `title` | `String` | |
| `color` | `UIColor` / `cgColor: CGColor` | |
| `type` | `EKCalendarType` | `.local`, `.calDAV`, `.exchange`, `.subscription`, `.birthday` |
| `allowsContentModifications` | `Bool` | Can write to this calendar? |
| `isImmutable` | `Bool` | System calendar (birthday, holidays) |
| `source` | `EKSource` | Parent account |

## EKSource Properties

| Property | Type |
|----------|------|
| `title` | `String` |
| `sourceType` | `EKSourceType` — `.local`, `.exchange`, `.calDAV`, `.mobileMe`, `.subscribed`, `.birthdays` |
| `sourceIdentifier` | `String` |

---

# Part 7: EventKitUI View Controllers

## EKEventEditViewController

Create/edit events. **No permission required on iOS 17+** (renders out-of-process).

**Inherits from**: `UINavigationController` (NOT `UIViewController`)

```swift
let editVC = EKEventEditViewController()
editVC.event = event          // nil = new event
editVC.eventStore = store     // Required
editVC.editViewDelegate = self
present(editVC, animated: true)
```

### EKEventEditViewDelegate

```swift
func eventEditViewController(
    _ controller: EKEventEditViewController,
    didCompleteWith action: EKEventEditViewAction
) {
    // action: .canceled, .saved, .deleted
    dismiss(animated: true)
}

func eventEditViewControllerDefaultCalendar(
    forNewEvents controller: EKEventEditViewController
) -> EKCalendar {
    return store.defaultCalendarForNewEvents!
}
```

## EKEventViewController

Display event details. **Requires full access**.

**Inherits from**: `UIViewController` (can push onto nav stack)

```swift
let viewVC = EKEventViewController()
viewVC.event = event               // Required
viewVC.allowsEditing = true
viewVC.allowsCalendarPreview = true
viewVC.delegate = self
navigationController?.pushViewController(viewVC, animated: true)
```

### EKEventViewDelegate

```swift
func eventViewController(
    _ controller: EKEventViewController,
    didCompleteWith action: EKEventViewAction
) {
    // action: .done, .responded, .deleted
}
```

**Note**: `EKEventViewController` automatically handles `EKEventStoreChanged` notifications — no manual refresh needed.

## EKCalendarChooser

Calendar selection UI. **Requires write-only or full access**.

```swift
let chooser = EKCalendarChooser(
    selectionStyle: .single,        // .single or .multiple
    displayStyle: .writableCalendarsOnly,  // .allCalendars or .writableCalendarsOnly
    entityType: .event,              // .event or .reminder
    eventStore: store
)
chooser.selectedCalendars = [store.defaultCalendarForNewEvents!]
chooser.showsDoneButton = true
chooser.delegate = self
present(UINavigationController(rootViewController: chooser), animated: true)
```

**Gotcha**: Under write-only access, `displayStyle` is ignored — always shows writable only.

---

# Part 8: Virtual Conference Extension

For apps supporting voice/video calls — integrates directly into Calendar's location picker.

## Extension Setup

1. Add Virtual Conference Extension target in Xcode
2. Extension point: `com.apple.calendar.virtualconference`
3. Template generates `EKVirtualConferenceProvider` subclass

## EKVirtualConferenceProvider

**Platform**: iOS 15.0+, macOS 12.0+, watchOS 8.0+, visionOS 1.0+

```swift
class MyConferenceProvider: EKVirtualConferenceProvider {
    override func fetchAvailableRoomTypes() async throws
        -> [EKVirtualConferenceRoomTypeDescriptor] {
        return [
            EKVirtualConferenceRoomTypeDescriptor(
                title: "Personal Room",
                identifier: "personal_room"
            )
        ]
    }

    override func fetchVirtualConference(
        identifier: EKVirtualConferenceRoomTypeIdentifier
    ) async throws -> EKVirtualConferenceDescriptor {
        let url = EKVirtualConferenceURLDescriptor(
            title: nil,  // Optional — useful when multiple join URLs
            url: URL(string: "https://myapp.com/join/\(roomId)")!
        )
        return EKVirtualConferenceDescriptor(
            title: nil,  // Optional — distinguishes multiple room types
            urlDescriptors: [url],
            conferenceDetails: "Enter code 12345 to join"
        )
    }
}
```

**Use Universal Links** for join URLs so your app opens directly.

**Syncing**: Events with virtual conference info sync to devices where your app may not be installed.

---

# Part 9: Siri Event Suggestions

Add reservation-style events to Calendar without requesting any permission. Events appear in the Calendar inbox like invitations.

**Supported types**: restaurant, hotel, flight, train, bus, boat, rental car, ticketed events

```swift
// 1. Create reservation reference
let reference = INSpeakableString(
    vocabularyIdentifier: "booking-\(reservationId)",
    spokenPhrase: "Dinner at Caffè Macs",
    pronunciationHint: nil
)

// 2. Create reservation
let duration = INDateComponentsRange(start: startComponents, end: endComponents)
let location = MKPlacemark(coordinate: clLocation.coordinate, postalAddress: address)

let reservation = INRestaurantReservation(
    itemReference: reference,
    reservationStatus: .confirmed,
    reservationHolderName: "Jane Appleseed",
    reservationDuration: duration,
    restaurantLocation: location
)

// 3. Create intent + response
let intent = INGetReservationDetailsIntent(
    reservationContainerReference: reference
)
let response = INGetReservationDetailsIntentResponse(code: .success, userActivity: nil)
response.reservations = [reservation]

// 4. Donate interaction
let interaction = INInteraction(intent: intent, response: response)
interaction.donate()
```

### Reservation Types

| Type | Class |
|------|-------|
| Restaurant | `INRestaurantReservation` |
| Hotel | `INLodgingReservation` |
| Flight | `INFlightReservation` |
| Train | `INTrainReservation` |
| Bus | `INBusReservation` (iOS 14+) |
| Boat | `INBoatReservation` (iOS 14+) |
| Rental Car | `INRentalCarReservation` |
| Ticketed Event | `INTicketedEventReservation` |

### Update/Cancel

Use the same `reservationId` across donations:
- **Update**: Donate with updated details, same `reservationId`
- **Cancel**: Set `reservationStatus = .canceled` and re-donate

### Web Markup (iOS 14+)

Embed schema.org JSON-LD or Microdata in HTML for Safari and Mail:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FoodEstablishmentReservation",
  "reservationId": "abc123",
  "reservationStatus": "https://schema.org/ReservationConfirmed",
  "startTime": "2024-06-15T19:30:00-07:00",
  "underName": { "@type": "Person", "name": "Jane" },
  "reservationFor": {
    "@type": "FoodEstablishment",
    "name": "Caffè Macs",
    "address": "1 Apple Park Way, Cupertino, CA"
  }
}
</script>
```

**Requires**: Domain registration with Apple, HTTPS, valid DKIM for emails.

### Show in App / Show in Safari

- When app is installed: Calendar shows "Show in App" button — launches app with `INGetReservationDetailsIntent`
- When app is not installed: If `url` property is set on `INReservation`, Calendar shows "Show in Safari"

---

# Part 10: Location-Based Reminders

**Platform**: iOS 6.0+ (EKAlarm.proximity, EKStructuredLocation)

**Required permissions**: Location When In Use + Full Reminders Access

```swift
// Create location-triggered reminder
let reminder = EKReminder(eventStore: store)
reminder.title = "Pick up dry cleaning"
reminder.calendar = store.defaultCalendarForNewReminders()

let location = EKStructuredLocation(title: "Dry Cleaners")
location.geoLocation = CLLocation(latitude: 37.33, longitude: -122.03)
location.radius = 200  // meters

let alarm = EKAlarm()
alarm.structuredLocation = location
alarm.proximity = .enter  // .enter or .leave
reminder.addAlarm(alarm)

try store.save(reminder, commit: true)
```

### Fetching Location Reminders

```swift
let predicate = store.predicateForReminders(in: nil)
let allReminders = try await fetchReminders(matching: predicate)
let locationReminders = allReminders.filter { reminder in
    reminder.alarms?.contains { alarm in
        alarm.structuredLocation != nil && alarm.proximity != .none
    } ?? false
}
```

---

# Part 11: Error Reference

## EKErrorDomain Codes

| Code | Name | Meaning |
|------|------|---------|
| 0 | `eventNotMutable` | Event is read-only |
| 1 | `noCalendar` | Calendar property not set |
| 2 | `noStartDate` | Missing start date |
| 3 | `noEndDate` | Missing end date |
| 4 | `datesInverted` | End date before start date |
| 12 | `calendarReadOnly` | Calendar doesn't allow modifications |
| 13 | `calendarIsImmutable` | System calendar (birthday, etc.) |
| 15 | `sourceDoesNotAllowCalendarAddDelete` | Can't create/delete calendars on this source |
| 18 | `recurringReminderRequiresDueDate` | Recurring reminders need due date |
| 19 | `structuredLocationsNotSupported` | Location alarms not supported |
| 21 | `alarmProximityNotSupported` | Proximity alarms not supported |
| 22 | `eventStoreNotAuthorized` | No permission |
| 24 | `objectBelongsToDifferentStore` | Cross-store object usage |
| 25 | `invitesCannotBeMoved` | Can't move events with attendees |
| 26 | `invalidSpan` | Invalid span value |

---

# Part 12: Platform Availability Matrix

| API | iOS | macOS | watchOS | visionOS |
|-----|-----|-------|---------|----------|
| EKEventStore | 4.0+ | 10.8+ | 2.0+ | 1.0+ |
| Write-only access | 17.0+ | 14.0+ | 10.0+ | 1.0+ |
| Full access (new API) | 17.0+ | 14.0+ | 10.0+ | 1.0+ |
| EKEventEditViewController | 4.0+ | (Catalyst 13.1+) | — | 1.0+ |
| EKEventViewController | 4.0+ | (Catalyst 13.1+) | — | 1.0+ |
| EKCalendarChooser | 4.0+ | (Catalyst 13.0+) | — | 1.0+ |
| EKVirtualConferenceProvider | 15.0+ | 12.0+ | 8.0+ | 1.0+ |
| Location-based reminders | 6.0+ | 10.8+ | — | — |
| Siri Event Suggestions | 12.0+ | 11.0+ (Catalyst) | — | — |
| Schema.org markup | 14.0+ | 11.0+ (Safari/Mail) | — | — |

---

## Resources

**WWDC**: 2023-10052, 2020-10197

**Docs**: /eventkit, /eventkitui, /eventkit/ekeventstore, /eventkit/ekevent, /eventkit/ekreminder, /eventkit/ekvirtualconferenceprovider, /technotes/tn3152, /technotes/tn3153

**Skills**: eventkit, contacts-ref, extensions-widgets-ref
