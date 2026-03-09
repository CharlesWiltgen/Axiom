# Push Notifications Skill Suite — Design

**Date**: 2026-03-09
**Status**: Draft
**Skills**: 3 (discipline + ref + diag)
**Router**: ios-integration (add routing entries)

## Problem

Push notifications are the most universally needed iOS feature that Axiom has zero coverage for. Nearly every non-trivial app uses them. The framework is complex (APNs transport, token lifecycle, Focus interaction, service extensions, Live Activity push), failure modes are opaque (silent delivery failures, throttling, Focus suppression), and debugging requires specialized tooling (Push Notifications Console, simctl).

## Skill Suite

### 1. `axiom-push-notifications` (discipline)

**Purpose**: Mental models, patterns, anti-patterns, and decision trees for implementing push notifications correctly.

**Sections**:

1. **When to Use This Skill** — trigger conditions
2. **Example Prompts** — real developer questions
3. **Red Flags** — anti-patterns with time costs
4. **Mandatory First Steps** — entitlements, capabilities, permission timing
5. **Permission Flow**
   - Authorization timing (don't ask on first launch)
   - Provisional authorization (iOS 12+) — deliver quietly first
   - UNAuthorizationOptions decision tree
   - Handling denial and settings redirect
6. **Token Management**
   - APNs device token lifecycle
   - Token refresh and server sync
   - Sandbox vs production token environments
   - FCM dual-token gotcha
7. **Notification Types Decision Tree**
   - Alert vs silent vs background
   - Communication notifications (iOS 15+)
   - Time Sensitive notifications (iOS 15+)
   - Interruption levels and Focus interaction
8. **Payload Design Patterns**
   - Content structure (title, subtitle, body, sound)
   - Custom data payload patterns
   - Localized notifications (loc-key, loc-args)
   - Relevance score for notification summary
   - Payload size discipline (4KB limit, what to trim)
9. **Categories and Actions**
   - Declaring actionable notification types
   - Custom actions (text input, destructive, auth-required)
   - Handling action responses
   - Dynamic category registration
10. **Service Extension Patterns**
    - When to use UNNotificationServiceExtension
    - Media enrichment (images, video, audio)
    - End-to-end encryption decryption
    - `serviceExtensionTimeWillExpire` fallback
    - App group data sharing
11. **Content Extension Patterns**
    - Custom notification UI
    - Category-based content extensions
    - Interactive content extensions
12. **Live Activity Push Transport**
    - Push token observation (`pushTokenUpdates`)
    - Push-start, push-update, push-end flows
    - Priority and stale date
    - Alerting vs non-alerting updates
    - Cross-ref: extensions-widgets for ActivityKit UI
13. **Broadcast Push** (iOS 18+)
    - Channel-based delivery model
    - Channel lifecycle management
    - When broadcast vs individual push
14. **FCM as Provider**
    - Swizzling trap (`FirebaseAppDelegateProxyEnabled`)
    - Dual token management (FCM token ≠ APNs token)
    - APNs auth key upload requirement
    - Silent notification behavior differences
15. **Pressure Scenarios** — deadline pressure, "just ship it" rationalization
16. **Resources** — WWDC sessions, docs, related skills

**Estimated size**: ~900 lines

### 2. `axiom-push-notifications-ref` (reference)

**Purpose**: Comprehensive API reference for APNs transport, payload format, and client-side notification APIs.

**Sections**:

1. **Quick Reference** — canonical remote notification setup pattern
2. **APNs Transport**
   - HTTP/2 connection setup
   - Request format (headers, path, method)
   - APNs header reference table (apns-push-type, apns-priority, apns-topic, apns-expiration, apns-collapse-id)
   - Response codes and error strings
   - Token-based auth (JWT structure, signing, key rotation)
   - Certificate-based auth (when still needed)
3. **Payload Reference**
   - Complete `aps` dictionary keys table
   - Alert dictionary keys (title, subtitle, body, launch-image, etc.)
   - Sound dictionary (critical alerts, custom sounds)
   - Interruption level values
   - Relevance score
   - Content-available (silent push)
   - Mutable-content (service extension trigger)
   - Thread-id (grouping)
   - Target-content-id (deep linking)
4. **UNUserNotificationCenter API**
   - Authorization methods
   - Notification request creation
   - Pending/delivered notification management
   - Delegate methods (willPresent, didReceive)
   - Settings and authorization status
5. **UNNotificationCategory and UNNotificationAction**
   - Category options
   - Action types (default, text input)
   - Action options (auth required, destructive, foreground)
6. **UNNotificationServiceExtension API**
   - Lifecycle methods
   - Attachment creation (UNNotificationAttachment)
   - Supported media types table
   - Size limits table
7. **UNNotificationContentExtension API**
   - Info.plist keys
   - Media playback support
   - Custom action handling
8. **Local Notifications API**
   - UNNotificationTrigger types (time, calendar, location)
   - Repeating triggers
   - Trigger limitations
9. **Live Activity Push Headers**
   - Push-type: liveactivity
   - Event values (start, update, end)
   - Content-state encoding
   - Stale-date and dismissal-date
   - Relevance-score for Live Activities
10. **Broadcast Push API** (iOS 18+)
    - Channel management endpoints
    - Broadcast request format
    - Channel-id header
11. **Command-Line Testing**
    - curl examples for APNs
    - JWT generation with command-line tools
    - simctl push for Simulator testing
12. **Resources**

**Estimated size**: ~1200 lines

### 3. `axiom-push-notifications-diag` (diagnostic)

**Purpose**: Systematic troubleshooting for push notification failures.

**Sections**:

1. **Root Cause Distribution**
   - Token/registration failures: 30%
   - Entitlement/provisioning issues: 25%
   - Payload errors: 15%
   - Focus/interruption suppression: 15%
   - Service extension failures: 10%
   - Delivery timing/throttling: 5%
2. **Red Flags Table** — symptom → likely cause → fix approach
3. **Mandatory First Steps**
   - Step 1: Verify entitlements (push capability in provisioning profile)
   - Step 2: Check token registration (device token vs sandbox/production)
   - Step 3: Validate payload (JSON structure, size)
   - Step 4: Check Push Notifications Console delivery status
4. **Decision Trees**
   - "Not receiving any notifications" tree
   - "Notifications work in dev, not production" tree
   - "Silent notifications not waking app" tree
   - "Rich notification missing media" tree
   - "Live Activity not updating via push" tree
   - "Notifications stopped after iOS update" tree (Focus changes)
5. **Push Notifications Console Workflow**
   - Sending test notifications
   - Reading delivery logs
   - Interpreting status codes
   - Metrics dashboard
6. **Simulator Testing with simctl**
   - Creating push payload files
   - `xcrun simctl push` syntax
   - Limitations (no APNs token in Simulator)
7. **Common FCM Diagnostic**
   - Swizzling conflict detection
   - Token mismatch debugging
   - APNs key validation
8. **Resources**

**Estimated size**: ~600 lines

## Router Changes

### ios-integration router additions

**Routing Logic section** — add new subsection:

```markdown
### Push Notifications

**Push notification implementation** → `/skill axiom-push-notifications`
**APNs API reference** → `/skill axiom-push-notifications-ref`
**Push notification debugging** → `/skill axiom-push-notifications-diag`
```

**Decision Tree** — add 3 new numbered entries:

```
N. If implementing push notifications, APNs, or remote notification handling → invoke axiom-push-notifications
N+1. If need APNs payload format, headers, or UNUserNotificationCenter API details → invoke axiom-push-notifications-ref
N+2. If push notifications not arriving, token issues, or delivery failures → invoke axiom-push-notifications-diag
```

**Anti-Rationalization table** — add:

```
| "Push notifications are just a payload" | Token lifecycle, Focus interaction, and extension gotchas cause 80% of push bugs |
```

**Cross-Domain Routing** — add:

```
User: "My Live Activity isn't updating via push"
→ Invoke: axiom-push-notifications-diag (push transport diagnosis)
   + also invoke: axiom-extensions-widgets (Live Activity UI/state)
```

**Example Invocations** — add 3-4 examples.

## Documentation Pages

### New doc pages

1. `docs/skills/system-integration/push-notifications.md` — discipline skill page
2. `docs/reference/push-notifications-ref.md` — reference page
3. `docs/diagnostic/push-notifications-diag.md` — diagnostic page

### Updated doc pages

4. `docs/skills/system-integration/index.md` — add push notifications entry
5. Any index pages that list all skills

## Cross-References

### Skills that should reference push-notifications

| Skill | What to add |
|-------|-------------|
| `axiom-extensions-widgets` | Cross-ref to push-notifications for Live Activity push transport |
| `axiom-extensions-widgets-ref` | Cross-ref to push-notifications-ref for push token APIs |
| `axiom-background-processing` | Cross-ref for silent notification background wake |
| `axiom-energy` | Cross-ref for push vs polling energy impact |

### Skills that push-notifications references

| Referenced skill | Why |
|-----------------|-----|
| `axiom-extensions-widgets` | Live Activity UI, widget timeline |
| `axiom-extensions-widgets-ref` | ActivityKit API |
| `axiom-background-processing` | Background execution from silent push |
| `axiom-privacy-ux` | Permission request timing |

## Implementation Order

1. Discipline skill (`axiom-push-notifications`)
2. Reference skill (`axiom-push-notifications-ref`)
3. Diagnostic skill (`axiom-push-notifications-diag`)
4. Router update (`axiom-ios-integration`)
5. Cross-reference updates (extensions-widgets, background-processing, energy)
6. Doc pages (3 new + index updates)
7. MCP server rebuild (`pnpm run build:bundle`)

## Research Sources

### Priority 1 — Core (fetch via sosumi.ai)

- `/usernotifications` — framework overview
- `/usernotifications/asking-permission-to-use-notifications`
- `/usernotifications/registering-your-app-with-apns`
- `/usernotifications/handling-notifications-and-notification-related-actions`
- `/usernotifications/declaring-your-actionable-notification-types`
- `/usernotifications/sending-notification-requests-to-apns`
- `/usernotifications/generating-a-remote-notification`
- `/usernotifications/establishing-a-token-based-connection-to-apns`
- `/usernotifications/modifying-content-in-newly-delivered-notifications`
- `/usernotifications/unnotificationserviceextension`

### Priority 2 — Testing and ops

- `/usernotifications/testing-notifications-using-the-push-notification-console`
- `/usernotifications/viewing-the-status-of-push-notifications-using-metrics-and-apns`
- `/usernotifications/sending-push-notifications-using-command-line-tools`

### Priority 3 — Live Activity push

- `/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications`
- `/activitykit/activity/pushtokenupdates-swift.property`

### Priority 4 — Broadcast and advanced

- `/usernotifications/setting-up-broadcast-push-notifications`
- `/usernotifications/sending-broadcast-push-notification-requests-to-apns`

### WWDC Sessions (Chrome browser)

- WWDC21-10091: Communication and Time Sensitive notifications
- WWDC23-10025: Push Notifications Console
- WWDC23-10185: Update Live Activities with push notifications
- WWDC24-10069: Broadcast updates to Live Activities

### HIG

- `/design/human-interface-guidelines/notifications`
- `/design/human-interface-guidelines/managing-notifications`

## Success Criteria

- All 3 skills pass Axiom skill review (`/review-skill`)
- Router correctly routes push notification questions
- No content duplication with extensions-widgets skills
- VitePress build passes with new doc pages
- MCP server bundle includes new skills
