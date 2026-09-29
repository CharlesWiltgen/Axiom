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


def fake_install(root: str, skill_text: str | None = None) -> tuple[str, str]:
    """A worst case for the hook's output size: a long plugin root with all four
    bundled tools, and a long Xcode path with for-LLM docs and version plists.
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
    for tool in ("xclog", "xcsym", "xcui", "xcprof"):
        path = os.path.join(plugin_root, "bin", tool)
        with open(path, "wb") as f:
            f.truncate(1_100_000)  # sparse; clears the hook's 1 MB truncation floor
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
        for block in ("**Apple for-LLM Documentation**", "**xclog**", "**xcsym**", "**xcui**", "**xcprof**"):
            self.assertIn(block, c)
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


if __name__ == "__main__":
    unittest.main()
