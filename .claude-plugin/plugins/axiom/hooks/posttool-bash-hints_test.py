"""Offline tests for posttool-bash-hints hook.

Run with:
    python3 -m unittest hooks/posttool-bash-hints_test.py

Each test feeds a JSON payload on stdin AND a CLAUDE_TOOL_OUTPUT env var
(the actual command output) and inspects the hook's stdout. The hook
never exits non-zero, so we assert on stdout shape + content.
"""
import json
import os
import subprocess
import unittest

HOOK = os.path.join(os.path.dirname(__file__), "posttool-bash-hints.py")


def run_hook(payload: dict, output: str = "", env_override: dict | None = None) -> tuple[str, int]:
    """Invoke the hook with the given stdin payload + tool output env var."""
    env = os.environ.copy()
    env["CLAUDE_TOOL_OUTPUT"] = output
    if env_override:
        env.update(env_override)
    result = subprocess.run(
        ["python3", HOOK],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=5,
        env=env,
    )
    return result.stdout, result.returncode


def bash_payload(command: str = "swift build", duration_ms: int | None = None) -> dict:
    """Canonical PostToolUse/Bash payload. duration_ms optional (per CC schema)."""
    payload: dict = {
        "session_id": "test-session",
        "tool_name": "Bash",
        "tool_input": {"command": command},
        "tool_response": {},
    }
    if duration_ms is not None:
        payload["duration_ms"] = duration_ms
    return payload


class TestPatternMatching(unittest.TestCase):
    """Each existing hint must still fire on output that matches its pattern."""

    def assert_hint(self, output: str, expected_substring: str):
        out, code = run_hook(bash_payload(), output=output)
        self.assertEqual(code, 0)
        self.assertIn(expected_substring, out)

    def test_auto_layout_conflict(self):
        self.assert_hint(
            "2026-04-25 10:00 [LayoutConstraints] Unable to simultaneously satisfy constraints.",
            "axiom-uikit",
        )

    def test_concurrency_actor_isolated(self):
        self.assert_hint(
            "error: Actor-isolated property 'foo' can not be referenced from a non-isolated context",
            "axiom-concurrency",
        )

    def test_concurrency_sendable(self):
        self.assert_hint("warning: capture of 'self' with non-Sendable type", "axiom-concurrency")

    def test_concurrency_data_race(self):
        self.assert_hint("data race detected", "axiom-concurrency")

    def test_concurrency_main_actor(self):
        self.assert_hint("error: call to @MainActor-isolated function in a synchronous nonisolated context", "axiom-concurrency")

    def test_database_no_such_column(self):
        self.assert_hint("SQLite error: no such column: createdAt", "axiom-data")

    def test_database_foreign_key(self):
        self.assert_hint("Error: FOREIGN KEY constraint failed", "axiom-data")

    def test_database_migration_keyword(self):
        self.assert_hint("CoreData: error during migration", "axiom-data")

    def test_memory_retain_cycle(self):
        self.assert_hint("Possible retain cycle detected", "axiom-performance")

    def test_memory_leak(self):
        self.assert_hint("Leaks: memory leak in MyClass", "axiom-performance")

    def test_memory_deinit_never_called(self):
        self.assert_hint("Warning: deinit of MyClass was never called", "axiom-performance")

    def test_cloudkit_error(self):
        self.assert_hint("CKError 11: zone not found", "axiom-data")

    def test_cloudkit_record_error(self):
        self.assert_hint("CKRecord encountered an error during save", "axiom-data")

    def test_icloud_ubiquitous_error(self):
        self.assert_hint("ubiquitous container error: 1234", "axiom-data")

    def test_icloud_drive_keyword(self):
        self.assert_hint("Error syncing iCloud Drive document", "axiom-data")

    def test_icloud_file_coordinator(self):
        self.assert_hint("NSFileCoordinator: file not available", "axiom-data")

    def test_file_disappeared(self):
        self.assert_hint("Error: file disappeared during read", "axiom-data")

    def test_file_not_found(self):
        self.assert_hint("error: file not found at /tmp/x", "axiom-data")

    def test_storage_full(self):
        self.assert_hint("write failed: storage is full", "axiom-data")

    def test_file_protection(self):
        self.assert_hint("FileProtection error: NSFileProtectionComplete", "axiom-data")

    def test_data_protection(self):
        self.assert_hint("data protection unavailable while locked", "axiom-data")

    def test_file_locked(self):
        self.assert_hint("Error: file is locked by another process", "axiom-data")

    def test_module_not_found(self):
        self.assert_hint("error: no such module 'Foo' not found", "/axiom:fix-build")

    def test_linker_command_failed(self):
        self.assert_hint("ld: linker command failed with exit code 1", "/axiom:fix-build")


class TestMultiHint(unittest.TestCase):
    def test_multiple_patterns_fire_from_single_output(self):
        # A build that surfaces both a concurrency error AND a linker
        # failure should emit both hints.
        output = (
            "warning: capture of 'self' with non-Sendable type 'MyClass'\n"
            "ld: linker command failed with exit code 1\n"
        )
        out, _ = run_hook(bash_payload(), output=output)
        self.assertIn("axiom-concurrency", out)
        self.assertIn("/axiom:fix-build", out)
        # Each hint should be on its own line.
        lines = [line for line in out.splitlines() if line.strip()]
        self.assertEqual(len(lines), 2)


class TestSilentNoOps(unittest.TestCase):
    def test_non_bash_tool_emits_nothing(self):
        # Even with matching output, a non-Bash tool shouldn't trigger.
        payload = {
            "session_id": "test",
            "tool_name": "Edit",
            "tool_input": {"file_path": "/tmp/x.swift"},
            "tool_response": {},
        }
        out, code = run_hook(payload, output="data race detected")
        self.assertEqual(code, 0)
        self.assertEqual(out, "")

    def test_no_matching_pattern_emits_nothing(self):
        out, code = run_hook(bash_payload(), output="hello world\n")
        self.assertEqual(code, 0)
        self.assertEqual(out, "")

    def test_empty_output_emits_nothing(self):
        out, code = run_hook(bash_payload(), output="")
        self.assertEqual(code, 0)
        self.assertEqual(out, "")

    def test_missing_env_var_emits_nothing(self):
        # If CLAUDE_TOOL_OUTPUT is unset entirely (not just empty), the
        # hook should treat output as empty and emit nothing.
        result = subprocess.run(
            ["python3", HOOK],
            input=json.dumps(bash_payload()),
            capture_output=True,
            text=True,
            timeout=5,
            # Strip the var from env entirely
            env={k: v for k, v in os.environ.items() if k != "CLAUDE_TOOL_OUTPUT"},
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_malformed_json_is_silent(self):
        result = subprocess.run(
            ["python3", HOOK],
            input="not json",
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_missing_tool_name_emits_nothing(self):
        payload = {"session_id": "test", "tool_input": {}}
        out, code = run_hook(payload, output="data race detected")
        self.assertEqual(code, 0)
        self.assertEqual(out, "")


class TestSlowXcodebuildHint(unittest.TestCase):
    """Long xcodebuild + failure output → zombie-process hint."""

    def test_slow_failed_xcodebuild_emits_hint(self):
        out, _ = run_hook(
            bash_payload("xcodebuild -scheme MyApp build", duration_ms=70_000),
            output="error: linker command failed with exit code 1\n** BUILD FAILED **",
        )
        self.assertIn("Long xcodebuild", out)
        self.assertIn("zombie processes", out)
        self.assertIn("/axiom:fix-build", out)
        # Duration formatted as seconds.
        self.assertIn("70s", out)

    def test_slow_failed_xcodebuild_with_env_prefix(self):
        out, _ = run_hook(
            bash_payload("env DEVELOPER_DIR=/foo xcodebuild build", duration_ms=120_000),
            output="error: something\n** BUILD FAILED **",
        )
        self.assertIn("Long xcodebuild", out)

    def test_slow_failed_xcodebuild_with_absolute_path(self):
        out, _ = run_hook(
            bash_payload(
                "/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild build",
                duration_ms=70_000,
            ),
            output="** BUILD FAILED **",
        )
        self.assertIn("Long xcodebuild", out)

    def test_slow_xcodebuild_with_clean_output_no_hint(self):
        # Slow but successful builds are normal — no hint.
        out, _ = run_hook(
            bash_payload("xcodebuild build", duration_ms=70_000),
            output="** BUILD SUCCEEDED **",
        )
        self.assertNotIn("Long xcodebuild", out)
        self.assertNotIn("zombie", out)

    def test_fast_failed_xcodebuild_no_hint(self):
        # Below threshold, no zombie suspicion.
        out, _ = run_hook(
            bash_payload("xcodebuild build", duration_ms=30_000),
            output="** BUILD FAILED **",
        )
        self.assertNotIn("Long xcodebuild", out)

    def test_long_non_xcodebuild_no_hint(self):
        # A 10-minute npm install shouldn't trigger an xcodebuild hint.
        out, _ = run_hook(
            bash_payload("npm install", duration_ms=600_000),
            output="error: ENOENT",
        )
        self.assertNotIn("Long xcodebuild", out)
        self.assertNotIn("zombie", out)

    def test_xcodebuild_mention_in_echo_no_hint(self):
        # `echo "xcodebuild test"` with build-failure-looking text in
        # output shouldn't trigger — the command isn't actually xcodebuild.
        out, _ = run_hook(
            bash_payload('echo "xcodebuild test"', duration_ms=70_000),
            output="** BUILD FAILED **",
        )
        self.assertNotIn("Long xcodebuild", out)

    def test_missing_duration_no_hint(self):
        # No duration_ms in payload → no duration hints, but pattern
        # hints still work.
        out, _ = run_hook(
            bash_payload("xcodebuild build"),
            output="** BUILD FAILED **\nlinker command failed",
        )
        self.assertNotIn("Long xcodebuild", out)
        # Pattern hint for linker still fires though.
        self.assertIn("/axiom:fix-build", out)


class TestSlowTestHint(unittest.TestCase):
    """Long xcodebuild test → axiom-testing parallelization hint."""

    def test_slow_test_emits_hint(self):
        out, _ = run_hook(
            bash_payload("xcodebuild test -scheme MyApp", duration_ms=360_000),
            output="Test Suite 'All tests' passed.",
        )
        self.assertIn("Slow test run", out)
        self.assertIn("axiom-testing", out)
        self.assertIn("360s", out)

    def test_test_without_building_also_triggers(self):
        out, _ = run_hook(
            bash_payload("xcodebuild test-without-building", duration_ms=400_000),
            output="passed",
        )
        self.assertIn("Slow test run", out)

    def test_fast_test_no_hint(self):
        out, _ = run_hook(
            bash_payload("xcodebuild test", duration_ms=120_000),
            output="passed",
        )
        self.assertNotIn("Slow test run", out)

    def test_slow_test_does_not_double_fire_as_build(self):
        # An xcodebuild test that took 6 minutes shouldn't also trigger
        # the build hint — the test rule and build rule are mutually
        # exclusive.
        out, _ = run_hook(
            bash_payload("xcodebuild test", duration_ms=400_000),
            # Intentionally include `error:` in output to check the
            # build rule doesn't fire on top.
            output="Test failed: error: assertion\n",
        )
        self.assertIn("Slow test run", out)
        self.assertNotIn("Long xcodebuild", out)

    def test_pattern_hint_can_coexist_with_duration_hint(self):
        # Both a pattern hint and a duration hint can fire on the same call.
        out, _ = run_hook(
            bash_payload("xcodebuild test", duration_ms=400_000),
            output="warning: data race detected\n",
        )
        self.assertIn("axiom-concurrency", out)  # pattern
        self.assertIn("Slow test run", out)      # duration


class TestCommandHelpers(unittest.TestCase):
    """Direct unit tests for the xcodebuild detection helpers."""

    def setUp(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location("posttool_bash_hints", HOOK)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.is_xcb = mod._is_xcodebuild_command
        self.is_xcb_test = mod._is_xcodebuild_test_command

    def test_plain_xcodebuild(self):
        self.assertTrue(self.is_xcb("xcodebuild build"))
        self.assertTrue(self.is_xcb("xcodebuild -scheme Foo build"))

    def test_xcodebuild_with_prefix(self):
        self.assertTrue(self.is_xcb("env DEVELOPER_DIR=/x xcodebuild build"))
        self.assertTrue(self.is_xcb("sudo xcodebuild build"))
        self.assertTrue(self.is_xcb("time xcodebuild build"))

    def test_absolute_path_xcodebuild(self):
        self.assertTrue(self.is_xcb("/usr/bin/xcodebuild build"))

    def test_xcodebuild_in_string_not_matched(self):
        self.assertFalse(self.is_xcb('echo "xcodebuild build"'))
        self.assertFalse(self.is_xcb("echo 'xcodebuild build'"))

    def test_xcodebuild_in_comment_not_matched(self):
        self.assertFalse(self.is_xcb("# xcodebuild build"))
        self.assertFalse(self.is_xcb("ls -la  # xcodebuild templates"))

    def test_xcodebuild_substring_not_matched(self):
        self.assertFalse(self.is_xcb("ls xcodebuild-templates/"))
        self.assertFalse(self.is_xcb("cat xcodebuild.log"))

    def test_test_subcommand(self):
        self.assertTrue(self.is_xcb_test("xcodebuild test"))
        self.assertTrue(self.is_xcb_test("xcodebuild -scheme Foo test -destination ..."))
        self.assertTrue(self.is_xcb_test("xcodebuild test-without-building"))

    def test_build_subcommand_not_test(self):
        self.assertFalse(self.is_xcb_test("xcodebuild build"))
        self.assertFalse(self.is_xcb_test("xcodebuild clean build"))

    def test_non_xcodebuild_test(self):
        # `swift test` is not xcodebuild test — different command, our
        # rule shouldn't fire.
        self.assertFalse(self.is_xcb_test("swift test"))


class TestMatchPatternsUnit(unittest.TestCase):
    """Direct unit tests for the matcher, without subprocess overhead."""

    def setUp(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location("posttool_bash_hints", HOOK)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.match = mod.match_patterns

    def test_empty_output(self):
        self.assertEqual(self.match(""), [])
        self.assertEqual(self.match(None), [])

    def test_single_match(self):
        hints = self.match("data race detected")
        self.assertEqual(len(hints), 1)
        self.assertIn("axiom-concurrency", hints[0])

    def test_multiple_matches_preserve_rule_order(self):
        # Auto Layout rule is first in _PATTERN_RULES, linker is last.
        hints = self.match(
            "Unable to simultaneously satisfy constraints\n"
            "ld: linker command failed"
        )
        self.assertEqual(len(hints), 2)
        self.assertIn("axiom-uikit", hints[0])
        self.assertIn("/axiom:fix-build", hints[1])


if __name__ == "__main__":
    unittest.main()
