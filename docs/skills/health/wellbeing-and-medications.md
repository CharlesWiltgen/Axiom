---
name: wellbeing-and-medications
description: Use when integrating State of Mind mood logging (iOS 18+) or the Medications API (iOS 26+) — valence aggregation, symptom logging, per-object authorization, and privacy-sensitive UI patterns.
---

# Wellbeing and Medications

Sensitive health categories in HealthKit — `HKStateOfMind` mood samples and the iOS 26 Medications API. Both demand extra care in authorization, aggregation, and UI.

## When to Use This Skill

Use this skill when you're:
- Reading or writing State of Mind samples (mood, emotion, valence, labels, associations)
- Integrating the iOS 26 Medications API — tracked medications, dose events, concepts
- Logging symptoms and associating them with medications client-side
- Understanding the per-object authorization model unique to medications
- Aggregating valence values correctly across a mix of unpleasant and pleasant days

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "Why does my mood average look flat when the user had very good and very bad days?"
- "How do I ask for permission to read the user's medications?"
- "How do I log that a headache symptom might be linked to a specific medication?"
- "What's the difference between `HKMedicationConcept` and `HKUserAnnotatedMedication`?"
- "How do I build a daily mood logger that respects user privacy?"

## What This Skill Provides

### State of Mind (iOS 18+)
- The `HKStateOfMind` model: `kind`, `valence`, `labels`, `associations`, derived `valenceClassification`
- Writing samples with the right `kind` for the time horizon (momentary vs daily)
- Reading with `HKSamplePredicate.stateOfMind(_:)` and association/label predicates
- Correct valence aggregation — shift to `[0, 2]` before averaging to avoid misleading "flat" means
- Declarative SwiftUI authorization with `.healthDataAccessRequest(...)`

### Medications API (iOS 26+)
- The three-type model: `HKMedicationConcept`, `HKUserAnnotatedMedication`, `HKMedicationDoseEvent`
- Querying tracked medications with `HKUserAnnotatedMedicationQueryDescriptor`
- Reading dose events (taken, skipped, snoozed) with `HKMedicationDoseEvent` predicates
- FHIR-style clinical codings (RxNorm) on concepts for interop

### Per-Object Authorization (Medications-Only)
- Why medications skip the normal `requestAuthorization` sheet entirely
- The Health app manages per-medication toggles inline when the user adds a new medication
- Denied medications are invisible to your app — treat empty queries as "no data"
- `HKUserAnnotatedMedicationType().requiresPerObjectAuthorization()` for branching

### Symptoms and Privacy
- No built-in API links symptoms to medications — maintain a client-side RxNorm → symptom dictionary
- Symptoms are ordinary `HKCategorySample` values with an intensity scale
- Purpose strings matter most here — App Review scrutinizes mental-health and medication data
- Display valence as language or emoji, not raw `-1.0 to 1.0` numbers

## Key Pattern

Averaging raw valence values misleads users because positive and negative days cancel. Shift to a positive range first:

```swift
let adjusted = results.map { $0.valence + 1.0 }              // [0, 2]
let averageAdjusted = adjusted.reduce(0.0, +) / Double(adjusted.count)
let percent = Int(100.0 * averageAdjusted / 2.0)             // 0..100
```

Without the shift, one +0.8 day and one –0.8 day average to 0 — reporting "neutral" when the week was actually emotionally intense.

## Documentation Scope

This page documents the `wellbeing-and-medications` skill in the `axiom-health` suite. The skill file contains comprehensive guidance Claude uses when answering your questions.

**For the Medications API's unusual authorization model** — This skill covers per-object authorization in depth. [authorization-and-privacy](/skills/health/authorization-and-privacy) describes the normal HealthKit authorization discipline that applies to everything else.

## Related

- [authorization-and-privacy](/skills/health/authorization-and-privacy) — Baseline authorization patterns; medications diverge and are documented here
- [queries](/skills/health/queries) — One-shot reads for State of Mind and dose event samples
- [sync-and-background](/skills/health/sync-and-background) — Anchored queries, the recommended pattern for keeping mood and dose data in sync
- [privacy-ux](/reference/privacy-ux) — Writing purpose strings and privacy disclosures for sensitive health data
- [security-privacy-scanner](/agents/security-privacy-scanner) — Agent that audits purpose strings and privacy-sensitive data flows

## Resources

**WWDC**: 2024-10109, 2025-321

**Docs**: /healthkit/hkstateofmind, /healthkit/hkmedicationconcept, /healthkit/hkuserannotatedmedication, /healthkit/hkmedicationdoseevent, /healthkit/hkclinicalcoding, /healthkit/hkuserannotatedmedicationquerydescriptor, /healthkit/logging-symptoms-associated-with-a-medication, /healthkit/visualizing-healthkit-state-of-mind-in-visionos

**Skills**: axiom-health, axiom-security
