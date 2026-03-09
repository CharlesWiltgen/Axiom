---
name: axiom-push-notifications-diag
description: Use when push notifications fail to arrive, token registration errors occur, notifications work in development but not production, silent push does not wake app, rich notification media is missing, or Live Activity stops updating via push. Covers APNs errors, environment mismatches, Focus mode filtering, service extension failures, FCM diagnostics.
license: MIT
---

# Push Notification Diagnostics

Systematic troubleshooting for push notification failures: missing notifications, token registration errors, environment mismatches, silent push throttling, and service extension problems.

## Overview

**Core Principle**: When push notifications don't work, the problem is usually:
1. **Token/registration failures** (never registered, wrong format, expired) — 30%
2. **Entitlement/provisioning mismatch** (capability missing, wrong environment) — 25%
3. **Payload structure errors** (missing keys, wrong types, invalid JSON) — 15%
4. **Focus/interruption suppression** (iOS 15+ filtering, provisional auth) — 15%
5. **Service extension failures** (timeout, crash, missing mutable-content) — 10%
6. **Delivery timing/throttling** (silent push budget, APNs coalescing) — 5%

**Always verify entitlements and token registration BEFORE debugging payload or delivery logic.**

## Red Flags

Symptoms that indicate push-specific issues:

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

## Mandatory First Steps

Before investigating code, run these diagnostics:

### Step 1: Verify Push Notification Entitlements

```bash
security cms -D -i path/to/embedded.mobileprovision | grep -A1 "aps-environment"
```

**Expected output**:
- ✅ `<string>development</string>` or `<string>production</string>` → Entitlement present
- ❌ No aps-environment key → Push Notifications capability not enabled in Xcode

**How to find the provisioning profile**:
```bash
# For installed app on device
find ~/Library/Developer/Xcode/DerivedData -name "embedded.mobileprovision" -newer . 2>/dev/null | head -3
```

### Step 2: Check Token Registration

```swift
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    print("✅ APNs token: \(token)")
    print("✅ Token length: \(token.count) chars")
}

func application(_ application: UIApplication,
                 didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("❌ Registration failed: \(error.localizedDescription)")
}
```

**Expected output**:
- ✅ 64-character hex token → Registration successful
- ❌ "no valid aps-environment entitlement" → Capability misconfigured
- ❌ No callback fires at all → `registerForRemoteNotifications()` never called

**Critical**: Both callbacks must be in `AppDelegate`, not `SceneDelegate`. SwiftUI apps need `@UIApplicationDelegateAdaptor`.

### Step 3: Validate Payload with curl

```bash
curl -v \
  --header "apns-topic: com.your.bundle.id" \
  --header "apns-push-type: alert" \
  --header "authorization: bearer $JWT_TOKEN" \
  --data '{"aps":{"alert":{"title":"Test","body":"Hello"}}}' \
  --http2 https://api.sandbox.push.apple.com/3/device/$DEVICE_TOKEN
```

**Expected output**:
- ✅ HTTP/2 200 → Payload accepted by APNs
- ❌ 400 BadDeviceToken → Token format wrong or expired
- ❌ 403 ExpiredProviderToken → JWT older than 1 hour
- ❌ 403 InvalidProviderToken → Wrong key ID, team ID, or key
- ❌ 410 Unregistered → App uninstalled or token invalidated
- ❌ 413 PayloadTooLarge → Exceeds 4096 bytes

### Step 4: Check Authorization Status

```swift
let settings = await UNUserNotificationCenter.current().notificationSettings()
print("Authorization: \(settings.authorizationStatus.rawValue)")
print("Alert: \(settings.alertSetting.rawValue)")
print("Sound: \(settings.soundSetting.rawValue)")
print("Badge: \(settings.badgeSetting.rawValue)")
```

**Expected output**:
- ✅ authorizationStatus = 2 → Authorized
- ⚠️ authorizationStatus = 3 → Provisional (appears silently in Notification Center)
- ❌ authorizationStatus = 1 → Denied by user
- ❌ authorizationStatus = 0 → Not determined (never requested)

## Decision Trees

### Tree 1: Not Receiving Any Notifications

```
Not receiving any notifications?
│
├─ Check Step 1 (entitlements)
│  ├─ No aps-environment key?
│  │  └─ Enable Push Notifications in Signing & Capabilities → DONE
│  └─ aps-environment present → continue
│
├─ Check Step 2 (token registration)
│  ├─ didFailToRegister called?
│  │  ├─ "no valid aps-environment" → Regenerate provisioning profile
│  │  └─ Other error → Check network, device (not Simulator)
│  ├─ Neither callback fires?
│  │  └─ Verify registerForRemoteNotifications() called after app launch
│  └─ Token received → continue
│
├─ Check Step 3 (payload delivery)
│  ├─ HTTP 200 but no notification?
│  │  └─ Check Step 4 (authorization status)
│  ├─ 400 BadDeviceToken?
│  │  └─ Token expired or wrong environment → Re-register
│  └─ 403/410 error?
│     └─ Fix auth credentials or re-register device
│
└─ Check Step 4 (user authorization)
   ├─ Status: denied?
   │  └─ User must enable in Settings → Show settings prompt
   ├─ Status: notDetermined?
   │  └─ Call requestAuthorization() → Was never requested
   └─ Status: authorized but still no notifications?
      └─ Check Focus mode, Do Not Disturb, notification grouping
```

### Tree 2: Works in Dev, Not Production

```
Works in development, fails in production?
│
├─ APNs endpoint correct?
│  ├─ Dev: api.sandbox.push.apple.com
│  └─ Prod: api.push.apple.com
│     └─ Using sandbox endpoint with production build? → Switch endpoint
│
├─ Token environment matches?
│  ├─ Dev and production tokens are DIFFERENT
│  │  └─ Server storing dev token, sending to prod APNs? → Re-register on prod build
│  └─ Server distinguishes token environments? → Add environment flag to token storage
│
├─ Auth method correct?
│  ├─ .p8 key (token-based)?
│  │  └─ Same key works for both environments ✅
│  └─ .p12 certificate?
│     ├─ Dev cert → Only works with sandbox
│     └─ Prod cert → Only works with production
│        └─ Wrong cert for environment? → Generate correct certificate
│
└─ Using FCM?
   ├─ APNs auth key (.p8) uploaded to Firebase Console?
   │  └─ Missing? → Upload in Project Settings > Cloud Messaging
   └─ Key uploaded but wrong Team ID?
      └─ Verify Team ID matches Apple Developer account
```

### Tree 3: Silent Notifications Not Waking App

```
Silent push not waking app?
│
├─ Payload correct?
│  ├─ Has "content-available": 1 in aps?
│  │  └─ Missing? → Add to aps dictionary
│  ├─ Has NO "alert", "badge", or "sound" in aps?
│  │  └─ Has alert? → Not a silent push; system treats as visible notification
│  └─ Payload valid → continue
│
├─ Headers correct?
│  ├─ apns-push-type: background?
│  │  └─ Missing or wrong? → Must be "background" for silent push
│  └─ apns-priority: 5?
│     └─ Using 10? → Silent push MUST use priority 5
│
├─ Background mode enabled?
│  ├─ "Remote notifications" checked in Background Modes capability?
│  │  └─ Missing? → Enable in Signing & Capabilities
│  └─ application(_:didReceiveRemoteNotification:fetchCompletionHandler:) implemented?
│     └─ Missing? → Implement the delegate method
│
├─ App state?
│  ├─ Force-quit by user (swiped up)?
│  │  └─ System will NOT wake force-quit apps for silent push
│  └─ Suspended or background?
│     └─ Should wake — continue debugging
│
└─ System throttling?
   ├─ Budget: ~2-3 silent pushes per hour
   │  └─ Exceeding? → Reduce frequency, batch updates
   └─ Device in Low Power Mode?
      └─ Further reduces background execution budget
```

### Tree 4: Rich Notification Missing Media

```
Rich notification not showing image/video?
│
├─ Payload has mutable-content: 1?
│  └─ Missing? → Required for Notification Service Extension to fire
│
├─ Notification Service Extension target exists?
│  ├─ Missing? → File > New > Target > Notification Service Extension
│  └─ Exists → continue
│
├─ Extension bundle ID correct?
│  ├─ Must be: {app-bundle-id}.{extension-name}
│  │  Example: com.myapp.NotificationService
│  └─ Wrong prefix? → Fix bundle ID to match parent app
│
├─ Download completing in time?
│  ├─ Extension has ~30 seconds to modify notification
│  │  └─ Large file? → Use thumbnail URL, not full resolution
│  └─ serviceExtensionTimeWillExpire called?
│     └─ Must deliver bestAttemptContent with fallback text
│
├─ Attachment created correctly?
│  ├─ File written to disk before creating UNNotificationAttachment?
│  │  └─ Must write to tmp directory, then create attachment from file URL
│  └─ File type supported?
│     ├─ Images: JPEG, GIF, PNG (max 10MB)
│     ├─ Audio: AIFF, WAV, MP3, M4A (max 5MB)
│     └─ Video: MPEG, MPEG-2, MP4, AVI (max 50MB)
│
└─ App groups configured?
   └─ Extension and app share data via App Groups?
      └─ Missing? → Add same App Group to both targets
```

### Tree 5: Live Activity Not Updating via Push

```
Live Activity not updating from push?
│
├─ APNs topic correct?
│  ├─ Must be: {bundleID}.push-type.liveactivity
│  │  └─ Using plain bundle ID? → Append .push-type.liveactivity
│  └─ Topic correct → continue
│
├─ Push type header correct?
│  ├─ apns-push-type: liveactivity?
│  │  └─ Using "alert"? → Must be "liveactivity"
│  └─ Correct → continue
│
├─ Content-state matches ActivityAttributes.ContentState?
│  ├─ JSON keys match Swift property names exactly?
│  │  └─ Mismatch? → Decoding fails silently
│  └─ Using custom CodingKeys or JSONEncoder strategies?
│     └─ Custom strategies NOT supported — use default key encoding
│
├─ Push token being sent to server?
│  ├─ Observing pushTokenUpdates on the Activity?
│  │  └─ Missing? → Must iterate Activity.pushTokenUpdates async sequence
│  └─ Token changes when Activity restarts?
│     └─ Must handle token rotation — send updated token to server
│
└─ Rate limiting?
   ├─ Frequent updates: ~10-12 per hour per Activity
   │  └─ Exceeding? → Batch updates, reduce frequency
   └─ Alert updates (sound/vibration): ~3-4 per hour
      └─ Exceeding? → Reserve alerts for critical state changes
```

### Tree 6: Notifications Stopped After iOS Update

```
Notifications stopped working after iOS update?
│
├─ Focus mode auto-enabled? (iOS 15+)
│  ├─ Check Settings > Focus
│  │  └─ Focus active? → App may not be in allowed list
│  └─ No Focus active → continue
│
├─ Interruption level filtering?
│  ├─ Default level is .active (may be filtered by Focus)
│  │  └─ Need to break through Focus? → Use .timeSensitive or .critical
│  ├─ .timeSensitive requires capability
│  │  └─ Missing? → Add Time Sensitive Notifications capability
│  └─ .critical requires Apple entitlement
│     └─ Only for health/safety/security apps — apply via Apple Developer
│
├─ Provisional authorization behavior changed?
│  ├─ iOS 15+ provisional notifications appear in Notification Summary
│  │  └─ User may not see them → Request full authorization
│  └─ Was relying on provisional? → Prompt for explicit permission
│
└─ Communication notifications require INSendMessageIntent?
   ├─ iOS 15+ communication notifications need SiriKit intent
   │  └─ Missing? → Donate INSendMessageIntent before showing notification
   └─ Intent donated but still filtered?
      └─ Check that sender is in user's contacts
```

## Push Notification Console Workflow

Apple's Push Notification Console provides server-free testing:

#### Navigate to Console

1. Open https://icloud.developer.apple.com/dashboard
2. Select "Push Notifications" from sidebar
3. Choose your app's bundle ID

#### Send Test Notification

1. Enter device token (from Step 2 diagnostic)
2. Select environment (Sandbox/Production)
3. Compose payload or use template
4. Send and observe delivery status

#### Check Delivery Logs

1. Copy `apns-id` from the response header of your push request
2. Use Push Notification Console to look up delivery status by `apns-id`
3. Status shows: accepted, delivered, dropped (with reason)

#### Common Console Findings

| Status | Meaning | Action |
|--------|---------|--------|
| Delivered | APNs delivered to device | Problem is on-device (auth, Focus, extension) |
| Dropped: Unregistered | Token invalid | Re-register device |
| Dropped: DeviceTokenNotForTopic | Bundle ID mismatch | Fix apns-topic header |
| Stored | Device offline, will deliver later | Wait or check device connectivity |

## Simulator Testing with simctl

Simulators cannot register for remote notifications, but you can test notification handling:

```bash
cat > test-push.apns << 'EOF'
{
  "Simulator Target Bundle": "com.your.bundle.id",
  "aps": {
    "alert": {
      "title": "Test",
      "body": "Hello from simctl"
    },
    "sound": "default",
    "mutable-content": 1
  }
}
EOF

xcrun simctl push booted com.your.bundle.id test-push.apns
```

#### Simulator Limitations

- ✅ Notification appearance and content
- ✅ Notification Service Extension processing
- ✅ Notification Content Extension (custom UI)
- ✅ Action handling and categories
- ❌ APNs token registration (always fails)
- ❌ Silent push waking app accurately
- ❌ Live Activity push updates

#### Drag-and-Drop Alternative

Drag a `.apns` file directly onto the Simulator window to deliver it. Requires `"Simulator Target Bundle"` key in the payload.

## Common FCM Diagnostics

### Swizzling Conflict

**Symptom**: Token callback not firing with Firebase

**Cause**: Method swizzling disabled but manual forwarding not implemented

**Diagnostic**:
```swift
// Check Info.plist
// FirebaseAppDelegateProxyEnabled = NO means YOU must forward tokens
```

**Fix** (if swizzling disabled):
```swift
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
}
```

### Token Mismatch

**Symptom**: Server has FCM token, but APNs delivery fails

**Cause**: FCM token and APNs token are different. FCM wraps APNs token.

**Diagnostic**:
```swift
// FCM token (send this to YOUR server)
Messaging.messaging().token { token, error in
    print("FCM token: \(token ?? "nil")")
}

// APNs token (FCM handles this internally)
// Do NOT send raw APNs token to your server when using FCM
```

### Missing APNs Key in Firebase Console

**Symptom**: FCM works on Android, notifications not arriving on iOS

**Fix**:
1. Firebase Console → Project Settings → Cloud Messaging
2. Upload APNs Authentication Key (.p8)
3. Enter Key ID and Team ID
4. Verify bundle ID matches your app

## Quick Reference Table

| Symptom | Check | Fix |
|---------|-------|-----|
| No notifications at all | Step 1: entitlements | Enable Push Notification capability, regenerate profile |
| Token registration fails | Step 2: callbacks | Implement both delegate methods in AppDelegate |
| 400 BadDeviceToken | Token format | Re-register; check hex encoding (no spaces, no angle brackets) |
| 403 InvalidProviderToken | JWT/certificate | Regenerate JWT; verify key ID, team ID, bundle ID |
| 410 Unregistered | Device state | App uninstalled or token rotated — remove from server |
| Works dev not prod | Step 3: curl both | Switch APNs endpoint; tokens differ per environment |
| Silent push ignored | Payload + headers | content-available: 1, push-type: background, priority: 5 |
| Rich media missing | Extension | Add mutable-content: 1, check extension bundle ID and timeout |
| Live Activity stale | Topic format | Use {bundleID}.push-type.liveactivity topic |
| Focus mode filtering | Interruption level | Use .timeSensitive for important notifications |
| FCM iOS failure | Firebase Console | Upload .p8 key with correct Key ID and Team ID |
| Actions not showing | Category ID | Match category identifier in payload to registered categories |

## Pressure Scenarios

### Scenario 1: "Server team says the problem is on the iOS side"

**Context**: Push notifications stopped working. The backend team says their payload is fine and the problem must be in the app.

**Pressure**: Skip client-side diagnostics and assume the server is right. Start rewriting notification handling code.

**Reality**: 55% of push failures are entitlement/token issues (Steps 1-2), not code bugs. The server may be sending to the wrong environment or using an expired token.

**Correct action**: Run all 4 mandatory diagnostic steps before touching code. Share the curl test (Step 3) results with the server team — this objectively proves which side has the issue.

**Push-back template**: "Let me verify the client-side chain first — I can share the curl results in 5 minutes so we both know exactly where the failure is."

### Scenario 2: "Notifications stopped after iOS update, ship a fix today"

**Context**: Users report notifications stopped working after updating to a new iOS version. Management wants a hotfix today.

**Pressure**: Start debugging notification code immediately. Assume Apple broke something.

**Reality**: New iOS versions often enable Focus mode by default or change interruption level filtering. 15% of push failures are Focus/interruption suppression — no code change needed on your side.

**Correct action**: Check Tree 6 ("Notifications stopped after iOS update"). Verify Focus mode settings on test devices before changing any code. If Focus is filtering, the fix is setting the correct `interruption-level` in the payload, not rewriting notification handling.

**Push-back template**: "iOS updates often change Focus mode defaults. Let me check interruption levels first — if that's the cause, the fix is a one-line payload change, not a code rewrite."

### Scenario 3: "Silent push worked last week, nothing changed"

**Context**: Background content sync via silent push stopped working. "We didn't change anything."

**Pressure**: Deep-dive into background execution code. Assume a regression.

**Reality**: Silent push has a system-enforced throttle budget (~2-3/hour). If usage increased, or if users force-quit the app, silent push stops working regardless of code quality. Also, the provisioning profile may have been regenerated without the push entitlement.

**Correct action**: Follow Tree 3 ("Silent notifications not waking app"). Check throttle budget, force-quit state, and entitlements before debugging code.

**Push-back template**: "Silent push has a system throttle budget. Let me verify we haven't exceeded it and that the app hasn't been force-quit on test devices — those are the two most common causes."

## Checklist

Before escalating push notification issues:

- [ ] Push Notification capability enabled in Xcode (Step 1)
- [ ] Provisioning profile contains aps-environment (Step 1)
- [ ] Token registration callback fires with 64-char hex token (Step 2)
- [ ] curl to APNs returns HTTP/2 200 (Step 3)
- [ ] User authorized notifications, status = 2 (Step 4)
- [ ] APNs environment matches build type (sandbox/production)
- [ ] Focus mode not filtering notifications on test device
- [ ] Tested on physical device (not Simulator for token registration)
- [ ] For FCM: APNs auth key uploaded to Firebase Console
- [ ] For silent push: background mode enabled, priority 5, no alert keys

## Resources

**WWDC**: 2021-10091, 2023-10025, 2023-10185

**Docs**: /usernotifications, /usernotifications/testing-notifications-using-the-push-notification-console

**Skills**: axiom-push-notifications, axiom-push-notifications-ref, axiom-extensions-widgets
