---
name: axiom-testflight-triage
description: Use when ANY beta tester reports a crash, ANY crash appears in Organizer or App Store Connect, crash logs need symbolication, app was killed without crash report, or you need to triage TestFlight feedback
user-invocable: true
skill_type: discipline
version: 1.0.0
mcp:
  category: debugging
  tags: [testflight, crash, organizer, symbolication, feedback, triage]
  related: [axiom-memory-debugging, axiom-xcode-debugging, axiom-swift-concurrency]
---

# TestFlight Crash & Feedback Triage

## Overview

Systematic workflow for investigating TestFlight crashes and reviewing beta feedback using Xcode Organizer. **Core principle:** Understand the crash before writing any fix — 15 minutes of triage prevents hours of debugging.

## Red Flags — Use This Skill When

- "A beta tester said my app crashed"
- "I see crashes in App Store Connect metrics but don't know how to investigate"
- "Crash logs in Organizer aren't symbolicated"
- "User sent a screenshot of a crash but I can't reproduce it"
- "App was killed but there's no crash — just disappeared"
- "TestFlight feedback has screenshots I need to review"

---

## Decision Tree — Start Here

### "A user reported a crash"

1. **Open Xcode Organizer** (Window → Organizer → Crashes tab)
2. **Select your app** from the left sidebar
3. **Find the build version** the user was running
4. **Is the crash symbolicated?**
   - YES (you see function names) → Go to [Reading the Crash Report](#reading-the-crash-report)
   - NO (you see hex addresses like `0x100abc123`) → Go to [Symbolication Workflow](#symbolication-workflow)
5. **Can you identify the crash location?**
   - YES → Go to [Common Crash Patterns](#common-crash-patterns)
   - NO → Go to [Claude-Assisted Interpretation](#claude-assisted-interpretation)

### "App was killed but no crash report"

Not all terminations produce crash reports. Check for:

1. **Jetsam reports** — System killed app due to memory pressure
   - Organizer shows these separately from crashes
   - Look for high `pageOuts` value
2. **Watchdog termination** — Main thread blocked too long
   - Exception code `0x8badf00d` ("ate bad food")
   - Happens during launch (>20s) or background tasks (>10s)
3. **MetricKit diagnostics** — On-device termination reasons
   - Requires MetricKit integration in your app

→ See [Terminations Without Crash Reports](#terminations-without-crash-reports)

### "I want to review TestFlight feedback"

1. **Xcode Organizer** → Feedback tab (next to Crashes)
2. **Or** App Store Connect → My Apps → [App] → TestFlight → Feedback

→ See [Feedback Triage Workflow](#feedback-triage-workflow)

---

## Xcode Organizer Walkthrough

### Opening the Organizer

**Window → Organizer** (or ⌘⇧O from Xcode)

### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [Toolbar: Time Period ▼] [Version ▼] [Product ▼] [Release ▼]   │
├──────────┬──────────────────────────┬───────────────────────────┤
│ Sidebar  │     Crashes List         │       Inspector           │
│          │                          │                           │
│ • Crashes│  ┌─────────────────────┐ │  Distribution Graph       │
│ • Energy │  │ syncFavorites crash │ │  ┌─────────────────────┐  │
│ • Hang   │  │ 21 devices • 7 today│ │  │ ▄ ▄▄▄ v2.0          │  │
│ • Disk   │  └─────────────────────┘ │  │ ▄▄▄▄▄ v2.0.1        │  │
│ Feedback │  ┌─────────────────────┐ │  └─────────────────────┘  │
│          │  │ Another crash...    │ │                           │
│          │  └─────────────────────┘ │  Device Distribution      │
│          │                          │  OS Distribution          │
│          ├──────────────────────────┤                           │
│          │     Log View             │  [Feedback Inspector]     │
│          │  (simplified crash view) │  Shows tester feedback    │
│          │                          │  for selected crash       │
└──────────┴──────────────────────────┴───────────────────────────┘
```

### Key Features

| Feature | What It Does |
|---------|--------------|
| **Speedy Delivery** | TestFlight crashes delivered moments after occurrence (not daily) |
| **Year of History** | Filter crashes by time period, see monthly trends |
| **Product Filter** | Filter by App Clip, watch app, extensions, or main app |
| **Version Filter** | Drill down to specific builds |
| **Release Filter** | Separate TestFlight vs App Store crashes |
| **Share Button** | Share crash link with team members |
| **Feedback Inspector** | See tester comments for selected crash |

### Crash Entry Badges

Crashes in the list show badges indicating origin:

| Badge | Meaning |
|-------|---------|
| App Clip | Crash from your App Clip |
| Watch | Crash from watchOS companion |
| Extension | Crash from share extension, widget, etc. |
| (none) | Main iOS app |

### The Triage Questions Workflow

Before diving into code, ask yourself these questions (from WWDC):

#### Question 1 — How Long Has This Been an Issue

→ Check the **inspector's graph area** on the right
→ Graph legend shows which versions are affected
→ Look for when the crash first appeared

#### Question 2 — Is This Affecting Production or Just TestFlight

→ Use the **Release filter** in toolbar
→ Select "Release" to see App Store crashes only
→ Select "TestFlight" for beta crashes only

#### Question 3 — What Was the User Doing

→ Open the **Feedback Inspector** (right panel)
→ Check for tester comments describing their actions
→ Context clues: network state, battery level, disk space

### Using the Feedback Inspector

When a crash has associated TestFlight feedback, you'll see a feedback icon in the crashes list. Click it to open the Feedback Inspector.

**Each feedback entry shows:**

| Field | Why It Matters |
|-------|----------------|
| Version/Build | Confirms exact build tester was running |
| Device model | Device-specific crashes (older devices, specific screen sizes) |
| Battery level | Low battery can affect app behavior |
| Available disk | Low disk can cause write failures |
| Network type | Cellular vs WiFi, connectivity issues |
| Tester comment | Their description of what happened |

**Example insight from WWDC:** A tester commented "I was going through a tunnel and hit the favorite button. A few seconds later, it crashed." This revealed a network timeout issue — the crash occurred because a 10-second timeout was too short for poor network conditions.

### Opening Crash in Project

1. Select a crash in the list
2. Click **Open in Project** button
3. Xcode opens with:
   - Debug Navigator showing backtrace
   - Editor highlighting the exact crash line

### Sharing Crashes

1. Select a crash
2. Click **Share** button in toolbar
3. Options:
   - Copy link to share with team
   - Add to your to-do list
4. When teammate clicks link, Organizer opens focused on that specific crash

---

## Symbolication Workflow

### Why Crashes Aren't Symbolicated

Crash reports show raw memory addresses until matched with **dSYM files** (debug symbol files). Xcode handles this automatically when:

- You archived the build in Xcode (not command-line only)
- "Upload symbols to Apple" was enabled during distribution
- The dSYM is indexed by Spotlight

### Quick Check: Is It Symbolicated?

In Organizer, look at the stack trace:

| What You See | Status |
|--------------|--------|
| `0x0000000100abc123` | Unsymbolicated — needs dSYM |
| `MyApp.ViewController.viewDidLoad() + 45` | Symbolicated — ready to analyze |
| System frames symbolicated, app frames not | Partially symbolicated — missing your dSYM |

### Manual Symbolication

If automatic symbolication failed:

```bash
# 1. Find the crash's build UUID (shown in crash report header)
#    Look for "Binary Images" section, find your app's UUID

# 2. Find matching dSYM
mdfind "com_apple_xcode_dsym_uuids == YOUR-UUID-HERE"

# 3. If not found, check Archives
ls ~/Library/Developer/Xcode/Archives/

# 4. Symbolicate a specific address
xcrun atos -arch arm64 \
  -o MyApp.app.dSYM/Contents/Resources/DWARF/MyApp \
  -l 0x100000000 \
  0x0000000100abc123
```

### Common Symbolication Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| System frames OK, app frames hex | Missing dSYM for your app | Find dSYM in Archives folder, or re-archive with symbols |
| Nothing symbolicated | UUID mismatch between crash and dSYM | Verify UUIDs match; rebuild exact same commit |
| "No such file" from atos | dSYM not in Spotlight index | Run `mdimport /path/to/MyApp.dSYM` |
| Can't find dSYM anywhere | Archived without symbols | Enable "Debug Information Format = DWARF with dSYM" in build settings |

### Preventing Symbolication Issues

```bash
# Verify dSYM exists after archive
ls ~/Library/Developer/Xcode/Archives/YYYY-MM-DD/MyApp*.xcarchive/dSYMs/

# Verify UUID matches
dwarfdump --uuid MyApp.app.dSYM
```

---

## Reading the Crash Report

### Key Fields (What Actually Matters)

| Field | What It Tells You |
|-------|-------------------|
| **Exception Type** | Category of crash (EXC_BAD_ACCESS, EXC_CRASH, etc.) |
| **Exception Codes** | Specific error (KERN_INVALID_ADDRESS = null pointer) |
| **Termination Reason** | Why the system killed the process |
| **Crashed Thread** | Which thread died (Thread 0 = main thread) |
| **Application Specific Information** | Often contains the actual error message |
| **Binary Images** | Loaded frameworks (helps identify third-party culprits) |

### Reading the Stack Trace

The crashed thread's stack trace reads **top to bottom**:

- **Frame 0** = Where the crash occurred (most specific)
- **Lower frames** = What called it (call chain)
- **Look for your code** = Frames with your app/framework name

```
Thread 0 Crashed:
0   libsystem_kernel.dylib    __pthread_kill + 8        ← System code
1   libsystem_pthread.dylib   pthread_kill + 288        ← System code
2   libsystem_c.dylib         abort + 128               ← System code
3   MyApp                     ViewController.loadData() ← YOUR CODE (start here)
4   MyApp                     ViewController.viewDidLoad()
5   UIKitCore                 -[UIViewController _loadView]
```

**Start at frame 3** — the first frame in your code. Work down to understand the call chain.

### Example: Interpreting a Real Crash

```
Exception Type:  EXC_BAD_ACCESS (SIGSEGV)
Exception Codes: KERN_INVALID_ADDRESS at 0x0000000000000010

Thread 0 Crashed:
0   MyApp    0x100abc123 UserManager.currentUser.getter + 45
1   MyApp    0x100abc456 ProfileViewController.viewDidLoad() + 123
2   UIKitCore 0x1a2b3c4d5 -[UIViewController loadView] + 89
```

**Translation:**

- `EXC_BAD_ACCESS` with `KERN_INVALID_ADDRESS` = Tried to access invalid memory
- Address `0x10` = Very low address, almost certainly nil dereference
- Crashed in `currentUser.getter` = Accessing a property that was nil
- Called from `ProfileViewController.viewDidLoad()` = During view setup

**Likely cause:** Force-unwrapping an optional that was nil, or accessing a deallocated object.

---

## Common Crash Patterns

### EXC_BAD_ACCESS (SIGSEGV / SIGBUS)

**What it means:** Accessed memory that doesn't belong to you.

**Common causes in Swift:**

| Pattern | Example | Fix |
|---------|---------|-----|
| Force-unwrap nil | `user!.name` | Use `guard let` or `if let` |
| Deallocated object | Accessing `self` in escaped closure after dealloc | Use `[weak self]` |
| Array out of bounds | `array[index]` where index >= count | Check bounds first |
| Uninitialized pointer | C interop with bad pointer | Validate pointer before use |

```swift
// Before (crashes if user is nil)
let name = user!.name

// After (safe)
guard let user = user else {
    logger.warning("User was nil in ProfileViewController")
    return
}
let name = user.name
```

### EXC_CRASH (SIGABRT)

**What it means:** App deliberately terminated itself.

**Common causes:**

| Pattern | Clue in Crash Report |
|---------|---------------------|
| `fatalError()` / `preconditionFailure()` | Your assertion message in Application Specific Info |
| Uncaught Objective-C exception | `NSException` type and reason in report |
| Swift runtime error | "Fatal error: ..." message |
| Deadlock detected | `dispatch_sync` onto current queue |

**Debug tip:** Look at "Application Specific Information" section — it usually contains the actual error message.

### Watchdog Termination (0x8badf00d)

**What it means:** Main thread was blocked too long and the system killed your app.

**Time limits:**

| Context | Limit |
|---------|-------|
| App launch | ~20 seconds |
| Background task | ~10 seconds |
| App going to background | ~5 seconds |

**Common causes:**

- Synchronous network request on main thread
- Synchronous file I/O on main thread
- Deadlock between queues
- Expensive computation blocking UI

```swift
// Before (blocks main thread — will trigger watchdog)
let data = try Data(contentsOf: largeFileURL)
processData(data)

// After (offload to background)
Task.detached {
    let data = try Data(contentsOf: largeFileURL)
    await MainActor.run {
        self.processData(data)
    }
}
```

### Jetsam (Memory Pressure Kill)

**What it means:** System terminated your app to free memory. No crash report — just gone.

**Symptoms:**

- App "disappears" without any crash
- Jetsam report in Organizer (separate from crashes)
- High `pageOuts` value in report
- Often happens during photo/video processing or large data operations

**Investigation:**

1. Profile with Instruments → Allocations
2. Look for memory spikes during the reported operation
3. Check for image caching without size limits
4. Look for large data structures kept in memory

**Common fixes:**

- Use `autoreleasepool` for batch processing
- Implement image cache with memory limits
- Stream large files instead of loading entirely
- Release references to large objects when backgrounded

---

## Terminations Without Crash Reports

When users report "the app just closed" but you find no crash:

### The Terminations Organizer

The **Terminations Organizer** (separate from Crashes) shows trends of app terminations that aren't programming crashes:

**Window → Organizer → Terminations** (in sidebar)

| Termination Category | What It Means |
|---------------------|---------------|
| Launch timeout | App took too long to launch |
| Memory limit | Hit system memory ceiling |
| CPU limit (background) | Too much CPU while backgrounded |
| Background task timeout | Background task exceeded time limit |

**Key insight:** Compare termination rates against previous versions to find regressions. A spike in memory terminations after a release indicates a memory leak or increased footprint.

### Check for Jetsam

1. Organizer → Select app → Look for "Disk Write Diagnostics" or "Hang Diagnostics"
2. These aren't crashes but system-initiated terminations

### Check for Background Termination

Apps can be terminated in background for:

- **Memory pressure** (jetsam)
- **CPU usage** while backgrounded
- **Background task timeout**

### Ask the User

If no reports exist:

1. "Was the app in the foreground when it closed?"
2. "Did you see any error message?"
3. "What were you doing right before it happened?"
4. "How long had the app been open?"

### Enable Better Diagnostics with MetricKit

MetricKit crash diagnostics are now delivered **on the next app launch** (not aggregated daily). This gives you faster access to crash data.

```swift
import MetricKit

class MetricsManager: NSObject, MXMetricManagerSubscriber {

    static let shared = MetricsManager()

    func startListening() {
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        // Process performance metrics
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            // Crash diagnostics — delivered on next launch
            if let crashDiagnostics = payload.crashDiagnostics {
                for crash in crashDiagnostics {
                    // Process crash diagnostic
                    print("Crash: \(crash.callStackTree)")
                }
            }

            // Hang diagnostics
            if let hangDiagnostics = payload.hangDiagnostics {
                for hang in hangDiagnostics {
                    print("Hang duration: \(hang.hangDuration)")
                }
            }
        }
    }
}
```

**When to use MetricKit vs Organizer:**

| Use Case | Tool |
|----------|------|
| Quick triage of TestFlight crashes | Organizer (faster, visual) |
| Programmatic crash analysis | MetricKit |
| Custom crash reporting integration | MetricKit |
| Termination trends across versions | Terminations Organizer |

---

## Claude-Assisted Interpretation

### Using the Crash Analyzer Agent

For **automated crash analysis**, use the **crash-analyzer** agent:

```
/axiom:analyze-crash
```

Or trigger naturally:
- "Analyze this crash log"
- "Parse this .ips file: ~/Library/Logs/DiagnosticReports/MyApp.ips"
- "Why did my app crash? Here's the report..."

The agent will:
1. Parse the crash report (JSON .ips or text .crash format)
2. Check symbolication status
3. Categorize by crash pattern (null pointer, Swift runtime, watchdog, jetsam, etc.)
4. Generate actionable analysis with specific next steps

### Effective Prompts

**Basic interpretation:**

```
Here's a crash report from my iOS app. Help me understand:
1. What type of crash is this?
2. Where in my code did it crash?
3. What's the likely cause?

[paste full crash report]
```

**With context (better results):**

```
My TestFlight app crashed. Here's what I know:

- User was [describe action, e.g., "tapping the save button"]
- iOS version: [from crash report]
- Device: [from crash report]

Crash report:
[paste full crash report]

The relevant code is in [file/class name]. Help me understand the cause.
```

### What to Include

| Include | Why |
|---------|-----|
| Full crash report | Partial reports lose context |
| What user was doing | Helps narrow down code paths |
| Relevant code snippets | If you know the crash area |
| iOS version and device | Some crashes are device/OS specific |

### What Claude Can Help With

- Interpreting exception types and codes
- Identifying likely cause from stack trace
- Explaining unfamiliar system frames
- Suggesting where to add logging
- Proposing fix patterns

### What Requires Your Judgment

- Whether the suggested fix is correct for your architecture
- How to reproduce the crash locally
- Priority relative to other bugs
- Whether it's a regression or long-standing issue

---

## Feedback Triage Workflow

### Where to Find Feedback

**Xcode Organizer (recommended):**
Window → Organizer → Select app → Feedback tab

**App Store Connect:**
My Apps → [App] → TestFlight → Feedback

### What's in Each Feedback Entry

| Component | Description |
|-----------|-------------|
| Screenshot | What the user saw (often the most valuable part) |
| Text comment | User's description of the issue |
| Device/OS | iPhone model and iOS version |
| App version | Which TestFlight build |
| Timestamp | When submitted |

### Triage Workflow

1. **Sort by recency** — Newest first, unless investigating specific issue
2. **Scan screenshots** — Visual issues are immediately apparent
3. **Read comments** — User's description and context
4. **Check version** — Is this fixed in a newer build?
5. **Categorize:**

| Category | Action |
|----------|--------|
| 🐛 **Bug** | Investigate, file issue, prioritize fix |
| 💡 **Feature request** | Add to backlog if valuable |
| ❓ **Unclear** | Can't act without more context |
| ✅ **Working as intended** | May indicate UX confusion |

### Limitations

- **No direct reply** — TestFlight doesn't support responding to feedback
- **Screenshots only** — No video recordings
- **Limited context** — Users often don't explain what they were trying to do

### Getting More Context

If feedback is unclear and the tester is reachable:

- Contact through TestFlight group email
- Add in-app feedback mechanism with more detail capture
- Include reproduction steps prompt in your TestFlight notes

---

## Pressure Scenarios

### Scenario 1: "VIP user says app crashes constantly, but I can't find any crash reports"

**Pressure:** Important stakeholder, no evidence, tempted to dismiss with "works for me"

**Correct approach:**

1. Verify they're on TestFlight (not App Store, not dev build)
2. Confirm they've consented to share diagnostics (Settings → Privacy → Analytics)
3. Check for jetsam reports (kills without crash reports)
4. Check crash reports for their specific device/OS combination
5. Ask for specific reproduction steps
6. If still nothing: request screen recording of the issue

**Response template:**
> "I've checked our crash reports and don't see crashes matching your description yet. To help investigate: (1) Could you confirm you're running the TestFlight version? (2) What exactly happens — does the app close suddenly, freeze, or show an error? (3) What were you doing right before? This will help me find the issue."

**Why this matters:** "Works for me" destroys trust. Investigate thoroughly before dismissing.

### Scenario 2: "Crash rate spiked after latest TestFlight build, need to fix ASAP"

**Pressure:** Time pressure, tempted to guess at fix based on code changes

**Correct approach:**

1. Open Organizer → Crashes → Filter to the new build
2. Group crashes by exception type (look for the dominant signature)
3. Identify the #1 crash by frequency
4. Symbolicate and read the crash report fully
5. Understand the cause before writing any fix
6. If possible, reproduce locally
7. Fix the verified cause, not a guess

**Why this matters:** Rushed guesses often introduce new bugs or miss the real issue. 15 minutes of proper triage prevents hours of misdirected debugging.

### Scenario 3: "Crash report is symbolicated but I still don't understand it"

**Pressure:** Tempted to ignore it or make random changes hoping it helps

**Correct approach:**

1. Paste full crash report into Claude with context
2. Ask for interpretation, not just "fix this"
3. Research exception type if unfamiliar
4. If still unclear after research, add logging around the crash site:

```swift
func suspectFunction() {
    logger.debug("Entering suspectFunction, state: \(debugDescription)")
    defer { logger.debug("Exiting suspectFunction") }

    // ... existing code ...
}
```

5. Ship instrumented build to TestFlight
6. Wait for reproduction with better context

**Why this matters:** Understanding beats guessing. Logging beats speculation. It's okay to say "I need more information" rather than shipping a random change.

---

## Quick Reference

### Organizer Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Organizer | ⌘⇧O (from Xcode) |
| Refresh | ⌘R |

### Common Exception Codes

| Code | Meaning |
|------|---------|
| `KERN_INVALID_ADDRESS` | Null pointer / bad memory access |
| `KERN_PROTECTION_FAILURE` | Memory protection violation |
| `0x8badf00d` | Watchdog timeout (main thread blocked) |
| `0xdead10cc` | Deadlock detected |
| `0xc00010ff` | Thermal event (device too hot) |

### Crash Report Sections

| Section | Contains |
|---------|----------|
| Header | App info, device, OS, date |
| Exception Information | Crash type and codes |
| Termination Reason | Why system killed the process |
| Triggered by Thread | Which thread crashed |
| Application Specific | Error messages, assertions |
| Thread Backtraces | Stack traces for all threads |
| Binary Images | Loaded frameworks and addresses |

---

## Resources

**WWDC:** 2018-414, 2020-10076, 2020-10078, 2020-10081, 2021-10203, 2021-10258

**Docs:** /xcode/diagnosing-issues-using-crash-reports-and-device-logs, /xcode/examining-the-fields-in-a-crash-report, /xcode/adding-identifiable-symbol-names-to-a-crash-report, /xcode/identifying-the-cause-of-common-crashes, /xcode/identifying-high-memory-use-with-jetsam-event-reports

**Skills:** axiom-memory-debugging, axiom-xcode-debugging, axiom-swift-concurrency

**Agents:** crash-analyzer (automated crash log parsing and analysis)
