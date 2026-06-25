"""Behavioral tests for the swift-guardrails hook (bd axiom-f82e, axiom-tybr, axiom-pepz).

Runs the hook as a subprocess (like the other hook behavioral tests), feeding
tool_input on stdin in both harness shapes and inspecting the stdout JSON:
  - Claude Code Write/Edit: {"tool_input": {"file_path": "<path>"}}
  - Codex apply_patch:       {"tool_input": "*** Begin Patch ... *** Update File: <path> ..."}

The hook reads the file ON DISK (PostToolUse runs after the edit), so each test
writes a real temp .swift file and references its absolute path.

Run from the hooks dir:
    python3 -m unittest swift-guardrails_test -v
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(HOOKS_DIR, "swift-guardrails.py")

OFFENDING = "struct V: View {\n    @State var count = 0\n    var body: some View { Text(\"\\(count)\") }\n}\n"


def run_hook(stdin: str) -> subprocess.CompletedProcess:
    """Invoke the hook with raw stdin text; return the completed process."""
    return subprocess.run(
        [sys.executable, HOOK],
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


def block_context(stdin: str) -> str:
    """The additionalContext of any response ('' if the hook emitted nothing)."""
    result = run_hook(stdin)
    out = result.stdout.strip()
    if not out:
        return ""
    return json.loads(out).get("hookSpecificOutput", {}).get("additionalContext", "")


def warns(stdin: str) -> bool:
    """True if the hook injected advisory additionalContext WITHOUT blocking."""
    result = run_hook(stdin)
    out = result.stdout.strip()
    if not out:
        return False
    d = json.loads(out)
    return d.get("decision") != "block" and bool(
        d.get("hookSpecificOutput", {}).get("additionalContext")
    )


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

    def test_state_inside_multiline_string_does_not_block(self):
        # A verbatim @State var inside a """ block literal must not false-block.
        with tempfile.TemporaryDirectory() as d:
            body = 'let code = """\n@State var x = 0\n"""\n'
            self.assertFalse(blocks(claude_stdin(write_swift(d, body))))

    def test_non_utf8_byte_in_flagged_line_still_valid_json(self):
        # A grep-based check can carry raw non-UTF-8 bytes from a Swift line into the
        # message; the JSON escaping must replace them, not crash into a value-less field.
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "V.swift")
            with open(path, "wb") as f:
                f.write(b"struct V {\n    @State var count = 0 // \xff\xfe\n}\n")
            result = run_hook(claude_stdin(path))
            self.assertEqual(result.returncode, 0)
            self.assertEqual(json.loads(result.stdout).get("decision"), "block")


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
        self.assertEqual(result.stdout.strip(), "")  # unresolved path → no finding

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


def model(rel_line: str, *, multiline: str = "") -> str:
    """A minimal @Model class embedding a relationship declaration."""
    decl = multiline or rel_line
    return f"import SwiftData\n\n@Model final class Library {{\n    {decl}\n    init() {{}}\n}}\n"


class TestRelationshipGuardrail(unittest.TestCase):
    # @Relationship-without-default is WARN-tier (advisory), not block (warn-first):
    # offending → additionalContext without a block; clean → no output at all.
    def _warns(self, body: str, name: str = "Model.swift") -> bool:
        with tempfile.TemporaryDirectory() as d:
            return warns(claude_stdin(write_swift(d, body, name)))

    def _silent(self, body: str, name: str = "Model.swift") -> bool:
        with tempfile.TemporaryDirectory() as d:
            stdin = claude_stdin(write_swift(d, body, name))
            return not blocks(stdin) and block_context(stdin) == ""

    def test_to_many_without_default_warns(self):
        self.assertTrue(self._warns(model("@Relationship var books: [Book]")))

    def test_to_many_without_default_does_not_block(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(blocks(claude_stdin(write_swift(d, model("@Relationship var books: [Book]")))))

    def test_to_many_with_args_without_default_warns(self):
        self.assertTrue(self._warns(model("@Relationship(deleteRule: .cascade) var tags: [Tag]")))

    def test_attribute_on_own_line_warns(self):
        body = model("", multiline="@Relationship(deleteRule: .cascade, inverse: \\Book.library)\n    var books: [Book]")
        self.assertTrue(self._warns(body))

    def test_to_many_with_default_silent(self):
        self.assertTrue(self._silent(model("@Relationship var books: [Book] = []")))

    def test_to_one_optional_silent(self):
        self.assertTrue(self._silent(model("@Relationship var parent: Shelf?")))

    def test_to_one_silent(self):
        self.assertTrue(self._silent(model("@Relationship var owner: Person")))

    def test_commented_relationship_silent(self):
        self.assertTrue(self._silent(model("// @Relationship var books: [Book]")))

    def test_axiom_ignore_silent(self):
        self.assertTrue(self._silent(model("@Relationship var books: [Book] // axiom-ignore")))

    def test_string_literal_silent(self):
        # The pattern inside a string literal must not fire at all (parity with @State).
        body = "struct Doc {\n    let hint = \"@Relationship var books: [Book]\"\n}\n"
        self.assertTrue(self._silent(body))

    def test_dictionary_type_silent(self):
        # [K: V] is a dictionary, not a to-many array — "add = []" would be wrong advice.
        self.assertTrue(self._silent(model("@Relationship var index: [String: Book]")))

    def test_default_on_continuation_line_silent(self):
        body = model("", multiline="@Relationship var books: [Book]\n        = []")
        self.assertTrue(self._silent(body))

    def test_to_many_set_without_default_warns(self):
        self.assertTrue(self._warns(model("@Relationship var books: Set<Book>")))

    def test_set_with_default_silent(self):
        self.assertTrue(self._silent(model("@Relationship var books: Set<Book> = []")))

    def test_optional_set_silent(self):
        self.assertTrue(self._silent(model("@Relationship var books: Set<Book>?")))

    def test_optional_array_silent(self):
        self.assertTrue(self._silent(model("@Relationship var books: [Book]?")))

    def test_long_form_array_without_default_warns(self):
        self.assertTrue(self._warns(model("@Relationship var books: Array<Book>")))

    def test_long_form_array_with_default_silent(self):
        self.assertTrue(self._silent(model("@Relationship var books: Array<Book> = []")))

    def test_relationship_inside_multiline_string_silent(self):
        body = 'import SwiftData\nlet snippet = """\n@Relationship var b: [B]\n"""\n'
        self.assertTrue(self._silent(body))


class TestEscapeHatchScoping(unittest.TestCase):
    # `// axiom-ignore` silences all checks; `// axiom-ignore:<name>` silences only one.
    def _state_file(self, line: str) -> str:
        return f"struct V: View {{\n    {line}\n    var body: some View {{ Text(\"x\") }}\n}}\n"

    def _rel_file(self, line: str) -> str:
        return f"import SwiftData\n@Model final class L {{\n    {line}\n    init() {{}}\n}}\n"

    def _blocks_file(self, body: str) -> bool:
        with tempfile.TemporaryDirectory() as d:
            return blocks(claude_stdin(write_swift(d, body)))

    def _warns_file(self, body: str) -> bool:
        with tempfile.TemporaryDirectory() as d:
            return warns(claude_stdin(write_swift(d, body)))

    def test_scoped_ignore_silences_only_its_check(self):
        # state-scoped ignore silences @State but not @Relationship, and vice versa.
        self.assertFalse(self._blocks_file(self._state_file("@State var x = 0 // axiom-ignore:state")))
        self.assertTrue(self._blocks_file(self._state_file("@State var x = 0 // axiom-ignore:relationship")))
        self.assertFalse(self._warns_file(self._rel_file("@Relationship var b: [B] // axiom-ignore:relationship")))
        self.assertTrue(self._warns_file(self._rel_file("@Relationship var b: [B] // axiom-ignore:state")))

    def test_bare_ignore_silences_both(self):
        self.assertFalse(self._blocks_file(self._state_file("@State var x = 0 // axiom-ignore")))
        self.assertFalse(self._warns_file(self._rel_file("@Relationship var b: [B] // axiom-ignore")))

    def test_ignore_name_is_not_substring_matched(self):
        # `axiom-ignore:statement` / `:states` must NOT silence `state`.
        self.assertTrue(self._blocks_file(self._state_file("@State var x = 0 // axiom-ignore:statement")))
        self.assertTrue(self._blocks_file(self._state_file("@State var x = 0 // axiom-ignore:states")))


class TestTierInteraction(unittest.TestCase):
    def test_block_and_warn_coexist_in_one_response(self):
        # @State (block) + bad @Relationship (warn) in one file → a BLOCK response whose
        # additionalContext carries both findings.
        body = (
            "import SwiftUI\nimport SwiftData\n\n"
            "@Model final class M {\n    @Relationship var items: [Item]\n    init() {}\n}\n\n"
            "struct V: View {\n    @State var count = 0\n    var body: some View { Text(\"x\") }\n}\n"
        )
        with tempfile.TemporaryDirectory() as d:
            stdin = claude_stdin(write_swift(d, body))
            self.assertTrue(blocks(stdin))  # @State is block-tier → blocks
            ctx = block_context(stdin)
        self.assertIn("@State", ctx)
        self.assertIn("@Relationship", ctx)


if __name__ == "__main__":
    unittest.main()
