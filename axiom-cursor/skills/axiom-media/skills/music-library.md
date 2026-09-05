
# Apple Music Library Enumeration

**Time cost**: 15-20 minutes. Two of the traps below return *plausible wrong answers* rather than errors, and unit tests cannot catch either one — the premise is wrong, not the code.

## Key Insight

**MusicKit and MediaPlayer do not enumerate the same population.** `MusicKit.Playlist.entries` is the **catalog** view; `MPMediaPlaylist.items` is what exists in **this device's local media library**. They use different identifiers, have opposite performance characteristics, and on three platforms only one of them exists at all.

Treating a count difference between them as a data-integrity signal is the single most expensive mistake in this domain. See Rule 1.

For *playing* Apple Music content and publishing Now Playing metadata, see `now-playing-musickit`. This skill covers reading the library.

## Start Here — Symptom Index

Most tasks need one or two of these, not the whole file.

| Symptom / task | Go to |
|---|---|
| The two APIs report different counts for the same playlist | Rule 1 — the difference is structural; never gate on it |
| Building a table of playlist membership | Rule 1, Rule 7 (key on `cloudGlobalID`), duplicates in Smaller Facts, and Rule 2 if you cross-reference the two sources |
| A join between MusicKit entries and MediaPlayer items returns zero | Rule 2 |
| MusicKit stops responding after a scan; no error | Rule 3 |
| A library walk is slow, or you are about to add paging | Rule 3, Rule 4 |
| Deciding which songs are playable, or building an offline queue | Rule 1 (playability), Rule 3 mitigation 1 |
| Choosing an id to persist | Rule 5, Rule 7 |
| Change detection / knowing when to re-sync | Rule 6, Rule 7 (subscribe, don't poll) |
| Empty or near-empty results | Authorization (two gates), Measurement Regime (Sync Library off) |
| Targeting macOS, tvOS, or watchOS | Platform Availability — MediaPlayer does not exist there |

## Platform Availability — Read This First

| Framework | Availability |
|---|---|
| `MusicLibraryRequest`, `MusicLibrarySectionedRequest` | iOS 16, iPadOS 16, tvOS 16, watchOS 9, visionOS 1, **macOS 14**, Mac Catalyst 17 |
| `MPMediaQuery`, `MPMediaPlaylist`, `MPMediaLibrary` | iOS 3, iPadOS, visionOS, Mac Catalyst — **`API_UNAVAILABLE(tvos, watchos, macos)`** |

**MediaPlayer's library API does not exist on native macOS, tvOS, or watchOS.** That is an explicit `API_UNAVAILABLE`, not an inferred omission — it fails to compile, it is not merely version-gated. Every "use MediaPlayer instead" mitigation below is therefore **iOS / iPadOS / visionOS / Mac Catalyst only**. On native macOS, tvOS, and watchOS, MusicKit is your only option and you must work within Rule 3 rather than around it.

## Authorization — Two Separate Gates

Neither framework returns an error when you skip its gate. Both return **empty results**.

```swift
// MusicKit — required before ANY other MusicKit API
let status = await MusicAuthorization.request()

// MediaPlayer — a SEPARATE gate, not covered by the MusicKit grant
let mpStatus = MPMediaLibrary.authorizationStatus()
MPMediaLibrary.requestAuthorization { status in … }   // iOS 9.3+
```

Two project requirements that produce no build error when missing:

- **`NSAppleMusicUsageDescription`** — required for both frameworks. Without it the consent prompt traps instead of appearing.
- **The MusicKit App Service must be enabled on your App ID.** Without it `MusicLibraryRequest` fails as empty or erroring results at runtime, never as a compile error. Same shape as the ShazamKit App Service requirement (`shazamkit`).

If someone reports "my query returns almost nothing", check both gates before anything else in this file.

## Measurement Regime

Measured 2026-09-03/05 against one real, cloud-heavy library:

- **iPad Pro 12.9" (5th gen), iPadOS 27** — 97,528 MediaPlayer songs, 99,159 MusicKit songs, 16 playlists, ~152K playlist entries
- **iPhone 16 Pro Max, iOS 27** — 771 songs before Sync Library was enabled, the full library after

One user's library, large and cloud-heavy — so it exercises the catalog/local divergence harder than a small local library would. The pool-starvation failure in Rule 3 did *not* reproduce at 771 songs. Treat thresholds as "large personal library", not constants.

**Sync Library off is its own regime.** With Settings → Music → Sync Library disabled, both frameworks return only locally-present content — 771 songs on a device whose account library holds ~99K. A near-empty result is a settings state, not a bug.

---

## Rule 1: The Two APIs Count Different Populations, and the Difference Is Exact

**Never treat `entries.count` vs `items.count` as a sync-health signal.** The gap is permanent, structural, and identical across devices.

The relationship is exact, not approximate:

```
MusicKit entries.count − MPMediaPlaylist items.count
    == the number of MusicKit entries whose playParameters is nil
```

| Playlist | MusicKit − MediaPlayer | Entries with no `playParameters` |
|---|---|---|
| A | 1 | 1 |
| B | 1 | 1 |
| C | 73 | 73 |
| D | 110 | 110 |
| E | 53 | 53 |

Five playlists inspected in full, five exact matches, across deltas spanning two orders of magnitude. Corroborated from the other side by membership, not just count: playlist A has 185 MusicKit entries, 184 of which join to MediaPlayer members by store id, and the one non-joining entry is the one entry lacking play parameters.

The same population appears library-wide: 99,159 − 97,528 = 1,631, against 1,632 MusicKit songs with no `playParameters`. **That is off by one and unexplained** — a single item that one framework lists and the other does not, in the opposite direction. It does not disturb the per-playlist identity, which was exact five times out of five, but it means "exactly" is proven at playlist scale and merely near-exact library-wide.

**A caveat on `entries.count` that Rule 6 develops**: `Playlist.entries` is a *paged* collection, and Apple does not document whether `.count` reflects the whole relationship or a loaded page. The measured playlists behaved as complete (79,509 entries came back in one 0.26 s read), and the identity above is built on that. Before trusting a count on a playlist far larger than yours, drain `nextBatch()` and confirm — the identity is a claim about *populations*, not about a property of `.count`.

**What the extra entries actually are** was never established. They are entries with no local representation — plausibly catalog-only additions, region-unavailable tracks, or items pulled from the catalog. The identity is measured; the *characterisation* is not. Do not tell users these tracks are "unavailable" without checking which case you have.

```swift
// ❌ WRONG — compares incommensurable quantities; skips real work forever
if mpPlaylist.items.count < musicKitPlaylist.entries?.count ?? 0 {
    skipMembershipSync()      // fires permanently on any cloud-heavy playlist
}

// ✅ CORRECT — do not gate on the counts at all. Membership is what
//    MediaPlayer returns; the MusicKit surplus has no local row to key to.
writeMembership(from: mpPlaylist.items)

// 🔍 DIAGNOSTIC ONLY — explains a gap; must never gate a write
let localRepresentable = entries.filter { $0.playParameters != nil }
// localRepresentable.count == mpPlaylist.items.count
```

The filter is the *explanation*, not the fix. If you ship it inside a conditional you have rebuilt the guard this rule exists to prevent — just with a better predicate.

**And the diagnostic is itself a bulk property read, so Rule 3 governs it.** `playParameters` over a playlist's entries is bounded by the *playlist's* size, not the library's — fine at the 185 entries of playlist A, and squarely in the hazard at the 79,509 entries measured on another. Only 2,000 entries per playlist was measured safe. Above that, do not reconcile by sweeping `playParameters`: compare `catalogId` → `playbackStoreID` joins on a bounded page (Rule 2), or accept the count difference as expected and do not gate on it at all — which is the real lesson here anyway.

### Playability is not one predicate, and the wrong one costs twice

`playParameters != nil` means **"MediaPlayer can represent this locally"** — it does not mean playable offline. A cloud song that has never been downloaded has play parameters and still needs the network.

If you are building an *offline* queue, the predicate you want is `includeOnlyDownloadedContent` (MusicKit) or an `isCloudItem == false` query predicate (MediaPlayer) — Rule 3, mitigation 1. Getting this wrong costs twice: you reach for the bulk sweep Rule 3 forbids in order to evaluate a predicate that was not the one you meant.

MediaPlayer has the same class of trap under different names:

| Property | Meaning |
|---|---|
| `MPMediaItem.assetURL` (iOS 8+) | **Nullable.** nil for cloud and DRM-protected items — no local file to open. An export or analysis pass over `assetURL` finds most of a cloud-heavy library nil. |
| `isCloudItem` (iOS 8+) | Lives in iCloud Music Library, not on device. Marked `// filterable`. |
| `hasProtectedAsset` (iOS 9.2+) | DRM-protected; no direct asset access. Marked `// filterable`. |

Check `isCloudItem` / `hasProtectedAsset` before reaching for `assetURL` — and prefer filtering on them in the query over reading them per item.

### What this costs when you get it wrong

A design document reviewed five times and signed off recorded one playlist's "229 members through MediaPlayer against 311 through MusicKit" as evidence of a *transient replication artifact*. It is this rule — permanent, structural, and identical on both devices twelve hours apart.

A guard built on that reading skipped playlist membership whenever MediaPlayer's count was below MusicKit's. It fired on **9 of 15 playlists, on both devices, on every pass, permanently** — and sat ahead of the forced-mode check, so no user action could override it. Most playlists would never populate.

Roughly 2,500 unit tests could not catch it, because the premise was wrong rather than the code. It took a device probe printing both counts side by side, plus the `playParameters` breakdown, to establish that the difference was structural.

---

## Rule 2: A Playlist Entry's `musicKit_persistentID` Is the Entry's ID, Not the Song's

Decoding a `Playlist.Entry`'s `playParameters` yields:

```
keys = [catalogId, id, isLibrary, kind, musicKit_databaseID,
        musicKit_libraryID, musicKit_persistentID]
kind  = "_playlistEntry"
musicKit_persistentID = "-8337673474215285654"
```

Entry values are **negative** and cluster in a narrow range within a playlist (…285654, …373765, …373808 — near each other, not strictly consecutive). A genuine `MPMediaItem.persistentID` is positive. Sign is the reliable tell; adjacency is corroborating, so do not lead with it against a skeptic.

**The trap**: joining MusicKit entries to MediaPlayer members by `persistentID` returns **zero matches even on playlists where both APIs report identical counts** — and a column of zeroes reads like a finding rather than a broken join. Measured: 0 across all 16 playlists, including ones matching 23/23 and 1/1.

`PlayParameters` has no public members, so JSON is the only way in. Decode it — the dictionary below is a real type, because `catalogId`'s JSON type is not guaranteed to be a string:

```swift
private struct EntryPlayParameters: Decodable {
    let kind: String?
    let catalogId: String?

    private enum CodingKeys: String, CodingKey { case kind, catalogId }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = try c.decodeIfPresent(String.self, forKey: .kind)
        if let s = try? c.decodeIfPresent(String.self, forKey: .catalogId) { catalogId = s }
        else if let n = try? c.decodeIfPresent(Int64.self, forKey: .catalogId) { catalogId = String(n) }
        else { catalogId = nil }
    }
}

// ❌ WRONG — silently zero, including on exact-count playlists
member.persistentID == entryParams.musicKit_persistentID

// ✅ join on the store id, where catalogId is present
member.playbackStoreID == entryParams.catalogId   // MPMediaItem, iOS 10.3+
```

**`playbackStoreID` has a sentinel.** Items with no catalog identity — ripped CDs, unmatched uploads — report `"0"` or empty. Filter those out of your index or they collide:

```swift
mpPlaylist.items.filter { !$0.playbackStoreID.isEmpty && $0.playbackStoreID != "0" }
```

**This join is one-directional.** It finds the local partner of a catalog entry. A locally-ripped track has an `MPMediaItem` but no `catalogId` on the MusicKit side, so it is structurally unjoinable by this key — that is a property of the data, not a bug to chase.

**An untested alternative worth probing.** `entry.item` (`.song`/`.musicVideo`) exposes the *item's own* `playParameters`, whose `musicKit_persistentID` would be the item's library id rather than the entry's — which would join to `MPMediaItem.persistentID` directly and cover local-only tracks that `catalogId` cannot. It is the obvious next place to look once you know the entry id is the wrong key, so you have probably already thought of it. **It has not been verified on device**, and the `catalogId` join above is the one that was. Dump `entry.item?.playParameters` alongside `entry.playParameters` and compare the hit rates before relying on it.

### The same key name means different things at two levels

This is what makes the trap survive review:

| Object | `musicKit_persistentID` in its `playParameters` |
|---|---|
| `Playlist` | The **MediaPlayer playlist id**, as a signed `Int64` bit pattern. Usable. Its `catalogId` equals `MPMediaPlaylist.cloudGlobalID`. |
| `Playlist.Entry` | The **entry's own id** (`kind = "_playlistEntry"`). Negative. Joins to nothing in MediaPlayer. |

**Do not persist the entry id either.** It is unique within a read, which makes it tempting as a membership-row key. Nothing establishes that it is stable across reads, across a Sync Library toggle, or across devices — it is an undocumented internal identifier, and Rule 5's posture applies. For membership rows use `(playlist, position)`, which is stable by construction and handles duplicates.

`PlayParameters` has no public members at all — only `Equatable`, `Hashable`, `Sendable`, and a `Codable` conformance — so JSON-encoding is the only way to see inside, and nothing in the type system distinguishes these two cases for you.

```swift
let json = try JSONEncoder().encode(playlist.playParameters)
```

---

## Rule 3: Never Bulk-Read MusicKit Properties

**The requests are fast; the properties are lazy.** `MusicLibraryRequest<Song>` unbatched returns all 99,159 in 0.4-0.9 s. Iterating *one property* over that result is what kills it.

Measured: reading `playParameters` on all 99,159 `Song` values from a cooperative-pool task produced about 35 seconds of pool starvation — a `Thread`-hosted heartbeat recorded six consecutive ≥5 s waits for a fresh detached task. After the pool recovered, **the reading task, its watchdog, and every subsequent MusicKit request were never resumed for the remainder of the run**. The process stayed alive and the main actor kept responding throughout.

**The starvation is a symptom, not the mechanism — do not reason from it.** Hosting the same loop on a plain `Thread`, which does not draw on the cooperative pool at all, lost MusicKit identically. Two consequences: moving the work off the pool does **not** help, and any fix reasoned from "I'll relieve the executor" — yields, detached tasks, a private queue — is reasoning from the wrong model.

**The mechanism is unknown, and saying more than that is a mistake.** Nothing crashed, nothing threw, and no corruption was observed — what was observed is that requests stopped returning. Do not describe this as MusicKit "crashing", "corrupting state", or being "unrecoverable": none of those were measured, and a restart clearing it is equally consistent with a stuck connection, an exhausted internal budget, or an unresumed continuation. The rule below stands on the *observation*, and does not need the cause.

Scope of the evidence: one device, one OS build, two hosting variants (cooperative-pool task and plain `Thread`), plus a main-actor run that completed. Not observed to recover; not proven unrecoverable.

```swift
// ❌ WRONG — loses the task, and every later MusicKit request with it
let response = try await MusicLibraryRequest<Song>().response()
for song in response.items where song.playParameters != nil { … }
```

`song.playParameters` *reads* like a stored-property access. It is a computed property backed by MusicKit's property store, and resolving it across a large collection does work the type signature does not advertise.

**On the main actor the loop completes** (2.7 s for `playParameters`, 62 s for seven fields) — 62 seconds of unresponsive UI is watchdog-termination territory, so completing there is not a fix.

### Mitigations, strongest first

**1. Push the predicate into the query so the sweep never happens.** This is the best option and the only one that works on every platform. Both frameworks can filter before anything reaches you:

```swift
// MusicKit — request-level flag, on the cheap side of the requests/properties line
var request = MusicLibraryRequest<Song>()
request.includeOnlyDownloadedContent = true

// MediaPlayer — isCloudItem and hasProtectedAsset are marked `// filterable`
// in MPMediaItem.h, so "downloaded" is expressible as a query predicate
let query = MPMediaQuery.songs()
query.addFilterPredicate(MPMediaPropertyPredicate(
    value: false, forProperty: MPMediaItemPropertyIsCloudItem))
query.addFilterPredicate(MPMediaPropertyPredicate(
    value: false, forProperty: MPMediaItemPropertyHasProtectedAsset))
```

Reach for this before anything below. Neither flag's behaviour was measured at ~99K, so verify the cost on your own library — but a predicate the daemon evaluates cannot trigger a client-side property sweep by construction.

**2. Read bulk fields from MediaPlayer instead** — iOS / iPadOS / visionOS / Catalyst only (see the availability table). Not available on native macOS, tvOS, watchOS, which is why option 1 matters there.

**3. Restrict MusicKit to small record sets.** ~15 playlists is fine; the library is not.

**4. Cap per-entry inspection.** 2,000 entries in one playlist did not reproduce the hazard. **The measurements leave a 50x gap** between that and the 99,159 that did, and they do not establish whether the budget is per sweep or per process — 16 playlists × 2,000 in one run is untested. Treat 2,000 as the largest number anyone has evidence for, not as a proven ceiling.

**5. Load properties for a bounded set** with `with(_:)`. Note the demonstrated properties are *relationships*; whether `with(_:)` changes anything for an **attribute** like `playParameters` is untested, so do not assume it converts a bulk attribute sweep into a safe one:

```swift
let detailed = try await song.with([.albums, .artists])
let fromLibrary = try await song.with([.albums], preferredSource: .library)
```

`MusicPropertySource` is `.catalog` or `.library` (`.library` is macOS 14 / macCatalyst 17+).

**No MusicKit work on the main actor whose size you do not control.** An ordinary bounded request is fine there — `MusicLibraryRequest<Playlist>` is 1 ms, and `response()` is `async` so it suspends rather than blocks. What must never run there is a read whose cost scales with the library.

---

## Rule 4: Batching a Library Request Is ~100x Slower

| Approach | 99,159 songs |
|---|---|
| One unbatched `MusicLibraryRequest<Song>` | 0.4-0.9 s |
| `limit = 500` plus `nextBatch()` | 73 s |

```swift
// ✅ CORRECT — one request, whole library
let request = MusicLibraryRequest<Song>()
let response = try await request.response()   // 0.4-0.9 s for ~99K

// ❌ WRONG — ~100x slower for the same result
var batched = MusicLibraryRequest<Song>()
batched.limit = 500
var all = try await batched.response().items
while let next = try await all.nextBatch() { all += next }   // 73 s
```

`limit` and `offset` earn their place for **windowed** reads you never intend to complete:

```swift
var recent = MusicLibraryRequest<Song>()
recent.sort(by: \.libraryAddedDate, ascending: false)
recent.limit = 5
let items = try await recent.response().items   // 3 ms - 0.5 s
```

**Memory**: holding all 99,159 `Song` values costs about 115 MB. Release the collection once you have projected out what you need.

---

## Rule 5: Never Parse or Persist `Song.id`

**MusicKit `Song.id` is not stable across devices, and its *format* is not stable across devices.** The same library, same Apple ID, produced `i.…` style identifiers on one device and a bare numeric string equal to the MediaPlayer `persistentID` on the other.

```swift
// ❌ WRONG — the format differs per device; there is no documented grammar
if song.id.rawValue.hasPrefix("i.") { … }
let numeric = Int64(song.id.rawValue)          // nil on one device, fine on the other
```

`MusicItemID` is `RawRepresentable` over `String`, so the raw value is *available*. That is not permission to interpret it.

### What identity you can actually rely on

| Identifier | Stable across devices? | Notes |
|---|---|---|
| `MusicKit Song.id` | **No** | Format itself varies per device. Never parse. |
| `MPMediaItem.persistentID` | **No** | Differs per device for the same song. |
| `MPMediaPlaylist.persistentID` | **No** | Also re-keys on a Sync Library toggle (Rule 7). |
| `MPMediaPlaylist.cloudGlobalID` | **Yes** | iOS 14+, `MPMediaPlaylist` only. The durable playlist key. |
| `MPMediaItem.playbackStoreID` | Catalog-scoped | iOS 10.3+. The join target for MusicKit `catalogId` (Rule 2). |
| Title + artist | **No** | Not identity: one lookup returned three distinct `MPMediaItem`s. |

`cloudGlobalID` exists on `MPMediaPlaylist` and **not** on `MPMediaItem` — there is no equivalent durable per-song key from MediaPlayer.

Also measured: MusicKit's library `Album.id` equalled the same album's catalog id, but `Artist.id` did **not**. Do not generalize a matching id on one entity type to the others.

---

## Rule 6: Optional Properties With Undocumented `nil` Conditions

**`Playlist.lastModifiedDate`** is `Date?` (iOS 15+). Apple documents no conditions under which it is nil. **It is nil in practice**, and there is no fallback: `MPMediaPlaylist` has no per-playlist modification date at all. Its complete property set is `persistentID`, `cloudGlobalID`, `name`, `playlistAttributes`, `seedItems`, `descriptionText`, `authorDisplayName`. The only MediaPlayer date is `MPMediaLibrary.default().lastModifiedDate`, which is **library-wide** (an instance property — there is no class accessor).

Consequence: any change-detection scheme keyed on a per-playlist modification date must handle a permanent nil, and **cannot distinguish "unknown" from "unchanged"** unless you encode that distinction yourself.

```swift
// ❌ WRONG — nil silently means "unchanged", so the playlist never re-syncs
if playlist.lastModifiedDate ?? .distantPast > lastSeen { resync() }

// ✅ CORRECT — nil is a third state, not a default
switch playlist.lastModifiedDate {
case .some(let d) where d > lastSeen: resync()
case .some:                           break          // known unchanged
case .none:                           resyncOnSchedule()  // unknown, not unchanged
}
```

**`Playlist.entries`** is `MusicItemCollection<Playlist.Entry>?` — optional, nil until loaded, and a **paged** collection. Apple does not document whether `.count` reflects the complete relationship or only a loaded page. Do not build a correctness argument on that count alone.

`Playlist.Entry` carries its own `title`, `artistName`, `artwork` and `playParameters`, so it reads like a `Song`; the actual item lives in `entry.item`, typed `Playlist.Entry.Item?` (`.song` or `.musicVideo`).

```swift
// ✅ Both optionals are real, and non-song entries exist
guard let entries = try await playlist.with([.entries]).entries else { return }
for entry in entries {
    guard let item = entry.item else { continue }
    if case .song(let song) = item { … }
}
```

Loading `entries` for *every* playlist is a MusicKit property read across a set — the shape Rule 3 forbids. It is acceptable only because playlists number in the tens (16 on the measured device). **The bound is the playlist count; confirm yours is small.**

---

## Rule 7: Sync Library Rebuilds, and Nameless Rows Have Two Possible Causes

When the user turns on **Settings → Music → Sync Library**, the library is rebuilt underneath your app:

- **Every `MPMediaPlaylist.persistentID` changed.** Sixteen 20-digit ids became small consecutive numbers. **Every `cloudGlobalID` was unchanged.** A local-only playlist stopped being listed by either API.
- **Songs were never observed partial** — 770 before, then the full 97,528 / 99,159 at both later readings. Intermediate states were not observed: absence of evidence, not a guarantee.
- **Local song `persistentID`s were kept.** Only *playlist* ids re-keyed. If your table is keyed to `MPMediaItem.persistentID`, the toggle does not orphan it — but the playlist rows above it will orphan unless keyed on `cloudGlobalID`. This asymmetry is the single most important durability fact here, and it cuts the opposite way for the two tables.

```swift
// ❌ WRONG — persistentID is not a durable playlist key across a sync toggle
store.upsertPlaylist(key: mpPlaylist.persistentID)

// ✅ CORRECT — cloudGlobalID survives the re-key
store.upsertPlaylist(key: mpPlaylist.cloudGlobalID ?? localFallback(mpPlaylist))
```

### Nameless, empty playlist rows

Two nameless rows with zero members were observed on the iPhone, unchanged across two readings twelve minutes apart. **The cause is unresolved**, and there are at least two candidates:

1. **Mid-rebuild replica state** from the Sync Library toggle.
2. **Phantom pagination records.** An Apple Media Engineer has confirmed for the Apple Music API surface that *"there is also a feature for supporting pagination where 'phantom' playlist records may still be returned in the response so that the offsets do not change when making paginated requests"*, with a report of 81 nameless phantom playlists, and that deletions may take a minute or more to propagate. Those remarks concern MusicKit JS / the web API; **whether the same mechanism reaches Swift MusicKit's `entries` is unverified.**

Not reproduced on the iPad (zero nil titles across ~12,000 entries).

Either way the handling is the same, and it is the safe handling under both hypotheses: **never delete local rows because a playlist came back empty or nameless.** Mark it missing and let a later pass revive it.

Nothing measured licenses an eventual purge. A genuinely emptied playlist will therefore keep stale rows indefinitely under this rule — if you need to reclaim them, make it an explicit product decision with a threshold you own, not an inference the sync pass draws on its own.

### Do not poll for library change — subscribe

```swift
MPMediaLibrary.default().beginGeneratingLibraryChangeNotifications()
NotificationCenter.default.addObserver(
    forName: .MPMediaLibraryDidChange, object: nil, queue: nil
) { _ in /* re-evaluate cached queries */ }
```

The header says so outright: *"Any items or playlists which were previously cached should be re-evaluated from queries when `MPMediaLibraryDidChangeNotification` is posted."* Also `API_UNAVAILABLE(tvos, watchos, macos)` — on native macOS you are left with stamp comparison.

---

## Read Costs

Measured on the iPad, off the main actor unless stated.

| Read | Cost |
|---|---|
| `MPMediaQuery.songs().items`, one materialisation | 0.5 s |
| `persistentID` over the materialised 97,528 items | 0.02 s |
| All 20 converter fields over 97,528 items | 38 s |
| Every `MPMediaPlaylist.items` materialised once, `persistentID` over 152,156 members | 0.3 s |
| `MPMediaItem.artwork != nil` presence check over all 97,528 items | ~28 s, three runs |
| `MPMediaItem.artwork` over all 97,528 items, forcing a decode | did not finish in 10 minutes, twice |
| `MusicLibraryRequest<Song>`, one unbatched request, all 99,159 | 0.4-0.9 s |
| The same, `limit = 500` with `nextBatch()` | 73 s |
| `MusicLibraryRequest<Playlist>` | 1 ms |
| One playlist's `entries`, 79,509 of them | 0.26 s |
| Sorted by `libraryAddedDate`, `limit = 5` | 3 ms - 0.5 s |
| Holding all 99,159 `Song` values | ~115 MB |

Three things to take from this beyond the raw numbers:

1. **Enumeration is cheap; per-item fields are not.** 97,528 items in 0.5 s; 20 fields off them in 38 s.
2. **`artwork` presence and `artwork` content are different operations.** Checking `!= nil` across the library is ~28 s and fine. Forcing a decode did not terminate. Never load artwork in a walk — load it for what is on screen.
3. **MediaPlayer bulk reads off the main actor are safe** on this device; MusicKit's are not (Rule 3).

---

## Smaller Facts Worth Knowing

- **Playlists contain duplicates.** Measured: 184 items / 173 distinct, 279 / 262, and 18,766 / 18,762 on three playlists. Code comparing `items.count` against a distinct count will be silently wrong.
- **MusicKit omits folders.** 15 MusicKit playlists against MediaPlayer's 16; the missing one is a folder. Neither framework has a folder API — `MPMediaPlaylistAttribute` is `None | OnTheGo | Smart | Genius`, there is no parent-ID property, and no folder case in `MPMediaGrouping`. "No MusicKit twin" is the only available signal and it is a **proxy**: any join failure looks identical to a folder.
- **Counts do not differ per device.** Both devices reported identical MusicKit entry counts for the same cloud playlist (79,509). An early hypothesis that MusicKit answers differently per device was tested and disproved — so a per-device difference is a bug in your code, not the framework.
- **Writing is a separate surface.** `MusicLibrary.shared.add(_:to:)`, `createPlaylist(...)`, `edit(...)` — out of scope here, but MusicKit is not read-only.

---

## Sorting and Filtering

`MusicLibraryRequest` filters and sorts server-side through typed key paths:

```swift
var request = MusicLibraryRequest<Song>()
request.filter(matching: \.artistName, equalTo: "Brian Eno")
request.sort(by: \.libraryAddedDate, ascending: false)
let items = try await request.response().items

request.includeOnlyDownloadedContent = true
request.filter(text: "ambient")
```

For grouped presentation use `MusicLibrarySectionedRequest`, whose API mirrors the above with `filterItems` / `sortItems` and `filterSections` / `sortSections`:

```swift
var sectioned = MusicLibrarySectionedRequest<Album, Track>()
sectioned.sortSections(by: \.title, ascending: true)
let sections = try await sectioned.response().sections
```

**One narrow platform carve-out**, easy to overstate: only `MusicLibrarySectionedRequest.filterItems(matching:contains:)` — its two `String` overloads — is unavailable on macOS and Mac Catalyst. `filterSections(matching:contains:)`, the free-text `filterItems(text:)` and `filterSections(text:)`, and **every** overload on the non-sectioned `MusicLibraryRequest` are available on all platforms.

---

## Choosing the Framework

Every **MediaPlayer** row is iOS / iPadOS / visionOS / Mac Catalyst only.

| Need | Use | Why |
|---|---|---|
| Enumerate songs, ids only | Either | MusicKit 0.4-0.9 s unbatched; MediaPlayer 0.5 s |
| Many per-item fields over the whole library | **MediaPlayer** | MusicKit bulk property reads lose the task (Rule 3) |
| Playlist *list* and catalog-side entries | **MusicKit** | `MusicLibraryRequest<Playlist>` 1 ms; entries 0.26 s for 79K. Bounded by playlist count, not library size |
| Membership rows keyed to **local items** | **MediaPlayer** | `MPMediaPlaylist.items` *is* the local population by definition and carries `persistentID` directly — 0.3 s for 152K members. Do not source these from MusicKit and then try to resolve them down |
| Joining entries to local items | **Both** | MusicKit `catalogId` → `MPMediaItem.playbackStoreID` (Rule 2) |
| Change notification | **MediaPlayer** | `MPMediaLibraryDidChangeNotification`; MusicKit has no equivalent |
| A durable cross-device playlist key | **MediaPlayer** | `cloudGlobalID`; MusicKit has no equivalent |
| Per-playlist modification date | Neither | MusicKit's is nil in practice; MediaPlayer has none (Rule 6) |
| Queue something for playback | **MusicKit** | `PlayParameters`; see `now-playing-musickit` |
| Folders | Neither | Observed as a count delta only; no folder API in either |

Real apps on iOS end up using both. That is the expected outcome, not a design smell.

---

## Anti-Rationalization

| Thought | Reality |
|---|---|
| "MediaPlayer shows fewer members than MusicKit — sync must be incomplete" | The gap is exact and permanent: it equals the number of entries with no `playParameters`, because MusicKit shows the catalog and MediaPlayer shows what is local. A shipped guard built on this fired on 9 of 15 playlists, on every pass, forever. |
| "Both APIs report the same count, so my join is working" | Joining entries by `musicKit_persistentID` returns zero matches even at 23/23 and 1/1. Entry ids are negative and belong to the entry, not the song. Join `catalogId` → `playbackStoreID`. |
| "`musicKit_persistentID` means the same thing everywhere" | On a `Playlist` it is the MediaPlayer playlist id and is usable. On a `Playlist.Entry` it is the entry's own id (`kind = "_playlistEntry"`) and joins to nothing. Same key, two meanings. |
| "`song.playParameters` is just a property read" | It is a computed property backed by MusicKit's store. Across a large library it leaves every later MusicKit request unresumed for the rest of the run, with no error. |
| "The pool starved, so I'll move it off the cooperative pool" | Pool starvation is the visible symptom, not the cause — a plain `Thread`, which never touches the pool, lost MusicKit identically. Any fix aimed at the executor is aimed at the wrong thing. |
| "I'll batch the request so it doesn't hang" | Batching is ~100x *slower*: 73 s against 0.4-0.9 s. The requests are fast; the properties are lazy. |
| "I'll do the bulk read on the main actor since that works" | It completes — after 62 s of unresponsive UI. Watchdog-termination territory, not a fix. |
| "I'll just use MediaPlayer everywhere, it's the bulk-safe one" | `MPMediaQuery`, `MPMediaPlaylist` and `MPMediaLibrary` are `API_UNAVAILABLE(tvos, watchos, macos)` — they do not compile on native macOS, tvOS or watchOS, where `MusicLibraryRequest` does exist. |
| "It worked on my test device" | Not reproduced at 771 songs; reproduced at 99,159 both on a cooperative-pool task and on a plain `Thread`. A small library proves nothing about this failure. |
| "`Song.id` is a string, I can parse it" | The format differs per device: `i.…` on one, bare numeric on another. Parsing yields a lookup that fails silently, on the second device only, at restore or handoff time — which is why it survives testing. |
| "`lastModifiedDate` is nil, so nothing changed" | Apple documents no nil conditions and it is nil in practice, with no MediaPlayer fallback — `MPMediaPlaylist` has no modification date at all. nil is "unknown", and treating it as "unchanged" means never re-syncing. |
| "`items.count` tells me how many distinct songs are in the playlist" | Playlists contain duplicates — 184 items / 173 distinct on one measured playlist. |
| "An empty nameless playlist means the user emptied it" | Two candidate causes, neither confirmed for Swift MusicKit: a mid-rebuild replica, or Apple's documented phantom pagination records. Mark missing, never delete — that is correct under both. |
| "My query returns nothing, so the API is broken" | Both frameworks return **empty, not an error**, when their authorization gate is unmet — two separate gates, plus `NSAppleMusicUsageDescription` and the MusicKit App Service on the App ID. |

## Resources

**WWDC**: 2022-10148, 2022-110347, 2026-254

**Docs**: /musickit/musiclibraryrequest, /musickit/musiclibrarysectionedrequest, /musickit/playlist, /musickit/playparameters, /musickit/musicauthorization, /mediaplayer/mpmediaquery, /mediaplayer/mpmediaplaylist, /mediaplayer/mpmedialibrary, /mediaplayer/mpmediaitem/playbackstoreid

**Skills**: now-playing-musickit, now-playing, music-understanding, shazamkit
