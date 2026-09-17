
# EventKit — Discipline

## Core Philosophy

> "Request the minimum access needed, and only when it's needed."

**Mental model**: EventKit has three access tiers. Most apps need only the first (no access + system UI). Requesting more than you need means more users deny your request, and more code to maintain.

## When to Use This Skill

Use this skill when:
- Adding events or reminders to the user's calendar
- Choosing between EventKitUI, write-only, or full access
- Requesting calendar or reminder permissions
- Fetching, querying, or displaying existing events
- Migrating from pre-iOS 17 permission APIs
- Creating virtual conference extensions
- Implementing Siri Event Suggestions for reservations
- Debugging "access denied" or missing events

Do NOT use this skill for:
- Contacts framework questions (use **contacts**)
- General SwiftUI architecture (use **axiom-swiftui** architecture reference)
- Background task scheduling (use **background-processing**)

## Related Skills

- **eventkit-ref** — Complete EventKit/EventKitUI API reference
- **contacts** — Contacts framework discipline skill
- **privacy-ux** — General iOS privacy patterns and Permission UX
- **extensions-widgets** — WidgetKit if combining calendar with widgets
- **background-processing** — If scheduling background calendar sync

---

## Access Tier Decision Tree

```dot
digraph access_decision {
    rankdir=TB;
    "What does your app need?" [shape=diamond];
    "Add single events to Calendar?" [shape=diamond];
    "Show custom create/edit UI?" [shape=diamond];
    "Read existing events/calendars?" [shape=diamond];

    "No access + EventKitUI" [shape=box, label="Tier 1: No Access\nPresent EKEventEditViewController\nNo permission prompt needed"];
    "No access + Siri Suggestions" [shape=box, label="Tier 1: No Access\nSiri Event Suggestions\nFor reservations only"];
    "Write-only access" [shape=box, label="Tier 2: Write-Only\nrequestWriteOnlyAccessToEvents()\nCan save but not read"];
    "Full access" [shape=box, label="Tier 3: Full Access\nrequestFullAccessToEvents()\nor requestFullAccessToReminders()"];

    "What does your app need?" -> "Add single events to Calendar?" [label="events"];
    "What does your app need?" -> "Full access" [label="reminders\n(always full)"];
    "Add single events to Calendar?" -> "No access + EventKitUI" [label="yes, one at a time"];
    "Add single events to Calendar?" -> "Show custom create/edit UI?" [label="no, batch or silent"];
    "Show custom create/edit UI?" -> "Write-only access" [label="yes, or batch save"];
    "Show custom create/edit UI?" -> "Read existing events/calendars?" [label="no"];
    "Read existing events/calendars?" -> "Full access" [label="yes"];
    "Read existing events/calendars?" -> "Write-only access" [label="no"];
    "Add single events to Calendar?" -> "No access + Siri Suggestions" [label="reservation-style\n(restaurant, flight, hotel)"];
}
```

**Key rule**: Reminders ALWAYS require full access. There is no write-only tier for reminders.

---

## The Three Access Tiers

### Tier 1: No Access (Preferred)

Present `EKEventEditViewController` — it runs out-of-process on iOS 17+ and requires zero permissions.

```swift
let store = EKEventStore()
let event = EKEvent(eventStore: store)
event.title = "Team Standup"
event.startDate = startDate
event.endDate = Calendar.current.date(byAdding: .hour, value: 1, to: startDate) ?? startDate
event.timeZone = TimeZone(identifier: "America/Los_Angeles")
event.location = "Conference Room A"

let editVC = EKEventEditViewController()
editVC.event = event
editVC.eventStore = store
editVC.editViewDelegate = self
present(editVC, animated: true)
```

**Swift 6 note**: `editViewDelegate = self` only compiles if `self`'s conformance is declared `@preconcurrency` — `UIViewController` is `@MainActor` and `EKEventEditViewDelegate` carries no actor annotation, so a plain conformance fails with `conformance of 'MyViewController' to protocol 'EKEventEditViewDelegate' crosses into main actor-isolated code and can cause data races`. Same for `EKEventViewDelegate` and `EKCalendarChooserDelegate` (see **eventkit-ref**, Part 7).

**Why this is best**: No permission prompt. No denial risk. System handles Calendar selection and save. Works on iOS 4+.

For reservations (restaurant, flight, hotel, event tickets), use **Siri Event Suggestions** instead — events appear in Calendar inbox without any permission. See the eventkit-ref skill for the INReservation donation pattern.

### Tier 2: Write-Only Access (iOS 17+)

Use only when you need: custom editing UI, batch saves, or silent event creation.

```swift
let store = EKEventStore()
guard try await store.requestWriteOnlyAccessToEvents() else {
    // User denied — handle gracefully
    return
}
let event = EKEvent(eventStore: store)
event.calendar = store.defaultCalendarForNewEvents  // REQUIRED for write-only
event.title = "Recurring Standup"
event.startDate = startDate
event.endDate = endDate
try store.save(event, span: .thisEvent)
```

**Write-only constraints**:
- Returns a single virtual calendar, not the user's real calendars
- Event queries return empty results
- System chooses destination calendar for created events
- Cannot read events back, even ones your app created

**Info.plist required**: `NSCalendarsWriteOnlyAccessUsageDescription`

### Tier 3: Full Access

Use only when your app's core feature requires reading, modifying, or deleting existing events.

```swift
let store = EKEventStore()
guard try await store.requestFullAccessToEvents() else { return }

// Now you can fetch events
let interval = Calendar.current.dateInterval(of: .month, for: Date())!
let predicate = store.predicateForEvents(withStart: interval.start, end: interval.end, calendars: nil)
let events = store.events(matching: predicate)
    .sorted { $0.compareStartDate(with: $1) == .orderedAscending }
```

**Info.plist required**: `NSCalendarsFullAccessUsageDescription`

For reminders:
```swift
guard try await store.requestFullAccessToReminders() else { return }
```

**Info.plist required**: `NSRemindersFullAccessUsageDescription`

---

## Anti-Patterns

| Pattern | Time Cost | Why It's Wrong | Fix |
|---------|-----------|----------------|-----|
| Requesting full access for "add to calendar" | 1-2 sprint days recovering denied users | Full access asks for the entire calendar when the app only needs to add one event | Use EventKitUI or write-only |
| Omitting the access-level usage-description key | 1-2 hours debugging | Not a silent denial — EventKit falls back to `NSCalendarsUsageDescription` / `NSRemindersUsageDescription`, so the prompt shows the older string (TN3153) | Add the key that matches the access level you request |
| Calling deprecated `requestAccess(to:)` on iOS 17 | Throws error | The old API throws, does not prompt | Use `requestFullAccessToEvents()` or `requestWriteOnlyAccessToEvents()` |
| Creating multiple EKEventStore instances | Stale data bugs | Objects from one store cannot be used with another | Create one store, reuse it |
| Using `Date` math instead of `DateComponents` for durations | DST bugs | Adding 3600 seconds doesn't always equal 1 hour | Use `Calendar.current.date(byAdding:)` |
| Not sorting `events(matching:)` results | Wrong display order | Results are NOT chronologically ordered | Sort with `compareStartDate(with:)` |
| Setting `dueDateComponents` with `Date` instead of `DateComponents` | Silent failure | Reminders use `DateComponents`, not `Date` | Convert via `Calendar.current.dateComponents(...)` |
| Not registering for `EKEventStoreChanged` notification | Stale UI | External Calendar changes are invisible | Register and refetch on notification |
| Ignoring `EKSpan` on recurring events | Modifying all occurrences | `.thisEvent` vs `.futureEvents` controls scope | Always choose explicitly |

---

## Reminder Patterns

Reminders ALWAYS require `requestFullAccessToReminders()`.

### Creating a Reminder

```swift
let reminder = EKReminder(eventStore: store)
reminder.title = "Review PR"
reminder.calendar = store.defaultCalendarForNewReminders()  // Required

// Due dates use DateComponents, NOT Date
if let dueDate = dueDate {
    reminder.dueDateComponents = Calendar.current.dateComponents(
        [.year, .month, .day, .hour, .minute], from: dueDate
    )
}

reminder.priority = Int(EKReminderPriority.medium.rawValue)
try store.save(reminder, commit: true)
```

### Fetching Reminders (Async)

Unlike events, reminder fetches are asynchronous:

```swift
// [EKReminder] is not Sendable, so the continuation's `sending` result cannot carry it.
// Box it to move the array across the isolation boundary.
struct Box<T>: @unchecked Sendable { let value: T }

let predicate = store.predicateForReminders(in: nil)  // nil = all calendars
let box: Box<[EKReminder]> = try await withCheckedThrowingContinuation { continuation in
    store.fetchReminders(matching: predicate) { reminders in
        if let reminders {
            continuation.resume(returning: Box(value: reminders))
        } else {
            continuation.resume(throwing: TodayError.failedReadingReminders)
        }
    }
}
let reminders = box.value
```

### Creating Reminder Lists

Reminder lists are `EKCalendar` objects filtered by entity type:

```swift
let newList = EKCalendar(for: .reminder, eventStore: store)
newList.title = "Sprint Tasks"

// Source selection matters — prefer .local or .calDAV
guard let source = store.sources.first(where: {
    $0.sourceType == .local || $0.sourceType == .calDAV
}) ?? store.defaultCalendarForNewReminders()?.source else {
    throw EventKitError.noValidSource
}

newList.source = source
try store.saveCalendar(newList, commit: true)
```

---

## Store Lifecycle

### Singleton Pattern

Create one `EKEventStore` and reuse it. Objects from one store instance cannot be used with another.

### Change Notifications

```swift
NotificationCenter.default.addObserver(
    self, selector: #selector(storeChanged),
    name: .EKEventStoreChanged, object: store
)

@objc func storeChanged(_ notification: Notification) {
    // Refetch your current date range
    // Individual objects: call refresh() — if false, refetch
}
```

### Batch Operations

```swift
// Pass commit: false for batch, then commit once
try store.save(event1, span: .thisEvent, commit: false)
try store.save(event2, span: .thisEvent, commit: false)
try store.commit()  // Atomic save
// On failure: store.reset() to rollback
```

---

## Migration from Pre-iOS 17

| Before iOS 17 | iOS 17+ Replacement |
|----------------|---------------------|
| `requestAccess(to: .event)` | `requestFullAccessToEvents()` or `requestWriteOnlyAccessToEvents()` |
| `requestAccess(to: .reminder)` | `requestFullAccessToReminders()` |
| `NSCalendarsUsageDescription` | `NSCalendarsFullAccessUsageDescription` or `NSCalendarsWriteOnlyAccessUsageDescription` |
| `NSRemindersUsageDescription` | `NSRemindersFullAccessUsageDescription` |
| `authorizationStatus == .authorized` | Check for `.fullAccess` or `.writeOnly` |

**Gotcha**: Apps built with older Xcode SDKs map both `.writeOnly` and `.fullAccess` to `.authorized`. This means an app linked against an old SDK may fail to fetch events even after users granted full access — because the app sees `.authorized` but the system gave `.writeOnly`.

---

## EventKitUI Decision Guide

| Controller | Purpose | Permission Required |
|------------|---------|---------------------|
| `EKEventEditViewController` | Create/edit events | None (iOS 17+ out-of-process) |
| `EKEventViewController` | Display event details | Full access |
| `EKCalendarChooser` | Calendar selection | Write-only or full |

**Gotcha**: `EKEventEditViewController` inherits from `UINavigationController`, not `UIViewController`. Do NOT embed it inside another navigation controller.

**Gotcha**: `EKEventViewController` inherits from `UIViewController` and CAN be pushed onto a navigation stack.

**Gotcha**: Under write-only access, `EKCalendarChooser` ignores `displayStyle` and always shows writable calendars only.

---

## Pressure Scenarios

### Scenario 1: "Just request full access, we might need it later"

**Pressure**: Product manager asks for full access "just in case."

**Why resist**: Write-only or EventKitUI gets you event creation without asking to read the user's calendar. You can always upgrade later if a reading feature is added.

**Response**: "Full access shows a scary prompt about reading ALL calendar data. For adding events, EventKitUI needs no prompt at all. Let's start there and upgrade if we ship a feature that reads events."

### Scenario 2: "The deprecated API still works, we'll migrate later"

**Pressure**: Deadline pressure to skip migration from `requestAccess(to:)`.

**Why resist**: TN3152: "If your app links against the iOS 17 SDK, macOS 14 SDK, or watchOS 10 SDK, calling these deprecated request methods doesn't prompt the user for access and throws an error message." The trigger is SDK linkage, not the runtime OS — every app built today links that SDK or later, so `requestAccess(to:)` throws on whatever OS version the app runs on.

**Response**: "The deprecated API throws — it's not 'deprecated but works'. The fix is to call `requestFullAccessToEvents()` or `requestWriteOnlyAccessToEvents()`; the replacement is a different call, not a version check."

### Scenario 3: "Just create a new EKEventStore for each screen"

**Pressure**: Different view controllers each create their own store for isolation.

**Why resist**: Objects from one store cannot be used with another. Events fetched from store A cannot be saved by store B. Change notifications only fire on the store that's registered.

**Response**: "EventKit requires a single shared store. Objects are bound to the store that created them. Create one and inject it."

---

## Error Handling

Key `EKErrorDomain` codes to handle:

| Code | Meaning | Fix |
|------|---------|-----|
| `eventStoreNotAuthorized` | No permission | Check and request access first |
| `noCalendar` | Calendar not set on event | Set `event.calendar` before save |
| `noStartDate` / `noEndDate` | Missing dates | Set both before save |
| `datesInverted` | End before start | Validate date order |
| `calendarReadOnly` / `calendarIsImmutable` | Can't write to this calendar | Use `allowsContentModifications` check |
| `objectBelongsToDifferentStore` | Cross-store usage | Use single store instance |
| `recurringReminderRequiresDueDate` | Recurring reminder missing due date | Set `dueDateComponents` |

---

## Resources

**WWDC**: 2023-10052, 2020-10197

**Docs**: /eventkit, /eventkitui, /technotes/tn3152-migrating-to-the-latest-calendar-access-levels, /technotes/tn3153-adopting-api-changes-for-eventkit-in-ios-macos-and-watchos

**Skills**: eventkit-ref, contacts, privacy-ux, extensions-widgets
