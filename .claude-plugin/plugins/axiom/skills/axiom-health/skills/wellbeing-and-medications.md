# Wellbeing and Medications

## When to Use This Skill

Use when:
- Reading or writing State of Mind samples (mood and emotion logging, iOS 18+)
- Integrating the HealthKit Medications API (iOS 26+) — concepts, tracked medications, dose events
- Logging symptoms associated with medications
- Understanding the per-object authorization model for medications (different from every other HealthKit type)

#### Related Skills

- Use `fundamentals.md` for the HealthKit data model
- Use `authorization-and-privacy.md` for authorization discipline — and read the per-object section in this skill, which differs from the norm
- Use `queries.md` for one-shot sample reads
- Use `sync-and-background.md` for anchored queries, the recommended pattern for State of Mind and medication dose events

## Why Both Live Here

State of Mind (mental wellbeing) and the Medications API are high-salience categories. Both can reveal mental-health, reproductive-health, HIV, or oncology diagnoses. Apple groups them together under "sensitive health data," and both demand extra care in authorization, UI, and privacy disclosures.

## State of Mind

**Platform:** iOS 18+, iPadOS 18+, macOS 15+, visionOS 2+, watchOS 11+

`HKStateOfMind` is a sample class capturing a user's emotional state at a point in time. Four orthogonal inputs:

| Field | Type | Values |
|---|---|---|
| `kind` | `HKStateOfMind.Kind` | `.momentaryEmotion` (seconds to minutes) or `.dailyMood` (hours to days) |
| `valence` | `Double` | Continuous `-1.0` (very unpleasant) to `+1.0` (very pleasant) |
| `labels` | `[HKStateOfMind.Label]` | 38 emotion labels (happy, anxious, grateful, etc.) — multiple allowed |
| `associations` | `[HKStateOfMind.Association]` | 18 life-area tags (work, family, fitness, etc.) — multiple allowed |

A derived `valenceClassification: HKStateOfMind.ValenceClassification` bucket (7 cases from `veryUnpleasant` to `veryPleasant`) is available via `init(valence:)`.

### Recording a sample

```swift
import HealthKit

let sample = HKStateOfMind(
    date: .now,
    kind: .momentaryEmotion,
    valence: 0.6,
    labels: [.happy, .grateful],
    associations: [.family, .selfCare]
)

try await store.save(sample)
```

### Reading State of Mind

Use `HKSamplePredicate.stateOfMind(_:)` with compound predicates over the wellbeing-specific helpers:

```swift
let dateRange = HKQuery.predicateForSamples(
    withStart: start, end: .now
)
let associationPredicate = HKQuery.predicateForStatesOfMind(with: .work)
let labelPredicate = HKQuery.predicateForStatesOfMind(with: .stressed)

let compound = NSCompoundPredicate(andPredicateWithSubpredicates: [
    dateRange, associationPredicate, labelPredicate
])

let descriptor = HKSampleQueryDescriptor(
    predicates: [HKSamplePredicate.stateOfMind(compound)],
    sortDescriptors: []
)
let results: [HKStateOfMind] = try await descriptor.result(for: store)
```

### Aggregating Valence Correctly

**Common bug:** naively averaging valence across a mix of negative and positive values gives a misleading "average mood." Apple's canonical pattern (WWDC 2024-10109) shifts the range to `[0, 2]` first:

```swift
let adjusted = results.map { $0.valence + 1.0 }                 // [0, 2]
let totalAdjusted = adjusted.reduce(0.0, +)
let averageAdjusted = totalAdjusted / Double(adjusted.count)
let percent = Int(100.0 * averageAdjusted / 2.0)                // 0..100
```

Without the shift, one +0.8 day and one –0.8 day average to 0 (neutral), misrepresenting two emotionally-intense days as flat.

### SwiftUI Authorization Modifier

HealthKitUI provides a declarative request modifier tied to a trigger:

```swift
import HealthKitUI

struct MoodView: View {
    @State private var triggerAuth = false
    let store = HKHealthStore()

    var body: some View {
        Button("Start mood logging") { triggerAuth = true }
            .healthDataAccessRequest(
                store: store,
                shareTypes: [HKSampleType.stateOfMindType()],
                readTypes: [HKSampleType.stateOfMindType()],
                trigger: triggerAuth
            ) { result in
                // Handle Result<Bool, Error>
            }
    }
}
```

## Medications API

**Platform:** iOS 26+, iPadOS 26+, macOS 26+, visionOS 26+, watchOS 26+

> The Health app has had medication tracking since iOS 15, but the **public Medications API is iOS 26 and later only**. Prior-OS apps cannot read or write medication data.

Three types form the model:

| Type | Role | Sample? |
|---|---|---|
| `HKMedicationConcept` | Conceptual medication identity (name, form, clinical codes like RxNorm) | Not a sample |
| `HKUserAnnotatedMedication` | The user's tracked medication — wraps a concept with nickname, schedule, archive state | Not a sample |
| `HKMedicationDoseEvent` | A single logged dose — taken, skipped, snoozed | Yes (HKSample subclass) |

### `HKMedicationConcept`

Identity of a medication, with clinical codings (e.g., RxNorm code `105929` is piroxicam):

- `identifier: String` — unique identifier
- `displayText: String` — user-facing name
- `generalForm` — tablet, capsule, cream, injection, inhaler, etc.
- `relatedCodings: [HKClinicalCoding]` — FHIR-style codings for interop

`HKClinicalCoding` has `system`, `version`, `code` properties. The supported coding systems aren't exhaustively documented; RxNorm is confirmed.

### `HKUserAnnotatedMedication`

A medication the user is tracking. Queried via `HKUserAnnotatedMedicationQueryDescriptor`:

```swift
let descriptor = HKUserAnnotatedMedicationQueryDescriptor(predicate: nil, limit: 0)
let meds: [HKUserAnnotatedMedication] = try await descriptor.result(for: store)

for med in meds where !med.isArchived {
    // Active medication; nickname, concept, etc.
}
```

Key properties:
- `medication: HKMedicationConcept` — the tracked concept
- `nickname: String?` — user-set label
- `hasSchedule: Bool` — user configured times in the Health app
- `isArchived: Bool` — user marked as "no longer taking"

Users configure schedules in the Health app. The system handles notifications and dose logging. Third-party apps observe, they don't drive.

### `HKMedicationDoseEvent`

A sample recording a single dose:

```swift
let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
    HKQuery.predicateForSamples(withStart: startOfDay, end: .now),
    HKMedicationDoseEvent.predicateForMedication(concept),
    HKMedicationDoseEvent.predicateForLogStatus(.taken)
])

let descriptor = HKSampleQueryDescriptor(
    sampleType: HKMedicationDoseEvent.self,
    predicate: predicate,
    sortDescriptors: [SortDescriptor(\.startDate, order: .reverse)],
    limit: 1
)
let doses = try await descriptor.result(for: store)
```

Key properties:
- `medicationConceptIdentifier: String`
- `logStatus` — whether the user marked the dose taken, skipped, or snoozed
- `scheduleType` — scheduled vs. "as needed"
- `scheduledDate: Date?` and `scheduledDoseQuantity: HKQuantity?`
- `doseQuantity: HKQuantity?` — actual amount taken
- `unit: HKUnit`

## Per-Object Authorization (Medications-Specific)

**This is the biggest departure from normal HealthKit.** Medications do not use the familiar per-type authorization sheet. Instead, the user authorizes your app medication-by-medication, inside the Health app.

Consequences:

- You cannot request medication access via the normal `requestAuthorization` sheet — it will not appear.
- When a user adds a new medication in Health, Apple presents a per-app toggle inline. Your app is not notified; on next query, the new medication just appears.
- You cannot know which medications the user has but denied access to. From your app's point of view, denied medications simply do not exist.
- Use `HKUserAnnotatedMedicationType().requiresPerObjectAuthorization()` to branch if needed.

This is the same privacy-protective design as HealthKit reads broadly — denials are invisible — but scoped per medication instead of per type.

## Linking Medications to Symptoms (No Built-in API)

There is no framework-level API for "this symptom was caused by that medication." Apple's sample app maintains a client-side dictionary keyed by RxNorm code to map medications to relevant symptoms:

```swift
let symptomMap: [String: [SymptomModel]] = [
    "105929": [                                    // Piroxicam
        SymptomModel(name: "Headache", categoryID: .headache),
        SymptomModel(name: "Nausea", categoryID: .nausea),
        SymptomModel(name: "Diarrhea", categoryID: .diarrhea),
    ],
    // ...
]
```

Symptoms themselves are ordinary `HKCategorySample`:

```swift
enum SymptomIntensity: Int {
    case none = 0, mild, moderate, severe, extreme
}

let sample = HKCategorySample(
    type: HKCategoryType(.headache),
    value: SymptomIntensity.moderate.rawValue,
    start: .now,
    end: .now
)
try await store.save(sample)
```

## Info.plist

Both State of Mind and Medications require the same keys as any HealthKit feature:

- `NSHealthShareUsageDescription`
- `NSHealthUpdateUsageDescription`

Write purpose strings that honestly describe why the app needs mental-health or medication data. These categories are the most likely to trigger user denial or App Review scrutiny.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Averaging raw valence across a mix of negative and positive days | Shift to `[0, 2]` by `valence + 1.0` before averaging, then rescale to `[0, 100]`. |
| Trying to request medication access via `requestAuthorization` | Medications use per-object authorization managed inside the Health app. The normal sheet does nothing for medication types. |
| Expecting a framework API linking symptoms to medications | There isn't one. Apple's sample uses an RxNorm → symptom-list dictionary client-side. |
| Using the Medications API on iOS 25 or earlier | API is iOS 26+. Check with `@available(iOS 26.0, *)`. |
| Assuming the Health app "one mood per day" rule reflects the framework | Daily mood samples can be saved multiple times per day via the API. The Health app UI shows one, but your data model can differ. |
| Requesting every `HKStateOfMind.Label` and `.Association` up front | Request the minimum set for your feature. Broad requests feel invasive for mental-health data. |
| Displaying raw valence numbers to users | Users understand emotional language, not `-0.2 to 0.8`. Map to the 7-bucket `ValenceClassification` or emoji. |
| Failing to treat denied medication reads as "no data" | Per privacy design, denials are invisible; empty queries must render as empty states, not errors. |

## Resources

**WWDC**: 2024-10109, 2025-321

**Docs**: /healthkit/hkstateofmind, /healthkit/hkmedicationconcept, /healthkit/hkuserannotatedmedication, /healthkit/hkmedicationdoseevent, /healthkit/hkclinicalcoding, /healthkit/hkuserannotatedmedicationquerydescriptor, /healthkit/logging-symptoms-associated-with-a-medication, /healthkit/visualizing-healthkit-state-of-mind-in-visionos, /healthkitui/healthdataaccessrequest(store:sharetypes:readtypes:trigger:completion:)

**Skills**: axiom-health (fundamentals, authorization-and-privacy, queries, sync-and-background)
