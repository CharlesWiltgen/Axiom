
# Push Notifications

Remote and local notification patterns for iOS. Covers permission flow, APNs registration, token management, payload design, actionable notifications, rich notifications with service extensions, communication notifications, Focus interaction, and Live Activity push transport.

## When to Use This Skill

Use when you need to:
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

## Example Prompts

"How do I set up push notifications?"
"When should I ask for notification permission?"
"My push notifications aren't arriving"
"How do I add buttons to notifications?"
"How do I show images in push notifications?"
"How do I send push updates to a Live Activity?"
"What's the difference between APNs token and FCM token?"
"How do I make notifications break through Focus mode?"
"My notifications work in development but not production"
"How do I handle notification taps to open a specific screen?"

## Red Flags

Signs you're making this harder than it needs to be:

- ❌ Requesting permission on first launch before user understands value
- ❌ Caching device tokens locally instead of requesting fresh each launch
- ❌ Sending the same token to sandbox AND production APNs
- ❌ Using `content-available: 1` without understanding silent push throttling (~2-3/hour)
- ❌ Not implementing `serviceExtensionTimeWillExpire` fallback
- ❌ Force-unwrapping device token or assuming registration always succeeds
- ❌ Hardcoding APNs host instead of switching sandbox/production by environment
- ❌ Setting `apns-priority: 10` for all notifications (drains battery, gets throttled)
- ❌ Exceeding 4KB payload without realizing APNs silently rejects it
- ❌ Using FCM without disabling method swizzling when you have custom delegate handling
- ❌ Not handling foreground notification presentation (notifications silently dropped)
- ❌ Overusing Time Sensitive interruption level (erodes user trust, they'll disable all notifications)

## Mandatory First Steps

Before implementing any push notification feature:

### 1. Enable Push Notification Capability

- Xcode: Target → Signing & Capabilities → + Push Notifications
- Adds `aps-environment` entitlement
- Verify in Apple Developer Portal that the App ID has Push Notifications enabled

### 2. Register for Remote Notifications

```swift
// AppDelegate
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    UIApplication.shared.registerForRemoteNotifications()
    return true
}

func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    sendTokenToServer(token) // Never cache locally — tokens change
}

func application(_ application: UIApplication,
                 didFailToRegisterForRemoteNotificationsWithError error: Error) {
    // Simulator cannot register. Log, don't crash.
}
```

### 3. Request Authorization (in context, not at launch)

```swift
let center = UNUserNotificationCenter.current()
let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
if granted {
    await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
}
```

Request when user action makes notification value obvious (e.g., after scheduling a reminder, subscribing to updates). The system prompts only once — bad timing means permanent denial.

## Permission Flow

### Pattern 1: Standard Authorization

Request in context after user understands the value:

```swift
func subscribeToUpdates() async {
    let center = UNUserNotificationCenter.current()
    let settings = await center.notificationSettings()

    switch settings.authorizationStatus {
    case .notDetermined:
        let granted = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
        if granted == true {
            await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
        }
    case .authorized, .provisional:
        // Already have permission
        break
    case .denied:
        // Redirect to Settings
        promptToOpenSettings()
    case .ephemeral:
        break
    @unknown default:
        break
    }
}
```

### Pattern 2: Provisional Authorization (iOS 12+)

Notifications appear quietly in Notification Center with Keep/Turn Off buttons. No permission dialog shown to user.

```swift
let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge, .provisional])
```

Good for apps where users haven't yet discovered notification value. They see notifications quietly and choose to promote them.

### Pattern 3: Authorization Status Check

Always check before scheduling or assuming permission:

```swift
let settings = await UNUserNotificationCenter.current().notificationSettings()
guard settings.authorizationStatus == .authorized else {
    // Handle missing permission
    return
}
```

### Pattern 4: Handling Denial

Redirect to Settings when user has denied:

```swift
func promptToOpenSettings() {
    // iOS 16+
    if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
        UIApplication.shared.open(url)
    } else {
        // Fallback: general app settings
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}
```

## Token Management

### Token Format

```swift
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    sendTokenToServer(token)
}
```

### Key Rules

- **Never cache locally** — request fresh at every app launch via `registerForRemoteNotifications()`
- **Sandbox ≠ production** — tokens are different per APNs environment, endpoints are different (`api.sandbox.push.apple.com` vs `api.push.apple.com`)
- **Server sync** — send token + bundle ID + user ID + environment (sandbox/production) to your server
- **Tokens change** after backup restore, device migration, reinstall, or OS updates

## Notification Types Decision Tree

```
What type of notification?
│
├─ Alert (user-visible)
│  ├─ Passive — informational, no sound, appears in history
│  │  interruption-level: "passive"
│  │
│  ├─ Active — default, sound + banner
│  │  interruption-level: "active" (or omit, it's default)
│  │
│  ├─ Time Sensitive — breaks through scheduled summary, not Focus
│  │  interruption-level: "time-sensitive"
│  │  Requires: Time Sensitive Notifications capability
│  │
│  └─ Critical — breaks through Do Not Disturb and mute switch
│     interruption-level: "critical"
│     Requires: Apple entitlement approval (medical, safety, security)
│
├─ Communication (iOS 15+)
│  Shows sender avatar, name, breaks Focus for allowed contacts
│  Requires: INSendMessageIntent + Communication Notifications capability
│  Configured in service extension via content.updating(from: intent)
│
├─ Silent / Background
│  content-available: 1, no alert/sound/badge
│  Throttled to ~2-3 per hour
│  apns-priority: 5 (MUST be 5, not 10)
│  App gets ~30 seconds background execution
│
└─ Live Activity
   apns-push-type: liveactivity
   apns-topic: {bundleID}.push-type.liveactivity
   Updates/starts/ends Live Activities remotely
```

## Payload Design Patterns

### Basic Alert

```json
{
  "aps": {
    "alert": {
      "title": "New Message",
      "subtitle": "From Alice",
      "body": "Hey, are you free for lunch?"
    },
    "sound": "default",
    "badge": 3
  }
}
```

### Sound Options

```json
{
  "aps": {
    "alert": { "title": "Notification", "body": "With custom sound" },
    "sound": "custom-sound.aiff"
  }
}
```

Critical alert (requires Apple entitlement):
```json
{
  "aps": {
    "alert": { "title": "Emergency", "body": "Critical alert" },
    "sound": {
      "critical": 1,
      "name": "alarm.aiff",
      "volume": 0.8
    }
  }
}
```

### Badge

```json
{
  "aps": {
    "badge": 5
  }
}
```

Set to `0` to remove badge.

### Localized Content

```json
{
  "aps": {
    "alert": {
      "loc-key": "NEW_MESSAGE_FORMAT",
      "loc-args": ["Alice", "lunch"]
    }
  }
}
```

### Custom Data

Place custom data outside the `aps` dictionary:

```json
{
  "aps": {
    "alert": { "title": "Order Update", "body": "Your order shipped" }
  },
  "orderId": "12345",
  "deepLink": "/orders/12345"
}
```

### Relevance Score and Thread ID

```json
{
  "aps": {
    "alert": { "title": "Breaking News", "body": "..." },
    "relevance-score": 0.8,
    "thread-id": "news-breaking",
    "interruption-level": "time-sensitive"
  }
}
```

- `relevance-score` (0.0–1.0): ranking for notification summary (iOS 15+)
- `thread-id`: groups notifications into conversations in Notification Center

### Payload Size Limits

| Type | Max Size |
|------|----------|
| Standard push | 4KB |
| VoIP push | 5KB |
| Live Activity | 4KB |

APNs silently rejects oversized payloads. No error returned to sender.

## Categories and Actions

### Register Categories at Launch

```swift
func registerNotificationCategories() {
    let replyAction = UNTextInputNotificationAction(
        identifier: "REPLY_ACTION",
        title: "Reply",
        options: [])

    // iOS 15+: actions with icons
    let likeIcon = UNNotificationActionIcon(systemImageName: "hand.thumbsup")
    let likeAction = UNNotificationAction(
        identifier: "LIKE_ACTION",
        title: "Like",
        options: [],
        icon: likeIcon)

    let messageCategory = UNNotificationCategory(
        identifier: "MESSAGE",
        actions: [replyAction, likeAction],
        intentIdentifiers: [],
        options: [.customDismissAction])

    UNUserNotificationCenter.current().setNotificationCategories([messageCategory])
}
```

### Set Category in Payload

```json
{
  "aps": {
    "alert": { "title": "Alice", "body": "Are you free?" },
    "category": "MESSAGE"
  }
}
```

### Handle Action Response

```swift
extension AppDelegate: UNUserNotificationCenterDelegate {
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
            // User tapped the notification itself
            handleNotificationTap(userInfo: userInfo)
        case UNNotificationDismissActionIdentifier:
            // User dismissed (requires .customDismissAction on category)
            handleDismiss(userInfo: userInfo)
        default:
            break
        }

        completionHandler()
    }
}
```

## Service Extension Patterns

### Pattern 1: Media Enrichment

Download and attach images, audio, or video to notifications.

**Payload requirement**: Must include `"mutable-content": 1`:

```json
{
  "aps": {
    "alert": { "title": "Photo", "body": "Alice sent a photo" },
    "mutable-content": 1
  },
  "imageURL": "https://example.com/photo.jpg"
}
```

**Service extension**:

```swift
class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler:
                                @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

        guard let bestAttemptContent,
              let imageURLString = bestAttemptContent.userInfo["imageURL"] as? String,
              let imageURL = URL(string: imageURLString) else {
            contentHandler(request.content)
            return
        }

        // Download image
        let task = URLSession.shared.downloadTask(with: imageURL) { [weak self] url, _, error in
            guard let self, let url, error == nil else {
                contentHandler(self?.bestAttemptContent ?? request.content)
                return
            }

            // Move to tmp with proper extension
            let tmpURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("jpg")
            try? FileManager.default.moveItem(at: url, to: tmpURL)

            if let attachment = try? UNNotificationAttachment(identifier: "image",
                                                               url: tmpURL,
                                                               options: nil) {
                bestAttemptContent.attachments = [attachment]
            }

            contentHandler(bestAttemptContent)
        }
        task.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        // 30-second window exceeded — deliver what we have
        if let contentHandler, let bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
}
```

### Pattern 2: End-to-End Decryption

Decrypt payload in service extension before display:

```swift
override func didReceive(_ request: UNNotificationRequest,
                         withContentHandler contentHandler:
                            @escaping (UNNotificationContent) -> Void) {
    self.contentHandler = contentHandler
    bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

    guard let bestAttemptContent,
          let encryptedBody = bestAttemptContent.userInfo["encryptedBody"] as? String else {
        contentHandler(request.content)
        return
    }

    if let decrypted = decrypt(encryptedBody) {
        bestAttemptContent.body = decrypted
    } else {
        bestAttemptContent.body = "(Encrypted message)"
    }

    contentHandler(bestAttemptContent)
}

override func serviceExtensionTimeWillExpire() {
    if let contentHandler, let bestAttemptContent {
        bestAttemptContent.body = "(Encrypted message)"
        contentHandler(bestAttemptContent)
    }
}
```

**30-second processing window**: If `didReceive` doesn't call `contentHandler` within ~30 seconds, `serviceExtensionTimeWillExpire` is called. Always deliver `bestAttemptContent` as fallback — if neither method calls the handler, the notification vanishes entirely.

## Communication Notifications (iOS 15+)

Show sender avatar and name. Can break through Focus for allowed contacts.

```swift
// In your Notification Service Extension
import Intents

override func didReceive(_ request: UNNotificationRequest,
                         withContentHandler contentHandler:
                            @escaping (UNNotificationContent) -> Void) {
    guard let bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent else {
        contentHandler(request.content)
        return
    }

    // 1. Create sender persona
    let senderImage = INImage(url: avatarURL) // or INImage(imageData:)
    let sender = INPerson(
        personHandle: INPersonHandle(value: "alice@example.com", type: .emailAddress),
        nameComponents: nil,
        displayName: "Alice",
        image: senderImage,
        contactIdentifier: nil,
        customIdentifier: "user-alice-123"
    )

    // 2. Create message intent
    let intent = INSendMessageIntent(
        recipients: nil,       // nil for 1:1, set for group
        outgoingMessageType: .outgoingMessageText,
        content: bestAttemptContent.body,
        speakableGroupName: nil, // set for group conversations
        conversationIdentifier: "conversation-123",
        serviceName: nil,
        sender: sender,
        attachments: nil
    )

    // 3. Donate interaction
    let interaction = INInteraction(intent: intent, response: nil)
    interaction.direction = .incoming
    interaction.donate(completion: nil)

    // 4. Update content with intent
    do {
        let updatedContent = try bestAttemptContent.updating(from: intent)
        contentHandler(updatedContent)
    } catch {
        contentHandler(bestAttemptContent)
    }
}
```

**Requirements**:
- Communication Notifications capability in Xcode
- Notification Service Extension target
- `mutable-content: 1` in payload

**Focus breakthrough**: Communication notifications from contacts the user has allowed in Focus settings will break through. Use sparingly — overuse erodes trust.

## Foreground Notification Handling

Without this delegate method, notifications received while the app is in foreground are **silently dropped**:

```swift
extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler:
                                    @escaping (UNNotificationPresentationOptions) -> Void) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
}
```

Set `UNUserNotificationCenter.current().delegate = self` in `didFinishLaunchingWithOptions` — before the app finishes launching.

## Live Activity Push Transport

Push updates to Live Activities remotely via APNs.

### Observe Push Token

```swift
let activity = try Activity<OrderAttributes>.request(
    attributes: attributes,
    content: initialContent,
    pushType: .token
)

Task {
    for await pushToken in activity.pushTokenUpdates {
        let pushTokenString = pushToken.reduce("") {
            $0 + String(format: "%02x", $1)
        }
        try await sendPushToken(pushTokenString: pushTokenString)
    }
}
```

### APNs Headers for Live Activity

| Header | Value |
|--------|-------|
| apns-push-type | `liveactivity` |
| apns-topic | `{bundleID}.push-type.liveactivity` |
| apns-priority | `5` (routine) or `10` (time-sensitive) |

### Update Payload

```json
{
  "aps": {
    "timestamp": 1234567890,
    "event": "update",
    "content-state": {
      "currentStep": "outForDelivery",
      "estimatedArrival": "2:30 PM"
    },
    "stale-date": 1234571490,
    "dismissal-date": 1234575090,
    "relevance-score": 75.0
  }
}
```

### Event Types

| Event | Purpose |
|-------|---------|
| `update` | Update content-state |
| `start` | Start a new Live Activity remotely (iOS 17.2+) |
| `end` | End the activity |

### Key Rules

- `content-state` **must match** `ActivityAttributes.ContentState` exactly — no custom JSON encoding strategies, property names must be identical
- `timestamp` is required — APNs uses it to discard stale updates
- `stale-date` shows a visual indicator that data is outdated
- `dismissal-date` controls when an ended activity disappears from Lock Screen
- `relevance-score` orders multiple active Live Activities
- Priority budget enforced — excessive `apns-priority: 10` gets throttled
- Add `NSSupportsLiveActivitiesFrequentUpdates` to Info.plist for high-frequency apps (sports, navigation)

For ActivityKit UI, attributes, and Dynamic Island layout, see references/extensions-widgets.md.

## Broadcast Push (iOS 18+)

Channel-based delivery for large audiences (sports scores, flight status, breaking news).

### Setup

1. Enable Broadcast Push Notifications capability in Apple Developer Portal
2. Create channels via Apple's Broadcast Push API

### Subscribe to Channel

```swift
let activity = try Activity<ScoreAttributes>.request(
    attributes: attributes,
    content: initialContent,
    pushType: .channel(channelId)
)
```

### Server Sends to Channel

```
POST /4/broadcasts/apps/{TOPIC}
```

### Key Rules

- Only available for Live Activities (not regular push)
- Channel storage policies: **No Storage** (higher budget) vs **Most Recent Message** (stores last update)
- Manage channel lifecycle — delete unused channels (total active channels are limited)
- Channels are identified by opaque IDs, not user-facing names
- More efficient than per-device token delivery for 1-to-many scenarios

## FCM as Provider

If using Firebase Cloud Messaging as your push provider, watch for these gotchas:

### 1. Swizzling Trap

FCM swizzles `UNUserNotificationCenterDelegate` methods and `didRegisterForRemoteNotifications` by default. If you have custom delegate handling, they conflict.

**Fix**: Set in Info.plist:
```xml
<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
```

Then manually pass the APNs token to FCM:
```swift
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
}
```

### 2. Dual Token Confusion

FCM token ≠ APNs device token. They are completely different. Send the correct one to the correct backend.

- FCM token → your server (for sending via FCM)
- APNs token → only needed if sending directly via APNs

### 3. APNs Auth Key Upload

Upload your .p8 APNs authentication key to Firebase Console → Project Settings → Cloud Messaging. Without this, development builds work (FCM uses sandbox automatically) but production builds silently fail.

### 4. Silent Push Payload Size

FCM's `content_available` maps to APNs `content-available`, but FCM may add extra fields to the payload. Monitor total size to avoid exceeding the 4KB limit.

## Anti-Patterns

### Anti-Pattern 1: Requesting Permission at App Launch

**Wrong**:
```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    return true
}
```

**Right**:
```swift
// After user taps "Subscribe to updates" or completes onboarding
func subscribeButtonTapped() async {
    let granted = try? await UNUserNotificationCenter.current()
        .requestAuthorization(options: [.alert, .sound, .badge])
    if granted == true {
        await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
    }
}
```

**Why it matters**: The system only shows the permission dialog once. If the user hasn't seen value yet, they tap "Don't Allow" reflexively. ~60% of users who deny never re-enable in Settings. You get one shot.

### Anti-Pattern 2: Caching Device Tokens

**Wrong**:
```swift
func application(_ app: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
    let tokenString = token.map { String(format: "%02x", $0) }.joined()
    UserDefaults.standard.set(tokenString, forKey: "pushToken") // Stale after restore
}
```

**Right**:
```swift
func application(_ app: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
    let tokenString = token.map { String(format: "%02x", $0) }.joined()
    sendTokenToServer(tokenString) // Fresh every launch
}
```

**Why it matters**: Tokens change after backup restore, device migration, reinstall, and sometimes after OS updates. A stale cached token means your server sends to a token APNs no longer recognizes — notifications silently vanish.

### Anti-Pattern 3: Ignoring Service Extension Timeout

**Wrong**:
```swift
override func didReceive(_ request: UNNotificationRequest,
                         withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    // Download large image, no timeout handling
    downloadImage(from: url) { image in
        // If this takes >30 seconds, notification vanishes entirely
        contentHandler(modifiedContent)
    }
}
// serviceExtensionTimeWillExpire not implemented
```

**Right**:
```swift
override func serviceExtensionTimeWillExpire() {
    if let contentHandler, let bestAttemptContent {
        // Deliver whatever we have — text without image is better than nothing
        contentHandler(bestAttemptContent)
    }
}
```

**Why it matters**: The service extension has a ~30 second window. If neither `didReceive` nor `serviceExtensionTimeWillExpire` calls the content handler, the notification disappears completely. Users never see it.

### Anti-Pattern 4: Using Time Sensitive for Everything

**Wrong**:
```json
{
  "aps": {
    "alert": { "title": "Weekly Newsletter", "body": "Check out this week's articles" },
    "interruption-level": "time-sensitive"
  }
}
```

**Right**:
```json
{
  "aps": {
    "alert": { "title": "Weekly Newsletter", "body": "Check out this week's articles" },
    "interruption-level": "passive"
  }
}
```

**Why it matters**: iOS shows users which apps overuse Time Sensitive. Users who feel interrupted will disable ALL notifications from your app — not just Time Sensitive ones. Reserve it for genuinely time-bound events (delivery arriving, meeting starting, security alerts). Apple can also revoke the capability.

## Pressure Scenarios

### Scenario 1: "Ship Push Notifications by Friday"

**Context**: PM needs push notifications working for a demo.

**Pressure**: "Just ask for permission at launch, we'll fix it later."

**Reality**: The system only prompts once. If the user denies, you need them to manually enable in Settings. ~60% of users never do. "Fix it later" means permanently lower opt-in rates.

**Correct action**:
1. Implement push registration and delivery without the permission prompt first
2. Add contextual permission request after a user action that makes notification value obvious
3. Test both grant and deny flows end-to-end

**Push-back template**: "Permission timing directly affects our opt-in rate. A 2-hour investment now prevents a 30% lower notification reach permanently. Let me implement the contextual prompt — it's the same amount of code, just in the right place."

### Scenario 2: "Notifications Work in Dev but Not Production"

**Context**: App Store build doesn't receive push notifications.

**Pressure**: "Something is wrong with APNs, let's file a radar."

**Reality**: 95% of the time it's a sandbox/production token mismatch. Dev builds use `api.sandbox.push.apple.com`, production uses `api.push.apple.com`. Tokens are different per environment. The same token sent to the wrong endpoint silently fails.

**Correct action**:
1. Verify server is using the correct APNs endpoint for the build type
2. Check that the token was obtained from a production build (not a dev/TestFlight token sent to production endpoint)
3. If using FCM, verify the APNs authentication key (.p8) is uploaded to Firebase Console

**Push-back template**: "Before filing a radar, let me verify our token/environment configuration. This is the number one cause of 'works in dev, not production' and takes 5 minutes to check."

### Scenario 3: "Just Send Everything as Time Sensitive"

**Context**: Product wants maximum notification visibility.

**Pressure**: "Users need to see our notifications immediately."

**Reality**: iOS shows users which apps overuse Time Sensitive. Users who feel interrupted will disable ALL notifications from your app — not just Time Sensitive. Apple can also revoke the entitlement for abuse.

**Correct action**:
1. Classify notifications by genuine urgency
2. Use `passive` for informational, `active` (default) for normal engagement, `time-sensitive` only for truly time-bound events
3. Document the classification for the team so backend engineers apply the right level

**Push-back template**: "Overusing Time Sensitive will cause users to disable our notifications entirely. Let's classify by urgency — most notifications should be active, with time-sensitive reserved for genuinely time-bound events like delivery arrivals or expiring offers."

## Checklist

Before shipping push notifications:

**Entitlements**:
- ☑ Push Notifications capability added in Xcode
- ☑ Provisioning profile includes aps-environment
- ☑ Communication Notifications capability (if using communication type)

**Permissions**:
- ☑ Authorization requested in context (not at launch)
- ☑ Denial handled gracefully (Settings redirect or degraded experience)
- ☑ Authorization status checked before scheduling
- ☑ Provisional authorization considered for trial period

**Token Management**:
- ☑ Token sent to server on every launch (never cached)
- ☑ Server stores token per environment (sandbox/production)
- ☑ Token refresh handled (pushTokenUpdates for Live Activities)

**Payload**:
- ☑ Payload under 4KB (5KB for VoIP)
- ☑ Category identifier matches registered categories
- ☑ Interruption level appropriate for content urgency
- ☑ Custom data placed outside aps dictionary

**Service Extension** (if applicable):
- ☑ mutable-content: 1 set in payload
- ☑ serviceExtensionTimeWillExpire delivers fallback content
- ☑ App group configured for shared data access

**Testing**:
- ☑ Tested with Push Notifications Console or curl
- ☑ Tested both foreground and background delivery
- ☑ Tested on physical device (Simulator has no APNs token)

## Resources

**WWDC**: 2021-10091, 2023-10025, 2023-10185, 2024-10069

**Docs**: /usernotifications, /usernotifications/unusernotificationcenter, /activitykit

**Skills**: references/push-notifications-ref.md, references/push-notifications-diag.md, references/extensions-widgets.md, references/background-processing.md
