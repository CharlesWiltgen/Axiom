"""Offline tests for the subagent-start hook.

Run with:
    python3 -m unittest hooks/subagent-start_test.py

The hook is a standalone Python script: reads {"agent_type": "..."} on stdin,
writes a JSON response on stdout. It injects Axiom skill awareness for agent
types that benefit, and emits {} for skip-listed or known-non-iOS agent types.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest

HOOK = os.path.join(os.path.dirname(__file__), "subagent-start.py")


def run_hook_in(payload: dict, cwd: str | None = None,
                env_override: dict | None = None) -> dict:
    """Invoke the hook with a controlled cwd + environment; return parsed output.

    The hook gates on project type / AXIOM_SESSION_CONTEXT (GH #48), both of
    which depend on cwd and env — so gate tests must control them. Returns {}
    when the hook injects nothing.
    """
    # Production (hooks.json) invokes the hook as `python3 "<path>"`; tests use
    # sys.executable so the suite runs under whatever interpreter is running it
    # (venvs, CI images without a bare `python3`). Both are a Python 3; the hook
    # is stdlib-only, so the choice is behavior-neutral — sys.executable is just
    # the more robust spawn target for the test process.
    env = os.environ.copy()
    env.pop("AXIOM_SESSION_CONTEXT", None)
    if env_override:
        env.update(env_override)
    result = subprocess.run(
        [sys.executable, HOOK],
        input=json.dumps(payload),
        cwd=cwd,
        env=env,
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


def run_hook(payload: dict) -> dict:
    """Invoke the hook for an injection/skip test, project gate forced open.

    Injection and agent-type skip tests are orthogonal to the project-type gate
    (GH #48). Forcing AXIOM_SESSION_CONTEXT=always makes them hermetic — they
    exercise agent-type logic regardless of where the suite runs, rather than
    silently depending on the cwd looking like an Apple project.
    """
    return run_hook_in(payload, env_override={"AXIOM_SESSION_CONTEXT": "always"})


def injected_context(agent_type: str) -> str:
    """Return the additionalContext string the hook would inject ('' if none)."""
    payload = run_hook({"agent_type": agent_type})
    return payload.get("hookSpecificOutput", {}).get("additionalContext", "")


class TestSubagentStartInjection(unittest.TestCase):
    def test_general_purpose_agent_gets_skill_awareness(self):
        ctx = injected_context("general-purpose")
        self.assertIn("Axiom iOS development skills", ctx)
        self.assertIn("axiom-build", ctx)
        self.assertIn("axiom-swiftui", ctx)

    def test_unknown_agent_type_gets_skill_awareness(self):
        # An agent type we don't recognize is treated as a candidate for skills.
        ctx = injected_context("some-new-ios-agent")
        self.assertIn("axiom-", ctx)

    def test_event_name_is_subagent_start(self):
        payload = run_hook({"agent_type": "general-purpose"})
        self.assertEqual(
            payload["hookSpecificOutput"]["hookEventName"], "SubagentStart"
        )


class TestSubagentStartSkips(unittest.TestCase):
    def test_skip_list_agent_emits_empty(self):
        # Exact-match skip list
        self.assertEqual(run_hook({"agent_type": "beads:task-agent"}), {})
        self.assertEqual(run_hook({"agent_type": "claude-code-guide"}), {})
        self.assertEqual(run_hook({"agent_type": "statusline-setup"}), {})
        self.assertEqual(
            run_hook({"agent_type": "code-simplifier:code-simplifier"}), {}
        )

    def test_skip_prefix_agent_emits_empty(self):
        # Prefix skip — any beads:* / plugin-dev:* / superpowers-lab:* etc.
        self.assertEqual(run_hook({"agent_type": "beads:something-brand-new"}), {})
        self.assertEqual(run_hook({"agent_type": "plugin-dev:future-tool"}), {})
        self.assertEqual(run_hook({"agent_type": "superpowers-lab:whatever"}), {})

    def test_malformed_payload_emits_empty(self):
        result = subprocess.run(
            [sys.executable, HOOK],
            input="not json at all",
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout.strip() or "{}"), {})

    def test_missing_agent_type_does_not_crash(self):
        # No agent_type key — hook must still exit 0 with valid JSON
        result = subprocess.run(
            [sys.executable, HOOK],
            input=json.dumps({}),
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 0)
        json.loads(result.stdout.strip() or "{}")  # must parse


class TestSubagentStartProjectGate(unittest.TestCase):
    """The hook must stay quiet outside Apple projects and honor the override
    (GH #48). A general-purpose subagent injects skill awareness in an Apple
    project but must inject NOTHING in a non-Apple one. Mirrors the gate tests in
    session-start_test.py / user-prompt-submit_test.py — all three hooks share
    one gate and must behave alike.
    """

    AGENT = "general-purpose"  # a non-skip-listed agent that normally injects

    def _injects(self, payload: dict) -> bool:
        ctx = payload.get("hookSpecificOutput", {}).get("additionalContext", "")
        return "Axiom iOS development skills" in ctx

    def test_non_apple_dir_suppresses_injection(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))  # bound the upward walk → hermetic
            with open(os.path.join(d, "index.js"), "w"):
                pass
            self.assertFalse(
                self._injects(run_hook_in({"agent_type": self.AGENT}, cwd=d)))

    def test_apple_dir_injects(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "App.swift"), "w"):
                pass
            self.assertTrue(
                self._injects(run_hook_in({"agent_type": self.AGENT}, cwd=d)))

    def test_override_never_suppresses_in_apple_dir(self):
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "App.swift"), "w"):
                pass
            self.assertFalse(self._injects(run_hook_in(
                {"agent_type": self.AGENT}, cwd=d,
                env_override={"AXIOM_SESSION_CONTEXT": "never"})))

    def test_override_always_injects_in_plain_dir(self):
        with tempfile.TemporaryDirectory() as d:
            os.mkdir(os.path.join(d, ".git"))
            with open(os.path.join(d, "index.js"), "w"):
                pass
            self.assertTrue(self._injects(run_hook_in(
                {"agent_type": self.AGENT}, cwd=d,
                env_override={"AXIOM_SESSION_CONTEXT": "always"})))


if __name__ == "__main__":
    unittest.main()
