---
name: shazamkit
description: Audio recognition and custom audio matching skill suite
skill_type: suite
version: 1.0
apple_platforms: iOS 15+, iPadOS 15+, macOS 12+, tvOS 15+, watchOS 8+, visionOS 1+
---

# ShazamKit

Two skills covering audio recognition against the Shazam music catalog and custom audio catalogs. Built around the API shift from `SHSession` (iOS 15+) to `SHManagedSession` (iOS 17+), which eliminates AVAudioEngine boilerplate entirely.

## Skills in This Suite

| Skill | Type | What It Covers |
|-------|------|----------------|
| **axiom-shazamkit** | Discipline | API era decision tree, use case decision tree, setup checklist, modern vs legacy path, custom catalogs, Shazam CLI, library management, signature generation, 5 anti-patterns, 2 pressure scenarios |
| **axiom-shazamkit-ref** | Reference | SHManagedSession, SHSession, SHCustomCatalog, SHSignatureGenerator, SHMediaItem, SHMatchedMediaItem, SHLibrary, SHMediaLibrary, SHSignature, SHCatalog, SHMatch, SHError, SHMediaItemProperty, Shazam CLI commands |

## When to Use

Use these skills when you're:
- Adding song identification to an app (Shazam catalog matching)
- Building second-screen experiences synced to audio or video
- Creating custom audio catalogs for proprietary content (podcasts, TV episodes, lessons)
- Matching prerecorded audio against custom catalogs
- Managing the user's Shazam library (add, read, remove recognized songs)
- Generating audio signatures from files or live microphone input
- Debugging recognition failures or entitlement configuration issues

## Example Prompts

- "How do I add song recognition to my iOS 17+ app?"
- "What's the difference between SHManagedSession and SHSession?"
- "How do I build a custom audio catalog for my podcast?"
- "How do I sync app content to a playing video using ShazamKit?"
- "My Shazam matching isn't finding any results — what's wrong?"
- "How do I save recognized songs to the user's Shazam library?"
- "How do I generate signatures at scale with the Shazam CLI?"
- "How do I match against both the Shazam catalog and a custom catalog?"

## Key Concepts

### Two API Eras

| Era | API | When to Use |
|-----|-----|-------------|
| Modern (iOS 17+) | `SHManagedSession` | Default choice — handles recording, format conversion, matching. Observable for SwiftUI. |
| Legacy (iOS 15+) | `SHSession` + AVAudioEngine | Only when you need buffer-level control or target iOS 15-16. |

### Key Pattern: Song Recognition (iOS 17+)

```swift
let session = SHManagedSession()
let result = await session.result()

switch result {
case .match(let match):
    let item = match.mediaItems.first
    print("\(item?.title ?? "") by \(item?.artist ?? "")")
case .noMatch(_):
    print("No match found")
case .error(let error, _):
    print("Error: \(error.localizedDescription)")
}

session.cancel()  // Stop recording immediately
```

Three lines to identify a song. No AVAudioEngine, no delegates, no audio format negotiation.

### Key Pattern: Custom Catalog Matching

```swift
let catalog = SHCustomCatalog()
try catalog.add(from: catalogURL)
let session = SHManagedSession(catalog: catalog)
let result = await session.result()
```

Custom catalog matching does not require the ShazamKit App Service — only Shazam catalog matching does.

### Provisioning (Common Gotcha)

Shazam catalog matching **silently fails** without the ShazamKit App Service enabled. No error, no match, no diagnostic message. Enable it in Certificates, Identifiers & Profiles before your first test — it takes 2 minutes and prevents 30+ minutes of debugging a non-bug.

## Common Mistakes

| Mistake | Cost | Fix |
|---------|------|-----|
| Using SHSession on iOS 17+ | 30+ extra lines of boilerplate | Use SHManagedSession |
| Skipping App Service for Shazam catalog | Silent matching failure, 30+ min debugging | Enable ShazamKit in App ID → App Services |
| Creating many small signatures per media | Poor accuracy, boundary overlaps | One signature per asset, use timed media items |
| Keeping mic recording after match | Privacy violation, resource waste | Call `session.cancel()` immediately |
| Writing to library without user opt-in | User trust violation | Always let user choose to save |

## Related

- [now-playing](/skills/integration/now-playing) — If playing matched songs via Now Playing / MusicKit
- [camera-capture](/skills/integration/camera-capture) — If combining audio recognition with camera
- [foundation-models](/skills/integration/foundation-models) — If using on-device AI alongside audio recognition

## Resources

**WWDC**: 2021-10044, 2021-10045, 2022-10028, 2023-10051

**Docs**: /shazamkit, /shazamkit/shmanagedsession, /shazamkit/shsession, /shazamkit/shcustomcatalog
