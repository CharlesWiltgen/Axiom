---
name: push-notifications
description: Push notification implementation — permission flow, token management, APNs payload design, categories, service extensions, communication notifications, Focus, Live Activity push, broadcast push, FCM gotchas
---

# Push Notifications

Remote and local notification patterns for iOS. Covers APNs setup, permission flow, token management, payload design, actionable notifications, rich notifications with service extensions, communication notifications, Focus interaction, Live Activity push transport, and broadcast push.

## When to Use

Use this skill when you're:
- Setting up push notifications (APNs registration, entitlements)
- Deciding when and how to ask for notification permission
- Designing notification payloads (alert, sound, badge, custom data)
- Adding actionable notifications with categories and actions
- Building rich notifications with images/media (service extensions)
- Implementing communication notifications with avatars (iOS 15+)
- Working with Time Sensitive or Critical alerts
- Sending push updates to Live Activities
- Testing push notifications with curl or simctl
- Integrating Firebase Cloud Messaging (FCM)

**Note:** For Live Activity UI, attributes, and Dynamic Island, use [extensions-widgets](/skills/integration/extensions-widgets). This skill covers the push transport layer.

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I set up push notifications?"
- "When should I ask for notification permission?"
- "My push notifications aren't arriving"
- "How do I add images to push notifications?"
- "How do I handle notification tap actions?"
- "What are communication notifications?"
- "How do I update a Live Activity with push?"
- "How do I test push notifications with curl?"

## What This Skill Provides

- **Permission flow** — Standard vs provisional authorization, contextual timing
- **Token management** — Device token lifecycle, server sync, sandbox vs production
- **Notification types** — Alert, silent, communication, Time Sensitive, Critical with decision tree
- **Payload design** — Content structure, localization, 4KB discipline
- **Rich notifications** — Service extensions for media and E2E decryption
- **Categories and actions** — Actionable notification types and delegate handling
- **Live Activity push** — Push token observation, start/update/end flows
- **Pressure scenarios** — Shipping under deadline, debugging token mismatch

## Documentation Scope

This page documents the `axiom-integration` skill — push notification patterns Claude uses when helping you implement remote and local notifications.

- **For diagnostics:** See [push-notifications-diag](/diagnostic/push-notifications-diag) for troubleshooting delivery failures
- **For API reference:** See [push-notifications-ref](/reference/push-notifications-ref) for APNs transport and payload format

## Related

- [push-notifications-diag](/diagnostic/push-notifications-diag) — Troubleshooting push delivery failures, token issues, sandbox/production mismatch
- [push-notifications-ref](/reference/push-notifications-ref) — Complete APNs transport, payload format, and notification API reference
- [extensions-widgets](/skills/integration/extensions-widgets) — Live Activity UI, widget timelines, Dynamic Island
- [background-processing](/skills/integration/background-processing) — Background execution from silent push notifications
