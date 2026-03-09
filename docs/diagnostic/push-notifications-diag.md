---
name: push-notifications-diag
description: Notifications not arriving, token registration failed, works in dev not production, silent push throttled, rich media missing
---

# Push Notifications Diagnostics

Systematic push notification troubleshooting for delivery failures, token issues, sandbox/production mismatch, silent push throttling, and rich notification problems.

## Symptoms This Diagnoses

Use when you're experiencing:
- Notifications not arriving at all
- Push works in development but not production
- `didFailToRegisterForRemoteNotificationsWithError` fires
- Silent push not waking the app
- Rich notification shows plain text (missing media)
- Live Activity not updating via push
- Notifications stopped after iOS update
- FCM works on Android but not iOS
- Badge count not clearing or updating
- Notification actions not appearing

## Example Prompts

Questions you can ask Claude that will invoke this diagnostic:

- "Why aren't my push notifications arriving?"
- "Push works in the simulator but not on device"
- "My notifications work in dev but not production"
- "Silent push notifications aren't waking my app"
- "Rich notification images aren't showing"
- "Live Activity push updates aren't working"
- "FCM push works on Android but not iOS"
- "How do I debug APNs delivery?"

## Diagnostic Workflow

The diagnostic follows a systematic approach:

1. **Token registration** — Verify entitlements, provisioning profile, APNs environment
2. **Server-side delivery** — Check APNs response codes, token validity, certificate/JWT expiry
3. **Device-side reception** — Confirm foreground/background delegate handling, notification settings
4. **Payload validation** — Verify aps dictionary structure, content-available for silent push, size limits
5. **Extension debugging** — Service extension not called, attachment download failures, 30s timeout
6. **Environment mismatch** — Sandbox vs production tokens, certificate type, APNs endpoint

## When to Use This Diagnostic

Use this diagnostic when:
- Push notifications stop arriving unexpectedly
- Token registration succeeds but notifications never arrive
- Notifications work inconsistently across environments
- Service extension modifications aren't applied
- Live Activity push updates are ignored
- You need to verify APNs delivery with server logs

## Documentation Scope

This page documents the `push-notifications-diag` skill — diagnostic workflows Claude uses when helping you debug push notification issues.

- For implementation guidance, see [push-notifications](/skills/integration/push-notifications)
- For API details, see [push-notifications-ref](/reference/push-notifications-ref)

## Related

- [push-notifications](/skills/integration/push-notifications) — Implementation patterns, permission flow, token management
- [push-notifications-ref](/reference/push-notifications-ref) — APNs transport, payload format, notification API reference
- [extensions-widgets](/skills/integration/extensions-widgets) — Live Activity UI, widget timelines, Dynamic Island
- [networking-diag](/diagnostic/networking-diag) — Network connectivity issues that may affect push delivery

## Resources

**WWDC**: 2023-10160, 2024-10068

**Docs**: /usernotifications, /usernotifications/setting_up_a_remote_notification_server

**Skills**: push-notifications, push-notifications-ref
