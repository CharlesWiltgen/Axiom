# Clinical Records and Mobility

## When to Use This Skill

Use when:
- Accessing electronic health records (allergies, conditions, immunizations, lab results, medications, procedures, vital signs, coverage) via HealthKit
- Parsing FHIR resources (`HKFHIRResource`) from provider data
- Reading mobility metrics — walking speed, step length, asymmetry, Apple Walking Steadiness, six-minute walk test
- Implementing recovery- or rehabilitation-focused features that track mobility trends
- Building a health-records-reading app that must satisfy App Store privacy requirements

#### Related Skills

- Use `fundamentals.md` for HealthKit basics
- Use `authorization-and-privacy.md` — clinical records have a **separate authorization sheet and an extra Info.plist key**
- Use `queries.md` for reading standard samples; clinical records use the same query APIs with `HKSampleQuery` + cast to `HKClinicalRecord`
- Use `sync-and-background.md` for `HKObserverQuery` on walking-steadiness events (proactive alerts)

## Two Distinct Domains

This skill covers two independent features that share the suite because they're specialized and smaller:

1. **Health Records** — read-only access to clinical data (FHIR) from connected healthcare providers. Distinct authorization, capability, and Info.plist key from the rest of HealthKit.
2. **Mobility** — passive, system-generated quantity types that measure gait and walking health. Read-only (the system collects these).

## Health Records (Clinical)

**Platform:** iOS 12+, iPadOS 12+, Mac Catalyst 13+, macOS 13+, visionOS 1+

### Clinical Type Identifiers

| Identifier | Covers |
|---|---|
| `allergyRecord` | Allergic or intolerant reactions |
| `conditionRecord` | Conditions, problems, diagnoses |
| `immunizationRecord` | Vaccine administration |
| `labResultRecord` | Lab results |
| `medicationRecord` | Medications |
| `procedureRecord` | Procedures |
| `vitalSignRecord` | Vital signs (note: **singular** "Sign") |
| `clinicalNoteRecord` | Clinical notes (iOS 16+) |
| `coverageRecord` | Insurance coverage (iOS 18+) |

Note the `.vitalSignRecord` spelling — `.vitalSignsRecord` (plural) does not compile.

Construct types via `HKObjectType.clinicalType(forIdentifier:)`:

```swift
guard let allergyType = HKObjectType.clinicalType(forIdentifier: .allergyRecord),
      let conditionType = HKObjectType.clinicalType(forIdentifier: .conditionRecord) else {
    fatalError("Clinical types should always construct")
}
```

### `HKClinicalRecord` — Shape

A sample whose value is a FHIR resource:

- `clinicalType: HKClinicalType` — the category
- `displayName: String` — the name as shown in the Health app
- `fhirResource: HKFHIRResource?` — the actual data

**Critical gotcha:** `HKClinicalRecord.startDate` / `endDate` reflect the **download timestamp to the device**, not the clinical event date. To display "when did this happen," parse the FHIR JSON for `recordedDate`, `performedDateTime`, `onsetDateTime`, etc., depending on resource type.

### `HKFHIRResource` — Parsing the Data

```swift
func parse(resource: HKFHIRResource) throws -> [String: Any]? {
    try JSONSerialization.jsonObject(with: resource.data, options: []) as? [String: Any]
}
```

Properties:

- `resourceType: HKFHIRResourceType` — `.condition`, `.observation`, `.medicationRequest`, etc.
- `fhirVersion: HKFHIRVersion` — DSTU2 or R4 (varies by provider)
- `identifier: String` — FHIR resource ID
- `sourceURL: URL?` — origin URL
- `data: Data` — JSON payload

### Capability Setup (Two Gotchas)

Both must be set — the standard HealthKit setup is insufficient for clinical records:

1. **Xcode capability:** Enable HealthKit, then check the **Clinical Health Records** checkbox inside the HealthKit capability.
2. **Info.plist key:** `NSHealthClinicalHealthRecordsShareUsageDescription` — separate from `NSHealthShareUsageDescription`. Both keys are required if you read both clinical and non-clinical data.

App Review enforces:

- A valid **Privacy Policy URL** in App Store Connect — Apple displays this on the clinical-records permission sheet.
- "App Review may reject inappropriate use of clinical records" — don't enable the capability speculatively.

### Authorization (Read-Only)

Clinical records cannot be written by your app:

```swift
store.requestAuthorization(toShare: nil, read: [allergyType, conditionType]) { success, error in
    // Even with "success", the user may have granted access to no records.
    // Run a query and handle empty results as a valid state.
}
```

The permission sheet for clinical types surfaces connected provider accounts and is distinct from the standard HealthKit sheet. The user can grant access per provider connection.

### Reading Clinical Records

Use the same query APIs as any other sample type, but cast the result:

```swift
let descriptor = HKSampleQueryDescriptor(
    predicates: [HKSamplePredicate.clinicalRecord(type: allergyType, predicate: nil)],
    sortDescriptors: []
)
let records: [HKClinicalRecord] = try await descriptor.result(for: store)

for record in records {
    print(record.displayName)
    if let resource = record.fhirResource {
        // Parse resource.data for clinical-event details.
    }
}
```

### FHIR Parsing Realities

- **Parse defensively.** The same logical resource (e.g., a `Condition`) can arrive in DSTU2 or R4, with different JSON shapes. Inspect `fhirVersion` and branch.
- **Don't assume fields are present.** Clinical data is sparse. Missing fields are normal, not errors.
- **Normalize dates from FHIR, not `HKSample`.** `HKClinicalRecord.startDate` is download time; always pull the clinical event date from the FHIR payload.

## Mobility

Apple Watch and iPhone collect a suite of **system-generated** walking and mobility metrics passively. Your app reads them; you cannot write them.

### Core Mobility Quantity Types

| Identifier | iOS | Unit | What it measures |
|---|---|---|---|
| `walkingSpeed` | 14+ / watchOS 7+ | `HKUnit.meter().unitDivided(by: .second())` | Average speed when walking steadily over flat ground |
| `walkingStepLength` | 14+ / watchOS 7+ | `.meter()` | Average step length |
| `walkingDoubleSupportPercentage` | 14+ / watchOS 7+ | `.percent()` | Time with both feet on the ground (typical 20–40%) |
| `walkingAsymmetryPercentage` | 14+ / watchOS 7+ | `.percent()` | Steps where one foot moves differently from the other |
| `appleWalkingSteadiness` | 15+ / watchOS 8+ | `.percent()` (**0.0–1.0**) | Gait stability score; sampled ~weekly |
| `sixMinuteWalkTestDistance` | 14+ / watchOS 7+ | `.meter()` | Estimated six-minute walk distance (capped at 500 m) |
| `stairAscentSpeed` | 14+ / watchOS 7+ | m/s | Speed climbing stairs |
| `stairDescentSpeed` | 14+ / watchOS 7+ | m/s | Speed descending stairs |

**Unit gotcha:** Apple Walking Steadiness is `.percent()` but values are in `[0.0, 1.0]`, not `[0, 100]`. Multiply by 100 only for display.

### Wheelchair Mode Suppresses Walking Metrics

If the user has wheelchair mode enabled in Health → Health Profile, walking and stair metrics return empty. Your app must treat empty results as "not applicable for this user," not "this user has no mobility issues."

### Walking Steadiness Classification

```swift
func classify(for quantity: HKQuantity) -> HKAppleWalkingSteadinessClassification? {
    try? HKAppleWalkingSteadinessClassification(for: quantity)
}
```

Three cases: `.ok`, `.low`, `.veryLow`. Each carries `minimum` and `maximum` properties exposing the band thresholds.

Pair with `HKCategoryType(.appleWalkingSteadinessEvent)` and an `HKObserverQuery` to proactively notify the user when gait degrades — see `sync-and-background.md` for the observer pattern.

### Six-Minute Walk Recalibration

After surgery, injury, or major medical events, walking estimates can drift. Users can reset them:

```swift
let type = HKSampleType.quantityType(forIdentifier: .sixMinuteWalkTestDistance)!
if type.allowsRecalibrationForEstimates {
    try await store.recalibrateEstimates(sampleType: type, date: surgeryDate)
}
```

Requires a separate entitlement: `com.apple.developer.healthkit.recalibrate-estimates`.

Important user-facing caveats (from WWDC 2021-10287):

> "This method does not affect estimates that are already present in HealthKit at the time of use, so it's important to recalibrate as soon as possible after a surgery."

> "After recalibration, it could take up to 14 days to rebuild enough activity history to make a confident estimate."

Surface a 14-day warm-up message in your UI — don't present stale or uncertain data as authoritative during the warm-up window.

### Mobility App Setup Prerequisites

- Walking metrics require the user to set height in the Health app (required for accurate walking-speed estimation).
- Apple Watch Series 3 or later, worn ≥8 hours/day, ≥3 days/week, sustained ≥4 weeks.
- Verify the user has at least two weeks of consistent `walkingSpeed` samples before displaying derived trends — per WWDC 2021-10287, that's the threshold Apple suggests for data confidence.

## Core Motion Is a Different Framework

Apple has two motion-telemetry stacks and they do not bridge:

| | Core Motion | HealthKit mobility |
|---|---|---|
| API surface | `CMMotionManager`, `CMPedometer`, `CMFallDetectionManager` | `HKQuantityType.quantityType(forIdentifier:)` with mobility identifiers |
| Latency | Real-time (Hz range) | Days (validated, processed metrics) |
| Persistence | In-memory streams (some history for `CMPedometer`) | Health database (user-portable) |
| Authorization | Motion & Fitness permission | HealthKit share/read |
| Use case | Live games, rep counters, instant step feedback | Trend analysis, clinical export, gait/steadiness |

**Rule of thumb:** do not reimplement HealthKit mobility metrics from raw Core Motion data. The system-generated metrics encode Apple's validated thresholds (waist-carry detection, flat-ground gating, walking-steadily detection) that a custom pipeline cannot easily replicate.

Axiom does not yet cover Core Motion as its own suite — it's parked in `future-suites-parking-lot` memory for a future `axiom-motion` suite.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using `.vitalSignsRecord` (plural) | Correct symbol is `.vitalSignRecord` (singular). |
| Treating `HKClinicalRecord.startDate` as the clinical event date | It's the download timestamp. Parse the FHIR JSON for the real date. |
| Forgetting `NSHealthClinicalHealthRecordsShareUsageDescription` | Without this key, authorization for clinical types fails silently. It's separate from `NSHealthShareUsageDescription`. |
| Enabling Clinical Health Records capability "just in case" | App Review rejects unused capability. Enable only when you actually read clinical data. |
| Treating empty mobility queries as "user has no problems" | Wheelchair mode suppresses walking metrics; the user may simply not generate this data. Render an honest empty state. |
| Reading `appleWalkingSteadiness` as 0–100 | It's `[0.0, 1.0]`. Multiply by 100 for display only. |
| Skipping the Privacy Policy URL for clinical apps | App Store review rejects without one. It's displayed on the permission sheet. |
| Assuming `HKFHIRResource.data` follows a single schema | DSTU2 and R4 have different shapes. Check `fhirVersion` and parse defensively. |
| Displaying six-minute walk estimates during the 14-day recalibration warm-up | Not reliable. Explain the recalibration window in the UI or hide the metric. |
| Hand-rolling gait analysis from Core Motion | Re-implementing the validated HealthKit mobility metrics is a research project, not a feature. Use HealthKit mobility types. |

## Resources

**WWDC**: 2018-229, 2021-10287

**Docs**: /healthkit/accessing-health-records, /healthkit/hkclinicaltype, /healthkit/hkclinicaltypeidentifier, /healthkit/hkclinicalrecord, /healthkit/hkfhirresource, /healthkit/hkfhirresourcetype, /healthkit/creating-a-mobility-health-app, /healthkit/hkquantitytypeidentifier/walkingspeed, /healthkit/hkquantitytypeidentifier/applewalkingsteadiness, /healthkit/hkquantitytypeidentifier/sixminutewalktestdistance, /healthkit/hkapplewalkingsteadinessclassification, /healthkit/hkhealthstore/recalibrateestimates(sampletype:date:completion:)

**Skills**: axiom-health (fundamentals, authorization-and-privacy, queries, sync-and-background)
