"""Offline tests for the user-prompt-submit hook.

Run with:
    python3 -m unittest hooks/user-prompt-submit_test.py

The hook is a standalone Python script that reads a JSON payload from stdin
and writes a JSON response to stdout. Each test feeds a payload and inspects
the returned router matches.

Coverage strategy:
- One positive case per router (26 routers — must cover all)
- Negative cases for known false-positive traps (host-OS mentions, non-iOS prompts)
- The original watchOS-demo prompt that motivated the hook fix
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unittest

HOOK = os.path.join(os.path.dirname(__file__), "user-prompt-submit.py")


def run_hook(prompt: str) -> dict:
    """Invoke the hook with the given prompt, return the parsed output.

    Returns {} if the hook emitted no match.
    """
    # Production (hooks.json) invokes the hook as `python3 "<path>"`; tests use
    # sys.executable instead so the suite runs under whatever interpreter is
    # running it (venvs, CI images where `python3` is absent or shadowed). Both
    # resolve to a Python 3 — the hook only uses stdlib, so the choice is moot
    # for behavior; sys.executable is just the more robust spawn target here.
    result = subprocess.run(
        [sys.executable, HOOK],
        input=json.dumps({"prompt": prompt}),
        capture_output=True,
        text=True,
        timeout=5,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"hook exited {result.returncode}: stderr={result.stderr!r}"
        )
    out = result.stdout.strip() or "{}"
    return json.loads(out)


def routed_skills(prompt: str) -> set[str]:
    """Return the set of router skill names matched for this prompt."""
    payload = run_hook(prompt)
    ctx = payload.get("hookSpecificOutput", {}).get("additionalContext", "")
    # Skills appear as `axiom-name` (backtick-wrapped) in the context string
    return set(re.findall(r"`(axiom-[a-z-]+)`", ctx))


class TestPositiveRouting(unittest.TestCase):
    """Each router must fire for at least one representative prompt."""

    def test_build(self):
        self.assertIn("axiom-build", routed_skills(
            "My Xcode build is failing with linker errors"))

    def test_build_device_deployment(self):
        # Regression: device-deployment vocabulary must route to build
        self.assertIn("axiom-build", routed_skills(
            "transport error when trying to connect to the watch"))

    def test_build_coredevice(self):
        self.assertIn("axiom-build", routed_skills(
            "I disabled DVTEnableCoreDevice and Xcode still fails"))

    def test_swiftui(self):
        self.assertIn("axiom-swiftui", routed_skills(
            "My SwiftUI @State view won't update"))

    def test_ai_speech_transcription(self):
        # REGRESSION GUARD. The OS27 Speech delta was folded into ios-ml.md while the hook's
        # only speech regex required the literal token `speech` + recogni/analyz/to-text — so
        # `SpeechTranscriber` did not match its own router row, and 7 of these 8 prompts were
        # NO MATCH. The content shipped behind a shut door. Do not narrow this without a
        # replacement path from these phrasings to axiom-ai.
        for prompt in [
            "transcribe microphone audio to text",
            "how do I use SpeechTranscriber",
            "add live transcription to my app",
            "dictation in my app",
            "SpeechAnalyzer throws insufficientResources",
            "CaptureInputSequenceProvider reconfigures my audio session",
            "my AVAudioSession breaks after adding transcription",
            "AssetInventory locale download for transcription",
            "SpeechAnalyzer Options ignoresResourceLimits",
            "cannotConfigureAudioSystem error",
            "AnalyzerInputConverter for mic buffers",
        ]:
            self.assertIn("axiom-ai", routed_skills(prompt),
                          f"expected axiom-ai for: {prompt!r}")

    def test_swiftui_previews_slow(self):
        for prompt in [
            "My SwiftUI previews take 30 seconds to load",
            "Why are my previews so slow?",
            "Preview takes forever to compile",
            "SwiftUI preview hangs and never finishes",
        ]:
            self.assertIn("axiom-swiftui", routed_skills(prompt),
                          f"expected axiom-swiftui for: {prompt!r}")

    def test_swiftui_previews_api(self):
        for prompt in [
            "How do I use @Previewable @State in a preview?",
            "What is PreviewModifier and makeSharedContext?",
            "How do I write a #Preview macro with traits?",
            "Variant Mode in the preview canvas",
            "Using .sizeThatFitsLayout in #Preview traits",
        ]:
            self.assertIn("axiom-swiftui", routed_skills(prompt),
                          f"expected axiom-swiftui for: {prompt!r}")

    def test_swiftui_previews_perf_patterns(self):
        for prompt in [
            "Should I guard SDK init with XCODE_RUNNING_FOR_PREVIEWS?",
            "Set up Development Assets for my previews",
            "Pin the preview canvas while editing child views",
        ]:
            self.assertIn("axiom-swiftui", routed_skills(prompt),
                          f"expected axiom-swiftui for: {prompt!r}")

    def test_data(self):
        self.assertIn("axiom-data", routed_skills(
            "How do I migrate my SwiftData @Model schema?"))

    def test_concurrency(self):
        self.assertIn("axiom-concurrency", routed_skills(
            "Getting actor-isolated errors with @MainActor in Swift 6"))

    def test_concurrency_runtime_isolation_crash(self):
        # Warning-free build that crashes in production with the runtime guard
        for sig in [
            "production crash _dispatch_assert_queue_fail at context.perform",
            "TestFlight crash _swift_task_checkIsolatedSwift on @MainActor delegate",
            "isolation inheritance question — why does my closure capture @MainActor?",
        ]:
            self.assertIn("axiom-concurrency", routed_skills(sig),
                          f"expected axiom-concurrency for: {sig!r}")

    def test_concurrency_cross_context_threading_error(self):
        # Core Data / SwiftData cross-context errors are fundamentally isolation bugs;
        # they must cross-fire axiom-data AND axiom-concurrency so users get both
        # the persistence-layer fix and the threading rationale.
        result = routed_skills(
            "When a background notification arrives, my app tries to update SwiftData "
            "and crashes with 'Illegal attempt to establish a relationship between "
            "objects in different contexts.'")
        self.assertIn("axiom-data", result)
        self.assertIn("axiom-concurrency", result)

    def test_performance(self):
        self.assertIn("axiom-performance", routed_skills(
            "I have a memory leak and retain cycle in my app"))

    def test_performance_app_launch(self):
        self.assertIn("axiom-performance", routed_skills(
            "My app launch time is slow, how do I reduce pre-main / dyld time?"))
        self.assertIn("axiom-performance", routed_skills(
            "Xcode Organizer says my launch regressed and the first frame is slow"))
        self.assertIn("axiom-performance", routed_skills(
            "App is sluggish on startup after tapping a push notification"))
        self.assertIn("axiom-performance", routed_skills(
            "How do I write an XCTApplicationLaunchMetric test?"))

    def test_performance_metrickit(self):
        self.assertIn("axiom-performance", routed_skills(
            "How do I set up MetricKit in my app?"))
        self.assertIn("axiom-performance", routed_skills(
            "Migrate from MXMetricManager to the new MetricManager API"))
        self.assertIn("axiom-performance", routed_skills(
            "How do I parse MXMetricPayload and MXDiagnosticPayload?"))
        self.assertIn("axiom-performance", routed_skills(
            "How do I use the StateReporting framework for per-state metrics?"))
        self.assertIn("axiom-performance", routed_skills(
            "Can I attach a ReportableMetadata struct to my state transitions?"))
        self.assertIn("axiom-performance", routed_skills(
            "How does state reporting work with my app's metrics?"))

    def test_performance_instruments27(self):
        self.assertIn("axiom-performance", routed_skills(
            "How do I use Top Functions in Instruments to find scattered overhead?"))
        self.assertIn("axiom-performance", routed_skills(
            "How do I verify my fix with a run comparison between two Instruments traces?"))
        # Bare "top functions" without instruments/profiling context must NOT route
        self.assertNotIn("axiom-performance", routed_skills(
            "List the top functions in this Python file by line count"))
        # Generic web state-reporting prose must NOT route
        self.assertNotIn("axiom-performance", routed_skills(
            "How should state reporting work in my React Redux store?"))

    def test_networking(self):
        self.assertIn("axiom-networking", routed_skills(
            "How do I use URLSession with async/await?"))

    def test_testing(self):
        self.assertIn("axiom-testing", routed_skills(
            "My XCUITest is flaky and slow"))

    def test_integration(self):
        self.assertIn("axiom-integration", routed_skills(
            "How do I add a WidgetKit timeline to my app?"))
        self.assertIn("axiom-integration", routed_skills(
            "How do I update my Live Activity with a broadcast push?"))
        self.assertIn("axiom-integration", routed_skills(
            "How do I pair a Bluetooth accessory with AccessorySetupKit?"))
        self.assertIn("axiom-integration", routed_skills(
            "How do I show a forecast with WeatherKit and handle attribution?"))
        self.assertIn("axiom-integration", routed_skills(
            "My VoIP app gets killed — how do I report a CallKit call from a PushKit push?"))

    def test_media(self):
        self.assertIn("axiom-media", routed_skills(
            "How do I use AVCaptureSession for camera preview?"))
        self.assertIn("axiom-media", routed_skills(
            "How do I track a subject with a DockKit motorized stand?"))
        self.assertIn("axiom-media", routed_skills(
            "My camera app launches slowly — the preview takes forever to appear"))
        self.assertIn("axiom-media", routed_skills(
            "How do I support the Center Stage front camera in my iOS app?"))
        self.assertIn("axiom-media", routed_skills(
            "My ProRes recording drops frames"))
        self.assertIn("axiom-media", routed_skills(
            "Should I adopt deferred start for high resolution photo capture?"))
        self.assertIn("axiom-media", routed_skills(
            "How do I show a CarPlay map panel for route choices on iOS 27?"))
        self.assertIn("axiom-media", routed_skills(
            "Set allowsMiniPlayer to false on my CarPlay Now Playing template"))

    def test_accessibility(self):
        self.assertIn("axiom-accessibility", routed_skills(
            "My VoiceOver labels are missing and Dynamic Type breaks"))

    def test_ai(self):
        self.assertIn("axiom-ai", routed_skills(
            "How do I use Foundation Models with @Generable?"))
        self.assertIn("axiom-ai", routed_skills(
            "How do I check Private Cloud Compute quota usage?"))
        # PCC on the watch routes to BOTH owning suites
        self.assertIn("axiom-watchos", routed_skills(
            "Private Cloud Compute quota handling on Apple Watch"))

    def test_ai_evaluations(self):
        for prompt in (
            "How do I know if my prompt change actually improved the summarizer?",
            "Write an eval suite for my AI feature",
            "Set up a model-as-judge evaluator",
            "My agent calls the wrong tools, how do I evaluate the trajectory?",
            "import Evaluations",
            "My eval scores swing between runs — is that judge drift?",
        ):
            self.assertIn("axiom-ai", routed_skills(prompt), prompt)

    def test_ai_evaluations_diagnostics(self):
        for prompt in (
            "My eval metric returns -1, what does that mean?",
            "Our pass rate went up when we added harder test cases",
            "aggregateValue is giving me weird numbers",
            "What is SubjectInferenceError?",
            "I'm getting EvaluationError.missingTranscript",
            "Cohen's kappa came back negative",
            "Should I use greedy sampling for a stable eval?",
        ):
            self.assertIn("axiom-ai", routed_skills(prompt), prompt)

    def test_vision(self):
        self.assertIn("axiom-vision", routed_skills(
            "How do I use Vision framework for text recognition?"))

    def test_shipping_os27(self):
        self.assertIn("axiom-shipping", routed_skills(
            "How do I set up Retention Messaging for my subscription?"))
        self.assertIn("axiom-shipping", routed_skills(
            "Add a Product Page Header video for my app"))
        self.assertIn("axiom-shipping", routed_skills(
            "Submit creative assets through the Asset Library in App Store Connect"))
        self.assertIn("axiom-shipping", routed_skills(
            "Sell my subscription to organizations with volume pricing"))
        self.assertIn("axiom-shipping", routed_skills(
            "Pass the seat count into the StoreKit purchase request"))
        # a Unity-style asset library prompt must not route to shipping
        self.assertNotIn("axiom-shipping", routed_skills(
            "Import models from the Unity asset library into my game"))
        # seat-map app features must not route to shipping
        self.assertNotIn("axiom-shipping", routed_skills(
            "Build a seat assignment feature for my event booking app"))
        self.assertNotIn("axiom-shipping", routed_skills(
            "Export creative assets from Photoshop for the website redesign"))
        # subscription group is an IAP concept — must reach integration
        self.assertIn("axiom-integration", routed_skills(
            "How should I structure my subscription group architecture?"))

    def test_payments_os27(self):
        self.assertIn("axiom-payments", routed_skills(
            "How do I adopt the posterGeneric pass style?"))
        self.assertIn("axiom-payments", routed_skills(
            "Add featured actions to my Wallet pass"))
        self.assertIn("axiom-payments", routed_skills(
            "Render a Codabar barcode on my loyalty card"))
        self.assertIn("axiom-payments", routed_skills(
            "Use CustomerEngagementSession to pair with the customer's iPhone"))
        self.assertIn("axiom-payments", routed_skills(
            "Sign passes on Linux with the buildpass CLI"))
        # generic "featured actions" without pass context must not route
        self.assertNotIn("axiom-payments", routed_skills(
            "Add featured actions to my app's home screen widget"))

    def test_integration_os27(self):
        self.assertIn("axiom-integration", routed_skills(
            "How do I use SpotlightSearchTool with my LanguageModelSession?"))
        self.assertIn("axiom-integration", routed_skills(
            "Add a language tag to my asset pack manifest for localized delivery"))
        self.assertIn("axiom-integration", routed_skills(
            "Convert my Steam depots with xcrun ba-package convert"))
        self.assertIn("axiom-integration", routed_skills(
            "Merchandise the monthly subscription with a 12-month commitment"))
        self.assertIn("axiom-integration", routed_skills(
            "offerCodeRedemption now returns a verificationResult?"))
        self.assertIn("axiom-integration", routed_skills(
            "Let users redeem an offer code inside my app"))
        self.assertIn("axiom-integration", routed_skills(
            "Migrate from On-Demand Resources to Background Assets"))
        self.assertIn("axiom-integration", routed_skills(
            "Check PricingTerms for the billingPlanType before purchase"))
        self.assertIn("axiom-integration", routed_skills(
            "Show retention messaging when users cancel their subscription"))
        self.assertIn("axiom-integration", routed_skills(
            "Measure the distance to my paired accessory with Bluetooth Channel Sounding"))
        self.assertIn("axiom-integration", routed_skills(
            "How do I call startChannelSoundingSession on a CBPeripheral?"))
        # audio "channel" prose must not trip the channel-sounding token
        self.assertNotIn("axiom-integration", routed_skills(
            "Mix the left and right channel sounding too quiet in my audio export"))
        # SaaS billing-plan design without subscription/IAP context must not route
        self.assertNotIn("axiom-integration", routed_skills(
            "Design the billing plan comparison table for our SaaS pricing site in React"))
        # web asset prompts must not route to integration
        self.assertNotIn("axiom-integration", routed_skills(
            "Preload the website's background assets with a webpack plugin"))
        # marketing offer-code prompt without redemption context must not route
        self.assertNotIn("axiom-integration", routed_skills(
            "Write email copy announcing the offer code for our spring sale"))
        # verifier-probed FP families (non-Apple game stacks, cloud, e-commerce, email marketing)
        self.assertNotIn("axiom-integration", routed_skills(
            "How do I structure asset packs for my Unreal Engine game on Steam Deck?"))
        self.assertNotIn("axiom-integration", routed_skills(
            "Move our VM images to on-demand resources in the cloud to cut costs"))
        self.assertNotIn("axiom-integration", routed_skills(
            "Add a retention message to our email drip campaign"))
        self.assertNotIn("axiom-shipping", routed_skills(
            "Add a retention message to our email drip campaign"))
        self.assertNotIn("axiom-shipping", routed_skills(
            "Set up volume pricing for our B2B SaaS plans"))
        self.assertNotIn("axiom-integration", routed_skills(
            "Customers redeem an offer code at checkout on our Shopify store"))

    def test_location_os27(self):
        self.assertIn("axiom-location", routed_skills(
            "How do I reference compass heading to my map view with headingBody?"))
        self.assertIn("axiom-location", routed_skills(
            "headingOrientation is deprecated, what replaces it?"))
        self.assertIn("axiom-location", routed_skills(
            "Filter search results with MKPointOfInterestFilter to scenic views"))
        # markdown/HTML "heading body" prose must not route to location
        self.assertNotIn("axiom-location", routed_skills(
            "Fix the heading body spacing in my markdown document"))
        self.assertNotIn("axiom-location", routed_skills(
            "Rotate the column heading orientation in my HTML table"))

    def test_crash_reporter_extension(self):
        self.assertIn("axiom-performance", routed_skills(
            "How do I build a crash reporter extension with CrashReportExtension?"))
        self.assertIn("axiom-performance", routed_skills(
            "Symbolicate addresses from a CrashedProcess in my crash extension"))
        self.assertIn("axiom-performance", routed_skills(
            "How do I build a crash reporting extension for my iOS app?"))

    def test_accessibility_os27(self):
        self.assertIn("axiom-accessibility", routed_skills(
            "Prepare my tvOS app for Larger Text"))
        self.assertIn("axiom-accessibility", routed_skills(
            "Speak Screen stops reading at the end of each page in my book app"))
        self.assertIn("axiom-accessibility", routed_skills(
            "How do I declare Accessibility Nutrition Labels?"))
        self.assertIn("axiom-accessibility", routed_skills(
            "Should my custom control use direct touch or custom actions?"))
        # plain nutrition labels (privacy/food) must not route to accessibility
        self.assertNotIn("axiom-accessibility", routed_skills(
            "Add a nutrition label scanner to my recipe app"))
        # "redirect touch events" must not match \bdirect\s*touch
        self.assertNotIn("axiom-accessibility", routed_skills(
            "Redirect touch events to the underlying view in UIKit"))

    def test_accessibility_captions(self):
        self.assertIn("axiom-accessibility", routed_skills(
            "How do I add subtitle style preview to my video player?"))
        self.assertIn("axiom-accessibility", routed_skills(
            "Let users change caption styling while watching a video"))
        self.assertIn("axiom-accessibility", routed_skills(
            "How do generated subtitles work during AVPlayer playback?"))
        # natural phrasings that miss a bare "subtitle styl" token: font/color intent,
        # verb-first word order with video context, and Apple's "caption appearance" term
        self.assertIn("axiom-accessibility", routed_skills(
            "How do I change subtitle font and color?"))
        self.assertIn("axiom-accessibility", routed_skills(
            "How do I style subtitles in my video player?"))
        self.assertIn("axiom-accessibility", routed_skills(
            "Customize caption appearance on iOS 27"))
        # reversed order ("style the subtitle label", no video/caption-styling context)
        # must NOT match — it's a UIKit label named "subtitle", not media captions
        self.assertNotIn("axiom-accessibility", routed_skills(
            "How do I style the subtitle label in my table row?"))

    def test_games(self):
        self.assertIn("axiom-games", routed_skills(
            "My SpriteKit SKScene physics aren't working"))

    def test_game_input(self):
        self.assertIn("axiom-games", routed_skills(
            "Add touch controls with TCTouchController to my iPhone game"))
        self.assertIn("axiom-games", routed_skills(
            "I'm porting my game to iPhone and need touch controls"))
        self.assertIn("axiom-games", routed_skills(
            "My game controller isn't detected over Bluetooth"))
        self.assertIn("axiom-games", routed_skills(
            "Read thumbstick values from GCController extendedGamepad"))
        self.assertIn("axiom-games", routed_skills(
            "Let players remap the controller home button long press"))
        self.assertIn("axiom-games", routed_skills(
            "Track a spatial accessory with GCSpatialAccessory on visionOS"))
        # bare "touch controls" without game context must not route to games
        self.assertNotIn("axiom-games", routed_skills(
            "Custom touch controls for my video player scrubber"))
        self.assertNotIn("axiom-games", routed_skills(
            "Improve touch controls in my drawing canvas app"))

    def test_graphics(self):
        self.assertIn("axiom-graphics", routed_skills(
            "How do I migrate from OpenGL to Metal shaders?"))

    def test_graphics_os27(self):
        self.assertIn("axiom-graphics", routed_skills(
            "How do I open and edit a USD file in Swift with USDKit?"))
        self.assertIn("axiom-graphics", routed_skills(
            "How do I shrink my USDZ assets for delivery?"))
        self.assertIn("axiom-graphics", routed_skills(
            "Add a navigation mesh for NPC pathfinding"))
        self.assertIn("axiom-graphics", routed_skills(
            "Collect a metalperftrace overview of my game session"))
        self.assertIn("axiom-graphics", routed_skills(
            "Render gaussian splats on Vision Pro"))
        self.assertIn("axiom-graphics", routed_skills(
            "My RealityKit entity casts hard shadows despite lightSize"))
        # currency mentions of USD must not route to graphics
        self.assertNotIn("axiom-graphics", routed_skills(
            "What's the USD price tier for my in-app purchase?"))
        self.assertNotIn("axiom-graphics", routed_skills(
            "Convert the checkout total to USD in my React storefront"))

    def test_shipping(self):
        self.assertIn("axiom-shipping", routed_skills(
            "My app store submission was rejected for privacy manifest"))
        self.assertIn("axiom-shipping", routed_skills(
            "How do I add an App Clip and what's the size limit?"))

    def test_macos(self):
        # Must require intent-qualifier; bare "macos" alone must NOT fire
        self.assertIn("axiom-macos", routed_skills(
            "How do I build a Mac app with NSToolbar and sandboxing?"))
        self.assertIn("axiom-macos", routed_skills(
            "How do I capture a window with ScreenCaptureKit and SCStream?"))
        self.assertIn("axiom-macos", routed_skills(
            "How do I modernize my AppKit app's mouseDown handling?"))
        self.assertIn("axiom-macos", routed_skills(
            "My status item shows a custom window — how do I handle keyboard focus?"))
        self.assertIn("axiom-macos", routed_skills(
            "How do I make my view's corners concentric with the window?"))
        self.assertIn("axiom-macos", routed_skills(
            "Add a SwiftUI menu to the main menu with NSHostingMenu"))
        # Concentric corners is cross-platform (UICornerConfiguration on iOS 26) —
        # iOS-flavored prompts must NOT single-match axiom-macos
        self.assertIn("axiom-design", routed_skills(
            "How do I make concentric corners on my card view?"))
        self.assertIn("axiom-uikit", routed_skills(
            "How do I use cornerConfiguration to round my collection view cells on iOS 26?"))
        # "status item" alone must not fire macos on iOS prompts
        self.assertNotIn("axiom-macos", routed_skills(
            "Show a connection status item in my iPhone app's nav bar"))

    def test_design(self):
        self.assertIn("axiom-design", routed_skills(
            "How do I apply Liquid Glass and SF Symbol effects?"))

    def test_uikit(self):
        self.assertIn("axiom-uikit", routed_skills(
            "How do I bridge UIViewController to SwiftUI with UIViewRepresentable?"))
        self.assertIn("axiom-uikit", routed_skills(
            "How do I add a PencilKit canvas with PKToolPicker and persist the PKDrawing?"))
        self.assertIn("axiom-uikit", routed_skills(
            "How do I handle Apple Pencil Pro barrel roll and squeeze in my drawing app?"))

    def test_swift(self):
        self.assertIn("axiom-swift", routed_skills(
            "How do I use noncopyable types and consuming func?"))

    def test_location(self):
        self.assertIn("axiom-location", routed_skills(
            "How do I use CLMonitor for geofencing with MapKit?"))

    def test_security(self):
        self.assertIn("axiom-security", routed_skills(
            "How do I store credentials in Keychain with passkey auth?"))

    def test_security_agentic(self):
        self.assertIn("axiom-security", routed_skills(
            "How do I protect my app's AI agent from prompt injection?"))

    def test_security_agentic_lock_screen(self):
        self.assertIn("axiom-security", routed_skills(
            "Should my lock screen Siri intent require authentication?"))

    def test_apple_docs(self):
        self.assertIn("axiom-apple-docs", routed_skills(
            "Does iOS 26 exist? What WWDC 2025 sessions cover this?"))

    def test_xcode_mcp(self):
        self.assertIn("axiom-xcode-mcp", routed_skills(
            "How do I set up Xcode MCP with xcrun mcpbridge?"))

    def test_tools_device_control(self):
        # Device Hub / devicectl — Xcode-independent device control lives in axiom-tools
        self.assertIn("axiom-tools", routed_skills(
            "How do I control the simulator with devicectl without Xcode running?"))
        self.assertIn("axiom-tools", routed_skills(
            "What is Device Hub in Xcode 27?"))

    def test_watchos(self):
        # Regression: this router was completely missing from the hook
        self.assertIn("axiom-watchos", routed_skills(
            "How do I add a complication to my Smart Stack widget?"))

    def test_watchos_apple_watch_phrasing(self):
        self.assertIn("axiom-watchos", routed_skills(
            "Deploying my app to Apple Watch SE on watchOS 10.6"))

    def test_watchos_complications_plural(self):
        # Regression: \bcomplication\b doesn't match "complications" plural
        self.assertIn("axiom-watchos", routed_skills(
            "How do I update my watch complications?"))

    def test_health(self):
        # Regression: this router was completely missing from the hook
        self.assertIn("axiom-health", routed_skills(
            "How do I read HKWorkout samples from HealthKit?"))

    def test_payments(self):
        # Regression: this router was completely missing from the hook
        self.assertIn("axiom-payments", routed_skills(
            "How do I integrate Apple Pay with PKPaymentAuthorizationController?"))

    def test_data_ckerror_partial_failure(self):
        # CKError/CKShare are CloudKit data-layer; surfaced by 2026-05-14 stress test
        self.assertIn("axiom-data", routed_skills(
            "I'm getting CKErrorPartialFailure when syncing CKShare records"))
        self.assertIn("axiom-data", routed_skills(
            "CKDatabase save returned an error — CKContainer setup looks right"))

    def test_build_device_only_crash(self):
        # Device-vs-simulator divergence routes to axiom-build (env first).
        # The two canonical phrasings cover both word orders surfaced in routing
        # tests — "only on device" and "works in simulator, fails on device".
        self.assertIn("axiom-build", routed_skills(
            "Crashes only on real device — works in simulator"))
        self.assertIn("axiom-build", routed_skills(
            "Works in simulator, fails on device with a black-frame crash"))

    def test_build_cannot_find_symbol(self):
        # Linker / compile-time symbol errors are environment-first
        self.assertIn("axiom-build", routed_skills(
            "Tests fail with 'cannot find symbol' after I added a Swift Package"))
        self.assertIn("axiom-build", routed_skills(
            "Compiler says use of unresolved identifier 'Logger'"))

    def test_build_after_xcode_update(self):
        # "After updating Xcode X.Y" is an env-first signal
        self.assertIn("axiom-build", routed_skills(
            "After updating Xcode 26.1, all my tests fail to build"))

    def test_concurrency_swift6_concurrent_attribute(self):
        # Swift 6.2 introduced @concurrent — must route concurrency, not just build
        skills = routed_skills(
            "Why does code that uses @concurrent stop compiling under Swift 6?")
        self.assertIn("axiom-concurrency", skills)

    def test_concurrency_ui_freeze_long_async(self):
        # "freezes the UI when I call X" is main-thread blocking — concurrency
        skills = routed_skills(
            "My API call freezes the UI when the response is large")
        self.assertIn("axiom-concurrency", skills)

    def test_performance_framerate_drop(self):
        # FPS drops are performance signals across games, capture, SwiftUI
        self.assertIn("axiom-performance", routed_skills(
            "My scene drops to 30fps on iPhone 13 mini"))
        self.assertIn("axiom-performance", routed_skills(
            "Frame rate drops below 60fps after a few minutes"))

    def test_integration_widgetcenter(self):
        # WidgetCenter is the public WidgetKit refresh API
        self.assertIn("axiom-integration", routed_skills(
            "WidgetCenter.shared.reloadAllTimelines() doesn't refresh my widget"))

    def test_vision_vndetect_specific_request(self):
        # Specific VN* request types must route Vision, not just "vnrequest" generic
        self.assertIn("axiom-vision", routed_skills(
            "VNDetectFaceRectanglesRequest fires but returns no observations"))
        self.assertIn("axiom-vision", routed_skills(
            "Running VNRecognizeTextRequest in batch is slow"))

    def test_health_hkobserverquery(self):
        # HKObserverQuery wasn't covered by `hkquery` (no substring match)
        self.assertIn("axiom-health", routed_skills(
            "HKObserverQuery's update handler fires off-main"))

    def test_design_glass_effect(self):
        # Liquid Glass is also called "glass-effect" in casual usage
        self.assertIn("axiom-design", routed_skills(
            "My glass-effect button doesn't tint with my accent color"))


class TestNegativeRouting(unittest.TestCase):
    """Known false-positive traps must NOT trigger."""

    def test_generic_transcription_wording_does_not_fire_ai(self):
        # REGRESSION GUARD. "transcribe"/"transcription"/"dictation" are ordinary English words,
        # not Apple API tokens. The Speech block originally shipped them UNGATED — the only
        # generic-term rule in the hook not behind `not non_ios` — so every one of these pure
        # non-iOS prompts routed to axiom-ai. The first version of this test used prompts with no
        # speech vocabulary at all, so it passed green while the bug shipped: a negative test that
        # cannot fail is worse than none. These prompts must stay able to catch it.
        for prompt in (
            "How do I transcribe audio with Whisper in Python?",
            "Add dictation to our React web app",
            "Our Django backend does transcription with ffmpeg",
            "The interview transcription tool in our Rails app is slow",
            "Build a meeting transcription feature backed by our Node.js server",
        ):
            self.assertNotIn("axiom-ai", routed_skills(prompt),
                             f"speech regex over-matched a non-iOS prompt: {prompt!r}")

    def test_generic_evaluate_wording_does_not_fire_ai(self):
        # "evaluate" is an ordinary English verb — only AI-context eval talk routes to axiom-ai
        for prompt in (
            "Evaluate my app's navigation architecture and suggest improvements",
            "Help me evaluate whether SwiftData or GRDB is the better choice",
            "Evaluate the performance of my scrolling list",
        ):
            self.assertNotIn("axiom-ai", routed_skills(prompt), prompt)

    def test_bare_macos_host_mention_does_not_fire_macos(self):
        # Was the original bug: "on macOS 26.3" routed to axiom-macos
        skills = routed_skills(
            "My Xcode build is failing on macOS 26.3 with linker errors")
        self.assertNotIn("axiom-macos", skills)
        self.assertIn("axiom-build", skills)

    def test_bare_macos_in_watchos_prompt_does_not_fire_macos(self):
        # The originally-reported prompt
        skills = routed_skills(
            "I've been trying for hours to deploy a watchOS app to my "
            "Apple Watch SE (watchOS 10.6) using Xcode 26.4.1 on macOS 26.3 "
            "and I keep hitting a transport error")
        self.assertNotIn("axiom-macos", skills)
        self.assertIn("axiom-watchos", skills)
        self.assertIn("axiom-build", skills)

    def test_nstoolbar_does_not_fire_swiftui(self):
        # Bare "toolbar" matched NSToolbar in macOS prompts pre-fix
        skills = routed_skills(
            "How do I add an NSToolbar to my Mac app?")
        self.assertNotIn("axiom-swiftui", skills)
        self.assertIn("axiom-macos", skills)

    def test_swiftui_toolbar_modifier_still_fires(self):
        # The legitimate ".toolbar" SwiftUI modifier must still route
        self.assertIn("axiom-swiftui", routed_skills(
            "My .toolbar modifier isn't showing in NavigationStack"))

    def test_iap_does_not_fire_payments(self):
        # In-app purchase belongs to axiom-integration, not axiom-payments
        skills = routed_skills(
            "How do I implement in-app purchase with StoreKit?")
        self.assertNotIn("axiom-payments", skills)
        self.assertIn("axiom-integration", skills)

    def test_testflight_deploy_does_not_fire_build(self):
        # "Deploy to TestFlight" is distribution, not device-deployment
        skills = routed_skills(
            "How do I deploy my app to TestFlight for beta testing?")
        self.assertNotIn("axiom-build", skills)
        self.assertIn("axiom-shipping", skills)

    def test_appstore_deploy_does_not_fire_build(self):
        skills = routed_skills(
            "How do I deploy to the App Store for review?")
        self.assertNotIn("axiom-build", skills)
        self.assertIn("axiom-shipping", skills)

    def test_iphone_aod_does_not_fire_watchos(self):
        # Always-on Display exists on iPhone 14 Pro+; not watchOS-exclusive
        skills = routed_skills(
            "How do I support always-on display on iPhone 15 Pro?")
        self.assertNotIn("axiom-watchos", skills)

    def test_mac_application_phrasing(self):
        # "Mac application" should still route to macOS even without other terms
        self.assertIn("axiom-macos", routed_skills(
            "How do I distribute my Mac application?"))

    def test_non_ios_prompt_emits_no_match(self):
        # Non-iOS prompts should not match anything
        skills = routed_skills(
            "How do I use TypeScript with React for my web app?")
        self.assertEqual(skills, set())

    def test_empty_prompt_emits_no_match(self):
        self.assertEqual(routed_skills(""), set())

    def test_short_prompt_emits_no_match(self):
        # Prompts under 5 chars are skipped
        self.assertEqual(routed_skills("hi"), set())

    def test_running_tests_in_simulator_does_not_fire_build_device_only(self):
        # Plain "run tests in simulator" must not trigger device-only-crash pattern
        skills = routed_skills(
            "How do I run my XCTest suite in the iOS simulator?")
        # Build router still allowed (simulator + xctest are valid signals);
        # the regression here is that the device-only crash regex is so loose it
        # would fire on this — guard against that by checking axiom-testing fired.
        self.assertIn("axiom-testing", skills)

    def test_install_carthage_does_not_fire_build_xcode_update(self):
        # "after installing X" shouldn't be confused with "after installing Xcode"
        skills = routed_skills(
            "After installing Carthage 0.39, how do I add a binary framework?")
        self.assertNotIn("axiom-build", skills)


class TestMixedSignalRouting(unittest.TestCase):
    """Mixed iOS + non-iOS prompts must still route the iOS skill.

    Design decision (axiom-zfpv, 2026-06-08): the `non_ios` negative gate only
    suppresses routing when NO positive iOS signal is also present. A prompt that
    clearly names Swift / Xcode / an Apple platform still gets iOS help even when it
    name-drops Android / Python / Django / etc. Each prompt below hits a
    `non_ios`-GATED rule (build, generic UI, data, concurrency, performance,
    networking) AND carries both a non-iOS keyword and an iOS signal — it must
    route, not be silently gated. The last case guards that the gate still bites
    when there is no iOS signal at all.
    """

    def test_build_with_python_keyword(self):
        # "xcodebuild" is only matched by the non_ios-gated build rule.
        self.assertIn("axiom-build", routed_skills(
            "My xcodebuild fails because of a Python build phase script"))

    def test_data_generic_with_django_keyword(self):
        # "schema migration crashes" / "no such column" are gated data terms;
        # "Xcode" is the iOS signal that must keep the gate open.
        self.assertIn("axiom-data", routed_skills(
            "My Xcode app's schema migration crashes with 'no such column' — "
            "the backend is in Django"))

    def test_networking_generic_with_nodejs_keyword(self):
        self.assertIn("axiom-networking", routed_skills(
            "My iOS app's API request to the Node.js backend times out"))

    def test_performance_generic_with_kotlin_keyword(self):
        self.assertIn("axiom-performance", routed_skills(
            "My iPhone app's startup is slow; the analytics SDK is written in Kotlin"))

    def test_concurrency_generic_with_django_keyword(self):
        self.assertIn("axiom-concurrency", routed_skills(
            "My Swift app freezes the UI during a large fetch from the Django API"))

    def test_swiftui_generic_with_react_keyword(self):
        # ".sheet" is a gated SwiftUI term; "Xcode" keeps the gate open despite "Django".
        self.assertIn("axiom-swiftui", routed_skills(
            "My .sheet won't dismiss in my Xcode app that also talks to a Django backend"))

    def test_pure_non_ios_still_suppressed(self):
        # The gate must still bite when NO iOS signal is present.
        self.assertEqual(set(), routed_skills(
            "How do I containerize my Django app with Docker and Kubernetes?"))

    def test_spm_neuroimaging_in_python_stays_suppressed(self):
        # "SPM" (Statistical Parametric Mapping) must NOT be read as Swift Package
        # Manager — bare "spm" is excluded from ios_signal for exactly this reason.
        self.assertEqual(set(), routed_skills(
            "My SPM (Statistical Parametric Mapping) analysis in Python is slow "
            "and the API request to the server keeps failing"))

    def test_genuine_swift_package_still_routes(self):
        # Dropping bare "spm" from ios_signal must not cost the genuine iOS case:
        # "Swift Package" / "Xcode" still keep the gate open alongside a non-iOS keyword.
        self.assertIn("axiom-build", routed_skills(
            "My Swift Package fails to resolve in Xcode after I added a Python build step"))


class TestManifestCoverage(unittest.TestCase):
    """Every router declared in claude-code.json must be reachable from the hook."""

    def test_all_manifest_routers_have_a_test(self):
        manifest_path = os.path.join(
            os.path.dirname(HOOK), "..", "claude-code.json"
        )
        with open(manifest_path) as f:
            manifest = json.load(f)
        manifest_routers = {s["name"] for s in manifest["skills"]}

        # Each router `axiom-<suffix>` is covered by a test method named exactly
        # `test_<suffix>` or `test_<suffix>_<...>` (some routers have several
        # tests, e.g. test_build, test_build_device_deployment). The trailing
        # underscore matters: it stops `axiom-swift`'s suffix from being matched
        # by `test_swiftui` (a `swift`-prefixed but unrelated method).
        test_methods = [m for m in dir(TestPositiveRouting) if m.startswith("test_")]
        covered = set()
        for router in manifest_routers:
            suffix = router[len("axiom-"):].replace("-", "_")
            exact = f"test_{suffix}"
            if any(t == exact or t.startswith(exact + "_") for t in test_methods):
                covered.add(router)

        missing = manifest_routers - covered
        self.assertEqual(missing, set(),
                         f"Routers in manifest but not tested: {sorted(missing)}")


class TestHookIsStandalonePython(unittest.TestCase):
    """Guard the structural decision: the hook is plain Python, not bash-embedded.

    The old user-prompt-submit.sh wrapped the logic in
    `python3 -c "$(cat <<'EOF' ... EOF)"`. That broke under macOS bash 3.2 whenever
    a prose apostrophe appeared in the body (bash 3.2 tracks quote state through the
    heredoc while scanning for the closing paren). Keeping the hook as a standalone
    .py eliminates that bug class entirely. If someone reintroduces a bash wrapper,
    this test fails.
    """

    # Accept either common python3 shebang form. The repo convention is the
    # `/usr/bin/env python3` form (picks up a pyenv/venv python3 on PATH), but
    # `/usr/bin/python3` is also valid — the point of this assertion is "the
    # hook is a directly-executable Python 3 script", not which absolute path.
    _PY3_SHEBANGS = ("#!/usr/bin/env python3", "#!/usr/bin/python3")

    def test_hook_is_a_python_file(self):
        self.assertTrue(HOOK.endswith(".py"), f"hook should be a .py file: {HOOK}")
        self.assertTrue(os.path.exists(HOOK), f"hook file missing: {HOOK}")
        with open(HOOK) as f:
            first_line = f.readline().strip()
        self.assertIn(first_line, self._PY3_SHEBANGS,
                      f"hook should start with a python3 shebang, got {first_line!r}")
        # hooks.json invokes it as `python3 "<path>"`, so the exec bit isn't
        # load-bearing today — but a shebang on a non-executable file is a
        # contradiction, and keeping +x means a direct `./hook.py` still works.
        self.assertTrue(os.access(HOOK, os.X_OK),
                        f"hook has a shebang but isn't executable: {HOOK}")

    def test_no_bash_wrapper_exists(self):
        bash_wrapper = HOOK[:-len(".py")] + ".sh"
        self.assertFalse(
            os.path.exists(bash_wrapper),
            f"a bash wrapper reappeared at {bash_wrapper} — the hook must stay "
            "standalone Python (bash 3.2 heredoc-quote bug, see this class docstring)"
        )

    @staticmethod
    def _all_hook_commands():
        hooks_dir = os.path.dirname(HOOK)
        with open(os.path.join(hooks_dir, "hooks.json")) as f:
            cfg = json.load(f)
        return [
            h["command"]
            for entries in cfg["hooks"].values()
            for entry in entries
            for h in entry["hooks"]
        ]

    def test_hooks_json_references_resolve(self):
        # Every hooks/<file>.{sh,py} referenced by a command must exist on disk —
        # catches a stale reference left behind after a .sh → .py rename.
        import re as _re
        hooks_dir = os.path.dirname(HOOK)
        missing = []
        for cmd in self._all_hook_commands():
            for m in _re.finditer(r"hooks/([\w.-]+\.(?:sh|py))", cmd):
                fname = m.group(1)
                if not os.path.exists(os.path.join(hooks_dir, fname)):
                    missing.append((fname, cmd))
        self.assertEqual(missing, [], f"hooks.json references missing files: {missing}")

    def test_converted_python_hooks_wired_as_python(self):
        # The hooks that were converted from bash heredoc to standalone Python
        # must be invoked from hooks.json as the .py file, never via a .sh wrapper.
        joined = " ".join(self._all_hook_commands())
        for stem in ("user-prompt-submit", "subagent-start"):
            self.assertIn(f"{stem}.py", joined,
                          f"hooks.json should invoke {stem}.py")
            self.assertNotIn(f"{stem}.sh", joined,
                             f"hooks.json still references the removed {stem}.sh")

    # Heuristic (not a bash parser): on a single logical line, a `python`/`python3`
    # invocation token followed by either a heredoc operator (`<<`) or the start of
    # a `$(cat ...)` command substitution (the heredoc body usually wraps onto the
    # next line). Catches all the fragile shapes:
    #   python3 -c "$(cat <<'EOF' ... EOF)"      — the original bash-3.2 trap
    #   python3 - <<'EOF' ... EOF                 — stdin heredoc
    #   python3 <<'EOF' ... EOF                   — stdin heredoc, implicit
    #   python3 -c "$(cat \<newline><<'EOF' ...   — `$(cat` matches even when << wraps
    # Known blind spots (documented, not fixed — a real check needs a shell parser):
    # the `python` token and the `<<`/`$(cat` split across a line continuation, and
    # the rare false positive of a literal "python ... <<" inside an echo/comment.
    _PY_HEREDOC = re.compile(r"\bpython3?\b[^\n]*?(?:<<|\$\(\s*cat\b)")

    def test_no_shell_hook_embeds_python_via_heredoc(self):
        # General guard: embedding Python source in a .sh hook via a heredoc is
        # fragile under macOS bash 3.2 (quote-tracking through the heredoc body).
        # Hooks that need Python must be standalone .py files.
        hooks_dir = os.path.dirname(HOOK)
        offenders = []
        for fn in sorted(os.listdir(hooks_dir)):
            if not fn.endswith(".sh"):
                continue
            with open(os.path.join(hooks_dir, fn)) as f:
                content = f.read()
            for lineno, line in enumerate(content.splitlines(), 1):
                if self._PY_HEREDOC.search(line):
                    offenders.append(f"{fn}:{lineno}")
                    break
        self.assertEqual(
            offenders, [],
            "These .sh hooks embed Python via a bash heredoc — fragile under "
            f"bash 3.2. Convert each to a standalone .py file: {offenders}"
        )

    def test_shipped_hooks_are_python_39_safe(self):
        # macOS ships /usr/bin/python3 as 3.9, and hooks.json invokes hooks with
        # bare `python3` — so a shipped hook that uses PEP 604 union annotations
        # (`int | None`) crashes at def-eval time on a stock Mac (issue #40).
        # Requiring `from __future__ import annotations` makes every annotation a
        # lazy string, neutralizing that whole bug class on Python >= 3.7.
        hooks_dir = os.path.dirname(HOOK)
        missing = []
        for fn in sorted(os.listdir(hooks_dir)):
            if not fn.endswith(".py") or fn.endswith("_test.py"):
                continue
            with open(os.path.join(hooks_dir, fn)) as f:
                content = f.read()
            if "from __future__ import annotations" not in content:
                missing.append(fn)
        self.assertEqual(
            missing, [],
            "These shipped hooks lack `from __future__ import annotations`, so "
            "PEP 604 union annotations would crash on macOS stock python3 (3.9), "
            f"issue #40: {missing}"
        )

    def test_test_files_are_python_39_runnable(self):
        # The hooks ship 3.9-safe (test above); this keeps the *test suite itself*
        # runnable on Python 3.9 so every branch can be exercised on the stock-Mac
        # interpreter (issue #40 follow-up). Test files use `int | None` helper
        # annotations, so without the future import the suite can't even import
        # under 3.9 — silently, since CI/devs run modern Python.
        hooks_dir = os.path.dirname(HOOK)
        missing = []
        for fn in sorted(os.listdir(hooks_dir)):
            if not fn.endswith("_test.py"):
                continue
            with open(os.path.join(hooks_dir, fn)) as f:
                content = f.read()
            if "from __future__ import annotations" not in content:
                missing.append(fn)
        self.assertEqual(
            missing, [],
            "These test files lack `from __future__ import annotations`, so the "
            f"suite can't be run under Python 3.9 to validate hook behavior: {missing}"
        )


if __name__ == "__main__":
    unittest.main()
