# Push Notifications Skill Suite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 3-skill push notifications suite (discipline + ref + diag) to Axiom, filling its biggest coverage gap.

**Architecture:** Three new skill directories under `.claude-plugin/plugins/axiom/skills/`, routing via existing `axiom-ios-integration` router, three new VitePress doc pages, and MCP server bundle rebuild. Content sourced from Apple's UserNotifications docs (already fetched via sosumi.ai and cached in the design doc's research phase).

**Tech Stack:** Markdown skill files (Agent Skills spec), VitePress doc pages, Node.js version script, pnpm MCP build

---

### Task 1: Create Discipline Skill (`axiom-push-notifications`)

**Files:**
- Create: `.claude-plugin/plugins/axiom/skills/axiom-push-notifications/SKILL.md`

**Step 1: Create the skill directory**

```bash
mkdir -p .claude-plugin/plugins/axiom/skills/axiom-push-notifications
```

**Step 2: Write the discipline skill**

Create `SKILL.md` following the `axiom-camera-capture` structure exactly. Use this section ordering:

```markdown
---
name: axiom-push-notifications
description: Push notification implementation patterns — permission flow, token management, payload design, categories, actions, service extensions, communication notifications, Focus interaction, Live Activity push transport, broadcast push, FCM provider gotchas
license: MIT
compatibility: iOS 10+, iPadOS 10+, watchOS 3+, macOS 10.14+, tvOS 10+
metadata:
  version: "1.0.0"
  last-updated: "2026-03-09"
---
```

**Section ordering** (match camera-capture pattern):

1. **Title + 1-sentence intro**
2. **When to Use This Skill** — checkbox list:
   - ☑ Implementing remote (APNs) push notifications
   - ☑ Requesting notification permissions
   - ☑ Managing device tokens and server sync
   - ☑ Adding actionable notifications with categories/actions
   - ☑ Building rich notifications with service extensions
   - ☑ Communication notifications with avatars (iOS 15+)
   - ☑ Time Sensitive or Critical alerts
   - ☑ Updating Live Activities via push (transport layer)
   - ☑ Broadcast push for large audiences (iOS 18+)
   - ☑ Local notification scheduling

3. **Example Prompts** — 8-10 real questions:
   - "How do I set up push notifications?"
   - "When should I ask for notification permission?"
   - "My push notifications aren't arriving"
   - "How do I add images to push notifications?"
   - "How do I handle notification actions?"
   - "What are communication notifications?"
   - "How do I update a Live Activity with push?"
   - "How do I send push notifications with curl for testing?"
   - "My notifications don't show when the app is in foreground"
   - "How do I use Firebase for iOS push notifications?"

4. **Red Flags** — ❌ format, 10-12 items including:
   - ❌ Requesting permission on first launch before user understands value
   - ❌ Caching device tokens locally instead of requesting fresh each launch
   - ❌ Sending the same token to sandbox AND production APNs
   - ❌ Using `content-available: 1` without understanding silent push throttling
   - ❌ Not implementing `serviceExtensionTimeWillExpire` fallback
   - ❌ Force-unwrapping device token or assuming registration always succeeds
   - ❌ Hardcoding APNs host instead of switching sandbox/production by environment
   - ❌ Setting `apns-priority: 10` for all notifications (drains battery)
   - ❌ Exceeding 4KB payload without realizing APNs silently rejects it
   - ❌ Using FCM without disabling method swizzling when you have custom delegate handling

5. **Mandatory First Steps** — 3 steps:

   **Step 1: Enable Push Notification Capability**
   - Xcode: Target → Signing & Capabilities → + Push Notifications
   - This adds `aps-environment` entitlement to provisioning profile
   - Verify in Apple Developer Portal: App ID has Push Notifications enabled

   **Step 2: Register for Remote Notifications**
   ```swift
   // In AppDelegate or app entry point
   UIApplication.shared.registerForRemoteNotifications()

   // Handle token receipt
   func application(_ application: UIApplication,
                    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
       let token = deviceToken.map { String(format: "%02x", $0) }.joined()
       // Send token to your server — never cache locally
       sendTokenToServer(token)
   }

   func application(_ application: UIApplication,
                    didFailToRegisterForRemoteNotificationsWithError error: Error) {
       // Log error — don't crash. Simulator cannot register for push.
   }
   ```

   **Step 3: Request Authorization (in context, not at launch)**
   ```swift
   let center = UNUserNotificationCenter.current()
   let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
   // Only register for remote notifications AFTER authorization
   if granted {
       await MainActor.run {
           UIApplication.shared.registerForRemoteNotifications()
       }
   }
   ```

6. **Permission Flow** — patterns for:
   - **Standard authorization** — request in context (after user action that makes notification value clear)
   - **Provisional authorization** (iOS 12+) — add `.provisional` to options, notifications appear quietly in history with Keep/Turn Off buttons
   - **Authorization status check** — always check `notificationSettings()` before scheduling
   - **Handling denial** — open Settings with `UIApplication.openNotificationSettingsURLString`

7. **Token Management** — patterns for:
   - Token format (Data → hex string conversion)
   - Token refresh lifecycle (request fresh at every launch, never cache)
   - Sandbox vs production environments (different APNs endpoints, different tokens)
   - Server sync pattern (send token + user ID + app version + device info)

8. **Notification Types Decision Tree** — ASCII decision tree:
   ```
   What type of notification?
   │
   ├─ User-visible alert → apns-push-type: alert
   │  ├─ Normal priority → interruption-level: active (default)
   │  ├─ Can wait for summary → interruption-level: passive
   │  ├─ Time-sensitive (reminders, arrivals) → interruption-level: time-sensitive
   │  │  └─ Requires Time Sensitive capability
   │  └─ Safety/health critical → interruption-level: critical
   │     └─ Requires Apple approval + Critical Alerts entitlement
   │
   ├─ Communication (messages, calls) → INSendMessageIntent donation
   │  └─ Shows sender avatar, breaks through Focus for allowed contacts
   │
   ├─ Silent background update → content-available: 1, no alert
   │  └─ apns-push-type: background, apns-priority: 5
   │  └─ Throttled: system limits ~2-3/hour in practice
   │
   └─ Live Activity update → apns-push-type: liveactivity
      └─ See Live Activity Push Transport section
   ```

9. **Payload Design Patterns** — key patterns:
   - Basic alert payload (title, subtitle, body)
   - Localized payload (loc-key, loc-args)
   - Sound (default, custom .aiff/.wav, critical alert with volume)
   - Custom data fields (outside `aps` dictionary)
   - Relevance score (0-1, for notification summary grouping)
   - Thread-id (conversation grouping)
   - Collapse-id (APNs header, replaces previous notification)
   - Size discipline: 4KB max payload, 5KB for VoIP

10. **Categories and Actions** — complete pattern:
    ```swift
    // Register at app launch
    let replyAction = UNTextInputNotificationAction(
        identifier: "REPLY_ACTION",
        title: "Reply",
        options: [])

    let likeAction = UNNotificationAction(
        identifier: "LIKE_ACTION",
        title: "Like",
        options: [])

    let messageCategory = UNNotificationCategory(
        identifier: "MESSAGE",
        actions: [replyAction, likeAction],
        intentIdentifiers: [],
        options: [.customDismissAction])

    UNUserNotificationCenter.current()
        .setNotificationCategories([messageCategory])
    ```

    Action handling delegate:
    ```swift
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo

        switch response.actionIdentifier {
        case "REPLY_ACTION":
            if let textResponse = response as? UNTextInputNotificationResponse {
                handleReply(text: textResponse.userText, userInfo: userInfo)
            }
        case "LIKE_ACTION":
            handleLike(userInfo: userInfo)
        case UNNotificationDefaultActionIdentifier:
            handleTap(userInfo: userInfo)
        case UNNotificationDismissActionIdentifier:
            break // User dismissed
        default:
            break
        }
        completionHandler()
    }
    ```

11. **Service Extension Patterns** — 2 patterns:
    - **Media enrichment** — download image/video from URL in payload, create UNNotificationAttachment
    - **E2E decryption** — decrypt payload, update content, always implement `serviceExtensionTimeWillExpire`

    Key code:
    ```swift
    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let content = bestAttemptContent,
              let imageURLString = content.userInfo["image_url"] as? String,
              let imageURL = URL(string: imageURLString) else {
            contentHandler(request.content)
            return
        }

        // Download and attach media
        downloadMedia(from: imageURL) { localURL in
            if let localURL,
               let attachment = try? UNNotificationAttachment(identifier: "image", url: localURL) {
                content.attachments = [attachment]
            }
            contentHandler(content)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Always deliver SOMETHING — don't let the notification vanish
        if let contentHandler, let content = bestAttemptContent {
            contentHandler(content)
        }
    }
    ```

    Payload requirement: `"mutable-content": 1` in `aps` dictionary.

12. **Communication Notifications** (iOS 15+) — pattern showing:
    - INSendMessageIntent creation with sender INPerson
    - Interaction donation in service extension
    - `content.updating(from: intent)` to attach avatar
    - Focus integration with `notifyRecipientAnyway`
    - SiriKit capability requirement

13. **Foreground Notification Handling**
    ```swift
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler:
                                    @escaping (UNNotificationPresentationOptions) -> Void) {
        // Show banner + sound even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
    ```

14. **Live Activity Push Transport** — cross-reference pattern:
    - Push token observation via `activity.pushTokenUpdates`
    - APNs headers: `apns-push-type: liveactivity`, topic: `{bundleID}.push-type.liveactivity`
    - Event payloads: `"event": "update"` / `"start"` / `"end"`
    - Content-state must match ActivityAttributes.ContentState exactly (no custom JSON encoding)
    - Rate limiting: ~10-12/hour standard, more with `NSSupportsLiveActivitiesFrequentUpdates`
    - Cross-ref: "For ActivityKit UI patterns, Live Activity attributes, and Dynamic Island, see axiom-extensions-widgets"

15. **Broadcast Push** (iOS 18+) — brief section:
    - Channel-based delivery for large audiences (sports, flights)
    - Enable Broadcast Capability in developer portal
    - Endpoint: `/4/broadcasts/apps/{TOPIC}`
    - Only available for Live Activities
    - Cross-ref: extensions-widgets for broadcast Live Activity UI

16. **FCM as Provider** — gotcha section (~20 lines):
    - **Swizzling trap**: FCM swizzles `UNUserNotificationCenterDelegate` and `didRegisterForRemoteNotifications` by default. Set `FirebaseAppDelegateProxyEnabled = NO` in Info.plist if you have custom handling.
    - **Dual token**: FCM token ≠ APNs device token. Use FCM token for FCM API, APNs token for direct APNs. Don't mix them.
    - **APNs key upload**: Upload your .p8 APNs auth key to Firebase Console → Project Settings → Cloud Messaging. Without this, dev works but production fails.
    - **Silent push**: FCM `content_available` maps to APNs `content-available`, but FCM may add extra fields that push payload over 4KB limit.

17. **Anti-Patterns** — 4 numbered anti-patterns with Wrong/Right/Why format (like camera-capture)

18. **Pressure Scenarios** — 3 scenarios:
    - Scenario 1: "Ship push notifications by Friday" — resist skipping permission timing
    - Scenario 2: "Notifications work in dev but not production" — resist blaming APNs before checking token environment
    - Scenario 3: "Just send everything as Time Sensitive" — resist overusing interruption levels

19. **Checklist** — grouped by category:
    - **Entitlements** (3 items)
    - **Permissions** (4 items)
    - **Token Management** (3 items)
    - **Payload** (4 items)
    - **Service Extension** (3 items, conditional)
    - **Testing** (3 items)

20. **Resources** — compact format:
    ```
    **WWDC**: 2021-10091, 2023-10025, 2023-10185, 2024-10069
    **Docs**: /usernotifications, /usernotifications/unusernotificationcenter
    **Skills**: axiom-push-notifications-ref, axiom-push-notifications-diag, axiom-extensions-widgets
    ```

**Step 3: Validate**

Run: `/review-skill` on the new skill file to check against Axiom quality standards.

**Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-push-notifications/SKILL.md
git commit -m "feat: add push-notifications discipline skill"
```

---

### Task 2: Create Reference Skill (`axiom-push-notifications-ref`)

**Files:**
- Create: `.claude-plugin/plugins/axiom/skills/axiom-push-notifications-ref/SKILL.md`

**Step 1: Create the skill directory**

```bash
mkdir -p .claude-plugin/plugins/axiom/skills/axiom-push-notifications-ref
```

**Step 2: Write the reference skill**

Frontmatter:
```yaml
---
name: axiom-push-notifications-ref
description: Push notifications API reference — APNs HTTP/2 transport, JWT auth, payload keys, UNUserNotificationCenter, UNNotificationCategory, UNNotificationServiceExtension, Live Activity push headers, broadcast push, command-line testing
license: MIT
compatibility: iOS 10+, iPadOS 10+, watchOS 3+, macOS 10.14+, tvOS 10+
metadata:
  version: "1.0.0"
  last-updated: "2026-03-09"
---
```

**Section ordering** (match camera-capture-ref pattern):

1. **Title + 1-sentence intro**
2. **Quick Reference** — canonical setup code showing the minimal working remote notification:
   ```swift
   // AppDelegate.swift — minimal remote notification setup
   func application(_ application: UIApplication,
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
       UNUserNotificationCenter.current().delegate = self
       return true
   }
   ```
   Plus the 3 essential delegate methods.

3. **APNs Transport Reference**

   **Endpoints table:**
   | Environment | Host | Port |
   |-------------|------|------|
   | Development | api.sandbox.push.apple.com | 443 or 2197 |
   | Production | api.push.apple.com | 443 or 2197 |

   **Request format:**
   ```
   POST /3/device/{device_token}
   Host: api.push.apple.com
   Authorization: bearer {jwt_token}
   apns-topic: {bundle_id}
   apns-push-type: alert
   Content-Type: application/json
   ```

   **APNs Headers table:**
   | Header | Required | Values | Notes |
   |--------|----------|--------|-------|
   | apns-push-type | Yes | alert, background, liveactivity, voip, complication, fileprovider, mdm, location | Must match payload content |
   | apns-topic | Yes | Bundle ID (or .push-type.liveactivity suffix for Live Activities) | |
   | apns-priority | No | 10 (immediate), 5 (power-aware), 1 (low priority) | Default 10 for alert, 5 for background |
   | apns-expiration | No | UNIX timestamp or 0 | 0 = deliver once only |
   | apns-collapse-id | No | String ≤64 bytes | Replaces matching notification |
   | apns-id | No | UUID | For delivery tracking |
   | authorization | Token auth only | bearer {JWT} | |

   **Response codes table** (200, 400, 403, 404, 405, 410, 413, 429, 500, 503 with error strings)

4. **JWT Authentication Reference**

   JWT Header:
   ```json
   { "alg": "ES256", "kid": "{10-char Key ID}" }
   ```

   JWT Claims:
   ```json
   { "iss": "{10-char Team ID}", "iat": {unix_timestamp} }
   ```

   Rules:
   - Sign with ES256 using APNs auth key (.p8)
   - Token expires after 1 hour (ExpiredProviderToken 403)
   - Don't refresh more than once per 20 minutes on same connection
   - One key works for all apps in your team, both sandbox and production

5. **Payload Reference**

   **Complete `aps` dictionary keys table:**
   | Key | Type | Purpose |
   |-----|------|---------|
   | alert | Dictionary or String | Alert content |
   | badge | Number | App icon badge (0 removes) |
   | sound | String or Dictionary | Audio (default, filename, or critical alert config) |
   | thread-id | String | Notification grouping |
   | category | String | Actionable notification type |
   | content-available | Number (1) | Silent background push |
   | mutable-content | Number (1) | Triggers service extension |
   | target-content-id | String | Window/content identifier |
   | interruption-level | String | passive, active, time-sensitive, critical |
   | relevance-score | Number (0-1) | Summary sorting priority |
   | filter-criteria | String | Focus filter matching |
   | stale-date | Number | UNIX timestamp for Live Activity |
   | content-state | Dictionary | Live Activity content update |
   | timestamp | Number | UNIX timestamp for Live Activity |
   | event | String | start, update, end (Live Activity) |
   | dismissal-date | Number | UNIX timestamp for Live Activity removal |
   | attributes-type | String | Live Activity struct name (push-start) |
   | attributes | Dictionary | Live Activity init data (push-start) |

   **Alert dictionary keys table:**
   | Key | Type | Purpose |
   |-----|------|---------|
   | title | String | Short description |
   | subtitle | String | Secondary description |
   | body | String | Full message text |
   | launch-image | String | Launch screen filename |
   | title-loc-key | String | Localization key for title |
   | title-loc-args | [String] | Title format arguments |
   | subtitle-loc-key | String | Localization key for subtitle |
   | subtitle-loc-args | [String] | Subtitle format arguments |
   | loc-key | String | Localization key for body |
   | loc-args | [String] | Body format arguments |

   **Sound dictionary (critical alerts):**
   ```json
   { "critical": 1, "name": "alarm.aiff", "volume": 0.8 }
   ```

   **Interruption level values:**
   | Value | Behavior | Requires |
   |-------|----------|----------|
   | passive | No sound, no wake. Appears in summary. | Nothing |
   | active | Default behavior. Sound + banner. | Nothing |
   | time-sensitive | Breaks through scheduled delivery. Banners persist 1hr. | Time Sensitive capability |
   | critical | Overrides Do Not Disturb and ringer switch. | Apple approval + Critical Alerts entitlement |

   **Example payloads** — 4-5 examples covering: basic alert, localized, silent push, rich notification with mutable-content, time-sensitive

6. **UNUserNotificationCenter API Reference**

   Key methods table:
   | Method | Purpose |
   |--------|---------|
   | requestAuthorization(options:) | Request permission |
   | notificationSettings() | Check current status |
   | add(_:) | Schedule notification request |
   | getPendingNotificationRequests() | List scheduled |
   | removePendingNotificationRequests(withIdentifiers:) | Cancel scheduled |
   | getDeliveredNotifications() | List in notification center |
   | removeDeliveredNotifications(withIdentifiers:) | Remove from center |
   | setNotificationCategories(_:) | Register actionable types |
   | setBadgeCount(_:) | Update badge (iOS 16+) |

   **UNAuthorizationOptions flags:**
   | Option | Purpose |
   |--------|---------|
   | .alert | Display alerts |
   | .badge | Update badge count |
   | .sound | Play sounds |
   | .carPlay | Show in CarPlay |
   | .criticalAlert | Critical alerts (requires entitlement) |
   | .provisional | Trial delivery without prompting |
   | .providesAppNotificationSettings | Show "Configure in App" button in Settings |
   | .announcement | Allow Siri to read (deprecated iOS 15+, use communication notifications) |

   **UNAuthorizationStatus values:**
   | Value | Meaning |
   |-------|---------|
   | .notDetermined | No prompt shown yet |
   | .denied | User denied or turned off in Settings |
   | .authorized | User explicitly granted |
   | .provisional | Provisional (trial) delivery |
   | .ephemeral | App Clip temporary permission |

   **Delegate methods** with signatures and usage notes.

7. **UNNotificationCategory and UNNotificationAction API**
   - Category initializer with all parameters
   - UNNotificationAction options (authenticationRequired, destructive, foreground)
   - UNTextInputNotificationAction (text input button/placeholder)
   - Category options (customDismissAction, allowInCarPlay, hiddenPreviewsShowTitle, hiddenPreviewsShowSubtitle, allowAnnouncement)

8. **UNNotificationServiceExtension API**
   - `didReceive(_:withContentHandler:)` — 30-second processing window
   - `serviceExtensionTimeWillExpire()` — must deliver content immediately
   - UNNotificationAttachment supported types table:
     | Type | Extension | Max Size |
     |------|-----------|----------|
     | JPEG | .jpg | 10 MB |
     | GIF | .gif | 10 MB |
     | PNG | .png | 10 MB |
     | Audio | .aif, .wav | 5 MB |
     | Video | .mp4, .mpeg | 50 MB |
   - Payload requirement: `"mutable-content": 1`

9. **Local Notifications API**
   - UNTimeIntervalNotificationTrigger (interval, repeats)
   - UNCalendarNotificationTrigger (dateComponents, repeats)
   - UNLocationNotificationTrigger (CLRegion, repeats)
   - Trigger limitations (time interval must be ≥60 seconds if repeating)

10. **Live Activity Push Headers**
    - Topic format: `{bundleID}.push-type.liveactivity`
    - Push type: `liveactivity`
    - Event values and their payloads (start, update, end) with JSON examples
    - Content-state encoding rules (no custom JSON encoding strategies)
    - Priority budgeting (5 for non-critical, 10 for time-sensitive)
    - Push-to-start token observation: `Activity<T>.pushToStartTokenUpdates`
    - Token-based start (`input-push-token: 1`) vs channel-based start (`input-push-channel: "..."`)

11. **Broadcast Push API** (iOS 18+)
    - Endpoint: `POST /4/broadcasts/apps/{TOPIC}`
    - `apns-push-type: liveactivity`
    - Channel management endpoints
    - Only for Live Activities

12. **Command-Line Testing**
    - Complete curl command for JWT-based push (from Apple docs)
    - JWT generation with openssl commands
    - simctl push syntax: `xcrun simctl push {device} {bundle_id} {payload.json}`
    - Simctl payload file format

13. **Resources** — compact format

**Step 3: Validate**

Run: `/review-skill` on the new skill file.

**Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-push-notifications-ref/SKILL.md
git commit -m "feat: add push-notifications-ref API reference skill"
```

---

### Task 3: Create Diagnostic Skill (`axiom-push-notifications-diag`)

**Files:**
- Create: `.claude-plugin/plugins/axiom/skills/axiom-push-notifications-diag/SKILL.md`

**Step 1: Create the skill directory**

```bash
mkdir -p .claude-plugin/plugins/axiom/skills/axiom-push-notifications-diag
```

**Step 2: Write the diagnostic skill**

Frontmatter:
```yaml
---
name: axiom-push-notifications-diag
description: notifications not arriving, token registration failed, push works in dev not production, silent notifications not waking app, rich notification missing image, Live Activity not updating via push, notifications stopped after iOS update, APNs rejected payload
license: MIT
compatibility: iOS 10+, iPadOS 10+, watchOS 3+, macOS 10.14+
metadata:
  version: "1.0.0"
  last-updated: "2026-03-09"
---
```

**Section ordering** (match camera-capture-diag pattern):

1. **Title + intro**
2. **Overview with Root Cause Distribution:**
   - Token/registration failures: 30%
   - Entitlement/provisioning mismatch: 25%
   - Payload structure errors: 15%
   - Focus/interruption suppression: 15%
   - Service extension failures: 10%
   - Delivery timing/throttling: 5%

3. **Red Flags Table** — 12-15 rows:
   | Symptom | Likely Cause |
   |---------|--------------|
   | No notifications at all | Missing Push Notification capability or provisioning profile |
   | Works in dev, not production | Sending to sandbox APNs with production token (or vice versa) |
   | Token registration fails on Simulator | Expected — Simulator cannot register for remote notifications |
   | Notifications appear without sound | Missing .sound in authorization options or payload |
   | Rich notification shows plain text | Missing mutable-content: 1 in payload |
   | Image not showing in notification | Service extension failed silently — check serviceExtensionTimeWillExpire |
   | Silent push not waking app | System throttling (~2-3/hour), or app was force-quit by user |
   | Notifications stopped after iOS update | Focus mode enabled by default in iOS 15+; check interruption level |
   | Badge shows wrong number | Multiple notifications sent without explicit badge count reset |
   | Actions not appearing | Category identifier mismatch between payload and registered categories |
   | Notification appears twice | Both local and remote notification scheduled for same event |
   | FCM works on Android, not iOS | Missing APNs auth key upload in Firebase Console |

4. **Mandatory First Steps** — 4 diagnostic steps with code:

   **Step 1: Verify Push Notification Entitlements**
   ```bash
   # Check provisioning profile
   security cms -D -i path/to/embedded.mobileprovision | grep -A1 "aps-environment"
   ```
   Expected output:
   - ✅ `<string>development</string>` or `<string>production</string>`
   - ❌ No aps-environment key → Push Notifications capability not enabled

   **Step 2: Check Token Registration**
   ```swift
   func application(_ application: UIApplication,
                    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
       let token = deviceToken.map { String(format: "%02x", $0) }.joined()
       print("✅ APNs token: \(token)")
       print("✅ Token length: \(token.count) chars") // Should be 64
   }

   func application(_ application: UIApplication,
                    didFailToRegisterForRemoteNotificationsWithError error: Error) {
       print("❌ Registration failed: \(error.localizedDescription)")
   }
   ```
   Expected:
   - ✅ 64-character hex token
   - ❌ "no valid aps-environment entitlement" → capability misconfigured
   - ❌ No callback at all → `registerForRemoteNotifications()` never called

   **Step 3: Validate Payload with curl**
   ```bash
   # Test with Push Notifications Console or curl
   curl -v \
     --header "apns-topic: com.your.bundle.id" \
     --header "apns-push-type: alert" \
     --header "authorization: bearer $JWT_TOKEN" \
     --data '{"aps":{"alert":{"title":"Test","body":"Hello"}}}' \
     --http2 https://api.sandbox.push.apple.com/3/device/$DEVICE_TOKEN
   ```
   Expected:
   - ✅ HTTP/2 200 → payload accepted
   - ❌ 400 BadDeviceToken → token format wrong or expired
   - ❌ 403 ExpiredProviderToken → JWT older than 1 hour
   - ❌ 410 Unregistered → app uninstalled or token invalidated

   **Step 4: Check Authorization Status**
   ```swift
   let settings = await UNUserNotificationCenter.current().notificationSettings()
   print("Authorization: \(settings.authorizationStatus.rawValue)")
   print("Alert: \(settings.alertSetting.rawValue)")
   print("Sound: \(settings.soundSetting.rawValue)")
   print("Badge: \(settings.badgeSetting.rawValue)")
   ```
   Expected:
   - ✅ authorizationStatus = 2 (authorized)
   - ⚠️ authorizationStatus = 1 (denied) → user turned off notifications
   - ⚠️ authorizationStatus = 3 (provisional) → may not show banners

5. **Decision Trees** — 6 trees in ASCII format:

   **Tree 1: "Not receiving any notifications"**
   ```
   Not receiving notifications?
   │
   ├─ Check Step 1 (entitlements)
   │  ├─ No aps-environment → Add Push Notification capability in Xcode
   │  └─ Has aps-environment → Continue
   │
   ├─ Check Step 2 (token)
   │  ├─ Registration failed → Check provisioning profile matches bundle ID
   │  ├─ No callback → Call registerForRemoteNotifications() at launch
   │  └─ Got token → Continue
   │
   ├─ Check Step 3 (payload)
   │  ├─ 400 error → Fix payload JSON structure
   │  ├─ 403 error → Regenerate JWT token
   │  ├─ 410 error → Token expired, get fresh token from device
   │  └─ 200 success → Continue
   │
   └─ Check Step 4 (authorization)
      ├─ Denied → User must re-enable in Settings
      ├─ Provisional → Notification in history, not as banner
      └─ Authorized → Check Focus mode / Do Not Disturb
   ```

   **Tree 2: "Works in dev, not production"**
   ```
   Push works in dev but not production?
   │
   ├─ Using correct APNs endpoint?
   │  ├─ Dev build → api.sandbox.push.apple.com
   │  └─ Production/TestFlight → api.push.apple.com
   │
   ├─ Tokens match environment?
   │  └─ Dev and production tokens are DIFFERENT
   │     └─ Server must store and use correct token per environment
   │
   ├─ Using token-based auth?
   │  ├─ Same .p8 key works for both → ✅
   │  └─ Using certificates? Separate dev/production certs needed
   │
   └─ FCM?
      └─ APNs auth key uploaded to Firebase Console?
         ├─ No → Upload .p8 key in Project Settings → Cloud Messaging
         └─ Yes → Check bundle ID matches Firebase config
   ```

   **Tree 3: "Silent notifications not waking app"**
   (content-available throttling, force-quit, background modes)

   **Tree 4: "Rich notification missing media"**
   (mutable-content missing, service extension not added to target, download timeout)

   **Tree 5: "Live Activity not updating via push"**
   (wrong topic format, content-state mismatch, custom JSON encoding, rate limiting)

   **Tree 6: "Notifications stopped after iOS update"**
   (Focus modes, interruption level defaults, provisional authorization behavior change)

6. **Push Notifications Console Workflow** — how to:
   - Navigate to icloud.developer.apple.com/dashboard
   - Send test notifications (select push type, enter token, build payload)
   - Check delivery logs (use apns-id from response header)
   - Validate JWT tokens
   - Generate cURL commands from console UI

7. **Simulator Testing with simctl**
   ```bash
   # Create payload file
   cat > test-push.apns << 'EOF'
   {
     "Simulator Target Bundle": "com.your.bundle.id",
     "aps": {
       "alert": {
         "title": "Test",
         "body": "Hello from simctl"
       },
       "sound": "default"
     }
   }
   EOF

   # Send to booted simulator
   xcrun simctl push booted com.your.bundle.id test-push.apns
   ```
   Limitations:
   - No real APNs token (use for UI testing only)
   - Service extensions DO work in Simulator
   - Cannot test background/silent push behavior accurately

8. **Common FCM Diagnostic** — 3 gotchas:
   - Swizzling conflict detection
   - Token mismatch debugging (FCM vs APNs)
   - Missing APNs key in Firebase Console

9. **Quick Reference Table** — symptom → check → pattern mapping

10. **Checklist** — pre-escalation verification

11. **Resources** — compact format

**Step 3: Validate**

Run: `/review-skill` on the new skill file.

**Step 4: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-push-notifications-diag/SKILL.md
git commit -m "feat: add push-notifications-diag diagnostic skill"
```

---

### Task 4: Update ios-integration Router

**Files:**
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-ios-integration/SKILL.md`

**Step 1: Add Push Notifications to Routing Logic section**

After the "Background Processing" subsection and before "Location Services", add:

```markdown
### Push Notifications

**Push notification implementation** → `/skill axiom-push-notifications`
**Push notification API reference** → `/skill axiom-push-notifications-ref`
**Push notification debugging** → `/skill axiom-push-notifications-diag`
```

**Step 2: Add to Decision Tree**

Add 3 new numbered entries (renumber existing 16-19 to 19-22):

```markdown
16. Push notification implementation, APNs, or remote notification handling? → push-notifications (patterns), push-notifications-ref (API), push-notifications-diag (debugging)
17. Need APNs payload format, headers, or JWT auth details? → push-notifications-ref
18. Push notifications not arriving, token issues, or delivery failures? → push-notifications-diag
```

**Step 3: Add to Anti-Rationalization table**

Add row:
```markdown
| "Push notifications are just a payload and a token" | Token lifecycle, Focus interruption levels, service extension gotchas, and sandbox/production mismatch cause 80% of push bugs. push-notifications covers all. |
```

**Step 4: Add to Cross-Domain Routing section**

After the "Live Activity + push notification issues" subsection, add:

```markdown
**Push notification + Live Activity issues** (push not updating Live Activity):
- Push transport, APNs headers, token management → **stay in ios-integration** (push-notifications, push-notifications-diag)
- ActivityKit UI, attributes, Dynamic Island → **also invoke ios-integration** (extensions-widgets)
- Background execution timing → **also invoke ios-concurrency** if async patterns are involved

**Push notification + background processing** (silent push not triggering background work):
- Push payload and delivery → **stay in ios-integration** (push-notifications-diag)
- Background execution, BGTaskScheduler → **also invoke ios-integration** (background-processing)
```

**Step 5: Add to Example Invocations section**

```markdown
User: "How do I set up push notifications?"
→ Invoke: `/skill axiom-push-notifications`

User: "My push notifications aren't arriving"
→ Invoke: `/skill axiom-push-notifications-diag`

User: "What headers do I need for APNs requests?"
→ Invoke: `/skill axiom-push-notifications-ref`

User: "My Live Activity isn't updating via push"
→ Invoke: `/skill axiom-push-notifications-diag` + also invoke `/skill axiom-extensions-widgets` for ActivityKit UI

User: "How do I test push notifications without a server?"
→ Invoke: `/skill axiom-push-notifications-ref` (command-line testing section)
```

**Step 6: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-ios-integration/SKILL.md
git commit -m "feat: add push notification routing to ios-integration router"
```

---

### Task 5: Add Cross-References to Existing Skills

**Files:**
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-extensions-widgets/SKILL.md`
- Modify: `.claude-plugin/plugins/axiom/skills/axiom-background-processing/SKILL.md` (if it exists)

**Step 1: Update extensions-widgets**

In the Live Activities section (around line 823-889 where push is discussed), add a cross-reference note:

```markdown
> For comprehensive push notification setup (APNs auth, payload format, token management, service extensions), see axiom-push-notifications and axiom-push-notifications-ref. This skill covers the ActivityKit UI and state management side.
```

Add to the Resources section (or create one if missing):
```markdown
## Resources

**Skills**: axiom-extensions-widgets-ref, axiom-push-notifications, axiom-push-notifications-ref
```

**Step 2: Update background-processing (if applicable)**

Add a brief note in the silent push / background wake section:
```markdown
> For silent push notification patterns (content-available payload, throttling limits), see axiom-push-notifications.
```

**Step 3: Commit**

```bash
git add .claude-plugin/plugins/axiom/skills/axiom-extensions-widgets/SKILL.md
git add .claude-plugin/plugins/axiom/skills/axiom-background-processing/SKILL.md
git commit -m "feat: add push-notifications cross-references to existing skills"
```

---

### Task 6: Create VitePress Documentation Pages

**Files:**
- Create: `docs/skills/integration/push-notifications.md`
- Create: `docs/reference/push-notifications-ref.md`
- Create: `docs/diagnostic/push-notifications-diag.md`
- Modify: `docs/skills/integration/index.md`
- Modify: `docs/diagnostic/index.md`

**Step 1: Create discipline doc page**

File: `docs/skills/integration/push-notifications.md`

Follow the camera-capture.md doc page pattern exactly:
```markdown
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

### Permission Flow
- Standard vs provisional authorization patterns
- Contextual permission timing (don't ask on first launch)
- Handling denial and redirecting to Settings

### Token Management
- Device token lifecycle and server sync
- Sandbox vs production environment separation
- FCM dual-token gotcha

### Notification Types
- Alert, silent, background, communication, Time Sensitive, Critical
- Interruption levels and Focus interaction
- Decision tree for choosing the right type

### Payload Design
- Content structure (title, subtitle, body, sound)
- Localized notifications
- Custom data and relevance scoring
- 4KB payload size discipline

### Rich Notifications
- UNNotificationServiceExtension for media enrichment
- End-to-end encryption decryption patterns
- Content extensions for custom UI

### Categories and Actions
- Declaring actionable notification types
- Text input actions
- Handling action responses in delegate

### Live Activity Push Transport
- Push token observation
- Push-start, push-update, push-end flows
- Priority and rate limiting

### Pressure Scenarios
- Shipping push under deadline pressure
- Debugging dev vs production token mismatch
- Resisting Time Sensitive overuse

## Key Pattern

### Minimal Remote Notification Setup

```swift
// Request permission in context
let center = UNUserNotificationCenter.current()
let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
if granted {
    await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
}
```

## Documentation Scope

This page documents the `axiom-push-notifications` skill — push notification patterns Claude uses when helping you implement remote and local notifications. The skill contains permission flow, token management, payload design, extension patterns, communication notifications, Live Activity push transport, and pressure scenarios.

**For diagnostics:** See `push-notifications-diag` for troubleshooting delivery failures, token issues, and Focus suppression.

**For API reference:** See `push-notifications-ref` for comprehensive APNs transport, payload keys, and UNUserNotificationCenter API coverage.

## Related

- `push-notifications-diag` — Troubleshooting push delivery failures, token issues, sandbox/production mismatch
- `push-notifications-ref` — Complete APNs transport, payload format, and notification API reference
- [extensions-widgets](/skills/integration/extensions-widgets) — Live Activity UI, widget timelines, Dynamic Island (use for ActivityKit UI, not push transport)
- [background-processing](/skills/integration/background-processing) — Background execution from silent push notifications

## Resources

**WWDC**: 2021-10091, 2023-10025, 2023-10185, 2024-10069

**Docs**: /usernotifications, /usernotifications/unusernotificationcenter
```

**Step 2: Create reference doc page**

File: `docs/reference/push-notifications-ref.md`

Follow existing reference doc page patterns. Include: When to Use, Example Prompts, What's Covered (5-10 bullets), Documentation Scope, Related, Resources.

**Step 3: Create diagnostic doc page**

File: `docs/diagnostic/push-notifications-diag.md`

Follow existing diagnostic doc page patterns. Include: Symptoms This Diagnoses, Example Prompts, Diagnostic Workflow summary, Related, Resources.

**Step 4: Update integration index page**

File: `docs/skills/integration/index.md`

Add push-notifications to the mermaid diagram (in the "Skills" subgraph):
```
push_notifications["push-notifications"]:::discipline
```

Add to the "Available Skills" section (between existing entries, alphabetical or logical order):

```markdown
### [Push Notifications](./push-notifications)

Remote and local notification implementation for iOS:
- **Permission flow** — Standard, provisional, contextual timing
- **Token management** — APNs device token lifecycle, server sync
- **Payload design** — Alert, silent, localized, custom data
- **Rich notifications** — Service extensions, media attachments
- **Communication notifications** — Avatars, Focus integration (iOS 15+)
- **Live Activity push** — Push-start, push-update, push-end transport

**When to use** Setting up APNs, designing notification payloads, implementing actionable or rich notifications, debugging delivery issues

**Requirements** iOS 10+ (core), iOS 15+ (communication/time-sensitive), iOS 18+ (broadcast push)
```

Also add push-notifications-ref to the "References" subgraph in the mermaid diagram, and push-notifications-diag to the diagram if diagnostics are shown.

**Step 5: Update diagnostic index page**

File: `docs/diagnostic/index.md`

Add row to the table:
```markdown
| [**push-notifications-diag**](./push-notifications-diag) | Notifications not arriving, token registration failed, works in dev not production, silent push throttled, rich media missing — push notification diagnostics with delivery log analysis |
```

**Step 6: Validate VitePress build**

Run: `npm run docs:build`

Expected: Build succeeds with no dead links.

**Step 7: Commit**

```bash
git add docs/skills/integration/push-notifications.md
git add docs/reference/push-notifications-ref.md
git add docs/diagnostic/push-notifications-diag.md
git add docs/skills/integration/index.md
git add docs/diagnostic/index.md
git commit -m "docs: add push notifications documentation pages"
```

---

### Task 7: Rebuild MCP Server Bundle

**Files:**
- None created (build artifact)

**Step 1: Rebuild the bundle**

```bash
cd axiom-mcp && pnpm run build:bundle
```

This regenerates `bundle.json` with the 3 new skills included.

**Step 2: Verify new skills in bundle**

```bash
cd axiom-mcp && node -e "
const bundle = require('./dist/bundle.json');
const pushSkills = bundle.skills?.filter(s => s.name?.includes('push-notification')) || [];
console.log('Push notification skills found:', pushSkills.length);
pushSkills.forEach(s => console.log(' -', s.name));
"
```

Expected: 3 skills found (push-notifications, push-notifications-ref, push-notifications-diag).

**Step 3: Commit**

```bash
git add axiom-mcp/dist/bundle.json
git commit -m "chore: rebuild MCP server bundle with push notification skills"
```

---

### Task 8: Final Validation

**Step 1: Validate character budget**

```bash
node -e "
const data = require('./.claude-plugin/plugins/axiom/claude-code.json');
let total = 0;
data.skills.forEach(s => total += s.description.length);
console.log('Manifest chars:', total, '/ 15000');
console.log('Status:', total <= 15000 ? '✓ UNDER' : '✗ OVER');
"
```

Note: The 3 new skills are NOT added to the manifest — they route through ios-integration. Budget should be unchanged.

**Step 2: Validate VitePress build**

```bash
npm run docs:build
```

Expected: Clean build, no dead links.

**Step 3: Verify skill count**

```bash
ls -d .claude-plugin/plugins/axiom/skills/axiom-push-notifications*/
```

Expected: 3 directories.

**Step 4: Run review on all 3 skills**

Invoke `/review-skill` on each of the 3 new SKILL.md files to validate against Axiom quality standards.

**Step 5: Final git status check**

```bash
git status
git log --oneline -5
```

Expected: All changes committed across 5-6 commits.

---

## Summary

| Task | Files | Commit |
|------|-------|--------|
| 1. Discipline skill | 1 new | `feat: add push-notifications discipline skill` |
| 2. Reference skill | 1 new | `feat: add push-notifications-ref API reference skill` |
| 3. Diagnostic skill | 1 new | `feat: add push-notifications-diag diagnostic skill` |
| 4. Router update | 1 modified | `feat: add push notification routing to ios-integration router` |
| 5. Cross-references | 2 modified | `feat: add push-notifications cross-references to existing skills` |
| 6. Doc pages | 3 new + 2 modified | `docs: add push notifications documentation pages` |
| 7. MCP bundle | 1 regenerated | `chore: rebuild MCP server bundle with push notification skills` |
| 8. Validation | 0 | (no commit — verification only) |
