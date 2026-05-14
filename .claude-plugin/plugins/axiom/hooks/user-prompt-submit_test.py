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


if __name__ == "__main__":
    unittest.main()
