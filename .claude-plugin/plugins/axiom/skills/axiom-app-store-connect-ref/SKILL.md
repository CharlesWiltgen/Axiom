---
name: axiom-app-store-connect-ref
description: Reference for App Store Connect crash analysis, TestFlight feedback, metrics dashboards, and data export workflows
license: MIT
metadata:
  version: "1.0.0"
---

# App Store Connect Reference

## Overview

App Store Connect (ASC) provides crash reports, TestFlight feedback, and performance metrics for your apps. This reference covers how to navigate ASC to find and export crash data for analysis.

**When to use ASC vs Xcode Organizer:**

| Task | Best Tool |
|------|-----------|
| Quick crash triage during development | Xcode Organizer |
| Team-wide crash visibility | App Store Connect |
| TestFlight feedback with screenshots | App Store Connect |
| Historical metrics and trends | App Store Connect |
| Downloading crash logs for analysis | Either (ASC has better export) |
| Symbolication | Xcode Organizer |

---

## Navigating to Crash Data

### Path to Crashes

```
App Store Connect
└── My Apps
    └── [Your App]
        └── Analytics
            └── Crashes
```

**Direct URL pattern:** `https://appstoreconnect.apple.com/analytics/app/[APP_ID]/crashes`

### Crashes Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Filters: Platform ▼] [Version ▼] [Date Range ▼] [Compare ▼]           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Crash-Free Users Graph                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  99.5% ─────────────────────────────────────────────────────    │   │
│  │  99.0% ─────────────────────────────────────────────────────    │   │
│  │  98.5% ─────────────────────────────────────────────────────    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Crash Count by Version                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ v2.1.0  ████████████ 1,234 crashes                                │ │
│  │ v2.0.5  ████████ 892 crashes                                      │ │
│  │ v2.0.4  ███ 156 crashes                                           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Top Crash Signatures                                                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 1. EXC_BAD_ACCESS in UserManager.currentUser.getter    45% share  │ │
│  │ 2. EXC_CRASH in NetworkService.fetchData()             23% share  │ │
│  │ 3. EXC_BREAKPOINT in Array subscript                   12% share  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Metrics Explained

| Metric | What It Means |
|--------|---------------|
| **Crash-Free Users** | Percentage of daily active users who didn't experience a crash |
| **Crash Count** | Total number of crash reports received |
| **Crash Rate** | Crashes per 1,000 sessions |
| **Affected Devices** | Number of unique devices that crashed |
| **Crash Signature** | Grouped crashes with same stack trace |

### Filtering Options

| Filter | Use Case |
|--------|----------|
| **Platform** | iOS, iPadOS, macOS, watchOS, tvOS |
| **Version** | Drill into specific app versions |
| **Date Range** | Last 7/30/90 days or custom range |
| **Compare** | Compare crash rates between versions |
| **Device** | Filter by iPhone model, iPad, etc. |
| **OS Version** | Find OS-specific crashes |

---

## Viewing Individual Crash Reports

### Crash Signature Detail View

Click a crash signature to see:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ EXC_BAD_ACCESS in UserManager.currentUser.getter                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Affected: 234 devices • 45% of crashes • First seen: Jan 10            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Exception Information                                                   │
│ ───────────────────                                                     │
│ Type: EXC_BAD_ACCESS (SIGSEGV)                                         │
│ Codes: KERN_INVALID_ADDRESS at 0x0000000000000010                       │
│                                                                         │
│ Crashed Thread (0)                                                      │
│ ─────────────────                                                       │
│ 0  MyApp         UserManager.currentUser.getter + 45                    │
│ 1  MyApp         ProfileViewController.viewDidLoad() + 123              │
│ 2  UIKitCore     -[UIViewController loadView] + 89                      │
│ 3  UIKitCore     -[UIViewController view] + 27                          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Distribution                                                            │
│ ───────────────                                                         │
│ iOS 17.2: ████████ 65%                                                  │
│ iOS 17.1: ████ 25%                                                      │
│ iOS 16.4: ██ 10%                                                        │
│                                                                         │
│ iPhone 15 Pro: ████████ 45%                                             │
│ iPhone 14:     ████ 30%                                                 │
│ iPhone 13:     ██ 15%                                                   │
│ Other:         █ 10%                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Downloading Crash Logs

1. Click on a crash signature
2. Look for **Download Logs** button (top right)
3. Select format:
   - **.ips** (JSON format, iOS 15+)
   - **.crash** (text format, legacy)
4. Use `crash-analyzer` agent to parse: `/axiom:analyze-crash`

---

## TestFlight Feedback

### Path to Feedback

```
App Store Connect
└── My Apps
    └── [Your App]
        └── TestFlight
            └── Feedback
```

### Feedback Entry Contents

Each feedback submission includes:

| Field | Description |
|-------|-------------|
| **Screenshot** | What the tester saw (often most valuable) |
| **Comment** | Tester's description of the issue |
| **App Version** | Exact TestFlight build number |
| **Device Model** | iPhone 15 Pro Max, iPad Air, etc. |
| **OS Version** | iOS 17.2.1, etc. |
| **Battery Level** | Low battery can affect behavior |
| **Available Disk** | Low disk can cause write failures |
| **Network Type** | WiFi vs Cellular |
| **Locale** | Language and region settings |
| **Timestamp** | When submitted |

### Feedback Filtering

| Filter | Use Case |
|--------|----------|
| **Build** | Focus on specific TestFlight builds |
| **Date** | Recent feedback first |
| **Has Screenshot** | Find visual issues quickly |

### Limitation: No Reply

TestFlight feedback is **one-way**. You cannot respond to testers through ASC. For follow-up:

- Contact through TestFlight group email
- Add in-app feedback mechanism
- Include your email in TestFlight notes

---

## Metrics Dashboard

### Path to Metrics

```
App Store Connect
└── My Apps
    └── [Your App]
        └── Analytics
            └── Metrics
```

### Available Metrics Categories

| Category | What It Shows |
|----------|---------------|
| **Crashes** | Crash-free users, crash count, top signatures |
| **Hang Rate** | Main thread hangs > 250ms |
| **Disk Writes** | Excessive disk I/O patterns |
| **Launch Time** | App startup performance |
| **Memory** | Peak memory usage, terminations |
| **Battery** | Energy usage during foreground/background |
| **Scrolling** | Scroll hitch rate |

### Terminations (Non-Crash Kills)

The Metrics dashboard shows terminations that don't produce crash reports:

| Termination Type | Cause |
|------------------|-------|
| **Memory Limit** | Jetsam killed app for memory pressure |
| **CPU Limit (Background)** | Exceeded background CPU quota |
| **Launch Timeout** | App took too long to launch |
| **Background Task Timeout** | Background task exceeded time limit |

### Comparing Versions

Use the **Compare** filter to see:

- Did crash rate improve or regress?
- Which version introduced a spike?
- Performance trends over releases

---

## Exporting Data

### Manual Export

1. Navigate to Crashes or Metrics
2. Use date range filter to select period
3. Click **Export** (if available) or download individual crash logs

### App Store Connect API

For automated export, use the [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi):

```bash
# Get crash diagnostic insights
GET /v1/apps/{id}/perfPowerMetrics

# Authentication requires API key from ASC
# Users and Access → Keys → App Store Connect API
```

**API capabilities:**

| Endpoint | Data |
|----------|------|
| `perfPowerMetrics` | Performance and power metrics |
| `diagnosticSignatures` | Crash signature aggregates |
| `diagnosticLogs` | Individual crash logs |
| `betaTesters` | TestFlight tester info |
| `betaFeedback` | TestFlight feedback entries |

### MCP-Powered Access

If **asc-mcp** is configured, you can access ASC data programmatically from Claude Code:

| Manual ASC Action | asc-mcp Tool |
|-------------------|-------------|
| View crash metrics | `metrics_app_perf`, `metrics_build_diagnostics` |
| Download crash logs | `metrics_get_diagnostic_logs` |
| List TestFlight testers | `builds_get_beta_testers` |
| View app reviews | `reviews_list`, `reviews_stats` |
| Respond to reviews | `reviews_create_response` |
| Check build status | `builds_get_processing_state` |
| Export sales data | `analytics_sales_report` (requires vendor_number) |

**Setup and workflows**: `/skill axiom-asc-mcp`

### Xcode Cloud Integration

If using Xcode Cloud, crash data integrates with CI/CD:

- View crashes per workflow run
- Compare crash rates between branches
- Automated alerts on crash spikes

---

## Best Practices

### Daily Monitoring

1. Check crash-free users percentage
2. Review any new crash signatures
3. Monitor for version-to-version regressions

### Crash Triage Priority

| Priority | Criteria |
|----------|----------|
| **P0 - Critical** | >1% of users affected, data loss risk |
| **P1 - High** | >0.5% affected, user-facing impact |
| **P2 - Medium** | <0.5% affected, workaround exists |
| **P3 - Low** | Rare, edge case, no impact |

### Correlating with Releases

After each release:

1. Wait 24-48 hours for crash data to populate
2. Compare crash-free rate to previous version
3. Investigate any new top crash signatures
4. Check TestFlight feedback for user reports

---

## Common Questions

### Why don't I see crashes in ASC?

| Cause | Fix |
|-------|-----|
| Too recent | Wait 24 hours for processing |
| No users yet | Need active installs to report |
| User opted out | Requires device analytics sharing |
| Build not distributed | Must be TestFlight or App Store |

### Why are crashes unsymbolicated?

ASC crashes should auto-symbolicate if you uploaded dSYMs during distribution. **dSYM files** contain the debug symbols that map memory addresses back to function names and line numbers.

**Verify dSYMs were uploaded:**
1. Xcode → Window → Organizer → Archives → select build
2. Right-click → "Show in Finder" → right-click `.xcarchive` → "Show Package Contents"
3. Check `dSYMs/` folder contains `.dSYM` bundles

**Manual symbolication workflow:**
```bash
# 1. Download .ips file from ASC (Crashes → signature → Download Logs)

# 2. Find the binary UUID from the crash report
grep --after-context=2 "Binary Images" crash.ips
# Look for: 0x100000000 - 0x100ffffff MyApp arm64 <UUID>

# 3. Locate matching dSYM on your machine
mdfind "com_apple_xcode_dsym_uuids == <UUID>"

# 4. Symbolicate an address
atos -arch arm64 -o MyApp.app.dSYM/Contents/Resources/DWARF/MyApp \
     -l 0x100000000 0x100045abc
# Output: -[UserManager currentUser] (UserManager.m:42)
```

**Common symbolication failures:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| All addresses unsymbolicated | dSYMs not uploaded | Re-upload from Xcode Organizer |
| Only your code unsymbolicated | dSYM UUID mismatch | Rebuild from same commit |
| System frameworks unsymbolicated | Normal for device-specific | Use `atos` with device support files |
| Bitcode builds unsymbolicated | Apple recompiled binary | Download dSYMs from ASC: Xcode → Organizer → Download Debug Symbols |

See `crash-analyzer` agent for automated parsing: `/axiom:analyze-crash`

### ASC vs Organizer: Which stack trace is better?

Both show the same data, but:
- **Organizer** integrates with Xcode projects (click to jump to code)
- **ASC** better for team-wide visibility and historical trends

---

## Field Diagnostics with MetricKit

ASC dashboards show aggregated data. For granular, device-level diagnostics, use **MetricKit** to collect crash reports and performance data programmatically.

### Setup

```swift
import MetricKit

class MetricsManager: NSObject, MXMetricManagerSubscriber {
    static let shared = MetricsManager()

    func start() {
        MXMetricManager.shared.add(self)
    }

    // Called ~once per day with accumulated metrics
    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            // Performance metrics
            if let launchTime = payload.applicationLaunchMetrics {
                print("Median launch: \(launchTime.histogrammedTimeToFirstDraw)")
            }
            if let hangRate = payload.applicationResponsivenessMetrics {
                print("Hang rate: \(hangRate.histogrammedApplicationHangTime)")
            }
        }
    }

    // Crash and hang diagnostics (iOS 14+)
    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            // Crash diagnostics with full stack traces
            if let crashes = payload.crashDiagnostics {
                for crash in crashes {
                    print("Crash: \(crash.callStackTree)")
                    print("Signal: \(crash.signal)")
                    print("Exception: \(crash.exceptionType)")
                }
            }
            // Hang diagnostics (iOS 16+)
            if let hangs = payload.hangDiagnostics {
                for hang in hangs {
                    print("Hang: \(hang.hangDuration) — \(hang.callStackTree)")
                }
            }
        }
    }
}
```

### What MetricKit Provides Beyond ASC

| Data | ASC Dashboard | MetricKit |
|------|--------------|-----------|
| Crash stack traces | Aggregated signatures | Per-device, full call stacks |
| Hang diagnostics | Hang rate percentage | Individual hang call stacks with duration |
| CPU/memory metrics | Aggregated histograms | Per-device histograms |
| Disk write exceptions | Total write count | Individual write spike call stacks |
| Custom data correlation | No | Combine with your own telemetry |
| Delivery timing | 24-48 hour delay | ~once daily on device |

### When to Use MetricKit vs ASC

- **ASC**: Team visibility, historical trends, version comparison, triage
- **MetricKit**: Device-specific debugging, correlating crashes with app state, custom dashboards, field diagnostics for non-reproducible issues

---

## Related

**Skills**: axiom-testflight-triage (Xcode Organizer workflows), axiom-asc-mcp (programmatic ASC access via MCP)

**Agents**: crash-analyzer (automated crash log parsing)

**Commands**: `/axiom:analyze-crash`

---

## Resources

**WWDC:** 2020-10076, 2020-10078, 2021-10203, 2021-10258

**Docs:** /app-store-connect/api, /xcode/diagnosing-issues-using-crash-reports-and-device-logs
