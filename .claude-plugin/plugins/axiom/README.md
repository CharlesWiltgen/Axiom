# Axiom

Apple-platform development expertise for your coding assistant: <!--ax:routers-->27<!--/ax--> skill routers over <!--ax:skills-->286<!--/ax--> skills, <!--ax:agents-->43<!--/ax--> agents, <!--ax:commands-->17<!--/ax--> commands, and its command-line tools. It works in Claude Code and the Claude app, and in Codex, Cursor, Pi and any MCP client.

## Install

**Claude Code**

```
/plugin marketplace add CharlesWiltgen/Axiom
```

Then open `/plugin`, search for "axiom", and install it.

**Claude app** – In your browser at claude.ai or in Claude Desktop, open **Customize > Plugins**, select **Add > Add marketplace**, enter `CharlesWiltgen/Axiom`, and add the **axiom** plugin.

**Codex, Cursor, Pi, Xcode and MCP clients** – See the [install guides](https://charleswiltgen.github.io/Axiom/start/).

## Skills

Ask your question; your assistant loads the router that matches it, and the router loads the specific skill. Each router covers one area:

<!-- AXIOM_README_ROUTERS_BEGIN -->
| Router | Use it when |
|--------|-------------|
| `axiom-accessibility` | Fixing or auditing ANY accessibility issue — VoiceOver, Dynamic Type, color contrast, touch targets, WCAG compliance, App Store accessibility review. |
| `axiom-ai` | Implementing, testing, or evaluating ANY Apple Intelligence, on-device AI, or speech-to-text feature. Covers Foundation Models, @Generable, LanguageModelSession, Tool protocol, eval suites, model-as-judge scoring, SpeechTranscriber, CoreML. |
| `axiom-apple-docs` | You need Apple's own documentation or a Swift compiler diagnostic explained rather than recalled. |
| `axiom-build` | ANY iOS or macOS build fails, a crash log needs diagnosing, a test run crashes, Xcode misbehaves, or an environment issue blocks work before code is the suspect. Covers build failures, dependency conflicts, simulator diagnostics. |
| `axiom-concurrency` | Writing ANY async code, actors, or threads in an Apple-platform app, or seeing ANY concurrency error. Covers Swift 6 concurrency, @MainActor, Sendable, data races, async/await patterns. |
| `axiom-data` | Working with ANY data persistence, database, storage, CloudKit, migration, or serialization in an Apple app. Covers SwiftData, Core Data, GRDB, SQLite, Realm, CloudKit sync, file storage, Codable, migrations. |
| `axiom-design` | Making visual or interaction design decisions for an Apple app — HIG patterns, Liquid Glass, SF Symbols, typography, app entry-point and auth-flow structure. |
| `axiom-games` | Building ANY 2D or 3D game with SpriteKit, SceneKit, or RealityKit, or adding touch controls or game controller support. Covers scene graphs, ECS, physics, actions, game loops, rendering, TouchController, GCController. |
| `axiom-graphics` | Working with ANY GPU rendering, Metal, OpenGL migration, shaders, 3D content, RealityKit, AR, USD/USDZ files, or display performance. Covers Metal migration, shader conversion, RealityKit ECS, RealityView, USDKit, ProMotion. |
| `axiom-health` | Working with HealthKit, WorkoutKit, health data, workouts, or fitness features on iOS or watchOS. Covers permissions, queries, background delivery, custom workouts, multidevice coordination. |
| `axiom-integration` | Work crosses into Apple's system surfaces rather than your own UI or data — Siri and Shortcuts, widgets, Live Activities, in-app purchase, localization, privacy prompts, alarms, timers, calendar, reminders, contacts, SharePlay, VoIP and CallKit, accessory pairing, weather, Spotlight indexing, background tasks, Background Assets, push, or push on networks with no internet. |
| `axiom-location` | Implementing location services, maps, geofencing, or debugging location/MapKit issues. Covers Core Location, CLMonitor, MapKit, annotations, directions. |
| `axiom-macos` | Building ANY macOS app — windows, menus, sandboxing, distribution, AppKit bridging or modernization (control events, state restoration, concentric corners), touch input, or macOS-specific SwiftUI patterns. |
| `axiom-media` | Working with camera, photos, audio, haptics, ShazamKit, on-device music analysis, face grouping and video highlights, screen recording, casting to non-AirPlay routes, SharePlay playback, the user's Apple Music library, lock-screen metadata, or CarPlay app design, templates, and navigation. Covers AVCaptureSession, AVFoundation, Core Haptics, MediaPlayer, MusicKit, NowPlaying, ScreenCaptureKit, DockKit. |
| `axiom-networking` | Implementing or debugging ANY network connection, API call, or socket in an Apple app. Covers URLSession, Network.framework, NetworkConnection, connection diagnostics. |
| `axiom-payments` | Accepting ANY real-world payment — Apple Pay, Wallet passes, Tap to Pay, Orders in Wallet. NOT in-app purchase / digital content (use axiom-integration). Covers entitlements, certs, signing, App Review payment rules. |
| `axiom-performance` | An Apple-platform app feels slow, memory grows, battery drains, or ANY performance issue needs diagnosing. Covers memory leaks, profiling, Instruments workflows, retain cycles, optimization. |
| `axiom-security` | Storing credentials securely, encrypting data, implementing passkeys, securing AI/agentic features against prompt injection, code signing, or managing certificates and provisioning profiles. |
| `axiom-shipping` | Preparing an app for App Store submission, handling rejections or appeals, managing App Store Connect and Xcode Cloud, or triaging TestFlight/Sentry crash corpora. Covers checklists, metadata, privacy manifests, age ratings, export compliance. |
| `axiom-swift` | The question is about Swift or its toolchain rather than a framework — modern idioms, noncopyable types, drag and drop, debug deep links, tvOS targets. |
| `axiom-swiftui` | Building, fixing, or improving ANY SwiftUI UI — views, navigation, layout, animations, gestures, debugging, iOS 26 features, iPhone Duo, view-level performance, feature architecture. |
| `axiom-testing` | Writing ANY test, debugging flaky tests, making tests faster, or choosing Swift Testing vs XCTest. Covers unit tests, UI tests, async testing, test architecture. |
| `axiom-tools` | Asking about Axiom skills or axbuild build/test capture, xclog console, xcsym .ips/MetricKit/.crash symbolication, xcui simulator UI/accessibility, or xcprof xctrace/CPU profiles. |
| `axiom-uikit` | Bridging UIKit and SwiftUI, modernizing UIKit apps (scene lifecycle, resizability), debugging Auto Layout, Combine, TextKit, PencilKit, or UIKit animations. |
| `axiom-vision` | Implementing ANY computer vision feature — image analysis, pose detection, person segmentation, subject lifting, text recognition, barcode scanning. |
| `axiom-watchos` | Building ANY watchOS app — app structure, independent apps, Watch Connectivity, Smart Stack widgets, complications, controls, RelevanceKit, background tasks, ClockKit migration. |
| `axiom-xcode-mcp` | Connecting to Xcode via MCP, using xcrun mcpbridge or the headless mcp-server, or working with ANY Xcode MCP tool (XcodeRead, BuildProject, RunSomeTests, RenderPreview). Covers setup, tool reference, workflows, troubleshooting. |
<!-- AXIOM_README_ROUTERS_END -->

## Commands

<!-- AXIOM_README_COMMANDS_BEGIN -->
| Command | What it does |
|---------|--------------|
| `/axiom:analyze-crash` | Parse and analyze iOS/macOS crash logs (.ips, .crash, or pasted text) to identify root cause |
| `/axiom:ask` | Ask a question about iOS/Swift development - routes to the right Axiom skill or agent |
| `/axiom:audit` | Smart audit selector - analyzes your project and suggests relevant audits |
| `/axiom:compare-traces` | Diff two performance traces for regressions with xcprof compare |
| `/axiom:console` | Capture iOS simulator console output (print + os_log) with xclog |
| `/axiom:fix-build` | Diagnose and fix Xcode build failures (launches build-fixer agent) |
| `/axiom:health-check` | Run a comprehensive health check — auto-detects relevant auditors, runs them in parallel, produces a unified report |
| `/axiom:modernize` | Migrate legacy iOS patterns to modern equivalents (launches modernization-helper agent) |
| `/axiom:optimize-build` | Scan Xcode project for build performance optimizations (launches build-optimizer agent) |
| `/axiom:profile` | Run automated performance profiling via xcprof (launches performance-profiler agent) |
| `/axiom:resolve-deps` | Diagnose and resolve Swift Package Manager dependency conflicts (launches spm-conflict-resolver agent) |
| `/axiom:run-tests` | Run XCUITests and parse results using the test-runner agent |
| `/axiom:screenshot` | Capture screenshot from a booted iOS Simulator |
| `/axiom:status` | Project health dashboard - shows environment status and suggests improvements |
| `/axiom:test-simulator` | Launch simulator testing agent for test scenarios and visual verification |
| `/axiom:triage` | Triage a corpus of production crashes/hangs from Sentry or App Store Connect — classify, cluster into families, and flag suspension/idle-runloop false-positives |
| `/axiom:ui` | Drive and validate the iOS simulator UI and accessibility with xcui |
<!-- AXIOM_README_COMMANDS_END -->

## Agents

<!--ax:agents-->43<!--/ax--> agents run audits and fixes in their own context: memory leaks, concurrency, accessibility, build failures, crash analysis and more. The commands above launch the common ones, and you can ask for any of them by describing the task. See the [agent list](https://charleswiltgen.github.io/Axiom/agents/).

## Hooks

| When | What Axiom does |
|------|-----------------|
| A session starts | Adds Apple-platform context (the Xcode and SDK you've switched to, and how to find Axiom's skills) in Apple projects, and puts the bundled tools on your `PATH` |
| You send a prompt | Suggests the Axiom skill that matches it |
| A subagent starts | Gives it the same skill routing and version facts |
| Your assistant reads a crash file | Routes `.ips` and `.crash` files to `xcsym` |
| A shell command finishes | Points to the relevant skill after build or test output |
| Your assistant writes Swift | Flags risky patterns as they're written, such as a `@State` property without an access level |

Outside Apple projects, the hooks stay silent apart from the `PATH` change. Set `AXIOM_SESSION_CONTEXT=always` or `never` to override the detection.

## Tools

| Tool | What it does |
|------|--------------|
| `axbuild` | Runs `xcodebuild`, `swift build` or `swift test` and returns a short JSON summary of errors and failed tests, saving the full log and report |
| `xcproject` | Inspects Xcode project structure and captured build settings without modifying the project |
| `xclog` | Captures simulator and device console output (`print`, `os_log`, `Logger`) as structured JSON |
| `xcprof` | Records and analyzes Instruments traces, attributing CPU work to your code |
| `xcsym` | Symbolicates and triages crash reports (`.ips`, MetricKit, `.crash`, `.xccrashpoint`) with automatic dSYM discovery |
| `xcui` | Drives and checks the simulator UI and accessibility tree: waits, assertions, accessibility settings, system dialogs, VoiceOver |

The tools are macOS programs for Apple Silicon. See [Tools](https://charleswiltgen.github.io/Axiom/tools/).

## Documentation

- [Documentation site](https://charleswiltgen.github.io/Axiom/)
- [Report an issue](https://github.com/CharlesWiltgen/Axiom/issues)
- [Discussions](https://github.com/CharlesWiltgen/Axiom/discussions)

## License

MIT
