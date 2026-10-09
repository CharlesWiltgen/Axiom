"""Behavioral tests for the session-start hook: the project-type gate (GH #45),
the size of the context it injects, and the version facts it states.

Runs the hook as a subprocess (like the other hook behavioral tests) with a
controlled cwd + AXIOM_SESSION_CONTEXT, and inspects its stdout JSON.

Run from the hooks dir:
    python3 -m unittest session-start_test -v
"""
from __future__ import annotations

import json
import os
import plistlib
import shutil
import subprocess
import tempfile
import unittest

import version_context
import xcode_path

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(HOOKS_DIR, "session-start.py")
PLUGIN_ROOT = os.path.dirname(HOOKS_DIR)  # .../plugins/axiom
TOOLS_SKILL = os.path.join(PLUGIN_ROOT, "skills", "axiom-tools", "SKILL.md")

# Claude Code keeps a hook's additionalContext inline only up to 10,000 chars.
# Past that it saves the text to a file and the model sees a 2,000-char preview
# (https://code.claude.com/docs/en/hooks). No setting raises the cap.
CLAUDE_CODE_CONTEXT_LIMIT = 10_000


def run_in(cwd: str, env_override: dict | None = None, plugin_root: str = PLUGIN_ROOT) -> dict:
    env = os.environ.copy()
    env.pop("AXIOM_SESSION_CONTEXT", None)
    env.pop("AXIOM_HARNESS", None)
    env.pop("AXIOM_XCODE_PATH", None)
    env.pop("DEVELOPER_DIR", None)
    if env_override:
        env.update(env_override)
    out = subprocess.run(
        ["python3", HOOK, plugin_root],
        cwd=cwd, env=env, capture_output=True, text=True, timeout=15,
    )
    assert out.returncode == 0, f"hook exited {out.returncode}: {out.stderr}"
    return json.loads(out.stdout or "{}")


def has_context(payload: dict) -> bool:
    ctx = payload.get("hookSpecificOutput", {}).get("additionalContext")
    return isinstance(ctx, str) and "EXTREMELY_IMPORTANT" in ctx


def context(payload: dict) -> str:
    return payload["hookSpecificOutput"]["additionalContext"]


VERSION_BLOCK_HEADING = "## iOS / Xcode VERSION GROUND TRUTH"
VERSION_BLOCK_LAST_LINE = version_context.version_ground_truth("any date", None).splitlines()[-1]


def version_block(ctx: str) -> str:
    """The rendered version ground truth inside a hook's context."""
    start = ctx.index(VERSION_BLOCK_HEADING)
    end = ctx.index(VERSION_BLOCK_LAST_LINE, start) + len(VERSION_BLOCK_LAST_LINE)
    return ctx[start:end]


# Tool and Xcode paths are printed in the context, so long paths make it bigger.
# A default install's plugin root is ~60 chars (~/.claude/plugins/cache/...), and
# Xcode is /Applications/Xcode.app; these lengths leave room for unusual setups.
PLUGIN_ROOT_LEN = 150
XCODE_PATH_LEN = 100


def padded_dir(root: str, length: int, leaf: str) -> str:
    """A path under root that is at least `length` chars long and ends in leaf.
    A long temp root only makes it longer, which makes the size test stricter."""
    pad = max(1, length - len(root) - len(leaf) - 2)
    return os.path.join(root, "p" * pad, leaf)


TRUNCATION_CHECKED_TOOLS = ("xclog", "xcsym", "xcui", "xcprof")


def fake_install(
    root: str, skill_text: str | None = None, truncated: bool = False
) -> tuple[str, str]:
    """A worst case for the hook's output size: a long plugin root with every
    bundled tool, and a long Xcode path with for-LLM docs and version plists.
    truncated=True leaves the size-checked tools below the hook's 1 MB floor,
    whose warnings are longer than the normal tool lines.
    Returns (plugin_root, xcode_path)."""
    plugin_root = padded_dir(os.path.join(root, "plugins"), PLUGIN_ROOT_LEN, "axiom")
    skill_dir = os.path.join(plugin_root, "skills", "axiom-tools")
    os.makedirs(skill_dir)
    if skill_text is None:
        shutil.copy(TOOLS_SKILL, os.path.join(skill_dir, "SKILL.md"))
    else:
        with open(os.path.join(skill_dir, "SKILL.md"), "w") as f:
            f.write(skill_text)
    os.makedirs(os.path.join(plugin_root, "bin"))
    for tool in ("xclog", "xcsym", "xcui", "xcprof", "axbuild", "xcproject"):
        path = os.path.join(plugin_root, "bin", tool)
        with open(path, "wb") as f:
            # sparse; 1.1 MB clears the hook's 1 MB truncation floor
            f.truncate(10 if truncated and tool in TRUNCATION_CHECKED_TOOLS else 1_100_000)
        os.chmod(path, 0o755)

    xcode = padded_dir(os.path.join(root, "Applications"), XCODE_PATH_LEN, "Xcode-beta.app")
    contents = os.path.join(xcode, "Contents")
    for sub in (
        "PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation",
        "Developer/Toolchains/XcodeDefault.xctoolchain/usr/share/doc/swift/diagnostics",
        "Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk",
    ):
        os.makedirs(os.path.join(contents, sub))
    for sub in (
        "PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation",
        "Developer/Toolchains/XcodeDefault.xctoolchain/usr/share/doc/swift/diagnostics",
    ):
        open(os.path.join(contents, sub, "guide.md"), "w").close()
    with open(os.path.join(contents, "Info.plist"), "wb") as f:
        plistlib.dump({"CFBundleShortVersionString": "99.1"}, f)
    sdk = "Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/SDKSettings.plist"
    with open(os.path.join(contents, sdk), "wb") as f:
        plistlib.dump({"Version": "99.2"}, f)
    return plugin_root, xcode


class TestSessionStartGate(unittest.TestCase):
    def test_apple_dir_injects(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "App.swift"), "w"):
                pass
            self.assertTrue(has_context(run_in(d)))

    def test_non_apple_dir_skips(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))  # bound the upward walk → hermetic
            with open(os.path.join(d, "index.js"), "w"):
                pass
            self.assertFalse(has_context(run_in(d)))

    def test_override_always_injects_in_plain_dir(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(has_context(run_in(d, {"AXIOM_SESSION_CONTEXT": "always"})))

    def test_override_never_skips_in_apple_dir(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "App.swift"), "w"):
                pass
            self.assertFalse(has_context(run_in(d, {"AXIOM_SESSION_CONTEXT": "never"})))


class TestCodexStartup(unittest.TestCase):
    def test_codex_context_is_bounded_and_preserves_required_safeguards(self):
        # Worst case: the long plugin root (printed twice) and Xcode path the
        # Claude size test uses. The shared version ground truth (~1.7k) is most
        # of this; the rest is Codex's own router-loading text.
        with tempfile.TemporaryDirectory() as d:
            plugin_root, fake_xcode = fake_install(d)
            payload = run_in(
                d,
                {"AXIOM_SESSION_CONTEXT": "always", "AXIOM_HARNESS": "codex", "AXIOM_XCODE_PATH": fake_xcode},
                plugin_root,
            )
        context = payload["hookSpecificOutput"]["additionalContext"]
        self.assertIn("Installed on this machine: Xcode 99.1", context)
        self.assertLessEqual(len(context.encode("utf-8")), 4000)
        self.assertIn("SKILL.md", context)
        self.assertIn("DEPLOYMENT TARGET", context)
        self.assertIn("#available", context)
        for safeguard in ("BEFORE responding or acting", "Multi-domain work needs", "VERSION GROUND TRUTH", "Use only capabilities exposed"):
            with self.subTest(safeguard=safeguard):
                self.assertIn(safeguard, context)
        self.assertNotIn("use the 'Skill' tool", context)
        self.assertNotIn("Below is the full content", context)

    def test_codex_context_names_every_bundled_helper(self):
        # The list comes from the installed bin/, so a new helper cannot be left out.
        with tempfile.TemporaryDirectory() as d:
            payload = run_in(d, {"AXIOM_SESSION_CONTEXT": "always", "AXIOM_HARNESS": "codex"})
        context = payload["hookSpecificOutput"]["additionalContext"]
        helpers = sorted(n for n in os.listdir(os.path.join(PLUGIN_ROOT, "bin")) if not n.startswith("."))
        self.assertEqual([name for name in helpers if name not in context], [])

    def test_codex_respects_the_non_apple_project_gate(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))
            with open(os.path.join(d, "index.js"), "w"):
                pass
            self.assertEqual(run_in(d, {"AXIOM_HARNESS": "codex"}), {})

    def test_canonical_claude_still_injects_the_onboarding_discipline(self):
        # The size fix moves the routing table, Device Hub notes and tool references
        # on-demand; the discipline itself must stay in the always-on span.
        with tempfile.TemporaryDirectory() as d:
            context = run_in(d, {"AXIOM_SESSION_CONTEXT": "always"})["hookSpecificOutput"]["additionalContext"]
        self.assertIn("Below is the always-on part", context)
        self.assertIn("Skill Priority for iOS Development", context)
        self.assertIn("DEPLOYMENT TARGET", context)
        self.assertNotIn("Below is the full content", context)


class _InApple(unittest.TestCase):
    """Runs the hook from an Apple project dir inside a per-test temp root."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = tmp.name
        self.project = os.path.join(self.root, "project")
        os.mkdir(self.project)
        open(os.path.join(self.project, "App.swift"), "w").close()

    def ctx(self, skill_text: str | None = None, xcode: str | None = None) -> str:
        plugin_root, fake_xcode = fake_install(self.root, skill_text)
        env = {"AXIOM_XCODE_PATH": xcode or fake_xcode}
        return context(run_in(self.project, env, plugin_root))


class TestSessionStartContextSize(_InApple):
    def test_worst_case_fits_claude_code_inline_limit(self):
        c = self.ctx()
        # Every optional block is present, so this is the largest the hook emits.
        for block in ("**Apple for-LLM Documentation**", "**xclog**", "**xcsym**", "**xcui**", "**xcprof**", "**Bundled tools**"):
            self.assertIn(block, c)
        self.assertLess(len(c), CLAUDE_CODE_CONTEXT_LIMIT)

    def test_worst_case_with_truncated_binaries_fits_claude_code_inline_limit(self):
        # A truncation warning is longer than the tool line it replaces.
        plugin_root, fake_xcode = fake_install(self.root, truncated=True)
        c = context(run_in(self.project, {"AXIOM_XCODE_PATH": fake_xcode}, plugin_root))
        for tool in TRUNCATION_CHECKED_TOOLS:
            self.assertIn(f"**{tool} binary appears truncated**", c)
        self.assertLess(len(c), CLAUDE_CODE_CONTEXT_LIMIT)

    def test_session_facts_come_before_the_skill_text(self):
        # Tool paths and the installed toolchain are facts only this hook knows.
        # They lead, so a 2,000-char preview would still carry the version rules.
        c = self.ctx()
        self.assertLess(c.index("**xcprof**"), c.index("## The Rule"))

    def test_injects_only_the_marked_span_of_axiom_tools(self):
        c = self.ctx()
        self.assertIn("## The Rule", c)
        self.assertNotIn("## Routing", c)
        self.assertNotIn("## Device Hub", c)
        self.assertNotIn("AXIOM_SESSION_START", c)

    def test_whole_skill_injected_when_markers_are_missing(self):
        c = self.ctx(skill_text="---\nname: axiom-tools\n---\n\n## Routing\n\nr\n\n## The Rule\n\nx\n")
        self.assertIn("## Routing", c)
        self.assertIn("## The Rule", c)

    def test_whole_skill_injected_when_markers_enclose_nothing(self):
        skill = (
            "## Routing\n\nr\n\n"
            "<!-- AXIOM_SESSION_START_BEGIN --><!-- AXIOM_SESSION_START_END -->\n\n"
            "## The Rule\n\nx\n"
        )
        c = self.ctx(skill_text=skill)
        self.assertIn("## Routing", c)
        self.assertIn("## The Rule", c)

    def test_whole_skill_injected_when_markers_are_misordered(self):
        skill = (
            "## Routing\n\nr\n\n"
            "<!-- AXIOM_SESSION_START_END -->\n\n"
            "## The Rule\n\nx\n\n"
            "<!-- AXIOM_SESSION_START_BEGIN -->\n"
        )
        c = self.ctx(skill_text=skill)
        self.assertIn("## Routing", c)
        self.assertIn("## The Rule", c)


class TestSessionStartVersionFacts(_InApple):
    def test_reports_the_installed_xcode_and_ios_sdk(self):
        c = self.ctx()
        self.assertIn("Xcode 99.1", c)
        self.assertIn("iOS 99.2 SDK", c)

    def test_does_not_hard_code_a_current_major(self):
        self.assertNotIn("iOS 26 is the current major line", self.ctx())

    def test_no_installed_line_without_xcode(self):
        c = self.ctx(xcode=os.path.join(self.root, "no-xcode-here"))
        self.assertNotIn("Installed on this machine", c)
        self.assertIn("VERSION GROUND TRUTH", c)

    def test_developer_dir_selects_the_active_toolchain(self):
        # Without an explicit override, DEVELOPER_DIR names the toolchain the
        # session would actually build with — for the version line and the
        # Apple-docs paths alike.
        plugin_root, fake_xcode = fake_install(self.root)
        developer_dir = os.path.join(fake_xcode, "Contents", "Developer")
        c = context(run_in(self.project, {"DEVELOPER_DIR": developer_dir}, plugin_root))
        self.assertIn("Xcode 99.1", c)
        self.assertIn("iOS 99.2 SDK", c)
        self.assertIn(fake_xcode, c)

    def test_non_ascii_xcode_path_resolves_under_an_ascii_locale(self):
        # The hook decoded xcode-select's output and SKILL.md with the locale's
        # codec, so a US-ASCII locale lost the toolchain line and the span.
        plugin_root, _ = fake_install(self.root)
        app = os.path.join(self.root, "Xcode ß.app")
        os.makedirs(os.path.join(app, "Contents", "Developer"))
        with open(os.path.join(app, "Contents", "Info.plist"), "wb") as f:
            plistlib.dump({"CFBundleShortVersionString": "99.3"}, f)
        ascii_locale = {"LC_ALL": "en_US.US-ASCII", "LANG": "en_US.US-ASCII"}
        c = context(run_in(self.project, {"DEVELOPER_DIR": app, **ascii_locale}, plugin_root))
        self.assertEqual(
            ("Installed on this machine: Xcode 99.3" in c, "## The Rule" in c), (True, True)
        )

    def test_app_form_developer_dir_selects_the_active_toolchain(self):
        # xcrun accepts DEVELOPER_DIR=<Xcode>.app as readily as .../Contents/Developer.
        plugin_root, fake_xcode = fake_install(self.root)
        c = context(run_in(self.project, {"DEVELOPER_DIR": fake_xcode}, plugin_root))
        self.assertIn(f"Installed on this machine: Xcode 99.1 with the iOS 99.2 SDK (`{fake_xcode}`)", c)


class TestXcodePathResolution(unittest.TestCase):
    """The hook describes the Xcode the user has switched to: what `xcode-select -p`
    reports, which honors DEVELOPER_DIR and otherwise the `--switch` selection."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = tmp.name

    def make_xcode(self, name: str) -> str:
        """An Xcode.app with an Info.plist; returns the app path."""
        contents = os.path.join(self.root, name, "Contents")
        os.makedirs(os.path.join(contents, "Developer"))
        open(os.path.join(contents, "Info.plist"), "w").close()
        return os.path.join(self.root, name)

    def fake_select(self, with_developer_dir: str | None, selected: str | None):
        """An xcode-select stand-in: reports DEVELOPER_DIR when the env carries it,
        else the selection. Records each env it was asked about."""
        calls: list[dict] = []

        def select(env):
            calls.append(dict(env))
            return with_developer_dir if env.get("DEVELOPER_DIR") else selected

        return select, calls

    def test_explicit_override_wins_without_asking_xcode_select(self):
        select, calls = self.fake_select(self.make_xcode("Active.app"), None)
        resolved = xcode_path.resolve_xcode_path(
            {"AXIOM_XCODE_PATH": "/explicit", "DEVELOPER_DIR": "/x"}, xcode_select=select
        )
        self.assertEqual((resolved, calls), ("/explicit", []))

    def test_reported_developer_dir_resolves_to_its_app(self):
        app = self.make_xcode("Active.app")
        select, _ = self.fake_select(None, os.path.join(app, "Contents", "Developer"))
        self.assertEqual(xcode_path.resolve_xcode_path({}, xcode_select=select), app)

    def test_reported_app_path_resolves_to_itself(self):
        # xcode-select passes DEVELOPER_DIR through unchanged when the app has no
        # Contents/Developer to append, so the app form must resolve on its own.
        app = self.make_xcode("Beta.app")
        for reported in (app, app + "/", os.path.join(app, "Contents", "Developer", ".")):
            with self.subTest(reported=reported):
                select, _ = self.fake_select(reported, None)
                self.assertEqual(
                    xcode_path.resolve_xcode_path({"DEVELOPER_DIR": reported}, xcode_select=select),
                    app,
                )

    def test_developer_dir_naming_no_xcode_falls_back_to_the_selection(self):
        tools = os.path.join(self.root, "CommandLineTools")
        os.makedirs(tools)
        selected = self.make_xcode("Selected.app")
        select, calls = self.fake_select(tools, os.path.join(selected, "Contents", "Developer"))
        resolved = xcode_path.resolve_xcode_path({"DEVELOPER_DIR": tools}, xcode_select=select)
        self.assertEqual(
            (resolved, ["DEVELOPER_DIR" in env for env in calls]), (selected, [True, False])
        )

    def test_default_when_xcode_select_reports_nothing(self):
        select, _ = self.fake_select(None, None)
        self.assertEqual(
            xcode_path.resolve_xcode_path({}, xcode_select=select), xcode_path.DEFAULT_XCODE_PATH
        )

    @unittest.skipUnless(shutil.which("xcode-select"), "needs macOS xcode-select")
    def test_unspawnable_developer_dir_falls_back_to_the_selection(self):
        # A NUL byte makes the spawn itself raise (ValueError), not fail.
        self.assertEqual(
            xcode_path.resolve_xcode_path({"DEVELOPER_DIR": "bad\0dir"}),
            xcode_path.resolve_xcode_path({}),
        )

    @unittest.skipUnless(shutil.which("xcode-select"), "needs macOS xcode-select")
    def test_real_xcode_select_resolves_an_app_form_developer_dir(self):
        # The 2026-10-08 regression: DEVELOPER_DIR=/Applications/Xcode-beta.app made
        # the hook describe /Applications/Xcode.app while xcrun used the beta.
        app = self.make_xcode("Xcode Beta.app")
        self.assertEqual(xcode_path.resolve_xcode_path({"DEVELOPER_DIR": app}), app)


class TestVersionContextAlignment(_InApple):
    """Claude Code and Codex render the same version ground truth from
    version_context.py, and both carry the attribution sentence."""

    def test_claude_and_codex_carry_the_same_version_block(self):
        plugin_root, fake_xcode = fake_install(self.root)
        env = {"AXIOM_XCODE_PATH": fake_xcode}
        claude = context(run_in(self.project, env, plugin_root))
        codex = context(run_in(self.project, {**env, "AXIOM_HARNESS": "codex"}, plugin_root))
        self.assertEqual(version_block(codex), version_block(claude))
        self.assertIn("Installed on this machine: Xcode 99.1", version_block(codex))

    def test_both_harnesses_carry_the_attribution_sentence(self):
        plugin_root, fake_xcode = fake_install(self.root)
        env = {"AXIOM_XCODE_PATH": fake_xcode}
        claude = context(run_in(self.project, env, plugin_root))
        codex = context(run_in(self.project, {**env, "AXIOM_HARNESS": "codex"}, plugin_root))
        self.assertEqual(
            [version_context.ATTRIBUTION in c for c in (claude, codex)], [True, True]
        )


class TestMissingVersionModules(_InApple):
    """A partial install without version_context.py / xcode_path.py loses only the
    version block: the gate, the span and the tool lines still work."""

    def run_partial(self, cwd: str) -> dict:
        plugin_root, _ = fake_install(self.root)
        hooks = os.path.join(self.root, "partial-hooks")
        os.mkdir(hooks)
        for name in ("session-start.py", "project_detect.py", "hook_diagnostics.py"):
            shutil.copy(os.path.join(HOOKS_DIR, name), hooks)
        env = {k: v for k, v in os.environ.items() if k not in ("AXIOM_SESSION_CONTEXT", "AXIOM_HARNESS")}
        out = subprocess.run(
            ["python3", os.path.join(hooks, "session-start.py"), plugin_root],
            cwd=cwd, env=env, capture_output=True, text=True, timeout=15,
        )
        self.assertEqual(out.returncode, 0, out.stderr)
        return json.loads(out.stdout or "{}")

    def test_apple_project_keeps_everything_but_the_version_block(self):
        c = context(self.run_partial(self.project))
        self.assertEqual(
            ("## The Rule" in c, "**Bundled tools**" in c, "VERSION GROUND TRUTH" in c),
            (True, True, False),
        )

    def test_non_apple_project_still_gets_nothing(self):
        plain = os.path.join(self.root, "plain")
        os.makedirs(os.path.join(plain, ".git"))
        open(os.path.join(plain, "index.js"), "w").close()
        self.assertEqual(self.run_partial(plain), {})


class TestBundledToolRoster(_InApple):
    def test_roster_names_every_binary_in_bin(self):
        plugin_root, fake_xcode = fake_install(self.root)
        open(os.path.join(plugin_root, "bin", "axprobe"), "w").close()
        c = context(run_in(self.project, {"AXIOM_XCODE_PATH": fake_xcode}, plugin_root))
        for name in ("axbuild", "xclog", "xcsym", "xcui", "xcprof", "xcproject", "axprobe"):
            self.assertIn(name, c)

    def test_roster_leaves_out_binaries_flagged_as_truncated(self):
        # The roster says to run each listed tool with --help, and the warning
        # above says not to call a truncated one.
        plugin_root, fake_xcode = fake_install(self.root, truncated=True)
        c = context(run_in(self.project, {"AXIOM_XCODE_PATH": fake_xcode}, plugin_root))
        roster = next(line for line in c.splitlines() if line.startswith("**Bundled tools**"))
        listed = [name for name in ("axbuild", "xcproject", *TRUNCATION_CHECKED_TOOLS) if name in roster]
        self.assertEqual(listed, ["axbuild", "xcproject"])

    def test_roster_omitted_when_bin_is_empty(self):
        plugin_root, fake_xcode = fake_install(self.root)
        for name in os.listdir(os.path.join(plugin_root, "bin")):
            os.remove(os.path.join(plugin_root, "bin", name))
        c = context(run_in(self.project, {"AXIOM_XCODE_PATH": fake_xcode}, plugin_root))
        self.assertNotIn("**Bundled tools**", c)


if __name__ == "__main__":
    unittest.main()
