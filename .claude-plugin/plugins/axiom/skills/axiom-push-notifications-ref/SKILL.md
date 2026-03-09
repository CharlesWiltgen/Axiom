---
name: axiom-push-notifications-ref
description: Push notifications API reference — APNs HTTP/2 transport, JWT auth, payload keys, UNUserNotificationCenter, UNNotificationCategory, UNNotificationServiceExtension, Live Activity push headers, broadcast push, command-line testing
license: MIT
compatibility: iOS 10+, iPadOS 10+, watchOS 3+, macOS 10.14+, tvOS 10+
metadata:
  version: "1.0.0"
  last-updated: "2026-03-09"
---

# Push Notifications API Reference

Comprehensive API reference for APNs HTTP/2 transport, UserNotifications framework, and push-driven features including Live Activities and broadcast push.

## Quick Reference

```swift
// AppDelegate — minimal remote notification setup
class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        sendTokenToServer(token)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Registration failed: \(error)")
    }

    // Show notifications when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        return [.banner, .sound, .badge]
    }

    // Handle notification tap / action response
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let userInfo = response.notification.request.content.userInfo
        // Route to appropriate screen based on userInfo
    }
}
```

---

## APNs Transport Reference

### Endpoints

| Environment | Host | Port |
|-------------|------|------|
| Development | api.sandbox.push.apple.com | 443 or 2197 |
| Production | api.push.apple.com | 443 or 2197 |

### Request Format

```
POST /3/device/{device_token}
Host: api.push.apple.com
Authorization: bearer {jwt_token}
apns-topic: {bundle_id}
apns-push-type: alert
Content-Type: application/json
```

### APNs Headers

| Header | Required | Values | Notes |
|--------|----------|--------|-------|
| apns-push-type | Yes | alert, background, liveactivity, voip, complication, fileprovider, mdm, location | Must match payload content |
| apns-topic | Yes | Bundle ID (or .push-type.liveactivity suffix) | Required for token-based auth |
| apns-priority | No | 10 (immediate), 5 (power-conscious), 1 (low) | Default: 10 for alert, 5 for background |
| apns-expiration | No | UNIX timestamp or 0 | 0 = deliver once, don't store |
| apns-collapse-id | No | String ≤64 bytes | Replaces matching notification on device |
| apns-id | No | UUID (lowercase) | Returned by APNs for tracking |
| authorization | Token auth | bearer {JWT} | Not needed for certificate auth |
| apns-unique-id | Response only | UUID | Use with Push Notifications Console delivery log |

### Response Codes

| Status | Meaning | Common Cause |
|--------|---------|--------------|
| 200 | Success | |
| 400 | Bad request | Malformed JSON, missing required header |
| 403 | Forbidden | Expired JWT, wrong team/key, topic mismatch |
| 404 | Not found | Invalid device token path |
| 405 | Method not allowed | Not using POST |
| 410 | Unregistered | Device token no longer active (app uninstalled) |
| 413 | Payload too large | Exceeds 4KB (5KB for VoIP) |
| 429 | Too many requests | Rate limited by APNs |
| 500 | Internal server error | APNs issue, retry |
| 503 | Service unavailable | APNs overloaded, retry with backoff |

---

## JWT Authentication Reference

### JWT Header

```json
{ "alg": "ES256", "kid": "{10-char Key ID}" }
```

### JWT Claims

```json
{ "iss": "{10-char Team ID}", "iat": {unix_timestamp} }
```

### Rules

| Rule | Detail |
|------|--------|
| Algorithm | ES256 (P-256 curve) |
| Signing key | APNs auth key (.p8 from developer portal) |
| Token lifetime | Max 1 hour (403 ExpiredProviderToken if older) |
| Refresh interval | Between 20 and 60 minutes |
| Scope | One key works for all apps in team, both environments |

### Authorization Header Format

```
authorization: bearer eyAia2lkIjog...
```

---

## Payload Reference

### `aps` Dictionary Keys

| Key | Type | Purpose | Since |
|-----|------|---------|-------|
| alert | Dict/String | Alert content | iOS 10 |
| badge | Number | App icon badge (0 removes) | iOS 10 |
| sound | String/Dict | Audio playback | iOS 10 |
| thread-id | String | Notification grouping | iOS 10 |
| category | String | Actionable notification type | iOS 10 |
| content-available | Number (1) | Silent background push | iOS 10 |
| mutable-content | Number (1) | Triggers service extension | iOS 10 |
| target-content-id | String | Window/content identifier | iOS 13 |
| interruption-level | String | passive/active/time-sensitive/critical | iOS 15 |
| relevance-score | Number 0-1 | Notification summary sorting | iOS 15 |
| filter-criteria | String | Focus filter matching | iOS 15 |
| stale-date | Number | UNIX timestamp (Live Activity) | iOS 16.1 |
| content-state | Dict | Live Activity content update | iOS 16.1 |
| timestamp | Number | UNIX timestamp (Live Activity) | iOS 16.1 |
| event | String | start/update/end (Live Activity) | iOS 16.1 |
| dismissal-date | Number | UNIX timestamp (Live Activity) | iOS 16.1 |
| attributes-type | String | Live Activity struct name | iOS 17 |
| attributes | Dict | Live Activity init data | iOS 17 |

### Alert Dictionary Keys

| Key | Type | Purpose |
|-----|------|---------|
| title | String | Short title |
| subtitle | String | Secondary description |
| body | String | Full message |
| launch-image | String | Launch screen filename |
| title-loc-key | String | Localization key for title |
| title-loc-args | [String] | Title format arguments |
| subtitle-loc-key | String | Localization key for subtitle |
| subtitle-loc-args | [String] | Subtitle format arguments |
| loc-key | String | Localization key for body |
| loc-args | [String] | Body format arguments |

### Sound Dictionary (Critical Alerts)

```json
{ "critical": 1, "name": "alarm.aiff", "volume": 0.8 }
```

### Interruption Level Values

| Value | Behavior | Requires |
|-------|----------|----------|
| passive | No sound/wake. Notification summary only. | Nothing |
| active | Default. Sound + banner. | Nothing |
| time-sensitive | Breaks scheduled delivery. Banner persists. | Time Sensitive capability |
| critical | Overrides DND and ringer switch. | Apple approval + entitlement |

### Example Payloads

#### Basic Alert

```json
{
    "aps": {
        "alert": {
            "title": "New Message",
            "subtitle": "From Alice",
            "body": "Hey, are you free for lunch?"
        },
        "badge": 3,
        "sound": "default"
    }
}
```

#### Localized with loc-key/loc-args

```json
{
    "aps": {
        "alert": {
            "title-loc-key": "MESSAGE_TITLE",
            "title-loc-args": ["Alice"],
            "loc-key": "MESSAGE_BODY",
            "loc-args": ["Alice", "lunch"]
        },
        "sound": "default"
    }
}
```

#### Silent Background Push

```json
{
    "aps": {
        "content-available": 1
    },
    "custom-key": "sync-update"
}
```

#### Rich Notification (Service Extension)

```json
{
    "aps": {
        "alert": {
            "title": "Photo shared",
            "body": "Alice shared a photo with you"
        },
        "mutable-content": 1,
        "sound": "default"
    },
    "image-url": "https://example.com/photo.jpg"
}
```

#### Time-Sensitive with Category

```json
{
    "aps": {
        "alert": {
            "title": "Package Delivered",
            "body": "Your order has been delivered to the front door"
        },
        "interruption-level": "time-sensitive",
        "category": "DELIVERY",
        "sound": "default"
    },
    "order-id": "12345"
}
```

---

## UNUserNotificationCenter API Reference

### Key Methods

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
| supportsContentExtensions | Check content extension support |

### UNAuthorizationOptions

| Option | Purpose |
|--------|---------|
| .alert | Display alerts |
| .badge | Update badge count |
| .sound | Play sounds |
| .carPlay | Show in CarPlay |
| .criticalAlert | Critical alerts (requires entitlement) |
| .provisional | Trial delivery without prompting |
| .providesAppNotificationSettings | "Configure in App" button in Settings |
| .announcement | Siri announcement (deprecated iOS 15+) |

### UNAuthorizationStatus

| Value | Meaning |
|-------|---------|
| .notDetermined | No prompt shown yet |
| .denied | User denied or disabled in Settings |
| .authorized | User explicitly granted |
| .provisional | Provisional trial delivery |
| .ephemeral | App Clip temporary |

### Request Authorization

```swift
let center = UNUserNotificationCenter.current()

let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
if granted {
    await MainActor.run {
        UIApplication.shared.registerForRemoteNotifications()
    }
}
```

### Check Settings

```swift
let settings = await center.notificationSettings()

switch settings.authorizationStatus {
case .authorized: break
case .denied:
    // Direct user to Settings
case .provisional:
    // Upgrade to full authorization
case .notDetermined:
    // Request authorization
case .ephemeral:
    // App Clip — temporary
@unknown default: break
}
```

### Delegate Methods

```swift
// Foreground presentation — called when notification arrives while app is active
func userNotificationCenter(_ center: UNUserNotificationCenter,
                            willPresent notification: UNNotification) async
    -> UNNotificationPresentationOptions {
    return [.banner, .sound, .badge]
}

// Action response — called when user taps notification or action button
func userNotificationCenter(_ center: UNUserNotificationCenter,
                            didReceive response: UNNotificationResponse) async {
    let actionIdentifier = response.actionIdentifier
    let userInfo = response.notification.request.content.userInfo

    switch actionIdentifier {
    case UNNotificationDefaultActionIdentifier:
        // User tapped notification body
        break
    case UNNotificationDismissActionIdentifier:
        // User dismissed (requires .customDismissAction on category)
        break
    default:
        // Custom action
        break
    }
}

// Settings — called when user taps "Configure in App" from notification settings
func userNotificationCenter(_ center: UNUserNotificationCenter,
                            openSettingsFor notification: UNNotification?) {
    // Navigate to in-app notification settings
}
```

---

## UNNotificationCategory and UNNotificationAction API

### Category Registration

```swift
let likeAction = UNNotificationAction(
    identifier: "LIKE",
    title: "Like",
    options: []
)

let replyAction = UNTextInputNotificationAction(
    identifier: "REPLY",
    title: "Reply",
    options: [],
    textInputButtonTitle: "Send",
    textInputPlaceholder: "Type a message..."
)

let deleteAction = UNNotificationAction(
    identifier: "DELETE",
    title: "Delete",
    options: [.destructive, .authenticationRequired]
)

let messageCategory = UNNotificationCategory(
    identifier: "MESSAGE",
    actions: [likeAction, replyAction, deleteAction],
    intentIdentifiers: [],
    hiddenPreviewsBodyPlaceholder: "New message",
    categorySummaryFormat: "%u more messages",
    options: [.customDismissAction]
)

UNUserNotificationCenter.current().setNotificationCategories([messageCategory])
```

### Action Options

| Option | Effect |
|--------|--------|
| .authenticationRequired | Requires device unlock |
| .destructive | Red text display |
| .foreground | Launches app to foreground |

### Category Options

| Option | Effect |
|--------|--------|
| .customDismissAction | Fires delegate on dismiss |
| .allowInCarPlay | Show actions in CarPlay |
| .hiddenPreviewsShowTitle | Show title when previews hidden |
| .hiddenPreviewsShowSubtitle | Show subtitle when previews hidden |
| .allowAnnouncement | Siri can announce (deprecated iOS 15+) |

### UNNotificationActionIcon (iOS 15+)

```swift
let icon = UNNotificationActionIcon(systemImageName: "hand.thumbsup")
let action = UNNotificationAction(
    identifier: "LIKE",
    title: "Like",
    options: [],
    icon: icon
)
```

---

## UNNotificationServiceExtension API

Modifies notification content before display. Runs in a separate extension process.

### Lifecycle

| Method | Window | Purpose |
|--------|--------|---------|
| didReceive(_:withContentHandler:) | ~30 seconds | Modify notification content |
| serviceExtensionTimeWillExpire() | Called at deadline | Deliver best attempt immediately |

### Implementation

```swift
class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let content = bestAttemptContent,
              let imageURLString = content.userInfo["image-url"] as? String,
              let imageURL = URL(string: imageURLString) else {
            contentHandler(request.content)
            return
        }

        // Download and attach image
        let task = URLSession.shared.downloadTask(with: imageURL) { url, _, error in
            defer { contentHandler(content) }
            guard let url = url, error == nil else { return }

            let attachment = try? UNNotificationAttachment(
                identifier: "image",
                url: url,
                options: [UNNotificationAttachmentOptionsTypeHintKey: "public.jpeg"]
            )
            if let attachment = attachment {
                content.attachments = [attachment]
            }
        }
        task.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        if let content = bestAttemptContent {
            contentHandler?(content)
        }
    }
}
```

### Supported Attachment Types

| Type | Extensions | Max Size |
|------|-----------|----------|
| Image | .jpg, .gif, .png | 10 MB |
| Audio | .aif, .wav, .mp3 | 5 MB |
| Video | .mp4, .mpeg | 50 MB |

### Payload Requirement

The notification payload must include `"mutable-content": 1` in the `aps` dictionary for the service extension to fire.

---

## Local Notifications API

### Trigger Types

| Trigger | Use Case | Repeating |
|---------|----------|-----------|
| UNTimeIntervalNotificationTrigger | After N seconds | Yes (≥60s) |
| UNCalendarNotificationTrigger | Specific date/time | Yes |
| UNLocationNotificationTrigger | Enter/exit region | Yes |

### Time Interval Trigger

```swift
let content = UNMutableNotificationContent()
content.title = "Reminder"
content.body = "Time to take a break"
content.sound = .default

let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 300, repeats: false)

let request = UNNotificationRequest(
    identifier: "break-reminder",
    content: content,
    trigger: trigger
)

try await UNUserNotificationCenter.current().add(request)
```

### Calendar Trigger

```swift
var dateComponents = DateComponents()
dateComponents.hour = 9
dateComponents.minute = 0

let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)

let request = UNNotificationRequest(
    identifier: "daily-9am",
    content: content,
    trigger: trigger
)

try await UNUserNotificationCenter.current().add(request)
```

### Location Trigger

```swift
import CoreLocation

let center = CLLocationCoordinate2D(latitude: 37.3349, longitude: -122.0090)
let region = CLCircularRegion(center: center, radius: 100, identifier: "apple-park")
region.notifyOnEntry = true
region.notifyOnExit = false

let trigger = UNLocationNotificationTrigger(region: region, repeats: false)

let request = UNNotificationRequest(
    identifier: "arrived-at-office",
    content: content,
    trigger: trigger
)

try await UNUserNotificationCenter.current().add(request)
```

---

## Live Activity Push Headers

### Required Headers

| Header | Value |
|--------|-------|
| apns-push-type | liveactivity |
| apns-topic | {bundleID}.push-type.liveactivity |
| apns-priority | 5 (routine) or 10 (time-sensitive) |

### Event Types

| Event | Purpose | Required Fields |
|-------|---------|----------------|
| start | Start Live Activity remotely | attributes-type, attributes, content-state, timestamp |
| update | Update content | content-state, timestamp |
| end | End Live Activity | timestamp (content-state optional) |

### Update Payload

```json
{
    "aps": {
        "timestamp": 1709913600,
        "event": "update",
        "content-state": {
            "homeScore": 2,
            "awayScore": 1,
            "inning": "Top 7"
        }
    }
}
```

### Start Payload (Push-to-Start Token)

```json
{
    "aps": {
        "timestamp": 1709913600,
        "event": "start",
        "content-state": {
            "homeScore": 0,
            "awayScore": 0,
            "inning": "Top 1"
        },
        "attributes-type": "GameAttributes",
        "attributes": {
            "homeTeam": "Giants",
            "awayTeam": "Dodgers"
        },
        "alert": {
            "title": "Game Starting",
            "body": "Giants vs Dodgers is about to begin"
        }
    }
}
```

### Start Payload (Channel-Based)

```json
{
    "aps": {
        "timestamp": 1709913600,
        "event": "start",
        "content-state": {
            "homeScore": 0,
            "awayScore": 0,
            "inning": "Top 1"
        },
        "attributes-type": "GameAttributes",
        "attributes": {
            "homeTeam": "Giants",
            "awayTeam": "Dodgers"
        }
    }
}
```

### End Payload

```json
{
    "aps": {
        "timestamp": 1709913600,
        "event": "end",
        "dismissal-date": 1709917200,
        "content-state": {
            "homeScore": 5,
            "awayScore": 3,
            "inning": "Final"
        }
    }
}
```

### Push-to-Start Token

```swift
// Observe push-to-start tokens (iOS 17.2+)
for await token in Activity<GameAttributes>.pushToStartTokenUpdates {
    let tokenString = token.map { String(format: "%02x", $0) }.joined()
    sendPushToStartTokenToServer(tokenString)
}
```

### Activity Push Token

```swift
// Observe activity-specific push tokens
for await tokenData in activity.pushTokenUpdates {
    let token = tokenData.map { String(format: "%02x", $0) }.joined()
    sendActivityTokenToServer(token, activityId: activity.id)
}
```

Content-state encoding rule: the system always uses default JSONDecoder — do not use custom encoding strategies in your ActivityAttributes.ContentState.

---

## Broadcast Push API (iOS 18+)

Server-to-many push for Live Activities without tracking individual device tokens.

### Endpoint

```
POST /4/broadcasts/apps/{TOPIC}
```

### Headers

| Header | Value |
|--------|-------|
| apns-push-type | liveactivity |
| apns-channel-id | {channelID} |
| authorization | bearer {JWT} |

### Subscribe via Channel

```swift
try Activity.request(
    attributes: attributes,
    content: .init(state: initialState, staleDate: nil),
    pushType: .channel(channelId)
)
```

### Channel Storage Policies

| Policy | Behavior | Budget |
|--------|----------|--------|
| No Storage | Deliver only to connected devices | Higher |
| Most Recent Message | Store latest for offline devices | Lower |

---

## Command-Line Testing

### JWT Generation

```bash
JWT_ISSUE_TIME=$(date +%s)
JWT_HEADER=$(printf '{ "alg": "ES256", "kid": "%s" }' "${AUTH_KEY_ID}" | openssl base64 -e -A | tr -- '+/' '-_' | tr -d =)
JWT_CLAIMS=$(printf '{ "iss": "%s", "iat": %d }' "${TEAM_ID}" "${JWT_ISSUE_TIME}" | openssl base64 -e -A | tr -- '+/' '-_' | tr -d =)
JWT_HEADER_CLAIMS="${JWT_HEADER}.${JWT_CLAIMS}"
JWT_SIGNED_HEADER_CLAIMS=$(printf "${JWT_HEADER_CLAIMS}" | openssl dgst -binary -sha256 -sign "${TOKEN_KEY_FILE_NAME}" | openssl base64 -e -A | tr -- '+/' '-_' | tr -d =)
AUTHENTICATION_TOKEN="${JWT_HEADER}.${JWT_CLAIMS}.${JWT_SIGNED_HEADER_CLAIMS}"
```

### Send Alert Push

```bash
curl -v \
  --header "apns-topic: $TOPIC" \
  --header "apns-push-type: alert" \
  --header "authorization: bearer $AUTHENTICATION_TOKEN" \
  --data '{"aps":{"alert":"test"}}' \
  --http2 https://${APNS_HOST_NAME}/3/device/${DEVICE_TOKEN}
```

### Send Live Activity Push

```bash
curl \
  --header "apns-topic: com.example.app.push-type.liveactivity" \
  --header "apns-push-type: liveactivity" \
  --header "apns-priority: 10" \
  --header "authorization: bearer $AUTHENTICATION_TOKEN" \
  --data '{
      "aps": {
          "timestamp": '$(date +%s)',
          "event": "update",
          "content-state": { "score": "2-1" }
      }
  }' \
  --http2 https://api.sandbox.push.apple.com/3/device/$ACTIVITY_PUSH_TOKEN
```

### Simulator Push

```bash
xcrun simctl push booted com.example.app payload.json
```

### Simulator Payload File

```json
{
    "Simulator Target Bundle": "com.example.app",
    "aps": {
        "alert": { "title": "Test", "body": "Hello" },
        "sound": "default"
    }
}
```

---

## Resources

**WWDC**: 2021-10091, 2023-10025, 2023-10185, 2024-10069

**Docs**: /usernotifications, /usernotifications/sending-notification-requests-to-apns, /usernotifications/generating-a-remote-notification, /activitykit

**Skills**: axiom-push-notifications, axiom-push-notifications-diag, axiom-extensions-widgets
