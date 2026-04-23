---
name: clinical-and-mobility
description: Use when reading clinical health records (FHIR resources, allergies, conditions, labs, medications, vitals, coverage) or passive mobility metrics (walking speed, Apple Walking Steadiness, six-minute walk) — includes the separate clinical authorization and recalibration patterns.
---

# Clinical Records and Mobility

Two specialized HealthKit domains — read-only FHIR clinical records from connected providers, and system-generated mobility metrics that measure gait and walking health.

## When to Use This Skill

Use this skill when you're:
- Accessing electronic health records (allergies, conditions, immunizations, labs, medications, procedures, vitals, coverage) via HealthKit
- Parsing `HKFHIRResource` JSON from provider data (DSTU2 or R4)
- Reading mobility metrics — walking speed, step length, asymmetry, Apple Walking Steadiness, six-minute walk test
- Building a recovery or rehabilitation feature that tracks gait trends
- Passing App Store review for a health-records-reading app

## Example Prompts

Questions you can ask Claude that will draw from this skill:

- "How do I read the user's allergies and conditions from connected providers?"
- "Why is `HKClinicalRecord.startDate` showing today instead of the actual diagnosis date?"
- "What's the right way to display Apple Walking Steadiness to the user?"
- "After the user's knee surgery, how do I recalibrate their six-minute walk estimates?"
- "Why are my clinical-record queries returning empty even though the user has data?"

## What This Skill Provides

### Health Records (Clinical FHIR)
- The nine clinical type identifiers (including the `.vitalSignRecord` singular-spelling gotcha)
- `HKClinicalRecord` shape: `clinicalType`, `displayName`, `fhirResource`
- `HKFHIRResource` properties and defensive JSON parsing across DSTU2 and R4
- Why `HKClinicalRecord.startDate` is the download timestamp, not the clinical event date
- Two-part capability setup: Xcode "Clinical Health Records" checkbox plus `NSHealthClinicalHealthRecordsShareUsageDescription`
- Privacy Policy URL requirement in App Store Connect
- Reading records with `HKSamplePredicate.clinicalRecord(type:predicate:)`

### Mobility Metrics
- Eight system-generated quantity types: walking speed, step length, double-support percentage, asymmetry, Apple Walking Steadiness, six-minute walk, stair ascent/descent speed
- Unit gotcha: Apple Walking Steadiness is `.percent()` but values are `[0.0, 1.0]`
- Wheelchair mode suppresses walking metrics — render honest empty states
- `HKAppleWalkingSteadinessClassification` (`.ok`, `.low`, `.veryLow`) with band thresholds
- Pairing `appleWalkingSteadinessEvent` with `HKObserverQuery` for proactive gait alerts
- `recalibrateEstimates(sampleType:date:)` after surgery or injury, plus the 14-day rebuild window

### Core Motion vs HealthKit Mobility
- Side-by-side comparison: latency, persistence, authorization, use case
- Why hand-rolling gait analysis from `CMMotionManager` is a research project, not a feature
- Apple's validated thresholds (waist-carry detection, flat-ground gating) can't be easily replicated

## Key Pattern

`HKClinicalRecord.startDate` is the date the record landed on the device, not the date the clinical event happened. Always pull the real date from the FHIR payload:

```swift
func parse(resource: HKFHIRResource) throws -> [String: Any]? {
    try JSONSerialization.jsonObject(with: resource.data, options: []) as? [String: Any]
}
```

Inspect `resource.fhirVersion` and branch — DSTU2 and R4 have different shapes. Then pull `recordedDate`, `performedDateTime`, or `onsetDateTime` depending on `resourceType`.

## Documentation Scope

This page documents the `clinical-and-mobility` skill in the `axiom-health` suite. The skill file contains comprehensive guidance Claude uses when answering your questions.

**For the separate clinical authorization sheet** — Clinical records use `NSHealthClinicalHealthRecordsShareUsageDescription` in addition to the standard HealthKit Info.plist keys. [authorization-and-privacy](/skills/health/authorization-and-privacy) covers the baseline HealthKit authorization discipline; this page documents the clinical-specific additions.

## Related

- [authorization-and-privacy](/skills/health/authorization-and-privacy) — Baseline HealthKit authorization plus the extra clinical-records Info.plist key
- [queries](/skills/health/queries) — Standard sample query APIs work for clinical records with a cast to `HKClinicalRecord`
- [sync-and-background](/skills/health/sync-and-background) — `HKObserverQuery` pattern for proactive Apple Walking Steadiness alerts
- [privacy-ux](/reference/privacy-ux) — Writing purpose strings and the Privacy Policy URL App Review will enforce
- [security-privacy-scanner](/agents/security-privacy-scanner) — Agent that audits privacy disclosures and capability usage

## Resources

**WWDC**: 2018-229, 2021-10287

**Docs**: /healthkit/accessing-health-records, /healthkit/hkclinicaltype, /healthkit/hkclinicaltypeidentifier, /healthkit/hkclinicalrecord, /healthkit/hkfhirresource, /healthkit/hkfhirresourcetype, /healthkit/creating-a-mobility-health-app, /healthkit/hkquantitytypeidentifier/walkingspeed, /healthkit/hkquantitytypeidentifier/applewalkingsteadiness, /healthkit/hkquantitytypeidentifier/sixminutewalktestdistance, /healthkit/hkapplewalkingsteadinessclassification

**Skills**: axiom-health, axiom-security
