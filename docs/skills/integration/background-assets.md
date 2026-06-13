---
name: background-assets
description: Discipline for delivering content too large for the app bundle — game level packs, ML model variants, Foundation Models adapters — via system-managed Background Assets with charging-aware scheduling, App Store install-progress integration, and per-user quotas
---

# Background Assets

Discipline-enforcing skill for delivering content larger than the app bundle through the `BackgroundAssets` framework — Apple's system-managed channel for asset packs with charging-aware scheduling, App Store install-progress integration, and per-user quota you can't replicate with a custom URLSession stack.

## When to Use

Use this skill when:
- Shipping content ≥10 MB that isn't needed at first launch (game level packs, ML model variants, design-tool kits, media libraries)
- Shipping Foundation Models `.fmadapter` packs (~160 MB each, per-OS-version pinning) — Apple's docs rule out bundling
- Deciding between Apple-hosted and server-hosted asset packs
- Choosing between `essential`, `prefetch`, and `onDemand` download policies
- Wiring `Info.plist` for managed asset packs (`BAHasManagedAssetPacks`, `BAUsesAppleHosting`, `BAAppGroupID`)
- Handling `BAErrorCode.downloadBackgroundActivityProhibited` and other delivery failure modes
- Testing asset packs locally with `xcrun ba-serve` before uploading to App Store Connect

## Example Prompts

Real questions developers ask that this skill answers:

- "Where should I put this 500 MB game level pack?"
- "Apple-hosted or self-hosted asset packs — which should I pick?"
- "How do I ship a Foundation Models adapter?"
- "My users report the asset pack 'isn't downloading' — what should I look at?"
- "How do I test asset pack downloads without uploading to App Store Connect?"
- "How big can my asset packs be?"
- "Should I just bundle 8 GB of textures into the IPA — it's simpler?"
- "Can I use URLSession with a background configuration instead of Background Assets?"

## What This Skill Provides

- **Channel decision** – when Background Assets is the right tool vs. app bundle, iCloud, URLSession, `BGProcessingTask`, or CloudKit assets
- **Apple-hosted vs server-hosted decision** – cost / latency / quota / App Review tradeoffs between `StoreDownloaderExtension` (Apple-hosted, two-line boilerplate) and `BADownloaderExtension` (server-hosted, custom logic); 200 GB / 100-pack Apple-hosted quota
- **Download policy cheatsheet** – `essential` (during install, counts toward App Store install progress), `prefetch` (starts during install, may continue after), `onDemand` (your code triggers via `ensureLocalAvailability(of:)`); Foundation Models adapters are always `onDemand`
- **Info.plist setup** – managed Apple-hosted minimal set (`BAHasManagedAssetPacks=true` + `BAUsesAppleHosting=true` + `BAAppGroupID`), managed server-hosted, and legacy unmanaged variants
- **Foundation Models adapter delivery pattern** – `compatibleAdapterIdentifiers(name:)` for variant selection, `AssetPackManager.shared.statusUpdates(forAssetPackWithID:)` streaming, `SystemLanguageModel.Adapter.removeObsoleteAdapters()` lifecycle, base-model fallback when no compatible variant is available
- **Local testing** – `xcrun ba-package template` / `xcrun ba-package <manifest>` for authoring; `xcrun ba-serve` HTTPS mock server + Developer Mode + root CA install for testing without App Store Connect uploads
- **Three pressure scenarios with pushback templates** – "just bundle the assets, it's simpler", "we'll just use URLSession in the background", "we'll ship one adapter for all users"
- **Audit checklists** – setup, lifecycle, quota/size, production-readiness; including the 80% quota warning email handler assignment

## Related

- [Background Assets Reference](/reference/background-assets-ref) – full `AssetPackManager` API surface, `StoreDownloaderExtension` / `BADownloaderExtension` protocol details, Info.plist keys reference, manifest schema, `xcrun ba-package` / `xcrun ba-serve` tooling, error types, Foundation Models adapter bridge APIs
- [Background Processing](background-processing) – `BGProcessingTask` / `BGAppRefreshTask` for compute scheduled by the system; NOT for asset delivery
- [Foundation Models Adapters](foundation-models-adapters) – the canonical consumer of Background Assets in axiom-ai; ~160 MB per pack, mandatory `onDemand`, per-OS variant strategy
- [Foundation Models Adapters Reference](/reference/foundation-models-adapters-ref) – adapter runtime API consuming Background Assets
