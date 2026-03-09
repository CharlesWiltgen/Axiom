---
name: push-notifications-ref
description: APNs HTTP/2 transport, JWT authentication, payload format, UNUserNotificationCenter API, service extensions, Live Activity push headers, broadcast push
---

# Push Notifications Reference

Complete API reference for Apple Push Notification service (APNs) transport, notification payloads, and the UserNotifications framework. Covers authentication, payload structure, service extensions, Live Activity push, and broadcast push.

## When to Use This Reference

Use this reference when you need:
- APNs HTTP/2 endpoint URLs and header fields
- JWT (ES256) authentication setup and key rotation
- Payload structure details (aps dictionary, alert keys, interruption levels)
- UNUserNotificationCenter delegate method signatures
- UNNotificationCategory and UNNotificationAction configuration
- Service extension attachment types and size limits
- Local notification trigger types (time, calendar, location)
- Live Activity push header values for start, update, and end events
- Broadcast push channel setup (iOS 18+)
- Command-line testing with curl, JWT generation, and simctl

**For implementation guidance:** See [push-notifications](/skills/integration/push-notifications) for patterns and decision trees.

**For troubleshooting:** See [push-notifications-diag](/diagnostic/push-notifications-diag) for delivery failure diagnosis.

## Example Prompts

Questions you can ask Claude that will draw from this reference:

- "What headers does APNs require for HTTP/2 requests?"
- "How do I generate a JWT for APNs authentication?"
- "What are the aps payload keys for interruption levels?"
- "What file types can I attach in a service extension?"
- "What are the size limits for notification attachments?"
- "How do I structure a Live Activity push update payload?"
- "What's the broadcast push channel API?"
- "How do I test push with curl from the command line?"

## What's Covered

- APNs HTTP/2 transport (endpoints, headers, response codes)
- JWT authentication (ES256 signing, key rotation)
- Complete payload reference (aps dictionary, alert keys, interruption levels)
- UNUserNotificationCenter API (authorization, delegate methods, settings)
- Categories and actions (UNNotificationCategory, UNNotificationAction)
- Service extension API (UNNotificationServiceExtension, attachment types/limits)
- Local notifications (triggers: time, calendar, location)
- Live Activity push headers (start, update, end events)
- Broadcast push API (iOS 18+ channel model)
- Command-line testing (curl, JWT generation, simctl)

## Documentation Scope

This page documents the `push-notifications-ref` skill — the API reference Claude draws from when answering detailed push notification questions.

- For implementation patterns, see [push-notifications](/skills/integration/push-notifications)
- For troubleshooting, see [push-notifications-diag](/diagnostic/push-notifications-diag)

## Related

- [push-notifications](/skills/integration/push-notifications) — Implementation patterns, permission flow, token management
- [push-notifications-diag](/diagnostic/push-notifications-diag) — Delivery failure diagnostics, token mismatch, sandbox/production issues
- [extensions-widgets](/skills/integration/extensions-widgets) — Live Activity UI, widget timelines, Dynamic Island
- [extensions-widgets-ref](/reference/extensions-widgets-ref) — WidgetKit and ActivityKit API reference

## Resources

**WWDC**: 2023-10160, 2024-10068, 2025-278

**Docs**: /usernotifications, /usernotifications/setting_up_a_remote_notification_server

**Skills**: push-notifications, push-notifications-diag
