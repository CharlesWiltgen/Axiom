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
import json
import os
import subprocess
import sys
import unittest

HOOK = os.path.join(os.path.dirname(__file__), "user-prompt-submit.py")


def run_hook(prompt: str) -> dict:
    """Invoke the hook with the given prompt, return the parsed output.

    Returns {} if the hook emitted no match.
    """
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
    import re
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

    def test_data(self):
        self.assertIn("axiom-data", routed_skills(
            "How do I migrate my SwiftData @Model schema?"))

    def test_concurrency(self):
        self.assertIn("axiom-concurrency", routed_skills(
            "Getting actor-isolated errors with @MainActor in Swift 6"))

    def test_performance(self):
        self.assertIn("axiom-performance", routed_skills(
            "I have a memory leak and retain cycle in my app"))

    def test_networking(self):
        self.assertIn("axiom-networking", routed_skills(
            "How do I use URLSession with async/await?"))

    def test_testing(self):
        self.assertIn("axiom-testing", routed_skills(
            "My XCUITest is flaky and slow"))

    def test_integration(self):
        self.assertIn("axiom-integration", routed_skills(
            "How do I add a WidgetKit timeline to my app?"))

    def test_media(self):
        self.assertIn("axiom-media", routed_skills(
            "How do I use AVCaptureSession for camera preview?"))

    def test_accessibility(self):
        self.assertIn("axiom-accessibility", routed_skills(
            "My VoiceOver labels are missing and Dynamic Type breaks"))

    def test_ai(self):
        self.assertIn("axiom-ai", routed_skills(
            "How do I use Foundation Models with @Generable?"))

    def test_vision(self):
        self.assertIn("axiom-vision", routed_skills(
            "How do I use Vision framework for text recognition?"))

    def test_games(self):
        self.assertIn("axiom-games", routed_skills(
            "My SpriteKit SKScene physics aren't working"))

    def test_graphics(self):
        self.assertIn("axiom-graphics", routed_skills(
            "How do I migrate from OpenGL to Metal shaders?"))

    def test_shipping(self):
        self.assertIn("axiom-shipping", routed_skills(
            "My app store submission was rejected for privacy manifest"))

    def test_macos(self):
        # Must require intent-qualifier; bare "macos" alone must NOT fire
        self.assertIn("axiom-macos", routed_skills(
            "How do I build a Mac app with NSToolbar and sandboxing?"))

    def test_design(self):
        self.assertIn("axiom-design", routed_skills(
            "How do I apply Liquid Glass and SF Symbol effects?"))

    def test_uikit(self):
        self.assertIn("axiom-uikit", routed_skills(
            "How do I bridge UIViewController to SwiftUI with UIViewRepresentable?"))

    def test_swift(self):
        self.assertIn("axiom-swift", routed_skills(
            "How do I use noncopyable types and consuming func?"))

    def test_location(self):
        self.assertIn("axiom-location", routed_skills(
            "How do I use CLMonitor for geofencing with MapKit?"))

    def test_security(self):
        self.assertIn("axiom-security", routed_skills(
            "How do I store credentials in Keychain with passkey auth?"))

    def test_apple_docs(self):
        self.assertIn("axiom-apple-docs", routed_skills(
            "Does iOS 26 exist? What WWDC 2025 sessions cover this?"))

    def test_xcode_mcp(self):
        self.assertIn("axiom-xcode-mcp", routed_skills(
            "How do I set up Xcode MCP with xcrun mcpbridge?"))

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


class TestNegativeRouting(unittest.TestCase):
    """Known false-positive traps must NOT trigger."""

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


class TestManifestCoverage(unittest.TestCase):
    """Every router declared in claude-code.json must be reachable from the hook."""

    def test_all_manifest_routers_have_a_test(self):
        manifest_path = os.path.join(
            os.path.dirname(HOOK), "..", "claude-code.json"
        )
        with open(manifest_path) as f:
            manifest = json.load(f)
        manifest_routers = {s["name"] for s in manifest["skills"]}

        # Every router in the manifest must have a `test_<name>` method.
        # axiom-name → test_name (underscores)
        tested = {
            m[len("test_"):].replace("_", "-")
            for m in dir(TestPositiveRouting)
            if m.startswith("test_")
        }
        # Map test method names back to router names. Some tests share a router
        # (e.g. test_build, test_build_device_deployment both for axiom-build),
        # so we also derive coverage from prefix matching.
        covered = set()
        for router in manifest_routers:
            suffix = router[len("axiom-"):].replace("-", "_")
            for t in dir(TestPositiveRouting):
                if t.startswith(f"test_{suffix}"):
                    covered.add(router)
                    break

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

    def test_hook_is_a_python_file(self):
        self.assertTrue(HOOK.endswith(".py"), f"hook should be a .py file: {HOOK}")
        self.assertTrue(os.path.exists(HOOK), f"hook file missing: {HOOK}")
        with open(HOOK) as f:
            first_line = f.readline().strip()
        self.assertEqual(first_line, "#!/usr/bin/env python3",
                         "hook should have a python3 shebang")

    def test_no_bash_wrapper_exists(self):
        bash_wrapper = HOOK[:-len(".py")] + ".sh"
        self.assertFalse(
            os.path.exists(bash_wrapper),
            f"a bash wrapper reappeared at {bash_wrapper} — the hook must stay "
            "standalone Python (bash 3.2 heredoc-quote bug, see this class docstring)"
        )

    def test_hooks_json_invokes_the_python_file(self):
        hooks_json = os.path.join(os.path.dirname(HOOK), "hooks.json")
        with open(hooks_json) as f:
            cfg = json.load(f)
        cmds = [
            h["command"]
            for entry in cfg["hooks"].get("UserPromptSubmit", [])
            for h in entry["hooks"]
        ]
        self.assertTrue(
            any("user-prompt-submit.py" in c for c in cmds),
            f"hooks.json UserPromptSubmit should invoke user-prompt-submit.py; got: {cmds}"
        )
        self.assertFalse(
            any("user-prompt-submit.sh" in c for c in cmds),
            f"hooks.json still references the removed .sh wrapper: {cmds}"
        )

    def test_no_shell_hook_embeds_python_via_heredoc(self):
        # General guard: the `python3 -c "$(cat <<'EOF' ... EOF)"` pattern in any
        # .sh hook is fragile under macOS bash 3.2 (quote-tracking through the
        # heredoc body). Hooks that need Python must be standalone .py files.
        hooks_dir = os.path.dirname(HOOK)
        offenders = []
        for fn in sorted(os.listdir(hooks_dir)):
            if not fn.endswith(".sh"):
                continue
            with open(os.path.join(hooks_dir, fn)) as f:
                content = f.read()
            if 'python3 -c "$(cat <<' in content or 'python -c "$(cat <<' in content:
                offenders.append(fn)
        self.assertEqual(
            offenders, [],
            "These .sh hooks embed Python via a bash heredoc — fragile under "
            f"bash 3.2. Convert each to a standalone .py file: {offenders}"
        )


if __name__ == "__main__":
    unittest.main()
