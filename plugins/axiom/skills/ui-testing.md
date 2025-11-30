---
name: ui-testing
description: Use when writing UI tests, recording interactions, tests have race conditions, timing dependencies, inconsistent pass/fail behavior, or XCTest UI tests are flaky - covers Recording UI Automation (WWDC 2025), condition-based waiting, and accessibility-first testing patterns
version: 2.0.0
last_updated: WWDC 2025
---

# UI Testing

## Overview

Wait for conditions, not arbitrary timeouts. **Core principle:** Flaky tests come from guessing how long operations take. Condition-based waiting eliminates race conditions.

**NEW in WWDC 2025**: Recording UI Automation allows you to record interactions, replay across devices/languages, and review video recordings of test runs.

## Red Flags - Test Reliability Issues

If you see ANY of these, suspect timing issues:
- Tests pass locally, fail in CI (timing differences)
- Tests sometimes pass, sometimes fail (race conditions)
- Tests use `sleep()` or `Thread.sleep()` (arbitrary delays)
- Tests fail with "UI element not found" then pass on retry
- Long test runs (waiting for worst-case scenarios)

## Quick Decision Tree

```
Test failing?
├─ Element not found?
│  └─ Use waitForExistence(timeout:) not sleep()
├─ Passes locally, fails CI?
│  └─ Replace sleep() with condition polling
├─ Animation causing issues?
│  └─ Wait for animation completion, don't disable
└─ Network request timing?
   └─ Use XCTestExpectation or waitForExistence
```

## Core Pattern: Condition-Based Waiting

**❌ WRONG (Arbitrary Timeout)**:
```swift
func testButtonAppears() {
    app.buttons["Login"].tap()
    sleep(2)  // ❌ Guessing it takes 2 seconds
    XCTAssertTrue(app.buttons["Dashboard"].exists)
}
```

**✅ CORRECT (Wait for Condition)**:
```swift
func testButtonAppears() {
    app.buttons["Login"].tap()
    let dashboard = app.buttons["Dashboard"]
    XCTAssertTrue(dashboard.waitForExistence(timeout: 5))
}
```

## Common UI Testing Patterns

### Pattern 1: Waiting for Elements

```swift
// Wait for element to appear
func waitForElement(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
    return element.waitForExistence(timeout: timeout)
}

// Usage
XCTAssertTrue(waitForElement(app.buttons["Submit"]))
```

### Pattern 2: Waiting for Element to Disappear

```swift
func waitForElementToDisappear(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
    let predicate = NSPredicate(format: "exists == false")
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
    let result = XCTWaiter().wait(for: [expectation], timeout: timeout)
    return result == .completed
}

// Usage
XCTAssertTrue(waitForElementToDisappear(app.activityIndicators["Loading"]))
```

### Pattern 3: Waiting for Specific State

```swift
func waitForButton(_ button: XCUIElement, toBeEnabled enabled: Bool, timeout: TimeInterval = 5) -> Bool {
    let predicate = NSPredicate(format: "isEnabled == %@", NSNumber(value: enabled))
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: button)
    let result = XCTWaiter().wait(for: [expectation], timeout: timeout)
    return result == .completed
}

// Usage
let submitButton = app.buttons["Submit"]
XCTAssertTrue(waitForButton(submitButton, toBeEnabled: true))
submitButton.tap()
```

### Pattern 4: Accessibility Identifiers

**Set in app**:
```swift
Button("Submit") {
    // action
}
.accessibilityIdentifier("submitButton")
```

**Use in tests**:
```swift
func testSubmitButton() {
    let submitButton = app.buttons["submitButton"]  // Uses identifier, not label
    XCTAssertTrue(submitButton.waitForExistence(timeout: 5))
    submitButton.tap()
}
```

**Why**: Accessibility identifiers don't change with localization, remain stable across UI updates.

### Pattern 5: Network Request Delays

```swift
func testDataLoads() {
    app.buttons["Refresh"].tap()

    // Wait for loading indicator to disappear
    let loadingIndicator = app.activityIndicators["Loading"]
    XCTAssertTrue(waitForElementToDisappear(loadingIndicator, timeout: 10))

    // Now verify data loaded
    XCTAssertTrue(app.cells.count > 0)
}
```

### Pattern 6: Animation Handling

```swift
func testAnimatedTransition() {
    app.buttons["Next"].tap()

    // Wait for destination view to appear
    let destinationView = app.otherElements["DestinationView"]
    XCTAssertTrue(destinationView.waitForExistence(timeout: 2))

    // Optional: Wait a bit more for animation to settle
    // Only if absolutely necessary
    RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.3))
}
```

## Testing Checklist

### Before Writing Tests
- [ ] Use accessibility identifiers for all interactive elements
- [ ] Avoid hardcoded labels (use identifiers instead)
- [ ] Plan for network delays and animations
- [ ] Choose appropriate timeouts (2s UI, 10s network)

### When Writing Tests
- [ ] Use `waitForExistence()` not `sleep()`
- [ ] Use predicates for complex conditions
- [ ] Test both success and failure paths
- [ ] Make tests independent (can run in any order)

### After Writing Tests
- [ ] Run tests 10 times locally (catch flakiness)
- [ ] Run tests on slowest supported device
- [ ] Run tests in CI environment
- [ ] Check test duration (if >30s per test, optimize)

## Xcode UI Testing Tips

### Launch Arguments for Testing

```swift
func testExample() {
    let app = XCUIApplication()
    app.launchArguments = ["UI-Testing"]
    app.launch()
}
```

In app code:
```swift
if ProcessInfo.processInfo.arguments.contains("UI-Testing") {
    // Use mock data, skip onboarding, etc.
}
```

### Faster Test Execution

```swift
override func setUpWithError() throws {
    continueAfterFailure = false  // Stop on first failure
}
```

### Debugging Failing Tests

```swift
func testExample() {
    // Take screenshot on failure
    addUIInterruptionMonitor(withDescription: "Alert") { alert in
        alert.buttons["OK"].tap()
        return true
    }

    // Print element hierarchy
    print(app.debugDescription)
}
```

## Common Mistakes

### ❌ Using sleep() for Everything
```swift
sleep(5)  // ❌ Wastes time if operation completes in 1s
```

### ❌ Not Handling Animations
```swift
app.buttons["Next"].tap()
XCTAssertTrue(app.buttons["Back"].exists)  // ❌ May fail during animation
```

### ❌ Hardcoded Text Labels
```swift
app.buttons["Submit"].tap()  // ❌ Breaks with localization
```

### ❌ Tests Depend on Each Other
```swift
// ❌ Test 2 assumes Test 1 ran first
func test1_Login() { /* ... */ }
func test2_ViewDashboard() { /* assumes logged in */ }
```

### ❌ No Timeout Strategy
```swift
element.waitForExistence(timeout: 100)  // ❌ Too long
element.waitForExistence(timeout: 0.1)  // ❌ Too short
```

**Use appropriate timeouts**:
- UI animations: 2-3 seconds
- Network requests: 10 seconds
- Complex operations: 30 seconds max

## Real-World Impact

**Before** (using sleep()):
- Test suite: 15 minutes (waiting for worst-case)
- Flaky tests: 20% failure rate
- CI failures: 50% require retry

**After** (condition-based waiting):
- Test suite: 5 minutes (waits only as needed)
- Flaky tests: <2% failure rate
- CI failures: <5% require retry

**Key insight:** Tests finish faster AND are more reliable when waiting for actual conditions instead of guessing times.

---

## Recording UI Automation (WWDC 2025)

### Overview

**NEW in Xcode 26**: Record, replay, and review UI automation tests with video recordings.

**Three Phases**:
1. **Record** - Capture interactions (taps, swipes, hardware button presses) as Swift code
2. **Replay** - Run across multiple devices, languages, regions, orientations
3. **Review** - Watch video recordings, analyze failures, view UI element overlays

**Supported Platforms**: iOS, iPadOS, macOS, watchOS, tvOS, visionOS (Designed for iPad)

### How UI Automation Works

**Key Principles**:
- UI automation interacts with your app **as a person does** using gestures and hardware events
- Runs **completely independently** from your app (app models/data not directly accessible)
- Uses **accessibility framework** as underlying technology
- Tells OS which gestures to perform, then waits for completion **synchronously** one at a time

**Actions include**:
- Launching your app
- Interacting with buttons and navigation
- Setting system state (Dark Mode, localization, etc.)
- Setting simulated location

### Accessibility is the Foundation

**Critical Understanding**: Accessibility provides information directly to UI automation.

What accessibility sees:
- Element types (button, text, image, etc.)
- Labels (visible text)
- Values (current state for checkboxes, etc.)
- Frames (element positions)
- **Identifiers** (accessibility identifiers - NOT localized)

**Best Practice**: Great accessibility experience = great UI automation experience.

### Preparing Your App for Recording

#### Step 1: Add Accessibility Identifiers

**SwiftUI**:
```swift
Button("Submit") {
    // action
}
.accessibilityIdentifier("submitButton")

// Make identifiers specific to instance
List(landmarks) { landmark in
    LandmarkRow(landmark)
        .accessibilityIdentifier("landmark-\(landmark.id)")
}
```

**UIKit**:
```swift
let button = UIButton()
button.accessibilityIdentifier = "submitButton"

// Use index for table cells
cell.accessibilityIdentifier = "cell-\(indexPath.row)"
```

**Good identifiers are**:
- ✅ Unique within entire app
- ✅ Descriptive of element contents
- ✅ Static (don't react to content changes)
- ✅ Not localized (same across languages)

**Why identifiers matter**:
- Titles/descriptions may change, identifiers remain stable
- Work across localized strings
- Uniquely identify elements with dynamic content

**Pro Tip**: Use Xcode coding assistant to add identifiers:
```
Prompt: "Add accessibility identifiers to the relevant parts of this view"
```

#### Step 2: Review Accessibility with Accessibility Inspector

**Launch Accessibility Inspector**:
- Xcode menu → Open Developer Tool → Accessibility Inspector
- Or: Launch from Spotlight

**Features**:
1. **Element Inspector** - List accessibility values for any view
2. **Property details** - Click property name for documentation
3. **Platform support** - Works on all Apple platforms

**What to check**:
- Elements have labels
- Interactive elements have types (button, not just text)
- Values set for stateful elements (checkboxes, toggles)
- Identifiers set for elements with dynamic/localized content

**Sample Code Reference**: [Delivering an exceptional accessibility experience](https://developer.apple.com/documentation/accessibility/delivering_an_exceptional_accessibility_experience)

#### Step 3: Add UI Testing Target

1. Open project settings in Xcode
2. Click "+" below targets list
3. Select **UI Testing Bundle**
4. Click Finish

**Result**: New UI test folder with template tests added to project.

### Recording Interactions

#### Starting a Recording (Xcode 26)

1. Open UI test source file
2. **Popover appears** explaining how to start recording (first time only)
3. Click **"Start Recording"** button in editor gutter
4. Xcode builds and launches app in Simulator/device

**During Recording**:
- Interact with app normally (taps, swipes, text entry, etc.)
- Code representing interactions appears in source editor in real-time
- Recording updates as you type (e.g., text field entries)

**Stopping Recording**:
- Click **"Stop Run"** button in Xcode

#### Example Recording Session

```swift
func testCreateAustralianCollection() {
    let app = XCUIApplication()
    app.launch()

    // Tap "Collections" tab (recorded automatically)
    app.tabBars.buttons["Collections"].tap()

    // Tap "+" to add new collection
    app.navigationBars.buttons["Add"].tap()

    // Tap "Edit" button
    app.buttons["Edit"].tap()

    // Type collection name
    app.textFields.firstMatch.tap()
    app.textFields.firstMatch.typeText("Max's Australian Adventure")

    // Tap "Edit Landmarks"
    app.buttons["Edit Landmarks"].tap()

    // Add landmarks
    app.tables.cells.containing(.staticText, identifier:"Great Barrier Reef").buttons["Add"].tap()
    app.tables.cells.containing(.staticText, identifier:"Uluru").buttons["Add"].tap()

    // Tap checkmark to save
    app.navigationBars.buttons["Done"].tap()
}
```

#### Reviewing Recorded Code

After recording, **review and adjust queries**:

**Multiple Options**: Each line has dropdown showing alternative ways to address element.

**Selection Recommendations**:
1. **For localized strings** (text, button labels): Choose accessibility identifier if available
2. **For deeply nested views**: Choose shortest query (stays resilient as app changes)
3. **For dynamic content** (timestamps, temperature): Use generic query or identifier

**Example**:
```swift
// Recorded options for text field:
app.textFields["Collection Name"]              // ❌ Breaks if label localizes
app.textFields["collectionNameField"]          // ✅ Uses identifier
app.textFields.element(boundBy: 0)             // ✅ Position-based
app.textFields.firstMatch                      // ✅ Generic, shortest
```

**Choose shortest, most stable query** for your needs.

### Adding Validations

After recording, **add assertions** to verify expected behavior:

#### Wait for Existence

```swift
// Validate collection created
let collection = app.buttons["Max's Australian Adventure"]
XCTAssertTrue(collection.waitForExistence(timeout: 5))
```

#### Wait for Property Changes

```swift
// Wait for button to become enabled
let submitButton = app.buttons["Submit"]
XCTAssertTrue(submitButton.wait(for: .enabled, toEqual: true, timeout: 5))
```

#### Combine with XCTAssert

```swift
// Fail test if element doesn't appear
let landmark = app.staticTexts["Great Barrier Reef"]
XCTAssertTrue(landmark.waitForExistence(timeout: 5), "Landmark should appear in collection")
```

### Advanced Automation APIs

#### Setup Device State

```swift
override func setUpWithError() throws {
    let app = XCUIApplication()

    // Set device orientation
    XCUIDevice.shared.orientation = .landscapeLeft

    // Set appearance mode
    app.launchArguments += ["-UIUserInterfaceStyle", "dark"]

    // Simulate location
    let location = XCUILocation(location: CLLocation(latitude: 37.7749, longitude: -122.4194))
    app.launchArguments += ["-SimulatedLocation", location.description]

    app.launch()
}
```

#### Launch Arguments & Environment

```swift
func testWithMockData() {
    let app = XCUIApplication()

    // Pass arguments to app
    app.launchArguments = ["-UI-Testing", "-UseMockData"]

    // Set environment variables
    app.launchEnvironment = ["API_URL": "https://mock.api.com"]

    app.launch()
}
```

In app code:
```swift
if ProcessInfo.processInfo.arguments.contains("-UI-Testing") {
    // Use mock data, skip onboarding
}
```

#### Custom URL Schemes

```swift
// Open app to specific URL
let app = XCUIApplication()
app.open(URL(string: "myapp://landmark/123")!)

// Open URL with system default app (global version)
XCUIApplication.open(URL(string: "https://example.com")!)
```

#### Accessibility Audits in Tests

```swift
func testAccessibility() throws {
    let app = XCUIApplication()
    app.launch()

    // Perform accessibility audit
    try app.performAccessibilityAudit()
}
```

**Reference**: [Perform accessibility audits for your app - WWDC23](https://developer.apple.com/videos/play/wwdc2023/10035/)

### Test Plans for Multiple Configurations

**Test Plans** let you:
- Include/exclude individual tests
- Set system settings (language, region, appearance)
- Configure test properties (timeouts, repetitions, parallelization)
- Associate with schemes for specific build settings

#### Creating Test Plan

1. Create new or use existing test plan
2. Add/remove tests on first screen
3. Switch to **Configurations** tab

#### Adding Multiple Languages

```
Configurations:
├─ English
├─ German (longer strings)
├─ Arabic (right-to-left)
└─ Hebrew (right-to-left)
```

**Each locale** = separate configuration in test plan.

**Settings**:
- Focused for specific locale
- Shared across all configurations

#### Video & Screenshot Capture

**In Configurations tab**:
- **Capture screenshots**: On/Off
- **Capture video**: On/Off
- **Keep media**: "Only failures" or "On, and keep all"

**Defaults**: Videos/screenshots kept only for failing runs (for review).

**"On, and keep all" use cases**:
- Documentation
- Tutorials
- Marketing materials

**Reference**: [Author fast and reliable tests for Xcode Cloud - WWDC22](https://developer.apple.com/videos/play/wwdc2022/110371/)

### Replaying Tests in Xcode Cloud

**Xcode Cloud** = built-in service for:
- Building app
- Running tests
- Uploading to App Store
- All in cloud without using team devices

**Workflow configuration**:
- Same test plan used locally
- Runs on multiple devices and configurations
- Videos/results available in App Store Connect

**Viewing Results**:
- Xcode: Xcode Cloud section
- App Store Connect: Xcode Cloud section
- See build info, logs, failure descriptions, video recordings

**Team Access**: Entire team can see run history and download results/videos.

**Reference**: [Create practical workflows in Xcode Cloud - WWDC23](https://developer.apple.com/videos/play/wwdc2023/10269/)

### Reviewing Test Results with Videos

#### Accessing Test Report

1. Click **Test** button in Xcode
2. Double-click failing run to see video + description

**Features**:
- **Runs dropdown** - Switch between video recordings of different configurations (languages, devices)
- **Save video** - Secondary click → Save
- **Play/pause** - Video playback with UI interaction overlays
- **Timeline dots** - UI interactions shown as dots on timeline
- **Jump to failure** - Click failure diamond on timeline

#### UI Element Overlay at Failure

**At moment of failure**:
- Click timeline failure point
- **Overlay shows all UI elements** present on screen
- Click any element to see code recommendations for addressing it
- **Show All** - See alternative examples

**Workflow**:
1. Identify what was actually present (vs what test expected)
2. Click element to get query code
3. Secondary click → Copy code
4. **View Source** → Go directly to test
5. Paste corrected code

**Example**:
```swift
// Test expected:
let button = app.buttons["Max's Australian Adventure"]

// But overlay shows it's actually text, not button:
let text = app.staticTexts["Max's Australian Adventure"] // ✅ Correct
```

#### Running Test in Different Language

Click test diamond → Select configuration (e.g., Arabic) → Watch automation run in right-to-left layout.

**Validates**: Same automation works across languages/layouts.

**Reference**: [Fix failures faster with Xcode test reports - WWDC23](https://developer.apple.com/videos/play/wwdc2023/10175/)

### Recording UI Automation Checklist

#### Before Recording
- [ ] Add accessibility identifiers to interactive elements
- [ ] Review app with Accessibility Inspector
- [ ] Add UI Testing Bundle target to project
- [ ] Plan workflow to record (user journey)

#### During Recording
- [ ] Interact naturally with app
- [ ] Record complete user journeys (not individual taps)
- [ ] Check code generates as you interact
- [ ] Stop recording when workflow complete

#### After Recording
- [ ] Review recorded code options (dropdown on each line)
- [ ] Choose stable queries (identifiers > labels)
- [ ] Add validations (waitForExistence, XCTAssert)
- [ ] Add setup code (device state, launch arguments)
- [ ] Run test to verify it passes

#### Test Plan Configuration
- [ ] Create/update test plan
- [ ] Add multiple language configurations
- [ ] Include right-to-left languages (Arabic, Hebrew)
- [ ] Configure video/screenshot capture settings
- [ ] Set appropriate timeouts for network tests

#### Running & Reviewing
- [ ] Run test locally across configurations
- [ ] Review video recordings for failures
- [ ] Use UI element overlay to debug failures
- [ ] Run in Xcode Cloud for team visibility
- [ ] Download and share videos if needed

---

## Reference

**WWDC 2025 Sessions**:
- [Record, replay, and review: UI automation with Xcode - WWDC25 Session 344](https://developer.apple.com/videos/play/wwdc2025/344/)
  - Recording UI automation, test plans, video review

**WWDC 2023 Sessions**:
- [Fix failures faster with Xcode test reports - WWDC23](https://developer.apple.com/videos/play/wwdc2023/10175/)
- [Perform accessibility audits for your app - WWDC23](https://developer.apple.com/videos/play/wwdc2023/10035/)

**WWDC 2024 Sessions**:
- [Meet Swift Testing - WWDC24](https://developer.apple.com/videos/play/wwdc2024/10179/)

**Apple Documentation**:
- [XCTest Framework](https://developer.apple.com/documentation/xctest)
- [Recording UI automation for testing](https://developer.apple.com/documentation/XCUIAutomation/recording-ui-automation-for-testing)
- [UI Testing in Xcode](https://developer.apple.com/library/archive/documentation/DeveloperTools/Conceptual/testing_with_xcode/chapters/09-ui_testing.html)
- [XCTWaiter](https://developer.apple.com/documentation/xctest/xctwaiter)
- [Delivering an exceptional accessibility experience](https://developer.apple.com/documentation/accessibility/delivering_an_exceptional_accessibility_experience)
- [Performing accessibility testing for your app](https://developer.apple.com/documentation/accessibility/performing_accessibility_testing_for_your_app)

**Note**: This skill focuses on reliability patterns and Recording UI Automation. For TDD workflow, see superpowers:test-driven-development.

---

## Version History

- **2.0.0 (WWDC 2025)**: Added Recording UI Automation section with comprehensive guidance on recording, replaying, reviewing tests; test plans; video debugging; accessibility-first patterns from WWDC 2025 Session 344
- **1.0.0**: Initial version focusing on condition-based waiting patterns
