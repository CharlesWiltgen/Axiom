import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SOURCE = Path(__file__).with_name("codex-lifecycle.py")
spec = importlib.util.spec_from_file_location("codex_lifecycle", SOURCE)
lifecycle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lifecycle)


class LifecycleTests(unittest.TestCase):
    def test_classifies_only_exposed_outcomes(self):
        cases = [
            ("completed", [], "completed"),
            (
                "failed",
                [{"kind": "error", "text": "Hook timed out after 1 seconds"}],
                "timeout",
            ),
            (
                "failed",
                [{"kind": "error", "text": "hook exited without a status code"}],
                "status_missing",
            ),
            (
                "failed",
                [{"kind": "error", "text": "Hook exited with code 7"}],
                "process_exit",
            ),
            (
                "failed",
                [{"kind": "error", "text": "invalid JSON output"}],
                "parse_error",
            ),
            (
                "failed",
                [
                    {
                        "kind": "error",
                        "text": "hook returned invalid user prompt submit JSON output",
                    }
                ],
                "parse_error",
            ),
            (
                "failed",
                [{"kind": "error", "text": "unrecognized synthetic error"}],
                "unknown_failure",
            ),
        ]
        self.assertEqual(
            [lifecycle.classify(status, entries) for status, entries, _ in cases],
            [expected for _, _, expected in cases],
        )

    def test_retains_each_failure_without_overwriting(self):
        with tempfile.TemporaryDirectory() as root:
            report = {"status": "failed", "checks": {"control": False}}
            first = lifecycle.retain(Path(root), report)
            second = lifecycle.retain(Path(root), report)
            self.assertNotEqual(first, second)
            self.assertEqual(
                [json.loads(p.read_text()) for p in (first, second)], [report, report]
            )
            self.assertEqual(
                [p.stat().st_mode & 0o777 for p in (first, second)], [0o600, 0o600]
            )

    def test_bounds_stdin_write_when_runner_does_not_read(self):
        read_fd, write_fd = os.pipe()
        runner = lifecycle.Runner.__new__(lifecycle.Runner)
        output = os.fdopen(write_fd, "wb")
        runner.process = SimpleNamespace(stdin=output)
        try:
            with self.assertRaises(lifecycle.HarnessError) as failure:
                runner.send({"input": "x" * 1_048_576}, seconds=0.02)
            self.assertEqual(failure.exception.kind, "io_timeout")
        finally:
            output.close()
            os.close(read_fd)

    def test_preserves_partial_report_when_cleanup_raises(self):
        def failed_cleanup(binary, package, case, report):
            report["checks"]["installed"] = True
            raise ValueError("AUTHORED_CLEANUP_FAILURE")

        with patch.object(lifecycle, "_run_case", failed_cleanup, create=True):
            report = lifecycle.run_case("fixture", Path("."), "normal")
        self.assertEqual(
            (
                report["status"],
                report.get("harness_error"),
                report["checks"].get("installed"),
            ),
            ("failed", "postprocessing_error", True),
        )

    def test_rejects_failed_terminal_turn_without_error_notification(self):
        def failed_turn(binary, package, case, report):
            report.update(turn_statuses=["failed"], runtime_errors=0)
            report["checks"]["control"] = True

        with patch.object(lifecycle, "_run_case", failed_turn, create=True):
            report = lifecycle.run_case("fixture", Path("."), "normal")
        self.assertEqual(
            (report["status"], report["checks"].get("turn_outcome")), ("failed", False)
        )

    def test_requires_selected_child_success_from_wait_output(self):
        cases = [
            ({"status": {"selected": {"completed": "AXIOM_CHILD_COMPLETE"}}}, True),
            ({"status": {"other": {"completed": "AXIOM_CHILD_COMPLETE"}}}, False),
            (
                {"status": {"selected": {"errored": "completed AXIOM_CHILD_COMPLETE"}}},
                False,
            ),
            ({"status": {}, "timed_out": True}, False),
            (
                {"status": {"selected": {"completed": "prefix AXIOM_CHILD_COMPLETE"}}},
                False,
            ),
        ]
        self.assertEqual(
            [
                lifecycle.completed_child(json.dumps(output), "selected")
                for output, _ in cases
            ],
            [expected for _, expected in cases],
        )
        self.assertFalse(lifecycle.completed_child("invalid JSON", "selected"))

    def test_rejects_subagent_dispatch_without_child_delivery_and_completion(self):
        cases = [
            ([], False),
            ([{"child": True, "subagent_context_complete": False}], True),
            ([{"child": True, "subagent_context_complete": True}], False),
        ]
        for requests, completed in cases:
            with self.subTest(requests=requests, completed=completed):

                def dispatched_only(
                    binary,
                    package,
                    case,
                    report,
                    requests=requests,
                    completed=completed,
                ):
                    report.update(
                        turn_statuses=["completed"],
                        transport={"requests": requests},
                        child_completed=completed,
                    )
                    report["checks"]["subagent_dispatch"] = True

                with patch.object(lifecycle, "_run_case", dispatched_only):
                    report = lifecycle.run_case("fixture", Path("."), "subagent")
                self.assertEqual(report["status"], "failed")

    def test_detects_full_multiline_context_in_serialized_input(self):
        request = json.dumps([{"text": lifecycle.OFFLOAD}])
        self.assertTrue(lifecycle.context_present(lifecycle.OFFLOAD, request))
        self.assertFalse(
            lifecycle.context_present(
                lifecycle.OFFLOAD,
                json.dumps([{"text": "AXIOM_OFFLOAD_HEAD preview AXIOM_OFFLOAD_TAIL"}]),
            )
        )

    def test_cleanup_terminates_owned_runner_descendants(self):
        with tempfile.TemporaryDirectory() as root:
            marker = Path(root) / "survived"
            ready = Path(root) / "ready"
            executable = Path(root) / "runner"
            child = f"import time; from pathlib import Path; time.sleep(.5); Path({str(marker)!r}).touch()"
            executable.write_text(
                f"#!{sys.executable}\nimport subprocess,sys,time\nfrom pathlib import Path\nsubprocess.Popen([sys.executable,'-c',{child!r}])\nPath({str(ready)!r}).touch()\ntime.sleep(5)\n"
            )
            executable.chmod(0o700)
            with open(os.devnull, "wb") as stderr:
                runner = lifecycle.Runner(
                    str(executable), root, {"PATH": os.environ["PATH"]}, stderr
                )
                deadline = time.monotonic() + 2
                while not ready.exists() and time.monotonic() < deadline:
                    time.sleep(0.01)
                self.assertTrue(ready.exists())
                runner.close()
            time.sleep(0.6)
            self.assertFalse(marker.exists())

    def test_setup_timeout_terminates_owned_descendants(self):
        with tempfile.TemporaryDirectory() as root:
            marker = Path(root) / "survived"
            child = f"import time; from pathlib import Path; time.sleep(.5); Path({str(marker)!r}).touch()"
            program = f"import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',{child!r}]); time.sleep(5)"
            with self.assertRaises(subprocess.TimeoutExpired):
                lifecycle.run_command(
                    [sys.executable, "-c", program], {"PATH": os.environ["PATH"]}, 0.2
                )
            time.sleep(0.6)
            self.assertFalse(marker.exists())

    def test_provider_cleanup_survives_runner_cleanup_error(self):
        servers = []

        class Server:
            server_port = 12345

            def __init__(self, *args):
                self.shutdown_called = self.closed = False
                servers.append(self)

            def serve_forever(self):
                pass

            def shutdown(self):
                self.shutdown_called = True

            def server_close(self):
                self.closed = True

        class FailingRunner:
            def __init__(self, *args):
                self.messages = []

            def call(self, *args):
                raise lifecycle.HarnessError("rpc_error")

            def close(self):
                raise OSError("AUTHORED_CLEANUP_ERROR")

        def setup(command, env, timeout):
            if command[1] == "--version":
                return SimpleNamespace(stdout="authored fake")
            config = Path(env["CODEX_HOME"])
            (config / "config.toml").touch()
            installed = config / "plugins"
            installed.mkdir(exist_ok=True)
            return SimpleNamespace(
                stdout=json.dumps(
                    {
                        "installedPath": str(installed),
                        "pluginId": "axiom@axiom-disposable",
                        "version": "fixture",
                    }
                )
            )

        with (
            tempfile.TemporaryDirectory() as root,
            patch.object(lifecycle, "run_command", setup),
            patch.object(lifecycle, "Runner", FailingRunner),
            patch.object(lifecycle, "ThreadingHTTPServer", Server),
        ):
            report = lifecycle.run_case("unused", Path(root), "normal")
        self.assertEqual(
            (
                servers[0].shutdown_called,
                servers[0].closed,
                report.get("harness_error"),
                report.get("cleanup_error"),
            ),
            (True, True, "rpc_error", "OSError"),
        )

    def test_rejects_nonzero_terminal_positive_control(self):
        def nonzero_terminal(binary, package, case, report):
            report.update(turn_statuses=["completed"], terminal_exit_codes=[7])
            report["checks"]["control"] = True

        with patch.object(lifecycle, "_run_case", nonzero_terminal):
            report = lifecycle.run_case("fixture", Path("."), "normal")
        self.assertEqual(
            (report["status"], report["checks"].get("terminal_exit_zero")),
            ("failed", False),
        )

    def test_cancel_diagnostics_match_completed_hook_identity(self):
        session_start = {
            "correlation": "session",
            "hook": "session-start",
            "phase": "start",
        }
        session_end = {**session_start, "phase": "end"}
        prompt_start = {
            "correlation": "prompt",
            "hook": "user-prompt-submit",
            "phase": "start",
        }
        prompt_end = {**prompt_start, "phase": "end"}
        completed, started = ["session-start"], ["session-start", "user-prompt-submit"]
        cases = [
            ([session_start, session_end, prompt_start, prompt_end], True),
            ([session_start, session_end, prompt_start], True),
            ([session_start, prompt_start, prompt_end], False),
        ]
        self.assertEqual(
            [
                lifecycle.diagnostics_valid(records, completed, started, True)
                for records, expected in cases
            ],
            [expected for records, expected in cases],
        )

    def test_requires_explicit_opt_in(self):
        result = subprocess.run(
            [sys.executable, str(SOURCE)], capture_output=True, timeout=5, check=False
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn(b"--run", result.stderr)

    def test_retains_launch_failure(self):
        with tempfile.TemporaryDirectory() as root:
            result = subprocess.run(
                [
                    sys.executable,
                    str(SOURCE),
                    "--run",
                    "--binary",
                    root + "/absent",
                    "--package",
                    str(SOURCE.parent.parent / "axiom-codex"),
                    "--evidence",
                    root,
                    "--case",
                    "normal",
                ],
                capture_output=True,
                timeout=5,
                check=False,
            )
            reports = list(Path(root).glob("*/report.json"))
            self.assertEqual(result.returncode, 1)
            self.assertEqual(len(reports), 1)
            report = json.loads(reports[0].read_text())
            self.assertEqual(
                (report["status"], report["harness_error"]), ("failed", "launch_error")
            )


if __name__ == "__main__":
    unittest.main()
