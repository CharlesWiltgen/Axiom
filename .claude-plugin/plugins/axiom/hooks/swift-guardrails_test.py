"""Behavioral tests for the swift-guardrails hook (bd axiom-f82e, axiom-tybr).

Runs the bash hook as a subprocess (like the other hook behavioral tests),
feeding tool_input on stdin in both harness shapes and inspecting the stdout JSON:
  - Claude Code Write/Edit: {"tool_input": {"file_path": "<path>"}}
  - Codex apply_patch:       {"tool_input": "*** Begin Patch ... *** Update File: <path> ..."}

The hook greps the file ON DISK (PostToolUse runs after the edit), so each test
writes a real temp .swift file and references its absolute path.

Run from the hooks dir:
    python3 -m unittest swift-guardrails_test -v
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(HOOKS_DIR, "swift-guardrails.sh")

OFFENDING = "struct V: View {\n    @State var count = 0\n    var body: some View { Text(\"\\(count)\") }\n}\n"


def run_hook(stdin: str) -> subprocess.CompletedProcess:
    """Invoke the hook with raw stdin text; return the completed process."""
    return subprocess.run(
        ["bash", HOOK],
        input=stdin,
        capture_output=True,
        text=True,
        timeout=15,
    )


def blocks(stdin: str) -> bool:
    """True if the hook emitted a decision:'block' response (exit 0 in all cases)."""
    result = run_hook(stdin)
    assert result.returncode == 0, f"hook exited {result.returncode}: {result.stderr!r}"
    out = result.stdout.strip()
    if not out:
        return False
    return json.loads(out).get("decision") == "block"


def write_swift(directory: str, body: str, name: str = "View.swift") -> str:
    path = os.path.join(directory, name)
    with open(path, "w") as f:
        f.write(body)
    return path


def claude_stdin(path: str) -> str:
    return json.dumps({"tool_name": "Edit", "tool_input": {"file_path": path}})


class TestClaudeCodeShape(unittest.TestCase):
    def test_uncontrolled_state_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(blocks(claude_stdin(write_swift(d, OFFENDING))))

    def test_private_state_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            body = OFFENDING.replace("@State var", "@State private var")
            self.assertFalse(blocks(claude_stdin(write_swift(d, body))))

    def test_non_swift_file_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "notes.txt")
            with open(path, "w") as f:
                f.write("@State var count = 0\n")
            self.assertFalse(blocks(claude_stdin(path)))

    def test_missing_file_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(blocks(claude_stdin(os.path.join(d, "Gone.swift"))))

    def test_multiple_spaces_between_state_and_var_blocks(self):
        # Hardened detection: not only the single-space form.
        with tempfile.TemporaryDirectory() as d:
            body = "struct V {\n    @State  var count = 0\n}\n"
            self.assertTrue(blocks(claude_stdin(write_swift(d, body))))

    def test_access_modifier_before_state_does_not_block(self):
        # `private @State var` is access-controlled — a real Swift form that must not
        # trip the guardrail even though "@State var" appears on the line.
        with tempfile.TemporaryDirectory() as d:
            body = "struct V {\n    private @State var count = 0\n}\n"
            self.assertFalse(blocks(claude_stdin(write_swift(d, body))))


class TestFalsePositiveHardening(unittest.TestCase):
    def test_commented_line_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            body = "struct V {\n    // @State var count = 0\n}\n"
            self.assertFalse(blocks(claude_stdin(write_swift(d, body))))

    def test_doc_comment_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            body = "/// Prefer @State var only with access control\nstruct V {}\n"
            self.assertFalse(blocks(claude_stdin(write_swift(d, body))))

    def test_trailing_comment_mention_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            body = "struct V {\n    let x = 1 // see @State var docs\n}\n"
            self.assertFalse(blocks(claude_stdin(write_swift(d, body))))

    def test_string_literal_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            body = "struct V {\n    let hint = \"use @State var here\"\n}\n"
            self.assertFalse(blocks(claude_stdin(write_swift(d, body))))

    def test_axiom_ignore_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            body = "struct V {\n    @State var count = 0 // axiom-ignore\n}\n"
            self.assertFalse(blocks(claude_stdin(write_swift(d, body))))


class TestCodexApplyPatchShape(unittest.TestCase):
    def _patch(self, path: str) -> str:
        return (
            "*** Begin Patch\n"
            f"*** Update File: {path}\n"
            "@@\n"
            "+    @State var count = 0\n"
            "*** End Patch\n"
        )

    def test_bare_string_patch_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            path = write_swift(d, OFFENDING)
            self.assertTrue(blocks(json.dumps({"tool_input": self._patch(path)})))

    def test_nested_input_key_patch_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            path = write_swift(d, OFFENDING)
            self.assertTrue(
                blocks(json.dumps({"tool_input": {"input": self._patch(path)}}))
            )

    def test_command_key_patch_blocks(self):
        # The real Codex 0.142 apply_patch shape: patch text under tool_input.command
        # (confirmed via a live Codex session). Regression guard for that integration.
        with tempfile.TemporaryDirectory() as d:
            path = write_swift(d, OFFENDING)
            self.assertTrue(
                blocks(json.dumps({"tool_name": "apply_patch",
                                   "tool_input": {"command": self._patch(path)}}))
            )

    def test_relative_path_resolves_against_stdin_cwd_and_blocks(self):
        # The realistic Codex shape: apply_patch paths are workspace-relative and the
        # hook resolves them against the stdin `cwd`, not the hook's process cwd.
        with tempfile.TemporaryDirectory() as d:
            write_swift(d, OFFENDING, name="View.swift")
            patch = (
                "*** Begin Patch\n"
                "*** Update File: View.swift\n"
                "+    @State var count = 0\n"
                "*** End Patch\n"
            )
            self.assertTrue(blocks(json.dumps({"cwd": d, "tool_input": patch})))

    def test_relative_path_without_cwd_does_not_crash(self):
        # No cwd to resolve against → path stays relative → file-not-found → exit 0.
        patch = (
            "*** Begin Patch\n*** Update File: View.swift\n+    @State var x = 0\n*** End Patch\n"
        )
        result = run_hook(json.dumps({"tool_input": patch}))
        self.assertEqual(result.returncode, 0)

    def test_multi_file_patch_flags_offending_swift(self):
        with tempfile.TemporaryDirectory() as d:
            clean = write_swift(d, "struct A {}\n", name="A.swift")
            dirty = write_swift(d, OFFENDING, name="B.swift")
            patch = (
                "*** Begin Patch\n"
                f"*** Add File: {clean}\n"
                "+struct A {}\n"
                f"*** Update File: {dirty}\n"
                "+    @State var count = 0\n"
                "*** End Patch\n"
            )
            self.assertTrue(blocks(json.dumps({"tool_input": patch})))


class TestFailSafe(unittest.TestCase):
    def test_malformed_stdin_exits_zero_without_blocking(self):
        result = run_hook("not json at all")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_empty_stdin_exits_zero(self):
        result = run_hook("")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_non_object_json_exits_zero(self):
        result = run_hook(json.dumps([1, 2, 3]))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_missing_tool_input_exits_zero(self):
        result = run_hook(json.dumps({"tool_name": "Edit"}))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")


if __name__ == "__main__":
    unittest.main()
