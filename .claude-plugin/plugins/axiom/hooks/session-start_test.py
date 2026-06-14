"""Behavioral tests for the session-start hook gate (GH #45).

Runs the hook as a subprocess (like the other hook behavioral tests) with a
controlled cwd + AXIOM_SESSION_CONTEXT, and inspects its stdout JSON.

Run from the hooks dir:
    python3 -m unittest session-start_test -v
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(HOOKS_DIR, "session-start.py")
PLUGIN_ROOT = os.path.dirname(HOOKS_DIR)  # .../plugins/axiom


def run_in(cwd: str, env_override: dict | None = None) -> dict:
    env = os.environ.copy()
    env.pop("AXIOM_SESSION_CONTEXT", None)
    if env_override:
        env.update(env_override)
    out = subprocess.run(
        ["python3", HOOK, PLUGIN_ROOT],
        cwd=cwd, env=env, capture_output=True, text=True, timeout=15,
    )
    assert out.returncode == 0, f"hook exited {out.returncode}: {out.stderr}"
    return json.loads(out.stdout or "{}")


def has_context(payload: dict) -> bool:
    ctx = payload.get("hookSpecificOutput", {}).get("additionalContext")
    return isinstance(ctx, str) and "EXTREMELY_IMPORTANT" in ctx


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


if __name__ == "__main__":
    unittest.main()
