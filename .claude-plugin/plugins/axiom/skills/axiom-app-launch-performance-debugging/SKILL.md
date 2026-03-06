---
name: axiom-app-launch-performance-debugging
description: Use when app launch is slow, takes >2 seconds to first screen, users complain about startup time, or optimizing cold/warm launch performance - systematic launch profiling with App Launch Instrument, dyld optimization, and main thread analysis for UIKit, SwiftUI, Swift, and Objective-C codebases
license: MIT
metadata:
  version: "1.0.0"
  last-updated: "Comprehensive launch analysis covering UIKit AppDelegate, SwiftUI App lifecycle, Objective-C patterns, dyld loading, pre-main optimization, and production monitoring"
---

# App Launch Performance Debugging

## Overview

App launch performance directly impacts user retention and App Store ratings. **Core principle**: Measure launch phases systematically with App Launch Instrument before optimizing. 80% of launch issues stem from main thread blocking, excessive pre-main work, or framework loading overhead.

**Target launch times**: Cold launch <1.5s, warm launch <1.0s, hot launch <0.5s on real device.

**Requires**: Xcode 14+, iOS 15+, Device testing (Simulator results unreliable for launch timing)
**Related skills**: `axiom-performance-profiling` (general Instruments usage), `axiom-memory-debugging` (launch memory spikes), `axiom-xcode-debugging` (environment setup)

## When to Use App Launch Performance Debugging

#### Use this skill when
- ✅ App takes >2 seconds from tap to first usable screen
- ✅ Users complain app is "slow to start" or "takes forever to load"
- ✅ App Store reviews mention "slow startup" or "loading issues"
- ✅ Cold launch after device reboot is noticeably slow
- ✅ App launch performance has regressed after recent changes
- ✅ Preparing for App Store submission and want to optimize user experience
- ✅ Integrating new frameworks and launch time increased

#### Use `axiom-performance-profiling` instead when
- General app performance issues after launch
- Memory leaks or CPU spikes during runtime

#### Use `axiom-xcode-debugging` instead when
- App fails to launch or crashes during startup
- Build or environment issues preventing launch

## App Launch Phases

Understanding launch phases helps target optimization efforts:

### Phase 1: Pre-Main (Dyld Time)
**What happens**: Dynamic linker loads frameworks, resolves symbols, runs static initializers
**Measured by**: App Launch Instrument "Pre-main" phase
**Target**: <400ms total pre-main time

### Phase 2: Main to First Frame
**What happens**: main() → UIApplicationMain/SwiftUI App → viewDidLoad/body → first pixels rendered
**Measured by**: App Launch Instrument "Extended Launch" phase
**Target**: <1000ms from main() to interactive UI

### Phase 3: First Frame to Interactive
**What happens**: Network calls, database setup, content loading
**Measured by**: Custom signposts or user-defined completion
**Target**: <500ms from first frame to fully functional

---

## Launch Performance Decision Tree

Before profiling, identify which phase is slow:

```
App launch feels slow?
├─ App icon tap to first pixels > 2s?
│  ├─ Most delay BEFORE app UI appears?
│  │  └─ → Pre-main optimization (dyld, frameworks)
│  └─ App UI appears but stays on launch screen > 1s?
│     └─ → Main thread analysis (viewDidLoad, SwiftUI body)
├─ First screen appears quickly but content loads slowly?
│  └─ → Post-launch optimization (network, database)
└─ Launch varies dramatically (1s vs 5s)?
   └─ → Cold vs warm launch analysis
```

---

## App Launch Instrument Workflow

### Step 1: Launch Instruments
```bash
open -a Instruments
```

Select **"App Launch"** template (not "Time Profiler").

### Step 2: Configure Target
1. **Device, not Simulator** - Launch timing on Simulator is unreliable
2. Select your app from target dropdown
3. **Clean launch**: Force-quit app first, then start recording
4. For cold launch: Restart device, wait 30s, then test

### Step 3: Record Launch
1. Click Record (red circle)
2. **Immediately tap your app icon** on device
3. Stop recording when app is fully interactive (~10-15 seconds)
4. Perform 3-5 recordings for consistency

### Step 4: Analyze Results

App Launch Instrument shows timeline with color-coded phases:

```
Launch Timeline:
[■■■■] Pre-Main (400ms)
[■■■■■■■] Main Thread Work (800ms)
[■■■] Extended Launch (300ms)
Total: 1.5s cold launch
```

**Key metrics to examine**:
- **Pre-main Duration** - Framework loading time
- **Main Thread Work** - Initialization code
- **Extended Launch** - Custom completion point
- **Resume Time** - Warm launch from background

---

## Pre-Main Optimization

Pre-main work happens before your code runs. Optimize dyld loading:

### Reducing Framework Count

#### ❌ Problem: Too Many Dynamic Frameworks
```swift
// Excessive framework imports
import Alamofire
import SwiftyJSON
import Kingfisher
import SnapKit
import RxSwift
import RxCocoa
// ... 15+ frameworks = slow pre-main
```

#### ✅ Solution: Consolidate and Static Link
```swift
// Combine related functionality
import Foundation
import UIKit
import SwiftUI  // Core frameworks only

// For smaller dependencies, copy source instead of framework
// Or use Swift Package Manager with static linking when possible
```

**Impact**: Each dynamic framework adds ~50-100ms to pre-main. Target <10 total frameworks.

### Objective-C Static Initializers

#### ❌ Problem: Heavy +load Methods
```objc
// BAD: Heavy work in +load (runs during pre-main)
@implementation DataManager
+ (void)load {
    // This runs before main() - blocks launch
    [self setupDatabase];
    [self migrateData];
    [self initializeCaches]; // 200ms+ of work
}
@end
```

#### ✅ Solution: Defer to +initialize or Runtime
```objc
// GOOD: Defer work until first use
@implementation DataManager
+ (void)initialize {
    if (self == [DataManager class]) {
        // Only runs when class is first used
        [self setupDatabase];
    }
}

// Or use dispatch_once in instance method
- (void)ensureInitialized {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        [self setupDatabase];
    });
}
@end
```

### Swift Static Initialization

#### ❌ Problem: Global Work at Module Load
```swift
// BAD: Complex globals computed at module load
let expensiveGlobalCache = createLargeDataStructure() // Blocks pre-main
let precomputedValues = performHeavyCalculation() // 100ms+ delay

class AppConfig {
    static let shared = AppConfig() // Fine

    init() {
        // BAD: Heavy work in static initializer
        loadConfigFromDisk() // File I/O during pre-main
        parseComplexData()   // CPU work during pre-main
    }
}
```

#### ✅ Solution: Lazy Initialization
```swift
// GOOD: Defer computation until needed
lazy var expensiveCache = createLargeDataStructure()

class AppConfig {
    static let shared = AppConfig()
    private var isInitialized = false

    private init() {
        // Empty init - fast pre-main
    }

    func ensureInitialized() {
        guard !isInitialized else { return }
        isInitialized = true
        loadConfigFromDisk()
        parseComplexData()
    }
}
```

---

## Main Thread Launch Optimization

After pre-main, your code runs. Optimize main thread work:

### UIKit AppDelegate Optimization

#### ❌ Problem: Heavy applicationDidFinishLaunching
```objc
// Objective-C AppDelegate - blocks first frame
- (BOOL)application:(UIApplication *)application
didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {

    // BAD: All synchronous work blocks UI
    [self setupDatabase];           // 200ms
    [self configureNetworking];     // 100ms
    [self loadUserPreferences];     // 150ms
    [self initializeAnalytics];     // 100ms
    // Total: 550ms before first frame

    return YES;
}
```

```swift
// Swift AppDelegate - same problem
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    // BAD: Synchronous main thread work
    setupDatabase()        // 200ms
    configureNetworking()  // 100ms
    loadUserPreferences()  // 150ms
    initializeAnalytics()  // 100ms

    return true
}
```

#### ✅ Solution: Defer Non-Critical Work
```objc
// Objective-C - Optimized AppDelegate
- (BOOL)application:(UIApplication *)application
didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {

    // ONLY critical UI setup
    self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    self.window.rootViewController = [[MainViewController alloc] init];
    [self.window makeKeyAndVisible];

    // Defer heavy work to background queue
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        [self setupDatabase];
        [self configureNetworking];
        [self loadUserPreferences];
        [self initializeAnalytics];
    });

    return YES;
}
```

```swift
// Swift - Optimized AppDelegate
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    // ONLY critical UI setup on main thread
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = MainViewController()
    window?.makeKeyAndVisible()

    // Defer heavy work
    Task.detached(priority: .background) {
        await setupDatabase()
        await configureNetworking()
        await loadUserPreferences()
        await initializeAnalytics()
    }

    return true
}
```

### SwiftUI App Optimization

#### ❌ Problem: Heavy App Initializer
```swift
// BAD: Heavy work in SwiftUI App initializer
@main
struct MyApp: App {
    @StateObject private var dataManager = DataManager() // Heavy init
    @StateObject private var networkManager = NetworkManager() // More heavy init

    init() {
        // BAD: Synchronous work blocks first frame
        setupLogging()      // 50ms
        configureDatabase() // 200ms
        loadConfiguration() // 100ms
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(dataManager)
                .environmentObject(networkManager)
        }
    }
}
```

#### ✅ Solution: Defer Heavy Initialization
```swift
// GOOD: Minimal App initializer, defer heavy work
@main
struct MyApp: App {
    // Use lazy initialization or defer to first use

    var body: some Scene {
        WindowGroup {
            ContentView()
                .task {
                    // Defer heavy setup until UI is shown
                    await performBackgroundSetup()
                }
        }
    }

    private func performBackgroundSetup() async {
        await setupLogging()
        await configureDatabase()
        await loadConfiguration()
    }
}

// GOOD: Lazy StateObject initialization
class DataManager: ObservableObject {
    static let shared = DataManager()
    private var isInitialized = false

    init() {
        // Fast init - no heavy work
    }

    func ensureInitialized() async {
        guard !isInitialized else { return }
        isInitialized = true
        // Perform heavy setup here, when first needed
        await setupHeavyResources()
    }
}
```

### UIKit ViewController Optimization

#### ❌ Problem: Heavy viewDidLoad
```objc
// Objective-C - Heavy viewDidLoad blocks first frame
- (void)viewDidLoad {
    [super viewDidLoad];

    // BAD: All synchronous, blocks first pixels
    [self setupComplexUI];           // 100ms
    [self loadDataFromDatabase];     // 200ms
    [self configureNetworkCalls];    // 150ms
    [self setupAnimations];          // 100ms
    // UI appears blank for 550ms
}
```

```swift
// Swift - Same problem
override func viewDidLoad() {
    super.viewDidLoad()

    // BAD: Synchronous work blocks UI
    setupComplexUI()        // 100ms
    loadDataFromDatabase()  // 200ms
    configureNetworkCalls() // 150ms
    setupAnimations()       // 100ms
}
```

#### ✅ Solution: Optimize Critical Path
```objc
// Objective-C - Optimized viewDidLoad
- (void)viewDidLoad {
    [super viewDidLoad];

    // ONLY essential UI setup for first frame
    [self setupBasicUI];  // Fast, just creates views

    // Defer data loading
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        [self loadDataFromDatabase];

        dispatch_async(dispatch_get_main_queue(), ^{
            [self updateUIWithData];
        });
    });
}

- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];

    // Setup non-critical features after UI is visible
    [self setupAnimations];
    [self configureNetworkCalls];
}
```

```swift
// Swift - Optimized viewDidLoad
override func viewDidLoad() {
    super.viewDidLoad()

    // ONLY essential UI setup
    setupBasicUI() // Fast, creates basic layout

    // Defer data loading
    Task {
        let data = await loadDataFromDatabase()
        await MainActor.run {
            updateUI(with: data)
        }
    }
}

override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)

    // Setup non-critical features after UI appears
    setupAnimations()
    configureNetworkCalls()
}
```

### SwiftUI View Optimization

#### ❌ Problem: Heavy View Body Computation
```swift
// BAD: Heavy computation in SwiftUI body
struct ContentView: View {
    var body: some View {
        VStack {
            // BAD: Heavy work during body evaluation
            ForEach(processLargeDataSet(), id: \.id) { item in
                ComplexRowView(item: item)
                    .onAppear {
                        // BAD: Network call for every row during initial render
                        loadAdditionalData(for: item)
                    }
            }
        }
        .onAppear {
            // BAD: Heavy synchronous work blocks view appearance
            setupDatabase()
            loadUserPreferences()
            configureNetworking()
        }
    }

    // BAD: Heavy computation in computed property
    private func processLargeDataSet() -> [Item] {
        // Expensive processing during every body evaluation
        return items.sorted().filtered().transformed() // 100ms+
    }
}
```

#### ✅ Solution: Optimize View Rendering
```swift
// GOOD: Optimized SwiftUI body
struct ContentView: View {
    @StateObject private var viewModel = ContentViewModel()
    @State private var isInitialized = false

    var body: some View {
        VStack {
            if isInitialized {
                // Use preprocessed data
                ForEach(viewModel.processedItems, id: \.id) { item in
                    ComplexRowView(item: item)
                }
            } else {
                // Show loading state immediately
                ProgressView("Loading...")
            }
        }
        .task {
            // Defer heavy work until after view appears
            if !isInitialized {
                await viewModel.initialize()
                isInitialized = true
            }
        }
    }
}

@MainActor
class ContentViewModel: ObservableObject {
    @Published var processedItems: [Item] = []

    func initialize() async {
        // Move heavy work to background
        let items = await Task.detached {
            // Heavy processing off main thread
            return self.processLargeDataSet()
        }.value

        self.processedItems = items

        // Setup non-critical features
        await setupDatabase()
        await loadUserPreferences()
        await configureNetworking()
    }

    private func processLargeDataSet() -> [Item] {
        // Heavy computation now runs only once, in background
        return items.sorted().filtered().transformed()
    }
}
```

---

## Measuring Custom Launch Completion

Use OSSignposter to measure app-specific launch completion:

### Implementation Across All Architectures

#### Objective-C Implementation
```objc
#import <os/signpost.h>

@interface LaunchProfiler : NSObject
@property (class, readonly) LaunchProfiler *shared;
- (void)beginLaunchMeasurement;
- (void)endLaunchMeasurement;
@end

@implementation LaunchProfiler
static os_log_t launchLog;
static os_signpost_id_t launchSignpost;

+ (LaunchProfiler *)shared {
    static LaunchProfiler *instance;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[LaunchProfiler alloc] init];
    });
    return instance;
}

- (instancetype)init {
    if (self = [super init]) {
        launchLog = os_log_create("com.app.launch", "performance");
    }
    return self;
}

- (void)beginLaunchMeasurement {
    launchSignpost = os_signpost_id_generate(launchLog);
    os_signpost_interval_begin(launchLog, launchSignpost, "AppLaunch");
}

- (void)endLaunchMeasurement {
    os_signpost_interval_end(launchLog, launchSignpost, "AppLaunch");
}
@end

// In AppDelegate
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    [[LaunchProfiler shared] beginLaunchMeasurement];

    // Setup UI...

    return YES;
}

// When app is ready for user interaction
- (void)applicationDidBecomeActive:(UIApplication *)application {
    [[LaunchProfiler shared] endLaunchMeasurement];
}
```

#### Swift Implementation
```swift
import os

class LaunchProfiler {
    static let shared = LaunchProfiler()
    private let signposter = OSSignposter(subsystem: "com.app.launch", category: "performance")
    private var signpostID: OSSignpostID?

    private init() {}

    func beginLaunchMeasurement() {
        signpostID = signposter.makeSignpostID()
        signposter.beginInterval("AppLaunch", id: signpostID!)
    }

    func endLaunchMeasurement() {
        guard let id = signpostID else { return }
        signposter.endInterval("AppLaunch", id: id)
        signpostID = nil
    }
}

// In AppDelegate or SwiftUI App
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    LaunchProfiler.shared.beginLaunchMeasurement()
    // Setup UI...
    return true
}

// When ready for interaction
func applicationDidBecomeActive(_ application: UIApplication) {
    LaunchProfiler.shared.endLaunchMeasurement()
}
```

#### SwiftUI Implementation
```swift
@main
struct MyApp: App {
    @State private var launchProfiler = LaunchProfiler.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear {
                    launchProfiler.beginLaunchMeasurement()
                }
                .onReceive(NotificationCenter.default.publisher(for: .appLaunchComplete)) { _ in
                    launchProfiler.endLaunchMeasurement()
                }
        }
    }
}

// Post notification when app is ready
extension Notification.Name {
    static let appLaunchComplete = Notification.Name("AppLaunchComplete")
}
```

---

## Cold vs Warm vs Hot vs Push Notification Launch Analysis

### Launch Types Defined

| Launch Type | Definition | Target Time | Common Issues |
|-------------|------------|-------------|---------------|
| **Cold** | App not in memory, device reboot | <1.5s | Framework loading, disk I/O |
| **Warm** | App terminated but frameworks cached | <1.0s | App initialization, main thread work |
| **Hot** | App suspended, returning to foreground | <0.5s | State restoration, view updates |
| **Push Launch** | Background → foreground via notification | <1.0s | Notification processing, deep link routing |

### Testing Each Launch Type

```bash
# Cold Launch Test
# 1. Restart device
# 2. Wait 30 seconds
# 3. Launch app with Instruments

# Warm Launch Test
# 1. Force-quit app (double-tap home, swipe up)
# 2. Wait 5 seconds
# 3. Launch app with Instruments

# Hot Launch Test
# 1. Background app (home button/gesture)
# 2. Immediately return to app
# 3. Measure with Instruments

# Push Notification Launch Test
# 1. Background app
# 2. Send push notification (via server or Simulator)
# 3. Tap notification to launch app
# 4. Measure with Instruments focused on notification response time
```

### Optimizing Each Launch Type

#### Cold Launch Optimization
Focus on pre-main and framework loading:
```swift
// Reduce dynamic framework count
// Use static linking where possible
// Defer heavy +load/static initialization

// Measure with App Launch Instrument pre-main phase
```

#### Warm Launch Optimization
Focus on main thread initialization:
```swift
// Optimize AppDelegate/App initializer
// Defer non-critical viewDidLoad work
// Use background queues for heavy lifting
```

#### Hot Launch Optimization
Focus on state restoration:
```swift
// Implement state restoration properly
// Use @SceneStorage for SwiftUI
// Optimize viewWillAppear/onAppear
```

#### Push Notification Launch Optimization
Focus on notification processing and deep link routing:
```swift
// Optimize notification payload processing
// Pre-cache deep link destinations
// Use background app refresh for state preparation
```

---

## Push Notification Launch Performance

Push notification launches have unique performance characteristics requiring specialized optimization. The user expects immediate response when tapping a notification.

### Push Notification Launch Flow

```
User taps notification → System wakes app → Process notification payload → Deep link navigation → Show relevant content
Target: <1.0s total (notification tap to content displayed)
```

### Notification Launch Types

| Scenario | App State | Performance Target | Key Optimization |
|----------|-----------|-------------------|------------------|
| **Background Active** | Running in background | <0.5s | Minimize payload processing |
| **Background Suspended** | Suspended, in memory | <0.8s | Quick state restoration |
| **Terminated** | Not running | <1.2s | Fast cold launch + notification |

### UNUserNotificationCenter Optimization

#### ❌ Problem: Heavy Processing in Notification Handlers
```objc
// Objective-C - Heavy synchronous work blocks notification response
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {

    // BAD: Heavy synchronous work blocks UI
    NSDictionary *payload = response.notification.request.content.userInfo;

    [self parseComplexPayload:payload];     // 100ms
    [self updateLocalDatabase:payload];     // 200ms
    [self refreshUserInterface];           // 150ms
    [self syncWithServer];                 // 300ms

    // Total: 750ms delay before completionHandler
    completionHandler();
}
```

```swift
// Swift - Same problem
func userNotificationCenter(_ center: UNUserNotificationCenter,
                          didReceive response: UNNotificationResponse,
                          withCompletionHandler completionHandler: @escaping () -> Void) {

    let payload = response.notification.request.content.userInfo

    // BAD: All synchronous work delays notification response
    parseComplexPayload(payload)     // 100ms
    updateLocalDatabase(payload)     // 200ms
    refreshUserInterface()           // 150ms
    syncWithServer()                 // 300ms

    completionHandler()
}
```

#### ✅ Solution: Defer Non-Critical Processing
```objc
// Objective-C - Optimized notification handling
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {

    NSDictionary *payload = response.notification.request.content.userInfo;

    // ONLY essential navigation on main thread
    [self navigateToNotificationContent:payload];  // <50ms

    // Complete immediately for fast user response
    completionHandler();

    // Defer heavy work to background
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        [self parseComplexPayload:payload];
        [self updateLocalDatabase:payload];
        [self syncWithServer];

        dispatch_async(dispatch_get_main_queue(), ^{
            [self refreshUserInterface];
        });
    });
}
```

```swift
// Swift - Optimized notification handling
func userNotificationCenter(_ center: UNUserNotificationCenter,
                          didReceive response: UNNotificationResponse,
                          withCompletionHandler completionHandler: @escaping () -> Void) {

    let payload = response.notification.request.content.userInfo

    // ONLY essential navigation on main thread
    navigateToNotificationContent(payload)  // <50ms

    // Complete immediately for fast user response
    completionHandler()

    // Defer heavy work
    Task.detached(priority: .high) {
        await parseComplexPayload(payload)
        await updateLocalDatabase(payload)
        await syncWithServer()

        await MainActor.run {
            refreshUserInterface()
        }
    }
}
```

### Deep Link Performance Optimization

#### ❌ Problem: Complex Deep Link Resolution
```swift
// BAD: Heavy synchronous deep link processing
func navigateToNotificationContent(_ payload: [AnyHashable: Any]) {
    guard let deepLinkURL = payload["deep_link"] as? String else { return }

    // BAD: Heavy processing blocks navigation
    let parsedComponents = parseComplexURL(deepLinkURL)     // 80ms
    let userPermissions = checkUserPermissions()           // 120ms
    let contentExists = validateContentExists(parsedComponents) // 100ms

    // Finally navigate after 300ms delay
    navigateToScreen(parsedComponents)
}
```

#### ✅ Solution: Pre-Cache and Optimize Deep Links
```swift
// GOOD: Fast deep link resolution with pre-caching
class DeepLinkManager {
    // Pre-cache common navigation paths
    private var navigationCache: [String: UIViewController] = [:]

    func navigateToNotificationContent(_ payload: [AnyHashable: Any]) {
        guard let deepLinkURL = payload["deep_link"] as? String else { return }

        // Fast navigation using cached paths
        if let cachedViewController = navigationCache[deepLinkURL] {
            navigateToScreen(cachedViewController)  // <10ms
            return
        }

        // For uncached paths, navigate to loading state immediately
        let loadingVC = LoadingViewController(deepLink: deepLinkURL)
        navigateToScreen(loadingVC)  // <20ms

        // Load actual content in background
        Task {
            let content = await resolveDeepLinkContent(deepLinkURL)
            await MainActor.run {
                loadingVC.showContent(content)
            }
        }
    }

    // Pre-warm common navigation paths during app launch
    func preWarmNavigationCache() {
        // Cache common notification destinations
        navigationCache["/messages"] = MessagesViewController()
        navigationCache["/profile"] = ProfileViewController()
        navigationCache["/orders"] = OrdersViewController()
    }
}
```

### SwiftUI Push Notification Optimization

#### ❌ Problem: Heavy SwiftUI State Updates
```swift
// BAD: Heavy state computation on notification
@main
struct MyApp: App {
    @StateObject private var notificationManager = NotificationManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onReceive(NotificationCenter.default.publisher(for: .didReceiveNotification)) { notification in

                    // BAD: Heavy state updates block UI
                    let payload = notification.userInfo
                    processComplexPayload(payload)  // 200ms
                    updateAllViewModels(payload)    // 150ms
                    refreshUserInterface()          // 100ms
                }
        }
    }
}
```

#### ✅ Solution: Minimal State Updates, Background Processing
```swift
// GOOD: Minimal immediate updates, background processing
@main
struct MyApp: App {
    @StateObject private var notificationManager = NotificationManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onReceive(NotificationCenter.default.publisher(for: .didReceiveNotification)) { notification in

                    // ONLY immediate navigation state update
                    notificationManager.handleNotificationNavigation(notification.userInfo)  // <50ms
                }
        }
    }
}

@MainActor
class NotificationManager: ObservableObject {
    @Published var currentNotificationContent: NotificationContent?

    func handleNotificationNavigation(_ payload: [AnyHashable: Any]) {
        // Immediate: Show loading state
        currentNotificationContent = NotificationContent.loading

        // Background: Process and update
        Task.detached(priority: .high) {
            let processedContent = await self.processNotificationPayload(payload)

            await MainActor.run {
                self.currentNotificationContent = processedContent
            }
        }
    }

    private func processNotificationPayload(_ payload: [AnyHashable: Any]) async -> NotificationContent {
        // Heavy processing moved to background
        await processComplexPayload(payload)
        await updateDataModels(payload)
        return await buildNotificationContent(payload)
    }
}
```

### Background App Refresh Integration

Pre-warm app state during background app refresh to improve notification response times:

#### ❌ Problem: Cold State on Notification
```swift
// BAD: App starts cold when notification arrives
func application(_ application: UIApplication, performBackgroundAppRefresh refreshTask: UIBackgroundTaskIdentifier) {
    // No preparation for potential notifications
    refreshTask.setTaskComplete()
}
```

#### ✅ Solution: Pre-Warm Critical State
```swift
// GOOD: Pre-warm state for faster notification response
func application(_ application: UIApplication, performBackgroundAppRefresh refreshTask: UIBackgroundTaskIdentifier) {

    // Pre-warm critical app components
    Task {
        // Pre-cache user data for faster notification processing
        await DataManager.shared.refreshUserData()

        // Pre-warm navigation destinations
        await DeepLinkManager.shared.preWarmNavigationCache()

        // Pre-load critical images/resources
        await ImageCache.shared.preloadCriticalImages()

        refreshTask.setTaskComplete()
    }
}

// UISceneDelegate equivalent for multi-scene apps
func sceneDidEnterBackground(_ scene: UIScene) {
    // Save state and pre-warm for notification responses
    Task {
        await StateManager.shared.saveCurrentState()
        await DataManager.shared.prefetchNotificationData()
    }
}
```

### Push Notification Profiling with App Launch Instrument

#### Measuring Notification Response Time
```bash
# 1. Launch Instruments with App Launch template
open -a Instruments

# 2. Configure for notification testing:
# - Enable "Extended Launch" to capture full flow
# - Add os_signpost instrument for custom metrics
# - Target real device (notification timing varies on simulator)

# 3. Record notification launch:
# - Start recording
# - Background your app
# - Send push notification (via server or Simulator → Device → Send Push Notification)
# - Tap notification immediately
# - Stop recording after app is fully interactive

# 4. Analyze timeline:
# - Notification tap to first pixel: Should be <200ms
# - Notification tap to interactive content: Should be <1000ms
# - Look for main thread blocking during notification processing
```

#### Custom Signposting for Notification Flow
```swift
import os

class NotificationProfiler {
    private let signposter = OSSignposter(subsystem: "com.app.notifications",
                                        category: "performance")
    private var notificationSignpost: OSSignpostID?

    func beginNotificationResponse() {
        notificationSignpost = signposter.makeSignpostID()
        signposter.beginInterval("NotificationResponse", id: notificationSignpost!)
    }

    func endNotificationResponse() {
        guard let signpost = notificationSignpost else { return }
        signposter.endInterval("NotificationResponse", id: signpost)
        notificationSignpost = nil
    }

    func markNotificationMilestone(_ milestone: String) {
        guard let signpost = notificationSignpost else { return }
        signposter.emitEvent("Milestone", id: signpost, "\(milestone)")
    }
}

// Usage in notification handler
func userNotificationCenter(_ center: UNUserNotificationCenter,
                          didReceive response: UNNotificationResponse,
                          withCompletionHandler completionHandler: @escaping () -> Void) {

    NotificationProfiler.shared.beginNotificationResponse()

    // Process notification...

    NotificationProfiler.shared.markNotificationMilestone("PayloadParsed")

    // Navigate to content...

    NotificationProfiler.shared.markNotificationMilestone("NavigationComplete")

    completionHandler()

    // When content is fully loaded
    NotificationProfiler.shared.endNotificationResponse()
}
```

### Testing Push Notification Performance

#### Automated Testing with XCTest
```swift
class PushNotificationPerformanceTests: XCTestCase {

    func testNotificationResponseTime() throws {
        let app = XCUIApplication()
        app.launch()

        // Background the app
        XCUIDevice.shared.press(.home)

        // Simulate notification arrival and tap
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

        measure(metrics: [XCTApplicationLaunchMetric()]) {
            // Tap notification banner (requires notification to be sent externally)
            let notificationBanner = springboard.otherElements["NotificationShortLookView"]
            if notificationBanner.waitForExistence(timeout: 5) {
                notificationBanner.tap()
            }

            // Wait for app to be interactive
            let keyElement = app.buttons["notificationActionButton"]
            XCTAssertTrue(keyElement.waitForExistence(timeout: 3))
        }
    }
}
```

#### Manual Testing Checklist
```bash
# Notification Response Performance Test

1. Background app (home gesture)
2. Send notification via:
   - Server API call
   - Simulator: Device → Send Push Notification
   - Physical device: Use push notification testing service

3. Time from notification tap to interactive content:
   ✓ <1.0s = Good
   ⚠ 1.0-2.0s = Needs optimization
   ❌ >2.0s = Poor user experience

4. Monitor with Instruments:
   - Main thread blocking during notification processing
   - Deep link resolution time
   - Content loading delays

5. Test different notification payloads:
   - Simple text notifications
   - Rich media notifications
   - Deep link notifications
   - Notifications with custom actions
```

---

## Production Launch Monitoring

### MetricKit Integration

```swift
import MetricKit

class LaunchMetricsManager: NSObject, MXMetricManagerSubscriber {
    override init() {
        super.init()
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            // App Launch Metrics
            if let launchData = payload.applicationLaunchMetrics {
                let launchTime = launchData.histogrammedTimeToFirstDrawKey

                // Track launch performance over time
                Analytics.track("app_launch_performance", properties: [
                    "launch_time_median": launchTime.buckets[launchTime.buckets.count/2],
                    "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
                ])

                // Alert on regression
                if launchTime.buckets.last ?? 0 > 2000 { // >2s launches
                    reportLaunchRegression(launchTime)
                }
            }

            // Background Launch Metrics
            if let bgLaunchData = payload.applicationResponsivenessMetrics {
                // Monitor background-to-foreground performance
            }
        }
    }

    private func reportLaunchRegression(_ launchTime: MXHistogram<UnitDuration>) {
        // Send to crash reporting / analytics
        // Alert engineering team
    }
}
```

### XCTest Launch Performance Tests

```swift
import XCTest

class LaunchPerformanceTests: XCTestCase {

    func testColdLaunchPerformance() throws {
        let app = XCUIApplication()

        measure(metrics: [XCTApplicationLaunchMetric()]) {
            app.launch()

            // Wait for key UI element to appear
            let mainButton = app.buttons["primaryAction"]
            XCTAssertTrue(mainButton.waitForExistence(timeout: 5))
        }
    }

    func testWarmLaunchPerformance() throws {
        let app = XCUIApplication()
        app.launch()
        app.terminate()

        // Small delay for warm launch conditions
        sleep(1)

        measure(metrics: [XCTApplicationLaunchMetric()]) {
            app.launch()

            let mainButton = app.buttons["primaryAction"]
            XCTAssertTrue(mainButton.waitForExistence(timeout: 3))
        }
    }

    func testCustomLaunchCompletion() throws {
        let app = XCUIApplication()

        measure(metrics: [XCTOSSignpostMetric(subsystem: "com.app.launch",
                                              category: "performance",
                                              name: "AppLaunch")]) {
            app.launch()

            // Wait for custom completion signal
            let readyIndicator = app.staticTexts["Ready"]
            XCTAssertTrue(readyIndicator.waitForExistence(timeout: 5))
        }
    }
}
```

---

## Common Launch Performance Mistakes

### ❌ Mistake 1: Testing Only in Simulator
**Problem**: Simulator has different performance characteristics
**Fix**: Always test on real device, preferably older hardware

### ❌ Mistake 2: Blocking Main Thread with Synchronous Work
**Problem**: Network calls, file I/O, heavy computation in main thread
**Fix**: Use async/await, GCD, or defer to background queues

### ❌ Mistake 3: Loading All Data at Launch
**Problem**: Trying to load entire dataset before showing UI
**Fix**: Show UI first, load data progressively

### ❌ Mistake 4: Heavy Static Initialization
**Problem**: Complex globals, +load methods, static initializers
**Fix**: Use lazy initialization, defer until first use

### ❌ Mistake 5: Too Many Dynamic Frameworks
**Problem**: Each framework adds ~50-100ms to pre-main
**Fix**: Consolidate frameworks, use static linking where possible

---

## Performance Baselines by Device

### iPhone Launch Time Targets

| Device Class | Cold Launch | Warm Launch | Hot Launch |
|--------------|-------------|-------------|------------|
| **iPhone 15 Pro** | <1.0s | <0.7s | <0.3s |
| **iPhone 14** | <1.2s | <0.8s | <0.4s |
| **iPhone 13** | <1.4s | <1.0s | <0.5s |
| **iPhone 12** | <1.6s | <1.2s | <0.6s |

### iPad Launch Time Targets

| Device Class | Cold Launch | Warm Launch | Hot Launch |
|--------------|-------------|-------------|------------|
| **iPad Pro M2** | <0.8s | <0.5s | <0.2s |
| **iPad Air** | <1.2s | <0.8s | <0.4s |
| **iPad (9th gen)** | <1.8s | <1.4s | <0.7s |

---

## Quick Reference Commands

### Instruments Launch Profiling
```bash
# Launch App Launch template
open -a Instruments

# Command line launch profiling (if available)
xcrun xctrace record --template "App Launch" --output launch.trace

# View results
xcrun xctrace view launch.trace
```

### Device Launch Testing
```bash
# Install app on device
xcodebuild install -scheme YourApp -destination 'generic/platform=iOS'

# Force quit app before testing
# Use physical device controls or:
xcrun devicectl device list devices
xcrun devicectl device process kill --device <device_id> com.your.bundleid
```

### Simulator Testing (Development Only)
```bash
# Boot clean simulator for consistent results
xcrun simctl boot "iPhone 15 Pro"
xcrun simctl uninstall booted com.your.bundleid
xcrun simctl install booted YourApp.app
xcrun simctl launch booted com.your.bundleid
```

---

## Resources

**WWDC Sessions**:
- WWDC 2019-423 (Optimizing App Launch)
- WWDC 2022-10056 (App Launch Best Practices)
- WWDC 2023-10181 (Analyze hang reports with performance tools)
- WWDC 2016-406 (Optimizing I/O for Performance and Battery Life)

**Apple Documentation**:
- [Technical Note TN2434: App Launch Performance](https://developer.apple.com/documentation/technotes/tn2434-app-launch-performance)
- [Instruments User Guide - App Launch](https://help.apple.com/instruments/mac/current/#/dev022f987b)
- [MetricKit Framework](https://developer.apple.com/documentation/metrickit)
- [OSSignposter](https://developer.apple.com/documentation/os/ossignposter)

**Related Skills**:
- `axiom-performance-profiling` (general Instruments usage)
- `axiom-memory-debugging` (launch memory issues)
- `axiom-swift-concurrency` (async optimization patterns)
- `axiom-energy` (launch battery impact)

---

**Targets:** iOS 15+, iPadOS 15+, macOS 12+
**Tools:** Instruments App Launch Template, Xcode, MetricKit
**Architectures:** UIKit (Objective-C/Swift), SwiftUI, Mixed Codebases