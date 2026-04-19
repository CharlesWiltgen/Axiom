# Localization Research & Consistency Reference

## Overview

Pre-translation and post-translation discipline for shipping localized apps that match platform conventions. String Catalogs get the mechanics right; this reference covers the research and consistency work that determines whether translations feel *native* or feel *machine-translated*.

**Key distinction** `localization.md` covers the Xcode/xcstrings workflow (how to localize). This skill covers terminology research, termbase discipline, VoiceOver-specific translation, pseudolocalization, and TMS selection (what to localize and whether your translations are right).

---

## When to Use This Skill

Use this skill when:
- Matching terminology to Apple's platform vocabulary (Music, Mail, Calendar, Photos, Settings)
- Building a project glossary before a translation pass
- Writing translator context for VoiceOver-only strings
- Stress-testing layout before real translations arrive
- Choosing a Translation Management System (Crowdin, Lokalise, Phrase) for a team-scale pass
- Preparing for Apple Design Award Inclusivity review
- Auditing existing translations for consistency or platform-match

Do NOT use this skill for:
- Xcode String Catalog setup (use `localization.md`)
- Plural handling, RTL, locale-aware formatting (use `localization.md`)
- Generating translator comments automatically (see `localization.md` Part 10 — Xcode 26 AI comments)

---

## Related Skills

- **skills/localization.md** — String Catalog mechanics, SwiftUI/UIKit APIs, plurals, RTL, formatters
- **axiom-accessibility** — VoiceOver labels, hints, traits (the strings this skill helps translate)
- **axiom-design → skills/hig.md** — HIG terminology conventions

---

## Part 1: Matching Apple's Platform Terminology

Users expect "Shuffle," "Up Next," "Now Playing," "Smart Playlist" to mean exactly what they mean in Apple Music. Diverging from Apple's canonical translations feels wrong in every language — even if your translation is technically correct.

### Primary Sanity Check (Authoritative)

**Apple Support multi-locale pages** — the authoritative source. Apple's help articles ship in every supported locale with hand-translated terminology. Fetch the same article across locales and compare:

| Locale | URL pattern |
|--------|-------------|
| English (US) | `https://support.apple.com/en-us/<article-id>` |
| French | `https://support.apple.com/fr-fr/<article-id>` |
| Japanese | `https://support.apple.com/ja-jp/<article-id>` |
| Korean | `https://support.apple.com/ko-kr/<article-id>` |
| German | `https://support.apple.com/de-de/<article-id>` |

**Workflow**
1. Find the relevant Apple Support article for the system app you're mirroring (e.g., "Shuffle or repeat songs in Music").
2. Load it in your source locale to confirm the article covers the term.
3. Swap the locale segment in the URL. Apple redirects to the localized version.
4. Extract the target term as translated by Apple's localization team.
5. Record it in your project glossary (see Part 2).

Use `WebFetch` for this — the content is text-only and renders cleanly.

### Fast Lookup (Community, Supplementary)

**applelocalization.com** — community-built, queryable database of localized strings extracted from Apple's `.strings`/`.xcstrings` files across iOS and macOS frameworks (including `MusicUI.framework` and `MusicKit.framework`). Faster than hopping across Apple Support pages, and covers framework strings that don't appear in help articles.

**When to use**
- Need 10–30 terms quickly for an initial glossary pass.
- Looking for a framework-level string (button label, menu item) that doesn't appear in help articles.
- Want to see how Apple translates a term across 40+ locales at once.

**When to fall back to Apple Support**
- The term is ambiguous or contested (multiple candidate translations).
- You're preparing for App Store or ADA review and need a defensible source.
- applelocalization.com returns no hits or stale data.

**Framing** Treat applelocalization.com as a *sanity-check* tool, not a source of truth. It's scraped community data, not Apple-published. The Apple Support cross-check is what makes a translation defensible.

### Terms Worth Looking Up First

For media/music apps, these 15 terms drive perceived quality:

```
Up Next, Now Playing, Shuffle, Repeat, Queue, Library, Playlist, Smart Playlist,
Favorites, Downloaded, Recently Added, Recently Played, Listen Now, For You, Radio
```

For generic apps:

```
Settings, Preferences, Done, Cancel, OK, Edit, Delete, Share, Save, Open,
Search, Filter, Sort, More, Show More, Show Less, Loading, Retry
```

---

## Part 2: Project Termbase (Glossary)

A **termbase** (or translation glossary) is a canonical mapping of app-specific terms to their localized forms. It prevents drift when future strings get added ad-hoc by different translators or AI passes.

### What Belongs in a Termbase

| Category | Examples |
|----------|----------|
| Brand words | App name, product line, feature names |
| Feature words | "Smart Playlist", "Visualizer presets", "Up Next" |
| Platform-mirroring terms | "Shuffle", "Now Playing" (from Part 1 research) |
| Domain-specific predicates | "is", "is not", "contains", "starts with" (filter UIs) |
| Action verbs | "Pin", "Unpin", "Favorite", "Add to Library" |
| State labels | "Downloaded", "Pending", "Offline" |

Target 20–30 terms for a small app. Over 50 and it becomes maintenance overhead; under 15 and you'll miss the drift-prone cases.

### Termbase Format

Store as markdown in the repo so translators and reviewers can diff it:

```markdown
# Poppy Localization Glossary

| English | fr | ja | ko | Source | Notes |
|---------|----|----|----|--------|-------|
| Up Next | À suivre | 次はこちら | 다음 항목 | Apple Music (ios 18) | Apple Music UI terminology |
| Shuffle | Aléatoire | シャッフル | 셔플 | Apple Music (ios 18) | |
| Smart Playlist | Liste intelligente | スマートプレイリスト | 스마트 재생목록 | Apple Music (ios 18) | |
| Visualizer | Visualiseur | ビジュアライザ | 비주얼라이저 | Project decision 2026-04 | Custom Poppy term |
```

**Source column is load-bearing.** It tells the next translator whether a term is locked to Apple's canonical form (don't change) or a project decision (can revisit). Without it, every new translator re-opens settled questions.

### When to Build It

- **Before** the first translation pass — avoids re-translation work.
- **Before** adding a new locale — prevents drift between locales.
- **Before** an ADA/App Store submission — makes translation choices defensible.
- **After** a user complaint about terminology — add the corrected term with source.

### Where to Store It

| Location | Rationale |
|----------|-----------|
| `.ai/context/localization-glossary.md` | If you want AI assistants to pick it up automatically |
| `docs/localization/glossary.md` | If contributors need it |
| `Localization/glossary.md` next to `.xcstrings` | If translators work directly in the repo |

Any of these works. What matters is that it's in version control and discoverable.

---

## Part 3: VoiceOver-Aware Translator Comments

VoiceOver labels and hints are **spoken, not read**. They need different translation than visible labels:

| String type | Visible? | Translation priority |
|-------------|----------|---------------------|
| `Text("Cancel")` | Yes | Concise, matches platform |
| `.accessibilityLabel("Cancel deletion")` | No (spoken only) | Clear, full-sentence OK |
| `.accessibilityHint("Double tap to cancel deletion of the collection")` | No (spoken only) | Full instructional sentence |

**The problem** A translator seeing `"Cancel"` with no context will give you the platform-match short form (`Annuler`, `キャンセル`). But if the string is actually a VoiceOver hint that needs to read as a full spoken instruction, the short form is wrong.

### Convention

Prefix translator comments for VoiceOver-only strings with `VoiceOver:` so translators know the audience:

```swift
String(
    localized: "Double tap to change artwork",
    comment: "VoiceOver: spoken hint for the artwork button. Not visible on screen."
)
```

In a String Catalog, the comment field carries into the translator's view. Adding the `VoiceOver:` prefix lets translators (and TMS filters) identify these strings and translate them with spoken-instruction phrasing rather than UI-label phrasing.

### Complementary Discipline

- Pair every `.accessibilityLabel` or `.accessibilityHint` with an explicit `comment:` parameter.
- Don't rely on Xcode 26 AI-generated comments for VoiceOver strings — the AI can't know the string isn't visible on screen. Write these comments by hand.
- In pseudolocalization runs (Part 4), VoiceOver strings won't visually stress layout but *will* reveal truncation in screen reader output if tested with VoiceOver + Accented Pseudolanguage.

---

## Part 4: Pseudolocalization (Layout Stress Testing)

Pseudolocalization replaces source strings with lengthened, accented, or RTL-reversed variants to stress-test layout *before* real translations arrive. German strings are often 30–40% longer than English; Arabic/Hebrew require full RTL layout. Finding layout breaks in pseudolocalization is cheap; finding them after paying for translations is expensive.

### Xcode Scheme Options

Edit scheme → Run → Options → **Application Language**:

| Setting | Purpose |
|---------|---------|
| **Accented Pseudolanguage** | Lengthens strings 30–50%, accents every character. Stress-tests layout and truncation. |
| **Right-to-Left Pseudolanguage** | Mirrors layout, reverses text direction. Stress-tests RTL without needing Arabic/Hebrew content. |
| **Double-Length Pseudolanguage** | Duplicates every string. Extreme stress test for wrapping/truncation. |
| **Bounded String Pseudolanguage** | Wraps each string in `[# ... #]` brackets. Reveals non-localized (hardcoded) strings instantly. |

### When to Run Each

| Goal | Mode |
|------|------|
| Hunting hardcoded (non-localized) strings | Bounded String |
| Stress-testing layout before first translation pass | Accented, then Double-Length |
| Verifying RTL layout before adding Arabic/Hebrew | Right-to-Left |
| Final pre-submission layout check | Double-Length |

### Workflow

1. Set scheme to **Bounded String Pseudolanguage** first. Run through every screen. Any string that doesn't appear wrapped in `[# ... #]` is hardcoded — fix before translation.
2. Switch to **Accented Pseudolanguage**. Run through every screen. Look for: truncated labels, buttons that wrap unexpectedly, tab bar items that overflow, toolbar items that collapse.
3. If shipping RTL, switch to **Right-to-Left Pseudolanguage**. Verify: chevrons flip, leading/trailing alignment behaves, custom layouts mirror correctly.
4. Run **Double-Length Pseudolanguage** as a final stress test. Anything that survives this will survive real-world German/Finnish.

### Pressure Scenario

**"We don't have translators yet — can we ship without pseudolocalization?"**

No. Pseudolocalization doesn't need translators — it's a build-time toggle that uses a synthetic language. Skipping it means layout bugs get discovered *after* paying for translations, when fixing them may require re-translating resized strings. The 30-minute scheme-switching pass saves multiple hours of re-translation.

---

## Part 5: Translation Management Systems

For team-scale translation passes across multiple locales, TMS tools manage translation memory, reviewer approval state, and `.xcstrings` round-tripping.

### When You Need a TMS

You probably need a TMS when:
- Translating into 3+ locales simultaneously.
- Multiple translators or a review/approval workflow is involved.
- You'll do repeated passes as strings evolve (translation memory becomes valuable).
- Non-developer stakeholders (PM, marketing) need to see and approve translations.

You probably don't need a TMS when:
- Single developer, 1–2 locales, infrequent updates.
- Using AI translation + a single bilingual reviewer.
- The glossary (Part 2) plus direct `.xcstrings` editing in Xcode is sufficient.

### Tool Comparison

| Tool | `.xcstrings` support | Translation memory | Notes |
|------|---------------------|--------------------|-------|
| **Crowdin** | Native | Yes | Strong collaboration UI, generous free tier for open source |
| **Lokalise** | Native | Yes | Best-in-class API, good for CI integration |
| **Phrase** | Native | Yes | Strong glossary/termbase features, VoiceOver i18n guide |
| **SimpleLocalize** | Native | Yes | Lighter weight, simpler pricing |

All four import `.xcstrings` directly (no conversion step). Most preserve the `state` field (translated / needs-review / stale) that Xcode uses — verify with your chosen tool's current docs before committing to a round-trip workflow.

### Round-Trip Workflow

```
Xcode → export .xcstrings → TMS import → translate/review → TMS export → replace .xcstrings → Xcode
```

1. Commit `.xcstrings` with current source strings.
2. Upload to TMS (most have CLI or Xcode integration).
3. Translators work in TMS UI (with termbase, translation memory, comments).
4. Reviewer transitions state from `needsReview` → `translated`.
5. Export back to `.xcstrings`.
6. Commit the updated file. Build to verify.

### Integrating With the Termbase (Part 2)

All four tools accept a termbase/glossary upload (CSV or TBX format). Import your project glossary so translators see canonical terms inline and can't accidentally diverge from Apple's platform terminology.

---

## End-to-End Pre-Submission Workflow

For an app preparing for ADA review or App Store submission with fresh translations:

1. **Pseudolocalize first** (Part 4, Bounded String mode) — fix all hardcoded strings.
2. **Research Apple terms** (Part 1) — 15–30 most-prominent UI terms, cross-checked against Apple Support multi-locale pages.
3. **Build the glossary** (Part 2) — commit to `.ai/context/localization-glossary.md` or equivalent.
4. **Audit VoiceOver comments** (Part 3) — every `.accessibilityLabel`/`.accessibilityHint` has a `VoiceOver:`-prefixed translator comment.
5. **Enable Xcode 26 AI comment generation** (see `localization.md` Part 10) — fills in translator context for remaining strings.
6. **Translate** — via TMS (Part 5) if team-scale, or directly in Xcode + glossary if solo.
7. **Pseudolocalize again** (Accented + Double-Length) — verify translated layout still works.
8. **Device test** — real devices in target locales, VoiceOver on, all screens walked through.

This sequence catches layout issues before paying for translation, catches terminology drift before users complain, and produces a defensible paper trail for ADA Inclusivity review.

---

## Resources

**Apple**: /xcode/localizing-and-varying-text-with-a-string-catalog, /xcode/localization, /accessibility/voiceover

**WWDC**: 2025-225 (Xcode 26 localization), 2023-10155 (String Catalogs), 2021-10221 (Streamline your localized strings)

**Community**: applelocalization.com (community-built localized strings database — sanity-check, not authoritative)

**Support pages** (authoritative cross-check): support.apple.com/en-us → swap locale segment (fr-fr, ja-jp, ko-kr, de-de, etc.)

**TMS**: Crowdin, Lokalise, Phrase, SimpleLocalize (all support `.xcstrings` natively)

**Skills**: skills/localization.md (String Catalog mechanics), axiom-accessibility (VoiceOver strings this skill helps translate), axiom-design → skills/hig.md (HIG terminology conventions)
