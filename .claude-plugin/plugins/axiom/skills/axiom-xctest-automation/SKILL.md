---
name: axiom-xctest-automation
description: Use when writing, running, or debugging XCUITests. Covers element queries, waiting strategies, accessibility identifiers, test plans, and CI/CD test execution patterns.
version: 1.0.0
category: testing
user-invocable: false
---

# XCUITest Automation Patterns

Comprehensive guide to writing reliable, maintainable UI tests with XCUITest.

## Core Principle

**Reliable UI tests require three things**:
1. Stable element identification (accessibilityIdentifier)
2. Condition-based waiting (never hardcoded sleep)
3. Clean test isolation (no shared state)

## Element Identification

### The Accessibility Identifier Pattern

**ALWAYS use accessibilityIdentifier for test-critical elements.**

```swift
// SwiftUI
Button("Login") { ... }
    .accessibilityIdentifier("loginButton")

TextField("Email", text: $email)
    .accessibilityIdentifier("emailTextField")

// UIKit
loginButton.accessibilityIdentifier = "loginButton"
emailTextField.accessibilityIdentifier = "emailTextField"
```

### Query Selection Guidelines

From WWDC 2025-344 "Recording UI Automation":

1. **Localized strings change** → Use accessibilityIdentifier instead
2. **Deeply nested views** → Use shortest possible query
3. **Dynamic content** → Use generic query or identifier

```swift
// BAD - Fragile queries
app.buttons["Login"]  // Breaks with localization
app.tables.cells.element(boundBy: 0).buttons.firstMatch  // Too specific

// GOOD - Stable queries
app.buttons["loginButton"]  // Uses identifier
app.tables.cells.containing(.staticText, identifier: "itemTitle").firstMatch
```

## Waiting Strategies

### Never Use sleep()

```swift
// BAD - Hardcoded wait
sleep(5)
XCTAssertTrue(app.buttons["submit"].exists)

// GOOD - Condition-based wait
let submitButton = app.buttons["submit"]
XCTAssertTrue(submitButton.waitForExistence(timeout: 5))
```

### Wait Patterns

```swift
// Wait for element to appear
func waitForElement(_ element: XCUIElement, timeout: TimeInterval = 10) -> Bool {
    element.waitForExistence(timeout: timeout)
}

// Wait for element to disappear
func waitForElementToDisappear(_ element: XCUIElement, timeout: TimeInterval = 10) -> Bool {
    let predicate = NSPredicate(format: "exists == false")
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
    let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
    return result == .completed
}

// Wait for element to be hittable (visible AND enabled)
func waitForElementHittable(_ element: XCUIElement, timeout: TimeInterval = 10) -> Bool {
    let predicate = NSPredicate(format: "isHittable == true")
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
    let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
    return result == .completed
}

// Wait for text to appear anywhere
func waitForText(_ text: String, timeout: TimeInterval = 10) -> Bool {
    app.staticTexts[text].waitForExistence(timeout: timeout)
}
```

### Async Operations

```swift
// Wait for network response
func waitForNetworkResponse() {
    let loadingIndicator = app.activityIndicators["loadingIndicator"]

    // Wait for loading to start
    _ = loadingIndicator.waitForExistence(timeout: 5)

    // Wait for loading to finish
    _ = waitForElementToDisappear(loadingIndicator, timeout: 30)
}
```

## Test Structure

### Setup and Teardown

```swift
class LoginTests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()

        // Reset app state for clean test
        app.launchArguments = ["--uitesting", "--reset-state"]
        app.launchEnvironment = ["DISABLE_ANIMATIONS": "1"]
        app.launch()
    }

    override func tearDownWithError() throws {
        // Capture screenshot on failure
        if testRun?.failureCount ?? 0 > 0 {
            let screenshot = XCUIScreen.main.screenshot()
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.name = "Failure Screenshot"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        app.terminate()
    }
}
```

### Test Method Pattern

```swift
func testLoginWithValidCredentials() throws {
    // ARRANGE - Navigate to login screen
    let loginButton = app.buttons["showLoginButton"]
    XCTAssertTrue(loginButton.waitForExistence(timeout: 5))
    loginButton.tap()

    // ACT - Enter credentials and submit
    let emailField = app.textFields["emailTextField"]
    XCTAssertTrue(emailField.waitForExistence(timeout: 5))
    emailField.tap()
    emailField.typeText("user@example.com")

    let passwordField = app.secureTextFields["passwordTextField"]
    passwordField.tap()
    passwordField.typeText("password123")

    app.buttons["loginSubmitButton"].tap()

    // ASSERT - Verify successful login
    let welcomeLabel = app.staticTexts["welcomeLabel"]
    XCTAssertTrue(welcomeLabel.waitForExistence(timeout: 10))
    XCTAssertTrue(welcomeLabel.label.contains("Welcome"))
}
```

## Common Interactions

### Text Input

```swift
// Clear and type
let textField = app.textFields["emailTextField"]
textField.tap()
textField.clearText()  // Custom extension
textField.typeText("new@email.com")

// Extension to clear text
extension XCUIElement {
    func clearText() {
        guard let stringValue = value as? String else { return }
        tap()
        let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: stringValue.count)
        typeText(deleteString)
    }
}
```

### Scrolling

```swift
// Scroll until element is visible
func scrollToElement(_ element: XCUIElement, in scrollView: XCUIElement) {
    while !element.isHittable {
        scrollView.swipeUp()
    }
}

// Scroll to specific element
let targetCell = app.tables.cells["targetItem"]
let table = app.tables.firstMatch
scrollToElement(targetCell, in: table)
targetCell.tap()
```

### Alerts and Sheets

```swift
// Handle system alert
addUIInterruptionMonitor(withDescription: "Permission Alert") { alert in
    if alert.buttons["Allow"].exists {
        alert.buttons["Allow"].tap()
        return true
    }
    return false
}
app.tap() // Trigger the monitor

// Handle app alert
let alert = app.alerts["Error"]
if alert.waitForExistence(timeout: 5) {
    alert.buttons["OK"].tap()
}
```

### Keyboard Dismissal

```swift
// Dismiss keyboard
if app.keyboards.count > 0 {
    app.toolbars.buttons["Done"].tap()
    // Or tap outside
    // app.tap()
}
```

## Test Plans

### Multi-Configuration Testing

Test plans allow running the same tests with different configurations:

```xml
<!-- TestPlan.xctestplan -->
{
  "configurations" : [
    {
      "name" : "English",
      "options" : {
        "language" : "en",
        "region" : "US"
      }
    },
    {
      "name" : "Spanish",
      "options" : {
        "language" : "es",
        "region" : "ES"
      }
    },
    {
      "name" : "Dark Mode",
      "options" : {
        "userInterfaceStyle" : "dark"
      }
    }
  ],
  "testTargets" : [
    {
      "target" : {
        "containerPath" : "container:MyApp.xcodeproj",
        "identifier" : "MyAppUITests",
        "name" : "MyAppUITests"
      }
    }
  ]
}
```

### Running with Test Plan

```bash
xcodebuild test \
  -scheme "MyApp" \
  -testPlan "MyTestPlan" \
  -destination "platform=iOS Simulator,name=iPhone 16" \
  -resultBundlePath /tmp/results.xcresult
```

## CI/CD Integration

### Parallel Test Execution

```bash
xcodebuild test \
  -scheme "MyAppUITests" \
  -destination "platform=iOS Simulator,name=iPhone 16" \
  -parallel-testing-enabled YES \
  -maximum-parallel-test-targets 4 \
  -resultBundlePath /tmp/results.xcresult
```

### Retry Failed Tests

```bash
xcodebuild test \
  -scheme "MyAppUITests" \
  -destination "platform=iOS Simulator,name=iPhone 16" \
  -retry-tests-on-failure \
  -test-iterations 3 \
  -resultBundlePath /tmp/results.xcresult
```

### Code Coverage

```bash
xcodebuild test \
  -scheme "MyAppUITests" \
  -destination "platform=iOS Simulator,name=iPhone 16" \
  -enableCodeCoverage YES \
  -resultBundlePath /tmp/results.xcresult

# Export coverage report
xcrun xcresulttool export coverage \
  --path /tmp/results.xcresult \
  --output-path /tmp/coverage
```

## Debugging Failed Tests

### Capture Screenshots

```swift
// Manual screenshot capture
let screenshot = app.screenshot()
let attachment = XCTAttachment(screenshot: screenshot)
attachment.name = "Before Login"
attachment.lifetime = .keepAlways
add(attachment)
```

### Capture Videos

Enable in test plan or scheme:
```xml
"systemAttachmentLifetime" : "keepAlways",
"userAttachmentLifetime" : "keepAlways"
```

### Print Element Hierarchy

```swift
// Debug: Print all elements
print(app.debugDescription)

// Debug: Print specific container
print(app.tables.firstMatch.debugDescription)
```

## Anti-Patterns to Avoid

### 1. Hardcoded Delays

```swift
// BAD
sleep(5)
button.tap()

// GOOD
XCTAssertTrue(button.waitForExistence(timeout: 5))
button.tap()
```

### 2. Index-Based Queries

```swift
// BAD - Breaks if order changes
app.tables.cells.element(boundBy: 0)

// GOOD - Uses identifier
app.tables.cells["firstItem"]
```

### 3. Shared State Between Tests

```swift
// BAD - Tests depend on order
func test1_CreateItem() { ... }
func test2_EditItem() { ... }  // Depends on test1

// GOOD - Independent tests
func testCreateItem() {
    // Creates own item
}
func testEditItem() {
    // Creates item, then edits
}
```

### 4. Testing Implementation Details

```swift
// BAD - Tests internal structure
XCTAssertEqual(app.tables.cells.count, 10)

// GOOD - Tests user-visible behavior
XCTAssertTrue(app.staticTexts["10 items"].exists)
```

## Recording UI Automation (Xcode 26+)

From WWDC 2025-344:

1. **Record** — Record interactions in Xcode (Debug → Record UI Automation)
2. **Replay** — Run across devices/languages/configurations via test plans
3. **Review** — Watch video recordings in test report

### Enhancing Recorded Code

```swift
// RECORDED (may be fragile)
app.buttons["Login"].tap()

// ENHANCED (stable)
let loginButton = app.buttons["loginButton"]
XCTAssertTrue(loginButton.waitForExistence(timeout: 5))
loginButton.tap()
```

## Resources

**WWDC**: 2025-344, 2024-10206, 2023-10175, 2019-413

**Docs**: /xctest/xcuiapplication, /xctest/xcuielement, /xctest/xcuielementquery

**Skills**: axiom-ui-testing, axiom-swift-testing
