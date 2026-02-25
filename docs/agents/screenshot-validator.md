# screenshot-validator

AI-powered visual inspection of App Store screenshots for compliance, quality, and content issues before submission.

## How to Use This Agent

**Natural language (automatic triggering):**
- "Can you check my App Store screenshots for issues?"
- "Validate my screenshots before I submit to the App Store"
- "Are my screenshots the right dimensions?"
- "Check my marketing screenshots for problems"
- "Review screenshots in ~/Desktop/AppScreenshots"

**Explicit command:**
```bash
/axiom:audit screenshots
```

## What It Does

### Visual Content Analysis
1. **Dimension validation** — Checks every screenshot against required App Store device sizes (exact pixel match required)
2. **Placeholder detection** — Finds "Lorem ipsum", "TODO", "Sample", test data, and example emails
3. **Debug artifact scanning** — Catches "STAGING" banners, FPS overlays, console output, Xcode debug indicators
4. **Competitor reference check** — Flags other app names, brand logos, trademarked terms (Guidelines 2.3.1)
5. **UI completeness** — Detects loading spinners, broken images, truncated text, empty states
6. **Consistency review** — Checks for mixed themes, inconsistent device frames, orientation mismatches

### Device Coverage Tracking

Validates screenshots against all required App Store sizes:
- iPhone 6.9" (16 Pro Max) — 1320 × 2868
- iPhone 6.7" (15 Plus/Pro Max) — 1290 × 2796
- iPhone 6.5" (11 Pro Max/Xs Max) — 1242 × 2688
- iPhone 5.5" (8 Plus) — 1242 × 2208
- iPad 13" (Pro M4) — 2064 × 2752
- iPad 12.9" (Pro 6th gen) — 2048 × 2732

## How It Works

**Core Principle**: Uses Claude's multimodal vision to visually inspect each screenshot one at a time, catching issues that manual review misses.

**Workflow**:
1. Get screenshot folder path from user
2. Discover all PNG/JPG images via Glob
3. Batch dimension check via `sips`
4. Visual analysis of each screenshot (Read tool)
5. Generate report with severity ratings and device coverage

**False-positive aware**: Marketing text overlays, "9:41" status bar time, intentional blur effects, and stylized compositions are correctly identified as non-issues.

## Common Scenarios

| Scenario | What It Catches |
|----------|----------------|
| Pre-submission review | Placeholder text, wrong dimensions, debug artifacts |
| Rejection follow-up | Identifies which screenshot triggered Guideline 2.3 rejection |
| Localization check | Untranslated text, inconsistent content across locales |
| Device size audit | Missing required sizes, dimension mismatches |

## Requirements

- Screenshots as local PNG/JPG files in a folder
- No App Store Connect API access needed — works entirely on local files

## Related Tools

- **`axiom-app-store-submission` skill** — Pre-flight checklist for the full submission workflow
- **`axiom-app-store-ref` skill** — Metadata specs, guideline details, screenshot requirements
- **`security-privacy-scanner` agent** — Code-level security and privacy compliance scanning
- **`simulator-tester` agent** — Capture screenshots from the iOS Simulator
