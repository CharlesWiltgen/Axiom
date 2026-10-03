"""Behavioral tests for opt-in hook lifecycle diagnostics."""

from __future__ import annotations

import fcntl
import json
import os
import select
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HOOKS = Path(__file__).resolve().parent
NOTICE = "Axiom hook diagnostics unavailable.\n"
JOURNAL = "axiom-hooks.jsonl"
SECRET = "synthetic-private-prompt-token-path"


class TestHookDiagnostics(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.destination = self.root / "diagnostics"

    def run_hook(self, body="", destination=True):
        env = dict(os.environ, PYTHONPATH=str(HOOKS))
        env.pop("AXIOM_HOOK_DIAGNOSTICS_DIR", None)
        if destination:
            env["AXIOM_HOOK_DIAGNOSTICS_DIR"] = str(self.destination)
        return subprocess.run(
            [
                sys.executable,
                "-c",
                "import hook_diagnostics as d\nd.begin('posttool-bash-hints')\n" + body,
            ],
            env=env,
            input=SECRET,
            text=True,
            capture_output=True,
            check=False,
            timeout=3,
        )

    def records(self):
        return [
            json.loads(line)
            for line in (self.destination / JOURNAL).read_text().splitlines()
        ]

    def test_lifecycle(self):
        result = self.run_hook("print('{}')\n")
        self.assertEqual(
            (result.returncode, result.stdout, result.stderr), (0, "{}\n", "")
        )
        records = self.records()
        self.assertEqual([r["phase"] for r in records], ["start", "end"])
        expected_keys = {
            "schema_version",
            "hook",
            "event",
            "phase",
            "correlation",
            "elapsed_ms",
            "outcome",
            "exception_class",
        }
        for record in records:
            self.assertEqual(set(record), expected_keys)
            self.assertEqual(
                (record["schema_version"], record["hook"], record["event"]),
                (1, "posttool-bash-hints", "PostToolUse"),
            )
            self.assertRegex(record["correlation"], r"^[0-9a-f]{32}$")
            self.assertIsInstance(record["elapsed_ms"], int)
            self.assertGreaterEqual(record["elapsed_ms"], 0)
            self.assertLessEqual(len(json.dumps(record).encode()), 512)
        self.assertEqual([r["outcome"] for r in records], ["running", "success"])
        self.assertEqual(records[0]["correlation"], records[1]["correlation"])
        self.assertEqual(self.destination.stat().st_mode & 0o777, 0o700)
        self.assertEqual((self.destination / JOURNAL).stat().st_mode & 0o777, 0o600)
        self.assertNotIn(SECRET, (self.destination / JOURNAL).read_text())
        self.assertNotIn(str(self.root), (self.destination / JOURNAL).read_text())

    def test_disabled_has_no_side_effects(self):
        result = self.run_hook("print('{}')\n", destination=False)
        self.assertEqual(
            (result.returncode, result.stdout, result.stderr), (0, "{}\n", "")
        )
        self.assertEqual(list(self.root.iterdir()), [])

    def test_diagnostic_initialization_failure_preserves_protocol(self):
        env = dict(
            os.environ,
            PYTHONPATH=str(HOOKS),
            AXIOM_HOOK_DIAGNOSTICS_DIR=str(self.destination),
        )
        body = (
            "import hook_diagnostics as d\ndef fail(*args): raise OSError('"
            + SECRET
            + "')\nd.secrets.token_hex = fail\nd.begin('session-start')\nprint('{}')\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", body],
            env=env,
            text=True,
            capture_output=True,
            check=False,
            timeout=3,
        )
        self.assertEqual(
            (result.returncode, result.stdout, result.stderr), (0, "{}\n", NOTICE)
        )
        self.assertEqual(list(self.root.iterdir()), [])

    def test_closed_stderr_does_not_change_protocol_or_exit(self):
        self.destination.mkdir(mode=0o755)
        env = dict(os.environ, AXIOM_HOOK_DIAGNOSTICS_DIR=str(self.destination))
        read_fd, write_fd = os.pipe()
        os.close(read_fd)
        try:
            result = subprocess.run(
                [sys.executable, str(HOOKS / "user-prompt-submit.py")],
                input="{}",
                env=env,
                stdout=subprocess.PIPE,
                stderr=write_fd,
                text=True,
                check=False,
                timeout=3,
            )
        finally:
            os.close(write_fd)
        self.assertEqual((result.returncode, result.stdout), (0, "{}\n"))

    def test_caught_exception_is_sanitized_without_changing_exit(self):
        result = self.run_hook(
            "d.record_exception(ValueError('" + SECRET + "'))\nprint('{}')\n"
        )
        self.assertEqual(
            (result.returncode, result.stdout, result.stderr), (0, "{}\n", "")
        )
        end = self.records()[-1]
        self.assertEqual(
            (end["outcome"], end["exception_class"]), ("exception", "ValueError")
        )
        self.assertNotIn(SECRET, (self.destination / JOURNAL).read_text())

    def test_dynamic_exception_class_is_not_logged(self):
        result = self.run_hook(
            "error = type('"
            + SECRET
            + "', (Exception,), {})\nd.record_exception(error('secret'))\n"
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(self.records()[-1]["exception_class"], "Exception")

    def test_unhandled_exception_preserves_failure(self):
        result = self.run_hook("raise RuntimeError('" + SECRET + "')\n")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertEqual(
            (self.records()[-1]["outcome"], self.records()[-1]["exception_class"]),
            ("exception", "RuntimeError"),
        )
        self.assertNotIn(SECRET, (self.destination / JOURNAL).read_text())

    def test_nonzero_exit_is_attributable(self):
        result = self.run_hook("d.record_exit(23)\nraise SystemExit(23)\n")
        self.assertEqual(result.returncode, 23)
        self.assertEqual(self.records()[-1]["outcome"], "nonzero_exit")

    def test_unsafe_destinations_preserve_protocol(self):
        for kind in [
            "directory_symlink",
            "directory_symlink_slash",
            "directory_symlink_dot",
            "directory_public",
            "file_symlink",
            "fifo",
            "file_public",
            "hardlink",
            "relative",
        ]:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                self.destination = Path(temporary) / "diagnostics"
                if kind == "relative":
                    self.destination = Path("relative-not-created")
                elif kind.startswith("directory_symlink"):
                    target = Path(temporary) / "target"
                    target.mkdir(mode=0o700)
                    self.destination.symlink_to(target)
                    if kind == "directory_symlink_slash":
                        self.destination = str(self.destination) + "/"
                    elif kind == "directory_symlink_dot":
                        self.destination = str(self.destination) + "/."
                else:
                    self.destination.mkdir(mode=0o700)
                    file = self.destination / JOURNAL
                    if kind == "directory_public":
                        self.destination.chmod(0o755)
                    elif kind == "fifo":
                        os.mkfifo(file, 0o600)
                    elif kind == "file_symlink":
                        file.symlink_to(Path(temporary) / "missing")
                    elif kind in ("hardlink", "file_public"):
                        file.write_text("untouched")
                        file.chmod(0o600 if kind == "hardlink" else 0o644)
                        if kind == "hardlink":
                            os.link(file, Path(temporary) / "alias")
                result = self.run_hook("print('{}')\n")
                self.assertEqual(
                    (result.returncode, result.stdout, result.stderr),
                    (0, "{}\n", NOTICE),
                )
                if kind in ("hardlink", "file_public"):
                    self.assertEqual(
                        (self.destination / JOURNAL).read_text(), "untouched"
                    )
                if kind == "relative":
                    self.assertFalse(self.destination.exists())

    def test_capacity_is_bounded_without_truncating_existing_records(self):
        self.destination.mkdir(mode=0o700)
        file = self.destination / JOURNAL
        file.write_bytes(b"x" * 1_048_576)
        file.chmod(0o600)
        result = self.run_hook("print('{}')\n")
        self.assertEqual(
            (result.returncode, result.stdout, result.stderr), (0, "{}\n", NOTICE)
        )
        self.assertEqual(file.read_bytes(), b"x" * 1_048_576)

    def test_busy_journal_is_bounded(self):
        self.destination.mkdir(mode=0o700)
        file = self.destination / JOURNAL
        file.touch(mode=0o600)
        with file.open("a") as stream:
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
            result = self.run_hook("print('{}')\n")
        self.assertEqual(
            (result.returncode, result.stdout, result.stderr), (0, "{}\n", NOTICE)
        )

    def test_concurrent_writers_leave_complete_json_records(self):
        env = dict(
            os.environ,
            PYTHONPATH=str(HOOKS),
            AXIOM_HOOK_DIAGNOSTICS_DIR=str(self.destination),
        )
        for contention in ("none", "start", "end"):
            with self.subTest(contention=contention):
                self.destination = self.root / contention
                self.destination.mkdir(mode=0o700)
                journal = self.destination / JOURNAL
                journal.touch(mode=0o600)
                env["AXIOM_HOOK_DIAGNOSTICS_DIR"] = str(self.destination)
                with journal.open("a") as stream:
                    if contention == "start":
                        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
                    processes = []
                    correlations = []
                    try:
                        for _ in range(12):
                            processes.append(
                                subprocess.Popen(
                                    [
                                        sys.executable,
                                        "-c",
                                        (
                                            "import hook_diagnostics as d\n"
                                            "d.begin('posttool-bash-hints')\n"
                                            "print(d._state['correlation'], flush=True)\n"
                                            "input()\nprint('{}')\n"
                                        ),
                                    ],
                                    env=env,
                                    stdin=subprocess.PIPE,
                                    stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE,
                                )
                            )
                            if contention == "end":
                                process = processes[-1]
                                self.assertTrue(
                                    select.select([process.stdout], [], [], 3)[0]
                                )
                                correlations.append(
                                    process.stdout.readline().decode().strip()
                                )
                        if contention != "end":
                            for process in processes:
                                self.assertTrue(
                                    select.select([process.stdout], [], [], 3)[0]
                                )
                                correlation = process.stdout.readline().decode().strip()
                                correlations.append(correlation)
                        for correlation in correlations:
                            self.assertRegex(correlation, r"^[0-9a-f]{32}$")
                        self.assertEqual(len(set(correlations)), len(processes))
                        if contention == "end":
                            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
                        for process in processes:
                            process.stdin.write(b"\n")
                            process.stdin.close()
                            process.stdin = None
                        results = [
                            process.communicate(timeout=3) for process in processes
                        ]
                        records = self.records()
                        self.assertLessEqual(
                            {record["correlation"] for record in records},
                            set(correlations),
                        )
                        for process, correlation, (out, err) in zip(
                            processes, correlations, results
                        ):
                            self.assertEqual((process.returncode, out), (0, b"{}\n"))
                            self.assertIn(err, (b"", NOTICE.encode()))
                            phases = [
                                record["phase"]
                                for record in records
                                if record["correlation"] == correlation
                            ]
                            if contention == "start":
                                self.assertEqual((err, phases), (NOTICE.encode(), []))
                            elif contention == "end":
                                self.assertEqual(
                                    (err, phases), (NOTICE.encode(), ["start"])
                                )
                            elif err:
                                self.assertIn(phases, ([], ["start"]))
                            else:
                                self.assertEqual(phases, ["start", "end"])
                        for record in records:
                            self.assertEqual(
                                (
                                    record["schema_version"],
                                    record["hook"],
                                    record["event"],
                                    record["outcome"],
                                    record["exception_class"],
                                ),
                                (
                                    1,
                                    "posttool-bash-hints",
                                    "PostToolUse",
                                    "running"
                                    if record["phase"] == "start"
                                    else "success",
                                    None,
                                ),
                            )
                    finally:
                        for process in processes:
                            if process.poll() is None:
                                process.kill()
                            process.communicate(timeout=3)

    def test_signal_termination_has_start_but_no_fabricated_end(self):
        result = self.run_hook(
            "import signal; os = __import__('os'); os.kill(os.getpid(), signal.SIGTERM)\n"
        )
        self.assertEqual(result.returncode, -15)
        self.assertEqual([r["phase"] for r in self.records()], ["start"])

    def test_production_entry_points_preserve_protocol_and_record_lifecycle(self):
        payload = json.dumps(
            {
                "prompt": "Swift Sendable concurrency",
                "agent_type": "general-purpose",
                "tool_name": "Bash",
                "tool_input": {"command": "swift build"},
                "tool_response": "data race detected",
            }
        )
        for hook in [
            "session-start",
            "user-prompt-submit",
            "subagent-start",
            "posttool-bash-hints",
            "swift-guardrails",
            "pretool-crash-route",
        ]:
            with self.subTest(hook=hook):
                self.destination = self.root / hook
                command = [sys.executable, str(HOOKS / (hook + ".py"))]
                if hook == "session-start":
                    command.append(str(HOOKS.parent))
                env = dict(
                    os.environ, AXIOM_SESSION_CONTEXT="always", AXIOM_HARNESS="codex"
                )
                env.pop("AXIOM_HOOK_DIAGNOSTICS_DIR", None)
                baseline = subprocess.run(
                    command,
                    input=payload,
                    env=env,
                    cwd=self.root,
                    capture_output=True,
                    check=False,
                    text=True,
                    timeout=5,
                )
                env["AXIOM_HOOK_DIAGNOSTICS_DIR"] = str(self.destination)
                enabled = subprocess.run(
                    command,
                    input=payload,
                    env=env,
                    cwd=self.root,
                    capture_output=True,
                    check=False,
                    text=True,
                    timeout=5,
                )
                self.assertEqual(
                    (enabled.returncode, enabled.stdout, enabled.stderr),
                    (baseline.returncode, baseline.stdout, baseline.stderr),
                )
                self.assertEqual(
                    [(r["hook"], r["phase"], r["outcome"]) for r in self.records()],
                    [(hook, "start", "running"), (hook, "end", "success")],
                )

    def test_handled_payload_errors_remain_noops_with_exception_metadata(self):
        for hook in [
            "user-prompt-submit",
            "subagent-start",
            "posttool-bash-hints",
            "swift-guardrails",
            "pretool-crash-route",
        ]:
            with self.subTest(hook=hook):
                self.destination = self.root / hook
                env = dict(os.environ, AXIOM_HOOK_DIAGNOSTICS_DIR=str(self.destination))
                result = subprocess.run(
                    [sys.executable, str(HOOKS / (hook + ".py"))],
                    input=SECRET,
                    env=env,
                    capture_output=True,
                    check=False,
                    text=True,
                    timeout=3,
                )
                self.assertEqual((result.returncode, result.stderr), (0, ""))
                self.assertIn(result.stdout.strip(), ["", "{}"])
                self.assertEqual(
                    (
                        self.records()[-1]["outcome"],
                        self.records()[-1]["exception_class"],
                    ),
                    ("exception", "JSONDecodeError"),
                )


class TestDiagnosticsAreOptional(unittest.TestCase):
    """Diagnostics are opt-in; their absence must never break a hook."""

    ENTRY_POINTS = (
        "session-start.py",
        "user-prompt-submit.py",
        "subagent-start.py",
        "posttool-bash-hints.py",
        "swift-guardrails.py",
        "pretool-crash-route.py",
    )

    def test_module_loads_without_fcntl_and_degrades_to_the_notice(self):
        # fcntl does not exist on Windows; only an enabled journal needs it.
        for enabled, expected_stderr in ((False, ""), (True, NOTICE)):
            with self.subTest(enabled=enabled), tempfile.TemporaryDirectory() as root:
                env = dict(os.environ, PYTHONPATH=str(HOOKS))
                env.pop("AXIOM_HOOK_DIAGNOSTICS_DIR", None)
                if enabled:
                    env["AXIOM_HOOK_DIAGNOSTICS_DIR"] = str(Path(root) / "diagnostics")
                result = subprocess.run(
                    [
                        sys.executable,
                        "-c",
                        (
                            "import sys\nsys.modules['fcntl'] = None\n"
                            "import hook_diagnostics as d\nd.begin('session-start')\nprint('{}')\n"
                        ),
                    ],
                    env=env,
                    text=True,
                    capture_output=True,
                    check=False,
                    timeout=3,
                )
                self.assertEqual(
                    (result.returncode, result.stdout, result.stderr),
                    (0, "{}\n", expected_stderr),
                )

    def _stripped_hooks(self, root):
        stripped = Path(root) / "hooks"
        stripped.mkdir()
        for source in HOOKS.glob("*.py"):
            if source.name != "hook_diagnostics.py" and not source.name.endswith("_test.py"):
                (stripped / source.name).write_bytes(source.read_bytes())
        return stripped

    def _run(self, directory, script, **overrides):
        # PYTHONPATH is removed so an inherited value cannot supply the real module.
        env = dict(os.environ)
        for name in ("AXIOM_HOOK_DIAGNOSTICS_DIR", "AXIOM_HARNESS", "PYTHONPATH"):
            env.pop(name, None)
        env.update(overrides)
        return subprocess.run(
            [sys.executable, str(Path(directory) / script), str(HOOKS.parent)],
            input="{}",
            env=env,
            text=True,
            capture_output=True,
            check=False,
            timeout=10,
        )

    def test_entry_points_behave_identically_without_the_module(self):
        with tempfile.TemporaryDirectory() as root:
            stripped = self._stripped_hooks(root)
            for context in ("never", "always"):
                for script in self.ENTRY_POINTS:
                    with self.subTest(context=context, script=script):
                        normal = self._run(HOOKS, script, AXIOM_SESSION_CONTEXT=context)
                        without = self._run(stripped, script, AXIOM_SESSION_CONTEXT=context)
                        self.assertNotIn("Traceback", without.stderr)
                        self.assertEqual(
                            (without.returncode, without.stdout),
                            (normal.returncode, normal.stdout),
                        )

    def test_missing_module_reports_requested_diagnostics(self):
        # Same contract as an unwritable destination: one fixed notice, protocol unchanged.
        with tempfile.TemporaryDirectory() as root:
            stripped = self._stripped_hooks(root)
            for script in self.ENTRY_POINTS:
                with self.subTest(script=script):
                    result = self._run(
                        stripped,
                        script,
                        AXIOM_SESSION_CONTEXT="never",
                        AXIOM_HOOK_DIAGNOSTICS_DIR=str(Path(root) / "diagnostics"),
                    )
                    self.assertEqual(result.stderr.count(NOTICE), 1, result.stderr)
                    self.assertNotIn("Traceback", result.stderr)

    def test_every_fallback_is_identical_and_covers_the_public_api(self):
        import ast

        import hook_diagnostics

        fallbacks = set()
        for script in self.ENTRY_POINTS:
            source = (HOOKS / script).read_text()
            start = source.index("try:\n    import hook_diagnostics\n")
            end = source.index("\n    )\n", start) + len("\n    )\n")
            fallbacks.add(source[start:end])
        self.assertEqual(len(fallbacks), 1, "the six fallbacks must stay identical")
        tree = ast.parse(fallbacks.pop())
        provided = {
            keyword.arg
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "SimpleNamespace"
            for keyword in node.keywords
        }
        public = {
            name
            for name, value in vars(hook_diagnostics).items()
            if callable(value) and not name.startswith("_") and value.__module__ == "hook_diagnostics"
        }
        self.assertEqual(provided, public)


if __name__ == "__main__":
    unittest.main()
