"""Offline tests for the subagent-start hook.

Run with:
    python3 -m unittest hooks/subagent-start_test.py

The hook is a standalone Python script: reads {"agent_type": "..."} on stdin,
writes a JSON response on stdout. It injects Axiom skill awareness for agent
types that benefit, and emits {} for skip-listed or known-non-iOS agent types.
"""
import json
import os
import subprocess
import sys
import unittest

HOOK = os.path.join(os.path.dirname(__file__), "subagent-start.py")


def run_hook(payload: dict) -> dict:
    """Invoke the hook with the given payload, return the parsed output ({} if no inject)."""
    result = subprocess.run(
        [sys.executable, HOOK],
        input=json.dumps(payload),
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


if __name__ == "__main__":
    unittest.main()
