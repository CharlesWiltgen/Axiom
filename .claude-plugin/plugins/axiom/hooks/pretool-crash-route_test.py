"""Offline tests for pretool-crash-route hook.

Run with:
    python3 -m unittest hooks/pretool-crash-route_test.py

Each test feeds a JSON payload on stdin (via subprocess) and inspects
the hook's stdout. The hook never exits non-zero, so we assert stdout
shape + content rather than exit code.
"""
import json
import os
import subprocess
import unittest

HOOK = os.path.join(os.path.dirname(__file__), "pretool-crash-route.py")


def run_hook(payload: dict) -> tuple[str, int]:
    """Invoke the hook with the given payload, return (stdout, exit_code)."""
    result = subprocess.run(
        ["python3", HOOK],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=5,
    )
    return result.stdout, result.returncode


def read_payload(file_path: str) -> dict:
    """Build a canonical PreToolUse/Read payload for the given path."""
    return {
        "session_id": "test-session",
        "tool_name": "Read",
        "tool_input": {"file_path": file_path},
    }


class TestCrashPathRouting(unittest.TestCase):
    def test_ips_emits_xcsym_hint(self):
        out, code = run_hook(read_payload("/tmp/mycrash.ips"))
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertEqual(
            payload["hookSpecificOutput"]["hookEventName"], "PreToolUse"
        )
        hint = payload["hookSpecificOutput"]["additionalContext"]
        self.assertIn("xcsym crash", hint)
        self.assertIn("/tmp/mycrash.ips", hint)

    def test_legacy_crash_emits_xcsym_hint(self):
        out, _ = run_hook(read_payload("/tmp/report.crash"))
        payload = json.loads(out)
        hint = payload["hookSpecificOutput"]["additionalContext"]
        self.assertIn("xcsym crash", hint)
        self.assertIn("legacy", hint.lower())

    def test_xccrashpoint_inner_crash_routes_to_xcsym(self):
        # .crash file nested inside an .xccrashpoint bundle — this is
        # exactly the path users get when running Organizer → Show in
        # Finder → drill into Filters/*/Logs.
        inner = "/Users/me/MyApp/Crashes/Points/ABC.xccrashpoint/Filters/Filter_X/Logs/2026-04-12_18-04-38.4848_+0300-abc.crash"
        out, _ = run_hook(read_payload(inner))
        payload = json.loads(out)
        hint = payload["hookSpecificOutput"]["additionalContext"]
        self.assertIn("xcsym crash", hint)
        # Bundle-specific routing should mention LocallySymbolicated
        # since that variant is the preferred one when present.
        self.assertIn("LocallySymbolicated", hint)

    def test_xccrashpoint_bundle_root_suggests_inner_path(self):
        # The bundle itself is a directory — xcsym can't parse it
        # directly, so the hint must point at Filters/*/Logs/*.crash.
        out, _ = run_hook(read_payload("/Users/me/Crashes/ABC.xccrashpoint"))
        payload = json.loads(out)
        hint = payload["hookSpecificOutput"]["additionalContext"]
        self.assertIn("Filters", hint)
        self.assertIn("Logs", hint)
        self.assertIn(".crash", hint)

    def test_xccrashpoint_inner_other_file(self):
        # Non-crash file inside a bundle (e.g. DistributionInfo.json) —
        # the user probably meant to analyze the crash; route them to it.
        out, _ = run_hook(
            read_payload("/Users/me/Crashes/ABC.xccrashpoint/Filters/X/DistributionInfo.json")
        )
        payload = json.loads(out)
        hint = payload["hookSpecificOutput"]["additionalContext"]
        self.assertIn("Filters", hint)
        self.assertIn(".crash", hint)

    def test_non_crash_path_emits_nothing(self):
        out, code = run_hook(read_payload("/tmp/notes.txt"))
        self.assertEqual(code, 0)
        self.assertEqual(out, "")

    def test_non_read_tool_emits_nothing(self):
        # Writing to a .ips file shouldn't trigger the hint — the hook
        # is Read-specific.
        payload = {
            "session_id": "test",
            "tool_name": "Write",
            "tool_input": {"file_path": "/tmp/x.ips"},
        }
        out, code = run_hook(payload)
        self.assertEqual(code, 0)
        self.assertEqual(out, "")

    def test_missing_file_path_emits_nothing(self):
        payload = {"session_id": "test", "tool_name": "Read", "tool_input": {}}
        out, code = run_hook(payload)
        self.assertEqual(code, 0)
        self.assertEqual(out, "")

    def test_malformed_json_is_silent(self):
        # Feed raw non-JSON to the hook — it must not crash.
        result = subprocess.run(
            ["python3", HOOK],
            input="not json",
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_path_with_spaces_is_preserved(self):
        # Quote-sensitive path — the hint's {path} substitution must
        # not mangle spaces (the agent needs to be able to copy-paste
        # the command verbatim).
        p = "/Users/me/My App/crash report.ips"
        out, _ = run_hook(read_payload(p))
        payload = json.loads(out)
        hint = payload["hookSpecificOutput"]["additionalContext"]
        self.assertIn(p, hint)


class TestClassifyPath(unittest.TestCase):
    """Unit tests for the classifier, loaded directly for finer-grained
    assertions than the subprocess-based tests above provide.
    """

    def setUp(self):
        # Import classify_path from the hook module. The hook filename
        # has a dash, which isn't a valid Python identifier, so we load
        # it via importlib.
        import importlib.util

        spec = importlib.util.spec_from_file_location("pretool_crash_route", HOOK)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.classify = mod.classify_path

    def test_empty_path(self):
        self.assertEqual(self.classify(""), "")
        self.assertEqual(self.classify(None), "")

    def test_plain_crash_types(self):
        self.assertEqual(self.classify("/tmp/x.ips"), "ips")
        self.assertEqual(self.classify("/tmp/x.crash"), "crash_text")

    def test_xccrashpoint_variants(self):
        self.assertEqual(self.classify("/a/b.xccrashpoint"), "xccrashpoint_bundle_root")
        self.assertEqual(self.classify("/a/b.xccrashpoint/"), "xccrashpoint_bundle_root")
        self.assertEqual(
            self.classify("/a/b.xccrashpoint/Filters/X/Logs/y.crash"),
            "xccrashpoint_inner_crash",
        )
        self.assertEqual(
            self.classify("/a/b.xccrashpoint/Filters/X/PointInfo.json"),
            "xccrashpoint_inner_other",
        )

    def test_non_matches(self):
        self.assertEqual(self.classify("/tmp/crashes.txt"), "")
        self.assertEqual(self.classify("/tmp/myscript.py"), "")
        # Endswith .ips is not the same as "contains .ips" — guard
        # against false positives on hashed/random paths.
        self.assertEqual(self.classify("/tmp/x.ips.backup"), "")


if __name__ == "__main__":
    unittest.main()
