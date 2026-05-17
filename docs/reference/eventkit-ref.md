---
name: eventkit-ref
description: Complete EventKit and EventKitUI API reference — EKEventStore, EKEvent, EKReminder, EKAlarm, EKRecurrenceRule, EKCalendar, EventKitUI controllers, virtual conference extensions, Siri Event Suggestions, location-based reminders, error codes, platform matrix
---

# EventKit Reference

Complete API reference for EventKit (programmatic access to the Calendar and Reminders databases) and EventKitUI (system view controllers for calendar UI). For tier-based access decisions, denial-rate framing, and pressure scenarios, see the EventKit discipline coverage in [eventkit-contacts](/skills/integration/eventkit-contacts).

**Platform**: iOS 4.0+, iPadOS 4.0+, macOS 10.8+, Mac Catalyst 13.1+, watchOS 2.0+, visionOS 1.0+

## When to Use This Reference

Use this reference when you need:
- The `EKEventStore` API surface (initialization, iOS 17+ authorization, calendar/source access, batch operations, change notifications)
- `EKEvent` and `EKCalendarItem` property and method reference
- `EKReminder` construction, `EKReminderPriority`, async fetch pattern
- `EKAlarm` configuration (relative offsets, absolute dates, structured locations)
- `EKRecurrenceRule` construction and frequency/end conditions
- `EKCalendar` and `EKSource` property reference and source-type filtering
- `EKEventEditViewController`, `EKEventViewController`, and `EKCalendarChooser` initialization and delegate methods
- Virtual conference extension setup (`EKVirtualConferenceProvider`)
- Siri Event Suggestions (reservation donation via Intents framework)
- Location-based reminders (`EKStructuredLocation`, `EKAlarm.proximity`)
- `EKErrorDomain` codes for error handling
- Platform availability for each API

## Example Prompts

- "What's the iOS 17+ API for requesting write-only Calendar access?"
- "Which Info.plist keys do I need for write-only vs full access?"
- "How do I fetch reminders asynchronously, and why is the API different from events?"
- "How do I construct a recurring weekly event with an end date?"
- "How do I set a relative alarm 15 minutes before an event?"
- "How do I implement a virtual conference extension?"
- "What `EKErrorDomain` codes should I handle when saving an event?"
- "What's the signature for `EKEventEditViewController.editViewDelegate`?"

## What's Covered

- **EKEventStore** — initialization, `requestWriteOnlyAccessToEvents()` / `requestFullAccessToEvents()` / `requestFullAccessToReminders()` (iOS 17+), Info.plist keys (`NSCalendarsWriteOnlyAccessUsageDescription`, `NSCalendarsFullAccessUsageDescription`, `NSRemindersFullAccessUsageDescription`), `defaultCalendarForNewEvents`, `defaultCalendarForNewReminders()`, source enumeration
- **Event operations** — `save(_:span:commit:)`, `remove(_:span:commit:)`, `commit()`, `reset()`, batch-save pattern
- **Event fetching (synchronous)** — `predicateForEvents(withStart:end:calendars:)`, `events(matching:)` returns unsorted results, `compareStartDate(with:)` sort, run on background thread
- **Reminder fetching (asynchronous)** — `predicateForReminders(in:)`, `fetchReminders(matching:completion:)` callback-style API, async-await bridging pattern
- **Change notifications** — `.EKEventStoreChanged` notification, `refresh()` on stale objects
- **EKEvent** — creation, `title`, `startDate`, `endDate`, `timeZone`, `location`, `notes`, `URL`, attendees, structured location, alarms, recurrence rules
- **EKReminder** — creation, `dueDateComponents` (NOT `Date`), `completionDate`, `EKReminderPriority` raw values
- **EKAlarm** — relative offset, absolute date, structured-location proximity (entering/leaving)
- **EKRecurrenceRule** — `.daily`, `.weekly`, `.monthly`, `.yearly`; interval; end conditions (`EKRecurrenceEnd.occurrenceCount` or `.endDate`); `daysOfTheWeek`, `daysOfTheMonth`, `monthsOfTheYear`, `weeksOfTheYear`
- **EKCalendar and EKSource** — `allowsContentModifications`, `cgColor`, `type`, `source`; `EKSource.sourceType` (`.local`, `.calDAV`, `.exchange`, `.subscribed`, `.mobileMe`, `.birthdays`)
- **EventKitUI** — `EKEventEditViewController` (inherits from `UINavigationController` — do NOT embed), `EKEventViewController` (inherits from `UIViewController`), `EKCalendarChooser` (displayStyle constraints under write-only access)
- **Virtual conference extension** — extension target setup, `EKVirtualConferenceProvider`, conference URL generation
- **Siri Event Suggestions** — INReservation donation pattern (restaurant, flight, hotel, ticketed event); zero-permission event-in-Calendar-inbox flow
- **Location-based reminders** — `EKStructuredLocation`, `EKAlarm.proximity`, geofencing radius
- **EKErrorDomain codes** — `eventStoreNotAuthorized`, `noCalendar`, `noStartDate`, `noEndDate`, `datesInverted`, `calendarReadOnly`, `calendarIsImmutable`, `objectBelongsToDifferentStore`, `recurringReminderRequiresDueDate`, and others
- **Platform availability matrix** — which APIs are available on iOS, macOS, watchOS, visionOS, and at which OS versions

## Documentation Scope

This page documents the `eventkit-ref` skill — the API reference half of the EventKit pair.

- For **the three-tier access decision, denial-rate framing, and pressure scenarios**, see [eventkit-contacts](/skills/integration/eventkit-contacts)
- For **general permission UX patterns**, see [privacy-ux](/skills/integration/privacy-ux)
- For **contacts framework APIs**, see [contacts-ref](/reference/contacts-ref)

## Resources

**WWDC**: 2023-10052, 2020-10197

**Docs**: /eventkit, /eventkitui, /technotes/tn3152, /technotes/tn3153
