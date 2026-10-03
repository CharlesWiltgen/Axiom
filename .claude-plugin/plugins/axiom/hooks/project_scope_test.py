"""Integration coverage for project scoping across every registered hook."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HOOKS = Path(__file__).resolve().parent


class TestProjectScope(unittest.TestCase):
    def test_all_hooks_follow_the_shared_project_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workspace = root / "workspace"
            workspace.mkdir()
            (workspace / ".git").mkdir()
            external = root / "external"
            external.mkdir()
            swift_file = external / "View.swift"
            swift_file.write_text("struct V { @State var count = 0 }\n")
            cases = (
                ("session-start.py", {}, "SessionStart"),
                (
                    "user-prompt-submit.py",
                    {"prompt": "Fix my SwiftUI navigation"},
                    "axiom-swiftui",
                ),
                (
                    "subagent-start.py",
                    {"agent_type": "general-purpose"},
                    "SubagentStart",
                ),
                (
                    "posttool-bash-hints.py",
                    {
                        "tool_name": "Bash",
                        "tool_input": {"command": "swift build"},
                        "tool_response": {
                            "output": "error: data race detected",
                            "exit_code": 1,
                        },
                    },
                    "axiom-concurrency",
                ),
                (
                    "swift-guardrails.py",
                    {
                        "tool_name": "Edit",
                        "tool_input": {"file_path": str(swift_file)},
                    },
                    "@State",
                ),
                (
                    "pretool-crash-route.py",
                    {
                        "tool_name": "Read",
                        "tool_input": {"file_path": str(external / "report.ips")},
                    },
                    "xcsym",
                ),
            )
            for apple, override, enabled in (
                (False, None, False),
                (False, "always", True),
                (True, None, True),
                (True, "never", False),
            ):
                marker = workspace / "Package.swift"
                if apple:
                    marker.write_text("// swift-tools-version: 6.0\n")
                else:
                    marker.unlink(missing_ok=True)
                for script, payload, expected in cases:
                    with self.subTest(apple=apple, override=override, script=script):
                        env = dict(
                            os.environ,
                            AXIOM_HARNESS="codex",
                            CLAUDE_TOOL_OUTPUT="error: data race detected",
                        )
                        env.pop("AXIOM_SESSION_CONTEXT", None)
                        if override:
                            env["AXIOM_SESSION_CONTEXT"] = override
                        result = subprocess.run(
                            [sys.executable, str(HOOKS / script), str(HOOKS.parent)],
                            cwd=workspace,
                            env=env,
                            input=json.dumps(payload),
                            capture_output=True,
                            text=True,
                            timeout=10,
                        )
                        self.assertEqual((result.returncode, result.stderr), (0, ""))
                        if enabled:
                            self.assertIn(expected, result.stdout)
                        else:
                            self.assertIn(result.stdout.strip(), ("", "{}"))


if __name__ == "__main__":
    unittest.main()
